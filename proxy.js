const express = require('express');
const fetch = require('node-fetch'); // v2 사용
const TelegramBot = require('node-telegram-bot-api');

// Markdown 이스케이프 함수 수정
function escapeMarkdown(text) {
  if (text === null || text === undefined) return '';
  return String(text).replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

const TELEGRAM_BOT_TOKEN = '7415868957:AAFQSjPIu5FxNKpJ_unOs9-WpK4UcFHGHjY'; // 본인 토큰
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN); // WebHook 방식으로 변경

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

// 한국 시간대 설정
process.env.TZ = 'Asia/Seoul';

// 매일 오전 11시 - 오후 5시 할일 전송 (한국시간)
schedule.scheduleJob('0 11 * * *', async () => {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`🕚 [${now}] 오전 11시 - 오후 5시 할일 자동 전송 시작`);
  await sendDailyTodos();
});

// 매일 오전 12시 - 정산금액 50만원 미만 세대 요약 (한국시간)
schedule.scheduleJob('0 12 * * *', async () => {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`🕛 [${now}] 오전 12시 - 정산금액 50만원 미만 세대 자동 전송 시작`);
  await sendDailySettlement();
});

// 스케줄러 상태 확인용 (매 10분마다)
schedule.scheduleJob('*/10 * * * *', () => {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`⏰ [${now}] 스케줄러 작동 중...`);
});

// 매일 00:01 - 전체 리빌드 자동 실행 (runAll_Complete)
schedule.scheduleJob('1 0 * * *', async () => {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`🔄 [${now}] 00:01 - 전체 리빌드(runAll_Complete) 자동 실행 시작`);
  try {
    const result = await callGAS('runAll_Complete', {});
    if (result && result.success) {
      console.log('✅ 전체 리빌드(runAll_Complete) 성공:', result.message || '성공');
    } else {
      console.error('❌ 전체 리빌드(runAll_Complete) 실패:', result && result.message);
    }
  } catch (err) {
    console.error('❌ 전체 리빌드(runAll_Complete) 실행 중 오류:', err);
  }
});

const GAS_URL = 'https://script.google.com/macros/s/AKfycbw1iZg5NQNhuym7p1Ky7WUg6ffa7Pnn0LSVAuZL1mdDmpOgFlsnZuJbO-gLIXuv_BzwBA/exec';

// 텔레그램 메시지 중복 방지를 위한 Map (chatId별로 Set 관리)
const processedMessages = new Map();

// 자동 전송 함수들
async function sendDailyTodos() {
  try {
    const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
    const tomorrowDate = new Date();
    const tomorrowKorea = new Date(tomorrowDate.getTime() + (9 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000)); // UTC+9 + 1일
    const tomorrow = tomorrowKorea.toISOString().split('T')[0];
    
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
    
    await bot.sendMessage(process.env.ADMIN_CHAT_ID || '-4893061553', message);
    console.log('✅ 할일 자동 전송 완료');
  } catch (error) {
    console.error('❌ 할일 자동 전송 실패:', error);
  }
}

async function sendDailySettlement() {
  try {
    const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
    console.log(`📅 [정산 계산] 한국 시간 기준 오늘: ${today}`);
    
    const res = await callGAS('getAllRoomStatus', { asOfDate: today });
    const listData = Array.isArray(res) ? res : (res && res.data ? res.data : []);

    // 필터링: 301~1606 호실, 연락처 있음, 시행사/공실/숙소/이름 없는 경우 제외
    let filtered = listData.filter(i => {
      const rn = parseInt(i.room, 10);
      if (isNaN(rn) || rn < 301 || rn > 1606) return false;
      if (!i.contact) return false;
      const name = (i.name || '').toLowerCase();
      if (!i.name || name.includes('시행사') || name.includes('공실') || name.includes('숙소')) return false;
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

    // 정산금 5만원 미만 필터 (0 초과 5만원 미만만)
    const list = filtered.filter(i => {
      const st = i.remain || 0;
      return st > 0 && st < 50000;
    });

    let message = '🕛 오전 12시 자동 알림\n\n';
    message += `📊 정산금 50,000원 미만 호실 (${list.length}개)\n\n`;
    message += '호실 | 이름 | 연락처 | 미납 | 정산 | 특이사항\n';
    message += '--------------------------------------------------------------\n';
    if (list.length === 0) {
      message += '해당 호실이 없습니다! 🎉';
    } else {
      list.sort((a,b) => parseInt(a.room,10) - parseInt(b.room,10));
      list.forEach(item => {
        message += `${item.room}호 | ${item.name || '-'} | ${item.contact || '-'} | ${(item.unpaid||0).toLocaleString()} | ${(item.remain||0).toLocaleString()} | ${item.note || '-'}\n`;
      });
      const totalUnpaid = list.reduce((sum, item) => sum + (item.unpaid || 0), 0);
      const totalSettle = list.reduce((sum, item) => sum + (item.remain || 0), 0);
      message += `\n총 미납: ${totalUnpaid.toLocaleString()}원`;
      message += `\n총 정산: ${totalSettle.toLocaleString()}원`;
    }
    await bot.sendMessage(process.env.ADMIN_CHAT_ID || '-4893061553', message);
    console.log('✅ 정산 요약 자동 전송 완료');
  } catch (error) {
    console.error('❌ 정산 요약 자동 전송 실패:', error);
  }
}

// 한국 시간 기준 오늘 날짜 계산 함수
function getTodayKorea() {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD
}

// 공용 GAS 호출 함수 (텔레그램용 - 타임아웃 설정)
async function callGAS(func, params = {}) {
  try {
    console.log(`[DEBUG] callGAS 호출: func=`, func, 'params=', params);
    console.log(`📡 GAS 호출 시작: ${func}`, params);
    
    // 타임아웃 설정 (5분)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5분 타임아웃
    
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ func, params }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`📡 GAS 응답 상태: ${res.status}`);
    
    const txt = await res.text();
    console.log(`📡 GAS 응답 미리보기:`, txt.substring(0, 200));
    
    try { 
      const result = JSON.parse(txt);
      console.log(`📡 GAS 파싱 성공:`, result);
      return result;
    } catch(e) {
      console.error('JSON 파싱 오류:', e, txt); 
      return { success: false, message: 'JSON 파싱 오류' }; 
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ GAS 호출 타임아웃 (5분 초과)');
      return { success: false, message: '요청 시간 초과 (5분 초과). 다시 시도해주세요.' };
    } else {
      console.error('❌ GAS 호출 오류:', error);
      return { success: false, message: `GAS 호출 오류: ${error.message}` };
    }
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
    endpoints: ['/api', '/health', '/webhook'],
    bot: 'telegram bot active (webhook mode)'
  });
});

