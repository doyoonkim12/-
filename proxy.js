  /* ═══════════════════════════════════════════════════════════
    🏢 건물관리 시스템 - 최적화판
    📱 모바일 웹앱 + 🔄 자동 생성 + ⚡ 실시간 업데이트 + 🔥 baseFix 차감
    ═══════════════════════════════════════════════════════════ */

  /* ───────────── 전역 상수 ───────────── */
  const REPORT_BASE    = 125;
  const ROWS_PER_ROOM  = 17;   // 한 호실당 17행 (주차비2 포함)
  const GAP            = 0;
  const DATA_SHEET    = '입주데이터';    
  const PAYMENT_SHEET = '입금데이터';    
  const USAGE_SHEET   = '사용량데이터';  
  const DATA_START_ROW = 2;
  // 동적으로 계산되는 DATA_END_ROW
  function getDataEndRow() {
    const roomCount = REPORT_BASE - DATA_START_ROW;
    return REPORT_BASE + (roomCount * ROWS_PER_ROOM) - 1;
  }
  const DATA_END_ROW = getDataEndRow();   // 계산된 값: 2215행
  const USERS_SHEET = 'Users';

  
  // 15행 레이아웃 인덱스 매핑(enum)
  const IDX = {
    HEADER:0,          // 헤더 (호실 & yyyy-MM)
    PREV_ARREARS:1,    // 전월미납금
    ELEC:2, GAS:3, WATER:4,
      PARK2:5,          // 추가 주차비2
      RENT:6, MGMT:7, PARK:8,
      CHARGE:9, BILLING:10, PAYMENT:11,
      ARREARS:12,        // 당월 미납금
      TOTAL_ARREARS:13,  // 총미납금
      REMAIN:14, TOTAL_PAYMENT:15,
      TOTAL_CHARGE:16   // ▶ 새 행: 총청구내역
  };

  /* ───────────── 📱 모바일 웹앱 서비스 ───────────── */
  function doGet() {
    return HtmlService.createTemplateFromFile('index').evaluate();
  }

  // POST 요청 처리 (GAS 표준 방식)
  function doPost(e) {
    try {
      var raw = e.postData && e.postData.contents;
      var body = raw ? JSON.parse(raw) : {};
      
      // 🤖 텔레그램 처리
      if (body && body.update_id) {
        return handleTelegramWebhook(body);
      }
      
      // 📱 API 처리 (직접)
      console.log('📱 API 요청 처리:', body.func);
      
      var functionName = body.func;
      var params = body.params || {};
      
      // 연결 테스트용 디버깅 로그
      console.log('📡 API 호출됨:', functionName, params);
      var result;
      
      // 함수별 라우팅
      switch(functionName) {
        case 'loginUser':
          result = loginUser(params.id, params.pwHash);
          break;
        case 'registerUser':
          result = registerUser(params.id, params.pwHash, params.name, params.contact);
          break;
        case 'getSummaryStats':
          result = { success: true, data: getSummaryStats() };
          break;
        case 'getRoomsByRemain':
          result = { success: true, data: getRoomsByRemain(params.maxWon) };
          break;
        case 'getAllRoomStatus':
          result = { success: true, data: getAllRoomStatus(params) };
          break;
        case 'getRoomListForMobile':
          result = { success: true, data: getRoomListForMobile() };
          break;
        case 'addPaymentFromMobile':
          result = addPaymentFromMobile(params.room, params.amount, params.date, params.memo, params.manager);
          break;
        case 'addUsageFromMobile':
          result = addUsageFromMobile(params.room, params.month, params.elec, params.gas, params.water, params.park2);
          break;
        case 'addTodo':
          result = addTodo(params);
          break;
        case 'getTodosByDate':
          result = { success: true, data: getTodosByDate(params) };
          break;
        case 'setTodoDone':
          result = setTodoDone(params);
          break;
        case 'deleteTodo':
          result = deleteTodo(params);
          break;
        case 'rebuildAllApi':
          result = rebuildAllApi();
          break;
        case 'rebuildRoomApi':
          result = rebuildRoomApi(params.room);
          break;
        case 'getBillingList':
          result = getBillingList();
          break;
        case 'getBillingListFast':
          result = getBillingListFast();
          break;
        case 'createBillingSheetForWeb':
          result = createBillingSheetForWeb();
          break;
        case 'getSettlementSummary':
          result = getSettlementSummary(params);
          break;
        case 'getBuildingMonthlyStatsV2':
          result = { success: true, data: getBuildingMonthlyStatsV2(params) };
          break;
        case 'getVacantRooms':
          result = { success: true, data: getVacantRooms() };
          break;
        case 'getMgmtHistory':
          result = { success: true, data: getMgmtHistory() };
          break;
        case 'debugDataHeaders':
          result = { success: true, data: debugDataHeaders() };
          break;
        case 'getBuildingMonthlyStats':
          result = { success: true, data: getBuildingMonthlyStats(params) };
          break;
        case 'getRecentPayments':
          result = { success: true, data: getRecentPayments(params) };
          break;
        case 'getRecentUsages':
          result = { success: true, data: getRecentUsages(params) };
          break;
        case 'exportBillingXlsx':
          result = { success: true, url: exportBillingXlsx() };
          break;
        case 'exportBillingCsv':
          result = { success: true, url: exportBillingCsv() };
          break;
        case 'exportBillingCsvBom':
          result = { success: true, url: exportBillingCsvAnsi() };
          break;
        case 'addPaymentsBulk':
          result = addPaymentsBulk(params.entries);
          break;
        case 'addUsagesBulk':
          result = addUsagesBulk(params.entries);
          break;
        case 'getPaymentsForRoom':
          result = { success: true, data: getPaymentsForRoom(params.room) };
          break;
        case 'getUsagesByRoom':
          result = { success: true, data: getUsagesByRoom(params.room) };
          break;
        case 'updatePaymentRow':
          result = updatePaymentRow(params.row, params.newData);
          break;
        case 'updateUsageRow':
          result = updateUsageRow(params.row, params.newData);
          break;
        case 'deletePaymentRows':
          result = deletePaymentRows(params.rows);
          break;
        case 'deleteUsageRows':
          result = deleteUsageRows(params.rows);
          break;
        case 'addTenantInfo':
          result = addTenantInfo(params);
          break;
        case 'removeTenantCompletely':
          result = removeTenantCompletely(params.room, params.outDate);
          break;
        case 'updateTodo':
          result = updateTodo(params);
          break;
        case 'exportSettlementPdf':
          result = { success: true, url: exportSettlementPdf(params) };
          break;
        case 'getMonthlyDetail':
          result = getMonthlyDetail(params.month);
          break;
        case 'getBadDebtors':
          result = getBadDebtors();
          break;
        case 'removeTenantWithArchive':
          result = removeTenantWithArchive(params.room, params.outDate, params.archiveBy);
          break;
        case 'restoreFromArchive':
          result = restoreFromArchive(params.room, params.restoreBy);
          break;
        case 'getTelegramArchivedRooms':
          result = getTelegramArchivedRooms();
          break;
        case 'getTelegramArchivedRoomDetail':
          result = getTelegramArchivedRoomDetail(params.room);
          break;
        case 'ensureArchiveSheets':
          ensureArchiveSheets();
          result = { success: true, message: '아카이브 시트 생성 완료' };
          break;
        default:
          result = { success: false, error: 'Unknown function: ' + functionName };
      }
      
      // CORS 헤더 추가하여 응답
      var output = ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
      return output;
      
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: err.toString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 🤖 텔레그램 웹훅 처리 (분리)
  function handleTelegramWebhook(body) {
    console.log('🤖 텔레그램 메시지 처리:', body.message);
    handleTelegramUpdate(body);
    return ContentService.createTextOutput('OK');
  }





  // 🔥 모바일에서 입금 등록 (baseFix 자동 적용)
  function addPaymentFromMobile(room, amount, date, memo, manager) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
      
      if (!paymentSheet) {
        ensurePaymentSheet();
        paymentSheet = ss.getSheetByName(PAYMENT_SHEET);
      }
      
      // 입금 데이터 추가
      const clean = v=>parseFloat(String(v).replace(/[^0-9+\-.]/g,''))||0;
      const newRow = [
        room,
        clean(amount),
        manager || '경리',
        '입금',
        new Date(date),
        memo || ''
      ];
      
      paymentSheet.appendRow(newRow);
      
      // 🔥 즉시 baseFix 적용하여 업데이트
      updateReportPayment(room);
      
      // 서식 적용 (금액/날짜)
      const lastRow = paymentSheet.getLastRow();
      paymentSheet.getRange(lastRow,2).setNumberFormat('"₩"#,##0');
      paymentSheet.getRange(lastRow,5).setNumberFormat('yyyy-MM-dd');
      
      return {
        success: true,
        message: `${room}호 ₩${parseInt(amount).toLocaleString()} 입금 등록 완료 (baseFix 자동 적용)`
      };
      
    } catch (error) {
      return {
        success: false,
        message: '오류: ' + error.toString()
      };
    }
  }

  // 모바일용 사용량 등록
    function addUsageFromMobile(room, month, elec, gas, water, park2) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const usageSheet = ss.getSheetByName(USAGE_SHEET);
      
      if (!usageSheet) {
        ensureUsageSheet();
        usageSheet = ss.getSheetByName(USAGE_SHEET);
      }
      
      const newRow = [
        room,
        new Date(month + '-01'),
        parseFloat(elec) || 0,
        parseFloat(gas) || 0,
          parseFloat(water) || 0,
          parseFloat(park2) || 0
      ];
      
      usageSheet.appendRow(newRow);
      
      // 즉시 업데이트
      const tz = Session.getScriptTimeZone();
      const ym = Utilities.formatDate(new Date(month + '-01'), tz, 'yyyy-MM');
      updateReportUsage(room, ym, true);
      
      return {
        success: true,
        message: `${room}호 ${month} 사용량 등록 완료`
      };
      
    } catch (error) {
      return {
        success: false,
        message: '오류: ' + error.toString()
      };
    }
  }



  /* ───────────── 메뉴 구성 ───────────── */
  function onOpen(){
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🏢 건물관리')
      .addItem('📊 전체 리빌드', 'runAll_Part1')
      .addSeparator()
      .addItem('📜 청구표 생성', 'createBillingSheetSafe')
      .addItem('📄 청구표 엑셀 출력', 'exportBillingXlsx')
      .addItem('📄 청구표 CSV 출력', 'exportBillingCsv')
      .addSeparator()
      .addItem('💰 입금 등록', 'showPaymentSidebar')
      .addItem('⚡ 사용량 등록', 'showUsageSidebar')
      .addSeparator()
      .addItem('📋 미수금내역 생성', 'createFastMisugumSheet')
      .addItem('📈 입출금내역 생성', 'createFastMgmtHistorySheet')
      .addSeparator()
      .addItem('⚙️ 자동 리빌드 설정', 'setupTimeBasedTrigger')
      .addToUi();
  }

  // 🔧 안전한 청구표 생성 함수 (UI 오류 방지)
  function createBillingSheetSafe(){
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert('📜 청구표 생성', '청구표를 생성하시겠습니까?', ui.ButtonSet.YES_NO);
      
      if (response !== ui.Button.YES) {
        return;
      }
      
      ui.alert('⏳ 처리 중...', '청구표를 생성하고 있습니다. 잠시만 기다려주세요.', ui.ButtonSet.OK);
      
      // 기존 청구표 시트 삭제
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const existingSheet = ss.getSheetByName('청구표');
      if (existingSheet) {
        ss.deleteSheet(existingSheet);
      }
      
      // ensureBillingSheet 사용 (더 안전)
      const sheet = ensureBillingSheet();
      sheet.activate();
      
      const lastRow = sheet.getLastRow();
      ui.alert('✅ 완료', `청구표가 성공적으로 생성되었습니다.\n총 ${lastRow - 1}개의 호실이 포함되었습니다.`, ui.ButtonSet.OK);
      
         } catch (error) {
       console.error('안전한 청구표 생성 오류:', error);
       SpreadsheetApp.getUi().alert('❌ 오류', '청구표 생성 중 오류: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
     }
   }

   // 🌐 웹앱용 청구표 생성 함수 (UI 없음)
   function createBillingSheetForWeb(){
     try {
       // 기존 청구표 시트 삭제
       const ss = SpreadsheetApp.getActiveSpreadsheet();
       const existingSheet = ss.getSheetByName('청구표');
       if (existingSheet) {
         ss.deleteSheet(existingSheet);
       }
       
       // ensureBillingSheet 사용 (안전한 생성)
       const sheet = ensureBillingSheet();
       const lastRow = sheet.getLastRow();
       
       return { 
         success: true, 
         message: `청구표가 성공적으로 생성되었습니다. (${lastRow - 1}개 호실)`,
         data: { 
           roomCount: lastRow - 1,
           sheetName: '청구표'
         }
       };
       
     } catch (error) {
       console.error('웹앱 청구표 생성 오류:', error);
       return { 
         success: false, 
         message: '청구표 생성 중 오류: ' + error.toString() 
       };
     }
   }



  /* ───────────── 🔥 핵심 업데이트 함수 (baseFix 포함) ───────────── */

  // 🔥 입금 업데이트 (baseFix 차감 로직 포함)
  function updateReportPayment(room) {
    if (!room) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const paymentSh = ss.getSheetByName(PAYMENT_SHEET);
    
    if (!dataSh || !paymentSh) return;
    
    // 호실 블록 위치 찾기
    const colA = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                      .getValues().flat().map(v => String(v).trim());
    const rawIdx = colA.indexOf(room);
    if (rawIdx < 0) return;
    
    // ▶ 입주일/퇴실일 셀 값 미리 로드 (E, F 컬럼) – 헤더 재생성에 사용
    const moveInCell  = dataSh.getRange(DATA_START_ROW + rawIdx, 5).getValue(); // E열
    const moveOutCell = dataSh.getRange(DATA_START_ROW + rawIdx, 6).getValue(); // F열
     
    const blkIdx = colA.filter(v => v).indexOf(room);
    const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
    
    try {
      const tz = Session.getScriptTimeZone();
      
      // 헤더에서 월 목록 가져오기
      const headerRaw = dataSh
        .getRange(start, 3, 1, dataSh.getLastColumn() - 2)
        .getDisplayValues()[0]
        .map(c => String(c).replace(/[\.\u2010-\u2015]/g, '-').trim());

      const header = headerRaw.filter(h => /^\d{4}-\d{2}$/.test(h));

      // 🔧 헤더 정규화 배열 (하이픈 종류 무시)
      const normHeader = header.map(h => h.replace(/[\.\u2010-\u2015]/g, '-'));

      // 헤더가 비어 있으면 입주/퇴실일 기준으로 생성 (퇴실월+1 포함)
      if (header.length === 0) {
        header = generateMonthsArray(
          moveInCell  instanceof Date ? moveInCell  : null,
          moveOutCell instanceof Date ? moveOutCell : null
        );
      }
      
      // 월별 입금액 계산
      const monthlyPayments = {};
      let totalPayment = 0;
      let totalWithdrawal = 0;
      
      if (paymentSh.getLastRow() > 1) {
        const paymentData = paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 5).getValues();
        paymentData.forEach(row => {
          if (String(row[0]).trim() === room) {
            const amount = parseFloat(row[1]) || 0;
            const type = String(row[3]).trim();
            const date = row[4];
            
            if (type === '입금') {
              totalPayment += amount;
              
              // 입금 날짜에 따라 해당 월에 배치
              if (date) {
                try {
                  const paymentYm = Utilities.formatDate(new Date(date), tz, 'yyyy-MM');
                  if (normHeader.includes(paymentYm)) {
                    monthlyPayments[paymentYm] = (monthlyPayments[paymentYm] || 0) + amount;
                  } else {
                    const firstMonth = header.length>0 ? header[0] : null;
                    if (firstMonth) {
                      monthlyPayments[firstMonth] = (monthlyPayments[firstMonth] || 0) + amount;
                    }
                  }
                } catch (error) {
                  const firstMonth = header.length>0 ? header[0] : null;
                  if (firstMonth) {
                    monthlyPayments[firstMonth] = (monthlyPayments[firstMonth] || 0) + amount;
                  }
                }
              }
            } else if (type === '출금') {
              totalWithdrawal += amount;
            }
          }
        });
      }
      
      // 🔥 baseFix 정보를 나중 미납 계산에 사용하기 위해 보관
      const roomData = dataSh.getRange(DATA_START_ROW + rawIdx, 1, 1, 14).getValues()[0];
      const deposit = parseFloat(roomData[8])  || 0;  // I열 보증금
      const rent    = parseFloat(roomData[9])  || 0;  // J열 월세
      const mgmt    = parseFloat(roomData[10]) || 0;  // K열 관리비
      const park    = parseFloat(roomData[11]) || 0;  // L열 주차비
      const baseFix = deposit + rent + mgmt + park;
      
      // 🔥 보증금+고정비(baseFix) 선차감: 월별 입금액에서 먼저 차감 (왼쪽→오른쪽 순)
      if (baseFix > 0 && header.length > 0) {
        let remain = baseFix;
        header.forEach(ym => {
          if (remain <= 0) return;
          const paid = monthlyPayments[ym] || 0;
          if (paid > 0) {
            const deduct = Math.min(paid, remain);
            monthlyPayments[ym] = paid - deduct;
            remain -= deduct;
          }
        });
      }
      
      // 월별 입금액을 해당 월 열에 배치
      const inputRow = start + 9;
      
      // 기존 입금액 행 초기화
      if (header.length > 0) {
        dataSh.getRange(inputRow, 3, 1, header.length).clearContent();
      }
      
      // 월별 입금액 배치
      Object.keys(monthlyPayments).forEach(ym => {
        const colIdx = normHeader.indexOf(ym);
        if (colIdx !== -1) {
          const col = 3 + colIdx;
          dataSh.getRange(inputRow, col).setValue(monthlyPayments[ym]).setNumberFormat('"₩"#,##0');
        }
      });

      // 🔧 현재월 고정비 일할계산 반영
      prorateCurrentMonthFixed(dataSh, start, rawIdx, header);

      // 총입금액 업데이트
      dataSh.getRange(start + 13, 3).setValue(totalPayment - totalWithdrawal).setNumberFormat('"₩"#,##0');
      
      // 청구내역 업데이트 (앞달 청구금액 → 현재달 청구내역)
      updateBillingHistory(dataSh, start, 3, header);
      
      // 총미납금과 남은금액 계산 (header 전달로 3-인자 버전 사용)
      updateTotalAmounts(dataSh, start, header);
      
      console.log(`⚡ ${room}호 입금 업데이트 완료 (baseFix 적용): 총입금 ₩${(totalPayment - totalWithdrawal).toLocaleString()}`);
      
    } catch (error) {
      console.error(`${room}호 입금 업데이트 실패:`, error);
    }
  }

  // updateReportPayment는 baseFix 로직이 포함된 단일 함수로 통합됨

  // 사용량 업데이트 (기존과 동일)
  function updateReportUsage(room, ym, isFastMode = true) {
    if (!room || !ym) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const usageSh = ss.getSheetByName(USAGE_SHEET);
    
    if (!dataSh || !usageSh) return;
    
    const tz = Session.getScriptTimeZone();
    ym = Utilities.formatDate(new Date(ym), tz, 'yyyy-MM');
    
    // 호실 블록 위치 찾기
    const rooms = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                        .getValues().flat().map(v => String(v).trim());
    const rawIdx = rooms.indexOf(room);
    if (rawIdx < 0) return;
    
    const blkIdx = rooms.filter(v => v).indexOf(room);
    const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
    
    // 헤더에서 해당 월 찾기
    const header = dataSh.getRange(start, 3, 1, dataSh.getLastColumn() - 2)
                        .getDisplayValues()[0].map(c => String(c).replace(/\u2010/g, '-').trim()).filter(Boolean);
    const idx = header.indexOf(ym);
    if (idx === -1) return;
    
    const col = 3 + idx;
    
    // 🔧 현재월 고정비 일할계산 반영
    prorateCurrentMonthFixed(dataSh, start, rawIdx, header);
    
    try {
      // 해당 호실, 해당 월의 사용량 계산
        let elec = 0, gas = 0, wat = 0, p2 = 0;
      
      if (usageSh.getLastRow() > 1) {
          const usageData = usageSh.getRange(2, 1, usageSh.getLastRow() - 1, 6).getValues();
        usageData.forEach(row => {
          if (String(row[0]).trim() === room) {
            const rowYm = Utilities.formatDate(new Date(row[1]), tz, 'yyyy-MM');
            if (rowYm === ym) {
              // 금액이 통화포맷(₩, 콤마)으로 들어올 수 있으므로 숫자만 추출 후 파싱
              const num = v => parseFloat(String(v).replace(/[^0-9+\-\.]/g,'')) || 0;
              elec += num(row[2]);
              gas += num(row[3]);
              wat += num(row[4]);
                p2  += num(row[5]);
            }
          }
        });
      }
      
      // 전기, 가스, 수도 업데이트
      const baseRow = start + IDX.ELEC; // ELEC 행(2)
      dataSh.getRange(baseRow, col).setValue(elec);
      dataSh.getRange(baseRow + 1, col).setValue(gas);
      dataSh.getRange(baseRow + 2, col).setValue(wat);
        dataSh.getRange(baseRow + 3, col).setValue(p2);
        dataSh.getRange(baseRow, col, 4, 1).setNumberFormat('"₩"#,##0');
      
      // 청구금액 재계산
      const rent = parseFloat(dataSh.getRange(start + IDX.RENT,  col).getValue()) || 0;
      const mgmt = parseFloat(dataSh.getRange(start + IDX.MGMT,  col).getValue()) || 0;
      const park = parseFloat(dataSh.getRange(start + IDX.PARK,  col).getValue()) || 0;
        const total = rent + mgmt + park + p2 + elec + gas + wat;
      
      dataSh.getRange(start + IDX.CHARGE, col).setValue(total).setNumberFormat('"₩"#,##0');
      
      // 청구내역 업데이트
      updateBillingHistory(dataSh, start, 3, header);
      
      // 총액 재계산
      updateTotalAmounts(dataSh, start, header);
      
      console.log(`⚡ ${room}호 ${ym} 사용량 업데이트: 전기 ₩${elec.toLocaleString()}, 가스 ₩${gas.toLocaleString()}, 수도 ₩${wat.toLocaleString()}`);
      
    } catch (error) {
      console.error(`${room}호 사용량 업데이트 실패:`, error);
    }
  }

  // 🔥 청구내역 업데이트 (앞달 청구금액 → 다음달 청구내역) - 수정됨!
  function updateBillingHistory(sh, start, sc, months) {
    try {
      if (!months || months.length === 0) {
        console.warn('updateBillingHistory: months 배열이 비어있어 스킵합니다.');
        return;            // 👉 헤더가 없으면 즉시 종료
      }
      const n = months.length;

      // ── 1) 다음달 청구내역 = 전월 청구금액 + 전월 미납금 ──
      const billingNext = Array(n).fill(0);
      for (let i = 0; i < n - 1; i++) {
        const col = sc + i;
        const chargeCur  = parseFloat(sh.getRange(start + IDX.CHARGE , col).getValue()) || 0;
        const arrearsCur = parseFloat(sh.getRange(start + IDX.ARREARS, col).getValue()) || 0;
        billingNext[i + 1] = chargeCur + arrearsCur; // 전월 청구 + 전월 미납
      }
      sh.getRange(start + IDX.BILLING, sc, 1, n)
        .setValues([billingNext])
        .setNumberFormat('"₩"#,##0');

      // ── 2) 전월미납금 행 갱신 (arrears 를 우측으로 한 칸 쉬프트) ──
      const prevArr = Array(n).fill(0);
      for (let i = 1; i < n; i++) {
        prevArr[i] = parseFloat(sh.getRange(start + IDX.ARREARS, sc + i - 1).getValue()) || 0;
      }
      sh.getRange(start + IDX.PREV_ARREARS, sc, 1, n)
        .setValues([prevArr])
        .setNumberFormat('"₩"#,##0');

      // ── 3) 미납금 = 청구내역 - 입금액  (음수 허용) ──
      const payRow = sh.getRange(start + IDX.PAYMENT, sc, 1, n).getValues()[0];
      const arrearsRow = billingNext.map((b, i) => (parseFloat(b) || 0) - (parseFloat(payRow[i]) || 0));
      sh.getRange(start + IDX.ARREARS, sc, 1, n)
        .setValues([arrearsRow])
        .setNumberFormat('"₩"#,##0');

      // ▶ 스타일 적용: 청구내역(빨간/굵게), 입금액(파란/굵게)
      sh.getRange(start + IDX.BILLING, sc, 1, n)
        .setFontColor('#b91c1c')  // red-700
        .setFontWeight('bold');
      sh.getRange(start + IDX.PAYMENT, sc, 1, n)
        .setFontColor('#1e40af')  // blue-800
        .setFontWeight('bold');

      console.log('🔥 청구내역·미납 업데이트 완료 (billing = charge + arrears)');

    } catch (error) {
      console.error('updateBillingHistory 오류:', error);
    }
  }

  // 🔥 총액 재계산 (올바른 총미납금 계산)
  /**
 * ▸ 총미납금(잔액) = 미납금 행에서 가장 최근 달(맨 끝 열) 값
 * ▸ 잔여금(REMAIN) = 총청구 - 총입금 (지금까지 방식 그대로)
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} dataSh
 * @param {number} start   블록 시작행(=헤더) 번호
 * @param {string[]} header  YYYY-MM 배열 (3열부터 순차)
 */
  
  /* ───────────── 🏦 자동 생성 함수들 ───────────── */

  // 🎨 층별 세로형 미수금내역 자동 생성 (스크린샷 형태)
  function createFastMisugumSheet() {
    let ui=null; try{ ui=SpreadsheetApp.getUi(); }catch(e){}
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    if(!dataSh) return;

    /* ❶ 기존 '미수금내역' 으로 시작하는 시트 전부 삭제 */
    ss.getSheets().forEach(s=>{
      if(/^미수금내역/.test(s.getName())){
        try{ ss.deleteSheet(s); }catch(e){ console.log('삭제 실패',s.getName(),e); }
      }
    });

    /* ❷ 이후 새 시트 생성 */
    const misugumSh = ss.insertSheet('미수금내역');
    
    // 전체 호실 데이터 가져오기
    const allRoomData = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 14).getValues();
    
    // 🏢 층별로 데이터 그룹화 (11층~16층 올바르게 처리)
    const floorData = {};
    allRoomData.forEach((row, index) => {
      const room = String(row[0]).trim();

      // 📛 보고서 블록 영역의 헤더 행(성함 셀이 비어 있음)은 제외
      //     → DATA 시트 상단의 실제 입주 데이터만 사용해야 중복이 생기지 않습니다.
      if (!room || !row[1]) return;      // row[1] = 성함(B열)

      // 중복 호실 1회만 추가 (예: 데이터 시트에 잘못된 중복 행이 있는 경우)
      const existing = floorData && Object.values(floorData).some(arr=>arr.some(r=>r.room===room));
      if (existing) return;

      // 🔥 층 구분 로직 완전 개선 (모든 층 올바르게 처리)
      let floor;
      if (room.length >= 4) {
        // 4자리 호실 (1001호, 1101호, 1201호 등)
        if (room.startsWith('10')) {
          floor = '10';  // 1001호 -> 10층
        } else if (room.startsWith('11')) {
          floor = '11';  // 1101호 -> 11층
        } else if (room.startsWith('12')) {
          floor = '12';  // 1201호 -> 12층
        } else if (room.startsWith('13')) {
          floor = '13';  // 1301호 -> 13층
        } else if (room.startsWith('14')) {
          floor = '14';  // 1401호 -> 14층
        } else if (room.startsWith('15')) {
          floor = '15';  // 1501호 -> 15층
        } else if (room.startsWith('16')) {
          floor = '16';  // 1601호 -> 16층
        } else if (room.startsWith('17')) {
          floor = '17';  // 1701호 -> 17층
        } else if (room.startsWith('18')) {
          floor = '18';  // 1801호 -> 18층
        } else if (room.startsWith('19')) {
          floor = '19';  // 1901호 -> 19층
        } else if (room.startsWith('20')) {
          floor = '20';  // 2001호 -> 20층
        } else {
          floor = room.substring(0, 2); // 기타 4자리 호실
        }
      } else {
        floor = room.charAt(0); // 3자리 호실 (301호, 401호 등)
      }
      
      // 3층~16층만 대상 (다른 층은 건너뜀)
      const fNum = parseInt(floor, 10);
      if (isNaN(fNum) || fNum < 3 || fNum > 16) return;
      
      if (!floorData[floor]) floorData[floor] = [];
      
      const blkIdx = allRoomData.filter((r, i) => i <= index && String(r[0]).trim()).length - 1;
      const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
      
      try {
        const totalUnpaid = parseFloat(dataSh.getRange(start + IDX.TOTAL_ARREARS, 3).getValue()) || 0;
        const remainAmount = parseFloat(dataSh.getRange(start + IDX.REMAIN, 3).getValue()) || 0;
        
        floorData[floor].push({
          room: room,
          name: row[1] || '',
          contact: row[2] || '',
          unpaid: totalUnpaid,
          settlement: remainAmount,
          memo: row[13] || ''
        });
      } catch (error) {
        console.error(`${room}호 데이터 처리 오류:`, error);
      }
    });
    
    // ──────────────────────────────────────────────
    // 📌 모든 층에서 가장 많은 호실 수를 구해 전역 열 수(globalMax) 계산
    const globalMax = Math.max(
      8,                           // 최소 8열
      ...Object.values(floorData).map(arr => arr.length + 1)  // 라벨열 포함
    );

    let currentRow = 1;
    
    // 🎨 각 층별로 세로형 테이블 생성 (스크린샷 형태)
    // 🔥 층 정렬 (일반 층 + 고층 분리)
    const sortedFloors = Object.keys(floorData)
      .filter(f => {
        const n = parseInt(f, 10);
        return !isNaN(n) && n >= 3 && n <= 16;
      })
      .sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedFloors.forEach(floor => {
      const rooms = floorData[floor];
      if (rooms.length === 0) return;
      
      // 🏢 층 헤더 - 전체 폭으로 병합
      const floorHeader = `${floor}층`;
      const maxCols = globalMax; // 전역 최대 열 수 사용 (중복 셀 방지)
      
      // 👉 이전 내용 제거 후 헤더 병합
      misugumSh.getRange(currentRow, 1, 1, maxCols).clearContent();
      misugumSh.getRange(currentRow, 1, 1, maxCols).merge()
        .setValue(floorHeader)
        .setFontWeight('bold')
        .setBackground('#1a365d')      // 🔥 더 진한 남색
        .setFontColor('white')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setFontSize(16)               // 🔥 글자 크기 증가
        .setBorder(true, true, true, true, true, true);
      
      currentRow++;
      
      // 🏠 호실 행 (301호, 302호, 303호...)
      const roomRowData = [''];  // 첫 번째 열 비워둠
      rooms.forEach(roomData => {
        roomRowData.push(roomData.room);
      });
      // 👉 padding: 남은 칸을 빈 문자열로 채워 maxCols 길이로 맞춤
      while (roomRowData.length < maxCols) roomRowData.push('');

      // 👉 행 초기화 후 값 쓰기 (중복 데이터 제거)
      misugumSh.getRange(currentRow, 1, 1, maxCols).clearContent();
      misugumSh.getRange(currentRow, 1, 1, maxCols).setValues([roomRowData]);
      
      // 🔥 호실 행 스타일링 (더 진하고 굵게)
      misugumSh.getRange(currentRow, 2, 1, rooms.length)
        .setFontWeight('bold')
        .setBackground('#2563eb')       // 🔥 더 진한 파란색 배경
        .setFontColor('white')          // 🔥 흰색 글자
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setFontSize(14)                // 🔥 글자 크기 증가
        .setBorder(true, true, true, true, true, true);
      
      currentRow++;
      
      // 📋 각 정보 행들 (성함, 연락처, 총미수금, 정산금액, 특이사항)
      const infoLabels = ['성함', '연락처', '총 미수금', '정산금액', '특이사항'];
      const infoKeys = ['name', 'contact', 'unpaid', 'settlement', 'memo'];
      
      infoLabels.forEach((label, labelIndex) => {
        const rowData = [label];  // 첫 번째 열에 라벨
        
        rooms.forEach(roomData => {
          let value = roomData[infoKeys[labelIndex]];
          
          // 숫자 데이터 처리
          if (infoKeys[labelIndex] === 'unpaid' || infoKeys[labelIndex] === 'settlement') {
            value = parseFloat(value) || 0;
          }
          
          rowData.push(value || '');
        });
        
        // 👉 padding + 행 초기화 후 값 쓰기
        while (rowData.length < maxCols) rowData.push('');
        misugumSh.getRange(currentRow, 1, 1, maxCols).clearContent();
        misugumSh.getRange(currentRow, 1, 1, maxCols).setValues([rowData]);
        
        // 🔥 라벨 열 스타일링 (더 진하고 굵게)
        misugumSh.getRange(currentRow, 1)
          .setFontWeight('bold')
          .setBackground('#374151')       // 🔥 더 진한 회색
          .setFontColor('white')          // 🔥 흰색 글자
          .setHorizontalAlignment('center')
          .setVerticalAlignment('middle')
          .setFontSize(12);
        
        // 데이터 영역 테두리
        misugumSh.getRange(currentRow, 1, 1, rowData.length)
          .setBorder(true, true, true, true, true, true);
        
        // 금액 열 숫자 형식 적용 및 색상
        if (infoKeys[labelIndex] === 'unpaid' || infoKeys[labelIndex] === 'settlement') {
          misugumSh.getRange(currentRow, 2, 1, rooms.length)
            .setNumberFormat('"₩"#,##0')
            .setHorizontalAlignment('right');
          
          // 🔥 미수금 색상 (더 진한 빨간색)
          if (infoKeys[labelIndex] === 'unpaid') {
            misugumSh.getRange(currentRow, 2, 1, rooms.length)
              .setFontColor('#dc2626')        // 빨간 글자
              .setBackground(null)            // 기본 배경
              .setFontWeight('bold')          // 🔥 굵은 글자
              .setFontSize(11);
          }
          
          // 🔥 정산금액 색상 (더 진한 파란색)
          if (infoKeys[labelIndex] === 'settlement') {
            misugumSh.getRange(currentRow, 2, 1, rooms.length)
              .setFontColor('#1d4ed8')        // 파란 글자
              .setBackground(null)
              .setFontWeight('bold')
              .setFontSize(11);
          }
        }
        
        currentRow++;
      });
      
      currentRow += 2; // 층 간 간격
    });
    
    // 🔥 열 너비 수동 조정 (자동 조정 대신)
    misugumSh.setColumnWidth(1, 100);  // A열: 라벨 (성함, 연락처 등)
    
    // B열부터 호실별 열 너비 설정
    const totalCols = misugumSh.getLastColumn();
    for (let col = 2; col <= totalCols; col++) {
      misugumSh.setColumnWidth(col, 110); // 각 호실 열: 110px
    }
    
    // 🔥 시트 보호 설정 (읽기 전용)
    try {
      const protection = misugumSh.protect().setDescription('미수금내역 보호');
      protection.setWarningOnly(true);
    } catch (error) {
      console.log('시트 보호 설정 실패:', error);
    }
    
    SpreadsheetApp.getUi().alert(`✅ 층별 세로형 미수금내역 생성 완료!\n${Object.keys(floorData).length}개 층 처리됨\n\n🔥 층 구분 수정:\n• 1001호 → 10층\n• 1101호 → 11층\n• 301호 → 3층 등\n\n📋 각 층별로 호실을 가로 배치하고\n세부 정보를 아래에 세로로 배치했습니다.\n\n🎨 진한 디자인 적용:\n• 진한 빨간색: 미수금 (흰글자)\n• 진한 파란색: 정산금액 (흰글자)\n• 진한 회색: 라벨 (흰글자)\n• 진한 남색: 층 헤더\n\n💡 성함, 연락처, 총미수금, 정산금액, 특이사항으로 구성되어 있습니다!`);

    // ── (기존: 데이터 setValues, 서식 지정 등 ↓ 바로 위까지 그대로) ──

    // ★ [추가] 오른쪽 빈 열 삭제
    const lastCol = misugumSh.getLastColumn();           // 실제 데이터 마지막 열
    if (lastCol < misugumSh.getMaxColumns()) {
      misugumSh.deleteColumns(lastCol + 1,
                              misugumSh.getMaxColumns() - lastCol);
    }
  }

 

  /* ───────────── 기타 필수 함수들 ───────────── */

  function getRoomList(){
    return SpreadsheetApp.getActive().getSheetByName(DATA_SHEET)
      .getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1)
      .getValues().flat().map(v=>String(v).trim()).filter(v=>v);
  }

  function ensurePaymentSheet(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(PAYMENT_SHEET);
    if (!sh) {
      sh = ss.insertSheet(PAYMENT_SHEET);
      sh.getRange(1, 1, 1, 6).setValues([['호실', '금액', '담당자', '구분', '날짜', '메모']]);
    }
  }

  function ensureUsageSheet(){
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(USAGE_SHEET);
    if (!sh) {
      sh = ss.insertSheet(USAGE_SHEET);
        sh.getRange(1, 1, 1, 6).setValues([[
          '호실', '월', '전기료', '가스료', '수도료', '주차비2'  // ✅ 6열
        ]]);
        return;
      }

      // ▶ 기존 시트가 5열(또는 그 이하)인 경우 스키마 업그레이드
      if (sh.getLastColumn() < 6) {
        const add = 6 - sh.getLastColumn();
        sh.insertColumnsAfter(sh.getLastColumn(), add);
      }

      // 헤더 갱신 (열 이름 보존 + 주차비2 추가)
      const hdr = sh.getRange(1, 1, 1, 6).getValues()[0];
      if(String(hdr[5]).trim() !== '주차비2'){
        hdr[5] = '주차비2';
        sh.getRange(1,1,1,6).setValues([hdr]);
      }

      // 기존 데이터 뒷부분 0 채우기 (2행~) – 주차비2 컬럼이 비어있으면 0 넣기
      const lr = sh.getLastRow();
      if(lr > 1){
        const colF = sh.getRange(2, 6, lr - 1, 1).getValues();
        let needFill = false;
        colF.forEach(row=>{ if(row[0] === '' || row[0] === null) needFill = true; });
        if(needFill){
          sh.getRange(2, 6, lr - 1, 1).setValues(Array(lr - 1).fill([0]));
        }
    }
  }

  function runAll_Part1(){
    const startTime = Date.now();
    let ui = null; try { ui = SpreadsheetApp.getUi(); } catch(e){}
    
    try {
      ensurePaymentSheet(); 
      ensureUsageSheet();
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(DATA_SHEET);
      const paymentSh = ss.getSheetByName(PAYMENT_SHEET);
      
      // 🚀 초고속 초기화
      console.log('🔄 기존 리포트 블록 초기화 중...');
      if(sh.getLastRow() >= REPORT_BASE) {
        sh.getRange(REPORT_BASE, 1, sh.getLastRow() - REPORT_BASE + 1, sh.getLastColumn()).clear();
      }

      // 🚀 모든 데이터 미리 로드 (메모리에서 처리)
      console.log('📊 데이터 로딩 중...');
      const data = sh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 14).getValues();
      const validRooms = data.filter(rec => rec && Array.isArray(rec) && String(rec[0]).trim());
      
      // 입금 데이터도 미리 로드
      let paymentData = [];
      if (paymentSh && paymentSh.getLastRow() > 1) {
        paymentData = paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 5).getValues();
      }
      
      // 사용량 데이터도 메모리로 로드 (전기·가스·수도)
      const usageSh = ss.getSheetByName(USAGE_SHEET);
      const usageMap = {};
      if (usageSh && usageSh.getLastRow() > 1) {
        const num = v => parseFloat(String(v).replace(/[^0-9+\-.]/g, '')) || 0;
        const tz = Session.getScriptTimeZone();
          const uVals = usageSh.getRange(2, 1, usageSh.getLastRow() - 1, 6).getValues();
        uVals.forEach(r => {
          const roomId = String(r[0]).trim();
          if (!roomId) return;
          const ym = Utilities.formatDate(new Date(r[1]), tz, 'yyyy-MM');
          const key = `${roomId}|${ym}`;
            if (!usageMap[key]) usageMap[key] = { e: 0, g: 0, w: 0, p2: 0 };
          usageMap[key].e += num(r[2]);
          usageMap[key].g += num(r[3]);
          usageMap[key].w += num(r[4]);
            usageMap[key].p2 += num(r[5]);
        });
      }
      
      console.log(`📊 처리할 호실: ${validRooms.length}개, 입금데이터: ${paymentData.length}건`);
      
      // 🚀 메모리에서 모든 블록 데이터 준비
      const allBlockData = [];
      let ptr = REPORT_BASE;
      let processedCount = 0;
      
      validRooms.forEach((rec, i) => {
        try {
          const room = String(rec[0]).trim();
          const blockData = buildReportBlockInMemory(rec, ptr, paymentData, usageMap);
          allBlockData.push(...blockData);
          
          ptr += ROWS_PER_ROOM + GAP;
          processedCount++;
          
          if ((i + 1) % 20 === 0) {
            console.log(`📈 메모리 처리: ${i + 1}/${validRooms.length}`);
          }
          
        } catch (error) {
          console.error(`${String(rec[0]).trim()}호 처리 오류:`, error);
        }
      });
      
      // 🚀 한 번에 모든 데이터 쓰기 (초고속)
      console.log('💾 데이터 일괄 쓰기 중...');
      writeBlockDataToSheet(sh, allBlockData);
      
      // 최종 저장
      SpreadsheetApp.flush();
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if(ui){ ui.alert(
        '✅ 1단계 완료!', 
        `🎉 ${processedCount}개 호실 처리 완료\n⏱️ 소요시간: ${duration}초\n\n▸ 리포트 블록 재생성 (초고속)\n▸ 입금데이터 반영 (baseFix 자동 적용)`,
        ui.ButtonSet.OK
      ); }
      
      console.log(`✅ runAll_Part1 완료: ${processedCount}개 호실, ${duration}초`);
      
    } catch (error) {
      console.error('runAll_Part1 오류:', error);
      if(ui){ ui.alert('❌ 1단계 실행 오류', `오류: ${error.message}\n\n부분적으로 처리된 데이터가 있을 수 있습니다.`, ui.ButtonSet.OK); }
    }
  }


  

  function generateMonthsArray(moveIn, moveOut) {
    // ▶ 개선: moveOut 이 제공되면 "퇴실월+1"까지만 헤더를 생성하고,
    //         그렇지 않으면 기존 로직(현재월+1) 유지
    // moveIn, moveOut 은 Date 또는 null
    const tz = Session.getScriptTimeZone();
    // 입주월이 없으면 현재월 한 칸만 반환 (기존 유지)
    if (!moveIn) {
      const currentMonth = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
      return [currentMonth];
    }

    const startDate = new Date(moveIn.getFullYear(), moveIn.getMonth(), 1);

    // ── 종료 기준 계산 ───────────────────────────
    let endDate;
    const today = new Date();
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1); // 현재월 +1
    if (moveOut && moveOut instanceof Date && !isNaN(moveOut)) {
      // 퇴실월+1 (예: 5월 퇴실 → 6월까지)
      const afterOut = new Date(moveOut.getFullYear(), moveOut.getMonth() + 1, 1);
      // 실제 종료일이 과거라면 afterOut, 미래(계약 진행 중)라면 defaultEnd 유지
      endDate = afterOut < defaultEnd ? afterOut : defaultEnd;
    } else {
      endDate = defaultEnd;
    }

    const months = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      months.push(Utilities.formatDate(cur, tz, 'yyyy-MM'));
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  // onEdit 트리거 설정
  function setupOnEditTrigger() {
    const ui = SpreadsheetApp.getUi();
    
    try {
      // 기존 onEdit 트리거 삭제
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'onEdit') {
          ScriptApp.deleteTrigger(trigger);
        }
      });
      
      // 새 onEdit 트리거 생성
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      ScriptApp.newTrigger('onEdit')
        .onEdit()
        .create();
      
      ui.alert(
        '✅ onEdit 트리거 설정 완료!',
        '이제 입금데이터나 사용량데이터를 수정하면\n해당 호실의 계산블록이 즉시 업데이트됩니다.\n\n🔥 baseFix 로직도 자동 적용됩니다!',
        ui.ButtonSet.OK
      );
      
    } catch (error) {
      console.error('트리거 설정 실패:', error);
      ui.alert('❌ 트리거 설정 실패', `오류: ${error.message}`, ui.ButtonSet.OK);
    }
  }

  // 시간 기반 자동 리빌드 트리거 설정 (1시간마다)
  function setupTimeBasedTrigger() {
    const ui = SpreadsheetApp.getUi();
    
    try {
      // 기존 시간 기반 트리거 삭제
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(trigger => {
        if (trigger.getHandlerFunction() === 'autoRebuild') {
          ScriptApp.deleteTrigger(trigger);
        }
      });
      
      // 새 시간 기반 트리거 생성 (매시간)
      ScriptApp.newTrigger('autoRebuild')
        .timeBased()
        .everyHours(1)
        .create();
      
      ui.alert(
        '✅ 자동 리빌드 트리거 설정 완료!',
        '이제 매시간 자동으로 전체 데이터가 업데이트됩니다.\n\n⏰ 매시간 정각에 실행됩니다.',
        ui.ButtonSet.OK
      );
      
    } catch (error) {
      console.error('자동 리빌드 트리거 설정 실패:', error);
      ui.alert('❌ 자동 리빌드 트리거 설정 실패', `오류: ${error.message}`, ui.ButtonSet.OK);
    }
  }

  // 자동 리빌드 함수 (시간 기반 트리거용)
  function autoRebuild() {
    try {
      console.log('🕐 자동 리빌드 시작:', new Date().toLocaleString('ko-KR'));
      
      // 빠른 리빌드 실행
      runAll_Part1();
      
      console.log('✅ 자동 리빌드 완료:', new Date().toLocaleString('ko-KR'));
    } catch (error) {
      console.error('❌ 자동 리빌드 오류:', error);
    }
  }

  // ⚡ 입금데이터만 빠르게 업데이트 (1단계 후 실행)
  function runPaymentUpdateOnly() {
    const startTime = Date.now();
    let ui = null; try { ui = SpreadsheetApp.getUi(); } catch(e){}
    
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const dataSh = ss.getSheetByName(DATA_SHEET);
      
      if (!dataSh) {
        if (ui) {
          ui.alert('❌ 오류', '입주데이터 시트가 없습니다.', ui.ButtonSet.OK);
        }
        return;
      }
      
      // 호실 목록 가져오기
      const rooms = getRoomList();
      console.log(`📊 입금 업데이트할 호실: ${rooms.length}개`);
      
      let processedCount = 0;
      
      // 🚀 배치로 빠르게 처리
      for (let i = 0; i < rooms.length; i += 10) {
        const batch = rooms.slice(i, i + 10);
        
        batch.forEach(room => {
          try {
            updateReportPayment(room);
            processedCount++;
          } catch (error) {
            console.error(`${room}호 입금 업데이트 오류:`, error);
          }
        });
        
        // 10개마다 진행상황 표시
        if ((i + 10) % 30 === 0) {
          console.log(`📈 입금 업데이트: ${Math.min(i + 10, rooms.length)}/${rooms.length}`);
          SpreadsheetApp.flush();
        }
      }
      
      SpreadsheetApp.flush();
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      if(ui){ ui.alert(
        '✅ 입금 업데이트 완료!',
        `🎉 ${processedCount}개 호실 처리 완료\n⏱️ 소요시간: ${duration}초\n\n🔥 baseFix 로직이 모두 적용되었습니다.`,
        ui.ButtonSet.OK
      ); }
      
      console.log(`✅ 입금 업데이트 완료: ${processedCount}개 호실, ${duration}초`);
      
    } catch (error) {
      console.error('입금 업데이트 오류:', error);
      if(ui){ ui.alert('❌ 입금 업데이트 오류', `오류: ${error.message}`, ui.ButtonSet.OK); }
    }
  }

  // 🔧 고정비(월세·관리비·주차) 일할계산 (현재월 기준)
  function prorateCurrentMonthFixed(dataSh, start, rawIdx, header) {
    try {
      const tz = Session.getScriptTimeZone();
      const today = new Date();
      const currentYM = Utilities.formatDate(today, tz, 'yyyy-MM');
      const idx = header.indexOf(currentYM);
      if (idx === -1) return; // 현재월 열이 없으면 스킵

      const dataRowNum = DATA_START_ROW + rawIdx; // 입주데이터 행 번호
      const rentFull = parseFloat(dataSh.getRange(dataRowNum, 10).getValue()) || 0;  // 월세
      const mgmtFull = parseFloat(dataSh.getRange(dataRowNum, 11).getValue()) || 0; // 관리비
      const parkFull = parseFloat(dataSh.getRange(dataRowNum, 12).getValue()) || 0; // 주차비

      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const currentDay = today.getDate();
      const factor = currentDay / daysInMonth;

      const proratedRent  = Math.round(rentFull  * factor);
      const proratedMgmt  = Math.round(mgmtFull  * factor);
      const proratedPark  = Math.round(parkFull  * factor);

      const col = 3 + idx;
      // 월세·관리비·주차비 행은 start+4, +5, +6
        dataSh.getRange(start + IDX.RENT,  col).setValue(proratedRent).setNumberFormat('"₩"#,##0');
        dataSh.getRange(start + IDX.MGMT,  col).setValue(proratedMgmt).setNumberFormat('"₩"#,##0');
        dataSh.getRange(start + IDX.PARK,  col).setValue(proratedPark).setNumberFormat('"₩"#,##0');

        // 전기·가스·수도·주차2
        const elec = parseFloat(dataSh.getRange(start + IDX.ELEC,  col).getValue()) || 0;
        const gas  = parseFloat(dataSh.getRange(start + IDX.GAS,   col).getValue()) || 0;
        const wat  = parseFloat(dataSh.getRange(start + IDX.WATER, col).getValue()) || 0;
        const p2   = parseFloat(dataSh.getRange(start + IDX.PARK2, col).getValue()) || 0;

        const totalCharge = proratedRent + proratedMgmt + proratedPark + p2 + elec + gas + wat;
        dataSh.getRange(start + IDX.CHARGE, col).setValue(totalCharge).setNumberFormat('"₩"#,##0');

    } catch (err) {
      console.error('prorateCurrentMonthFixed 오류:', err);
    }
  }



  // 🚀 대량 입금 처리
  function processBulkPayments(validRooms) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const paymentSh = ss.getSheetByName(PAYMENT_SHEET);
    
    if (!paymentSh || paymentSh.getLastRow() <= 1) return;
    
    // 전체 입금 데이터 로드
    const paymentData = paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 5).getValues();
    const tz = Session.getScriptTimeZone();
    
    // 호실별 입금 집계
    const roomPayments = {};
    paymentData.forEach(row => {
      const room = String(row[0]).trim();
      const amount = parseFloat(row[1]) || 0;
      const type = String(row[3]).trim();
      const date = new Date(row[4]);
      const ym = Utilities.formatDate(date, tz, 'yyyy-MM');
      
      if (!roomPayments[room]) roomPayments[room] = {};
      if (!roomPayments[room][ym]) roomPayments[room][ym] = 0;
      
      if (type === '입금') {
        roomPayments[room][ym] += amount;
      }
    });
    
    // 배치로 업데이트
    validRooms.forEach((rec, index) => {
      const room = String(rec[0]).trim();
      if (roomPayments[room]) {
        updateRoomPaymentsBatch(room, roomPayments[room], index);
      }
    });
  }

  // 🚀 대량 사용량 처리
  function processBulkUsage(validRooms) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usageSh = ss.getSheetByName(USAGE_SHEET);
    
    if (!usageSh || usageSh.getLastRow() <= 1) return;
    
    // 전체 사용량 데이터 로드
      const usageData = usageSh.getRange(2, 1, usageSh.getLastRow() - 1, 6).getValues();
    const tz = Session.getScriptTimeZone();
    
    // 호실별 사용량 집계
    const roomUsage = {};
    usageData.forEach(row => {
      const room = String(row[0]).trim();
      const date = new Date(row[1]);
      const ym = Utilities.formatDate(date, tz, 'yyyy-MM');
      const elec = parseFloat(row[2]) || 0;
      const gas = parseFloat(row[3]) || 0;
      const water = parseFloat(row[4]) || 0;
        const park2 = parseFloat(row[5]) || 0;
      
      if (!roomUsage[room]) roomUsage[room] = {};
        if (!roomUsage[room][ym]) roomUsage[room][ym] = { elec: 0, gas: 0, water: 0, park2:0 };
      
      roomUsage[room][ym].elec += elec;
      roomUsage[room][ym].gas += gas;
      roomUsage[room][ym].water += water;
        roomUsage[room][ym].park2 += park2;
    });
    
    // 배치로 업데이트
    validRooms.forEach((rec, index) => {
      const room = String(rec[0]).trim();
      if (roomUsage[room]) {
        updateRoomUsageBatch(room, roomUsage[room], index);
      }
    });
  }

  // 🚀 호실별 입금 배치 업데이트
  function updateRoomPaymentsBatch(room, payments, roomIndex) {
    // 간단한 총입금액만 업데이트 (속도 우선)
    const totalPayment = Object.values(payments).reduce((sum, amt) => sum + amt, 0);
    const start = REPORT_BASE + roomIndex * (ROWS_PER_ROOM + GAP);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(DATA_SHEET);
    
    sh.getRange(start + IDX.TOTAL_PAYMENT, 3).setValue(totalPayment).setNumberFormat('"₩"#,##0');
  }

  // 🚀 호실별 사용량 배치 업데이트
  function updateRoomUsageBatch(room, usage, roomIndex) {
    const start = REPORT_BASE + roomIndex * (ROWS_PER_ROOM + GAP);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(DATA_SHEET);
    
    // 월별 사용량 업데이트 (간단히)
    Object.keys(usage).forEach(ym => {
      const header = sh.getRange(start, 3, 1, 20).getDisplayValues()[0];
      const idx = header.indexOf(ym);
      if (idx !== -1) {
        const col = 3 + idx;
        const data = usage[ym];
        
          sh.getRange(start + IDX.ELEC,  col).setValue(data.elec);   // 전기료
          sh.getRange(start + IDX.GAS,   col).setValue(data.gas);    // 가스료
          sh.getRange(start + IDX.WATER, col).setValue(data.water);  // 수도료
          sh.getRange(start + IDX.PARK2, col).setValue(data.park2||0); // 주차비2
      }
    });
  }



  // 🚀 메모리에서 블록 데이터 생성 (월별 청구·입금·미납 포함, baseFix 차감 로직)
  function buildReportBlockInMemory(rec, start, paymentData, usageMap) {
    const room    = String(rec[0]).trim();
    const num     = v => parseFloat(String(v).replace(/[^0-9+\-.]/g, '')) || 0; // 통화 문자열 → 숫자
    const moveIn  = rec[4];
    const moveOut = rec[5];
    const months  = generateMonthsArray(moveIn, moveOut);

    // ── 고정비 ─────────────────────────────────────
    const rentAmt = parseFloat(rec[9])  || 0;
    const mgmtAmt = parseFloat(rec[10]) || 0;
    const parkAmt = parseFloat(rec[11]) || 0;

    // 🔥 baseFix = 보증금 + 첫 달 고정비(월세·관리비·주차)
    const deposit  = parseFloat(rec[8]) || 0;
    const baseFix  = deposit + rentAmt + mgmtAmt + parkAmt;

    /* ───────────── 입금 집계 ───────────── */
    const tz = Session.getScriptTimeZone();
    const monthlyPayments = {};
    let totalPayment = 0;
    let totalWithdrawal = 0;

    paymentData.forEach(row => {
      if (String(row[0]).trim() !== room) return;
      const amount = num(row[1]);
      const type   = String(row[3]).trim();
      const date   = row[4];

      if (type === '입금') {
        totalPayment += amount;
        if (date) {
          const ym = Utilities.formatDate(new Date(date), tz, 'yyyy-MM');
          const key = months.includes(ym) ? ym : months[0];
          monthlyPayments[key] = (monthlyPayments[key] || 0) + amount;
        }
      } else if (type === '출금') {
        totalWithdrawal += amount;
      }
    });

    /* ───────────── baseFix 선차감 ───────────── */
    if (baseFix > 0) {
      let remain = baseFix;
      for (const ym of months) {
        if (remain <= 0) break;
        const paid = monthlyPayments[ym] || 0;
        if (paid > 0) {
          const deduct = Math.min(paid, remain);
          monthlyPayments[ym] = paid - deduct;
          remain -= deduct;
        }
      }
    }

    /* ───────────── 행별 데이터 준비 ───────────── */
    const today       = new Date();
    const currentYM   = Utilities.formatDate(today, tz, 'yyyy-MM');
    const nextYM      = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 1), tz, 'yyyy-MM');

    // 고정비 월별 일할계산 보조함수
    function prorated(full, ym) {
      if (!full) return 0;
      const afterOutYM = moveOut ? Utilities.formatDate(new Date(moveOut.getFullYear(), moveOut.getMonth() + 1, 1), tz, 'yyyy-MM') : null;
      if (afterOutYM && ym === afterOutYM) return 0;   // 퇴실 다음 달 0
      if (ym === nextYM) return 0;                     // 다음 달 0

      if (moveIn) {
        const inYM   = Utilities.formatDate(new Date(moveIn), tz, 'yyyy-MM');
        if (ym === inYM) {
          const days = new Date(moveIn.getFullYear(), moveIn.getMonth() + 1, 0).getDate();
          return Math.round(full * ((days - moveIn.getDate() + 1) / days));
        }
      }
      if (moveOut) {
        const outYM  = Utilities.formatDate(new Date(moveOut), tz, 'yyyy-MM');
        if (ym === outYM) {
          const days = new Date(moveOut.getFullYear(), moveOut.getMonth() + 1, 0).getDate();
          return Math.round(full * (moveOut.getDate() / days));
        }
      }
      if (ym === currentYM) {
        const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        return Math.round(full * (today.getDate() / days));
      }
      return full;
    }

    const rentRow = months.map(m => prorated(rentAmt, m));
    const mgmtRow = months.map(m => prorated(mgmtAmt, m));
    const parkRow = months.map(m => prorated(parkAmt, m));

    // 사용량
    const elecRow = months.map(m => (usageMap[`${room}|${m}`]?.e) || 0);
    const gasRow  = months.map(m => (usageMap[`${room}|${m}`]?.g) || 0);
    const watRow  = months.map(m => (usageMap[`${room}|${m}`]?.w) || 0);
      const p2Row   = months.map(m => (usageMap[`${room}|${m}`]?.p2) || 0);

    // 청구금액 = 고정비 + 사용량
      const chargeRow = months.map((_, i) => rentRow[i] + mgmtRow[i] + parkRow[i] + p2Row[i] + elecRow[i] + gasRow[i] + watRow[i]);

    // 입금액 (baseFix 차감 후)
    const paymentRow = months.map(m => monthlyPayments[m] || 0);

    // 전월미납 / 청구내역 / 미납금 흐름 계산
    const prevArr = [], billingRow = [], arrearsRow = [];
    let prev = 0;
    months.forEach((_, i) => {
      prevArr[i]   = prev;
      billingRow[i]= i === 0 ? 0 : chargeRow[i - 1] + prev;
      arrearsRow[i]= billingRow[i] - paymentRow[i];
      prev = arrearsRow[i];
    });

    /* ───────────── 합계 계산 ───────────── */
    const totalArrears   = arrearsRow[arrearsRow.length - 1];
    const totalChargeSum = chargeRow.reduce((a, b) => a + b, 0);
    const netPayment     = totalPayment - totalWithdrawal; // 참고용
    const remainAmount   = totalPayment - totalChargeSum;   // 잔여금(보증금 포함)

    /* ───────────── 블록 빌드 ───────────── */
    const headerRow = [room, '', ...months];
    const items = [
      { label: '전월미납금', data: prevArr },
      { label: '전기료',     data: elecRow },
      { label: '가스료',     data: gasRow },
      { label: '수도료',     data: watRow },
        { label: '주차비2',    data: p2Row },
      { label: '월세',       data: rentRow },
      { label: '관리비',     data: mgmtRow },
      { label: '주차비',     data: parkRow },
      { label: '청구금액',   data: chargeRow },
      { label: '청구내역',   data: billingRow },
      { label: '입금액',     data: paymentRow },
      { label: '미납금',     data: arrearsRow },
      { label: '총미납금',  data: [totalArrears] },
      { label: '남은금액',   data: [remainAmount] },
      { label: '총입금액',  data: [totalPayment] },
      { label: '총청구내역', data: [totalChargeSum] }
    ];

    const blockData = [ { row: start, col: 1, data: headerRow, merge: true } ];
    items.forEach((it, idx) => {
      const rowArr = ['', it.label, ...it.data];
      while (rowArr.length < headerRow.length) rowArr.push('');
      blockData.push({ row: start + idx + 1, col: 1, data: rowArr });
    });

    return blockData;
  }

  // 🚀 대량 블록 데이터를 시트에 일괄 기록 (머지 포함)
  function writeBlockDataToSheet(sh, allBlockData) {
    const currencyFmt   = '"₩"#,##0';
    const mergeRanges   = [];
    const numericRanges = [];
    const billingRanges = [];
    const paymentRanges = [];
  
    let offsetInBlock = -1;     // 0~14
  
    allBlockData.forEach(({ row, col, data }) => {
      const rowData = Array.isArray(data[0]) ? data : [data];
      const colCnt  = rowData[0].length;
      sh.getRange(row, col, 1, colCnt).setValues(rowData);
  
      // 새 블록 시작(A열 값이 있는 행)
      if (rowData[0][0]) {
        offsetInBlock = 0;
        mergeRanges.push(sh.getRange(row, 1, ROWS_PER_ROOM, 1));
      } else {
        offsetInBlock++;
      }
  
      // ✅ 전월미납금(1)~총입금(14) 행을 모두 서식 대상에 포함
      if (offsetInBlock >= IDX.PREV_ARREARS && offsetInBlock <= IDX.TOTAL_CHARGE && colCnt > 2) {
        numericRanges.push(sh.getRange(row, 3, 1, colCnt - 2));
      }

      // ▶ 색상용 별도 수집
      if (offsetInBlock === IDX.BILLING && colCnt > 2) {
        billingRanges.push(sh.getRange(row, 3, 1, colCnt - 2));
      }
      if (offsetInBlock === IDX.PAYMENT && colCnt > 2) {
        paymentRanges.push(sh.getRange(row, 3, 1, colCnt - 2));
      }
    });
  
    // A열 15행 병합
    mergeRanges.forEach(r => {
      try { r.mergeVertically().setHorizontalAlignment('center').setVerticalAlignment('middle'); } catch(e){}
    });
  
    // 통화 서식 적용
    numericRanges.forEach(r => {
      try { r.setNumberFormat(currencyFmt).setHorizontalAlignment('right'); } catch(e){}
    });

    // 색상 스타일 적용
    billingRanges.forEach(r => {
      try { r.setFontColor('#b91c1c').setFontWeight('bold'); } catch(e){}
    });
    paymentRanges.forEach(r => {
      try { r.setFontColor('#1e40af').setFontWeight('bold'); } catch(e){}
    });
  }

  // Add wrapper at global scope




  // 🏎️ 초고속 관리비내역 시트 생성
  function createFastMgmtHistorySheet(){
    let ui=null; try{ ui = SpreadsheetApp.getUi(); }catch(e){}
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    if(!dataSh){ if(ui){ ui.alert('입주데이터 시트가 없습니다.'); } return; }

    // ---- 시트 준비 ----
    // ① 기존 '관리비내역' 시트가 있으면 내용만 초기화해서 재사용
    // ② 없으면 새로 추가
    let mgmtSh = ss.getSheetByName('관리비내역');
    if(mgmtSh){
      try{
        // 시트 보호 해제
        mgmtSh.getProtections(SpreadsheetApp.ProtectionType.SHEET)
              .forEach(p=>{ try{p.remove();}catch(_e){} });
        mgmtSh.clear();
      }catch(e){
        console.log('clear 실패',e);
      }
    }else{
      mgmtSh = ss.insertSheet('관리비내역');
    }
    // ③ 이름이 '관리비내역'이 아닌 시트(과거 실패하여 남은 _2 등)는 모두 삭제
    ss.getSheets().forEach(s => {
      const n = s.getName();
      if(/^관리비내역_/.test(n)){
        try{ ss.deleteSheet(s);}catch(e){ console.log('old sheet 삭제 실패',n,e); }
      }
    });

    // ↳ 301호~1606호 범위만, 숫자 오름차순 정렬
    const rooms = Array.from(
                      new Set(
                        getRoomList()
                            .filter(r => {
                              const n = parseInt(r, 10);
                              return !isNaN(n) && n >= 301 && n <= 1606;
                            })
                      )
                    ).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    
    // 전체 호실의 모든 월 헤더 수집
    const allMonthsSet = new Set();
    const roomDataMap = new Map();
    
    const allRows = [];
    const mergeInfo = [];
    const tz = Session.getScriptTimeZone();

    // 1단계: 모든 호실의 헤더 수집
    rooms.forEach(room => {
      const colA = dataSh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1).getValues().flat().map(v=>String(v).trim());
      const rawIdx = colA.indexOf(room);
      if(rawIdx<0) return;
      const blkIdx = colA.filter(v=>v).indexOf(room);
      const start = REPORT_BASE + blkIdx*(ROWS_PER_ROOM+GAP);

      const headerRow = dataSh.getRange(start,3,1,dataSh.getLastColumn()-2).getDisplayValues()[0];
      const header = headerRow.map(c => String(c).replace(/[\.\u2010-\u2015]/g, '-').trim())
                              .filter(h => /^\d{4}-\d{2}$/.test(h)); // YYYY-MM 형식만 필터링
      
      if (header.length === 0) return; // 헤더가 없으면 건너뜀
      
      // 모든 월을 전역 집합에 추가
      header.forEach(month => allMonthsSet.add(month));
      
      // 호실별 데이터 저장
      const headerIndices = [];
      headerRow.forEach((h, idx) => {
        const cleanH = String(h).replace(/[\.\u2010-\u2015]/g, '-').trim();
        if (/^\d{4}-\d{2}$/.test(cleanH)) {
          headerIndices.push({month: cleanH, index: idx});
        }
      });
      
      const fullBillArr = dataSh.getRange(start + IDX.BILLING, 3, 1, headerRow.length).getValues()[0];
      const fullPayArr  = dataSh.getRange(start + IDX.PAYMENT, 3, 1, headerRow.length).getValues()[0];
      const fullSumArr  = dataSh.getRange(start + IDX.ARREARS, 3, 1, headerRow.length).getValues()[0];
      
      const moveInCell = dataSh.getRange(DATA_START_ROW+rawIdx,5).getValue(); // E열 입주일
      let moveYM;
      if (moveInCell instanceof Date && !isNaN(moveInCell) && moveInCell.getFullYear()>1900){
        moveYM = Utilities.formatDate(moveInCell,tz,'yyyy-MM');
      } else {
        moveYM = header[0]; // fallback to 첫 헤더 월
      }
      
      roomDataMap.set(room, {
        moveYM: moveYM,
        headerIndices: headerIndices,
        billArr: fullBillArr,
        payArr: fullPayArr,
        sumArr: fullSumArr
      });
    });
    
    // 2단계: 통합된 헤더 생성 (시간순 정렬)
    const unifiedHeader = Array.from(allMonthsSet).sort();
    
    // 3단계: 통합된 헤더를 기준으로 각 호실 데이터 생성
    rooms.forEach(room => {
      const roomData = roomDataMap.get(room);
      if (!roomData) return;
      
      // 통합 헤더에 맞춰 데이터 배열 생성
      const billArr = [];
      const payArr = [];
      const sumArr = [];
      
      unifiedHeader.forEach(month => {
        const headerIndex = roomData.headerIndices.find(hi => hi.month === month);
        if (headerIndex) {
          billArr.push(roomData.billArr[headerIndex.index] || 0);
          payArr.push(roomData.payArr[headerIndex.index] || 0);
          sumArr.push(roomData.sumArr[headerIndex.index] || 0);
        } else {
          billArr.push(0);
          payArr.push(0);
          sumArr.push(0);
        }
      });

      // 빈 행 삽입 (블록 간 구분) – 첫 블록 제외
      if(allRows.length > 0){
        allRows.push([]);
      }

      const blockStart = allRows.length + 1; // header row index after 가능성있는 빈 줄

      allRows.push(
        [room, `${roomData.moveYM}입주`, ...unifiedHeader],
        ['',   '청구내역',       ...billArr],
        ['',   '입금금액',       ...payArr],
        ['',   '합계',           ...sumArr]
      );
      mergeInfo.push(blockStart); // record where to merge A column (4 rows)
    });

    // 데이터가 없으면 종료 (예: 필터 결과 0개)
    if (allRows.length === 0) {
      console.warn('createFastMgmtHistorySheet: 작성할 행이 없습니다.');
      return;
    }

    // Padding columns
    const maxCols = Math.max(...allRows.map(r=>r.length));
    allRows.forEach(r => { while(r.length < maxCols) r.push(''); });

    // Bulk write
    mgmtSh.getRange(1,1,allRows.length,maxCols).setValues(allRows);

    // Formatting
    mergeInfo.forEach(r => {
      mgmtSh.getRange(r,1,4,1).merge()
            .setHorizontalAlignment('center')
            .setVerticalAlignment('middle')
            .setFontWeight('bold');
    });

    // Bold header row inside each block (B열 입주 텍스트)
    mergeInfo.forEach(r => {
      mgmtSh.getRange(r,2).setFontWeight('bold');
      mgmtSh.getRange(r,3,1,maxCols-2).setFontWeight('bold');
    });

    // 통화 형식: 각 블록의 청구/입금/합계 3행에만 적용 (헤더 제외)
    mergeInfo.forEach(r => {
      if(maxCols>2){
        mgmtSh.getRange(r+1,3,3,maxCols-2).setNumberFormat('"₩"#,##0');
      }
    });

    if(ui){ ui.alert(`✅ 관리비내역(초고속) 시트 생성 완료! (${rooms.length}개 호실)`); }
  }

  // 🚀 전체 리빌드: 입주데이터 블록 + 미수금내역 + 관리비내역을 한 번에 생성
  function rebuildAllFast(){
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('🚀 전체 리빌드', '초고속으로 3개 시트를 모두 다시 생성합니다. 계속하시겠습니까?', ui.ButtonSet.YES_NO);
    if(resp !== ui.Button.YES) return;
    const start = Date.now();
    try{
      runAll_Part1();                 // 입주데이터 블록 + 입금/사용량 반영
      createFastMisugumSheet();       // 미수금내역(초고속)
      createFastMgmtHistorySheet();   // 관리비내역(초고속)
      const sec = Math.round((Date.now()-start)/1000);
      ui.alert('✅ 전체 리빌드 완료', `소요: ${sec}초`, ui.ButtonSet.OK);
    }catch(e){
      console.error('rebuildAllFast 오류', e);
      ui.alert('❌ 오류', e.message, ui.ButtonSet.OK);
    }
  }

  // 🚀 호실별 빠른 리빌드 (입주데이터 블록+미수금+관리비)
  function rebuildRoomFastPrompt(){
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt('호실 리빌드','리빌드할 호실 번호(예: 401)를 입력하세요:', ui.ButtonSet.OK_CANCEL);
    if(resp.getSelectedButton()!==ui.Button.OK) return;
    const room = resp.getResponseText().trim();
    if(!room){ ui.alert('호실을 입력하지 않았습니다.'); return; }
    rebuildRoomFast(room);
  }

  function rebuildRoomFast(room){
    const ui = SpreadsheetApp.getUi();
    const start = Date.now();
    try{
      // 입주데이터 블록 업데이트 (고정비/사용량 포함)
      updateReportPayment(room);

      // 미수금/관리비 시트는 전체 재생성 (속도 충분히 빠름)
      createFastMisugumSheet();
      createFastMgmtHistorySheet();

      const sec=Math.round((Date.now()-start)/1000);
      ui.alert(`✅ ${room}호 리빌드 완료`, `소요 ${sec}초`, ui.ButtonSet.OK);
    }catch(e){
      console.error('rebuildRoomFast 오류',e);
      ui.alert('❌ 오류',e.message,ui.ButtonSet.OK);
    }
  }

  // 📱 PC(데스크톱)에서도 index.html 을 사이드바로 띄우기
  function showMainSidebar() {
      // 🗑️ Desktop sidebar disabled in PWA mode
      return;
  }

  /* === 사용량 === */
  function addUsagesBulk(entries){
    if(!Array.isArray(entries)||entries.length===0) return {success:false,message:'파라미터 오류'};
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    ensureUsageSheet();
    const sh=ss.getSheetByName(USAGE_SHEET);
    const rows=entries.map(e=>[
      String(e.room||'').trim(),
      e.month? new Date(e.month+'-01'): new Date(),
      parseFloat(e.electric)||0,
      parseFloat(e.gas)||0,
        parseFloat(e.water)||0,
        parseFloat(e.park2)||0
    ]);
    sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
    if(entries.length===1){
      const ym = Utilities.formatDate(rows[0][1], Session.getScriptTimeZone(), 'yyyy-MM');
      updateReportUsage(rows[0][0], ym, true);
      rebuildRoomApi(rows[0][0]); // UI 없는 안전한 버전 사용
    }else{
      rebuildAllSync(); // UI 없는 안전한 버전 사용
    }
    return {success:true, added:entries.length};
  }

  function getUsagesByRoom(room){
    room=String(room||'').trim(); if(!room) return [];
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const sh=ss.getSheetByName(USAGE_SHEET); if(!sh||sh.getLastRow()<2) return [];
      const data=sh.getRange(2,1,sh.getLastRow()-1,6).getValues();
    const tz=Session.getScriptTimeZone();
    const res=[];
    data.forEach((r,i)=>{
      if(String(r[0]).trim()===room){
        res.push({
          row:i+2,
          room:r[0],
          month:Utilities.formatDate(new Date(r[1]), tz, 'yyyy-MM'),
          electric:r[2],
          gas:r[3],
            water:r[4],
            park2:r[5]
        });
      }
    });
    return res;
  }

  function updateUsageRow(row,newData){
    row=parseInt(row); if(row<2) return {success:false};
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const sh=ss.getSheetByName(USAGE_SHEET); if(!sh||row>sh.getLastRow()) return {success:false};
    const vals=[
      newData.room || sh.getRange(row,1).getValue(),
      newData.month? new Date(newData.month+'-01') : sh.getRange(row,2).getValue(),
      parseFloat(newData.electric)||0,
      parseFloat(newData.gas)||0,
        parseFloat(newData.water)||0,
        parseFloat(newData.park2)||0
    ];
      sh.getRange(row,1,1,6).setValues([vals]);
    const ym = Utilities.formatDate(vals[1], Session.getScriptTimeZone(), 'yyyy-MM');
    updateReportUsage(vals[0], ym, true);
    rebuildRoomApi(vals[0]); // UI 없는 안전한 버전 사용
    return {success:true};
  }

  function deleteUsageRows(rows){
    if(!Array.isArray(rows)||rows.length===0) return {success:false};
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    const sh=ss.getSheetByName(USAGE_SHEET); if(!sh) return {success:false};
    rows.sort((a,b)=>b-a).forEach(r=>{ if(r>=2 && r<=sh.getLastRow()) sh.deleteRow(r); });
    if(rows.length===1){
      rebuildAllSync(); // UI 없는 안전한 버전 사용 (특정 호실 알 수 없으므로 전체)
    }else{
      rebuildAllSync(); // UI 없는 안전한 버전 사용
    }
    return {success:true,deleted:rows.length};
  }

  /* ───────────── 🏠 입주 / 퇴실 관리 ───────────── */

  // 입주 등록 (신규 / 재입주)
  function addTenantInfo(obj){
    try{
      const room   = String(obj.room||'').trim();
      const name   = String(obj.name||'').trim();
      const contact= String(obj.contact||'').trim();
      const contractDate = obj.contractDate ? new Date(obj.contractDate) : '';
      const moveIn = obj.date ? new Date(obj.date) : new Date();
      const term   = obj.term ? obj.term : '';
      const deposit= parseFloat(obj.deposit)||0;
      const rent   = parseFloat(obj.rent)||0;
      const mgmt   = parseFloat(obj.mgmt)||0;
      const park   = parseFloat(obj.park)||0;
      const remark = String(obj.remark||'');
      if(!room||!name){ return {success:false, message:'호실/성함 필수'}; }

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(DATA_SHEET);
      if(!sh) return {success:false,message:'입주데이터 시트 없음'};

      const colA = sh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1).getValues().flat().map(v=>String(v).trim());
      let rawIdx = colA.indexOf(room);
      if(rawIdx<0){
        // 비어있는 행 찾기
        rawIdx = colA.findIndex(v=>!v);
        if(rawIdx<0) return {success:false,message:'빈 행이 없습니다.'};
      }
      const rowNum = DATA_START_ROW + rawIdx;

      // 한 번에 기록 (A~N 열)
      const rowArr = Array(14).fill('');
      rowArr[0]  = room;           // A 호실
      rowArr[1]  = name;           // B 성함
      rowArr[2]  = contact;        // C 연락처
      rowArr[3]  = contractDate;   // D 계약일
      rowArr[4]  = moveIn;         // E 입주일
      rowArr[5]  = '';             // F 퇴실일
      rowArr[6]  = term;           // G 계약기간
      rowArr[7]  = '';             // H 담당자(공백)
      rowArr[8]  = deposit;        // I 보증금
      rowArr[9]  = rent;           // J 월세
      rowArr[10] = mgmt;           // K 관리비
      rowArr[11] = park;           // L 주차비
      rowArr[12] = '';             // M 주차 여부
      rowArr[13] = remark;         // N 특이사항

      sh.getRange(rowNum,1,1,14).setValues([rowArr]);

      // 서식 지정
      if(contractDate) sh.getRange(rowNum,4).setNumberFormat('yyyy-MM-dd');
      sh.getRange(rowNum,5).setNumberFormat('yyyy-MM-dd');
      sh.getRange(rowNum,9,1,4).setNumberFormat('"₩"#,##0');

      // 자동 리빌드 생략 (원할 때 UI에서 새로고침)
      return {success:true,message:`${room}호 입주 정보 등록 완료`};
    }catch(e){
      console.error('addTenantInfo 오류',e);
      return {success:false,message:e.toString()};
    }
  }

  // 퇴실 처리: 이름·연락처·금액정보 지우고 퇴실일 기록
  function removeTenantInfo(room, outDate){
    room = String(room||'').trim();
    // UI 확인은 클라이언트 측에서 수행하므로 서버에서는 바로 처리합니다.

    try{
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sh = ss.getSheetByName(DATA_SHEET);
        if(!sh) return {success:false,message:'입주데이터 시트 없음'};
        const colA = sh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1).getValues().flat().map(v=>String(v).trim());
        const rawIdx = colA.indexOf(room);
        if(rawIdx<0) return {success:false,message:'해당 호실을 찾을 수 없습니다'};
        const rowNum = DATA_START_ROW + rawIdx;

        // 성함을 "공실" 로, 나머지 데이터 초기화
        sh.getRange(rowNum,2).setValue('공실'); // B 성함
        sh.getRange(rowNum,3,1,12).clearContent(); // C~N 초기화
        sh.getRange(rowNum,6).setValue(outDate? new Date(outDate): new Date()).setNumberFormat('yyyy-MM-dd'); // F 퇴실일

        // ── 입금·사용량 데이터 삭제 ──
        let paymentsDeleted = 0, usagesDeleted = 0;
        // 입금 시트
        const paySh = ss.getSheetByName(PAYMENT_SHEET);
        if(paySh && paySh.getLastRow()>1){
          const vals = paySh.getRange(2,1,paySh.getLastRow()-1,1).getValues();
          for(let i=vals.length-1;i>=0;i--){
            if(String(vals[i][0]).trim() === room){ paySh.deleteRow(i+2); paymentsDeleted++; }
          }
        }
        // 사용량 시트
        const usageSh = ss.getSheetByName(USAGE_SHEET);
        if(usageSh && usageSh.getLastRow()>1){
          const vals = usageSh.getRange(2,1,usageSh.getLastRow()-1,1).getValues();
          for(let i=vals.length-1;i>=0;i--){
            if(String(vals[i][0]).trim() === room){ usageSh.deleteRow(i+2); usagesDeleted++; }
          }
        }

        return {success:true,message:`${room}호 퇴실 완료 (입금 ${paymentsDeleted}건, 사용량 ${usagesDeleted}건 삭제)`};

    }catch(e){
        console.error('removeTenantInfo 오류',e);
        return {success:false,message:e.toString()};
    }
  }



