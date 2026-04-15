const { Connection, PublicKey } = require('@solana/web3.js');
const fetch = require('cross-fetch');
require('dotenv').config();

// 🔱 CONFIGURATION FROM .ENV
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com"; 
const connection = new Connection(RPC_URL, 'confirmed');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MY_WALLET_ADDRESS = process.env.MY_WALLET_ADDRESS;

let TELEGRAM_CHAT_ID = null; 
let lastUpdateId = 0;

// 🔱 THE EXPANDED APRIL 2026 FLEET
const WATCHLIST = [
    { name: "SOL",    mint: "So11111111111111111111111111111111111111112", dip: 0.985 },
    { name: "JUP",    mint: "JUPyiK68zYJjSREsBkX96scSg5S6zX37xW44R49yX1f", dip: 0.960 },
    { name: "WIF",    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", dip: 0.940 },
    { name: "PENGU",  mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", dip: 0.940 },
    { name: "POPCAT", mint: "7GCihp7B3Z6nmgHUnacaCcBWXpkbsW9QeeYhS2pYpump", dip: 0.940 },
    { name: "GIGA",   mint: "63cgJ384pKtih497at6S6Vv27m6hH2Fh6v8fWhypump", dip: 0.920 },
    { name: "GOAT",   mint: "CzLSujWvwpS9SscS2v76WfB6u3H8NfE2276WjY6Npump", dip: 0.930 },
    { name: "MOODENG",mint: "ED5nyvWEzpPPiWimPqSbi6R32mG3G2469902634pump", dip: 0.930 },
    { name: "PNUT",   mint: "2qEHjDLDLbuBgRYvsZ8zUqh2gtYVQG94Bs7Z6Y6Vpump", dip: 0.930 },
    { name: "BOME",   mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82", dip: 0.940 },
    { name: "TRUMP",  mint: "6p6xwqrFGrvQC2WfT7xX9eA5HjnYj4f898aGqA1vT7v9", dip: 0.930 },
    { name: "BONK",   mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", dip: 0.910 },
    { name: "FART",   mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", dip: 0.900 },
    { name: "PIPPIN", mint: "Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump", dip: 0.920 },
    { name: "MEW",    mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5", dip: 0.940 },
    { name: "JELLY",  mint: "FeR8VBqNRSUD5NtXAj2n3j1dAHkZHfyDktKuLXD4pump", dip: 0.880 }
];

let marketData = {};
WATCHLIST.forEach(coin => { marketData[coin.mint] = { history: [], mode: "BUY", lastPrice: 0 }; });

async function checkWallet() {
    if (!MY_WALLET_ADDRESS) return "No Wallet Configured";
    try {
        const balance = await connection.getBalance(new PublicKey(MY_WALLET_ADDRESS));
        return (balance / 1e9).toFixed(4) + " SOL";
    } catch (e) { return "Check failed"; }
}

async function sendTelegram(msg) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
        });
    } catch (e) {}
}

async function fetchTokenPrice(coin) {
    try {
        let res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coin.mint}`);
        let data = await res.json();
        if (!data.pairs || data.pairs.length === 0) {
            res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${coin.name}`);
            data = await res.json();
        }
        if (data && data.pairs && data.pairs.length > 0) {
            const solanaPairs = data.pairs.filter(p => p.chainId === 'solana');
            if (solanaPairs.length === 0) return null;
            const bestPair = solanaPairs.sort((a, b) => parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0))[0];
            return parseFloat(bestPair.priceUsd);
        }
    } catch (e) { return null; }
    return null;
}

async function runQuantumLoop() {
    const walletStatus = await checkWallet();
    console.log(`--- 📡 Scanning | Wallet: ${walletStatus} ---`);

    for (const coin of WATCHLIST) {
        const priceUsd = await fetchTokenPrice(coin);
        if (priceUsd) {
            const m = marketData[coin.mint];
            m.lastPrice = priceUsd;
            m.history.push(priceUsd);
            if (m.history.length > 20) m.history.shift();
            const avg = m.history.reduce((a, b) => a + b, 0) / m.history.length;
            const target = avg * coin.dip;
            const prec = (["BONK", "FART", "GIGA", "BOME"].includes(coin.name)) ? 8 : 4;

            console.log(`📡 ${coin.name.padEnd(7)} | $${priceUsd.toFixed(prec)} | T:$${target.toFixed(prec)}`);

            if (priceUsd <= target && m.mode === "BUY" && target > 0 && m.history.length > 2) {
                console.log(`🔥 APEX TRIGGER: ${coin.name}`);
                sendTelegram(`🟢 <b>APEX BUY: ${coin.name}</b>\nPrice: $${priceUsd.toFixed(prec)}\nTarget: $${target.toFixed(prec)}`);
                m.mode = "SELL"; 
            }
        } else {
            console.log(`⚠️ ${coin.name.padEnd(7)} | Price Fetch Failed`);
        }
        await new Promise(r => setTimeout(r, 600)); 
    }
}

async function checkCommands() {
    if (!TELEGRAM_TOKEN) return;
    try {
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`);
        const data = await res.json();
        if (data.result) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;
                if (!update.message) continue;
                TELEGRAM_CHAT_ID = update.message.chat.id;
                if (update.message.text?.toLowerCase().includes('status')) {
                    let report = `📊 <b>Apex Status</b>\nWallet: ${await checkWallet()}\n\n`;
                    for (const coin of WATCHLIST) {
                        const d = marketData[coin.mint];
                        const avg = d.history.length > 0 ? (d.history.reduce((a, b) => a + b, 0) / d.history.length) : 0;
                        const target = avg * coin.dip;
                        const prec = (["BONK", "FART", "GIGA", "BOME"].includes(coin.name)) ? 8 : 4;
                        report += `<b>${coin.name}</b>: $${(d.lastPrice || 0).toFixed(prec)} (T: $${target.toFixed(prec)})\n`;
                    }
                    sendTelegram(report);
                }
            }
        }
    } catch (e) {}
}

console.log("🔱 Apex Predator V6.7 (Public Version) Active.");
setInterval(runQuantumLoop, 35000); 
setInterval(checkCommands, 10000);
runQuantumLoop();
