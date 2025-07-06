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

// 텔레그램 → GAS 할일 추가 및 기타 명령
bot.on('message', async (msg) => {
  const textRaw = (msg.text || '').trim();
  const text    = textRaw.replace(/\s+/g, ''); // 공백 제거 버전
  console.log('📱 텔레그램 메시지 수신:', textRaw);
  console.log('👤 발신자:', msg.from.username || msg.from.first_name);

  // 공용 GAS 호출 유틸
  const callGAS = async (func, params = {}) => {
    const res   = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ func, params })
    });
    const txt   = await res.text();
    try { return JSON.parse(txt); } catch(e){
      console.error('JSON 파싱 오류:', e, txt); return null; }
  };

  // ===== 0) 공실 목록 =====
  if (/^공실$/i.test(text)) {
    try {
      const result = await callGAS('getVacantRooms', {});
      if(result && result.success && Array.isArray(result.data)){
        const list = result.data;
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '모든 호실이 입주 중입니다! 🎉');
        } else {
          const rooms = list.map(r=>r.room).join(', ');
          bot.sendMessage(msg.chat.id, `🏠 공실 (${list.length}개)\n${rooms}`);
        }
      }else{
        bot.sendMessage(msg.chat.id, '❌ 공실 목록을 가져오지 못했습니다.');
      }
    }catch(err){
      console.error('공실 처리 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return; // done
  }

  // ===== 1) 미납 (전월 기준) =====
  if (/^미납$/i.test(text)) {
    try {
      const result = await callGAS('getAllRoomStatus', {});
      const listData = Array.isArray(result) ? result : (result && result.data ? result.data : []);
      if (Array.isArray(listData)) {
        // 전월 기준이 명확치 않아, unpaid>0 인 항목만 추출
        const list = listData.filter(r => (parseFloat(r.unpaid)||0) > 0);
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '👏 미납 호실이 없습니다!');
        } else {
          let reply = `📑 미납 현황 (${list.length}개 호실)\n`;
          list.forEach(r=>{
            reply += `\n${r.room}호 : ${Number(r.unpaid||0).toLocaleString()}원`;
          });
          bot.sendMessage(msg.chat.id, reply);
        }
      } else {
        bot.sendMessage(msg.chat.id, '❌ 미납 데이터를 가져오지 못했습니다.');
      }
    }catch(err){
      console.error('미납 처리 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 2) 전체 미납 (정산금 포함) =====
  if (/^전체\s*미납$/i.test(textRaw)) {
    try {
      const result = await callGAS('getAllRoomStatus', {});
      const listData = Array.isArray(result) ? result : (result && result.data ? result.data : []);
      if (Array.isArray(listData)) {
        const list = listData.filter(r => (parseFloat(r.settle)||0) > 0);
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '모든 호실이 정산 완료되었습니다!');
        } else {
          let reply = `📊 전체 미납/정산 현황 (${list.length}개)\n`;
          reply += '\n호실 | 미납 | 정산\n----------------------';
          list.forEach(r=>{
            reply += `\n${r.room} | ${Number(r.unpaid||0).toLocaleString()} | ${Number(r.settle||0).toLocaleString()}`;
          });
          bot.sendMessage(msg.chat.id, reply);
        }
      }else{
        bot.sendMessage(msg.chat.id, '❌ 전체 미납 데이터를 가져오지 못했습니다.');
      }
    }catch(err){
      console.error('전체 미납 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 3) 특정 호실 퇴실 정산 =====
  if (/^\d{3,4}(호)?$/.test(text)) {
    const room = text.replace(/호$/,'');
    try {
      const result = await callGAS('getSettlementSummary', { room });
      if(result && result.success){
        const prof = result.profile || {};
        const remain = (result.remain||0).toLocaleString();
        let reply = `🧾 ${room}호 퇴실 정산 요약\n`;
        reply += `입주: ${prof.moveIn ? prof.moveIn.toString().split('T')[0] : '-'}\n`;
        reply += `퇴실: ${prof.moveOut ? prof.moveOut.toString().split('T')[0] : '-'}\n`;
        reply += `보증금: ${(prof.deposit||0).toLocaleString()}원\n`;
        reply += `월세/관리비/주차비: ${(prof.rent||0).toLocaleString()}/${(prof.mgmt||0).toLocaleString()}/${(prof.park||0).toLocaleString()}\n`;
        reply += `\n▶ 최종 정산 금액: ${remain}원`;
        bot.sendMessage(msg.chat.id, reply);
      }else{
        bot.sendMessage(msg.chat.id, result.msg || '❌ 정산 정보를 가져오지 못했습니다.');
      }
    }catch(err){
      console.error('정산 정보 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 4) 할일 7일 조회 =====
  if (/^할일$/i.test(text)) {
    try {
      const today = new Date();
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today.getTime());
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      });

      const fetchPromises = dates.map(dateStr => {
        return fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({ func: 'getTodosByDate', params: { date: dateStr } })
        })
          .then(res => res.text())
          .then(txt => {
            try {
              const json = JSON.parse(txt);
              if (json.success && Array.isArray(json.data)) {
                return { date: dateStr, list: json.data };
              }
            } catch (e) {
              console.error('JSON 파싱 오류:', e);
            }
            return { date: dateStr, list: [] };
          })
          .catch(err => {
            console.error('📡 GAS 호출 실패:', err);
            return { date: dateStr, list: [] };
          });
      });

      const results = await Promise.all(fetchPromises);
      let reply = '🗓️ 앞으로 7일 할일 목록\n';
      results.forEach(r => {
        const prettyDate = r.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1/$2/$3');
        if (r.list.length === 0) {
          reply += `\n${prettyDate} : 할일 없음`;
        } else {
          const tasks = r.list.map(t => `□ ${t.task}`).join('\n');
          reply += `\n${prettyDate}\n${tasks}`;
        }
      });

      bot.sendMessage(msg.chat.id, reply);
    } catch (err) {
      console.error('❌ 할일 목록 전송 실패:', err);
      bot.sendMessage(msg.chat.id, '❌ 할일 목록 조회 중 오류가 발생했습니다.');
    }
    return; // 처리 완료
  }

  // 2) 날짜+내용 형식이면 → 할일 추가 로직
  const parsed = parseDateAndTask(textRaw);
  if (parsed) {
    console.log('✅ 파싱 성공:', parsed);

    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ func: 'addTodo', params: { ...parsed, source: '텔레그램' } })
    })
      .then(res => res.text())
      .then(data => {
        console.log('📊 GAS 응답 데이터:', data);
        let ok = false;
        try {
          const result = JSON.parse(data);
          ok = result.success;
        } catch (e) {}
        if (ok) {
          bot.sendMessage(msg.chat.id, `✅ 할일 추가 완료!\n📅 ${parsed.date}\n📝 ${parsed.task}`);
        } else {
          bot.sendMessage(msg.chat.id, '❌ 할일 추가에 실패했습니다.');
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