// 📊 대시보드용 요약 통계
function getSummaryStats(){
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    if(!dataSh) return {};
    const rooms = getRoomList();

    let totalUnpaid = 0;
    let vacant = 0;
    const today = new Date();
    let expiring = 0;

    rooms.forEach((room, idx)=>{
      // 공실 판정: 성함(B열)에 '공실' 문구가 포함된 경우만
      const rawIdx = dataSh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1)
                        .getValues().flat().indexOf(room);
      if(rawIdx < 0) return;
      const rowNum  = DATA_START_ROW + rawIdx;
      const nameVal = String(dataSh.getRange(rowNum, 2).getValue()).trim();
      if(nameVal.includes('공실')) vacant++;

      // 계약만료 계산 (계약일 D + 기간 G)
      const contractDate = dataSh.getRange(rowNum,4).getValue();
      const termMonths = parseInt(dataSh.getRange(rowNum,7).getValue())||0;
      if(contractDate instanceof Date && termMonths>0){
        const expDate = new Date(contractDate);
        expDate.setMonth(expDate.getMonth()+termMonths);
        const diff = (expDate - today)/(1000*60*60*24);
        if(diff>=0 && diff<=30) expiring++;
      }

      // 총 미수금은 보고서 블록에서 읽기
      const blkIdx = rooms.filter(r=>r).indexOf(room);
      const start = REPORT_BASE + blkIdx*(ROWS_PER_ROOM+GAP);
      const unpaid = parseFloat(dataSh.getRange(start+IDX.TOTAL_ARREARS,3).getValue())||0;
      totalUnpaid += unpaid;
    });

    return {totalUnpaid:totalUnpaid, vacant:vacant, expiring:expiring};
  }catch(e){
    console.error('getSummaryStats 오류',e);
    return {totalUnpaid:0,vacant:0,expiring:0};
  }
} 

