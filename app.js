// ==========================================
// 1. Firebase 및 전역 변수 초기화
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAYm_2RHvJwlUz1ztRJrc41D7dtD7xbgSM",
    authDomain: "mokpo-vee-data.firebaseapp.com",
    projectId: "mokpo-vee-data",
    storageBucket: "mokpo-vee-data.firebasestorage.app",
    messagingSenderId: "460234232471",
    appId: "1:460234232471:web:5d90b727c651fe51accfd2"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let cloudCustomData = {};
let customAddedShips = [];
let cloudRefItems = {};
let currentViewerContext = null;
let boardFilterMode = 'all';

let countdownIntervalId = null;
let nextRefreshRemainingSec = 300;
let latestRawWarnText = "기상청 특보 통보문을 수신 중입니다...";

let stationHistoryMap = {};

const DEFAULT_KMA_AUTHKEY = "s0C3VEw6ScOAt1RMOinDFQ";
const DEFAULT_NMPNT_KEY = "A8ECE1B4-0A1E-43E9-A5D4-7D4D906FC401";
const DEFAULT_KHOA_KEY = "47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3";

function degToDirection(deg) {
    if (isNaN(deg) || deg === null || deg === undefined) return "북서";
    const dirs = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"];
    let idx = Math.round(deg / 22.5) % 16;
    return dirs[idx] + "풍";
}

