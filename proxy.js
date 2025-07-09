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

// 자동 전송 스케줄러
const schedule = require('node-schedule');

// 매일 오전 11시 - 오후 5시 할일 전송
schedule.scheduleJob('0 11 * * *', async () => {
  console.log('🕚 오전 11시 - 오후 5시 할일 자동 전송');
  await sendDailyTodos();
});

// 매일 오전 12시 - 정산금액 50만원 미만 세대 요약
schedule.scheduleJob('0 12 * * *', async () => {
  console.log('🕛 오전 12시 - 정산금액 50만원 미만 세대 자동 전송');
  await sendDailySettlement();
});

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw1iZg5NQNhuym7p1Ky7WUg6ffa7Pnn0LSVAuZL1mdDmpOgFlsnZuJbO-gLIXuv_BzwBA/exec';

// 자동 전송 함수들
async function sendDailyTodos() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // 오늘과 내일 할일 조회
    const todayTodos = await callGAS('getTodosByDate', { date: today });
    const tomorrowTodos = await callGAS('getTodosByDate', { date: tomorrow });
    
    let message = '🕚 오전 11시 자동 알림\n\n';
    message += '📅 오늘 할일:\n';
    if (todayTodos.success && todayTodos.data.length > 0) {
      todayTodos.data.forEach(todo => {
        message += `□ ${todo.task}\n`;
      });
    } else {
      message += '할일 없음\n';
    }
    
    message += '\n📅 내일 할일:\n';
    if (tomorrowTodos.success && tomorrowTodos.data.length > 0) {
      tomorrowTodos.data.forEach(todo => {
        message += `□ ${todo.task}\n`;
      });
    } else {
      message += '할일 없음\n';
    }
    
    // 오후 5시 할일 추가
    message += '\n🕔 오후 5시 권장 할일:\n';
    message += '□ 하루 입금 현황 확인\n';
    message += '□ 미납 세대 연락\n';
    message += '□ 내일 일정 점검\n';
    
    await bot.sendMessage(process.env.ADMIN_CHAT_ID || '5932676399', message);
    console.log('✅ 할일 자동 전송 완료');
  } catch (error) {
    console.error('❌ 할일 자동 전송 실패:', error);
  }
}

async function sendDailySettlement() {
  try {
    const res = await callGAS('getAllRoomStatus', {});
    const listData = Array.isArray(res) ? res : (res && res.data ? res.data : []);

    // 필터링: 301~1606 호실, 연락처 있음, 미납금>0
    let filtered = listData.filter(i => {
      const rn = parseInt(i.room, 10);
      if (isNaN(rn) || rn < 301 || rn > 1606) return false;
      if (!i.contact) return false;
      if ((i.unpaid || 0) <= 0) return false;
      return true;
    });

    // 중복 제거
    const map = {};
    filtered.forEach(it => {
      if (!map[it.room] || (it.unpaid || 0) > (map[it.room].unpaid || 0)) {
        map[it.room] = it;
      }
    });
    filtered = Object.values(map);

    // 정산금 50만원 미만 필터
    const list = filtered.filter(i => {
      const st = i.settle || 0;
      return st < 0 || st < 500000;
    });

    let message = '🕛 오전 12시 자동 알림\n\n';
    message += `📊 정산금 50만원 미만 세대 (${list.length}개)\n\n`;
    
    if (list.length === 0) {
      message += '해당 세대가 없습니다! 🎉';
    } else {
      list.sort((a,b) => parseInt(a.room,10) - parseInt(b.room,10));
      list.forEach(item => {
        message += `${item.room}호 | ${item.name} | ${(item.settle||0).toLocaleString()}원\n`;
      });
      
      const totalUnpaid = list.reduce((sum, item) => sum + (item.unpaid || 0), 0);
      const totalSettle = list.reduce((sum, item) => sum + (item.settle || 0), 0);
      message += `\n총 미납: ${totalUnpaid.toLocaleString()}원`;
      message += `\n총 정산: ${totalSettle.toLocaleString()}원`;
    }
    
    await bot.sendMessage(process.env.ADMIN_CHAT_ID || '5932676399', message);
    console.log('✅ 정산 요약 자동 전송 완료');
  } catch (error) {
    console.error('❌ 정산 요약 자동 전송 실패:', error);
  }
}