// 공실 리스트
function getVacantRooms(){
  const res = [];
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(DATA_SHEET);
    if(!sh) return res;

    const records = sh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 2).getValues();
    records.forEach(row => {
      const room = String(row[0]).trim();
      const name = String(row[1]).trim();
      if(room && name.includes('공실')){
        res.push({room: room, note: '공실'});
      }
    });
  }catch(e){ console.error(e); }
  return res;
}



// 📄 관리비 내역 데이터 반환 (전체 행 displayValues)
function getMgmtHistory(){
  try{
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh   = ss.getSheetByName('관리비내역');

    // 시트가 없으면 우선 생성 (초고속 버전)
    if(!sh){
      createFastMgmtHistorySheet();
      sh = ss.getSheetByName('관리비내역');
      if(!sh) return []; // 생성 실패 시 빈 배열
    }

    const data = sh.getDataRange().getDisplayValues();
    return data;

  }catch(e){
    console.error('getMgmtHistory 오류', e);
    return [];
  }
}

// 📄 특정 호실 관리비 내역 반환 (헤더 + 4행 블록)
function getMgmtHistoryByRoom(room){
  try{
    room = String(room).trim();
    if(!room) return [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh   = ss.getSheetByName('관리비내역');

    // 시트가 없으면 우선 생성
    if(!sh){
      createFastMgmtHistorySheet();
      sh = ss.getSheetByName('관리비내역');
      if(!sh) return [];
    }

    const data = sh.getDataRange().getDisplayValues();
    const header = data[0] || [];
    for(let i=1;i<data.length;i++){
      if(String(data[i][0]).trim() === room){
        const block = data.slice(i, i+4);
        return [header, ...block];
      }
    }
    return [];

  }catch(e){
    console.error('getMgmtHistoryByRoom 오류', e);
    return [];
  }
}

function getDelinquentRooms(windowMonths){
  try{
    windowMonths=parseInt(windowMonths)||2; // default 2 months window
    const ss=SpreadsheetApp.getActive();
    const sh=ss.getSheetByName(DATA_SHEET);
    const tz=Session.getScriptTimeZone();
    const monthsArr=[];
    for(let i=0;i<windowMonths;i++){
      const d=new Date();
      d.setMonth(d.getMonth()-i);
      monthsArr.push(Utilities.formatDate(d,tz,'yyyy-MM'));
    }

    const rooms=getRoomList();
    const res=[];
    rooms.forEach(room=>{
        const idx=rooms.indexOf(room);
        const start=REPORT_BASE+idx*(ROWS_PER_ROOM+GAP);
        const header=sh.getRange(start,3,1,sh.getLastColumn()-2).getDisplayValues()[0].map(h=>String(h).trim());
        const arrears=sh.getRange(start+IDX.ARREARS,3,1,header.length).getValues()[0];
        let flag=false;
        monthsArr.forEach(m=>{
           const c=header.indexOf(m);
           if(c>-1 && (parseFloat(arrears[c])||0)>0) flag=true;
        });
        if(flag){
          const dataRow=DATA_START_ROW+idx;
          res.push({
            room:room,
            name:String(sh.getRange(dataRow,2).getValue()).trim(),
            contact:String(sh.getRange(dataRow,3).getDisplayValue()).trim(),
            unpaid:parseFloat(sh.getRange(start+IDX.TOTAL_ARREARS,3).getValue())||0,
            months:windowMonths
          });
        }
    });
    return res;
  }catch(e){console.error('getDelinquentRooms 오류',e);return[];}
}



  // === 디버그: 입금액·baseFix 매칭 확인 ===
  function debugPaymentLogic(room){
    room = String(room||'').trim();
    if(!room) return;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const paymentSh = ss.getSheetByName(PAYMENT_SHEET);
    if(!dataSh||!paymentSh) return;
    const colA = dataSh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1).getValues().flat().map(v=>String(v).trim());
    const rawIdx = colA.indexOf(room);
    if(rawIdx<0) return;
    const blkIdx = colA.filter(v=>v).indexOf(room);
    const start = REPORT_BASE + blkIdx*(ROWS_PER_ROOM+GAP);

    // 헤더
    const headerRaw = dataSh.getRange(start,3,1,dataSh.getLastColumn()-2).getDisplayValues()[0]
                       .map(c=>String(c).replace(/[\.\u2010-\u2015]/g,'-').trim());
    const header = headerRaw.filter(h=>/^\d{4}-\d{2}$/.test(h));

    // payment 집계
    const tz = Session.getScriptTimeZone();
    const paymentData = paymentSh.getRange(2,1,Math.max(1,paymentSh.getLastRow()-1),5).getValues();
    const mp = {};
    let total=0;
    paymentData.forEach(r=>{
      if(String(r[0]).trim()===room && String(r[3]).trim()==='입금'){
        total+=parseFloat(r[1])||0; const ym=Utilities.formatDate(new Date(r[4]),tz,'yyyy-MM');
        mp[ym]=(mp[ym]||0)+parseFloat(r[1])||0;
      }
    });

    // baseFix
    const rowData = dataSh.getRange(DATA_START_ROW+rawIdx,1,1,14).getValues()[0];
    const baseFix = (parseFloat(rowData[8])||0)+(parseFloat(rowData[9])||0)+(parseFloat(rowData[10])||0)+(parseFloat(rowData[11])||0);

    // 차감 시뮬레이션
    const mpAfter={...mp}; let remain=baseFix;
    header.forEach(ym=>{ if(remain<=0) return; const paid=mpAfter[ym]||0; if(paid>0){ const d=Math.min(paid,remain); mpAfter[ym]=paid-d; remain-=d;} });

    Logger.log('ROOM %s',room);
    Logger.log('HEADER: %s',JSON.stringify(header));
    Logger.log('MonthlyPayments(before): %s',JSON.stringify(mp));
    Logger.log('baseFix: %s',baseFix);
    Logger.log('MonthlyPayments(after): %s',JSON.stringify(mpAfter));
    Logger.log('remain after deduction: %s',remain);
  }

  // 🔍 관리비 내역 – 미납 구간별 필터링 (1달 / 2달)
  function getDelinquentMgmtHistory(windowMonths){
    try{
      windowMonths = parseInt(windowMonths)||1; // 1 or 2
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let sh   = ss.getSheetByName('관리비내역');
      if(!sh){          // 시트 없으면 우선 생성
        createFastMgmtHistorySheet();
        sh = ss.getSheetByName('관리비내역');
        if(!sh) return [];
      }

      const data = sh.getDataRange().getDisplayValues();
      if(data.length===0) return [];

      // ① 대상 월 배열 계산 (현재월 기준)
      const tz = Session.getScriptTimeZone();
      const today = new Date();
      const monthsArr = [];
      const startOffset = (windowMonths===1)? -1 : -2; // 1달 이상 ➜ -1~+1, 2달 이상 ➜ -2~+1
      for(let i=startOffset;i<=1;i++){
        const d = new Date(today.getFullYear(), today.getMonth()+i, 1);
        monthsArr.push(Utilities.formatDate(d, tz, 'yyyy-MM'));
      }

      const result = [];

      // ② 블록 단위로 순회 (4행씩)
      for(let i=0;i<data.length;i++){
        const row = data[i];
        if(row[1] && row[1].toString().includes('입주')){
          const block = data.slice(i, i+4);          // [입주, 청구내역, 입금금액, 합계]
          if(block.length<4) break;

          // 헤더 행에서 대상 월 열(index) 찾기
          const headerRow = block[0];
          const monthIdxList = [];
          headerRow.forEach((v, idx)=>{
            if(idx>=2 && monthsArr.includes(String(v).trim())) monthIdxList.push(idx);
          });
          if(monthIdxList.length===0){ i+=3; continue; } // 대상 월 없음 ➜ skip

          // 합계 행에서 미납 개월수 파악 (0보다 큰 셀)
          const sumRow = block[3];
          let unpaidCnt = 0;
          monthIdxList.forEach(idx=>{
            const num = parseFloat(String(sumRow[idx]).replace(/[^0-9\-]/g,''))||0;
            if(num>0) unpaidCnt++;
          });
          if(unpaidCnt < windowMonths){ i+=3; continue; } // 조건 불충족 ➜ skip

          // ③ 결과용 행 생성 (고정 열 0,1 + 대상 월 열만 보존)
          const pick = (r)=>{
            const arr = [r[0], r[1]];
            monthIdxList.forEach(idx=> arr.push(r[idx]));
            return arr;
          };
          result.push(pick(block[0]));
          result.push(pick(block[1]));
          result.push(pick(block[2]));
          result.push(pick(block[3]));
          result.push([]); // 블록 간 빈 행

          i += 3; // 추가로 3줄 건너뜀 (for 루프에서 +1 보정)
        }
      }

      return result;

    }catch(e){
      console.error('getDelinquentMgmtHistory 오류', e);
      return [];
    }
  }

  function updateTotalAmounts(dataSh, start, header){
    try{
      const n = header.length;
      // 총미납금 = 마지막 arrears
      const lastArr = parseFloat(dataSh.getRange(start + IDX.ARREARS, 2 + n).getValue())||0;
      dataSh.getRange(start + IDX.TOTAL_ARREARS, 3).setValue(lastArr).setNumberFormat('"₩"#,##0');
      // 총입금 & 총청구는 이미 계산, 잔여금 = 총청구 - 총입금
      const totalCharge = header.reduce((sum,_,i)=> sum + (parseFloat(dataSh.getRange(start + IDX.CHARGE, 3+i).getValue())||0),0);
      const totalPay    = parseFloat(dataSh.getRange(start + IDX.TOTAL_PAYMENT,3).getValue())||0;
      const remain = totalPay - totalCharge;
      dataSh.getRange(start + IDX.REMAIN, 3).setValue(remain).setNumberFormat('"₩"#,##0');
      // ▶ 총청구내역 행 채우기
      dataSh.getRange(start + IDX.TOTAL_CHARGE, 3).setValue(totalCharge).setNumberFormat('"₩"#,##0');
    }catch(e){ console.error('updateTotalAmounts 오류',e);} }

  // 📑 호실별 정산 요약 반환 (퇴실 정산용)
  function getSettlementSummary(params){
    try{
      if(typeof params==='string') params={room:params};
      const room = String((params.room||'').trim());
      if(!room) return {success:false,msg:'room required'};

      const ss      = SpreadsheetApp.getActiveSpreadsheet();
      const dataSh  = ss.getSheetByName(DATA_SHEET);
      const paySh   = ss.getSheetByName(PAYMENT_SHEET);
      const usageSh = ss.getSheetByName(USAGE_SHEET);
      if(!dataSh) return {success:false,msg:'data sheet missing'};

      const colA=dataSh.getRange(DATA_START_ROW,1,DATA_END_ROW-DATA_START_ROW+1,1).getValues().flat().map(String);
      const rawIdx=colA.indexOf(room);
      if(rawIdx<0) return {success:false,msg:'room not found'};
      const blkIdx=colA.filter(v=>v).indexOf(room);
      const start =REPORT_BASE+blkIdx*(ROWS_PER_ROOM+GAP);

      const rowVals=dataSh.getRange(DATA_START_ROW+rawIdx,1,1,14).getValues()[0];
      const profile={
        room:room,name:rowVals[1]||'',contact:rowVals[2]||'',
        moveIn:rowVals[4]||null,moveOut:rowVals[5]||null,
        deposit:+rowVals[8]||0,rent:+rowVals[9]||0,
        mgmt:+rowVals[10]||0,park:+rowVals[11]||0,
        remark:rowVals[13]||''
      };
      
      // 매개변수로 전달된 퇴실일이 있으면 프로필 업데이트
      if (params.moveOut) {
        profile.moveOut = new Date(params.moveOut);
      }

        const moveInActual = profile.moveIn ? new Date(profile.moveIn) : null;   // 최초 입주일
        const moveInCalc   = params.moveIn ? new Date(params.moveIn) : moveInActual; // 사용자가 입력한 시작일
      let moveOut = params.moveOut? new Date(params.moveOut) : (profile.moveOut? new Date(profile.moveOut):new Date());

        const months = generateMonthsArray(moveInCalc, moveOut);
      const tz = Session.getScriptTimeZone();

      // ── 사용량 집계 ──
      const uMap={}, num=v=>parseFloat(String(v).replace(/[^0-9+\-.]/g,''))||0;
      if(usageSh&&usageSh.getLastRow()>1){
          // A:호실, B:월, C:전기, D:가스, E:수도, F:주차비2 → 총 6열 로드
          usageSh.getRange(2,1,usageSh.getLastRow()-1,6).getValues().forEach(r=>{
          if(String(r[0]).trim()!==room) return;
          const ym=Utilities.formatDate(new Date(r[1]),tz,'yyyy-MM');
            if(!uMap[ym]) uMap[ym]={e:0,g:0,w:0,p2:0};
            uMap[ym].e+=num(r[2]);
            uMap[ym].g+=num(r[3]);
            uMap[ym].w+=num(r[4]);
            uMap[ym].p2+=num(r[5]);
          });
        }
        const elec    = months.map(ym=>uMap[ym]?uMap[ym].e:0);
        const gas     = months.map(ym=>uMap[ym]?uMap[ym].g:0);
        const water   = months.map(ym=>uMap[ym]?uMap[ym].w:0);
        const park2Arr= months.map(ym=>uMap[ym]?uMap[ym].p2:0);

      // ── 입금 집계 ──
      const mpay={};
      if(paySh&&paySh.getLastRow()>1){
        paySh.getRange(2,1,paySh.getLastRow()-1,5).getValues().forEach(r=>{
            if(String(r[0]).trim()!==room) return;
            const type=String(r[3]).trim();
            if(type && type !== '입금') return;   // '출금' 제외, 나머지(빈값 포함)는 입금
          const ym=Utilities.formatDate(new Date(r[4]),tz,'yyyy-MM');
          mpay[ym]=(mpay[ym]||0)+(+r[1]||0);
        });
      }
        // ── months 보강: 입금이 존재하는 가장 이른 월 포함 ──
        const firstPayYM = Object.keys(mpay).sort()[0];
        if (firstPayYM && months.indexOf(firstPayYM) === -1){
          months.unshift(firstPayYM);
          months.sort();

          // 앞에 월이 하나 더 생겼으므로 사용량 배열도 0을 맨 앞에 삽입
          elec.unshift(0);
          gas.unshift(0);
          water.unshift(0);
          park2Arr.unshift(0);
        }
        
        // ▶ 월 범위 밖(조회 시작월 이전) 입금 합계
        const firstYM = months[0];
        const earlyPay = Object.keys(mpay)
                          .filter(ym=>ym<firstYM)
                          .reduce((sum,ym)=>sum+(mpay[ym]||0),0);

        const paymentRaw = months.map(ym=>mpay[ym]||0); // 실제 입금액(테이블 표시용)
        let   paymentNet = paymentRaw.slice();           // 선차감 계산용
        const totalPayment = earlyPay + paymentRaw.reduce((a,b)=>a+b,0);

      // ── baseFix 선차감 ──
        // 선차감 대상에서 earlyPay 먼저 적용
        let remainBase = profile.deposit+profile.rent+profile.mgmt+profile.park - earlyPay;
        if(remainBase<0) remainBase = 0;
      months.forEach((_,i)=>{
        if(remainBase<=0) return;
          const d=Math.min(paymentNet[i],remainBase);
          paymentNet[i]-=d; remainBase-=d;
      });

      // ── 고정비 배열 ──
        const fmt = d => Utilities.formatDate(d, tz, 'yyyy-MM');
        const calcStartYM = moveInCalc ? fmt(moveInCalc) : fmt(moveInActual);

        const inYM  = moveInCalc ? fmt(moveInCalc) : null;
        const outYM = moveOut      ? fmt(moveOut)      : null;
        const afterOut = moveOut ? fmt(new Date(moveOut.getFullYear(), moveOut.getMonth()+1,1)) : null;
        const dpm = d=> new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();

        const pror = (full, ym) => {
          if(ym < calcStartYM) return 0;              // 조회 시작 이전 → 0
              if(!full) return 0;
          if(afterOut && ym === afterOut) return 0;   // 퇴실월+1 → 0
          
          // 현재 날짜 정보
          const currentDate = new Date();
          const currentYM = fmt(currentDate);
          
          // 입주일이 이번달인 경우 (입주일부터 말일까지)
          if(inYM && ym === inYM)  {
            const daysInMonth = dpm(moveInCalc);
            const prorRatio   = (daysInMonth - moveInCalc.getDate() + 1) / daysInMonth; // 입주일부터 말일까지
            return Math.round(full * prorRatio);
          }
          
          // 퇴실일이 이번달인 경우 (1일부터 퇴실일까지) - 입주일보다 우선
          if(outYM && ym === outYM) return Math.round(full * (moveOut.getDate() / dpm(moveOut)));
          
          // 퇴실일이 이미 과거이고 현재 월 이후라면 0 반환
          if(moveOut && ym > outYM) return 0;
          
          // 위 조건들이 없고 이번달인 경우 (1일부터 오늘까지)
          if(ym === currentYM) {
            const daysInMonth = dpm(currentDate);
            const prorRatio = currentDate.getDate() / daysInMonth;
            return Math.round(full * prorRatio);
          }
          
              return full;
            };

      const rentArr = months.map(ym=>pror(profile.rent, ym));
      const mgmtArr = months.map(ym=>pror(profile.mgmt, ym));
      const parkArr = months.map(ym=>pror(profile.park, ym));

      // ── 월별 흐름 ──
        const charge = months.map((_,i)=>
          (months[i] < calcStartYM) ? 0
            : elec[i]+gas[i]+water[i]+park2Arr[i]+rentArr[i]+mgmtArr[i]+parkArr[i]);
      const prevArr=[],billing=[],arrears=[]; let prev=0;
      months.forEach((_,i)=>{
        prevArr[i]=prev;
        billing[i]=i===0?0:charge[i-1]+prev;
          arrears[i]=billing[i]-paymentNet[i];
        prev=arrears[i];
      });

        // 총 청구금액 = 월별 "청구내역"(billing) 합계가 맞음
        const totalBilling = billing.reduce((a,b)=>a+b,0);
        const netPayment   = paymentNet.reduce((a,b)=>a+b,0);
        const remainAmt    = totalPayment - totalBilling;   // 잔여금(보증금 포함)

      // ── 상세 입금 ──
      const pays=[];
      if(paySh&&paySh.getLastRow()>1){
        paySh.getRange(2,1,paySh.getLastRow()-1,6).getValues().forEach(r=>{
            if(String(r[0]).trim()!==room) return;
            const type=String(r[3]).trim();
            if(type && type !== '입금') return;
            pays.push({date:Utilities.formatDate(new Date(r[4]),tz,'yyyy-MM-dd'),amount:+r[1]||0,memo:r[5]||''});
        });
      }

      const totalArrears   = arrears[arrears.length-1];      // 총미납금
      const totalChargeSum = charge.reduce((s,v)=>s+v,0);    // 총청구내역
      const remainOriginal = totalPayment - totalChargeSum;  // 남은금액(=보증금 포함)

      return { success:true, profile, header:months,
                prevArr, elec, gas, water, park2Arr,
               rentArr, mgmtArr, parkArr,
                billing, payment:paymentRaw, arrears, charge,
               totalBilling : totalChargeSum,      // 총청구 금액
               totalPayment : totalPayment,        // 총입금 금액
               remain       : remainOriginal,      // 남은금액
               totalArrears : totalArrears,        // 총미납금
                payments     : pays,
                park2Arr    : park2Arr };
    }catch(e){return {success:false,msg:e.toString()};}
  }

  /**
   * 디버그용 – 실행하면 호실번호를 입력받아 로그를 뿌려 줍니다.
   * 메뉴에서 선택하거나 에디터에서 바로 Run 하면 됩니다.
   */
  function debugRoomPrompt() {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt('↘ 디버그할 호실 번호를 입력하세요', '예) 401', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    const room = resp.getResponseText().trim();
    debugPaymentLogic(room);    // ← 실제 디버그 함수 호출
    ui.alert(`완료! Apps Script 로그에서 ${room}호 결과를 확인하세요.`);
  }



  /**
   * 퇴실 처리 (데이터 완전 삭제 버전)
   * 1) 입주데이터 시트에서 removeTenantInfo 로 기존 데이터 초기화
   * 2) 입금데이터, 사용량데이터 시트에서 해당 호실 행 삭제 (위로 당기기)
   * @param {string|number} room   호실
   * @param {string|Date}   outDate 퇴실일(옵션)
   * @return {object} {success:boolean, message:string, paymentsDeleted:number, usagesDeleted:number}
   */
  function removeTenantCompletely(room, outDate){
    room = String(room||'').trim();
    try{
      // 1) 기본 퇴실 처리 (이름 → 공실 등)
      const base = removeTenantInfo(room, outDate);
      if(!base.success) return base;

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let paymentsDeleted = 0, usagesDeleted = 0;

      // 2) 입금데이터 시트
      const paySh = ss.getSheetByName(PAYMENT_SHEET);
      if(paySh && paySh.getLastRow()>1){
        const vals = paySh.getRange(2,1,paySh.getLastRow()-1,1).getValues();
        for(let i=vals.length-1;i>=0;i--){
          if(String(vals[i][0]).trim() === room){
            paySh.deleteRow(i+2); // +2 because data starts at row2
            paymentsDeleted++;
          }
        }
      }

      // 3) 사용량데이터 시트
      const usageSh = ss.getSheetByName(USAGE_SHEET);
      if(usageSh && usageSh.getLastRow()>1){
        const vals = usageSh.getRange(2,1,usageSh.getLastRow()-1,1).getValues();
        for(let i=vals.length-1;i>=0;i--){
          if(String(vals[i][0]).trim() === room){
            usageSh.deleteRow(i+2);
            usagesDeleted++;
          }
        }
      }

      return {success:true, message:`${room}호 퇴실 완료 (입금 ${paymentsDeleted}건, 사용량 ${usagesDeleted}건 삭제)`};

    }catch(e){
      console.error('removeTenantCompletely 오류',e);
      return {success:false, message:e.toString()};
    }
  }

  /**
   * Web-app safe: 리빌드 (특정 호실) – UI 호출 없음
   */
  function rebuildRoomApi(room){
    room = String(room||'').trim();
    try{
      const start=Date.now();
      updateReportPayment(room);
      createFastMisugumSheet();
      createFastMgmtHistorySheet();
      const sec=Math.round((Date.now()-start)/1000);
      return {success:true,message:`${room}호 리빌드 완료 (${sec}초)`};
    }catch(e){
      console.error('rebuildRoomApi 오류',e);
      return {success:false,msg:e.toString()};
    }
  }

  /**
   * Web-app safe: 전체 초고속 리빌드 – UI 호출 없음
   */
  function rebuildAllSync(){
    try{
      const start=Date.now();
      runAll_Part1();
      createFastMisugumSheet();
      createFastMgmtHistorySheet();
      const sec=Math.round((Date.now()-start)/1000);
      return {success:true,message:`전체 리빌드 완료 (${sec}초)`};
    }catch(e){
      console.error('rebuildAllSync 오류',e);
      return {success:false,msg:e.toString()};
    }
  }



  /**
   * 클라이언트 호출용: 백그라운드 트리거 생성 후 즉시 응답
   */
  function rebuildAllApi(){
    const ignoreUiErr = err => (err && err.message && err.message.indexOf('getUi')>-1);
    try{
      const start=Date.now();
      try{ runAll_Part1(); }catch(e){ if(!ignoreUiErr(e)) throw e; }
      try{ createFastMisugumSheet(); }catch(e){ if(!ignoreUiErr(e)) throw e; }
      try{ createFastMgmtHistorySheet(); }catch(e){ if(!ignoreUiErr(e)) throw e; }
      const sec=Math.round((Date.now()-start)/1000);
      return {success:true,message:`전체 리빌드 완료 (${sec}초)`};
    }catch(e){
      console.error('rebuildAllApi 오류',e);
      return {success:false,msg:e.toString()};
    }
  }



  // runAll_Part1(입주·사용량 블록 재생성)만 단독으로 실행
  function rebuildAllPart1Only(){
    runAll_Part1();
  }


// 공통 – 시트 핸들
function _users(){
  const ss=SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(USERS_SHEET);
  if(!sh) {
    sh = ss.insertSheet(USERS_SHEET);
    sh.appendRow(['id','pwHash','name','contact','approved','role']);
    
    // 기본 테스트 사용자 추가
    sh.appendRow(['test', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', '테스트', '010-1234-5678', 'Y', 'admin']);
  }
  return sh;
}



// 회원가입
function registerUser(id, pwHash, name, contact){
  if(!id || !pwHash) throw new Error('id/pw 누락');
  const sh = _users();

  // 시트가 6열보다 작으면 자동 확장
  if (sh.getMaxColumns() < 6) {
    sh.insertColumnsAfter(sh.getMaxColumns(), 6 - sh.getMaxColumns());
  }

  // 이미 등록된 ID 검사 (데이터가 있을 때만)
  let ids = [];
  const lr = sh.getLastRow();
  if (lr > 1) {
    ids = sh.getRange(2, 1, lr - 1, 1).getValues().flat();
  }
  if (ids.includes(id)) throw new Error('이미 존재하는 ID');

  sh.appendRow([id, pwHash, name || '', contact || '', 'N', 'user']);
  return '가입 신청 완료! 관리자가 승인하면 로그인 가능합니다.';
}

function loginUser(id, pwHash) {
  try {
    const sh = _users();
    const lr = sh.getLastRow();
    let row = null;
    if (lr > 1) {
      const ids = sh.getRange(2, 1, lr - 1, 1).getValues().flat();
      const idx = ids.indexOf(id);
      if (idx !== -1) {
        row = sh.getRange(idx + 2, 1, 1, 6).getValues()[0];
      }
    }
    if (!row) {
      logLoginEvent(id, 'NOT_FOUND');
      return { success: false, error: '존재하지 않는 ID' };
    }
    if (row[1] !== pwHash) {
      logLoginEvent(id, 'PW_MISMATCH');
      return { success: false, error: '비밀번호 불일치' };
    }
    // 세션 토큰 발급 (60분 유효)
    const tok = Utilities.getUuid();
    CacheService.getUserCache().put(tok, id, 60 * 60);

    logLoginEvent(id, 'SUCCESS');
    return { success: true, token: tok };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}






function getRoomListForMobile() {
  // ▶ 호실 목록 필터 (<=1606) + 중복 제거
  const rooms = getRoomList().filter(r => {
    const n = parseInt(r, 10);
    return !isNaN(n) && n <= 1606;
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSh = ss.getSheetByName(DATA_SHEET);
  const nameMap = {};
  if (dataSh) {
    const vals = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 2).getValues();
    vals.forEach(row => {
      const room = String(row[0]).trim();
      const name = String(row[1]).trim();
      if (!room) return;
      // 이름이 있는 경우만 덮어쓰기 (비어있는 이름으로는 덮어쓰지 않음)
      if (name) {
        nameMap[room] = name;
      } else if (!(room in nameMap)) {
        // 이름이 비어있고 아직 등록되지 않았다면 빈 문자열로 초기화
        nameMap[room] = '';
      }
    });
  }
  // 숫자 기준 오름차순 정렬
  rooms.sort((a,b)=>parseInt(a,10)-parseInt(b,10));
  return rooms.map(room => ({
    room: room,
    name: nameMap[room] || '',
    display: room + (nameMap[room] ? ' (' + nameMap[room] + ')' : '')
  }));
}

function logLoginEvent(id, status) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('LoginLogs');
  if (!sh) {
    sh = ss.insertSheet('LoginLogs');
    sh.appendRow(['id', 'datetime', 'status', 'ip']);
  }
  // IP는 Apps Script에서 직접 구할 수 없으므로, 필요하면 클라이언트에서 전달
  const now = new Date();
  sh.appendRow([id, Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), status, '']);
}

function getPaymentsForRoom(room) {
  room = String(room || '').trim();
  if (!room) return [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('입금데이터');
  if (!sh || sh.getLastRow() < 2) return [];
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  const tz = Session.getScriptTimeZone();
  const res = [];
  data.forEach((r, i) => {
    if (String(r[0]).trim() === room) {
      res.push({
        row: i + 2,
        room: r[0],
        amount: r[1],
        manager: r[2],
        type: r[3],
        date: r[4] ? Utilities.formatDate(new Date(r[4]), tz, 'yyyy-MM-dd') : '',
        memo: r[5] || ''
      });
    }
  });
  return res;
}

function addPaymentsBulk(entries){
  if(!Array.isArray(entries)||entries.length===0) return {success:false,message:'파라미터 오류'};
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=ss.getSheetByName('입금데이터');
  if(!sh) return {success:false,message:'입금데이터 시트 없음'};
  const rows=entries.map(e=>[
    String(e.room||'').trim(),
    parseFloat(e.amount)||0,
    e.manager||'경리',
    '입금',
    new Date(e.date),
    e.memo||''
  ]);
  sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  return {success:true, added:entries.length};
}

function deletePaymentRows(rows){
  if(!Array.isArray(rows)||rows.length===0) return {success:false};
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=ss.getSheetByName('입금데이터'); 
  if(!sh) return {success:false};
  rows.sort((a,b)=>b-a).forEach(r=>{ 
    if(r>=2 && r<=sh.getLastRow()) sh.deleteRow(r); 
  });
  // 입금 데이터 삭제 후 리빌드는 필요에 따라 수행
  if(rows.length===1){
    rebuildAllSync(); // UI 없는 안전한 버전 사용 (특정 호실 알 수 없으므로 전체)
  }else{
    rebuildAllSync(); // UI 없는 안전한 버전 사용
  }
  return {success:true,deleted:rows.length};
}

function updatePaymentRow(row, newData){
  row = parseInt(row); 
  if(row < 2) return {success:false};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('입금데이터'); 
  if(!sh || row > sh.getLastRow()) return {success:false};
  
  const vals = [
    newData.room || sh.getRange(row,1).getValue(),
    parseFloat(newData.amount) || 0,
    newData.manager || sh.getRange(row,3).getValue(),
    newData.type || sh.getRange(row,4).getValue(),
    newData.date ? new Date(newData.date) : sh.getRange(row,5).getValue(),
    newData.memo || ''
  ];
  sh.getRange(row,1,1,6).setValues([vals]);
  
  // 입금 데이터 수정 후 해당 호실 리빌드
  rebuildRoomApi(vals[0]); // UI 없는 안전한 버전 사용
  return {success:true};
}

// == 시트 내보내기(다운로드) 유틸 =====================
/**
 * 지정한 시트를 Excel(xlsx) URL 로 반환한다.
 * @param {string} sheetName 대상 시트명
 * @return {string} 다운로드용 URL (xlsx format)
 */
function exportSheetAsXlsx(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if(!sh) throw new Error(sheetName + ' 시트를 찾을 수 없습니다.');
  return ss.getUrl().replace(/edit$/, '') +
         'export?format=xlsx' +
         '&gid=' + sh.getSheetId() +
         '&locale=ko_KR' +
         '&portrait=false' +
         '&sheetnames=false';
}

/**
 * 지정한 시트를 CSV(UTF-8) URL 로 반환한다.
 * @param {string} sheetName 대상 시트명
 * @return {string} 다운로드용 URL (csv format)
 */
function exportSheetAsCsv(sheetName){
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(sheetName);
  if(!sh) throw new Error(sheetName + ' 시트를 찾을 수 없습니다.');
  return ss.getUrl().replace(/edit$/, '') +
         'export?format=csv' +
         '&gid=' + sh.getSheetId() +
         '&locale=ko_KR' +
         '&valueRenderOption=UNFORMATTED_VALUE';
}

// 청구표 시트가 없으면 즉석 생성 후 반환
function ensureBillingSheet(){
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('청구표');
    if(sh) return sh;

    console.log('📜 청구표 시트 생성 시작...');
    
    const payload = getBillingListSafe();
    if(!payload || !payload.success){
      console.error('❌ 청구표 데이터 생성 실패:', payload?.message);
      throw new Error('청구표 데이터를 생성할 수 없습니다: '+(payload && payload.message));
    }

    sh = ss.insertSheet('청구표');
    const header = ['호실','성함','연락처','입주일','기간','월세','관리비','주차비','전월미납','총미납','특이사항'];
    
    // 데이터 안전성 검증
    const rows = payload.data.map(r=>[
      String(r.room || '').trim(),
      String(r.name || '').trim(),
      String(r.contact || '').trim(),
      r.moveIn ? Utilities.formatDate(new Date(r.moveIn), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : '',
      String(r.term || '').trim(),
      parseFloat(r.rent) || 0,
      parseFloat(r.mgmt) || 0,
      parseFloat(r.park) || 0,
      parseFloat(r.prevArrears) || 0,
      parseFloat(r.remain) || 0,
      String(r.remark || '').trim()
    ]);
    
    // 헤더 설정
    sh.getRange(1,1,1,header.length).setValues([header]);
    
    // 데이터 설정 (안전하게)
    if(rows.length > 0){
      try {
        sh.getRange(2,1,rows.length,header.length).setValues(rows);
        console.log(`✅ ${rows.length}개 행의 청구표 데이터 설정 완료`);
      } catch (e) {
        console.error('❌ 데이터 설정 오류:', e);
        // 부분적으로라도 설정 시도
        const safeRows = rows.slice(0, Math.min(rows.length, 100));
        sh.getRange(2,1,safeRows.length,header.length).setValues(safeRows);
      }
    }
    
    // 서식 설정
    sh.setFrozenRows(1);
    
    console.log('✅ 청구표 시트 생성 완료');
    return sh;
    
  } catch (error) {
    console.error('❌ ensureBillingSheet 오류:', error);
    throw new Error('청구표 시트 생성 실패: ' + error.toString());
  }
}

// 안전한 청구표 데이터 생성 함수
function getBillingListSafe() {
  try {
    console.log('📜 안전한 청구표 생성 시작');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    
    if (!dataSh) {
      console.error('❌ 입주데이터 시트 없음');
      return { success: false, message: '입주데이터 시트를 찾을 수 없습니다.', data: [] };
    }
    
    // 안전한 데이터 범위 계산
    const lastRow = dataSh.getLastRow();
    if (lastRow < DATA_START_ROW) {
      console.error('❌ 데이터가 부족함');
      return { success: false, message: '입주데이터가 부족합니다.', data: [] };
    }
    
    const safeLastRow = Math.min(lastRow, DATA_START_ROW + 200); // 최대 200행
    const dataRange = dataSh.getRange(DATA_START_ROW, 1, safeLastRow - DATA_START_ROW + 1, 14);
    const dataValues = dataRange.getValues();
    
    const billingList = [];
    const tz = Session.getScriptTimeZone();
    
    console.log(`📊 ${dataValues.length}행의 데이터 검사 중...`);
    
    dataValues.forEach((row, idx) => {
      try {
        const room = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const contact = String(row[2] || '').trim();
        const moveIn = row[4]; // E열
        const rent = parseFloat(row[9]) || 0; // J열
        const mgmt = parseFloat(row[10]) || 0; // K열
        const park = parseFloat(row[11]) || 0; // L열
        const remark = String(row[13] || '').trim(); // N열
        
        // 호실 번호 유효성 검사
        const roomNum = parseInt(room, 10);
        if (!room || isNaN(roomNum) || roomNum < 301 || roomNum > 1606) {
          return; // 스킵
        }
        
        // 기본 데이터 설정
        let displayName = name || '공실';
        let isVacant = !name || name === '-' || name === '' || name === '공실';
        
        // 입주 기간 계산 (안전하게)
        let term = '-';
        if (moveIn && moveIn instanceof Date) {
          try {
            const diffMs = Date.now() - moveIn.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const months = Math.floor(diffDays / 30);
            term = `${months}개월`;
          } catch (e) {
            term = '-';
          }
        }
        
        // 🔧 리포트 블록에서 정확한 미납금 정보 가져오기
        let prevArrears = 0;
        let currentArrears = 0;
        let totalUnpaid = 0;
        
        try {
          // 호실 목록에서 인덱스 찾기
          const roomsArray = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                                 .getValues().flat().map(v => String(v).trim()).filter(v => v);
          
          const blkIdx = roomsArray.indexOf(room);
          if (blkIdx >= 0) {
            const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
            
            // 범위 체크 후 정확한 데이터 읽기
            if (start > 0 && start + 16 < dataSh.getMaxRows()) {
              // 전월미납금 (1행, C열)
              const prevArrearsCell = dataSh.getRange(start + IDX.PREV_ARREARS, 3);
              prevArrears = parseFloat(prevArrearsCell.getValue()) || 0;
              
              // 당월미납금 (12행, C열)
              const currentArrearsCell = dataSh.getRange(start + IDX.ARREARS, 3);
              currentArrears = parseFloat(currentArrearsCell.getValue()) || 0;
              
              // 총미납금 (14행, C열)
              const totalUnpaidCell = dataSh.getRange(start + IDX.REMAIN, 3);
              totalUnpaid = parseFloat(totalUnpaidCell.getValue()) || 0;
              
              // 디버깅: 미납금 정보 출력 (처음 3개만)
              if (idx < 3) {
                console.log(`💰 ${room}호 미납금: 전월=${prevArrears.toLocaleString()}원, 당월=${currentArrears.toLocaleString()}원, 총미납=${totalUnpaid.toLocaleString()}원`);
              }
            }
          }
        } catch (e) {
          console.error(`❌ ${room}호 미납금 조회 오류:`, e);
          prevArrears = 0;
          currentArrears = 0;
          totalUnpaid = 0;
        }
        
        billingList.push({
          room: room,
          name: displayName,
          contact: isVacant ? '-' : contact,
          moveIn: moveIn ? Utilities.formatDate(new Date(moveIn), tz, 'yyyy-MM-dd') : '',
          term: term,
          rent: rent,
          mgmt: mgmt,
          park: park,
          prevArrears: prevArrears, // 정확한 계산값
          remain: totalUnpaid, // 정확한 계산값
          remark: isVacant ? '공실' : (remark || '')
        });
        
      } catch (rowError) {
        console.error(`❌ 행 ${idx + DATA_START_ROW} 처리 오류:`, rowError);
        // 개별 행 오류는 무시하고 계속 진행
      }
    });
    
    // 데이터가 부족하면 기본 구조 생성
    if (billingList.length < 10) {
      console.log('📋 데이터가 부족합니다. 기본 호실 구조 생성 중...');
      
      const existingRooms = new Set(billingList.map(item => item.room));
      
      // 3층부터 16층까지, 각 층당 01~08호
      for (let floor = 3; floor <= 16; floor++) {
        for (let roomNum = 1; roomNum <= 8; roomNum++) {
          const room = String(floor) + String(roomNum).padStart(2, '0');
          const roomNumber = parseInt(room, 10);
          
          if (roomNumber >= 301 && roomNumber <= 1608 && !existingRooms.has(room)) {
            billingList.push({
              room: room,
              name: '공실',
              contact: '-',
              moveIn: '',
              term: '-',
              rent: 500000,
              mgmt: 100000,
              park: 50000,
              prevArrears: 0,
              remain: 0,
              remark: '공실'
            });
          }
        }
      }
    }
    
    // 호실 번호순 정렬
    billingList.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
    
    console.log(`📜 안전한 청구표 생성 완료: ${billingList.length}개 호실`);
    
    return {
      success: true,
      data: billingList,
      message: `청구표 생성 완료 (${billingList.length}개 호실)`
    };
    
  } catch (error) {
    console.error('❌ getBillingListSafe 오류:', error);
    return {
      success: false,
      message: '청구표 생성 중 오류: ' + error.toString(),
      data: []
    };
  }
}

function exportBillingXlsx(){
  ensureBillingSheet();
  return exportSheetAsXlsx('청구표');
}
function exportBillingCsv(){
  ensureBillingSheet();
  return exportSheetAsCsv('청구표');
}
// ... existing code ...

function exportBillingCsvAnsi(){
  const sh = ensureBillingSheet();
  const data = sh.getDataRange().getDisplayValues();
  const lines = data.map(r => r.map(v=>{
    const s = String(v||'').replace(/"/g,'""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  }).join(','));
  const csvUtf8 = lines.join('\r\n');                // CRLF 권장
  // UTF-8 → CP949 로 변환
  const csvCp949 = Utilities.newBlob(csvUtf8)
                            .getDataAsString('EUC-KR');
  const blob = Utilities.newBlob(csvCp949,
                 'text/csv;charset=EUC-KR','청구표.csv');
  const file = DriveApp.createFile(blob)
                       .setSharing(DriveApp.Access.ANYONE_WITH_LINK,
                                   DriveApp.Permission.VIEW);
  return file.getDownloadUrl();
}

  /**
  * 최근 입금 내역 반환 (최대 limit건, 최신순)
  * params.limit: 숫자 (기본 10)
  */
  function getRecentPayments(params){
    try{
      const limit = (params && params.limit)? parseInt(params.limit,10): 10;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(PAYMENT_SHEET);
      if(!sh) return [];
      const lastRow = sh.getLastRow();
      if(lastRow<2) return [];
      const startRow = Math.max(2, lastRow - limit + 1);
      const rows = sh.getRange(startRow,1,lastRow-startRow+1,6).getValues();
      // A room, B amount, C manager, D type, E date, F memo
      const tz = Session.getScriptTimeZone();
      const list = rows.reverse()  // 최신순 (시트 아래쪽이 최신)
                  .map(r=>({
                    room: String(r[0]).trim(),
                    amount: +r[1]||0,
                    manager: r[2]||'',
                    type: String(r[3]).trim(),
                    date: Utilities.formatDate(new Date(r[4]),tz,'yyyy-MM-dd'),
                    memo: r[5]||''
                  }))
                  .filter(it=>it.type==='입금')
                  .slice(0,limit);
      return list;
    }catch(e){
      console.error('getRecentPayments 오류',e);
      return [];
    }
  }

  /**
  * 최근 사용량 입력 내역 반환 (최대 limit건, 최신순)
  * params.limit: 숫자 (기본 10)
  */
  function getRecentUsages(params){
    try{
      const limit = (params && params.limit)? parseInt(params.limit,10): 10;
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName(USAGE_SHEET);
      if(!sh) return [];
      const lastRow = sh.getLastRow();
      if(lastRow<2) return [];
      const startRow = Math.max(2, lastRow - limit + 1);
      const rows = sh.getRange(startRow,1,lastRow-startRow+1,6).getValues();
      // A room, B month, C elec, D gas, E water, F park2
      const list = rows.reverse()  // 최신순 (시트 아래쪽이 최신)
                  .map(r=>({
                    room: String(r[0]).trim(),
                    month: String(r[1]),
                    electric: +r[2]||0,
                    gas: +r[3]||0,
                    water: +r[4]||0,
                    park2: +r[5]||0
                  }))
                  .slice(0,limit);
      return list;
    }catch(e){
      console.error('getRecentUsages 오류',e);
      return [];
    }
  }



  /**
  * [월별 현황] 해당 월의 청구내역, 입금, 입금 없는 세대
  */
  function getBuildingMonthlyStats(params){
    const month = params && params.month;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const billingSh = ss.getSheetByName('청구내역');
    const paySh = ss.getSheetByName(PAYMENT_SHEET);
    let billingSum=0, paymentSum=0, unpaidRooms=[];
    let roomList=[];
    if(billingSh){
      const vals = billingSh.getDataRange().getValues();
      const header = vals[0];
      const mIdx = header.indexOf(month);
      for(let i=1;i<vals.length;i++){
        const val = Number(vals[i][mIdx])||0;
        billingSum += val;
        if(val>0) roomList.push(vals[i][0]);
      }
    }
    if(paySh){
      const vals = paySh.getDataRange().getValues();
      for(let i=1;i<vals.length;i++){
        const ym = Utilities.formatDate(new Date(vals[i][4]), Session.getScriptTimeZone(), 'yyyy-MM');
        if(ym===month) paymentSum += Number(vals[i][1])||0;
      }
    }
    // 입금 없는 세대: 청구는 있으나 입금 0
    if(roomList.length>0 && paySh){
      const vals = paySh.getDataRange().getValues();
      const paidRooms = new Set();
      for(let i=1;i<vals.length;i++){
        const ym = Utilities.formatDate(new Date(vals[i][4]), Session.getScriptTimeZone(), 'yyyy-MM');
        if(ym===month) paidRooms.add(vals[i][0]);
      }
      unpaidRooms = roomList.filter(r=>!paidRooms.has(r));
    }
    return {
      billing: billingSum,
      payment: paymentSum,
      unpaidRooms: unpaidRooms
    };
  }


function getBuildingMonthlyStatsV2(params) {
  const month = params && params.month;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSh = ss.getSheetByName(DATA_SHEET);
  let list = [], billingSum = 0, paymentSum = 0, diffSum = 0;
  if (dataSh && month) {
    const lastRow = dataSh.getLastRow();
    for (let r = 125; r <= lastRow; r += 17) {
      const header = dataSh.getRange(r, 3, 1, dataSh.getLastColumn() - 2).getValues()[0];
      const monthIdx = header.findIndex(h => h === month);
      if (monthIdx === -1) continue;
      const room = dataSh.getRange(r, 1, 1, 1).getValue();
      const billing = Number(dataSh.getRange(r + 10, 3 + monthIdx, 1, 1).getValue()) || 0; // 11행
      const payment = Number(dataSh.getRange(r + 11, 3 + monthIdx, 1, 1).getValue()) || 0; // 12행
      // === 추가: 잔액(정산금액) ===
      const settle = Number(dataSh.getRange(r + 14, 3, 1, 1).getValue()) || 0; // 15행 C열
      if (billing > 0) {
        list.push({ room, billing, payment, diff: billing - payment, settle });
        billingSum += billing;
        paymentSum += payment;
        diffSum += (billing - payment);
      }
    }
  }
  return {
    month: month,
    list: list,
    billingSum: billingSum,
    paymentSum: paymentSum,
    diffSum: diffSum
  };
}



// 해야할일 조회 (특정 날짜) - 완료되지 않은 것만
function getTodosByDate(params) {
  try {
    var sheet = getOrCreateTodoSheet();
    if (sheet.getLastRow() <= 1) return []; // 헤더만 있거나 빈 시트
    
    var data = sheet.getDataRange().getValues();
    var date = params.date;
    var list = data.slice(1).filter(r => { // 헤더 제외
      // 완료된 할일은 제외
      if (r[2] === true || r[2] === 'TRUE' || r[2] === '완료') return false;
      
      // 날짜를 yyyy-MM-dd로 변환해서 비교
      var cellDate = r[0];
      if (cellDate instanceof Date) {
        cellDate = Utilities.formatDate(cellDate, 'Asia/Seoul', 'yyyy-MM-dd');
      } else {
        cellDate = String(cellDate).trim();
      }
      return cellDate === date;
    }).map((r, index) => ({
      id: index + 2, // 실제 시트 행 번호 (헤더 제외)
      date: r[0],
      task: r[1],
      done: r[2],
      source: r[3] || 'UI'
    }));
    return list;
  } catch (e) {
    console.error('getTodosByDate 오류:', e);
    return [];
  }
}

// 해야할일 완료 처리
function setTodoDone(params) {
  try {
    var sheet = getOrCreateTodoSheet();
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) { // 헤더 제외
      var cellDate = data[i][0];
      if (cellDate instanceof Date) {
        cellDate = Utilities.formatDate(cellDate, 'Asia/Seoul', 'yyyy-MM-dd');
      } else {
        cellDate = String(cellDate).trim();
      }
      
      if (cellDate === params.date && data[i][1] === params.task) {
        sheet.getRange(i + 1, 3).setValue('완료');
        return { success: true, message: '할일이 완료되었습니다.' };
      }
    }
    return { success: false, error: '해당 할일을 찾을 수 없습니다.' };
  } catch (e) {
    console.error('setTodoDone 오류:', e);
    return { success: false, error: e.toString() };
  }
}


// 매일 오전 11시 트리거 함수
function sendTodayTodosToTelegram() {
  var today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  var todos = getTodosByDate({ date: today });
  if (todos.length == 0) return;
  var msg = '[오늘의 할일]\n' + todos.filter(t=>!t.done).map(t => '□ ' + t.task).join('\n');
  sendTelegram(msg);
}

function sendTelegram(msg) {
  try {
    Logger.log('1. 함수 진입');
    if (!msg || !String(msg).trim()) {
      Logger.log('2. 메시지 비어있음');
      return;
    }
    Logger.log('3. API 호출 직전');
    var token = '7415868957:AAFQSjPIu5FxNKpJ_unOs9-WpK4UcFHGHjY';
    var chatId = '-1002774053703';
    var url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    var payload = {
      chat_id: chatId,
      text: msg
    };
    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    Logger.log('4. API 호출 후');
    Logger.log(response.getContentText());
  } catch (e) {
    Logger.log('텔레그램 전송 에러: ' + e);
  }
}

// 테스트용 텔레그램 메시지 전송 함수 (수동 실행용)
function sendTestTelegram() {
  sendTelegram('테스트 메세지');
}

// 디버깅: 입주데이터 시트의 헤더 구조 확인
function debugDataHeaders() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    if (!dataSh) return { error: '입주데이터 시트가 없습니다.' };
    
    const rooms = getRoomList().filter(r => {
      const n = parseInt(r, 10);
      return !isNaN(n) && n >= 301 && n <= 310; // 처음 10개 호실만 체크
    }).slice(0, 3); // 처음 3개만
    
    const debugInfo = [];
    
    rooms.forEach(room => {
      const colA = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                        .getValues().flat().map(v => String(v).trim());
      const rawIdx = colA.indexOf(room);
      if (rawIdx < 0) return;
      
      const blkIdx = colA.filter(v => v).indexOf(room);
      const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
      
      // 헤더 행 전체 읽기
      const headerRow = dataSh.getRange(start, 3, 1, dataSh.getLastColumn() - 2).getDisplayValues()[0];
      const cleanHeaders = headerRow.map(h => String(h).replace(/[\.\u2010-\u2015]/g, '-').trim());
      const validHeaders = cleanHeaders.filter(h => /^\d{4}-\d{2}$/.test(h));
      
      debugInfo.push({
        room: room,
        blockStart: start,
        rawHeaders: headerRow,
        cleanHeaders: cleanHeaders,
        validHeaders: validHeaders,
        totalColumns: headerRow.length
      });
    });
    
    return debugInfo;
  } catch (e) {
    return { error: e.toString() };
  }
}

// chat_id 조회용 (임시 실행)
function getMyChatId() {
  var token = '7415868957:AAFQSjPIu5FxNKpJ_unOs9-WpK4UcFHGHjY';
  var url = 'https://api.telegram.org/bot' + token + '/getUpdates';
  var response = UrlFetchApp.fetch(url);
  Logger.log(response.getContentText());
}

function getOrCreateTodoSheet() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('해야할일');
  if (!sheet) {
    sheet = ss.insertSheet('해야할일');
    // 헤더 추가
    sheet.getRange(1, 1, 1, 4).setValues([['날짜', '할일', '상태', '출처']]);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold');
  }
  return sheet;
}

// 예시: addTodo 함수에서 사용
function addTodo(params) {
  var sheet = getOrCreateTodoSheet();
  var dateVal = params.date;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    dateVal = new Date(dateVal);
  }
  sheet.appendRow([dateVal, params.task, false, params.source || 'UI']);
  return { success: true };
}

// 해야할일 수정 (내용/날짜)
function updateTodo(params) {
  try {
    var sheet = getOrCreateTodoSheet();
    var row = parseInt(params.row, 10);
    if (isNaN(row) || row < 2) {
      return { success: false, error: '유효하지 않은 row 번호' };
    }

    if (params.newTask !== undefined) {
      sheet.getRange(row, 2).setValue(params.newTask);
    }

    if (params.newDate !== undefined) {
      var d = params.newDate;
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        d = new Date(d);
      }
      sheet.getRange(row, 1).setValue(d);
    }

    return { success: true, message: '할일이 수정되었습니다.' };
  } catch (e) {
    console.error('updateTodo 오류:', e);
    return { success: false, error: e.toString() };
  }
}

// ────────────────────────────── 퇴실 정산 PDF Export ──────────────────────────────
function exportSettlementPdf(params){
  try{
    const room = String(params.room || params || '').trim();
    if(!room) return {success: false, message: '호실 번호가 필요합니다.'};

    // 퇴실일이 지정되지 않으면 오늘 날짜 사용
    const moveOut = params.moveOut || new Date();
    const data = getSettlementSummary({ room: room, moveOut: moveOut });
    if(!data || data.success === false) return {success: false, message: '정산 데이터를 가져올 수 없습니다.'};

    // ── HTML 생성 ──
    const prof   = data.profile || {};
    const rows   = ['prevArr','elec','gas','water','park2Arr','rentArr','mgmtArr','parkArr','billing','payment','arrears'];
    const labels = ['전월미납','전기','가스','수도','주차2','월세','관리비','주차비','청구','입금','미납'];
    const header = data.header || [];

    let html = `<html><head><meta charset="utf-8"><style>
      body{font-family:'Malgun Gothic',sans-serif;font-size:11pt;margin:20px;color:#222;line-height:1.4;}
      h2{margin:0 0 20px;text-align:center;color:#1976D2;font-size:18pt;border-bottom:2px solid #1976D2;padding-bottom:10px;}
      h3{margin:25px 0 10px 0;color:#424242;font-size:13pt;border-bottom:1px solid #e0e0e0;padding-bottom:5px;}
      .card{border:1px solid #d1d5db;border-radius:12px;padding:25px;box-shadow:0 4px 10px rgba(0,0,0,0.05);background:#fff;}
      .summary{margin:8px 0;font-size:11pt;color:#555;}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:10pt;border:1px solid #ddd;}
      th,td{border:1px solid #ddd;padding:8px 6px;text-align:right;}
      th{background:#f5f5f5;font-weight:600;text-align:center;color:#333;}
      tbody tr:nth-child(even){background:#fafafa;}
      tbody tr:hover{background:#f0f8ff;}
    </style></head><body>`;
    html += `<div class="card">`;
    html += `<h2>${room}호 퇴실 정산서</h2>`;
    
    // 날짜 포맷팅
    const moveInDate = prof.moveIn ? Utilities.formatDate(new Date(prof.moveIn), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '-';
    const moveOutDate = moveOut ? Utilities.formatDate(new Date(moveOut), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '-';
    
    html += `<p class="summary"><strong>입주자:</strong> ${prof.name || '-'}</p>`;
    html += `<p class="summary"><strong>입주일:</strong> ${moveInDate} &nbsp;&nbsp; <strong>퇴실일:</strong> ${moveOutDate}</p>`;
    html += `<p class="summary"><strong>연락처:</strong> ${prof.contact || '-'}</p>`;
    html += `<p class="summary"><strong>보증금:</strong> ${Number(prof.deposit || 0).toLocaleString()}원 &nbsp;&nbsp; <strong>월세/관리비/주차비:</strong> ${Number(prof.rent || 0).toLocaleString()}/${Number(prof.mgmt || 0).toLocaleString()}/${Number(prof.park || 0).toLocaleString()}</p>`;
    html += `<p class="summary"><strong>특이사항:</strong> ${prof.remark || '-'}</p>`;

    // 월별 내역 표
    html += '<h3>월별 내역</h3>';
    html += '<table><thead><tr><th style="width:80px;">항목</th>' +
            header.map(h => `<th style="width:90px;">${h}</th>`).join('') +
            '</tr></thead><tbody>';
    rows.forEach((key, i) => {
      const arr = data[key] || [];
      const rowClass = (labels[i] === '청구내역') ? 'style="background:#e3f2fd;font-weight:600;"' : 
                       (labels[i] === '입금') ? 'style="background:#e8f5e8;font-weight:600;"' : 
                       (labels[i] === '미납금') ? 'style="background:#ffebee;font-weight:600;"' : '';
      html += `<tr ${rowClass}><td style="text-align:left;font-weight:600;">${labels[i]}</td>` +
              arr.map(v => `<td>${Number(v).toLocaleString()}</td>`).join('') +
              '</tr>';
    });
    html += '</tbody></table>';

    // 입금 상세 내역 추가
    const payments = data.payments || [];
    if (payments.length > 0) {
      html += '<h3 style="margin-top:30px;">입금 상세 내역</h3>';
      html += '<table style="width:60%;"><thead><tr><th>입금일자</th><th>금액</th><th>메모</th></tr></thead><tbody>';
      payments.forEach(p => {
        html += `<tr><td style="text-align:center;">${p.date}</td><td style="text-align:right;">${Number(p.amount).toLocaleString()}</td><td style="text-align:left;">${p.memo || '-'}</td></tr>`;
      });
      html += '</tbody></table>';
    }

    // 최종 정산 요약
    html += '<div style="margin-top:30px;padding:15px;background:#f8f9fa;border-radius:8px;border-left:4px solid #2196F3;">';
    html += `<h3 style="margin:0 0 10px 0;color:#1976D2;">최종 정산 요약</h3>`;
    html += `<p style="margin:5px 0;"><b>총 청구 금액:</b> ${Number(data.totalBilling || 0).toLocaleString()}원</p>`;
    html += `<p style="margin:5px 0;"><b>총 입금 금액:</b> ${Number(data.totalPayment || 0).toLocaleString()}원</p>`;
    const remainColor = (data.remain || 0) > 0 ? '#d32f2f' : '#388e3c';
    const remainText = (data.remain || 0) > 0 ? '미납' : '완납';
    html += `<p style="margin:5px 0;font-size:14pt;"><b style="color:${remainColor};">최종 정산 금액: ${Number(data.remain || 0).toLocaleString()}원 (${remainText})</b></p>`;
    html += `</div>`;
    html += `</div></body></html>`;

    // ── PDF 생성 & 공유 ──
    const blob = HtmlService.createHtmlOutput(html)
                 .getBlob().getAs('application/pdf')
                 .setName(`${room}호_퇴실정산.pdf`);
    const file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 텔레그램에서 사용할 수 있는 직접 다운로드 링크 생성
    const fileId = file.getId();
    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    Logger.log(`✅ PDF url for ${room}: ${directUrl}`);
    return {success: true, url: directUrl, fileId: fileId};

  }catch(e){
    console.error('exportSettlementPdf 오류', e);
    return {success: false, message: e.toString()};
  }
}

// 📡 Telegram WebHook 헬퍼 -------------------------------------------------
function sendTelegramTo(chatId, msg) {
  var token = '7415868957:AAFQSjPIu5FxNKpJ_unOs9-WpK4UcFHGHjY'; // ← 기존 토큰 재사용
  var url   = 'https://api.telegram.org/bot' + token + '/sendMessage';
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: msg })
  };
  try {
    UrlFetchApp.fetch(url, options);
  } catch (e) {
    Logger.log('sendTelegramTo 오류: ' + e);
  }
}

function handleTelegramUpdate(update) {
  try {
    var msgObj = update.message || update.edited_message;
    if (!msgObj) return;
    var chatId = msgObj.chat.id;
    var text   = (msgObj.text || '').trim();
    if (!text) return;

    /* ── 간단 명령 라우팅 ── */
    if (text === '/start') {
      sendTelegramTo(chatId, '✅ 봇이 정상적으로 연결되었습니다!');
      return;
    }
    if (text === '공실') {
      var vacant = getVacantRooms().map(function (r) { return r.room; }).join(', ');
      sendTelegramTo(chatId, vacant ? ('공실: ' + vacant) : '공실 없음');
      return;
    }
    if (text === '전체 미납') {
      var list = getAllRoomStatus().filter(function (r) { return (r.unpaid || 0) > 0; });
      if (list.length === 0) {
        sendTelegramTo(chatId, '미납 세대 없음');
      } else {
        var lines = list.map(function (r) { return r.room + '호 : ₩' + (r.unpaid || 0).toLocaleString(); });
        sendTelegramTo(chatId, lines.join('\n'));
      }
      return;
    }

    // 숫자만 입력 → 호실로 간주
    if (/^\d{3,4}$/.test(text)) {
      var info = getSettlementSummary({ room: text });
      if (info && info.success) {
        sendTelegramTo(chatId, text + '호\n총미납: ₩' + (info.totalArrears || 0).toLocaleString() + '\n정산금: ₩' + (info.remain || 0).toLocaleString());
      } else {
        sendTelegramTo(chatId, '해당 호실을 찾을 수 없습니다.');
      }
      return;
    }

    // 기본 응답
    sendTelegramTo(chatId, '알 수 없는 명령입니다.');
  } catch (err) {
    Logger.log('handleTelegramUpdate 오류: ' + err);
  }
}




// 악성미납 조회 함수 (당월포함 전월까지 입금이 없는 세대)
function getBadDebtors() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const paySh = ss.getSheetByName(PAYMENT_SHEET);
    
    if (!dataSh) return { success: false, message: '입주데이터 시트를 찾을 수 없습니다' };

    const rooms = getRoomList();
    const tz = Session.getScriptTimeZone();
    const now = new Date();
    const currentMonth = Utilities.formatDate(now, tz, 'yyyy-MM');
    const lastMonth = Utilities.formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1), tz, 'yyyy-MM');
    
    const result = [];

    rooms.forEach(room => {
      const colA = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                         .getValues().flat().map(v => String(v).trim());
      const rawIdx = colA.indexOf(String(room));
      
      if (rawIdx < 0) return;

      const rowNum = DATA_START_ROW + rawIdx;
      const name = String(dataSh.getRange(rowNum, 2).getValue()).trim();
      const contact = String(dataSh.getRange(rowNum, 3).getDisplayValue()).trim();
      const moveIn = dataSh.getRange(rowNum, 4).getValue();
      const remark = String(dataSh.getRange(rowNum, 14).getDisplayValue()).trim();

      // 301~1606 호실, 연락처 있는 경우만
      const rn = parseInt(room, 10);
      if (isNaN(rn) || rn < 301 || rn > 1606 || !contact) return;

      // 당월과 전월 입금 확인
      let hasPaymentInTargetMonths = false;
      
      if (paySh && paySh.getLastRow() > 1) {
        try {
          const paymentData = paySh.getRange(2, 1, paySh.getLastRow() - 1, 6).getValues();
          
          for (let i = 0; i < paymentData.length; i++) {
            const row = paymentData[i];
            if (String(row[0]).trim() !== room) continue;
            
            const amount = parseFloat(row[1]) || 0;
            const type = String(row[3]).trim();
            const date = row[4];
            
            if ((type === '입금' || type === '') && amount > 0 && date) {
              const ym = Utilities.formatDate(new Date(date), tz, 'yyyy-MM');
              if (ym === currentMonth || ym === lastMonth) {
                hasPaymentInTargetMonths = true;
                break;
              }
            }
          }
        } catch (e) {
          console.log(`입금내역 확인 오류 (${room}호):`, e);
        }
      }

      // 현재 정산금액 계산
      const blkIdx = rooms.filter(r => r).indexOf(room);
      const start = REPORT_BASE + blkIdx * (ROWS_PER_ROOM + GAP);
      let settle = 0;
      
      try {
        settle = parseFloat(dataSh.getRange(start + IDX.REMAIN, 3).getValue()) || 0;
      } catch (e) {
        console.log(`정산금액 조회 오류 (${room}호):`, e);
      }

      // 조건 1: 당월과 전월에 입금이 없음 OR 조건 2: 정산금 50만원 미만(마이너스 포함)
      const isPaymentMissing = !hasPaymentInTargetMonths;
      const isLowSettlement = settle < 500000; // 50만원 미만 (마이너스 포함)
      
      if (isPaymentMissing || isLowSettlement) {
        result.push({
          room: room,
          name: name || '-',
          contact: contact || '-',
          moveIn: moveIn ? Utilities.formatDate(new Date(moveIn), tz, 'yyyy-MM-dd') : '-',
          settle: settle,
          remark: remark || '-'
        });
      }
    });

    // 호실 번호순 정렬
    result.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));

    return {
      success: true,
      data: result,
      message: `${currentMonth}, ${lastMonth} 입금이 없거나 정산금 50만원 미만인 ${result.length}개 세대`
    };

  } catch (e) {
    console.error('getBadDebtors 오류:', e);
    return { success: false, message: e.toString() };
  }
}

