const express = require('express');
const fetch = require('node-fetch'); // v2 사용
const app = express();

// ★ CORS 허용 미들웨어 추가
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ★ 이 부분 추가!
app.use(express.text({ type: 'text/plain' }));
app.use(express.json());

// 여러분의 Google Apps Script 웹앱 URL로 바꿔주세요!
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw1iZg5NQNhuym7p1Ky7WUg6ffa7Pnn0LSVAuZL1mdDmpOgFlsnZuJbO-gLIXuv_BzwBA/exec';

app.post('/api', async (req, res) => {
  try {
    // ★ text/plain이면 req.body가 string, json이면 object
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

app.listen(3000, () => console.log('Proxy running on http://localhost:3000')); 