// 공용 GAS 호출 함수
async function callGAS(func, params = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ func, params })
  });
  const txt = await res.text();
  try { 
    return JSON.parse(txt); 
  } catch(e) {
    console.error('JSON 파싱 오류:', e, txt); 
    return null; 
  }
}

// 긴 메시지를 안전하게 전송하는 함수
async function sendLongMessage(chatId, message, maxLength = 4000) {
  if (message.length <= maxLength) {
    await bot.sendMessage(chatId, message);
    return;
  }
  
  // 메시지를 줄 단위로 나누어 전송
  const lines = message.split('\n');
  let currentChunk = '';
  let chunkCount = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;
    
    if (testChunk.length > maxLength) {
      // 현재 청크 전송
      if (currentChunk) {
        const header = chunkCount === 1 ? '' : `📄 계속... (${chunkCount})\n\n`;
        await bot.sendMessage(chatId, header + currentChunk);
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
        chunkCount++;
      }
      currentChunk = line;
    } else {
      currentChunk = testChunk;
    }
  }
  
  // 마지막 청크 전송
  if (currentChunk) {
    const header = chunkCount === 1 ? '' : `📄 계속... (${chunkCount})\n\n`;
    await bot.sendMessage(chatId, header + currentChunk);
  }
}

// Health check endpoint (서버 상태 확인용)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bot_status: 'running'
  });
});

// 루트 경로 (서버 정보 표시)
app.get('/', (req, res) => {
  res.json({
    message: 'GAS Proxy Server with Telegram Bot',
    status: 'running',
    endpoints: ['/api', '/health'],
    bot: 'telegram bot active'
  });
});

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

// 텍스트 → 입금정보 {date,amount,room,memo}
function parseDepositMessage(msg){
  try{
    const lines = msg.split(/\n|\r/).map(s=>s.trim()).filter(Boolean).join(' ');
    if(!/입금/i.test(lines)) return null;

    // 1) 날짜 (여러 형식 지원)
    const today = new Date();
    let dateStr = null;
    const datePatterns = [
      /(\d{4})-(\d{2})-(\d{2})/,            // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})/,               // MM/DD or M/D
      /(\d{1,2})월\s*(\d{1,2})일?/,          // 7월6일
      /(\d{4})(\d{2})(\d{2})/,             // YYYYMMDD
      /(\d{2})(\d{2})/                      // MMDD
    ];
    for(const re of datePatterns){
      const m = lines.match(re);
      if(m){
        let y = m[1], mn = m[2], d = m[3];
        if(!d){ // 패턴이 2그룹(MM/DD) 형태
          d = mn; mn = y; y = today.getFullYear();
        }
        if(String(y).length===2) y = today.getFullYear();
        if(String(y).length===4 && !d){ d = mn; mn = y.slice(2); y = today.getFullYear(); }
        if(String(mn).length===1) mn='0'+mn;
        if(String(d).length===1)  d='0'+d;
        dateStr = `${y}-${mn}-${d}`;
        break;
      }
    }
    if(!dateStr){ // 기본 오늘
      dateStr = today.toISOString().split('T')[0];
    }

    // 2) 금액 (쉼표 포함 숫자 + 원)
    const amtMatch = lines.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*원/);
    if(!amtMatch) return null;
    const amount = parseInt(amtMatch[1].replace(/[,]/g,''),10);
    if(!amount) return null;

    // 3) 호실 (3~4자리 숫자 + '호' 필수)
    let roomMatch = lines.match(/(\d{3,4})\s*호/);
    let room = roomMatch ? roomMatch[1] : null;
    // fallback: 마지막 3~4자리 숫자가 호실일 가능성
    if(!room){
       const tokens = lines.split(/\s+/);
       for(let i=tokens.length-1;i>=0;i--){
          if(/^(\d{3,4})$/.test(tokens[i])){ room=tokens[i]; break; }
       }
    }
    if(!room) return null;

    // 4) 메모: 입금 라인 뒤쪽 나머지 글자
    let memo = lines.replace(/.*입금/i,'').trim();
    memo = memo.replace(/\s*[0-9,.]+원?.*/i,'');

    return { room, amount, date: dateStr, memo };
  }catch(e){ console.error('parseDepositMessage 오류',e); return null; }
}