/* ═══════════════════════════════════════════════════════════
   🗂️ 아카이브 시스템 - 데이터 보존 퇴실 처리
   ═══════════════════════════════════════════════════════════ */

// 아카이브 시트 이름 상수
const ARCHIVE_TENANT_SHEET = '입주아카이브';
const ARCHIVE_PAYMENT_SHEET = '입금아카이브';
const ARCHIVE_USAGE_SHEET = '사용량아카이브';

/**
 * 아카이브 시트들을 생성하고 헤더를 설정합니다.
 */
function ensureArchiveSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 입주아카이브 시트 생성
  let tenantArchive = ss.getSheetByName(ARCHIVE_TENANT_SHEET);
  if (!tenantArchive) {
    tenantArchive = ss.insertSheet(ARCHIVE_TENANT_SHEET);
    tenantArchive.getRange(1, 1, 1, 17).setValues([[
      '호실', '성함', '연락처', '계약일', '입주일', '퇴실일', '계약기간', '담당자',
      '보증금', '월세', '관리비', '주차비', '주차여부', '특이사항',
      '아카이브날짜', '아카이브처리자', '비고'
    ]]);
    tenantArchive.getRange(1, 1, 1, 17).setFontWeight('bold').setBackground('#e8f4f8');
  }
  
  // 입금아카이브 시트 생성
  let paymentArchive = ss.getSheetByName(ARCHIVE_PAYMENT_SHEET);
  if (!paymentArchive) {
    paymentArchive = ss.insertSheet(ARCHIVE_PAYMENT_SHEET);
    paymentArchive.getRange(1, 1, 1, 8).setValues([[
      '호실', '금액', '담당자', '구분', '날짜', '메모',
      '아카이브날짜', '아카이브처리자'
    ]]);
    paymentArchive.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#e8f4f8');
  }
  
  // 사용량아카이브 시트 생성
  let usageArchive = ss.getSheetByName(ARCHIVE_USAGE_SHEET);
  if (!usageArchive) {
    usageArchive = ss.insertSheet(ARCHIVE_USAGE_SHEET);
    usageArchive.getRange(1, 1, 1, 8).setValues([[
      '호실', '월', '전기료', '가스료', '수도료', '주차비2',
      '아카이브날짜', '아카이브처리자'
    ]]);
    usageArchive.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#e8f4f8');
  }
  
  console.log('✅ 아카이브 시트들 생성 완료');
}

