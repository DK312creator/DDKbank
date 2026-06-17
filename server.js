const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const readline = require('readline');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const SITE_FOLDER = __dirname;
const UPLOADS_FOLDER = path.join(SITE_FOLDER, 'uploads');

if (!fs.existsSync(UPLOADS_FOLDER)) {
    fs.mkdirSync(UPLOADS_FOLDER, { recursive: true });
}

app.use(express.static(SITE_FOLDER));
app.use('/uploads', express.static(UPLOADS_FOLDER));

const storage = multer.diskStorage({
    destination: UPLOADS_FOLDER,
    filename: function(req, file, cb) {
        const nick = req.body.nick || 'temp_' + Date.now();
        const ext = path.extname(file.originalname);
        cb(null, nick + '_avatar' + ext);
    }
});
const upload = multer({ storage: storage });

const USERS_FILE = path.join(__dirname, 'users.json');
const LOG_FILE = path.join(__dirname, 'log_info.txt');
const CHAT_FILE = path.join(__dirname, 'chats.json');
const BILLS_FILE = path.join(__dirname, 'bills.json');
const GIFTS_FILE = path.join(__dirname, 'giftcards.json');
const QUEUE_FILE = path.join(__dirname, 'damer-queue.json');

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return (file === BILLS_FILE || file === QUEUE_FILE) ? [] : {}; }
}
function saveJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

function loadUsers() { return loadJSON(USERS_FILE); }
function saveUsers(u) { saveJSON(USERS_FILE, u); }
function loadChats() { return loadJSON(CHAT_FILE); }
function saveChats(c) { saveJSON(CHAT_FILE, c); }
function loadGifts() { return loadJSON(GIFTS_FILE); }
function saveGifts(g) { saveJSON(GIFTS_FILE, g); }
function loadQueue() { return loadJSON(QUEUE_FILE); }
function saveQueue(q) { saveJSON(QUEUE_FILE, q); }

function logRegistration(nick, password) {
    const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
    fs.appendFileSync(LOG_FILE, '[' + date + '] Ник: ' + nick + ' | Пароль: ' + password + '\n');
}

function botReply(msg) {
    msg = msg.toLowerCase();
    if (msg.includes('привет') || msg.includes('здрав')) return 'Привет!';
    if (msg.includes('баланс')) return 'Баланс в личном кабинете.';
    if (msg.includes('перевод')) return 'Переводы в разделе "Платежи".';
    if (msg.includes('подар') || msg.includes('код')) return 'Коды: DK100, DK500, DK1000, DIANA, DAMER, BONUS.';
    if (msg.includes('спасиб')) return 'Всегда пожалуйста!';
    return 'Нажмите "Служба поддержки".';
}

// ========== СТРАНИЦЫ ==========
app.get('/', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'profile.html')));
app.get('/edit-profile', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'edit_profile.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'chathelp_up.html')));
app.get('/payments', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'payments.html')));
app.get('/history', (req, res) => res.sendFile(path.join(SITE_FOLDER, 'history.html')));

// ========== РЕГИСТРАЦИЯ ==========
app.post('/register', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (users[nick]) return res.json({ success: false, message: 'Ник уже занят!' });
    users[nick] = { password, balance: 0, role: 'Участник', avatar: '', firstName: '', lastName: '', email: '', phone: '' };
    saveUsers(users);
    logRegistration(nick, password);
    res.json({ success: true });
});

// ========== ВХОД ==========
app.post('/login', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false, message: 'Аккаунт не найден!' });
    if (users[nick].banned) return res.json({ success: false, banned: true, banCode: users[nick].banCode || '0', banReason: users[nick].banReason || 'Нарушение' });
    if (users[nick].password !== password) return res.json({ success: false, message: 'Неверный пароль!' });
    res.json({ success: true, balance: users[nick].balance, role: users[nick].role, avatar: users[nick].avatar });
});

// ========== АВАТАР ==========
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const nick = req.body.nick;
    if (!nick) return res.json({ success: false, message: 'Ник не указан!' });
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false, message: 'Пользователь не найден' });
    if (!req.file) return res.json({ success: false, message: 'Файл не выбран!' });
    const ext = path.extname(req.file.originalname);
    const newName = nick + '_avatar' + ext;
    const newPath = path.join(UPLOADS_FOLDER, newName);
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
    fs.renameSync(req.file.path, newPath);
    users[nick].avatar = 'uploads/' + newName;
    saveUsers(users);
    res.json({ success: true });
});