// 텔레그램 → GAS 할일 추가 및 기타 명령
bot.on('message', async (msg) => {
  const textRaw = (msg.text || '').trim();
  const text    = textRaw.replace(/\s+/g, ''); // 공백 제거 버전
  console.log('📱 텔레그램 메시지 수신:', textRaw);
  console.log('👤 발신자:', msg.from.username || msg.from.first_name);

  // 공용 GAS 호출 유틸 (기존 함수 재사용)

  // ===== 0) 공실 목록 =====
  if (/^공실$/i.test(text)) {
    try {
      const result = await callGAS('getVacantRooms', {});
      if(result && result.success && Array.isArray(result.data)){
        const list = result.data;
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '모든 호실이 입주 중입니다! 🎉');
        } else {
          // 호실 번호와 특이사항 함께 표시
          let reply = `🏠 공실 (${list.length}개)\n\n`;
          list.forEach(r => {
            reply += `${r.room}호`;
            if (r.remark && r.remark.trim() !== '' && r.remark !== '-') {
              reply += ` (${r.remark})`;
            }
            reply += '\n';
          });
          bot.sendMessage(msg.chat.id, reply.trim());
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

  // ===== 1) 금액 기준 필터 (예: 300000, 30만원, 300,000원) =====
  const amountRegex = /^([\d,]+)(만원|원)?$/i;
  if (amountRegex.test(textRaw)) {
    try {
      const m = textRaw.match(amountRegex);
      let numStr = m[1].replace(/,/g, '');
      let value  = parseInt(numStr, 10);
      const unit = m[2] || '';
      if (/만원/i.test(unit)) value *= 10000;

      const threshold = value;
      if (isNaN(threshold) || threshold <= 0) {
        bot.sendMessage(msg.chat.id, '⚠️ 금액을 인식하지 못했습니다.');
        return;
      }

      const res = await callGAS('getAllRoomStatus', {});
      const listData = Array.isArray(res) ? res : (res && res.data ? res.data : []);

      // 1) 301~1606 호실만, 2) 연락처 있고, 3) 미납금>0 필터링
      let filtered = listData.filter(i => {
        const rn = parseInt(i.room, 10);
        if (isNaN(rn) || rn < 301 || rn > 1606) return false;
        if (!i.contact) return false;
        if ((i.unpaid || 0) <= 0) return false;
        return true;
      });

      // 중복 호실 제거: 미납금이 더 큰 항목 우선
      const map = {};
      filtered.forEach(it => {
        if (!map[it.room] || (it.unpaid || 0) > (map[it.room].unpaid || 0)) {
          map[it.room] = it;
        }
      });
      filtered = Object.values(map);

      // 4) 최대 정산금액 필터 (양수 기준). 음수(환급) 금액은 항상 포함
      const list = filtered.filter(i => {
        const st = i.settle || 0;
        return st < 0 || st < threshold;
      });

      if (list.length === 0) {
        bot.sendMessage(msg.chat.id, `조건에 맞는 호실이 없습니다.`);
        return;
      }

      let reply = `📋 정산금 ${threshold.toLocaleString()}원 미만 호실 (${list.length}개)\n`;
      reply += '\n호실 | 이름 | 연락처 | 미납 | 정산 | 특이사항';
      reply += '\n--------------------------------------------------------------';
      list.forEach(r => {
        reply += `\n${r.room} | ${r.name || '-'} | ${r.contact || '-'} | ${Number(r.unpaid||0).toLocaleString()} | ${Number(r.settle||0).toLocaleString()} | ${r.remark||'-'}`;
      });

      bot.sendMessage(msg.chat.id, reply);
    } catch(err){
      console.error('금액 필터 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 1.5) 월별 상세 조회 (2025-07 형식) =====
  const monthMatch = textRaw.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const yearMonth = monthMatch[0];
    try {
      const result = await callGAS('getMonthlyDetail', { month: yearMonth });
      if(result && result.success){
        const data = result.data || {};
        
        if(data.rooms && data.rooms.length > 0){
          // 중복 호실 제거 (호실 번호 기준)
          const uniqueRooms = new Map();
          data.rooms.forEach(room => {
            if (!uniqueRooms.has(room.room)) {
              uniqueRooms.set(room.room, room);
            }
          });
          const rooms = Array.from(uniqueRooms.values());
          
          // 301~1606 호실만 필터링
          const filteredRooms = rooms.filter(r => {
            const rn = parseInt(r.room, 10);
            return !isNaN(rn) && rn >= 301 && rn <= 1606;
          });
          
          // 호실 번호순 정렬
          filteredRooms.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
          
          // 총합 재계산
          const totalBilling = filteredRooms.reduce((sum, r) => sum + (r.billing || 0), 0);
          const totalPayment = filteredRooms.reduce((sum, r) => sum + (r.payment || 0), 0);
          
          // 요약 메시지 먼저 전송
          let summaryMsg = `📊 ${yearMonth} 월별 요약\n\n`;
          summaryMsg += `📋 대상 세대: ${filteredRooms.length}개 (301~1606호)\n`;
          summaryMsg += `💰 전체 청구합계: ${totalBilling.toLocaleString()}원\n`;
          summaryMsg += `💳 전체 입금합계: ${totalPayment.toLocaleString()}원\n`;
          summaryMsg += `📈 차액: ${(totalPayment - totalBilling).toLocaleString()}원\n\n`;
          summaryMsg += `🏢 층별로 3개 그룹으로 나누어 전송합니다...`;
          
          await bot.sendMessage(msg.chat.id, summaryMsg);
          
          // 층별로 그룹 나누기
          const floor1 = filteredRooms.filter(r => {
            const rn = parseInt(r.room, 10);
            return rn >= 301 && rn <= 799; // 3층~7층
          });
          const floor2 = filteredRooms.filter(r => {
            const rn = parseInt(r.room, 10);
            return rn >= 801 && rn <= 1199; // 8층~11층
          });
          const floor3 = filteredRooms.filter(r => {
            const rn = parseInt(r.room, 10);
            return rn >= 1201 && rn <= 1606; // 12층~16층
          });
          
          const floorGroups = [
            { name: '3층~7층', rooms: floor1 },
            { name: '8층~11층', rooms: floor2 },
            { name: '12층~16층', rooms: floor3 }
          ];
          
          // 각 층별 그룹을 1초 간격으로 전송
          for(let i = 0; i < floorGroups.length; i++) {
            const group = floorGroups[i];
            if(group.rooms.length === 0) continue;
            
            let floorMsg = `🏢 ${yearMonth} ${group.name} (${group.rooms.length}개)\n\n`;
            floorMsg += '호실 | 이름 | 청구 | 입금 | 차액\n';
            floorMsg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            
            group.rooms.forEach(r => {
              const diff = (r.payment||0) - (r.billing||0);
              const diffStr = diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
              floorMsg += `${r.room} | ${r.name||'-'} | ${Number(r.billing||0).toLocaleString()} | ${Number(r.payment||0).toLocaleString()} | ${diffStr}\n`;
            });
            
            // 층별 소계
            const floorBilling = group.rooms.reduce((sum, r) => sum + (r.billing || 0), 0);
            const floorPayment = group.rooms.reduce((sum, r) => sum + (r.payment || 0), 0);
            floorMsg += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            floorMsg += `소계: ${floorBilling.toLocaleString()} | ${floorPayment.toLocaleString()} | ${(floorPayment - floorBilling).toLocaleString()}`;
            
            if(i > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
            await bot.sendMessage(msg.chat.id, floorMsg);
          }
        } else {
          await bot.sendMessage(msg.chat.id, `📊 ${yearMonth}\n\n해당 월 데이터가 없습니다.`);
        }
      } else {
        bot.sendMessage(msg.chat.id, result.message || '❌ 월별 데이터를 가져오지 못했습니다.');
      }
    } catch(err){
      console.error('월별 조회 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 1.6) 악성미납 조회 =====
  if (/^악성미납$/i.test(text)) {
    try {
      const result = await callGAS('getBadDebtors', {});
      if(result && result.success){
        const list = result.data || [];
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '악성미납 세대가 없습니다! 🎉');
        } else {
          // 한 번에 모든 내용 전송 (악성미납은 개수가 적음)
          let reply = `⚠️ 악성미납 세대 (${list.length}개)\n`;
          reply += '당월포함 전월까지 입금이 없는 세대\n\n';
          reply += `💰 총 정산금액: ${list.reduce((sum, r) => sum + (r.settle||0), 0).toLocaleString()}원\n\n`;
          reply += '호실 | 이름 | 연락처 | 입주일 | 정산금액 | 특이사항\n';
          reply += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
          
          list.forEach(r => {
            reply += `${r.room} | ${r.name||'-'} | ${r.contact||'-'} | ${r.moveIn||'-'} | ${Number(r.settle||0).toLocaleString()} | ${r.remark||'-'}\n`;
          });
          
          bot.sendMessage(msg.chat.id, reply);
        }
      } else {
        bot.sendMessage(msg.chat.id, result.message || '❌ 악성미납 데이터를 가져오지 못했습니다.');
      }
    } catch(err){
      console.error('악성미납 조회 오류:', err);
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
        // 중복 호실 제거
        const uniqueRooms = new Map();
        listData.forEach(r => {
          if (!uniqueRooms.has(r.room)) {
            uniqueRooms.set(r.room, r);
          }
        });
        
        const list = Array.from(uniqueRooms.values()).filter(r => (parseFloat(r.settle)||0) > 0);
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

        // 월별 표 작성 (이번 달까지)
        const headerRaw = result.header || [];
        const chargeRaw = result.charge || []; // billing 대신 charge 사용
        const payRaw    = result.payment || [];

        const todayYM = new Date().toISOString().slice(0,7); // YYYY-MM
        const header = [];
        const charge = [];
        const pay    = [];
        headerRaw.forEach((m,i)=>{
          if(m <= todayYM){
            header.push(m);
            charge.push(chargeRaw[i]||0); // charge 배열 사용
            pay.push(payRaw[i]||0);
          }
        });

        let tableStr = '\n월 | 청구 | 입금\n----------------';
        header.forEach((m,i)=>{
          tableStr += `\n${m} | ${Number(charge[i]||0).toLocaleString()} | ${Number(pay[i]||0).toLocaleString()}`;
        });

        const totalBill = charge.reduce((s,v)=>s+v,0); // charge 합계
        const totalPay  = pay.reduce((s,v)=>s+v,0);
        const remainNow = totalPay - totalBill;

        let reply = `🧾 ${room}호 퇴실 정산 요약\n`;
        reply += `입주: ${prof.moveIn ? prof.moveIn.toString().split('T')[0] : '-'}\n`;
        // 퇴실일이 없으면 오늘 날짜 사용
        const moveOutDate = prof.moveOut ? prof.moveOut.toString().split('T')[0] : new Date().toISOString().split('T')[0];
        reply += `퇴실: ${moveOutDate}\n`;
        reply += `이름: ${prof.name || '-'}\n`;
        reply += `연락처: ${prof.contact || '-'}\n`;
        reply += `보증금: ${Number(prof.deposit||0).toLocaleString()}원\n`;
        reply += `월세/관리비/주차비: ${Number(prof.rent||0).toLocaleString()}/${Number(prof.mgmt||0).toLocaleString()}/${Number(prof.park||0).toLocaleString()}\n`;
        reply += `특이사항: ${prof.remark || '-'}\n`;
        reply += tableStr + '\n';
        reply += `\n총 청구 금액: ${Number(totalBill).toLocaleString()} 원`;
        reply += `\n총 입금 금액: ${Number(totalPay).toLocaleString()} 원`;
        reply += `\n최종 정산 금액: ${Number(remainNow).toLocaleString()} 원`;
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

  // ===== 3b) 호실 퇴실정산 PDF =====
  const pdfMatch = textRaw.match(/^(\d{3,4})호?퇴실정산(?:\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (pdfMatch) {
    const room = pdfMatch[1];
    const moveOut = pdfMatch[2] || null;
    const params = moveOut ? { room, moveOut } : { room };
    console.log('📄 PDF 생성 요청:', params);
    try {
      const res = await callGAS('exportSettlementPdf', params);
      console.log('📄 GAS 응답:', res);
      
      if(res && res.success){
        // 중첩된 응답 구조 처리
        let pdfUrl = res.url;
        if(typeof pdfUrl === 'object' && pdfUrl.url){
          pdfUrl = pdfUrl.url;
        }
        
        if(pdfUrl && typeof pdfUrl === 'string'){
          console.log('📄 PDF URL:', pdfUrl);
          // 파일 직접 전송 대신 다운로드 링크 전송
          bot.sendMessage(msg.chat.id, `✅ ${room}호 퇴실정산 PDF가 생성되었습니다.\n\n📎 다운로드 링크:\n${pdfUrl}`);
        } else {
          console.log('❌ PDF URL 형식 오류, 응답:', res);
          bot.sendMessage(msg.chat.id, `❌ PDF URL 형식 오류`);
        }
      } else {
        console.log('❌ PDF 생성 실패, 응답:', res);
        const errorMsg = res && res.message ? res.message : '알 수 없는 오류';
        bot.sendMessage(msg.chat.id, `❌ PDF 생성 실패: ${errorMsg}`);
      }
    } catch(err){
      console.error('PDF 오류:',err);
      bot.sendMessage(msg.chat.id,`❌ PDF 생성 중 오류 발생: ${err.message}`);
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

  // ===== 입금 데이터 등록 =====
  const dep = parseDepositMessage(textRaw);
  if(dep){
    try{
      const payload = { func:'addPaymentFromMobile', params:{
        room: dep.room,
        amount: dep.amount,
        date: dep.date,
        memo: dep.memo || '텔레그램',
        manager: '관리자'
      }};
      const res = await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      const txt = await res.text();
      let ok=false,msgRes='';
      try{ const j=JSON.parse(txt); ok=j.success; msgRes=j.message||''; }catch(e){}
      if(ok){
        bot.sendMessage(msg.chat.id, `✅ ${dep.room}호 ₩${dep.amount.toLocaleString()} 입금 등록 완료!`);
      }else{
        bot.sendMessage(msg.chat.id, `❌ 등록 실패: ${msgRes||'오류'}`);
      }
    }catch(err){
      console.error('입금 등록 오류:',err);
      bot.sendMessage(msg.chat.id,'❌ 입금 등록 중 오류가 발생했습니다.');
    }
    return;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  console.log('Telegram Bot is active and ready!');
  
  // Self-ping to keep server alive (Render.com 무료 플랜용)
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://weoldeumereudiang.onrender.com';
    
    setInterval(() => {
      fetch(`${RENDER_URL}/health`)
        .then(res => res.json())
        .then(data => console.log('🏥 Health check:', data.timestamp))
        .catch(err => console.log('❌ Health check failed:', err.message));
    }, 14 * 60 * 1000); // 14분마다 (Render.com 15분 제한 회피)
  }
}); 