let latestBuoyData = {
    '신안':       { stnId: '22183',   type: 'buoy',   name: '신안 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '추자도':     { stnId: '22184',   type: 'buoy',   name: '추자도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '칠발도':     { stnId: '22102',   type: 'buoy',   name: '칠발도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '홍도':       { stnId: '22298',   type: 'buoy',   name: '홍도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '가거도':     { stnId: '22297',   type: 'buoy',   name: '가거도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '흑산도':     { stnId: '22193',   type: 'buoy',   name: '흑산도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '옥도':       { stnId: '308',     type: 'aws',    name: '옥도 AWS',          wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '해수서파고': { stnId: '959',     type: 'beacon', name: '해수서 등표',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '안좌':       { stnId: '1079001', type: 'nmpnt',  name: '안좌터미널(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '외달도':     { stnId: '1079008', type: 'nmpnt',  name: '외달도등표(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '가거도등대': { stnId: '1079003', type: 'nmpnt',  name: '가거도등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '홍도등대':   { stnId: '1079002', type: 'nmpnt',  name: '홍도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '하조도':     { stnId: '1079005', type: 'nmpnt',  name: '하조도등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '계마항':     { stnId: '1079007', type: 'nmpnt',  name: '계마항등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '추자조사원': { obsCode: 'KG_0025', type: 'khoa', name: '추자부이(조사원)',   wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '맹골조사원': { obsCode: 'KG_0102', type: 'khoa', name: '맹골부이(조사원)',   wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '가거초조사원':{ obsCode: 'IE_0061', type: 'khoa', name: '가거초기지(조사원)', wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '칠산조사원': { obsCode: 'KG_0024', type: 'khoa', name: '칠산부이(조사원)',   wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '향화도조위': { obsCode: 'DT_0065', type: 'khoa', name: '향화도조위(조사원)', wind: '-', windDir: '-', sigWave: null, maxWave: null }
};

let activeSeaWarnings = {
    '서해남부북쪽안쪽먼바다': null,
    '서해남부남쪽안쪽먼바다': null,
    '서해남부앞바다(전남중부)': null,
    '서해남부앞바다(전남남부)': null,
    '서해남부앞바다(전남북부)': null,
    '남해서부서쪽먼바다': null,
    '제주도북부앞바다': null
};

let seaWarningTimestamps = {};

const defaultRefItems = {
    'default_ref_1': { id: 'default_ref_1', title: '🗺️ 기상특보 해역지도', fallbackNames: ['기상특보 해역지도', '0. 목포관내 해역 특보구역'], order: 1 },
    'default_ref_2': { id: 'default_ref_2', title: '🌊 평수구역 기준선', fallbackNames: ['평수구역 기준선'], order: 2 }
};

auth.onAuthStateChanged(user => {
    const overlay = document.getElementById("login-overlay");
    const userBar = document.getElementById("user-bar");
    if (user) {
        if (overlay) overlay.style.display = "none";
        if (userBar) userBar.style.display = "flex";
        let displayId = user.email ? user.email.split('@')[0] : '사용자';
        const userTextEl = document.getElementById("user-id-text");
        if (userTextEl) userTextEl.innerText = `👤 ${displayId}`;
        initRealtimeSync();
        loadSavedApiKey();
    } else {
        if (overlay) overlay.style.display = "flex";
        if (userBar) userBar.style.display = "none";
    }
});

window.handleLogin = function() {
    const idInput = document.getElementById("login-id");
    const pwInput = document.getElementById("login-pw");
    const errEl = document.getElementById("login-error");
    let rawId = idInput ? idInput.value.trim() : '';
    const pw = pwInput ? pwInput.value.trim() : '';
    if (errEl) errEl.style.display = "none";
    if (!rawId || !pw) {
        if (errEl) { errEl.style.display = "block"; errEl.innerText = "아이디와 비밀번호를 모두 입력하세요."; }
        return;
    }
    let email = rawId.includes('@') ? rawId : `${rawId}@komsa.or.kr`;
    auth.signInWithEmailAndPassword(email, pw).catch(err => {
        if (errEl) {
            errEl.style.display = "block";
            errEl.innerText = `로그인 실패: ${err.message}`;
        }
    });
};

window.handleLogout = function() { auth.signOut(); };

window.switchMainTab = function(tab) {
    const shipsSec = document.getElementById('ships-section');
    const boardSec = document.getElementById('board-section');
    const btnShips = document.getElementById('tab-btn-ships');
    const btnBoard = document.getElementById('tab-btn-board');
    if (tab === 'ships') {
        if (shipsSec) shipsSec.style.display = 'block';
        if (boardSec) boardSec.style.display = 'none';
        if (btnShips) btnShips.classList.add('active');
        if (btnBoard) btnBoard.classList.remove('active');
        stopCountdownTimer();
    } else {
        if (shipsSec) shipsSec.style.display = 'none';
        if (boardSec) boardSec.style.display = 'block';
        if (btnShips) btnShips.classList.remove('active');
        if (btnBoard) btnBoard.classList.add('active');
        try { renderOperationBoard(); } catch (err) {}
        startCountdownTimer();
        fetchWeatherRealtime(true);
    }
};

function initRealtimeSync() {
    if (!auth.currentUser) return;
    db.collection("vessel_overrides").onSnapshot(snapshot => {
        cloudCustomData = {};
        customAddedShips = [];
        snapshot.forEach(doc => {
            let d = doc.data();
            if (d.isNewShip) customAddedShips.push({ id: doc.id, ...d });
            else cloudCustomData[doc.id] = d;
        });
        render();
        const boardSec = document.getElementById('board-section');
        if (boardSec && boardSec.style.display === 'block') { try { renderOperationBoard(); } catch(e){} }
    }, err => {});

    db.collection("reference_materials").onSnapshot(snapshot => {
        cloudRefItems = {};
        snapshot.forEach(doc => { cloudRefItems[doc.id] = doc.data(); });
        renderRefSection();
    }, err => {});
}

function parseVesselControlCriteria(rawName, decision, route, notes) {
    let fullText = ((rawName || '') + " " + (decision || '') + " " + (notes || '')).replace(/\s/g, '');
    let r = route || '';
    let tonnage = 0;
    let tonMatch = (rawName || '').match(/([\d,]+)\s*G\s*\/\s*T/i);
    if (tonMatch) tonnage = parseFloat(tonMatch[1].replace(/,/g, ''));

    let isCaptainOpinion = fullText.includes("선장의견") || fullText.includes("선장협의") || fullText.includes("선장의의견");
    let isOfficeDecision = fullText.includes("진도사무소") || fullText.includes("도초근무자") || fullText.includes("도초사무소") || fullText.includes("하의사무소") || fullText.includes("남강사무소");
    let officeName = fullText.includes("진도사무소") ? "진도파견지" : null;

    let windLimit = null;
    let windMatch = fullText.match(/(\d+(?:\.\d+)?)\s*m\/s/i);
    if (windLimit === null && windMatch) windLimit = parseFloat(windMatch[1]);

    let sigWaveLimit = null;
    let maxWaveLimit = null;
    let sigMatch = fullText.match(/유의파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (sigMatch) sigWaveLimit = parseFloat(sigMatch[1]);
    let maxMatch = fullText.match(/최대파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (maxMatch) maxWaveLimit = parseFloat(maxMatch[1]);

    let stations = [];
    if (fullText.includes("향화") || r.includes("향화")) stations.push('향화도조위');
    if (fullText.includes("외달") || r.includes("외달")) stations.push('외달도');
    if (fullText.includes("안좌") || fullText.includes("복호")) stations.push('안좌');
    if (fullText.includes("하조도") || fullText.includes("창유")) { stations.push('하조도'); stations.push('맹골조사원'); }
    if (fullText.includes("계마") || r.includes("계마") || r.includes("안마")) { stations.push('계마항'); stations.push('칠산조사원'); }
    if (fullText.includes("가거도") || r.includes("가거도")) { stations.push('가거도'); stations.push('가거도등대'); stations.push('가거초조사원'); }
    if (fullText.includes("해수서") || r.includes("율목")) { stations.push('해수서파고'); stations.push('맹골조사원'); }
    if (fullText.includes("옥도")) stations.push('옥도');
    if (fullText.includes("신안")) stations.push('신안');
    if (fullText.includes("칠발도")) stations.push('칠발도');
    if (fullText.includes("홍도")) { stations.push('홍도'); stations.push('홍도등대'); }
    if (fullText.includes("흑산도")) stations.push('흑산도');
    if (fullText.includes("추자도") || r.includes("제주")) { stations.push('추자도'); stations.push('추자조사원'); }

    if (stations.length === 0) {
        if (r.includes("율목")) stations = ['신안', '옥도', '해수서파고', '맹골조사원'];
        else if (r.includes("홍도") || r.includes("흑산")) stations = ['칠발도', '홍도'];
        else if (r.includes("제주")) stations = ['추자도', '추자조사원'];
        else if (r.includes("안마")) stations = ['계마항', '칠산조사원'];
        else stations = ['신안', '옥도'];
    }

    let relatedSeas = [];
    if (fullText.includes("북쪽안쪽먼바다")) relatedSeas.push("서해남부북쪽안쪽먼바다");
    if (fullText.includes("남쪽안쪽먼바다")) relatedSeas.push("서해남부남쪽안쪽먼바다");
    if (fullText.includes("전남중부앞바다")) relatedSeas.push("서해남부앞바다(전남중부)");
    if (fullText.includes("전남남부앞바다")) relatedSeas.push("서해남부앞바다(전남남부)");
    if (fullText.includes("전남북부앞바다")) relatedSeas.push("서해남부앞바다(전남북부)");
    if (fullText.includes("남해서부서쪽먼바다")) relatedSeas.push("남해서부서쪽먼바다");
    if (fullText.includes("제주도북부앞바다")) relatedSeas.push("제주도북부앞바다");

    let rawAreaText = ((rawName || '') + " " + (decision || '') + " " + (notes || ''));
    let areaMatch = rawAreaText.match(/\(([^)]*(?:평수|연해|앞바다|먼바다|근해)[^)]*)\)/);
    let navArea = areaMatch ? areaMatch[1].trim() : '';
    if (navArea.includes('핵심') || navArea.includes('통제')) navArea = '평수';

    return {
        tonnage, navArea, isCaptainOpinion, isOfficeDecision, officeName, stations,
        windLimit: windLimit || 12.0, sigWaveLimit, maxWaveLimit, relatedSeas,
        isPyungSuOnly: fullText.includes("(평수)") && !fullText.includes("연해"),
        isYulmokRoute: r.includes("율목")
    };
}

window.toggleMeteoDetailRow = function(shipCode) {
    const detailRow = document.getElementById(`meteo-detail-${shipCode}`);
    if (!detailRow) return;
    const isShowing = detailRow.style.display !== 'none';
    detailRow.style.display = isShowing ? 'none' : 'table-row';
    const icon = document.getElementById(`meteo-toggle-icon-${shipCode}`);
    if (icon) icon.innerText = isShowing ? '▼' : '▲';
};

window.openWeatherHistoryModal = function(stKey) {
    const stData = latestBuoyData[stKey];
    const stName = stData ? (stData.name || stKey) : stKey;
    let historyArr = stationHistoryMap[stKey] || [];

    let modalEl = document.getElementById('weather-history-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'weather-history-modal';
        modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:99999; display:flex; align-items:center; justify-content:center;';
        document.body.appendChild(modalEl);
    }

    let isWindOnly = (stData && (stData.type === 'aws' || stData.type === 'nmpnt' || stData.sigWave === null));

    let rowsHtml = '';
    if (historyArr.length === 0) {
        rowsHtml = `<tr><td colspan="${isWindOnly ? 4 : 6}" style="text-align:center; padding:20px; color:#94A3B8;">수집된 과거 이력 데이터가 없습니다. (시간 경과 후 갱신됩니다)</td></tr>`;
    } else {
        historyArr.sort((a, b) => b.time.localeCompare(a.time));
        historyArr.forEach(h => {
            let tStr = h.time || '-';
            let wDir = h.windDir || '-';
            let wSpd = !isNaN(parseFloat(h.wind)) ? parseFloat(h.wind).toFixed(1) : '-';
            if (isWindOnly) {
                rowsHtml += `<tr><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td></tr>`;
            } else {
                let sigW = (!isNaN(parseFloat(h.sigWave)) && h.sigWave !== '-') ? parseFloat(h.sigWave).toFixed(1) : '-';
                let maxW = (!isNaN(parseFloat(h.maxWave)) && h.maxWave !== '-') ? parseFloat(h.maxWave).toFixed(1) : '-';
                rowsHtml += `<tr><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${sigW}</td><td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${maxW}</td></tr>`;
            }
        });
    }

    let headerCols = isWindOnly 
        ? `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th>`
        : `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;

    modalEl.innerHTML = `
        <div style="background:#fff; width:650px; max-height:85vh; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.2); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:16px 20px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:16px;">📈 [${stName}] 시간대별 기상 관측 과거 이력</h3>
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
            </div>
            <div style="padding:20px; overflow-y:auto; flex:1;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; color:#334155;">
                    <thead><tr>${headerCols}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="padding:12px 20px; background:#F1F5F9; text-align:right; border-top:1px solid #E2E8F0;">
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="padding:6px 14px; background:#64748B; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px;">닫기</button>
            </div>
        </div>
    `;
    modalEl.style.display = 'flex';
};

function buildMeteoSubTableHtml(parsed, shipName, routeName) {
    if (!parsed.stations || parsed.stations.length === 0) return `<div style="text-align:center; padding:12px; color:#94A3B8;">연계 관측소 없음</div>`;
    let rowsHtml = '';
    const wLimit = parsed.windLimit || 12.0;

    parsed.stations.forEach(stKey => {
        const stData = latestBuoyData[stKey];
        if (!stData) return;
        let agencyBadge = stData.type === 'buoy' ? '<span style="background:#E0F2FE; color:#0369A1; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 부이</span>' :
                          stData.type === 'aws' ? '<span style="background:#CCFBF1; color:#0F766E; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 AWS</span>' :
                          stData.type === 'beacon' ? '<span style="background:#EDE9FE; color:#6D28D9; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 등표</span>' :
                          stData.type === 'nmpnt' ? '<span style="background:#EFF6FF; color:#1D4ED8; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">측위정보원</span>' :
                          '<span style="background:#ECFDF5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">해양조사원</span>';

        const windVal = parseFloat(stData.wind);
        const hasWind = !isNaN(windVal);
        let windStyle = hasWind && windVal >= wLimit ? 'color:#DC2626; font-weight:bold; background:#FEE2E2;' : '';
        const sigVal = parseFloat(stData.sigWave);
        const maxVal = parseFloat(stData.maxWave);
        let waveStr = (!isNaN(sigVal) && !isNaN(maxVal)) ? `유의 ${sigVal.toFixed(1)}m / 최대 ${maxVal.toFixed(1)}m` : (!isNaN(sigVal) ? `유의 ${sigVal.toFixed(1)}m` : '-');

        rowsHtml += `<tr><td>${agencyBadge}</td><td><strong style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="openWeatherHistoryModal('${stKey}')">${stData.name || stKey}</strong></td><td style="${windStyle}">${hasWind ? windVal.toFixed(1) + ' m/s (' + (stData.windDir || '-') + ')' : '수신대기'}</td><td>${waveStr}</td><td><span style="color:#059669; font-weight:bold;">실시간 연동</span></td></tr>`;
    });
    return `<div class="meteo-detail-container"><table class="meteo-sub-table"><thead><tr><th>관측 기관</th><th>관측소명 (클릭 시 과거이력)</th><th>풍향 / 풍속</th><th>파고</th><th>상태</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

function buildNavAreaBadgeHtml(navArea) {
    if (!navArea) return '';
    let isPyung = navArea.includes('평수') && !navArea.includes('연해') && !navArea.includes('먼바다');
    return ` <span style="font-size:11px; font-weight:600; padding:1px 5px; border-radius:4px; ${isPyung ? 'color:#0284C7; background:#E0F2FE;' : 'color:#4338CA; background:#EEF2FF;'}">(${navArea})</span>`;
}

function renderOperationBoard() {
    const tbody = document.getElementById('board-tbody');
    const mobileContainer = document.getElementById('board-mobile-cards');
    if (!tbody || !mobileContainer) return;

    let allShipsMap = {};
    if (typeof baseShipData !== 'undefined') {
        baseShipData.forEach((d, idx) => {
            let code = (d[1] || `idx_${idx}`).trim();
            let override = cloudCustomData[code] || {};
            allShipsMap[code] = {
                code, rawName: override.rawName !== undefined ? override.rawName : d[0],
                route: override.route !== undefined ? override.route : d[2],
                decision: override.decision !== undefined ? override.decision : d[7],
                notes: override.notes !== undefined ? override.notes : d[5],
                deployedTarget: override.deployedTarget ? String(override.deployedTarget).trim() : null,
                isHidden: !!override.isHidden, isDeleted: !!override.isDeleted
            };
        });
    }

    customAddedShips.forEach(s => {
        let code = String(s.id).trim();
        allShipsMap[code] = { code, rawName: s.rawName || '신규선박', route: s.route || '기타항로', decision: s.decision || '-', notes: s.notes || '', deployedTarget: s.deployedTarget ? String(s.deployedTarget).trim() : null, isHidden: !!s.isHidden, isDeleted: !!s.isDeleted };
    });

    let displayList = [];
    for (let c in allShipsMap) {
        let s = allShipsMap[c];
        if (s.isDeleted) continue;
        if ((s.route || '').trim() === '예비선' && !s.deployedTarget) continue;
        if (s.isHidden && !s.deployedTarget) continue;
        displayList.push(s);
    }

    displayList.sort((a, b) => (a.route || '').localeCompare(b.route || '', 'ko'));

    let rowsHtml = "", mobileHtml = "";
    let countTotal = displayList.length, countOk = 0, countWarn = 0, countDanger = 0, countSpecial = 0;

    displayList.forEach(ship => {
        let cleanName = (ship.rawName || '').split('(')[0].split('\n')[0].trim();
        let parsed = parseVesselControlCriteria(ship.rawName, ship.decision, ship.route, ship.notes);
        let areaBadgeHtml = buildNavAreaBadgeHtml(parsed.navArea);
        let tonnageText = parsed.tonnage ? `${parsed.tonnage.toLocaleString()}G/T` : '-';

        let pointDisplay = '', currentDisplay = '', isAnyWindDanger = false, isAnyWaveDanger = false;
        if (parsed.stations && parsed.stations.length > 0) {
            let pts = [], rnds = [];
            parsed.stations.forEach(stKey => {
                let stData = latestBuoyData[stKey];
                if (!stData) return;
                let stTitle = stData.name || stKey;
                let clickableTitle = `<span style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="openWeatherHistoryModal('${stKey}')">${stTitle}</span>`;
                pts.push(`📍 ${clickableTitle}`);
                rnds.push(`<div style="margin-bottom:3px;">[${clickableTitle}] 풍속: ${stData.wind}m/s (${stData.windDir || '-'})</div>`);
            });
            pointDisplay = pts.join('<br>');
            currentDisplay = rnds.join('');
        }

        let statusBadge = '<span class="status-badge badge-ok">🟢 정상</span>';
        if (parsed.tonnage >= 2000) statusBadge = '<span class="status-badge badge-ok">🟢 정상 (2,000G/T 이상)</span>';
        countOk++;

        rowsHtml += `
            <tr id="ship-row-${ship.code}">
                <td><strong>${ship.route}</strong>${areaBadgeHtml}</td>
                <td><strong>${cleanName}</strong> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></td>
                <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')">${pointDisplay || '-'} ▼</td>
                <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')">${currentDisplay || '-'}</td>
                <td>풍속 ${parsed.windLimit}m/s</td>
                <td>${statusBadge}</td>
                <td>-</td>
            </tr>
            <tr id="meteo-detail-${ship.code}" class="meteo-detail-row" style="display: none;">
                <td colspan="7" style="padding: 0;">${buildMeteoSubTableHtml(parsed, cleanName, ship.route)}</td>
            </tr>
        `;
    });

    const tbody = document.getElementById('board-tbody');
    if (tbody) tbody.innerHTML = rowsHtml;
}

window.fetchWeatherRealtime = async (isAuto = false) => {
    let authKey = localStorage.getItem("kma_apihub_authkey") || DEFAULT_KMA_AUTHKEY;
    const recvEl = document.getElementById('weather-last-updated');
    if (recvEl) recvEl.innerText = `📡 수신 중...`;

    try {
        let nmpntKey = localStorage.getItem("nmpnt_service_key") || DEFAULT_NMPNT_KEY;
        let khoaKey = localStorage.getItem("khoa_api_key") || DEFAULT_KHOA_KEY;

        const results = await Promise.allSettled([
            fetchKmaApi("buoy", authKey),
            fetchKmaApi("warn", authKey),
            fetchKmaApi("aws", authKey),
            fetchWithTimeout(`/api/nmpnt?serviceKey=${encodeURIComponent(nmpntKey)}&_t=${Date.now()}`, {}, 4500).then(r => r.json()),
            fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=KG_0025&_t=${Date.now()}`, {}, 5000).then(r => r.json()),
            fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=KG_0102&_t=${Date.now()}`, {}, 5000).then(r => r.json()),
            fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=IE_0061&_t=${Date.now()}`, {}, 5000).then(r => r.json()),
            fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=KG_0024&_t=${Date.now()}`, {}, 5000).then(r => r.json()),
            fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=DT_0065&_t=${Date.now()}`, {}, 5000).then(r => r.json())
        ]);

        const textBuoy = results[0].status === 'fulfilled' ? results[0].value : null;
        const textWarn = results[1].status === 'fulfilled' ? results[1].value : null;
        const textAws = results[2].status === 'fulfilled' ? results[2].value : null;
        const dataNmpnt = results[3].status === 'fulfilled' ? results[3].value : null;
        const dataKhoaChuja = results[4].status === 'fulfilled' ? results[4].value : null;
        const dataKhoaMaenggol = results[5].status === 'fulfilled' ? results[5].value : null;
        const dataKhoaGageocho = results[6].status === 'fulfilled' ? results[6].value : null;
        const dataKhoaChilsan = results[7].status === 'fulfilled' ? results[7].value : null;
        const dataKhoaHyanghwa = results[8].status === 'fulfilled' ? results[8].value : null;

        let updatedCount = 0;
        let tempHistory = {};
        Object.keys(latestBuoyData).forEach(k => { tempHistory[k] = []; });

        // 1. 기상청 부이 파싱 (공백 분리 및 정밀 패턴 매칭)
        if (textBuoy) {
            const lines = textBuoy.split('\n');
            const targetBuoys = [
                { id: '22183', name: '신안',   key: '신안' },
                { id: '22184', name: '추자도', key: '추자도' },
                { id: '22102', name: '칠발도', key: '칠발도' },
                { id: '22298', name: '홍도',   key: '홍도' },
                { id: '22297', name: '가거도', key: '가거도' },
                { id: '22193', name: '흑산도', key: '흑산도' },
                { id: '959',   name: '해수서', key: '해수서파고' }
            ];

            lines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.split(/\s+/);
                if (cols.length < 5) return;

                targetBuoys.forEach(tb => {
                    if (cols.includes(tb.id) || cols.some(c => c.includes(tb.name))) {
                        let tmStr = cols.find(c => /^\d{12}$/.test(c)) || '';
                        let timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';

                        let floats = cols.map(c => parseFloat(c)).filter(n => !isNaN(n));
                        let wsCandidate = floats.find(n => n >= 0 && n < 50 && n !== parseFloat(tb.id));
                        let whCandidate = floats.find(n => n >= 0 && n <= 12 && n !== wsCandidate);
                        let wdCandidate = floats.find(n => n >= 0 && n <= 360 && n !== wsCandidate && n !== whCandidate);

                        let wVal = (wsCandidate !== undefined) ? wsCandidate.toFixed(1) : '-';
                        let dVal = (wdCandidate !== undefined) ? degToDirection(wdCandidate) : '-';
                        let whVal = (whCandidate !== undefined) ? whCandidate.toFixed(1) : '-';

                        if (wVal !== '-' || whVal !== '-') {
                            tempHistory[tb.key].push({ time: timeOnly, wind: wVal, windDir: dVal, sigWave: whVal, maxWave: '-' });
                        }
                        if (wVal !== '-') {
                            latestBuoyData[tb.key].wind = wVal;
                            latestBuoyData[tb.key].windDir = dVal;
                            updatedCount++;
                        }
                        if (whVal !== '-') {
                            latestBuoyData[tb.key].sigWave = whVal;
                            if (tb.key === '해수서파고') updatedCount++;
                        }
                    }
                });
            });
        }

        // 2. 기상청 AWS (옥도 308)
        if (textAws) {
            const awsLines = textAws.split('\n');
            awsLines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.split(/\s+/);
                if (cols.includes('308') || cols.some(c => c.includes('옥도'))) {
                    let tmStr = cols.find(c => /^\d{10,12}$/.test(c)) || '';
                    let timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';

                    let floats = cols.map(c => parseFloat(c)).filter(n => !isNaN(n) && n !== 308);
                    let wsCandidate = floats.find(n => n >= 0 && n < 100);
                    let wdCandidate = floats.find(n => n >= 0 && n <= 360 && n !== wsCandidate);

                    if (wsCandidate !== undefined) {
                        let wStr = wsCandidate.toFixed(1);
                        let dStr = (wdCandidate !== undefined) ? degToDirection(wdCandidate) : '북서풍';
                        tempHistory['옥도'].push({ time: timeOnly, wind: wStr, windDir: dStr, sigWave: null, maxWave: null });
                        latestBuoyData['옥도'].wind = wStr;
                        latestBuoyData['옥도'].windDir = dStr;
                        updatedCount++;
                    }
                }
            });
        }

        // 3. 측위정보원 등대
        if (dataNmpnt && dataNmpnt.result && dataNmpnt.result.recordset) {
            dataNmpnt.result.recordset.forEach(item => {
                const code = String(item.MMSI_CODE || item.mmsi_code || '').trim();
                const name = String(item.MMSI_NM || item.mmsi_nm || '').trim();
                const ws = parseFloat(item.WIND_SPEED ?? item.wind_speed ?? item.ws);
                const wd = parseFloat(item.WIND_DIRECT ?? item.wind_direct ?? item.wd);
                let tmStr = String(item.RECORD_TIME || item.record_time || item.TIME || item.time || item.REG_DATE || item.TM || '');
                let timeOnly = tmStr.length >= 16 ? tmStr.substring(11, 16) : (tmStr.includes(' ') ? tmStr.split(' ')[1].substring(0,5) : '최신');

                if (!isNaN(ws) && ws >= 0 && ws < 60) {
                    const dirStr = (!isNaN(wd) && wd >= 0) ? degToDirection(wd) : '북서풍';
                    const formattedWs = ws.toFixed(1);
                    let targetKey = code === '1079001' || name.includes('안좌') ? '안좌' :
                                    code === '1079008' || name.includes('외달') ? '외달도' :
                                    code === '1079003' || name.includes('가거') ? '가거도등대' :
                                    code === '1079002' || name.includes('홍도') ? '홍도등대' :
                                    code === '1079005' || name.includes('하조도') ? '하조도' :
                                    code === '1079007' || name.includes('계마') ? '계마항' : null;

                    if (targetKey) {
                        tempHistory[targetKey].push({ time: timeOnly, wind: formattedWs, windDir: dirStr, sigWave: null, maxWave: null });
                        latestBuoyData[targetKey].wind = formattedWs;
                        latestBuoyData[targetKey].windDir = dirStr;
                        updatedCount++;
                    }
                }
            });
        }

        // 4. 국립해양조사원(KHOA)
        const parseKhoaStationHistory = (resObj, targetKey) => {
            if (!resObj) return;
            let items = resObj.rawItems || (resObj.result?.data ? [resObj.result.data] : []);
            if (!Array.isArray(items)) items = [items];

            items.forEach(item => {
                const ws = parseFloat(item.windSpeed ?? item.wind_speed ?? item.wspd ?? item.ws);
                const wd = parseFloat(item.windDir ?? item.wind_dir ?? item.wdir ?? item.wd);
                const sigW = parseFloat(item.waveHeight ?? item.waveHgt ?? item.wave_hgt ?? item.sigWaveHgt ?? item.swh ?? item.wh);
                const maxW = parseFloat(item.maxWaveHeight ?? item.maxWaveHgt ?? item.max_wave_hgt ?? item.mwh);
                let tmStr = String(item.obsTime ?? item.record_time ?? item.tm ?? item.obsDt ?? '');
                let timeOnly = tmStr.length >= 16 ? tmStr.substring(11, 16) : (tmStr.includes(' ') ? tmStr.split(' ')[1].substring(0,5) : '최신');

                let wStr = (!isNaN(ws) && ws >= 0 && ws < 80) ? ws.toFixed(1) : '-';
                let dStr = (!isNaN(wd) && wd >= 0) ? degToDirection(wd) : '-';
                let sWave = (!isNaN(sigW) && sigW >= 0) ? sigW.toFixed(1) : '-';
                let mWave = (!isNaN(maxW) && maxW >= 0) ? maxW.toFixed(1) : '-';

                if (wStr !== '-' || sWave !== '-') {
                    tempHistory[targetKey].push({ time: timeOnly, wind: wStr, windDir: dStr, sigWave: sWave, maxWave: mWave });
                }
            });

            if (resObj.result?.data) {
                const kData = resObj.result.data;
                const ws = parseFloat(kData.wind_speed);
                const wd = parseFloat(kData.wind_dir);
                if (!isNaN(ws) && ws >= 0 && ws < 80) {
                    latestBuoyData[targetKey].wind = ws.toFixed(1);
                    latestBuoyData[targetKey].windDir = (!isNaN(wd) && wd >= 0) ? degToDirection(wd) : '북서풍';
                }
                if (latestBuoyData[targetKey].sigWave !== null) {
                    const sigW = parseFloat(kData.sig_wave);
                    if (!isNaN(sigW) && sigW >= 0) latestBuoyData[targetKey].sigWave = sigW.toFixed(1);
                    const maxW = parseFloat(kData.max_wave);
                    if (!isNaN(maxW) && maxW >= 0) latestBuoyData[targetKey].maxWave = maxW.toFixed(1);
                }
                updatedCount++;
            }
        };

        parseKhoaStationHistory(dataKhoaChuja, '추자조사원');
        parseKhoaStationHistory(dataKhoaMaenggol, '맹골조사원');
        parseKhoaStationHistory(dataKhoaGageocho, '가거초조사원');
        parseKhoaStationHistory(dataKhoaChilsan, '칠산조사원');
        parseKhoaStationHistory(dataKhoaHyanghwa, '향화도조위');

        Object.keys(tempHistory).forEach(k => {
            if (tempHistory[k].length > 0) {
                let uniqueMap = {};
                tempHistory[k].forEach(h => { uniqueMap[h.time] = h; });
                stationHistoryMap[k] = Object.values(uniqueMap);
            }
        });

        if (textWarn) parseWeatherWarnings(textWarn);
        renderOperationBoard();
    } catch (err) {
        renderOperationBoard();
    }
};

function startCountdownTimer() {
    stopCountdownTimer();
    let sel = document.getElementById('auto-refresh-select');
    let intervalSec = sel ? parseInt(sel.value, 10) : 300;
    nextRefreshRemainingSec = intervalSec;
    countdownIntervalId = setInterval(() => {
        if (nextRefreshRemainingSec > 0) nextRefreshRemainingSec--;
        else {
            nextRefreshRemainingSec = intervalSec;
            fetchWeatherRealtime(true);
        }
    }, 1000);
}

function stopCountdownTimer() {
    if (countdownIntervalId) { clearInterval(countdownIntervalId); countdownIntervalId = null; }
}

document.addEventListener("DOMContentLoaded", () => {
    try {
        render();
        renderRefSection();
    } catch (e) {}
});