// 텔레그램 WebHook 엔드포인트
app.post('/webhook', (req, res) => {
  try {
    const update = req.body;
    if (update && update.message) {
      // 기존 bot.on('message') 로직을 여기서 직접 호출
      handleTelegramMessage(update.message);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('WebHook 처리 오류:', error);
    res.sendStatus(500);
  }
});

// 프론트엔드 → GAS 프록시 (타임아웃 120초)
app.post('/api', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120초 타임아웃
    
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await response.text();
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', '*');
    res.send(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ API 프록시 타임아웃 (120초 초과)');
      res.status(408).send({ error: 'Request Timeout (120초 초과)' });
    } else {
      console.error('❌ API 프록시 오류:', error);
      res.status(500).send({ error: error.toString() });
    }
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



// 텔레그램 메시지 처리 함수 (WebHook과 Polling 공용)
async function handleTelegramMessage(msg) {
  // msg가 undefined인 경우 처리
  if (!msg) {
    console.error('❌ handleTelegramMessage: msg is undefined');
    return;
  }
  
  // msg 구조 확인
  console.log('🔍 handleTelegramMessage msg structure:', {
    hasMsg: !!msg,
    hasChat: !!(msg && msg.chat),
    hasId: !!(msg && msg.chat && msg.chat.id),
    chatId: msg && msg.chat ? msg.chat.id : 'undefined',
    text: msg && msg.text ? msg.text.substring(0, 50) : 'undefined'
  });
  
  // msg 구조 확인
  if (!msg.chat || !msg.chat.id) {
    console.error('❌ handleTelegramMessage: msg.chat or msg.chat.id is undefined');
    return;
  }
  
  const chatId = msg.chat.id;
  const messageId = `${msg.chat.id}_${msg.message_id}`;
  
  // 채팅방별 중복 체크
  if (!processedMessages.has(chatId)) {
    processedMessages.set(chatId, new Set());
  }
  
  if (processedMessages.get(chatId).has(messageId)) {
    console.log('⚠️ 중복 메시지 무시:', messageId, '채팅방:', chatId);
    return;
  }
  processedMessages.get(chatId).add(messageId);
  
  // 5분 후 메시지 ID 제거 (메모리 누수 방지)
  setTimeout(() => {
    if (processedMessages.has(chatId)) {
      processedMessages.get(chatId).delete(messageId);
    }
  }, 5 * 60 * 1000);
  
  const textRaw = (msg.text || '').trim();
  const text    = textRaw.replace(/\s+/g, ''); // 공백 제거 버전
  
  console.log(`📱 [채팅방 ${chatId}] 텔레그램 메시지 수신:`, textRaw);
  
  // msg.from null 체크 추가
  const senderName = msg.from ? (msg.from.username || msg.from.first_name || 'Unknown') : 'Unknown';
  console.log(`👤 [채팅방 ${chatId}] 발신자:`, senderName);
  console.log(`💬 [채팅방 ${chatId}] 채팅 ID:`, chatId);
  
  // 채팅 ID 확인 명령어
  if (/^채팅아이디$/i.test(text) || /^chatid$/i.test(text)) {
    bot.sendMessage(msg.chat.id, `📋 현재 채팅 ID: ${msg.chat.id}\n👤 사용자: ${senderName}`);
    return;
  }

  // === [최상단] 'n월이사' 명령어 처리 (예: 7월이사, 8월이사) ===
  if (/^(\d{1,2})월이사$/.test(text)) {
    const monthMatch = text.match(/^(\d{1,2})월이사$/);
    const month = parseInt(monthMatch[1], 10);
    try {
      const result = await callGAS('getMoveInOutByMonth', { month });
      if (result && result.success && result.message) {
        await bot.sendMessage(chatId, result.message);
      } else if (result && result.success && result.data) {
        // data로 직접 메시지 생성 (입주/퇴실 구분)
        let msgText = '';
        if (result.data.moveIn && result.data.moveIn.length > 0) {
          msgText += '입주호실\n호실 | 성함 | 연락처 | 입주일 | 퇴실일\n';
          result.data.moveIn.forEach(r => {
            msgText += `${r.room} | ${r.name} | ${r.contact} | ${r.moveIn} | ${r.moveOut}\n`;
          }); // ← forEach 닫기
        } else {
          msgText += '입주호실 없음\n';
        }
        // 퇴실호실도 동일하게 처리
        if (result.data.moveOut && result.data.moveOut.length > 0) {
          msgText += '\n퇴실호실\n호실 | 성함 | 연락처 | 입주일 | 퇴실일\n';
          result.data.moveOut.forEach(r => {
            msgText += `${r.room} | ${r.name} | ${r.contact} | ${r.moveIn} | ${r.moveOut}\n`;
          });
        } else {
          msgText += '\n퇴실호실 없음\n';
        }
        await bot.sendMessage(chatId, msgText.trim());
      } else {
        await bot.sendMessage(chatId, '결과가 없습니다.');
      }
    } catch (err) {
      console.error('n월이사 처리 오류:', err);
      await bot.sendMessage(chatId, '❌ n월이사 처리 중 오류가 발생했습니다.');
    }
    return;
  }

  // === [초기화] 전체 리빌드 명령어 처리 ===
  if (text === '초기화') {
    try {
      await bot.sendMessage(chatId, '🔄 전체 리빌드(runAll_Part1) 실행 중...\n⏱️ 최대 5분 소요될 수 있습니다.');
      const result = await callGAS('runAll_Part1', {});
      if (result && result.success) {
        await bot.sendMessage(chatId, '✅ 전체 리빌드가 완료되었습니다.');
      } else {
        const errorMsg = result && result.message ? result.message : '알 수 없는 오류';
        await bot.sendMessage(chatId, `❌ 전체 리빌드 실패:\n${errorMsg}\n\n💡 다시 시도해보세요.`);
      }
    } catch (err) {
      console.error('초기화 명령어 오류:', err);
      await bot.sendMessage(chatId, `❌ 전체 리빌드 실행 중 오류:\n${err.message || err}\n\n💡 잠시 후 다시 시도해보세요.`);
    }
    return;
  }

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

      const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
      console.log(`📅 [금액별 필터] 한국 시간 기준 오늘: ${today}`);
      const res = await callGAS('getAllRoomStatus', { asOfDate: today });
      const listData = Array.isArray(res) ? res : (res && res.data ? res.data : []);
      
      // 디버깅: 첫 번째 데이터 확인
      if (listData.length > 0) {
        console.log('🔍 첫 번째 데이터 샘플:', JSON.stringify(listData[0], null, 2));
      }

      // 1) 301~1606 호실만, 2) 연락처 있고, 3) 시행사/공실/숙소 제외 필터링
      let filtered = listData.filter(i => {
        const rn = parseInt(i.room, 10);
        if (isNaN(rn) || rn < 301 || rn > 1606) return false;
        if (!i.contact) return false;
        // 시행사/공실/숙소 제외
        const name = (i.name || '').toLowerCase();
        if (name.includes('시행사') || name.includes('공실') || name.includes('숙소')) return false;
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
        const st = i.remain || 0;  // remain 필드 사용 (UI와 동일)
        return st < 0 || st < threshold;
      });

      if (list.length === 0) {
        bot.sendMessage(msg.chat.id, `조건에 맞는 호실이 없습니다.`);
        return;
      }

      // 10개씩 나누어서 전송
      const chunkSize = 10;
      const totalChunks = Math.ceil(list.length / chunkSize);
      
      for (let i = 0; i < list.length; i += chunkSize) {
        const chunk = list.slice(i, i + chunkSize);
        const chunkNumber = Math.floor(i / chunkSize) + 1;
        
        let reply = `📋 정산금 ${threshold.toLocaleString()}원 미만 호실 (${list.length}개) - ${chunkNumber}/${totalChunks}\n`;
        reply += '\n호실 | 이름 | 연락처 | 미납 | 정산 | 특이사항';
        reply += '\n--------------------------------------------------------------';
        
        chunk.forEach(r => {
          reply += `\n${r.room}호 | ${r.name || '-'} | ${r.contact || '-'}\n`;
          reply += `총 미납금 ${Number(r.unpaid||0).toLocaleString()} | 총 정산금액 ${Number(r.remain||0).toLocaleString()}\n`;
          reply += `특이사항 : ${r.remark||'-'}\n`;
        });

        await bot.sendMessage(msg.chat.id, reply);
        
        // 마지막 청크가 아니면 잠시 대기
        if (i + chunkSize < list.length) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }
      }
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
          // 요약 메시지
          const totalBilling = filteredRooms.reduce((sum, r) => sum + (r.billing || 0), 0);
          const totalPayment = filteredRooms.reduce((sum, r) => sum + (r.payment || 0), 0);
          const diffTotal = totalPayment - totalBilling;
          const firstRoom = filteredRooms.length > 0 ? filteredRooms[0].room : '';
          const lastRoom = filteredRooms.length > 0 ? filteredRooms[filteredRooms.length-1].room : '';
          let summaryMsg = `📊 ${yearMonth} 월별 요약\n\n`;
          summaryMsg += `📋 대상 세대: ${filteredRooms.length}개 (${firstRoom}~${lastRoom}호)\n`;
          summaryMsg += `💰 전체 청구합계: ${totalBilling.toLocaleString()}원\n`;
          summaryMsg += `💳 전체 입금합계: ${totalPayment.toLocaleString()}원\n`;
          summaryMsg += `📈 차액: ${diffTotal.toLocaleString()}원\n\n`;
          summaryMsg += `🏢 9개씩 그룹으로 전송합니다...`;
          if (msg && msg.chat && msg.chat.id) {
            await bot.sendMessage(msg.chat.id, summaryMsg);
            // 상세 메시지(9줄씩)
            let msgHeader = `관리내용 ${firstRoom}~${lastRoom}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            let lines = [];
            filteredRooms.forEach(r => {
              const diff = (r.payment||0) - (r.billing||0);
              const diffStr = diff >= 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString();
              lines.push(`${r.room} | ${r.name||'-'} | 청구 ${Number(r.billing||0).toLocaleString()} | 입금 ${Number(r.payment||0).toLocaleString()} | 차액 ${diffStr} | 잔액 ${Number(r.settle||0).toLocaleString()}`);
            });
            for(let i=0; i<lines.length; i+=9){
              let chunk = lines.slice(i,i+9).join('\n');
              let messageText = msgHeader + chunk;
              try {
                await bot.sendMessage(msg.chat.id, messageText);
                // 텔레그램 API 제한 방지를 위한 지연
                if (i + 9 < lines.length) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
                }
              } catch (telegramError) {
                console.error('텔레그램 메시지 전송 오류:', telegramError);
                if (telegramError.code === 'ETELEGRAM' && telegramError.response && telegramError.response.statusCode === 429) {
                  // Rate limit 오류인 경우 더 오래 대기
                  console.log('텔레그램 API 제한 감지, 35초 대기...');
                  await new Promise(resolve => setTimeout(resolve, 35000));
                  // 재시도
                  try {
                    await bot.sendMessage(msg.chat.id, messageText);
                  } catch (retryError) {
                    console.error('텔레그램 재시도 실패:', retryError);
                  }
                }
              }
            }
            // 입금하지 않은 세대
            const unpaidRooms = filteredRooms.filter(r => (r.payment||0) === 0);
            let unpaidMsg = `\n입금하지 않은 세대수 : ${unpaidRooms.length}\n해당 호실목록 : ${unpaidRooms.map(r=>r.room).join(', ')}`;
            try {
              await bot.sendMessage(msg.chat.id, unpaidMsg);
            } catch (telegramError) {
              console.error('입금하지 않은 세대 메시지 전송 오류:', telegramError);
            }
          }
        } else {
          if (msg && msg.chat && msg.chat.id) {
            await bot.sendMessage(msg.chat.id, `📊 ${yearMonth}\n\n해당 월 데이터가 없습니다.`);
          }
        }
      } else {
        if (msg && msg.chat && msg.chat.id) {
          bot.sendMessage(msg.chat.id, result.message || '❌ 월별 데이터를 가져오지 못했습니다.');
        }
      }
    } catch(err){
      console.error('월별 조회 오류:', err);
      if (msg && msg.chat && msg.chat.id) {
        bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
      }
    }
    return;
  }

  // ===== 1.6) 악성미납 조회 (2개월 입금없음 OR 정산금 50만원 미만) =====
  if (/^악성미납$/i.test(text)) {
    try {
      const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
      console.log(`📅 [악성미납 조회] 한국 시간 기준 오늘: ${today}`);
      
      // 즉시 응답으로 처리 중임을 알림
      bot.sendMessage(msg.chat.id, '🔍 악성미납 데이터를 조회 중입니다...');
      
      const result = await callGAS('getBadDebtors', { 
        asOfDate: today,
        settlementThreshold: 500000 // 50만원 미만 기준
      });
      
      console.log('📊 악성미납 GAS 응답:', result);
      
      if(result && result.success){
        let list = result.data || [];
        
        // 중복 호실 제거 (호실 번호 기준)
        const uniqueRooms = new Map();
        list.forEach(room => {
          if (!uniqueRooms.has(room.room)) {
            uniqueRooms.set(room.room, room);
          }
        });
        list = Array.from(uniqueRooms.values());
        
        // 공실 제거 (이름이 없거나 '-'인 경우)
        list = list.filter(r => r.name && r.name.trim() !== '' && r.name !== '-');
        
        // 호실 번호순 정렬
        list.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
        
        if(list.length === 0){
          bot.sendMessage(msg.chat.id, '악성미납 세대가 없습니다! 🎉');
        } else {
          // 한 번에 모든 내용 전송 (악성미납은 개수가 적음)
          let reply = `⚠️ 악성미납 세대 (${list.length}개)\n`;
          reply += '2개월 입금없음 또는 정산금 50만원 미만(마이너스 포함)\n\n';
          reply += `💰 총 정산금액: ${list.reduce((sum, r) => sum + (r.remain||0), 0).toLocaleString()}원\n\n`;
          reply += '호실 | 이름 | 연락처 | 입주일 | 정산금액 | 특이사항\n';
          reply += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
          
          list.forEach(r => {
            // 1달미만 체크
            const moveInDate = r.moveIn ? new Date(r.moveIn) : null;
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const isNewResident = moveInDate && moveInDate > oneMonthAgo;
            
            const moveInDateStr = r.moveIn ? (r.moveIn.split('T')[0] || r.moveIn) : '-';
            const roomDisplay = isNewResident ? `${r.room}호(1달미만)` : `${r.room}호`;
            
            reply += `${roomDisplay} | ${r.name||'-'} | ${r.contact||'-'}\n`;
            reply += `입주일 : ${moveInDateStr} | 정산금액 : ${Number(r.remain||0).toLocaleString()} | 특이사항 : ${r.remark||'-'}\n\n`;
          });
          
          bot.sendMessage(msg.chat.id, reply);
        }
      } else {
        const errorMessage = result && result.message ? result.message : '❌ 악성미납 데이터를 가져오지 못했습니다.';
        bot.sendMessage(msg.chat.id, errorMessage);
      }
    } catch(err){
      console.error('악성미납 조회 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: '+err.message);
    }
    return;
  }

  // ===== 월별 입금내역 요약 (2025-07입금내역 등) =====
  const monthPayMatch = textRaw.match(/^([0-9]{4})[-.]?([0-9]{2})입금내역$/);
  if (monthPayMatch) {
    const month = `${monthPayMatch[1]}-${monthPayMatch[2]}`;
    console.log('[DEBUG] 텔레그램에서 추출한 month:', month, 'monthPayMatch:', monthPayMatch);
    try {
      const res = await callGAS('getMonthlyPaymentDetail', { month });
      if (!res.success || !res.data) {
        await bot.sendMessage(chatId, '❌ 데이터 조회에 실패했습니다.');
        return;
      }
      const data = res.data;
      let message = `📊 ${month} 월 입금내역\n\n`;
      message += `📋 대상 세대: ${data.rooms.length}개\n`;
      message += `💳 전체 입금합계: ${Number(data.totalPayment).toLocaleString()}원\n\n`;
      if (data.payments.length === 0) {
        message += '해당 월에 입금 내역이 없습니다.';
      } else {
        // 날짜순, 같은 날짜면 호실순 정렬 (GAS에서 이미 정렬했지만 안전하게 한 번 더)
        data.payments.sort((a, b) => {
          if (a.date === b.date) return a.room.localeCompare(b.room, 'ko-KR', { numeric: true });
          return a.date.localeCompare(b.date);
        });
        data.payments.forEach(p => {
          message += `${p.date} | ${p.room}호 | ${Number(p.amount).toLocaleString()}\n`;
        });
      }
      await bot.sendMessage(chatId, message);
    } catch (err) {
      console.error('월별 입금내역 오류:', err);
      await bot.sendMessage(chatId, '❌ 월별 입금내역 조회 중 오류가 발생했습니다.');
    }
    return;
  }

  // ===== 2) 전체 미납 (기존 방식) =====
  if (/^전체\s*미납$/i.test(textRaw)) {
    try {
      const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
      console.log(`📅 [전체 미납] 한국 시간 기준 오늘: ${today}`);
      const res = await callGAS('getAllRoomStatus', { asOfDate: today });
      const listData = Array.isArray(res) ? res : (res && res.data ? res.data : []);

      // 필터링: 301~1606 호실, 연락처 있음, 정산금 > 0
      let filtered = listData.filter(i => {
        const rn = parseInt(i.room, 10);
        if (isNaN(rn) || rn < 301 || rn > 1606) return false;
        if (!i.contact) return false;
        const settle = parseFloat(i.remain || 0);  // remain 필드 사용 (UI와 동일)
        return settle > 0; // 정산금이 양수인 호실만
      });

      // 중복 호실 제거
      const uniqueRooms = new Map();
      filtered.forEach(room => {
        if (!uniqueRooms.has(room.room)) {
          uniqueRooms.set(room.room, room);
        }
      });
      const uniqueFiltered = Array.from(uniqueRooms.values());

      if (uniqueFiltered.length === 0) {
        bot.sendMessage(msg.chat.id, '✅ 모든 호실이 정산 완료되었습니다!');
        return;
      }

      let reply = `📊 전체 미납/정산 현황 (${uniqueFiltered.length}개)\n\n`;
      reply += '호실 | 미납 | 정산\n----------------------';
      
      uniqueFiltered.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
      uniqueFiltered.forEach(r => {
        reply += `\n${r.room} | ${Number(r.unpaid||0).toLocaleString()} | ${Number(r.remain||0).toLocaleString()}`;
      });

      bot.sendMessage(msg.chat.id, reply);
    } catch(err) {
      console.error('전체 미납 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 오류: ' + err.message);
    }
    return;
  }

  // ===== 표 생성 함수 (호실/이름/연락처/차량번호 검색 모두 사용) =====
  function makeSettleTable(d, todayYM) {
    const headerRaw = d.header || [];
    const chargeRaw = d.charge || [];
    const payRaw    = d.payment || [];
    const header = [], charge = [], pay = [];
    headerRaw.forEach((m,i)=>{
      if(m <= todayYM){
        header.push(m);
        charge.push(chargeRaw[i]||0);
        pay.push(payRaw[i]||0);
      }
    });
    let tableStr = '\n월 | 청구 | 입금\n----------------';
    header.forEach((m,i)=>{
      tableStr += `\n${m} | ${Number(charge[i]||0).toLocaleString()} | ${Number(pay[i]||0).toLocaleString()}`;
    });
    const totalBill = charge.reduce((s,v)=>s+v,0);
    const totalPay  = pay.reduce((s,v)=>s+v,0);
    const remainNow = totalPay - totalBill;
    tableStr += `\n\n총 청구 금액: ${Number(totalBill).toLocaleString()} 원`;
    tableStr += `\n총 입금 금액: ${Number(totalPay).toLocaleString()} 원`;
    tableStr += `\n최종 정산 금액: ${Number(remainNow).toLocaleString()} 원`;
    return tableStr;
  }

  // ===== 3) 특정 호실 퇴실 정산 =====
  if (/^\d{3,4}(호)?$/.test(text)) {
    const room = text.replace(/호$/,'');
    try {
      const today = getTodayKorea(); // 한국 시간 기준 오늘 날짜
      console.log(`🔍 [${room}호] 퇴실정산 요청 - 한국 시간 기준일: ${today}`);
      const settleRes = await callGAS('getSettlementSummary', { room, asOfDate: today });
      console.log(`📊 [${room}호] GAS 응답:`, settleRes);
      if(settleRes && settleRes.success){
        const prof = settleRes.profile || {};
        const todayYM = today.slice(0,7);
        let reply = `🧾 ${room}호 퇴실 정산 요약\n`;
        reply += `입주: ${prof.moveIn ? prof.moveIn.toString().split('T')[0] : '-'}\n`;
        const moveOutDate = prof.moveOut ? prof.moveOut.toString().split('T')[0] : getTodayKorea();
        reply += `퇴실: ${moveOutDate}\n`;
        reply += `이름: ${prof.name || '-'}\n`;
        reply += `연락처: ${prof.contact || '-'}\n`;
        reply += `보증금: ${Number(prof.deposit||0).toLocaleString()}원\n`;
        reply += `월세/관리비/주차비: ${Number(prof.rent||0).toLocaleString()}/${Number(prof.mgmt||0).toLocaleString()}/${Number(prof.park||0).toLocaleString()}\n`;
        reply += `특이사항: ${prof.remark || '-'}\n`;
        reply += makeSettleTable(settleRes, todayYM) + '\n';
        bot.sendMessage(msg.chat.id, reply);
      }else{
        bot.sendMessage(msg.chat.id, settleRes.msg || '❌ 정산 정보를 가져오지 못했습니다.');
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
      const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 한국 시간
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(koreaTime.getTime());
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0]; // YYYY-MM-DD
      });

      const fetchPromises = dates.map(dateStr => 
        callGAS('getTodosByDate', { date: dateStr })
          .then(result => ({
            date: dateStr,
            list: (result && result.success && Array.isArray(result.data)) ? result.data : []
          }))
          .catch(err => {
            console.error('📡 할일 조회 실패:', dateStr, err);
            return { date: dateStr, list: [] };
          })
      );

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

  // ===== 📁 아카이브 기능들 =====
  
  // 아카이브 목록 조회
  if (/^아카이브목록$/i.test(text) || /^아카이브$/i.test(text)) {
    try {
      const result = await callGAS('getTelegramArchivedRooms', {});
      if (result && result.success) {
        await bot.sendMessage(msg.chat.id, result.message);
      } else {
        await bot.sendMessage(msg.chat.id, '📁 아카이브된 호실이 없습니다.');
      }
    } catch (err) {
      console.error('아카이브 목록 조회 오류:', err);
      bot.sendMessage(msg.chat.id, '❌ 아카이브 목록 조회 중 오류가 발생했습니다.');
    }
    return;
  }

  // 특정 호실 아카이브 상세 조회 (예: 407호아카이브)
  const archiveDetailMatch = textRaw.match(/^(\d{3,4})호?아카이브$/i);
  if (archiveDetailMatch) {
    const room = archiveDetailMatch[1];
    try {
      const result = await callGAS('getTelegramArchivedRoomDetail', { room });
      if (result && result.success) {
        await bot.sendMessage(msg.chat.id, result.message);
      } else {
        await bot.sendMessage(msg.chat.id, `❌ ${room}호의 아카이브 데이터를 찾을 수 없습니다.`);
      }
    } catch (err) {
      console.error(`${room}호 아카이브 상세 조회 오류:`, err);
      bot.sendMessage(msg.chat.id, `❌ ${room}호 아카이브 조회 중 오류가 발생했습니다.`);
    }
    return;
  }

  // 아카이브 퇴실 처리 (예: 407호퇴실)
  const archiveExitMatch = textRaw.match(/^(\d{3,4})호?퇴실(?:\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (archiveExitMatch) {
    const room = archiveExitMatch[1];
    const outDate = archiveExitMatch[2] || getTodayKorea();
    
    try {
      await bot.sendMessage(msg.chat.id, `🏠 ${room}호 퇴실 처리를 시작합니다...\n(데이터는 아카이브에 안전하게 보관됩니다)`);
      
      const result = await callGAS('removeTenantWithArchive', { 
        room, 
        outDate, 
        archiveBy: msg.from.username || msg.from.first_name || 'Telegram' 
      });
      
      if (result && result.success) {
        let reply = `✅ ${room}호 안전 퇴실 완료!\n\n`;
        reply += `📁 아카이브 내역:\n`;
        reply += `• 입금 기록: ${result.archived.payments}건\n`;
        reply += `• 사용량 기록: ${result.archived.usages}건\n`;
        reply += `• 처리자: ${result.archived.archivedBy}\n`;
        reply += `• 처리일: ${new Date(result.archived.archivedDate).toLocaleString('ko-KR')}\n\n`;
        reply += `💡 복구하려면 "${room}호복구"를 입력하세요.`;
        await bot.sendMessage(msg.chat.id, reply);
      } else {
        await bot.sendMessage(msg.chat.id, `❌ ${room}호 퇴실 처리 실패: ${result.message || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error(`${room}호 퇴실 처리 오류:`, err);
      bot.sendMessage(msg.chat.id, `❌ ${room}호 퇴실 처리 중 오류가 발생했습니다.`);
    }
    return;
  }

  // 아카이브 복구 (예: 407호복구)
  const restoreMatch = textRaw.match(/^(\d{3,4})호?복구$/i);
  if (restoreMatch) {
    const room = restoreMatch[1];
    
    try {
      await bot.sendMessage(msg.chat.id, `🔄 ${room}호 데이터 복구를 시작합니다...`);
      
      const result = await callGAS('restoreFromArchive', { 
        room, 
        restoreBy: msg.from.username || msg.from.first_name || 'Telegram' 
      });
      
      if (result && result.success) {
        let reply = `✅ ${room}호 데이터 복구 완료!\n\n`;
        reply += `🔄 복구 내역:\n`;
        reply += `• 입금 기록: ${result.restored.payments}건\n`;
        reply += `• 사용량 기록: ${result.restored.usages}건\n`;
        reply += `• 복구자: ${result.restored.restoredBy}\n`;
        reply += `• 복구일: ${new Date(result.restored.restoredDate).toLocaleString('ko-KR')}\n\n`;
        reply += `💡 이제 ${room}호가 다시 활성화되었습니다.`;
        await bot.sendMessage(msg.chat.id, reply);
      } else {
        await bot.sendMessage(msg.chat.id, `❌ ${room}호 복구 실패: ${result.message || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error(`${room}호 복구 오류:`, err);
      bot.sendMessage(msg.chat.id, `❌ ${room}호 복구 중 오류가 발생했습니다.`);
    }
    return;
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
        // 응답에서 입주일 정보 확인하여 1달미만 체크
        let roomDisplay = dep.room + '호';
        try {
          const jsonRes = JSON.parse(txt);
          if (jsonRes.moveIn) {
            const moveInDate = new Date(jsonRes.moveIn);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            if (moveInDate > oneMonthAgo) {
              roomDisplay = dep.room + '호(1달미만)';
            }
          }
        } catch(e) {
          // 파싱 실패 시 기본 표시
        }
        
        bot.sendMessage(msg.chat.id, `✅ ${roomDisplay} ₩${dep.amount.toLocaleString()} 입금 등록 완료!`);
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
  } else if (
    /^[가-힣a-zA-Z\s]{2,}$/.test(textRaw) ||
    /^01[016789]-?\d{3,4}-?\d{4}$/.test(textRaw) ||
    /[가-힣0-9]{4,}/.test(textRaw)
  ) {
    try {
      const today = new Date();
      const asOfDate = today.toISOString().split('T')[0];
      const settleRes = await callGAS('getSettlementSummary', { room: textRaw, asOfDate });
      if (settleRes && settleRes.success && (settleRes.data || settleRes.profile)) {
        const d = settleRes.profile;
        const formatDate = v => v ? new Date(v).toLocaleDateString('ko-KR') : '-';
        let msg = `🏠 *${d.room ? escapeMarkdown(d.room + '호') : '-'} ${escapeMarkdown(d.name) || '-'} (${d.contact || '-'})*\n`;
        msg += `입주: ${formatDate(d.moveIn)} / 퇴실: ${formatDate(d.moveOut)}\n`;
        msg += `계약기간: ${escapeMarkdown(d.contract) || '-'} / 담당자: ${escapeMarkdown(d.manager) || '-'}\n`;
        msg += `보증금: ${Number(d.deposit||0).toLocaleString()} / 월세: ${Number(d.rent||0).toLocaleString()} / 관리비: ${Number(d.mgmt||0).toLocaleString()} / 주차비: ${Number(d.park||0).toLocaleString()}\n`;
        msg += `차량번호: ${escapeMarkdown(d.car) || '없음'}\n`;
        msg += `특이사항: ${escapeMarkdown(d.remark || d.note) || '-'}\n`;
        const todayYM = today.toISOString().slice(0,7);
        msg += makeSettleTable(settleRes, todayYM);
        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      } else {
        await bot.sendMessage(chatId, `❌ 정보 조회 중 오류: ${settleRes && (settleRes.msg || settleRes.message || JSON.stringify(settleRes))}`);
      }
    } catch (err) {
      console.error('정보 조회 중 오류:', err);
      await bot.sendMessage(chatId, '❌ 정보 조회 중 오류가 발생했습니다.');
    }
    return;
  } else if (/^도움말$/i.test(text) || /^help$/i.test(text)) {
    await showBuildingManagementHelp(chatId);
    return;
  } else {
    await bot.sendMessage(chatId, `❌ 메시지 형식이 올바르지 않습니다.\n\n💡 도움말을 보려면 "도움말"을 입력하세요.`);
  }
}

/* ───────────── 📚 도움말 시스템 ───────────── */
async function showBuildingManagementHelp(chatId) {
  const help = `
🏢 **건물관리 시스템 도움말**

📊 **현황 조회:**
• \`금액\` (예: 320000, 30만원) - 정산금 기준 필터링
• \`전체 미납\` - 정산금 양수인 모든 호실
• \`악성미납\` - 2개월 입금없음 또는 50만원 미만
• \`공실\` - 현재 공실 목록
• \`2025-07\` - 월별 상세 현황

🏠 **호실 관리:**
• \`407호\` - 특정 호실 퇴실 정산 조회
• \`407호퇴실\` - 호실 안전 퇴실 처리 (아카이브)
• \`407호퇴실정산\` - 퇴실정산 PDF 생성

📁 **아카이브 관리:**
• \`아카이브\` - 아카이브된 호실 목록
• \`407호아카이브\` - 특정 호실 아카이브 상세
• \`407호복구\` - 아카이브에서 데이터 복구

💰 **입금 등록:**
• \`407호 입금 50만원 1/7\` - 입금 데이터 등록
• \`407호 50만원 2025-01-07 월세\` - 상세 입금 등록

📝 **할일 관리:**
• \`할일\` - 앞으로 7일 할일 목록
• \`7/20 할일내용\` - 새 할일 추가
• \`7월20일 할일내용\` - 할일 추가 (다른 형식)

💡 **팁:**
• 금액은 쉼표나 '원' 없이 입력 가능
• 날짜는 여러 형식 지원 (7/20, 0720, 7월20일 등)
• 모든 조회는 한국 시간 기준으로 실시간 계산
• 아카이브로 데이터 손실 없는 안전한 퇴실 처리
  `;
  
  await bot.sendMessage(chatId, help);
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`Proxy running on port ${PORT}`);
  
  // WebHook 설정 (Production 환경에서만)
  if (process.env.NODE_ENV === 'production') {
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://weoldeumereudiang.onrender.com';
    const webhookUrl = `${RENDER_URL}/webhook`;
    
    try {
      await bot.setWebHook(webhookUrl);
      console.log('✅ Telegram WebHook 설정 완료:', webhookUrl);
      console.log('Telegram Bot is active and ready! (WebHook mode)');
    } catch (error) {
      console.error('❌ WebHook 설정 실패:', error);
      console.log('🔄 Polling 백업 모드로 전환...');
      
      // WebHook 실패 시 Polling 모드로 백업
      try {
        await bot.deleteWebHook();
        bot.startPolling();
        bot.on('message', handleTelegramMessage);
        console.log('✅ Polling 백업 모드 활성화');
      } catch (pollingError) {
        console.error('❌ Polling 백업 모드도 실패:', pollingError);
      }
    }
    
    // Self-ping to keep server alive (Render.com 무료 플랜용)
    setInterval(() => {
      fetch(`${RENDER_URL}/health`)
        .then(res => res.json())
        .then(data => console.log('🏥 Health check:', data.timestamp))
        .catch(err => console.log('❌ Health check failed:', err.message));
    }, 14 * 60 * 1000); // 14분마다 (Render.com 15분 제한 회피)
  } else {
    // 개발 환경에서는 Polling 모드 사용
    bot.startPolling();
    bot.on('message', handleTelegramMessage);
    console.log('Telegram Bot is active and ready! (Development mode - Polling)');
  }
}); 