/**
 * 안전한 퇴실 처리 - 데이터를 아카이브로 이동
 * @param {string} room - 호실번호
 * @param {string} outDate - 퇴실일 (선택사항)
 * @param {string} archiveBy - 처리자
 * @return {object} 처리 결과
 */
function removeTenantWithArchive(room, outDate, archiveBy = 'System') {
  room = String(room || '').trim();
  if (!room) {
    return { success: false, message: '호실번호가 필요합니다.' };
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const paySh = ss.getSheetByName(PAYMENT_SHEET);
    const usageSh = ss.getSheetByName(USAGE_SHEET);
    
    if (!dataSh) {
      return { success: false, message: '입주데이터 시트를 찾을 수 없습니다.' };
    }
    
    // 아카이브 시트들 준비
    ensureArchiveSheets();
    const tenantArchive = ss.getSheetByName(ARCHIVE_TENANT_SHEET);
    const paymentArchive = ss.getSheetByName(ARCHIVE_PAYMENT_SHEET);
    const usageArchive = ss.getSheetByName(ARCHIVE_USAGE_SHEET);
    
    // 호실 찾기
    const colA = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                      .getValues().flat().map(v => String(v).trim());
    const rawIdx = colA.indexOf(room);
    
    if (rawIdx < 0) {
      return { success: false, message: `${room}호를 찾을 수 없습니다.` };
    }
    
    const rowNum = DATA_START_ROW + rawIdx;
    const archiveDate = new Date();
    const exitDate = outDate ? new Date(outDate) : archiveDate;
    
    // 1. 입주 데이터 아카이브
    const tenantData = dataSh.getRange(rowNum, 1, 1, 14).getValues()[0];
    const tenantArchiveRow = [
      ...tenantData.slice(0, 5),  // 호실~입주일
      exitDate,                   // 퇴실일
      ...tenantData.slice(6, 14), // 계약기간~특이사항
      archiveDate,                // 아카이브날짜
      archiveBy,                  // 아카이브처리자
      `${room}호 퇴실 처리`        // 비고
    ];
    tenantArchive.appendRow(tenantArchiveRow);
    
    // 2. 입금 데이터 아카이브
    let paymentsCount = 0;
    if (paySh && paySh.getLastRow() > 1) {
      const paymentData = paySh.getRange(2, 1, paySh.getLastRow() - 1, 6).getValues();
      const paymentRowsToDelete = [];
      
      for (let i = 0; i < paymentData.length; i++) {
        const row = paymentData[i];
        if (String(row[0]).trim() === room) {
          // 아카이브에 복사
          const archiveRow = [
            ...row,           // 기존 6개 열
            archiveDate,      // 아카이브날짜
            archiveBy         // 아카이브처리자
          ];
          paymentArchive.appendRow(archiveRow);
          paymentRowsToDelete.push(i + 2); // 실제 행 번호 (2부터 시작)
          paymentsCount++;
        }
      }
      
      // 역순으로 삭제 (인덱스 변경 방지)
      paymentRowsToDelete.reverse().forEach(rowIdx => {
        paySh.deleteRow(rowIdx);
      });
    }
    
    // 3. 사용량 데이터 아카이브
    let usagesCount = 0;
    if (usageSh && usageSh.getLastRow() > 1) {
      const usageData = usageSh.getRange(2, 1, usageSh.getLastRow() - 1, 6).getValues();
      const usageRowsToDelete = [];
      
      for (let i = 0; i < usageData.length; i++) {
        const row = usageData[i];
        if (String(row[0]).trim() === room) {
          // 아카이브에 복사
          const archiveRow = [
            ...row,           // 기존 6개 열
            archiveDate,      // 아카이브날짜
            archiveBy         // 아카이브처리자
          ];
          usageArchive.appendRow(archiveRow);
          usageRowsToDelete.push(i + 2); // 실제 행 번호 (2부터 시작)
          usagesCount++;
        }
      }
      
      // 역순으로 삭제 (인덱스 변경 방지)
      usageRowsToDelete.reverse().forEach(rowIdx => {
        usageSh.deleteRow(rowIdx);
      });
    }
    
    // 4. 입주 데이터에서 퇴실 처리 (공실로 변경)
    dataSh.getRange(rowNum, 2).setValue('공실');        // 성함 -> 공실
    dataSh.getRange(rowNum, 3, 1, 12).clearContent();  // 연락처~특이사항 초기화
    dataSh.getRange(rowNum, 6).setValue(exitDate)      // 퇴실일 설정
          .setNumberFormat('yyyy-MM-dd');
    
    // 5. 아카이브 시트 서식 적용
    const lastTenantRow = tenantArchive.getLastRow();
    tenantArchive.getRange(lastTenantRow, 4, 1, 2).setNumberFormat('yyyy-MM-dd'); // 계약일, 입주일
    tenantArchive.getRange(lastTenantRow, 6).setNumberFormat('yyyy-MM-dd');       // 퇴실일
    tenantArchive.getRange(lastTenantRow, 9, 1, 4).setNumberFormat('"₩"#,##0');  // 보증금~주차비
    tenantArchive.getRange(lastTenantRow, 15).setNumberFormat('yyyy-MM-dd hh:mm'); // 아카이브날짜
    
    if (paymentsCount > 0) {
      const paymentStartRow = paymentArchive.getLastRow() - paymentsCount + 1;
      paymentArchive.getRange(paymentStartRow, 2, paymentsCount, 1).setNumberFormat('"₩"#,##0'); // 금액
      paymentArchive.getRange(paymentStartRow, 5, paymentsCount, 1).setNumberFormat('yyyy-MM-dd'); // 날짜
      paymentArchive.getRange(paymentStartRow, 7, paymentsCount, 1).setNumberFormat('yyyy-MM-dd hh:mm'); // 아카이브날짜
    }
    
    if (usagesCount > 0) {
      const usageStartRow = usageArchive.getLastRow() - usagesCount + 1;
      usageArchive.getRange(usageStartRow, 2, usagesCount, 1).setNumberFormat('yyyy-MM');        // 월
      usageArchive.getRange(usageStartRow, 3, usagesCount, 4).setNumberFormat('"₩"#,##0');      // 전기~주차비2
      usageArchive.getRange(usageStartRow, 7, usagesCount, 1).setNumberFormat('yyyy-MM-dd hh:mm'); // 아카이브날짜
    }
    
    console.log(`✅ ${room}호 아카이브 처리 완료: 입금 ${paymentsCount}건, 사용량 ${usagesCount}건`);
    
    return {
      success: true,
      message: `${room}호 안전 퇴실 처리 완료`,
      archived: {
        payments: paymentsCount,
        usages: usagesCount,
        archivedDate: archiveDate.toISOString(),
        archivedBy: archiveBy
      }
    };
    
  } catch (error) {
    console.error(`❌ ${room}호 아카이브 처리 오류:`, error);
    return { success: false, message: `오류: ${error.toString()}` };
  }
}

