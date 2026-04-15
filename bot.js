const { Connection, PublicKey, Keypair, VersionedTransaction } = require('@solana/web3.js');
const fetch = require('cross-fetch');
const dotenv = require('dotenv');
const bs58 = require('bs58').default || require('bs58');

dotenv.config();

// --- 🔱 IDENTITY & NETWORK ---
const RPC_URL = process.env.RPC_URL; 
const connection = new Connection(RPC_URL, 'confirmed');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Decodes your Base58 key from the .env - NO HARDCODED KEYS
const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
let lastUpdateId = 0;

console.log(`🔱 Apex Executioner Online: ${wallet.publicKey.toString()}`);

// --- 🔱 2026 FLEET ---
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
    { name: "JELLY",  mint: "JELLY1111111111111111111111111111111111111", dip: 0.880 }
];

let marketData = {};
WATCHLIST.forEach(coin => { 
    marketData[coin.mint] = { history: [], mode: "BUY", lastPrice: 0, entryPrice: 0, peakPrice: 0, completedStages: 0 }; 
});

// --- 🔱 THE EXECUTION ENGINE ---
async function executeSwap(inputMint, outputMint, amountSol) {
    try {
        const lamports = Math.floor(amountSol * 1e9);
        const quote = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}&slippageBps=${process.env.SLIPPAGE_BPS}`)).json();
        
        const swapReq = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: wallet.publicKey.toString(),
                wrapAndUnwrapSol: true,
                prioritizationFeeLamports: 100000
            })
        });
        const { swapTransaction } = await swapReq.json();

        const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
        transaction.sign([wallet]);
        const txid = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: true });
        return txid;
    } catch (e) {
        console.log(`🔱 Execution Error: ${e.message}`);
        return null;
    }
}

async function fetchTokenPrice(coin) {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${coin.mint}`);
        const data = await res.json();
        return data.pairs ? parseFloat(data.pairs[0].priceUsd) : null;
    } catch (e) { return null; }
}

async function sendTelegram(msg) {
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `🔱 <b>APEX:</b> ${msg}`, parse_mode: 'HTML' })
        });
    } catch (e) {}
}

async function runQuantumLoop() {
    for (const coin of WATCHLIST) {
        const priceUsd = await fetchTokenPrice(coin);
        if (!priceUsd) continue;

        const m = marketData[coin.mint];
        m.lastPrice = priceUsd;
        m.history.push(priceUsd);
        if (m.history.length > 20) m.history.shift();

        if (m.mode === "BUY") {
            const avg = m.history.reduce((a, b) => a + b, 0) / m.history.length;
            const target = avg * coin.dip;
            console.log(`📡 ${coin.name} | $${priceUsd.toFixed(4)} | Target: $${target.toFixed(4)}`);

            if (priceUsd <= target && m.history.length > 3) {
                const txid = await executeSwap("So11111111111111111111111111111111111111112", coin.mint, process.env.BUY_AMOUNT_SOL);
                if (txid) {
                    m.mode = "SELL"; m.entryPrice = priceUsd; m.peakPrice = priceUsd;
                    sendTelegram(`🟢 <b>BUY: ${coin.name}</b>\nTX: <a href="https://solscan.io/tx/${txid}">Link</a>`);
                }
            }
        } else if (m.mode === "SELL") {
            const pnl = (priceUsd - m.entryPrice) / m.entryPrice;
            if (priceUsd > m.peakPrice) m.peakPrice = priceUsd;
            const drop = (m.peakPrice - priceUsd) / m.peakPrice;

            if (pnl >= 0.20 && m.completedStages === 0) {
                await executeSwap(coin.mint, "So11111111111111111111111111111111111111112", process.env.BUY_AMOUNT_SOL * 0.5);
                m.completedStages = 1;
                sendTelegram(`🚀 <b>TP 1 (+20%): ${coin.name}</b>`);
            } else if (pnl >= 0.50) {
                await executeSwap(coin.mint, "So11111111111111111111111111111111111111112", process.env.BUY_AMOUNT_SOL);
                m.mode = "BUY";
                sendTelegram(`💰 <b>FULL EXIT (+50%): ${coin.name}</b>`);
            } else if (pnl <= -0.15 || (pnl > 0.10 && drop > 0.08)) {
                await executeSwap(coin.mint, "So11111111111111111111111111111111111111112", process.env.BUY_AMOUNT_SOL);
                m.mode = "BUY";
                sendTelegram(`🛑 <b>CLOSE: ${coin.name}</b> | PnL: ${(pnl*100).toFixed(2)}%`);
            }
        }
    }
}

setInterval(async () => {
    try {
        const res = await (await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`)).json();
        if (res.result) {
            for (const update of res.result) {
                lastUpdateId = update.update_id;
                if (update.message?.text?.toLowerCase().includes('status')) {
                    sendTelegram(`📊 <b>Status:</b> Scanning ${WATCHLIST.length} assets.`);
                }
            }
        }
    } catch (e) {}
}, 5000);

setInterval(runQuantumLoop, 15000);
runQuantumLoop();
