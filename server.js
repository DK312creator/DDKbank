const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const UPLOADS_FOLDER = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_FOLDER)) fs.mkdirSync(UPLOADS_FOLDER, { recursive: true });

const storage = multer.diskStorage({
    destination: UPLOADS_FOLDER,
    filename: (req, file, cb) => {
        const nick = req.body.nick || 'temp';
        cb(null, nick + '_avatar' + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

function loadJSON(filename) {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf8')); }
    catch(e) { return (filename === 'bills.json' || filename === 'damer-queue.json') ? [] : {}; }
}
function saveJSON(filename, data) {
    fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(data, null, 2));
}

function loadUsers() { return loadJSON('users.json'); }
function saveUsers(u) { saveJSON('users.json', u); }
function loadChats() { return loadJSON('chats.json'); }
function saveChats(c) { saveJSON('chats.json', c); }

function botReply(msg) {
    msg = msg.toLowerCase();
    if (msg.includes('привет')) return 'Привет!';
    if (msg.includes('баланс')) return 'Баланс в кабинете.';
    if (msg.includes('перевод')) return 'В разделе Платежи.';
    return 'Нажмите Служба поддержки.';
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/edit-profile', (req, res) => res.sendFile(path.join(__dirname, 'edit_profile.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chathelp_up.html')));
app.get('/payments', (req, res) => res.sendFile(path.join(__dirname, 'payments.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'history.html')));

app.post('/register', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (users[nick]) return res.json({ success: false, message: 'Ник занят!' });
    users[nick] = { password, balance: 0, role: 'Участник', avatar: '', firstName: '', lastName: '', email: '', phone: '' };
    saveUsers(users);
    res.json({ success: true });
});

app.post('/login', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false, message: 'Не найден!' });
    if (users[nick].banned) return res.json({ success: false, banned: true });
    if (users[nick].password !== password) return res.json({ success: false, message: 'Неверный пароль!' });
    res.json({ success: true, ...users[nick] });
});

app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const nick = req.body.nick;
    if (!nick || !req.file) return res.json({ success: false });
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false });
    const newName = nick + '_avatar' + path.extname(req.file.originalname);
    const newPath = path.join(UPLOADS_FOLDER, newName);
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    fs.renameSync(req.file.path, newPath);
    users[nick].avatar = 'uploads/' + newName;
    saveUsers(users);
    res.json({ success: true });
});

app.get('/api/profile/:nick', (req, res) => {
    const users = loadUsers();
    res.json({ success: !!users[req.params.nick], ...(users[req.params.nick] || {}) });
});

app.post('/update-profile', (req, res) => {
    const { nick, firstName, lastName, email, phone, newPassword } = req.body;
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false });
    if (firstName !== undefined) users[nick].firstName = firstName;
    if (lastName !== undefined) users[nick].lastName = lastName;
    if (email !== undefined) users[nick].email = email;
    if (phone !== undefined) users[nick].phone = phone;
    if (newPassword && newPassword.length >= 4) users[nick].password = newPassword;
    saveUsers(users);
    res.json({ success: true });
});

app.post('/delete', (req, res) => {
    const { nick, amount } = req.body;
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false, message: 'Не найден!' });
    if (users[nick].balance < amount) return res.json({ success: false, message: 'Недостаточно!' });
    users[nick].balance -= amount;
    saveUsers(users);
    const bills = loadJSON('bills.json');
    bills.push({ type: 'take', from: nick, amount, date: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    saveJSON('bills.json', bills);
    res.json({ success: true });
});

app.post('/gift', (req, res) => {
    const { nick, code } = req.body;
    const users = loadUsers();
    const cards = loadJSON('giftcards.json');
    if (!cards[code]) return res.json({ success: false, message: 'Нет карты!' });
    if (cards[code].used) return res.json({ success: false, message: 'Использована!' });
    users[nick].balance += cards[code].amount;
    cards[code].used = true;
    saveUsers(users);
    saveJSON('giftcards.json', cards);
    res.json({ success: true, message: '+' + cards[code].amount + ' ♎' });
});

app.get('/api/history/:nick', (req, res) => {
    const bills = loadJSON('bills.json');
    const t = bills.filter(b => b.from === req.params.nick || b.to === req.params.nick).reverse();
    res.json({ success: true, transactions: t });
});

app.post('/chat/send', (req, res) => {
    const { nick, message } = req.body;
    const chats = loadChats();
    if (!chats[nick]) chats[nick] = { messages: [], adminReplies: [], waitingOperator: false };
    chats[nick].messages.push({ from: 'user', text: message });
    saveChats(chats);
    res.json({ success: true, botReply: botReply(message) });
});

app.get('/chat/messages/:nick', (req, res) => {
    const chats = loadChats();
    const r = chats[req.params.nick]?.adminReplies || [];
    if (chats[req.params.nick]) chats[req.params.nick].adminReplies = [];
    saveChats(chats);
    res.json({ success: true, adminReplies: r });
});

const DAMER_KEY = 'damersecret123';

app.get('/damer-queue-data', (req, res) => {
    if (req.query.key !== DAMER_KEY) return res.json({ success: false });
    const q = loadJSON('damer-queue.json');
    res.json({ success: true, requests: q.filter(r => !r.shown) });
});

app.post('/damer-done', (req, res) => {
    if (req.body.key !== DAMER_KEY) return res.json({ success: false });
    const q = loadJSON('damer-queue.json');
    saveJSON('damer-queue.json', q.filter(r => r.from !== req.body.nick));
    res.json({ success: true });
});

app.post('/damer-refund', (req, res) => {
    if (req.body.key !== DAMER_KEY) return res.json({ success: false });
    const users = loadUsers();
    if (users[req.body.nick]) { users[req.body.nick].balance += parseInt(req.body.amount); saveUsers(users); }
    const q = loadJSON('damer-queue.json');
    saveJSON('damer-queue.json', q.filter(r => !(r.from === req.body.nick && r.amount === parseInt(req.body.amount))));
    res.json({ success: true });
});

app.post('/unit-transfer-request', (req, res) => {
    const { from, type, number, amount } = req.body;
    const users = loadUsers();
    if (!users[from]) return res.json({ success: false, message: 'Не найден!' });
    if (users[from].balance < amount) return res.json({ success: false, message: 'Недостаточно!' });
    users[from].balance -= amount;
    saveUsers(users);
    const q = loadJSON('damer-queue.json');
    q.push({ from, type, number, amount, shown: false });
    saveJSON('damer-queue.json', q);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 DKBank на порту ' + PORT);
});
