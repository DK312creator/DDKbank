const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 3000;

// ===== НАСТРОЙКИ GITHUB =====
const GITHUB_TOKEN = 'СЮДА_ВСТАВЬ_СВОЙ_ТОКЕН'; // ← ЗАМЕНИ НА СВОЙ ТОКЕН
const GITHUB_USER = 'ТВОЙ_НИК_НА_GITHUB'; // ← ЗАМЕНИ НА СВОЙ НИК
const GITHUB_REPO = 'dkbank'; // ← ТВОЙ РЕПОЗИТОРИЙ
const GITHUB_BRANCH = 'main';
const DATA_FILES = ['users.json', 'bills.json', 'chats.json', 'damer-queue.json', 'log_info.txt', 'giftcards.json'];

// Функция загрузки файла с GitHub
function downloadFromGitHub(filename) {
    return new Promise((resolve, reject) => {
        const url = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filename}`;
        https.get(url, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'DKBank' }
        }, (res) => {
            if (res.statusCode === 404) { resolve(null); return; }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', () => resolve(null));
    });
}

// Функция загрузки файла на GitHub
function uploadToGitHub(filename, content) {
    return new Promise((resolve) => {
        // Сначала получаем SHA файла
        const getUrl = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${filename}`;
        const getOptions = {
            method: 'GET',
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'User-Agent': 'DKBank' }
        };
        
        https.get(getUrl, getOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let sha = null;
                try { sha = JSON.parse(data).sha; } catch(e) {}
                
                const body = JSON.stringify({
                    message: `Update ${filename}`,
                    content: Buffer.from(content).toString('base64'),
                    branch: GITHUB_BRANCH,
                    ...(sha ? { sha } : {})
                });
                
                const putOptions = {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'User-Agent': 'DKBank',
                        'Content-Type': 'application/json',
                        'Content-Length': body.length
                    }
                };
                
                const req = https.request(getUrl, putOptions);
                req.write(body);
                req.end();
                resolve();
            });
        });
    });
}

// Загрузка всех данных при запуске
async function loadAllData() {
    console.log('📥 Загрузка данных с GitHub...');
    for (const filename of DATA_FILES) {
        const data = await downloadFromGitHub(filename);
        if (data !== null) {
            fs.writeFileSync(path.join(__dirname, filename), data);
            console.log('   ✅ ' + filename);
        } else {
            console.log('   📄 ' + filename + ' (новый)');
            if (filename === 'users.json') fs.writeFileSync(path.join(__dirname, filename), '{}');
            else if (filename === 'bills.json' || filename === 'damer-queue.json') fs.writeFileSync(path.join(__dirname, filename), '[]');
            else if (filename === 'giftcards.json') {
                const cards = { DK100: { amount: 100, used: false }, DK500: { amount: 500, used: false }, DK1000: { amount: 1000, used: false }, DIANA: { amount: 777, used: false }, DAMER: { amount: 500, used: false }, BONUS: { amount: 50, used: false } };
                fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(cards, null, 2));
            }
        }
    }
    console.log('✅ Данные загружены!\n');
}

// Сохранение всех данных на GitHub
let saveTimeout = null;
function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        console.log('📤 Сохранение на GitHub...');
        for (const filename of DATA_FILES) {
            if (fs.existsSync(path.join(__dirname, filename))) {
                const content = fs.readFileSync(path.join(__dirname, filename), 'utf8');
                await uploadToGitHub(filename, content);
            }
        }
        console.log('✅ Сохранено!');
    }, 2000);
}

app.use(cors());
app.use(express.json());

const UPLOADS_FOLDER = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_FOLDER)) fs.mkdirSync(UPLOADS_FOLDER, { recursive: true });
app.use(express.static(__dirname));
app.use('/uploads', express.static(UPLOADS_FOLDER));

const storage = multer.diskStorage({
    destination: UPLOADS_FOLDER,
    filename: (req, file, cb) => {
        const nick = req.body.nick || 'temp_' + Date.now();
        cb(null, nick + '_avatar' + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch(e) { return (file.includes('bills') || file.includes('queue')) ? [] : {}; }
}

function loadUsers() { return loadJSON(path.join(__dirname, 'users.json')); }
function saveUsers(u) { fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(u, null, 2)); scheduleSave(); }
function loadChats() { return loadJSON(path.join(__dirname, 'chats.json')); }
function saveChats(c) { fs.writeFileSync(path.join(__dirname, 'chats.json'), JSON.stringify(c, null, 2)); scheduleSave(); }
function loadQueue() { return loadJSON(path.join(__dirname, 'damer-queue.json')); }
function saveQueue(q) { fs.writeFileSync(path.join(__dirname, 'damer-queue.json'), JSON.stringify(q, null, 2)); scheduleSave(); }
function saveBills(b) { fs.writeFileSync(path.join(__dirname, 'bills.json'), JSON.stringify(b, null, 2)); scheduleSave(); }

function logRegistration(nick, password) {
    const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
    fs.appendFileSync(path.join(__dirname, 'log_info.txt'), `[${date}] ${nick} | ${password}\n`);
    scheduleSave();
}

// Бот
function botReply(msg) {
    msg = msg.toLowerCase();
    if (msg.includes('привет')) return 'Привет!';
    if (msg.includes('баланс')) return 'Баланс в кабинете.';
    if (msg.includes('перевод')) return 'В разделе Платежи.';
    return 'Нажмите Служба поддержки.';
}

// ===== СТРАНИЦЫ =====
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/edit-profile', (req, res) => res.sendFile(path.join(__dirname, 'edit_profile.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'chathelp_up.html')));
app.get('/payments', (req, res) => res.sendFile(path.join(__dirname, 'payments.html')));
app.get('/history', (req, res) => res.sendFile(path.join(__dirname, 'history.html')));

