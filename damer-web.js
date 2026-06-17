const http = require('http');

const PORT = process.env.PORT || 3001;
const MAIN_SERVER = 'https://ddkbank.onrender.com';
const KEY = 'damersecret123';

const HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>💎 Терминал Дамера</title>
    <meta charset="utf-8">
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0a; color:#ffd700; font-family:monospace; padding:20px; }
        h1 { text-align:center; margin-bottom:20px; }
        .req { background:#1a1a1a; padding:15px; margin:10px 0; border-radius:10px; border-left:4px solid #ffd700; }
        .req button { margin:5px; padding:8px 16px; border:none; border-radius:5px; cursor:pointer; font-weight:bold; }
        .done { background:#2ecc71; color:white; }
        .refund { background:#e74c3c; color:white; }
        #status { text-align:center; margin:10px 0; }
    </style>
</head>
<body>
    <h1>💎 Терминал Дамера</h1>
    <div id="status">👁️ Ожидание...</div>
    <div id="list"></div>
    <script>
        const S = '${MAIN_SERVER}';
        const K = '${KEY}';
        async function load() {
            try {
                const r = await fetch(S + '/damer-queue-data?key=' + K);
                const d = await r.json();
                const div = document.getElementById('list');
                if (d.success && d.requests.length) {
                    let h = '';
                    for (const x of d.requests) {
                        h += '<div class="req"><p>👤 <b>'+x.from+'</b></p><p>📋 '+x.type+': '+x.number+'</p><p>💰 ♎'+x.amount+'</p>';
                        h += '<button class="done" onclick="done(\''+x.from+'\')">✅ Выполнено</button>';
                        h += '<button class="refund" onclick="refund(\''+x.from+'\','+x.amount+')">❌ Возврат</button></div>';
                    }
                    div.innerHTML = h;
                } else div.innerHTML = '<p style="text-align:center;color:#888;">📭 Пусто</p>';
            } catch(e) {}
        }
        async function done(n) {
            await fetch(S+'/damer-done',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nick:n,key:K})});
            document.getElementById('status').innerHTML='✅ '+n+' выполнено!';
            load();
        }
        async function refund(n,a) {
            await fetch(S+'/damer-refund',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nick:n,amount:a,key:K})});
            document.getElementById('status').innerHTML='🔙 Возврат '+n+' | ♎'+a;
            load();
        }
        setInterval(load,3000);
        load();
    </script>
</body>
</html>
`;

http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'});
    res.end(HTML);
}).listen(PORT, () => console.log('💎 Дамер-терминал на порту ' + PORT));
