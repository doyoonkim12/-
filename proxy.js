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

// 날짜+할일 파싱 (7/20, 0720, 7월20일, 07-20 등)
function parseDateAndTask(msg) {
  console.log('📝 메시지 파싱 시도:', msg);
  
  // 다양한 날짜 형식 지원
  const patterns = [
    // 7/20, 07/20 형식
    /(\d{1,2})\/(\d{1,2})\s+(.+)/,
    // 7-20, 07-20 형식  
    /(\d{1,2})-(\d{1,2})\s+(.+)/,
    // 7월20일, 07월20일 형식
    /(\d{1,2})월\s*(\d{1,2})일?\s+(.+)/,
    // 0720 형식 (4자리 숫자)
    /(\d{2})(\d{2})\s+(.+)/
  ];
  
  for (const regex of patterns) {
    const match = msg.match(regex);
    if (match) {
      let month = match[1].padStart(2, '0');
      let day = match[2].padStart(2, '0');
      const task = match[3].trim();
      
      // 월/일 검증
      const monthNum = parseInt(month);
      const dayNum = parseInt(day);
      
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        console.log('❌ 잘못된 날짜:', month, day);
        continue;
      }
      
      const year = new Date().getFullYear();
      const date = `${year}-${month}-${day}`;
      
      console.log('✅ 파싱 성공:', { date, task });
      return { date, task };
    }
  }
  
  console.log('❌ 파싱 실패 - 지원되는 형식: 7/20 할일, 7월20일 할일, 0720 할일');
  return null;
}

// 텔레그램 → GAS 할일 추가
bot.on('message', (msg) => {
  console.log('📱 텔레그램 메시지 수신:', msg.text);
  console.log('👤 발신자:', msg.from.username || msg.from.first_name);
  
  const parsed = parseDateAndTask(msg.text);
  if (parsed) {
    console.log('✅ 파싱 성공:', parsed);
    
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ func: 'addTodo', params: { ...parsed, source: '텔레그램' } })
    })
    .then(res => {
      console.log('📡 GAS 응답 상태:', res.status);
      return res.text();
    })
    .then(data => {
      console.log('📊 GAS 응답 데이터:', data);
      try {
        const result = JSON.parse(data);
        if (result.success) {
          bot.sendMessage(msg.chat.id, `✅ 할일 추가 완료!\n📅 ${parsed.date}\n📝 ${parsed.task}`);
        } else {
          bot.sendMessage(msg.chat.id, `❌ 할일 추가 실패: ${result.error || '알 수 없는 오류'}`);
        }
      } catch (e) {
        console.error('JSON 파싱 오류:', e);
        bot.sendMessage(msg.chat.id, `✅ 할일 추가: ${parsed.date} - ${parsed.task}`);
      }
    })
    .catch(e => {
      console.error('❌ GAS 호출 실패:', e);
      bot.sendMessage(msg.chat.id, `❌ 시트 추가 실패: ${e.toString()}`);
    });
  } else {
    bot.sendMessage(msg.chat.id, `❌ 메시지 형식이 올바르지 않습니다.\n\n✅ 올바른 형식:\n• 7/20 할일내용\n• 7월20일 할일내용\n• 0720 할일내용\n\n예: 7/20 804호 월세 받기`);
  }
});

app.listen(3000, () => console.log('Proxy running on http://localhost:3000')); 
