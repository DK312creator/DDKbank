const fs = require('fs');
const path = require('path');
const readline = require('readline');

const USERS_FILE = path.join(__dirname, 'users.json');
const QUEUE_FILE = path.join(__dirname, 'damer-queue.json');

function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch (e) { return {}; }
}

function saveUsers(u) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));
}

function loadQueue() {
    try { return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); }
    catch (e) { return []; }
}

function saveQueue(q) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(q, null, 2));
}

console.log('💎 ========================');
console.log('💎 ТЕРМИНАЛ DAMER ЗАПУЩЕН');
console.log('💎 ========================');
console.log('📋 done NICK — отметить заявку выполненной');
console.log('📋 refund NICK СУММА — вернуть деньги');
console.log('📋 queue — показать заявки');
console.log('📋 clear — очистить очередь');
console.log('👁️  Ожидание...\n');

setInterval(() => {
    const queue = loadQueue();
    const newOnes = queue.filter(r => !r.shown);
    if (newOnes.length > 0) {
        for (const r of newOnes) {
            console.log('\n💎 === НОВАЯ ЗАЯВКА ===');
            console.log('👤 От: ' + r.from);
            console.log('📋 Тип: ' + r.type);
            console.log('🔢 Номер: ' + r.number);
            console.log('💰 Сумма: ♎' + r.amount);
            console.log('✍️  done ' + r.from + '  — выполнил перевод');
            console.log('❌  refund ' + r.from + ' ' + r.amount + '  — возврат');
            console.log('========================\n');
            r.shown = true;
        }
        saveQueue(queue);
    }
}, 3000);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function prompt() {
    rl.question('', (line) => {
        const parts = line.trim().split(' ');
        const cmd = parts[0];
        const target = parts[1];
        const amount = parseInt(parts[2]);

        if (cmd === 'done' && target) {
            const queue = loadQueue();
            const req = queue.find(r => r.from === target && r.shown);
            if (!req) {
                console.log('❌ Нет активной заявки от ' + target);
            } else {
                const newQueue = queue.filter(r => r !== req);
                saveQueue(newQueue);
                console.log('✅ Заявка от ' + target + ' выполнена! Дамер перевёл ♎' + req.amount + ' на ' + req.number);
            }
        }
        else if (cmd === 'refund' && target && !isNaN(amount) && amount > 0) {
            const users = loadUsers();
            if (!users[target]) {
                console.log('❌ Пользователь не найден!');
            } else {
                users[target].balance += amount;
                saveUsers(users);
                const queue = loadQueue();
                const newQueue = queue.filter(r => !(r.from === target && r.amount === amount));
                saveQueue(newQueue);
                console.log('🔙 Возврат +♎' + amount + ' → ' + target + ' | Баланс: ♎' + users[target].balance);
            }
        }
        else if (cmd === 'queue') {
            const queue = loadQueue();
            console.log('\n📋 Очередь:');
            if (queue.length === 0) console.log('   Пусто');
            else queue.forEach(r => console.log('  🆕 ' + r.from + ' | ♎' + r.amount + ' | ' + r.number));
            console.log('');
        }
        else if (cmd === 'clear') {
            saveQueue([]);
            console.log('✅ Очищено!');
        }
        else if (cmd === 'help') {
            console.log('\ndone NICK | refund NICK СУММА | queue | clear | help\n');
        }
        else if (line.trim()) console.log('❌ help');

        prompt();
    });
}

prompt();