/**
 * 아카이브에서 데이터 복구
 * @param {string} room - 호실번호
 * @param {string} restoreBy - 복구자
 * @return {object} 복구 결과
 */
function restoreFromArchive(room, restoreBy = 'System') {
  room = String(room || '').trim();
  if (!room) {
    return { success: false, message: '호실번호가 필요합니다.' };
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSh = ss.getSheetByName(DATA_SHEET);
    const paySh = ss.getSheetByName(PAYMENT_SHEET);
    const usageSh = ss.getSheetByName(USAGE_SHEET);
    
    ensureArchiveSheets();
    const tenantArchive = ss.getSheetByName(ARCHIVE_TENANT_SHEET);
    const paymentArchive = ss.getSheetByName(ARCHIVE_PAYMENT_SHEET);
    const usageArchive = ss.getSheetByName(ARCHIVE_USAGE_SHEET);
    
    if (!tenantArchive || !paymentArchive || !usageArchive) {
      return { success: false, message: '아카이브 시트를 찾을 수 없습니다.' };
    }
    
    // 1. 입주 데이터 복구
    const tenantArchiveData = tenantArchive.getDataRange().getValues();
    let tenantFound = false;
    let tenantRowToDelete = -1;
    
    for (let i = 1; i < tenantArchiveData.length; i++) {
      const row = tenantArchiveData[i];
      if (String(row[0]).trim() === room) {
        // 입주데이터 시트에서 해당 호실 찾기
        const colA = dataSh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1)
                          .getValues().flat().map(v => String(v).trim());
        const rawIdx = colA.indexOf(room);
        
        if (rawIdx >= 0) {
          const rowNum = DATA_START_ROW + rawIdx;
          // 아카이브 데이터를 원래 위치로 복원 (아카이브 정보 제외)
          const restoreData = row.slice(0, 14); // 첫 14개 열만 (원본 데이터)
          dataSh.getRange(rowNum, 1, 1, 14).setValues([restoreData]);
          
          // 서식 적용
          dataSh.getRange(rowNum, 4, 1, 2).setNumberFormat('yyyy-MM-dd'); // 계약일, 입주일
          dataSh.getRange(rowNum, 6).setNumberFormat('yyyy-MM-dd');       // 퇴실일
          dataSh.getRange(rowNum, 9, 1, 4).setNumberFormat('"₩"#,##0');  // 보증금~주차비
          
          tenantFound = true;
          tenantRowToDelete = i + 1; // 시트 행 번호 (1부터 시작)
          break;
        }
      }
    }
    
    if (!tenantFound) {
      return { success: false, message: `${room}호의 아카이브 데이터를 찾을 수 없습니다.` };
    }
    
    // 2. 입금 데이터 복구
    let paymentsCount = 0;
    if (paymentArchive.getLastRow() > 1) {
      const paymentArchiveData = paymentArchive.getDataRange().getValues();
      const paymentRowsToDelete = [];
      
      for (let i = 1; i < paymentArchiveData.length; i++) {
        const row = paymentArchiveData[i];
        if (String(row[0]).trim() === room) {
          // 원본 데이터 복구 (아카이브 정보 제외)
          const restoreData = row.slice(0, 6);
          paySh.appendRow(restoreData);
          paymentRowsToDelete.push(i + 1); // 시트 행 번호
          paymentsCount++;
        }
      }
      
      // 아카이브에서 삭제 (역순)
      paymentRowsToDelete.reverse().forEach(rowIdx => {
        paymentArchive.deleteRow(rowIdx);
      });
      
      // 복구된 데이터 서식 적용
      if (paymentsCount > 0) {
        const startRow = paySh.getLastRow() - paymentsCount + 1;
        paySh.getRange(startRow, 2, paymentsCount, 1).setNumberFormat('"₩"#,##0'); // 금액
        paySh.getRange(startRow, 5, paymentsCount, 1).setNumberFormat('yyyy-MM-dd'); // 날짜
      }
    }
    
    // 3. 사용량 데이터 복구
    let usagesCount = 0;
    if (usageArchive.getLastRow() > 1) {
      const usageArchiveData = usageArchive.getDataRange().getValues();
      const usageRowsToDelete = [];
      
      for (let i = 1; i < usageArchiveData.length; i++) {
        const row = usageArchiveData[i];
        if (String(row[0]).trim() === room) {
          // 원본 데이터 복구 (아카이브 정보 제외)
          const restoreData = row.slice(0, 6);
          usageSh.appendRow(restoreData);
          usageRowsToDelete.push(i + 1); // 시트 행 번호
          usagesCount++;
        }
      }
      
      // 아카이브에서 삭제 (역순)
      usageRowsToDelete.reverse().forEach(rowIdx => {
        usageArchive.deleteRow(rowIdx);
      });
      
      // 복구된 데이터 서식 적용
      if (usagesCount > 0) {
        const startRow = usageSh.getLastRow() - usagesCount + 1;
        usageSh.getRange(startRow, 2, usagesCount, 1).setNumberFormat('yyyy-MM');    // 월
        usageSh.getRange(startRow, 3, usagesCount, 4).setNumberFormat('"₩"#,##0');  // 전기~주차비2
      }
    }
    
    // 4. 입주 아카이브에서 삭제
    tenantArchive.deleteRow(tenantRowToDelete);
    
    console.log(`✅ ${room}호 아카이브 복구 완료: 입금 ${paymentsCount}건, 사용량 ${usagesCount}건`);
    
    return {
      success: true,
      message: `${room}호 데이터 복구 완료`,
      restored: {
        payments: paymentsCount,
        usages: usagesCount,
        restoredDate: new Date().toISOString(),
        restoredBy: restoreBy
      }
    };
    
  } catch (error) {
    console.error(`❌ ${room}호 복구 오류:`, error);
    return { success: false, message: `오류: ${error.toString()}` };
  }
}

