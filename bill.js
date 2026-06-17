const fs = require('fs');
const path = require('path');

const BILLS_FILE = path.join(__dirname, 'bills.json');
const USERS_FILE = path.join(__dirname, 'users.json');

function loadJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { return file === BILLS_FILE ? [] : {}; }
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const args = process.argv.slice(2);
const command = args[0];
const target1 = args[1];
const target2 = args[2];
const amount = parseInt(args[3]);

if (!command) {
    console.log('\n💸 BILLS — управление счетами');
    console.log('  node bill.js transfer FROM TO 500   — перевод между людьми');
    console.log('  node bill.js give NICK 500          — выдать от сервера');
    console.log('  node bill.js take NICK 200          — снять (корзина)');
    console.log('  node bill.js fine NICK 100          — штраф');
    console.log('  node bill.js list                   — история операций');
    console.log('  node bill.js balance NICK           — баланс пользователя\n');
    process.exit(0);
}

const bills = loadJSON(BILLS_FILE);
const users = loadJSON(USERS_FILE);

if (command === 'transfer') {
    if (!target1 || !target2 || isNaN(amount)) {
        console.log('❌ node bill.js transfer ОТ КОМУ СУММА');
        process.exit(1);
    }
    if (!users[target1]) { console.log('❌ Отправитель не найден!'); process.exit(1); }
    if (!users[target2]) { console.log('❌ Получатель не найден!'); process.exit(1); }
    if (users[target1].balance < amount) { console.log('❌ Недостаточно средств!'); process.exit(1); }
    
    users[target1].balance -= amount;
    users[target2].balance += amount;
    
    bills.push({
        type: 'transfer',
        from: target1,
        to: target2,
        amount: amount,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    });
    
    saveJSON(USERS_FILE, users);
    saveJSON(BILLS_FILE, bills);
    console.log('✅ Перевод: ' + target1 + ' → ' + target2 + ' | ♎' + amount);
    console.log('   Баланс ' + target1 + ': ♎' + users[target1].balance);
    console.log('   Баланс ' + target2 + ': ♎' + users[target2].balance);
}

else if (command === 'give') {
    if (!target1 || isNaN(amount)) {
        console.log('❌ node bill.js give NICK СУММА');
        process.exit(1);
    }
    if (!users[target1]) { console.log('❌ Пользователь не найден!'); process.exit(1); }
    
    users[target1].balance += amount;
    
    bills.push({
        type: 'give',
        to: target1,
        amount: amount,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    });
    
    saveJSON(USERS_FILE, users);
    saveJSON(BILLS_FILE, bills);
    console.log('✅ Выдано: +♎' + amount + ' → ' + target1);
    console.log('   Баланс ' + target1 + ': ♎' + users[target1].balance);
}

else if (command === 'take') {
    if (!target1 || isNaN(amount)) {
        console.log('❌ node bill.js take NICK СУММА');
        process.exit(1);
    }
    if (!users[target1]) { console.log('❌ Пользователь не найден!'); process.exit(1); }
    if (users[target1].balance < amount) { console.log('❌ Недостаточно средств!'); process.exit(1); }
    
    users[target1].balance -= amount;
    
    bills.push({
        type: 'take',
        from: target1,
        amount: amount,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    });
    
    saveJSON(USERS_FILE, users);
    saveJSON(BILLS_FILE, bills);
    console.log('✅ Снято: -♎' + amount + ' у ' + target1);
    console.log('   Баланс ' + target1 + ': ♎' + users[target1].balance);
}

else if (command === 'fine') {
    if (!target1 || isNaN(amount)) {
        console.log('❌ node bill.js fine NICK СУММА');
        process.exit(1);
    }
    if (!users[target1]) { console.log('❌ Пользователь не найден!'); process.exit(1); }
    
    users[target1].balance -= amount;
    if (users[target1].balance < 0) users[target1].balance = 0;
    
    bills.push({
        type: 'fine',
        to: target1,
        amount: amount,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    });
    
    saveJSON(USERS_FILE, users);
    saveJSON(BILLS_FILE, bills);
    console.log('⚠️ Штраф: -♎' + amount + ' у ' + target1);
    console.log('   Баланс ' + target1 + ': ♎' + users[target1].balance);
}

else if (command === 'list') {
    console.log('\n💸 ИСТОРИЯ ОПЕРАЦИЙ:');
    if (bills.length === 0) console.log('   Пусто');
    else bills.forEach(b => {
        const type = b.type === 'transfer' ? '🔄' : b.type === 'give' ? '🎁' : b.type === 'take' ? '🗑️' : '⚠️';
        console.log('  ' + type + ' ' + b.date + ' | ♎' + b.amount + ' | ' + (b.from || 'сервер') + ' → ' + (b.to || 'сервер'));
    });
    console.log('');
}

else if (command === 'balance') {
    if (!target1) { console.log('❌ node bill.js balance NICK'); process.exit(1); }
    if (!users[target1]) { console.log('❌ Пользователь не найден!'); process.exit(1); }
    console.log('👤 ' + target1 + ' | ♎' + users[target1].balance);
}

else {
    console.log('❌ Неизвестная команда! Попробуй: transfer, give, take, fine, list, balance');
}