// ===== РЕГИСТРАЦИЯ =====
app.post('/register', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (users[nick]) return res.json({ success: false, message: 'Ник занят!' });
    users[nick] = { password, balance: 0, role: 'Участник', avatar: '', firstName: '', lastName: '', email: '', phone: '' };
    saveUsers(users);
    logRegistration(nick, password);
    res.json({ success: true });
});

// ===== ВХОД =====
app.post('/login', (req, res) => {
    const { nick, password } = req.body;
    const users = loadUsers();
    if (!users[nick]) return res.json({ success: false, message: 'Не найден!' });
    if (users[nick].banned) return res.json({ success: false, banned: true });
    if (users[nick].password !== password) return res.json({ success: false, message: 'Неверный пароль!' });
    res.json({ success: true, ...users[nick] });
});

// ===== АВАТАР =====
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const nick = req.body.nick;
    if (!nick || !req.file) return res.json({ success: false, message: 'Ошибка!' });
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

// ===== ПРОФИЛЬ =====
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

// ===== ПЕРЕВОД =====
app.post('/transfer', (req, res) => {
    const { from, to, amount } = req.body;
    const users = loadUsers();
    if (!users[from]) return res.json({ success: false, message: 'Отправитель не найден!' });
    if (!users[to]) return res.json({ success: false, message: 'Получатель не найден!' });
    if (users[from].balance < amount) return res.json({ success: false, message: 'Недостаточно!' });
    users[from].balance -= amount;
    users[to].balance += amount;
    saveUsers(users);
    const bills = loadJSON(path.join(__dirname, 'bills.json'));
    bills.push({ type: 'transfer', from, to, amount, date: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    saveBills(bills);
    res.json({ success: true });
});

// ===== ПОДАРОЧНАЯ КАРТА =====
app.post('/gift', (req, res) => {
    const { nick, code } = req.body;
    const users = loadUsers();
    const cards = loadJSON(path.join(__dirname, 'giftcards.json'));
    if (!cards[code]) return res.json({ success: false, message: 'Нет карты!' });
    if (cards[code].used) return res.json({ success: false, message: 'Использована!' });
    users[nick].balance += cards[code].amount;
    cards[code].used = true;
    saveUsers(users);
    fs.writeFileSync(path.join(__dirname, 'giftcards.json'), JSON.stringify(cards, null, 2));
    scheduleSave();
    res.json({ success: true, message: '+' + cards[code].amount + ' ♎' });
});

// ===== ИСТОРИЯ =====
app.get('/api/history/:nick', (req, res) => {
    const bills = loadJSON(path.join(__dirname, 'bills.json'));
    const t = bills.filter(b => b.from === req.params.nick || b.to === req.params.nick).reverse();
    res.json({ success: true, transactions: t });
});

// ===== ЧАТ =====
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
    chats[req.params.nick].adminReplies = [];
    saveChats(chats);
    res.json({ success: true, adminReplies: r });
});

app.post('/chat/call-operator', (req, res) => {
    const chats = loadChats();
    if (!chats[req.body.nick]) chats[req.body.nick] = { messages: [], adminReplies: [], waitingOperator: true };
    else chats[req.body.nick].waitingOperator = true;
    saveChats(chats);
    res.json({ success: true });
});

// ===== ДАМЕР =====
const DAMER_KEY = 'damersecret123';
function checkKey(req, res) {
    const key = req.query.key || (req.body && req.body.key);
    if (key !== DAMER_KEY) { res.json({ success: false, message: 'Доступ запрещён!' }); return false; }
    return true;
}

app.get('/damer-queue-data', (req, res) => {
    if (!checkKey(req, res)) return;
    res.json({ success: true, requests: loadQueue().filter(r => !r.shown) });
});

app.post('/damer-done', (req, res) => {
    if (!checkKey(req, res)) return;
    saveQueue(loadQueue().filter(r => r.from !== req.body.nick));
    res.json({ success: true });
});

app.post('/damer-refund', (req, res) => {
    if (!checkKey(req, res)) return;
    const users = loadUsers();
    if (users[req.body.nick]) { users[req.body.nick].balance += parseInt(req.body.amount); saveUsers(users); }
    saveQueue(loadQueue().filter(r => !(r.from === req.body.nick && r.amount === parseInt(req.body.amount))));
    res.json({ success: true });
});

app.post('/unit-transfer-request', (req, res) => {
    const { from, type, number, amount } = req.body;
    const users = loadUsers();
    if (!users[from]) return res.json({ success: false, message: 'Не найден!' });
    if (users[from].balance < amount) return res.json({ success: false, message: 'Недостаточно!' });
    users[from].balance -= amount;
    saveUsers(users);
    const q = loadQueue();
    q.push({ from, type, number, amount, shown: false });
    saveQueue(q);
    res.json({ success: true });
});

// ===== ЗАПУСК =====
(async () => {
    await loadAllData();
    app.listen(PORT, '0.0.0.0', () => {
        console.log('🚀 DKBank запущен!');
    });
})();