/**
 * 텔레그램용 아카이브 목록 조회
 * @return {object} 아카이브 목록
 */
function getTelegramArchivedRooms() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tenantArchive = ss.getSheetByName(ARCHIVE_TENANT_SHEET);
    
    if (!tenantArchive || tenantArchive.getLastRow() <= 1) {
      return { success: false, message: '📁 아카이브된 호실이 없습니다.' };
    }
    
    const data = tenantArchive.getRange(2, 1, tenantArchive.getLastRow() - 1, 17).getValues();
    const tz = Session.getScriptTimeZone();
    
    if (data.length === 0) {
      return { success: false, message: '📁 아카이브된 호실이 없습니다.' };
    }
    
    // 호실별로 그룹화 (같은 호실이 여러 번 아카이브될 수 있음)
    const roomGroups = {};
    data.forEach(row => {
      const room = String(row[0]).trim();
      const name = String(row[1]).trim();
      const archiveDate = row[14];
      const archiveBy = String(row[15]).trim();
      
      if (!roomGroups[room]) {
        roomGroups[room] = [];
      }
      
      roomGroups[room].push({
        name: name,
        archiveDate: archiveDate ? Utilities.formatDate(archiveDate, tz, 'yyyy-MM-dd HH:mm') : '-',
        archiveBy: archiveBy
      });
    });
    
    // 메시지 생성
    let message = '📁 아카이브된 호실 목록\n\n';
    const rooms = Object.keys(roomGroups).sort((a, b) => parseInt(a) - parseInt(b));
    
    rooms.forEach(room => {
      const records = roomGroups[room];
      message += `🏠 ${room}호\n`;
      
      records.forEach((record, index) => {
        const prefix = records.length > 1 ? `  ${index + 1}. ` : '  ';
        message += `${prefix}${record.name} (${record.archiveDate})\n`;
        message += `${prefix}처리자: ${record.archiveBy}\n`;
      });
      message += '\n';
    });
    
    message += `💡 상세 조회: "${rooms[0]}호아카이브"\n`;
    message += `🔄 복구: "${rooms[0]}호복구"`;
    
    return { success: true, message: message };
    
  } catch (error) {
    console.error('❌ 아카이브 목록 조회 오류:', error);
    return { success: false, message: `오류: ${error.toString()}` };
  }
}