// ========== ПРОФИЛЬ ==========
app.get('/api/profile/:nick', (req, res) => {
    const users = loadUsers();
    if (!users[req.params.nick]) return res.json({ success: false });
    res.json({ success: true, ...users[req.params.nick] });
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

// ========== ПЕРЕВОД ВНУТРИ БАНКА ==========
app.post('/transfer', (req, res) => {
    const { from, to, amount } = req.body;
    const users = loadUsers();
    if (!users[from]) return res.json({ success: false, message: 'Отправитель не найден!' });
    if (!users[to]) return res.json({ success: false, message: 'Получатель не найден!' });
    if (users[from].balance < amount) return res.json({ success: false, message: 'Недостаточно средств!' });
    users[from].balance -= amount;
    users[to].balance += amount;
    saveUsers(users);
    const bills = loadJSON(BILLS_FILE);
    bills.push({ type: 'transfer', from, to, amount, date: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    saveJSON(BILLS_FILE, bills);
    res.json({ success: true, message: 'Перевод выполнен!' });
});

// ========== ЗАЯВКА ДАМЕРУ (списание сразу) ==========
app.post('/unit-transfer-request', (req, res) => {
    const { from, type, number, amount } = req.body;
    const users = loadUsers();
    if (!users[from]) return res.json({ success: false, message: 'Отправитель не найден!' });
    if (users[from].balance < amount) return res.json({ success: false, message: 'Недостаточно средств!' });
    users[from].balance -= amount;
    saveUsers(users);
    const bills = loadJSON(BILLS_FILE);
    bills.push({ type: 'unit_transfer', from, to: 'Дамер', amount, number, date: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    saveJSON(BILLS_FILE, bills);
    const queue = loadQueue();
    queue.push({ from, type, number, amount, shown: false, date: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    saveQueue(queue);
    console.log('💎 Дамер: ' + from + ' | ♎' + amount);
    res.json({ success: true, message: 'Списано ♎' + amount });
});

// ========== ПОДАРОЧНАЯ КАРТА ==========
app.post('/gift', (req, res) => {
    const { nick, code } = req.body;
    const users = loadUsers();
    const cards = loadGifts();
    if (!cards[code]) return res.json({ success: false, message: 'Нет такой карты!' });
    if (cards[code].used) return res.json({ success: false, message: 'Уже использована!' });
    users[nick].balance += cards[code].amount;
    cards[code].used = true;
    saveUsers(users);
    saveGifts(cards);
    res.json({ success: true, message: '+' + cards[code].amount + ' ♎' });
});

// ========== УДАЛЕНИЕ ==========
app.post('/delete', (req, res) => {
    const { nick, amount } = req.body;
    const users = loadUsers();
    if (users[nick].balance < amount) return res.json({ success: false, message: 'Недостаточно!' });
    users[nick].balance -= amount;
    saveUsers(users);
    res.json({ success: true });
});

// ========== ИСТОРИЯ ==========
app.get('/api/history/:nick', (req, res) => {
    const bills = loadJSON(BILLS_FILE);
    const transactions = bills.filter(b => b.from === req.params.nick || b.to === req.params.nick).reverse();
    res.json({ success: true, transactions });
});

// ========== ЧАТ ==========
app.post('/chat/send', (req, res) => {
    const { nick, message } = req.body;
    const chats = loadChats();
    if (!chats[nick]) chats[nick] = { messages: [], adminReplies: [], waitingOperator: false };
    chats[nick].messages.push({ from: 'user', text: message, time: new Date().toISOString() });
    if (chats[nick].waitingOperator) console.log('\n💬 ' + nick + ': ' + message + '\n');
    saveChats(chats);
    res.json({ success: true, botReply: botReply(message) });
});

app.get('/chat/messages/:nick', (req, res) => {
    const chats = loadChats();
    if (!chats[req.params.nick]) return res.json({ success: true, adminReplies: [], closed: false });
    const replies = chats[req.params.nick].adminReplies || [];
    const closed = chats[req.params.nick].closed || false;
    chats[req.params.nick].adminReplies = [];
    chats[req.params.nick].closed = false;
    saveChats(chats);
    res.json({ success: true, adminReplies: replies, closed });
});

app.post('/chat/call-operator', (req, res) => {
    const chats = loadChats();
    if (!chats[req.body.nick]) chats[req.body.nick] = { messages: [], adminReplies: [], waitingOperator: false };
    chats[req.body.nick].waitingOperator = true;
    saveChats(chats);
    console.log('\n📞 ВЫЗОВ: ' + req.body.nick + '\n');
    res.json({ success: true });
});

// ========== API ДЛЯ ТЕРМИНАЛА ДАМЕРА (защищённый) ==========
const DAMER_KEY = 'damersecret123';

// Проверка ключа
function checkKey(req, res) {
    const key = req.query.key || (req.body && req.body.key);
    if (key !== DAMER_KEY) {
        res.json({ success: false, message: 'Доступ запрещён!' });
        return false;
    }
    return true;
}

app.get('/damer-queue-data', (req, res) => {
    if (!checkKey(req, res)) return;
    const queue = loadQueue();
    res.json({ success: true, requests: queue.filter(r => !r.shown) });
});

app.post('/damer-done', (req, res) => {
    if (!checkKey(req, res)) return;
    const { nick } = req.body;
    const queue = loadQueue();
    const newQueue = queue.filter(r => !(r.from === nick));
    saveQueue(newQueue);
    console.log('✅ Дамер выполнил: ' + nick);
    res.json({ success: true });
});

app.post('/damer-refund', (req, res) => {
    if (!checkKey(req, res)) return;
    const { nick, amount } = req.body;
    const users = loadUsers();
    if (users[nick]) {
        users[nick].balance += parseInt(amount);
        saveUsers(users);
    }
    const queue = loadQueue();
    const newQueue = queue.filter(r => !(r.from === nick && r.amount === parseInt(amount)));
    saveQueue(newQueue);
    console.log('🔙 Возврат: ' + nick + ' | ♎' + amount);
    res.json({ success: true });
});

app.post('/damer-done', (req, res) => {
    if (req.body.key !== DAMER_KEY) return res.json({ success: false, message: 'Доступ запрещён!' });
    const { nick } = req.body;
    const queue = loadQueue();
    const newQueue = queue.filter(r => !(r.from === nick));
    saveQueue(newQueue);
    console.log('✅ Дамер: ' + nick);
    res.json({ success: true });
});

app.post('/damer-refund', (req, res) => {
    if (req.body.key !== DAMER_KEY) return res.json({ success: false, message: 'Доступ запрещён!' });
    const { nick, amount } = req.body;
    const users = loadUsers();
    if (users[nick]) {
        users[nick].balance += parseInt(amount);
        saveUsers(users);
    }
    const queue = loadQueue();
    const newQueue = queue.filter(r => !(r.from === nick && r.amount === parseInt(amount)));
    saveQueue(newQueue);
    console.log('🔙 Возврат: ' + nick + ' | ♎' + amount);
    res.json({ success: true });
});

// ========== ТЕРМИНАЛ ==========
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt() {
    rl.question('', (line) => {
        const p = line.trim().split(' ');
        const cmd = p[0], target = p[1], rest = p.slice(2).join(' ');
        const users = loadUsers();
        if (cmd === 'reply' && target && rest) {
            const chats = loadChats();
            if (!chats[target]) chats[target] = { messages: [], adminReplies: [], waitingOperator: false };
            chats[target].adminReplies.push({ text: rest, time: new Date().toISOString() });
            saveChats(chats);
            console.log('✅ → ' + target);
        } else if (cmd === 'give' && target) {
            const amt = parseInt(rest);
            if (!users[target]) console.log('❌ Не найден!');
            else { users[target].balance += amt; saveUsers(users); console.log('✅ +' + amt + ' → ' + target); }
        } else if (cmd === 'take' && target) {
            const amt = parseInt(rest);
            if (!users[target]) console.log('❌ Не найден!');
            else if (users[target].balance < amt) console.log('❌ Не хватает!');
            else { users[target].balance -= amt; saveUsers(users); console.log('✅ -' + amt + ' у ' + target); }
        } else if (cmd === 'ban' && target) {
            const r = rest.split(' ');
            if (!users[target]) console.log('❌ Не найден!');
            else { users[target].banned = true; users[target].banCode = r[0]; users[target].banReason = r.slice(1).join(' ') || 'Нарушение'; saveUsers(users); console.log('🚫 ' + target); }
        } else if (cmd === 'unban' && target) {
            if (!users[target]) console.log('❌ Не найден!');
            else { delete users[target].banned; saveUsers(users); console.log('✅ ' + target); }
        } else if (cmd === 'users') {
            for (var u in users) console.log('👤 ' + u + ' | ♎' + users[u].balance);
        } else if (cmd === 'help') console.log('reply, give, take, ban, unban, users');
        else if (line.trim()) console.log('❌ help');
        prompt();
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 DKBank http://127.0.0.1:' + PORT);
    prompt();
});
