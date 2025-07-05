const express = require('express');
const fetch = require('node-fetch'); // v2 사용
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_BOT_TOKEN = '7415868957:AAFQSjPIu5FxNKpJ_unOs9-WpK4UcFHGHjY'; // 본인 토큰
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

const app = express();

// CORS 허용
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.text({ type: 'text/plain' }));
app.use(express.json());

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw1iZg5NQNhuym7p1Ky7WUg6ffa7Pnn0LSVAuZL1mdDmpOgFlsnZuJbO-gLIXuv_BzwBA/exec';

// 프론트엔드 → GAS 프록시
app.post('/api', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    });
    const data = await response.text();
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.send(data);
  } catch (e) {
    res.status(500).send({ error: e.toString() });
  }
});

// 날짜+할일 파싱 (7/5, 0705, 7월5일, 07-05 등)
function parseDateAndTask(msg) {
  // 7/5, 0705, 7월5일, 07-05 등 다양한 포맷 지원
  const regex = /(\d{1,2})[\/\-월]?\s*(\d{1,2})[일]?\s*(.+)/;
  const match = msg.match(regex);
  if (!match) return null;
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const year = new Date().getFullYear();
  const date = `${year}-${month}-${day}`;
  const task = match[3].trim();
  return { date, task };
}

// 텔레그램 → GAS 할일 추가
bot.on('message', (msg) => {
  const parsed = parseDateAndTask(msg.text);
  if (parsed) {
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ func: 'addTodo', params: { ...parsed, source: '텔레그램' } })
    });
    bot.sendMessage(msg.chat.id, `할일 추가: ${parsed.date} - ${parsed.task}`);
  }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000')); 