/**
 * 텔레그램용 특정 호실 아카이브 상세 조회
 * @param {string} room - 호실번호
 * @return {object} 아카이브 상세 정보
 */
function getTelegramArchivedRoomDetail(room) {
  room = String(room || '').trim();
  if (!room) {
    return { success: false, message: '호실번호가 필요합니다.' };
  }
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tenantArchive = ss.getSheetByName(ARCHIVE_TENANT_SHEET);
    const paymentArchive = ss.getSheetByName(ARCHIVE_PAYMENT_SHEET);
    const usageArchive = ss.getSheetByName(ARCHIVE_USAGE_SHEET);
    
    if (!tenantArchive) {
      return { success: false, message: '📁 아카이브 시트를 찾을 수 없습니다.' };
    }
    
    const tz = Session.getScriptTimeZone();
    let message = `📁 ${room}호 아카이브 상세\n\n`;
    
    // 1. 입주 정보
    let tenantFound = false;
    if (tenantArchive.getLastRow() > 1) {
      const tenantData = tenantArchive.getRange(2, 1, tenantArchive.getLastRow() - 1, 17).getValues();
      
      tenantData.forEach(row => {
        if (String(row[0]).trim() === room) {
          tenantFound = true;
          const name = String(row[1]).trim();
          const contact = String(row[2]).trim();
          const moveIn = row[4] ? Utilities.formatDate(row[4], tz, 'yyyy-MM-dd') : '-';
          const moveOut = row[5] ? Utilities.formatDate(row[5], tz, 'yyyy-MM-dd') : '-';
          const deposit = row[8] ? `₩${parseInt(row[8]).toLocaleString()}` : '-';
          const rent = row[9] ? `₩${parseInt(row[9]).toLocaleString()}` : '-';
          const mgmt = row[10] ? `₩${parseInt(row[10]).toLocaleString()}` : '-';
          const archiveDate = row[14] ? Utilities.formatDate(row[14], tz, 'yyyy-MM-dd HH:mm') : '-';
          const archiveBy = String(row[15]).trim();
          
          message += `👤 입주자 정보:\n`;
          message += `  • 성명: ${name}\n`;
          message += `  • 연락처: ${contact}\n`;
          message += `  • 입주일: ${moveIn}\n`;
          message += `  • 퇴실일: ${moveOut}\n`;
          message += `  • 보증금: ${deposit}\n`;
          message += `  • 월세: ${rent}\n`;
          message += `  • 관리비: ${mgmt}\n`;
          message += `  • 아카이브: ${archiveDate}\n`;
          message += `  • 처리자: ${archiveBy}\n\n`;
        }
      });
    }
    
    if (!tenantFound) {
      return { success: false, message: `❌ ${room}호의 아카이브 데이터를 찾을 수 없습니다.` };
    }
    
    // 2. 입금 기록
    let paymentsCount = 0;
    let totalPayments = 0;
    if (paymentArchive && paymentArchive.getLastRow() > 1) {
      const paymentData = paymentArchive.getRange(2, 1, paymentArchive.getLastRow() - 1, 8).getValues();
      
      paymentData.forEach(row => {
        if (String(row[0]).trim() === room) {
          paymentsCount++;
          totalPayments += (parseFloat(row[1]) || 0);
        }
      });
    }
    
    // 3. 사용량 기록
    let usagesCount = 0;
    if (usageArchive && usageArchive.getLastRow() > 1) {
      const usageData = usageArchive.getRange(2, 1, usageArchive.getLastRow() - 1, 8).getValues();
      
      usageData.forEach(row => {
        if (String(row[0]).trim() === room) {
          usagesCount++;
        }
      });
    }
    
    message += `📊 보관된 데이터:\n`;
    message += `  • 입금 기록: ${paymentsCount}건\n`;
    message += `  • 총 입금액: ₩${totalPayments.toLocaleString()}\n`;
    message += `  • 사용량 기록: ${usagesCount}건\n\n`;
    
    message += `🔄 복구하려면: "${room}호복구"`;
    
    return { success: true, message: message };
    
  } catch (error) {
    console.error(`❌ ${room}호 아카이브 상세 조회 오류:`, error);
    return { success: false, message: `오류: ${error.toString()}` };
  }
}

/* ═══════════════════════════════════════════════════════════
   🔚 아카이브 시스템 끝
   ═══════════════════════════════════════════════════════════ */



/**
 * 📜 청구표 빠른 생성 함수 (실행 시간 최적화)
 * @return {object} 청구표 데이터
 */
function getBillingListFast() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('입주데이터');
    const rooms = [];
    const DATA_START_ROW = 2;
    const DATA_END_ROW = 124;
    const BLOCK_START_ROW = 125;
    const ROWS_PER_ROOM = 17;

    // 호실 목록 추출
    const roomVals = sh.getRange(DATA_START_ROW, 1, DATA_END_ROW - DATA_START_ROW + 1, 1).getValues();
    for (let i = 0; i < roomVals.length; i++) {
      const v = String(roomVals[i][0]).trim();
      if (v) rooms.push(v);
    }

    // 입주데이터 bulk read (특이사항 2개까지 포함, 열 개수 맞게 조정)
    const dataValues = sh.getRange(DATA_START_ROW, 1, rooms.length, 15).getValues();

    // 정산블록 bulk read
    const colCount = sh.getLastColumn();
    const blockVals = sh.getRange(BLOCK_START_ROW, 1, rooms.length * ROWS_PER_ROOM, colCount).getDisplayValues();

    // 오늘 날짜, 이번달 정보
    const now = new Date();
    const tz = Session.getScriptTimeZone();
    const thisMonth = Utilities.formatDate(now, tz, 'yyyy-MM');
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    console.log(`=== 현재 날짜 정보 ===`);
    console.log(`현재 날짜: ${now}`);
    console.log(`이번달: ${thisMonth}`);
    console.log(`년: ${year}, 월: ${month}, 일수: ${daysInMonth}`);

    const result = [];
    for (let i = 0; i < rooms.length; i++) {
      const blockBase = i * ROWS_PER_ROOM;
      const roomNo = rooms[i];
      const row = dataValues[i];
      const monthHeaders = blockVals[blockBase].slice(2);
      const monthIdx = monthHeaders.indexOf(thisMonth);

      // 미납금, 청구내역, 입금액 등 추출
      let currentArrears = 0, currentBilling = 0, currentPayment = 0;
      if (monthIdx !== -1) {
        currentArrears = parseNumber(blockVals[blockBase + 12][monthIdx + 2]);
        currentBilling = parseNumber(blockVals[blockBase + 10][monthIdx + 2]);
        currentPayment = parseNumber(blockVals[blockBase + 11][monthIdx + 2]);
      }

      // term 처리 (Date 객체인 경우 문자열로 변환)
      let termStr = '';
      if (row[5]) {
        if (row[5] instanceof Date) {
          termStr = Utilities.formatDate(row[5], tz, 'yyyy-MM-dd');
        } else {
          termStr = String(row[5]);
        }
      }

      // 당월 입주자 일할계산 (입주일이 이번달인 경우)
      let currentTenant = 0;
      let moveIn = row[4]; // E열 (입주일) - 실제로는 4번째 인덱스
      let rent = parseNumber(row[9]); // J열 (월세) - 실제로는 9번째 인덱스
      let mgmt = parseNumber(row[10]); // K열 (관리비) - 실제로는 10번째 인덱스
      let park = parseNumber(row[11]); // L열 (주차비) - 실제로는 11번째 인덱스
      
      console.log(`${roomNo}호 데이터 확인: 입주일=${moveIn}, 월세=${rent}, 관리비=${mgmt}, 주차비=${park}`);
      
      if (moveIn) {
        console.log(`${roomNo}호 원본 입주일: "${moveIn}" (${typeof moveIn})`);
        
        let moveInDate = null;
        
        // 이미 Date 객체인 경우
      if (moveIn instanceof Date) {
          moveInDate = moveIn;
          console.log(`${roomNo}호 이미 Date 객체: ${moveInDate}`);
        }
        // 문자열인 경우
        else if (typeof moveIn === 'string' && moveIn.length > 0) {
          // 한글 형식을 ISO 형식으로 변환 (2025. 7. 19. → 2025-07-19)
          let isoDate = convertKoreanToIsoDate(moveIn);
          console.log(`${roomNo}호 ISO 변환 결과: "${isoDate}"`);
          
          if (isoDate) {
            moveInDate = new Date(isoDate);
            console.log(`${roomNo}호 Date 객체 생성: ${moveInDate}`);
          } else {
            moveInDate = parseKoreanDate(moveIn);
            console.log(`${roomNo}호 기존 파싱 결과: ${moveInDate}`);
          }
        }
        
        if (moveInDate) {
          const ym = Utilities.formatDate(moveInDate, tz, 'yyyy-MM');
          console.log(`${roomNo}호 날짜 파싱: ${moveIn} → ${ym}, 이번달=${thisMonth}`);
        if (ym === thisMonth) {
            const startDay = moveInDate.getDate();
          const days = daysInMonth - startDay + 1;
            const totalMonthly = rent + mgmt + park;
            currentTenant = Math.round((totalMonthly / daysInMonth) * days);
            console.log(`${roomNo}호 당월입주자 계산: ${moveIn} → ${ym}, ${startDay}일부터 ${days}일, ${totalMonthly}원 → ${currentTenant}원`);
          } else {
            console.log(`${roomNo}호 이번달 아님: ${ym} ≠ ${thisMonth}`);
          }
        } else {
          console.log(`${roomNo}호 날짜 파싱 실패: ${moveIn}`);
        }
      } else {
        console.log(`${roomNo}호 입주일 없음: ${moveIn}`);
      }

        result.push({
        room: roomNo,
        name: String(row[1] || ''),
        contact: String(row[2] || ''),
        moveIn: String(row[4] || ''),
        term: termStr,
        rent: rent,
        mgmt: mgmt,
        park: park,
        currentArrears,
        currentBilling,
        currentPayment,
        currentTenant,
        remark1: String(row[13] || ''),
        remark2: String(row[14] || '')
      });
    }
    return { success: true, data: result };
  } catch (e) {
    return { success: false, message: e.toString(), data: [] };
  }
}

// 금액 파싱 유틸
function parseNumber(v) {
  if (!v) return 0;
  console.log('parseNumber 입력값:', v, typeof v);
  
  let str = String(v);
  
  // ₩ 기호 제거
  str = str.replace(/₩/g, '');
  
  // 쉼표 제거
  str = str.replace(/,/g, '');
  
  // 숫자와 마이너스만 남기고 모두 제거
  str = str.replace(/[^\d\-]/g, '');
  
  const result = parseInt(str, 10) || 0;
  console.log('parseNumber 결과:', v, '→', str, '→', result);
  
  return result;
}

// 한글 날짜 형식을 ISO 형식으로 변환 (2025. 7. 19. → 2025-07-19)
function convertKoreanToIsoDate(str) {
  try {
    console.log('convertKoreanToIsoDate 입력:', str);
    const match = String(str).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    console.log('정규식 매치 결과:', match);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      const result = `${year}-${month}-${day}`;
      console.log('변환 결과:', result);
      return result;
    }
    console.log('매치 실패');
    return null;
  } catch (e) {
    console.error('변환 오류:', e);
    return null;
  }
}



// 날짜 파싱 (한글 형식: 2025. 7. 1., ISO 형식: 2025-07-01)
function parseKoreanDate(str) {
  try {
    console.log('날짜 파싱 시도:', str, typeof str);
    
    // 이미 Date 객체인 경우
    if (str instanceof Date) {
      return str;
    }
    
    // 문자열이 아닌 경우
    if (typeof str !== 'string') {
      console.log('문자열이 아님:', str);
      return null;
    }
    
    // ISO 형식: "2025-07-19"
    const isoMatch = String(str).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1; // 0-based month
      const day = Number(isoMatch[3]);
      const result = new Date(year, month, day);
      console.log('ISO 파싱 결과:', year, month+1, day, result);
      return result;
    }
    
    // 한글 형식: "2025. 7. 1."
    const koreanMatch = String(str).match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./);
    if (koreanMatch) {
      const year = Number(koreanMatch[1]);
      const month = Number(koreanMatch[2]) - 1; // 0-based month
      const day = Number(koreanMatch[3]);
      const result = new Date(year, month, day);
      console.log('한글 파싱 결과:', year, month+1, day, result);
      return result;
    }
    
    console.log('모든 형식 매치 실패:', str);
    return null;
  } catch (e) {
    console.error('날짜 파싱 오류:', str, e);
    return null;
  }
}

// 전체 현황 (미수금/정산) - 최적화 버전
function getAllRoomStatus(params = {}) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) return [];
  
  const rooms = getRoomList();
  const res = [];
  
  rooms.forEach((room, idx) => {
    const start = REPORT_BASE + idx * (ROWS_PER_ROOM + GAP);
    const dataRow = DATA_START_ROW + idx;
    
    // 입주데이터 시트에서 정확한 열 인덱스로 데이터 읽기
    const name = String(sh.getRange(dataRow, 2).getValue()).trim();        // B열: 성함
    const contact = String(sh.getRange(dataRow, 3).getDisplayValue()).trim(); // C열: 연락처
    const remark = String(sh.getRange(dataRow, 14).getDisplayValue()).trim(); // N열: 특이사항
    
    // 리포트 블록에서 정산금/미납금 읽기
    const remain = parseFloat(sh.getRange(start + IDX.REMAIN, 3).getValue()) || 0; // 정산금
    const unpaid = parseFloat(sh.getRange(start + IDX.TOTAL_ARREARS, 3).getValue()) || 0; // 총미납금
    
    if (!room) return;
    // 필터: 정산금액이 maxWon보다 작은 호실만 (마이너스 포함)
    if (params && params.maxWon !== undefined && remain >= params.maxWon) return;
    
    res.push({ 
      room, 
      name, 
      contact, 
      remain, 
      unpaid, 
      remark 
    });
  });
  
  return res;
}

/**
 * 월별 현황 상세 (UI/텔레그램/엑셀 등 완전 일치)
 * @param {string} month - 'YYYY-MM'
 * @return {object} { success, data: { month, rooms, totalBilling, totalPayment } }
 */
function getMonthlyDetail(month) {
  try {
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return { success: false, message: '올바른 월 형식이 아닙니다 (예: 2025-07)' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(DATA_SHEET);
    const paySh = ss.getSheetByName(PAYMENT_SHEET);
    if (!sh) return { success: false, message: '입주데이터 시트를 찾을 수 없습니다' };
    const rooms = getRoomList();
    const tz = Session.getScriptTimeZone();
    const res = [];
    let totalBilling = 0, totalPayment = 0;
    rooms.forEach((room, idx) => {
      const start = REPORT_BASE + idx * (ROWS_PER_ROOM + GAP);
      const name = String(sh.getRange(DATA_START_ROW + idx, 2).getValue()).trim();
      const contact = String(sh.getRange(DATA_START_ROW + idx, 3).getDisplayValue()).trim();
      const remark = String(sh.getRange(DATA_START_ROW + idx, 14).getDisplayValue()).trim();
      // 헤더에서 월 인덱스 찾기 (정규표현식 오류 수정)
      const headerRow = sh.getRange(start, 3, 1, sh.getLastColumn() - 2).getDisplayValues()[0].map(h => String(h).replace(/[\.\u2010-\u2015]/g, '-').trim());
      const monthIdx = headerRow.indexOf(month);
      let billing = 0, payment = 0;
      if (monthIdx !== -1) {
        billing = parseFloat(sh.getRange(start + IDX.BILLING, 3 + monthIdx).getValue()) || 0;
        payment = parseFloat(sh.getRange(start + IDX.PAYMENT, 3 + monthIdx).getValue()) || 0;
      }
      // 정산금(잔액)
      const settle = parseFloat(sh.getRange(start + IDX.REMAIN, 3).getValue()) || 0;
      if (!room) return;
      res.push({ room, name, contact, billing, payment, settle, remark });
      totalBilling += billing;
      totalPayment += payment;
    });
    // 호실 번호순 정렬
    res.sort((a, b) => parseInt(a.room, 10) - parseInt(b.room, 10));
    return { success: true, data: { month, rooms: res, totalBilling, totalPayment } };
  } catch (e) {
    console.error('getMonthlyDetail 오류:', e);
    return { success: false, message: e.toString() };
  }
}




