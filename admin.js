const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];
const nick = args[1];
const amount = parseInt(args[2]);

const DATA_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

// Проверка
if (!command) {
    console.log('\n📋 Команды admin.js:');
    console.log('  node admin.js give NICK 500    — выдать деньги');
    console.log('  node admin.js take NICK 200    — снять деньги');
    console.log('  node admin.js setrole NICK Администратор  — сменить роль');
    console.log('  node admin.js list             — список пользователей\n');
    process.exit(0);
}

if (command === 'list') {
    const users = loadUsers();
    console.log('\n📋 Пользователи:');
    for (var user in users) {
        console.log('  👤 ' + user + ' | ♎' + users[user].balance + ' | ' + (users[user].role || 'Участник'));
    }
    console.log('');
    process.exit(0);
}

if (!nick || (command !== 'setrole' && isNaN(amount))) {
    console.log('❌ Неверные параметры!');
    console.log('Пример: node admin.js give DK356 500');
    process.exit(1);
}

const users = loadUsers();

if (!users[nick]) {
    console.log('❌ Пользователь ' + nick + ' не найден!');
    process.exit(1);
}

if (command === 'give') {
    users[nick].balance += amount;
    saveUsers(users);
    console.log('✅ Выдано ♎' + amount + ' → ' + nick);
    console.log('   Новый баланс: ♎' + users[nick].balance);
}

else if (command === 'take') {
    if (users[nick].balance < amount) {
        console.log('❌ У ' + nick + ' только ♎' + users[nick].balance);
        process.exit(1);
    }
    users[nick].balance -= amount;
    saveUsers(users);
    console.log('✅ Снято ♎' + amount + ' у ' + nick);
    console.log('   Новый баланс: ♎' + users[nick].balance);
}

else if (command === 'setrole') {
    const role = args.slice(2).join(' ');
    users[nick].role = role;
    saveUsers(users);
    console.log('✅ Роль ' + nick + ' изменена на: ' + role);
}

else {
    console.log('❌ Неизвестная команда!');
    console.log('Команды: give, take, setrole, list');
}
}