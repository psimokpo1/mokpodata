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

// 관측소별 시간대별 과거 이력 저장소
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
    // [기상청 부이/AWS/등표]
    '신안':       { stnId: '22183',   type: 'buoy',   name: '신안 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '추자도':     { stnId: '22184',   type: 'buoy',   name: '추자도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '칠발도':     { stnId: '22102',   type: 'buoy',   name: '칠발도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '홍도':       { stnId: '22298',   type: 'buoy',   name: '홍도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '가거도':     { stnId: '22297',   type: 'buoy',   name: '가거도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '흑산도':     { stnId: '22193',   type: 'buoy',   name: '흑산도 부이',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '옥도':       { stnId: '308',     type: 'aws',    name: '옥도 AWS',          wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '해수서파고': { stnId: '959',     type: 'beacon', name: '해수서 등표',       wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    // [측위정보원 등대/터미널]
    '안좌':       { stnId: '1079001', type: 'nmpnt',  name: '안좌터미널(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '외달도':     { stnId: '1079008', type: 'nmpnt',  name: '외달도등표(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '가거도등대': { stnId: '1079003', type: 'nmpnt',  name: '가거도등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '홍도등대':   { stnId: '1079002', type: 'nmpnt',  name: '홍도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '하조도':     { stnId: '1079005', type: 'nmpnt',  name: '하조도등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '계마항':     { stnId: '1079007', type: 'nmpnt',  name: '계마항등대(측위)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    // [국립해양조사원 해양관측부이 / 과학기지 / 조위관측소 풍속계]
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

// ==========================================
// 2. 인증 및 실시간 동기화
// ==========================================
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
        if (errEl) {
            errEl.style.display = "block";
            errEl.innerText = "아이디와 비밀번호를 모두 입력하세요.";
        }
        return;
    }

    let email = rawId.includes('@') ? rawId : `${rawId}@komsa.or.kr`;

    auth.signInWithEmailAndPassword(email, pw).catch(err => {
        if (errEl) {
            errEl.style.display = "block";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                errEl.innerText = `[${email}] 아이디 또는 비밀번호를 확인해 주세요.`;
            } else if (err.code === 'auth/wrong-password') {
                errEl.innerText = "비밀번호가 올바르지 않습니다.";
            } else {
                errEl.innerText = `로그인 실패 (${err.code}): ${err.message}`;
            }
        }
    });
};

window.handleLogout = function() {
    auth.signOut();
};

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
        
        try { renderOperationBoard(); } catch (err) { console.error(err); }
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
        if (boardSec && boardSec.style.display === 'block') {
            try { renderOperationBoard(); } catch(e){}
        }
    }, err => console.warn("vessel_overrides 동기화 안내:", err.message));

    db.collection("reference_materials").onSnapshot(snapshot => {
        cloudRefItems = {};
        snapshot.forEach(doc => { cloudRefItems[doc.id] = doc.data(); });
        renderRefSection();
    }, err => console.warn("reference_materials 동기화 안내:", err.message));
}

// ==========================================
// 3. 선박 통제기준 및 항해구역 파서
// ==========================================
function parseVesselControlCriteria(rawName, decision, route, notes) {
    let fullText = ((rawName || '') + " " + (decision || '') + " " + (notes || '')).replace(/\s/g, '');
    let r = route || '';
    
    let tonnage = 0;
    let tonMatch = (rawName || '').match(/([\d,]+)\s*G\s*\/\s*T/i);
    if (tonMatch) tonnage = parseFloat(tonMatch[1].replace(/,/g, ''));

    let isCaptainOpinion = fullText.includes("선장의견") || fullText.includes("선장협의") || fullText.includes("선장의의견");
    let isOfficeDecision = fullText.includes("진도사무소") || fullText.includes("도초근무자") || fullText.includes("도초사무소") || fullText.includes("하의사무소") || fullText.includes("남강사무소");

    let officeName = null;
    if (fullText.includes("진도사무소")) officeName = "진도파견지";
    else if (fullText.includes("도초근무자") || fullText.includes("도초사무소")) officeName = "도초파견지";
    else if (fullText.includes("하의사무소")) officeName = "하의파견지";

    let windLimit = null;
    let windMatch = fullText.match(/(\d+(?:\.\d+)?)\s*m\/s/i);
    if (windLimit === null && windMatch) windLimit = parseFloat(windMatch[1]);

    let sigWaveLimit = null;
    let maxWaveLimit = null;

    let sigMatch = fullText.match(/유의파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (sigMatch) sigWaveLimit = parseFloat(sigMatch[1]);

    let maxMatch = fullText.match(/최대파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (maxMatch) maxWaveLimit = parseFloat(maxMatch[1]);

    if (!sigMatch && !maxMatch) {
        let genMatch = fullText.match(/(?:파고)[:\s]*(\d+(?:\.\d+)?)\s*m/i) || fullText.match(/(\d+(?:\.\d+)?)\s*m(?!\/s)/i);
        if (genMatch) sigWaveLimit = parseFloat(genMatch[1]);
    }

    let stations = [];
    if (fullText.includes("향화") || fullText.includes("향화도") || r.includes("향화")) {
        if (!stations.includes('향화도조위')) stations.push('향화도조위');
    }
    if (fullText.includes("외달") || fullText.includes("외달도") || r.includes("외달")) { if (!stations.includes('외달도')) stations.push('외달도'); }
    if (fullText.includes("안좌") || fullText.includes("복호")) { if (!stations.includes('안좌')) stations.push('안좌'); }
    if (fullText.includes("하조도") || fullText.includes("창유") || fullText.includes("조도")) {
        if (!stations.includes('하조도')) stations.push('하조도');
        if (!stations.includes('맹골조사원')) stations.push('맹골조사원');
    }
    if (fullText.includes("계마") || fullText.includes("계마항") || r.includes("계마") || r.includes("안마")) {
        if (!stations.includes('계마항')) stations.push('계마항');
        if (!stations.includes('칠산조사원')) stations.push('칠산조사원');
    }
    if (fullText.includes("가거도") || r.includes("가거도")) {
        if (!stations.includes('가거도')) stations.push('가거도');
        if (!stations.includes('가거도등대')) stations.push('가거도등대');
        if (!stations.includes('가거초조사원')) stations.push('가거초조사원');
    }
    if (fullText.includes("해수서") || fullText.includes("해수서등표") || r.includes("율목")) {
        if (!stations.includes('해수서파고')) stations.push('해수서파고');
        if (!stations.includes('맹골조사원')) stations.push('맹골조사원');
    }
    if (fullText.includes("옥도")) { if (!stations.includes('옥도')) stations.push('옥도'); }
    if (fullText.includes("신안")) { if (!stations.includes('신안')) stations.push('신안'); }
    if (fullText.includes("칠발도")) { if (!stations.includes('칠발도')) stations.push('칠발도'); }
    if (fullText.includes("홍도")) {
        if (!stations.includes('홍도')) stations.push('홍도');
        if (!stations.includes('홍도등대')) stations.push('홍도등대');
    }
    if (fullText.includes("흑산도")) { if (!stations.includes('흑산도')) stations.push('흑산도'); }
    if (fullText.includes("추자도") || r.includes("제주")) {
        if (!stations.includes('추자도')) stations.push('추자도');
        if (!stations.includes('추자조사원')) stations.push('추자조사원');
    }
    if (r.includes("진도") || r.includes("쉬미") || r.includes("가사")) {
        if (!stations.includes('맹골조사원')) stations.push('맹골조사원');
    }

    if (stations.length === 0) {
        if (r.includes("율목") || fullText.includes("목포-율목") || fullText.includes("섬사랑10호") || fullText.includes("섬사랑13호")) {
            stations = ['신안', '옥도', '해수서파고', '맹골조사원'];
        } else if (r.includes("홍도") || r.includes("흑산")) {
            stations = (fullText.includes("가거도") || fullText.includes("핑크돌핀") || fullText.includes("뉴퀸")) 
                ? ['칠발도', '홍도', '가거도', '가거초조사원'] 
                : ['칠발도', '홍도'];
        } else if (r.includes("제주")) {
            stations = ['추자도', '추자조사원'];
        } else if (r.includes("안마") || r.includes("계마")) {
            stations = ['계마항', '칠산조사원'];
        } else if (fullText.includes("평수") || r.includes("남강") || r.includes("도초") || r.includes("상태")) {
            stations = ['신안', '옥도'];
        }
    }

    let relatedSeas = [];
    if (fullText.includes("북쪽안쪽먼바다") || fullText.includes("서해남부북쪽안쪽먼바다")) relatedSeas.push("서해남부북쪽안쪽먼바다");
    if (fullText.includes("남쪽안쪽먼바다") || fullText.includes("서해남부남쪽안쪽먼바다")) relatedSeas.push("서해남부남쪽안쪽먼바다");
    if (fullText.includes("전남중부앞바다") || fullText.includes("전남중부") || fullText.includes("서해남부앞바다(전남중부)")) relatedSeas.push("서해남부앞바다(전남중부)");
    if (fullText.includes("전남남부앞바다") || fullText.includes("전남남부") || fullText.includes("서해남부앞바다(전남남부)")) relatedSeas.push("서해남부앞바다(전남남부)");
    if (fullText.includes("전남북부앞바다") || fullText.includes("전남북부") || fullText.includes("서해남부앞바다(전남북부)")) relatedSeas.push("서해남부앞바다(전남북부)");
    if (fullText.includes("남해서부서쪽먼바다")) relatedSeas.push("남해서부서쪽먼바다");
    if (fullText.includes("제주도북부앞바다")) relatedSeas.push("제주도북부앞바다");

    if (relatedSeas.length === 0) {
        if (r.includes("홍도") || r.includes("흑산")) {
            relatedSeas.push((fullText.includes("가거도") || fullText.includes("핑크돌핀") || fullText.includes("뉴퀸")) ? "서해남부남쪽안쪽먼바다" : "서해남부북쪽안쪽먼바다", "서해남부앞바다(전남중부)");
        } else if (r.includes("제주")) {
            relatedSeas.push("서해남부앞바다(전남중부)", "서해남부앞바다(전남남부)", "서해남부남쪽안쪽먼바다", "남해서부서쪽먼바다", "제주도북부앞바다");
        } else if (r.includes("안마") || r.includes("계마")) {
            relatedSeas.push("서해남부북쪽안쪽먼바다", "서해남부앞바다(전남북부)");
        } else if (r.includes("향화") || r.includes("낙월") || r.includes("송이")) {
            relatedSeas.push("서해남부앞바다(전남북부)");
        } else if (r.includes("진도") || r.includes("가사") || r.includes("쉬미") || r.includes("율목")) {
            relatedSeas.push("서해남부앞바다(전남남부)", "서해남부남쪽안쪽먼바다");
        } else if (fullText.includes("평수")) {
            relatedSeas.push("서해남부앞바다(전남중부)");
        }
    }

    let isJodoPyungsu = fullText.includes("조도부근평수구역") || fullText.includes("조도부근평수");
    let isYulmokRoute = r.includes("율목") || fullText.includes("목포-율목") || fullText.includes("평수구역으로단축운항");
    let isPyungSuOnly = (fullText.includes("(평수)") && !fullText.includes("연해") && !fullText.includes("먼바다")) || isJodoPyungsu;
    let isJejuMegaShip = (tonnage >= 10000) && (r.includes("제주") || fullText.includes("제주"));

    let rawAreaText = ((rawName || '') + " " + (decision || '') + " " + (notes || ''));
    let areaMatch = rawAreaText.match(/\(([^)]*(?:평수|연해|앞바다|먼바다|근해)[^)]*)\)/);
    let navArea = areaMatch ? areaMatch[1].trim() : '';

    if (navArea.includes('핵심') || navArea.includes('통제')) {
        navArea = '평수';
    }

    if (!navArea) {
        let decClean = (decision || '').replace(/\s/g, '');
        if (decClean.includes('평수구역') && !decClean.includes('연해') && !decClean.includes('먼바다')) {
            navArea = '평수';
        } else if (decClean.includes('연해') && decClean.includes('먼바다')) {
            navArea = '연해/먼바다';
        } else if (decClean.includes('먼바다')) {
            navArea = '먼바다';
        } else if (decClean.includes('연해')) {
            navArea = '연해';
        }
    }

    return {
        tonnage: tonnage,
        navArea: navArea,
        isCaptainOpinion: isCaptainOpinion,
        isOfficeDecision: isOfficeDecision,
        officeName: officeName,
        stations: stations,
        windLimit: windLimit,
        sigWaveLimit: sigWaveLimit,
        maxWaveLimit: maxWaveLimit,
        relatedSeas: relatedSeas,
        isPyungSuOnly: isPyungSuOnly,
        isJodoPyungsu: isJodoPyungsu,
        isYulmokRoute: isYulmokRoute,
        isJejuMegaShip: isJejuMegaShip
    };
}

// ==========================================
// 4. 상황판 및 최근 6시간 과거 이력 타임테이블 모달
// ==========================================
window.toggleMeteoDetailRow = function(shipCode) {
    const detailRow = document.getElementById(`meteo-detail-${shipCode}`);
    if (!detailRow) return;
    const isShowing = detailRow.style.display !== 'none';
    detailRow.style.display = isShowing ? 'none' : 'table-row';
    const icon = document.getElementById(`meteo-toggle-icon-${shipCode}`);
    if (icon) icon.innerText = isShowing ? '▼' : '▲';
};

function isWithinLast6Hours(sortKey) {
    if (!sortKey || sortKey.length < 12) return true;
    const digits = sortKey.replace(/\D/g, '');
    if (digits.length < 12) return true;
    const y = parseInt(digits.substring(0, 4), 10);
    const m = parseInt(digits.substring(4, 6), 10) - 1;
    const d = parseInt(digits.substring(6, 8), 10);
    const h = parseInt(digits.substring(8, 10), 10);
    const min = parseInt(digits.substring(10, 12), 10);
    const itemUtcMs = Date.UTC(y, m, d, h - 9, min, 0);
    const diffMs = Date.now() - itemUtcMs;
    return diffMs >= -10 * 60 * 1000 && diffMs <= 6 * 60 * 60 * 1000 + 10 * 60 * 1000;
}

window.openWeatherHistoryModal = function(stKey) {
    const stData = latestBuoyData[stKey];
    const stName = stData ? (stData.name || stKey) : stKey;
    let rawHistory = stationHistoryMap[stKey] || [];

    // 최근 6시간 이내 기록만 필터링
    let historyArr = rawHistory.filter(h => isWithinLast6Hours(h.sortKey));

    let modalEl = document.getElementById('weather-history-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'weather-history-modal';
        modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        document.body.appendChild(modalEl);
    }

    let isWindOnly = (stData && (stData.type === 'aws' || stData.type === 'nmpnt' || stData.sigWave === null));

    let rowsHtml = '';
    if (historyArr.length === 0) {
        rowsHtml = `<tr><td colspan="${isWindOnly ? 4 : 6}" style="text-align:center; padding:24px; color:#94A3B8;">최근 6시간 이내 수집된 관측 이력이 없습니다.</td></tr>`;
    } else {
        let sortedList = [...historyArr].sort((a, b) => (b.sortKey || b.time || '').localeCompare(a.sortKey || a.time || ''));
        sortedList.forEach(h => {
            let tStr = h.time || '-';
            let wDir = h.windDir || '-';
            let wSpd = (!isNaN(parseFloat(h.wind)) && h.wind !== '-') ? parseFloat(h.wind).toFixed(1) : '-';
            if (isWindOnly) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                    </tr>
                `;
            } else {
                let sigW = (!isNaN(parseFloat(h.sigWave)) && h.sigWave !== '-') ? parseFloat(h.sigWave).toFixed(1) : '-';
                let maxW = (!isNaN(parseFloat(h.maxWave)) && h.maxWave !== '-') ? parseFloat(h.maxWave).toFixed(1) : '-';
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${sigW}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${maxW}</td>
                    </tr>
                `;
            }
        });
    }

    let headerCols = isWindOnly 
        ? `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th>`
        : `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;

    modalEl.innerHTML = `
        <div style="background:#fff; width:660px; max-width:95vw; max-height:85vh; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.25); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:15px 20px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:15.5px;">📈 [${stName}] 최근 6시간 기상 관측 이력</h3>
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
            </div>
            <div style="padding:18px; overflow-y:auto; flex:1;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; color:#334155;">
                    <thead><tr>${headerCols}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="padding:12px 20px; background:#F1F5F9; text-align:right; border-top:1px solid #E2E8F0;">
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="padding:6px 16px; background:#475569; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">닫기</button>
            </div>
        </div>
    `;
    modalEl.style.display = 'flex';
};

function buildMeteoSubTableHtml(parsed, shipName, routeName) {
    if (!parsed.stations || parsed.stations.length === 0) {
        return `<div style="text-align:center; padding:12px; color:#94A3B8;">연계된 관측소 정보가 없습니다. (선장 또는 파견지 협의 항로)</div>`;
    }

    let rowsHtml = '';
    const wLimit = parsed.windLimit || 12.0;

    parsed.stations.forEach(stKey => {
        const stData = latestBuoyData[stKey];
        if (!stData) return;

        let agencyBadge = '';
        if (stData.type === 'buoy') agencyBadge = '<span style="background:#E0F2FE; color:#0369A1; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 부이</span>';
        else if (stData.type === 'aws') agencyBadge = '<span style="background:#CCFBF1; color:#0F766E; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 AWS</span>';
        else if (stData.type === 'beacon') agencyBadge = '<span style="background:#EDE9FE; color:#6D28D9; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 등표</span>';
        else if (stData.type === 'nmpnt') agencyBadge = '<span style="background:#EFF6FF; color:#1D4ED8; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">측위정보원</span>';
        else if (stData.type === 'khoa') agencyBadge = '<span style="background:#ECFDF5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">해양조사원</span>';

        const windVal = parseFloat(stData.wind);
        const hasWind = !isNaN(windVal);
        let windStyle = '';
        if (hasWind) {
            if (windVal >= wLimit) windStyle = 'color:#DC2626; font-weight:bold; background:#FEE2E2;';
            else if (windVal >= wLimit * 0.85) windStyle = 'color:#D97706; font-weight:bold; background:#FEF3C7;';
        }

        const sigVal = parseFloat(stData.sigWave);
        const maxVal = parseFloat(stData.maxWave);
        let waveStr = '-';
        if (!isNaN(sigVal) && !isNaN(maxVal)) waveStr = `유의 ${sigVal.toFixed(1)}m / 최대 ${maxVal.toFixed(1)}m`;
        else if (!isNaN(sigVal)) waveStr = `유의 ${sigVal.toFixed(1)}m`;

        const windDisplay = hasWind ? `${windVal.toFixed(1)} m/s (${stData.windDir || '-'})` : '<span style="color:#94A3B8;">수신대기</span>';

        rowsHtml += `
            <tr>
                <td>${agencyBadge}</td>
                <td><strong style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="openWeatherHistoryModal('${stKey}')" title="클릭 시 '${stData.name || stKey}' 최근 6시간 이력 조회">${stData.name || stKey}</strong></td>
                <td style="${windStyle}">${windDisplay}</td>
                <td>${waveStr}</td>
                <td><span style="color:#059669; font-weight:bold;">실시간 연동</span></td>
            </tr>
        `;
    });

    return `
        <div class="meteo-detail-container">
            <div class="meteo-detail-header">
                <span>📊 [${routeName}] ${shipName} — 연계 관측소 실시간 관측 상세 테이블 (관측소명 클릭 시 최근 6시간 이력 조회)</span>
                <span style="font-size:11.5px; color:#64748B; font-weight:normal;">선박 통제기준: 풍속 ${wLimit}m/s ${parsed.sigWaveLimit ? '/ 유의파고 ' + parsed.sigWaveLimit + 'm' : ''}</span>
            </div>
            <table class="meteo-sub-table">
                <thead>
                    <tr>
                        <th style="width: 18%;">관측 기관</th>
                        <th style="width: 22%;">관측소명 (클릭 조회)</th>
                        <th style="width: 25%;">풍향 / 풍속</th>
                        <th style="width: 23%;">파고 (유의/최대)</th>
                        <th style="width: 12%;">상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function buildNavAreaBadgeHtml(navArea) {
    if (!navArea) return '';
    let isPyung = navArea.includes('평수') && !navArea.includes('연해') && !navArea.includes('먼바다') && !navArea.includes('앞바다');
    let badgeStyle = isPyung 
        ? 'color:#0284C7; background:#E0F2FE; border:1px solid #BAE6FD;' 
        : 'color:#4338CA; background:#EEF2FF; border:1px solid #C7D2FE;';
    return ` <span style="font-size:11px; font-weight:600; padding:1px 5px; border-radius:4px; ${badgeStyle}">(${navArea})</span>`;
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
                code: code,
                rawName: override.rawName !== undefined ? override.rawName : d[0],
                route: override.route !== undefined ? override.route : d[2],
                decision: override.decision !== undefined ? override.decision : d[7],
                notes: override.notes !== undefined ? override.notes : d[5],
                deployedTarget: override.deployedTarget ? String(override.deployedTarget).trim() : null,
                isHidden: !!override.isHidden,
                isDeleted: !!override.isDeleted
            };
        });
    }

    customAddedShips.forEach(s => {
        let code = String(s.id).trim();
        allShipsMap[code] = {
            code: code,
            rawName: s.rawName || '신규선박',
            route: s.route || '기타항로',
            decision: s.decision || '-',
            notes: s.notes || '',
            deployedTarget: s.deployedTarget ? String(s.deployedTarget).trim() : null,
            isHidden: !!s.isHidden,
            isDeleted: !!s.isDeleted
        };
    });

    let deployedMap = {};
    for (let c in allShipsMap) {
        let s = allShipsMap[c];
        if (!s.isDeleted && s.deployedTarget) deployedMap[s.deployedTarget] = s;
    }

    let displayList = [];
    for (let c in allShipsMap) {
        let s = allShipsMap[c];
        if (s.isDeleted) continue;
        let isOriginalReserve = (s.route || '').trim() === '예비선';
        let isDeployedReserve = isOriginalReserve && !!s.deployedTarget;
        if (isOriginalReserve && !isDeployedReserve) continue;
        if (s.isHidden && !isDeployedReserve) continue;
        displayList.push(s);
    }

    displayList.sort((a, b) => {
        let aTarget = a.deployedTarget ? allShipsMap[a.deployedTarget] : null;
        let bTarget = b.deployedTarget ? allShipsMap[b.deployedTarget] : null;
        let aRoute = aTarget ? aTarget.route : a.route;
        let bRoute = bTarget ? bTarget.route : b.route;
        return (aRoute || '').localeCompare(bRoute || '', 'ko');
    });

    let countTotal = displayList.length;
    let countOk = 0;
    let countWarn = 0;
    let countDanger = 0;
    let countSpecial = 0;

    let rowsHtml = "";
    let mobileHtml = "";

    displayList.forEach(ship => {
        try {
            let cleanName = (ship.rawName || '').split('(')[0].split('\n')[0].trim();
            let isOriginalReserve = (ship.route || '').trim() === '예비선';
            let isDeployedReserve = isOriginalReserve && !!ship.deployedTarget;
            let targetShip = isDeployedReserve ? allShipsMap[ship.deployedTarget] : null;
            let isRestingBySub = !!deployedMap[ship.code];
            let substituteShip = isRestingBySub ? deployedMap[ship.code] : null;

            let ownParsed = parseVesselControlCriteria(ship.rawName, ship.decision, ship.route, ship.notes);
            let parsed = ownParsed;
            let effectiveRoute = ship.route;

            if (isDeployedReserve && targetShip) {
                let targetParsed = parseVesselControlCriteria(targetShip.rawName, targetShip.decision, targetShip.route, targetShip.notes);
                effectiveRoute = targetShip.route;
                parsed = {
                    tonnage: ownParsed.tonnage,
                    navArea: targetParsed.navArea || ownParsed.navArea,
                    isCaptainOpinion: targetParsed.isCaptainOpinion,
                    isOfficeDecision: targetParsed.isOfficeDecision,
                    officeName: targetParsed.officeName,
                    stations: targetParsed.stations,
                    windLimit: targetParsed.windLimit,
                    sigWaveLimit: targetParsed.sigWaveLimit,
                    maxWaveLimit: targetParsed.maxWaveLimit,
                    relatedSeas: targetParsed.relatedSeas,
                    isPyungSuOnly: targetParsed.isPyungSuOnly,
                    isJodoPyungsu: targetParsed.isJodoPyungsu,
                    isYulmokRoute: targetParsed.isYulmokRoute,
                    isJejuMegaShip: false
                };
            }

            let areaBadgeHtml = buildNavAreaBadgeHtml(parsed.navArea);
            let tonnageText = ownParsed.tonnage ? `${ownParsed.tonnage.toLocaleString()}G/T` : '-';

            if (isRestingBySub && !ship.isHidden) {
                let subCleanName = (substituteShip.rawName || '').split('(')[0].split('\n')[0].trim();
                rowsHtml += `
                    <tr class="resting-row">
                        <td><strong>${ship.route}</strong>${areaBadgeHtml}</td>
                        <td><strong>${cleanName}</strong> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></td>
                        <td colspan="3" style="text-align:center; color:#64748B;">대체선 [${subCleanName}] 투입에 따른 운항정지 및 정비</td>
                        <td><span class="status-badge badge-off">⚪ 휴항/정비 (${subCleanName} 대선)</span></td>
                        <td style="color:#94A3B8;">-</td>
                    </tr>
                `;
                return;
            }

            let activeWarningItems = [];
            let hasRealIssuedWarning = false; 
            let hasPreWarning = false;
            let hasGaleGyeongbo = false;

            if (parsed.relatedSeas && parsed.relatedSeas.length > 0) {
                for (let sea of parsed.relatedSeas) {
                    let alertType = activeSeaWarnings[sea];
                    if (alertType) {
                        activeWarningItems.push({ sea: sea, alert: alertType });
                        if (alertType.includes('예비') || alertType.includes('예정')) hasPreWarning = true;
                        else {
                            hasRealIssuedWarning = true;
                            if (alertType.includes('경보')) hasGaleGyeongbo = true;
                        }
                    }
                }
            }

            let status = 'ok';
            let statusBadge = '';
            let currentDisplay = '';
            let criteriaDisplay = '';
            let pointDisplay = '';

            let isAutoControlledByWarning = false;
            if (hasRealIssuedWarning && parsed.tonnage < 2000 && !parsed.isPyungSuOnly && !parsed.isYulmokRoute) isAutoControlledByWarning = true;

            let wLimit = parsed.windLimit || 12.0;
            let isAnyWindDanger = false;
            let isAnyWindWarn = false;
            let isAnyWaveDanger = false;
            let isAnyWaveWarn = false;

            if (parsed.stations && parsed.stations.length > 0) {
                let stationPoints = [];
                let stationRenders = [];

                parsed.stations.forEach(stKey => {
                    let stData = latestBuoyData[stKey];
                    if (!stData) return;

                    let stTitle = stData.name || stKey;
                    let isAws = (stData.type === 'aws');
                    let isBeacon = (stData.type === 'beacon');
                    let isNmpnt = (stData.type === 'nmpnt');
                    let isKhoa = (stData.type === 'khoa');
                    let isTideOnlyWind = (stData.sigWave === null);

                    let windVal = parseFloat(stData.wind);
                    let hasRealWind = !isNaN(windVal);

                    if (hasRealWind && (windVal >= wLimit)) isAnyWindDanger = true;
                    if (hasRealWind && (windVal >= (wLimit * 0.85))) isAnyWindWarn = true;

                    let sigVal = parseFloat(stData.sigWave);
                    let maxVal = parseFloat(stData.maxWave);
                    let hasRealSig = !isNaN(sigVal);
                    let hasRealMax = !isNaN(maxVal);

                    if (!isAws && !isNmpnt && !isTideOnlyWind) {
                        if (parsed.sigWaveLimit && hasRealSig && sigVal >= parsed.sigWaveLimit) isAnyWaveDanger = true;
                        if (parsed.maxWaveLimit && hasRealMax && maxVal >= parsed.maxWaveLimit) isAnyWaveDanger = true;
                    }

                    let windText = hasRealWind ? `${windVal.toFixed(1)}m/s (${stData.windDir || '-'})` : `<span style="color:#94A3B8;">수신대기</span>`;
                    let waveText = `<span style="color:#94A3B8;">수신대기</span>`;
                    if (hasRealSig && hasRealMax) waveText = `유의 ${sigVal.toFixed(1)}m (최대 ${maxVal.toFixed(1)}m)`;
                    else if (hasRealSig) waveText = `유의 ${sigVal.toFixed(1)}m`;

                    let clickableTitle = `<span style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="event.stopPropagation(); openWeatherHistoryModal('${stKey}')" title="클릭 시 '${stTitle}' 최근 6시간 이력 조회">${stTitle}</span>`;

                    if (isKhoa) {
                        stationPoints.push(`🌊 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}${!isTideOnlyWind ? ' / 파고: ' + waveText : ''}</div>`);
                    } else if (isNmpnt) {
                        stationPoints.push(`🏢 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}</div>`);
                    } else if (isAws) {
                        stationPoints.push(`📡 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}</div>`);
                    } else if (isBeacon) {
                        stationPoints.push(`🗼 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}${hasRealSig ? ' / 파고: ' + waveText : ''}</div>`);
                    } else {
                        stationPoints.push(`📍 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText} / 파고: ${waveText}</div>`);
                    }
                });

                pointDisplay = stationPoints.join('<br>');
                currentDisplay = stationRenders.join('');
                criteriaDisplay = `풍속 ${wLimit}m/s<br>${parsed.sigWaveLimit ? '유의 ' + parsed.sigWaveLimit + 'm' : '파고 2.0m'}`;
            }

            if (parsed.tonnage >= 2000) {
                if (hasGaleGyeongbo || isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn) { status = 'warn'; statusBadge = '<span class="status-badge badge-warn">🟡 통제주의</span>'; countWarn++; }
                else { status = 'ok'; statusBadge = '<span class="status-badge badge-ok">🟢 정상 (2,000G/T 이상)</span>'; countOk++; }
            } else if (isAutoControlledByWarning) {
                status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 자동통제(특보발효)</span>'; countDanger++;
            } else if (parsed.isYulmokRoute) {
                if (isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn || hasPreWarning) { status = 'warn'; statusBadge = `<span class="status-badge badge-warn">🟡 평수단축운항</span>`; countWarn++; }
                else { status = 'ok'; statusBadge = `<span class="status-badge badge-ok">🟢 정상</span>`; countOk++; }
            } else if (parsed.isPyungSuOnly) {
                if (isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn) { status = 'warn'; statusBadge = '<span class="status-badge badge-warn">🟡 통제주의</span>'; countWarn++; }
                else { status = 'ok'; statusBadge = `<span class="status-badge badge-ok">🟢 정상 (평수)</span>`; countOk++; }
            } else if (parsed.stations && parsed.stations.length > 0) {
                if (isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn || hasPreWarning) { status = 'warn'; statusBadge = '<span class="status-badge badge-warn">🟡 통제주의(예비/근접)</span>'; countWarn++; }
                else if (parsed.isCaptainOpinion) { status = 'captain'; statusBadge = '<span class="status-badge badge-captain">🔵 선장협의</span>'; countSpecial++; }
                else { status = 'ok'; statusBadge = '<span class="status-badge badge-ok">🟢 정상</span>'; countOk++; }
            } else if (parsed.isCaptainOpinion) {
                status = 'captain'; statusBadge = '<span class="status-badge badge-captain">🔵 선장협의</span>'; countSpecial++;
            } else if (parsed.isOfficeDecision) {
                status = 'office'; statusBadge = '<span class="status-badge badge-office">🏢 파견지결정</span>'; countSpecial++;
            } else {
                status = 'office'; statusBadge = '<span class="status-badge badge-office">운항확인</span>'; countSpecial++;
            }

            let warningCellHtml = '<span style="color:#94A3B8; font-weight:bold;">-</span>';
            if (activeWarningItems.length > 0) {
                warningCellHtml = activeWarningItems.map(w => {
                    let isAdv = w.alert.includes('예비') || w.alert.includes('예정');
                    return `<span class="warn-alert-badge ${isAdv ? 'warning-adv' : ''}">🚨 ${w.sea} ${w.alert}</span>`;
                }).join('<br>');
            }

            let isFiltered = false;
            if (boardFilterMode === 'danger' && status !== 'danger') isFiltered = true;
            if (boardFilterMode === 'warn_danger' && (status !== 'warn' && status !== 'danger')) isFiltered = true;
            if (boardFilterMode === 'special' && (status !== 'captain' && status !== 'office')) isFiltered = true;
            if (boardFilterMode === 'ok' && status !== 'ok') isFiltered = true;

            if (!isFiltered) {
                rowsHtml += `
                    <tr id="ship-row-${ship.code}">
                        <td><strong>${effectiveRoute}</strong>${areaBadgeHtml}</td>
                        <td><strong>${cleanName}</strong> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></td>
                        <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')" title="클릭 시 관측 상세 테이블이 펼쳐집니다.">
                            ${pointDisplay || '-'} <span class="meteo-expand-indicator" id="meteo-toggle-icon-${ship.code}">▼</span>
                        </td>
                        <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')" title="클릭 시 관측 상세 테이블이 펼쳐집니다.">
                            ${currentDisplay || '-'}
                        </td>
                        <td style="color:#475569;">${criteriaDisplay || '-'}</td>
                        <td>${statusBadge}</td>
                        <td>${warningCellHtml}</td>
                    </tr>
                    <tr id="meteo-detail-${ship.code}" class="meteo-detail-row" style="display: none;">
                        <td colspan="7" style="padding: 0;">
                            ${buildMeteoSubTableHtml(parsed, cleanName, effectiveRoute)}
                        </td>
                    </tr>
                `;

                mobileHtml += `
                    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="font-weight:bold; color:#1E293B;">[${effectiveRoute}${parsed.navArea ? ' (' + parsed.navArea + ')' : ''}] ${cleanName} <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></div>
                            <div>${statusBadge}</div>
                        </div>
                        <div style="font-size:12px; color:#334155; margin-bottom:4px;">${currentDisplay || '관측소 연계 없음'}</div>
                        <div style="font-size:11.5px; color:#64748B;">기준: 풍속 ${wLimit}m/s / ${parsed.sigWaveLimit ? '유의 ' + parsed.sigWaveLimit + 'm' : '파고 2.0m'}</div>
                    </div>
                `;
            }
        } catch (errInner) {
            console.error("선박 렌더링 예외:", errInner);
        }
    });

    const sumTotalEl = document.getElementById('sum-total');
    const sumOkEl = document.getElementById('sum-ok');
    const sumWarnEl = document.getElementById('sum-warn');
    const sumDangerEl = document.getElementById('sum-danger');
    const sumSpecialEl = document.getElementById('sum-special');

    if (sumTotalEl) sumTotalEl.innerText = countTotal;
    if (sumOkEl) sumOkEl.innerText = countOk;
    if (sumWarnEl) sumWarnEl.innerText = countWarn;
    if (sumDangerEl) sumDangerEl.innerText = countDanger;
    if (sumSpecialEl) sumSpecialEl.innerText = countSpecial;

    tbody.innerHTML = rowsHtml || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94A3B8;">해당 조건에 일치하는 선박이 없습니다.</td></tr>`;
    mobileContainer.innerHTML = mobileHtml || `<div style="text-align:center; padding:20px; color:#94A3B8;">표출할 선박이 없습니다.</div>`;
}

// ==========================================
// 5. 기상특보 파싱 및 통신 엔진 (0.0 덮어쓰기 차단 + 6시간 이력 수집)
// ==========================================
function setSeaWarningByLatestFc(seaKey, alertType, fcTimeNum) {
    let prevFc = seaWarningTimestamps[seaKey] || 0;
    if (fcTimeNum >= prevFc) {
        activeSeaWarnings[seaKey] = alertType;
        seaWarningTimestamps[seaKey] = fcTimeNum;
    }
}

function parseWeatherWarnings(rawText) {
    if (!rawText || rawText.includes('AUTH_ERROR') || rawText.includes('SERVICE_ERROR') || rawText.includes('"status" : 401')) return;
    latestRawWarnText = rawText;

    for (let k in activeSeaWarnings) {
        activeSeaWarnings[k] = null;
        seaWarningTimestamps[k] = 0;
    }

    const nowMs = Date.now();

    try {
        let data = JSON.parse(rawText);
        let items = Array.isArray(data) ? data : (data.items || data.result || []);

        if (items.length > 0) {
            items.forEach(item => {
                let regKo = String(item.REG_KO || item.REG_NAME || '').replace(/\s/g, '');
                let wrn = String(item.WRN || '').replace(/\s/g, '');
                let lvl = String(item.LVL || '').replace(/\s/g, '');
                let cmd = String(item.CMD || '').replace(/\s/g, '');
                let tmEfStr = String(item.TM_EF || '').trim().replace(/\D/g, '');
                let tmFcStr = String(item.TM_FC || '0').trim().replace(/\D/g, '');
                let fcTimeNum = parseInt(tmFcStr, 10) || 0;

                if (cmd.includes('해제') || cmd === '3') return;
                if (!wrn.includes('풍랑') && !wrn.includes('해상')) return;

                let tmEfMs = 0;
                let efHourStr = "15:00";
                if (tmEfStr.length >= 10) {
                    let y = parseInt(tmEfStr.substring(0, 4), 10);
                    let m = parseInt(tmEfStr.substring(4, 6), 10) - 1;
                    let d = parseInt(tmEfStr.substring(6, 8), 10);
                    let h = parseInt(tmEfStr.substring(8, 10), 10);
                    let min = tmEfStr.length >= 12 ? parseInt(tmEfStr.substring(10, 12), 10) : 0;
                    tmEfMs = new Date(y, m, d, h, min, 0).getTime();
                    efHourStr = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
                }

                let alertType = '풍랑예비특보';
                let isPurePreWarning = lvl.includes('예비') || cmd === '2' || wrn.includes('예비') || regKo.includes('예비');

                if (isPurePreWarning) alertType = '풍랑예비특보';
                else {
                    let isGyeongbo = lvl.includes('경보');
                    let baseName = isGyeongbo ? '풍랑경보' : '풍랑주의보';
                    if (tmEfMs > 0 && nowMs < tmEfMs) alertType = `${baseName}(발효예정 ${efHourStr})`;
                    else if (tmEfMs > 0 && nowMs >= tmEfMs) alertType = `${baseName}(발효중)`;
                    else alertType = '풍랑예비특보';
                }

                if (regKo.includes('전남북부')) setSeaWarningByLatestFc('서해남부앞바다(전남북부)', alertType, fcTimeNum);
                else if (regKo.includes('전남중부')) setSeaWarningByLatestFc('서해남부앞바다(전남중부)', alertType, fcTimeNum);
                else if (regKo.includes('전남남부')) setSeaWarningByLatestFc('서해남부앞바다(전남남부)', alertType, fcTimeNum);
                else if (regKo.includes('북쪽안쪽먼바다') || (regKo.includes('서해남부') && regKo.includes('북쪽') && regKo.includes('먼바다'))) setSeaWarningByLatestFc('서해남부북쪽안쪽먼바다', alertType, fcTimeNum);
                else if (regKo.includes('남쪽안쪽먼바다') || (regKo.includes('서해남부') && regKo.includes('남쪽') && regKo.includes('먼바다'))) setSeaWarningByLatestFc('서해남부남쪽안쪽먼바다', alertType, fcTimeNum);
                else if (regKo.includes('남쪽바깥먼바다')) setSeaWarningByLatestFc('서해남부남쪽안쪽먼바다', alertType, fcTimeNum);
                else if (regKo.includes('남해서부서쪽먼바다') || (regKo.includes('남해서부') && regKo.includes('서쪽'))) setSeaWarningByLatestFc('남해서부서쪽먼바다', alertType, fcTimeNum);
                else if (regKo.includes('제주도북부앞바다') || (regKo.includes('제주도') && regKo.includes('북부앞'))) setSeaWarningByLatestFc('제주도북부앞바다', alertType, fcTimeNum);
            });
            return;
        }
    } catch (e) {
        let text = rawText.replace(/\r/g, '');
        let wMatch = text.match(/o\s*풍랑주의보[^\n:]*:\s*([\s\S]*?)(?=\n\s*o|\n\s*\(\d\)|\n\s*<|$)/i);
        let wBlock = wMatch ? wMatch[1].replace(/\s/g, '') : '';
        let pMatch = text.match(/o\s*(?:풍랑)?예비특보[^\n:]*:\s*([\s\S]*?)(?=\n\s*o|\n\s*\(\d\)|\n\s*<|$)/i);
        let pBlock = pMatch ? pMatch[1].replace(/\s/g, '') : '';

        const matchBlock = (block, alertType) => {
            if (!block) return;
            if (block.includes('전남북부')) activeSeaWarnings['서해남부앞바다(전남북부)'] = alertType;
            if (block.includes('전남중부')) activeSeaWarnings['서해남부앞바다(전남중부)'] = alertType;
            if (block.includes('전남남부')) activeSeaWarnings['서해남부앞바다(전남남부)'] = alertType;
            if (block.includes('서해남부북쪽안쪽먼바다')) activeSeaWarnings['서해남부북쪽안쪽먼바다'] = alertType;
            if (block.includes('서해남부남쪽안쪽먼바다')) activeSeaWarnings['서해남부남쪽안쪽먼바다'] = alertType;
            if (block.includes('남해서부서쪽먼바다')) activeSeaWarnings['남해서부서쪽먼바다'] = alertType;
            if (block.includes('제주도북부앞바다')) activeSeaWarnings['제주도북부앞바다'] = alertType;
        };

        matchBlock(wBlock, '풍랑주의보(발효예정 15:00)');
        matchBlock(pBlock, '풍랑예비특보');
    }
}

async function fetchWithTimeout(url, options = {}, timeout = 5500) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function fetchKmaApi(type, authKey) {
    try {
        const url = `/api/kma?type=${type}&authKey=${encodeURIComponent(authKey)}&_t=${Date.now()}`;
        const response = await fetchWithTimeout(url, {}, 5500);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        let text = "";
        try {
            const decoderEuc = new TextDecoder('euc-kr');
            text = decoderEuc.decode(buffer);
        } catch (decErr) {
            const decoderUtf = new TextDecoder('utf-8');
            text = decoderUtf.decode(buffer);
        }
        
        if (text && text.trim().length > 5 && !text.includes("FETCH_ERROR") && !text.includes("INVALID_")) {
            return text;
        }
        throw new Error("유효하지 않은 응답");
    } catch (err) {
        console.warn(`[KMA ${type} 실패]:`, err.message);
        return null;
    }
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

        // 1. 기상청 부이 및 등표(해수서) 파싱
        if (textBuoy) {
            const lines = textBuoy.split('\n');
            const targetBuoys = [
                { id: '22183', key: '신안' },
                { id: '22184', key: '추자도' },
                { id: '22102', key: '칠발도' },
                { id: '22298', key: '홍도' },
                { id: '22297', key: '가거도' },
                { id: '22193', key: '흑산도' },
                { id: '959',   key: '해수서파고' }
            ];

            let latestTsByKey = {};

            lines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.includes(',') ? line.split(',').map(c => c.trim()) : line.split(/\s+/);
                if (cols.length < 9) return;

                const tmStr = cols[1] || '';
                const timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';
                const stnId = cols[2];

                targetBuoys.forEach(tb => {
                    if (stnId === tb.id) {
                        let rawWh = parseFloat(cols[6]);
                        let rawWd = parseFloat(cols[7]);
                        let rawWs = parseFloat(cols[8]);
                        let rawMaxWh = cols.length >= 10 ? parseFloat(cols[9]) : NaN;

                        let isInvalidZeroWind = (rawWs === 0 && rawWd === 0);

                        let wVal = (!isInvalidZeroWind && !isNaN(rawWs) && rawWs >= 0 && rawWs < 50.0) ? rawWs.toFixed(1) : '-';
                        let dVal = (!isInvalidZeroWind && !isNaN(rawWd) && rawWd >= 0 && rawWd <= 360) ? degToDirection(rawWd) : '-';
                        let whVal = (!isNaN(rawWh) && rawWh >= 0.0 && rawWh <= 12.0) ? rawWh.toFixed(1) : '-';
                        let maxWhVal = (!isNaN(rawMaxWh) && rawMaxWh >= 0.0 && rawMaxWh <= 20.0) ? rawMaxWh.toFixed(1) : '-';

                        if (wVal !== '-' || whVal !== '-') {
                            if (!stationHistoryMap[tb.key]) stationHistoryMap[tb.key] = [];
                            let idx = stationHistoryMap[tb.key].findIndex(h => h.sortKey === tmStr);
                            let entry = { sortKey: tmStr, time: timeOnly, wind: wVal, windDir: dVal, sigWave: whVal, maxWave: maxWhVal };
                            if (idx >= 0) stationHistoryMap[tb.key][idx] = entry;
                            else stationHistoryMap[tb.key].push(entry);
                        }

                        if (!latestTsByKey[tb.key] || tmStr >= latestTsByKey[tb.key]) {
                            latestTsByKey[tb.key] = tmStr;
                            if (wVal !== '-') {
                                latestBuoyData[tb.key].wind = wVal;
                                latestBuoyData[tb.key].windDir = dVal;
                                updatedCount++;
                            }
                            if (whVal !== '-') {
                                latestBuoyData[tb.key].sigWave = whVal;
                                if (tb.key === '해수서파고' && wVal === '-') updatedCount++;
                            }
                            if (maxWhVal !== '-') {
                                latestBuoyData[tb.key].maxWave = maxWhVal;
                            }
                        }
                    }
                });
            });
        }

        // 2. 기상청 AWS (옥도 308)
        if (textAws) {
            const awsLines = textAws.split('\n');
            let latestAwsTs = '';

            awsLines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.split(/[\s,]+/).filter(Boolean);
                if (cols.length >= 4 && cols[1] === '308') {
                    const tmStr = cols[0] || '';
                    const timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';
                    const wd1 = parseFloat(cols[2]);
                    const ws1 = parseFloat(cols[3]);
                    const wd10 = cols.length >= 8 ? parseFloat(cols[6]) : -99;
                    const ws10 = cols.length >= 8 ? parseFloat(cols[7]) : -99;

                    const finalWs = (!isNaN(ws10) && ws10 >= 0 && ws10 < 100) ? ws10 : ws1;
                    const finalWd = (!isNaN(wd10) && wd10 >= 0 && wd10 <= 360) ? wd10 : wd1;

                    let isInvalidZero = (finalWs === 0 && finalWd === 0);

                    if (!isInvalidZero && !isNaN(finalWs) && finalWs >= 0 && finalWs < 100) {
                        const wStr = finalWs.toFixed(1);
                        const dStr = (!isNaN(finalWd) && finalWd >= 0 && finalWd <= 360) ? degToDirection(finalWd) : '-';

                        if (!stationHistoryMap['옥도']) stationHistoryMap['옥도'] = [];
                        let idx = stationHistoryMap['옥도'].findIndex(h => h.sortKey === tmStr);
                        let entry = { sortKey: tmStr, time: timeOnly, wind: wStr, windDir: dStr, sigWave: null, maxWave: null };
                        if (idx >= 0) stationHistoryMap['옥도'][idx] = entry;
                        else stationHistoryMap['옥도'].push(entry);

                        if (!latestAwsTs || tmStr >= latestAwsTs) {
                            latestAwsTs = tmStr;
                            latestBuoyData['옥도'].wind = wStr;
                            latestBuoyData['옥도'].windDir = dStr;
                            updatedCount++;
                        }
                    }
                }
            });
        }

        // 3. 측위정보원 등대
        if (dataNmpnt && dataNmpnt.result && dataNmpnt.result.recordset) {
            const records = dataNmpnt.result.recordset;
            const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
            const nowSortKey = kstNow.toISOString().replace(/\D/g, '').substring(0, 12);
            const nowTime = `${nowSortKey.substring(8,10)}:${nowSortKey.substring(10,12)}`;

            records.forEach(item => {
                const code = String(item.MMSI_CODE || '').trim();
                const name = String(item.MMSI_NM || '').trim();
                const ws = parseFloat(item.WIND_SPEED);
                const wd = parseFloat(item.WIND_DIRECT);
                let tmStr = String(item.RECORD_TIME || item.TIME || item.REG_DATE || '');
                let timeOnly = tmStr.length >= 16 ? tmStr.substring(11, 16) : (tmStr.includes(' ') ? tmStr.split(' ')[1].substring(0,5) : nowTime);
                let sortKey = tmStr.replace(/\D/g, '').length >= 12 ? tmStr.replace(/\D/g, '').substring(0, 12) : nowSortKey;

                if (ws === 0 && wd === 0) return;

                if (!isNaN(ws) && ws >= 0 && ws < 60) {
                    const dirStr = (!isNaN(wd) && wd >= 0 && wd <= 360) ? degToDirection(wd) : '-';
                    const formattedWs = ws.toFixed(1);

                    let targetKey = null;
                    if (code === '1079001' || name.includes('안좌')) targetKey = '안좌';
                    else if (code === '1079008' || name.includes('외달')) targetKey = '외달도';
                    else if (code === '1079003' || (name.includes('가거') && name.includes('등대'))) targetKey = '가거도등대';
                    else if (code === '1079002' || (name.includes('홍도') && name.includes('등대'))) targetKey = '홍도등대';
                    else if (code === '1079005' || code === '1079004' || name.includes('하조도')) targetKey = '하조도';
                    else if (code === '1079007' || name.includes('계마')) targetKey = '계마항';

                    if (targetKey && latestBuoyData[targetKey]) {
                        if (!stationHistoryMap[targetKey]) stationHistoryMap[targetKey] = [];
                        let idx = stationHistoryMap[targetKey].findIndex(h => h.time === timeOnly);
                        let entry = { sortKey: sortKey, time: timeOnly, wind: formattedWs, windDir: dirStr, sigWave: null, maxWave: null };
                        if (idx >= 0) stationHistoryMap[targetKey][idx] = entry;
                        else stationHistoryMap[targetKey].push(entry);

                        latestBuoyData[targetKey].wind = formattedWs;
                        latestBuoyData[targetKey].windDir = dirStr;
                        updatedCount++;
                    }
                }
            });
        }

        // 4. 국립해양조사원 해양관측부이/기지 및 조위관측소(향화도) 파싱
        const parseKhoaStation = (resObj, targetKey) => {
            if (!resObj || !resObj.result || !resObj.result.data) return false;
            const kData = resObj.result.data;
            let hasAnyData = false;

            if (Array.isArray(resObj.rawItems)) {
                if (!stationHistoryMap[targetKey]) stationHistoryMap[targetKey] = [];
                resObj.rawItems.forEach(item => {
                    const ws = parseFloat(item.windSpeed ?? item.wind_speed ?? item.wspd ?? item.ws);
                    const wd = parseFloat(item.windDir ?? item.wind_dir ?? item.wdir ?? item.wd);
                    const sigW = parseFloat(item.waveHeight ?? item.waveHgt ?? item.wave_hgt ?? item.sigWaveHgt ?? item.swh ?? item.wh);
                    const maxW = parseFloat(item.maxWaveHeight ?? item.maxWaveHgt ?? item.max_wave_hgt ?? item.mwh);
                    let tmStr = String(item.obsTime ?? item.record_time ?? item.tm ?? item.obsDt ?? '');
                    let digits = tmStr.replace(/\D/g, '');
                    let sortKey = digits.length >= 12 ? digits.substring(0, 12) : tmStr;
                    let timeOnly = tmStr.length >= 16 ? tmStr.substring(11, 16) : (digits.length >= 12 ? `${digits.substring(8,10)}:${digits.substring(10,12)}` : '최신');

                    let wStr = (!isNaN(ws) && ws >= 0 && ws < 80) ? ws.toFixed(1) : '-';
                    let dStr = (!isNaN(wd) && wd >= 0 && wd <= 360) ? degToDirection(wd) : '-';
                    let sWave = (!isNaN(sigW) && sigW >= 0 && sigW <= 20) ? sigW.toFixed(1) : '-';
                    let mWave = (!isNaN(maxW) && maxW >= 0 && maxW <= 30) ? maxW.toFixed(1) : '-';

                    if (wStr !== '-' || sWave !== '-') {
                        let idx = stationHistoryMap[targetKey].findIndex(h => h.sortKey === sortKey && h.time === timeOnly);
                        let entry = { sortKey: sortKey, time: timeOnly, wind: wStr, windDir: dStr, sigWave: sWave, maxWave: mWave };
                        if (idx >= 0) stationHistoryMap[targetKey][idx] = entry;
                        else stationHistoryMap[targetKey].push(entry);
                    }
                });
            }

            const ws = parseFloat(kData.wind_speed);
            const wd = parseFloat(kData.wind_dir);
            if (!isNaN(ws) && ws >= 0 && ws < 80) {
                latestBuoyData[targetKey].wind = ws.toFixed(1);
                latestBuoyData[targetKey].windDir = (!isNaN(wd) && wd >= 0) ? degToDirection(wd) : '-';
                hasAnyData = true;
            }

            if (latestBuoyData[targetKey].sigWave !== null) {
                const sigW = parseFloat(kData.sig_wave);
                if (!isNaN(sigW) && sigW >= 0 && sigW <= 20) {
                    latestBuoyData[targetKey].sigWave = sigW.toFixed(1);
                    hasAnyData = true;
                }

                const maxW = parseFloat(kData.max_wave);
                if (!isNaN(maxW) && maxW >= 0 && maxW <= 30) {
                    latestBuoyData[targetKey].maxWave = maxW.toFixed(1);
                    hasAnyData = true;
                }
            }

            return hasAnyData;
        };

        if (parseKhoaStation(dataKhoaChuja, '추자조사원')) updatedCount++;
        if (parseKhoaStation(dataKhoaMaenggol, '맹골조사원')) updatedCount++;
        if (parseKhoaStation(dataKhoaGageocho, '가거초조사원')) updatedCount++;
        if (parseKhoaStation(dataKhoaChilsan, '칠산조사원')) updatedCount++;
        if (parseKhoaStation(dataKhoaHyanghwa, '향화도조위')) updatedCount++;

        // 5. 특보 파싱
        if (textWarn) parseWeatherWarnings(textWarn);

        if (updatedCount > 0) {
            if (recvEl) recvEl.innerText = `📡 [실시간] ${new Date().toLocaleTimeString()} (${updatedCount}개소 연동)`;
            if (!isAuto) alert(`✅ 해양기상 관측 데이터가 정상 반영되었습니다!`);
        } else {
            if (recvEl) recvEl.innerText = `⚠️ 수신된 기상 데이터 없음`;
        }
        renderOperationBoard();
    } catch (err) {
        console.error("수신 전체 실패:", err);
        if (recvEl) recvEl.innerText = `⚠️ 통신 차단 또는 오류`;
        renderOperationBoard();
    }
};

// ==========================================
// 6. 타이머 제어
// ==========================================
function startCountdownTimer() {
    stopCountdownTimer();
    let sel = document.getElementById('auto-refresh-select');
    let intervalSec = sel ? parseInt(sel.value, 10) : 300;
    nextRefreshRemainingSec = intervalSec;

    const clockEl = document.getElementById('current-clock');
    if (clockEl) clockEl.innerText = `🕒 현재시각: ${new Date().toTimeString().split(' ')[0]}`;

    countdownIntervalId = setInterval(() => {
        const curTimeStr = new Date().toTimeString().split(' ')[0];
        const clockEl = document.getElementById('current-clock');
        if (clockEl) clockEl.innerText = `🕒 현재시각: ${curTimeStr}`;

        const counterEl = document.getElementById('next-refresh-counter');
        const selectEl = document.getElementById('auto-refresh-select');
        const curSelVal = selectEl ? parseInt(selectEl.value, 10) : 300;

        if (curSelVal === 0) {
            if (counterEl) counterEl.innerText = `⏳ 다음 갱신: 정지됨`;
            return;
        }

        if (nextRefreshRemainingSec > 0) {
            nextRefreshRemainingSec--;
            const m = String(Math.floor(nextRefreshRemainingSec / 60)).padStart(2, '0');
            const s = String(nextRefreshRemainingSec % 60).padStart(2, '0');
            if (counterEl) counterEl.innerText = `⏳ 다음 갱신: ${m}:${s}`;
        } else {
            nextRefreshRemainingSec = curSelVal;
            const boardSec = document.getElementById('board-section');
            if (boardSec && boardSec.style.display === 'block') {
                fetchWeatherRealtime(true);
            }
        }
    }, 1000);
}

function stopCountdownTimer() {
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
}

window.changeAutoRefreshInterval = function(valStr) {
    let sec = parseInt(valStr, 10);
    nextRefreshRemainingSec = sec;
    const counterEl = document.getElementById('next-refresh-counter');
    if (sec === 0) {
        if (counterEl) counterEl.innerText = `⏳ 다음 갱신: 정지됨`;
    } else {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(nextRefreshRemainingSec % 60).padStart(2, '0');
        if (counterEl) counterEl.innerText = `⏳ 다음 갱신: ${m}:${s}`;
    }
};

window.manualRefreshWeather = function() {
    let sel = document.getElementById('auto-refresh-select');
    let sec = sel ? parseInt(sel.value, 10) : 300;
    nextRefreshRemainingSec = sec;
    fetchWeatherRealtime(false);
};

// ==========================================
// 7. 선박 기초자료 UI 렌더링 & 모달 제어
// ==========================================
function render() {
    try {
        if (typeof baseShipData === 'undefined') return;
        const showHiddenToggle = document.getElementById('showHiddenToggle');
        const showHidden = showHiddenToggle ? showHiddenToggle.checked : false;

        let allMap = {};
        baseShipData.forEach((d, idx) => {
            let code = (d[1] || `idx_${idx}`).trim();
            let override = cloudCustomData[code] || {};
            let photoUrl = (override.images && override.images.photo) || override.photo || null;
            allMap[code] = {
                isCustom: false,
                rawArray: d,
                code: code,
                rawName: override.rawName !== undefined ? override.rawName : d[0],
                route: override.route !== undefined ? override.route : d[2],
                company: override.company !== undefined ? override.company : d[3],
                ports: override.ports !== undefined ? override.ports : d[4],
                notes: override.notes !== undefined ? override.notes : d[5],
                capacity: override.capacity !== undefined ? override.capacity : d[6],
                decision: override.decision !== undefined ? override.decision : d[7],
                customFields: override.customFields || [],
                timetables: override.timetables || [],
                isHidden: !!override.isHidden,
                isDeleted: !!override.isDeleted,
                deployedTarget: override.deployedTarget ? String(override.deployedTarget).trim() : null,
                cloudPhoto: photoUrl
            };
        });

        customAddedShips.forEach(s => {
            let code = String(s.id).trim();
            let photoUrl = (s.images && s.images.photo) || s.photo || null;
            allMap[code] = {
                isCustom: true,
                code: code,
                rawName: s.rawName || '신규선박',
                route: s.route || '기타항로',
                company: s.company || '-',
                ports: s.ports || '-',
                notes: s.notes || '-',
                capacity: s.capacity || '-',
                decision: s.decision || '-',
                customFields: s.customFields || [],
                timetables: s.timetables || [],
                isHidden: !!s.isHidden,
                isDeleted: !!s.isDeleted,
                deployedTarget: s.deployedTarget ? String(s.deployedTarget).trim() : null,
                cloudPhoto: photoUrl
            };
        });

        let visibleShips = [];
        for (let c in allMap) {
            let s = allMap[c];
            if (s.isDeleted) continue;
            let isOriginalReserve = (s.route || '').trim() === '예비선';
            let isDeployedReserve = isOriginalReserve && !!s.deployedTarget;
            if (s.isHidden && !showHidden && !isDeployedReserve) continue;

            let targetShip = isDeployedReserve ? allMap[s.deployedTarget] : null;
            let effectiveRoute = (targetShip ? targetShip.route : s.route || '기타항로').trim();
            visibleShips.push({ ...s, displayRoute: effectiveRoute, targetShip: targetShip });
        }

        let regularRoutes = new Set(visibleShips.filter(s => (s.displayRoute || '').trim() !== '예비선').map(s => (s.displayRoute || '').trim()));
        let uniqueVesselCount = new Set(visibleShips.map(s => s.code)).size;
        
        const statsEl = document.getElementById('stats');
        if (statsEl) statsEl.innerText = `[ ${regularRoutes.size}개 항로 / 총 ${uniqueVesselCount}척 ]`;

        let groups = {};
        visibleShips.forEach(s => {
            let r = s.displayRoute;
            if (!groups[r]) groups[r] = [];
            groups[r].push(s);
        });

        let sortedRouteKeys = Object.keys(groups).sort((a, b) => {
            if (a === '예비선') return 1;
            if (b === '예비선') return -1;
            return a.localeCompare(b, 'ko');
        });

        let fullHtml = "";

        sortedRouteKeys.forEach(r => {
            let isReserveGroup = (r === '예비선');
            let groupHtml = `<div class="route-group"><div class="route-header ${isReserveGroup ? 'reserve' : ''}" onclick="toggleRoute(this.nextElementSibling)">📍 ${r} (${groups[r].length}척) <span>▼</span></div><div class="vessel-list">`;

            groups[r].forEach((v, idx) => {
                let cleanName = (v.rawName || '').split('(')[0].split('\n')[0].trim().replace(/\s/g, '');
                if (cleanName === "상동") cleanName = "도초카훼리";
                let uId = cleanName + idx;

                let deployedBadge = '';
                let isOriginalReserve = (v.route || '').trim() === '예비선';
                
                let displayNameText = v.rawName || '';
                if (isOriginalReserve && v.targetShip) {
                    let tName = (v.targetShip.rawName || '').split('(')[0].split('\n')[0].trim();
                    deployedBadge = `<span class="badge-deployed">⚡ [${tName} 대체운항 중]</span>`;
                    let reserveHeader = (v.rawName || '').split('\n')[0] || '';
                    let targetLines = (v.targetShip.rawName || '').split('\n').map(l => l.trim()).filter(Boolean);
                    displayNameText = [reserveHeader, targetLines[1] || '', targetLines[2] || ''].filter(Boolean).join('\n');
                }

                let vNameHTML = displayNameText.replace(/\n/g, '<br>').replace(/(통제기준:[^)]+\))/g, '<span class="highlight-red">$1</span>');

                let customRowsHtml = "";
                if (v.customFields && v.customFields.length > 0) {
                    v.customFields.forEach(f => {
                        if (f.key && f.val) customRowsHtml += `<tr><td class="label" style="color:#0284C7;">${f.key}</td><td style="font-weight:600;">${f.val.replace(/\n/g, '<br>')}</td></tr>`;
                    });
                }

                let ttButtonsHtml = "";
                if (v.timetables && v.timetables.length > 0) {
                    v.timetables.forEach((tt, tIdx) => {
                        if (tt.title && tt.imgData) ttButtonsHtml += `<div class="btn-dynamic-tt" onclick="showImg('${tt.imgData}', '${tt.title}', { type: 'timetable', shipCode: '${v.code}', ttIndex: ${tIdx}, title: '${tt.title}' })">📅 ${tt.title}</div>`;
                    });
                }

                let deployBtnHtml = isOriginalReserve ? `<button class="btn-action btn-deploy-act" onclick="openDeployModal('${v.code}')">🚢 대체투입 설정</button>` : '';

                groupHtml += `<div class="vessel-card ${isReserveGroup ? 'reserve' : ''} ${v.deployedTarget ? 'deployed' : ''} ${v.isHidden ? 'is-hidden' : ''}">
                    <div class="vessel-header" onclick="toggleVessel(this, '${cleanName}', '${uId}', '${v.code}')">
                        <div class="vessel-name">${vNameHTML} ${deployedBadge} ${v.isHidden ? '<span class="badge-hidden">선박 숨김</span>' : ''}</div>
                        <div style="font-size:12px; color:#999;">▼</div>
                    </div>
                    <div class="detail-info">
                        <img id="auto-img-${uId}" style="display:none; width:100%; height:auto; border-radius:8px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1); cursor:pointer;">
                        <table>
                            <tr><td class="label">선박코드</td><td>${v.code || '-'}</td></tr>
                            <tr><td class="label">소속항로</td><td><strong>${v.displayRoute}</strong> ${isOriginalReserve ? '(원 소속: 예비선)' : ''}</td></tr>
                            <tr><td class="label">선사</td><td>${v.company || '-'}</td></tr>
                            <tr><td class="label">기항지</td><td>${(v.ports || '').replace(/\n/g, '<br>')}</td></tr>
                            <tr><td class="label">여객정원</td><td>${v.capacity}명</td></tr>
                            <tr><td class="label">운항결정</td><td style="font-weight:bold; color:#1A237E;">${(v.decision || '').replace(/\n/g, '<br>')}</td></tr>
                            <tr><td class="label">비고</td><td>${(v.notes || '').replace(/\n/g, '<br>')}</td></tr>
                            ${customRowsHtml}
                        </table>
                        <div class="button-grid" id="grid-${uId}">
                            <div id="btn-map-${uId}" class="img-button btn-map">🗺️ 항로도(PATIS)</div>
                            ${ttButtonsHtml}
                            <div id="btn-ann-${uId}" class="img-button btn-annual">📅 기본시간표</div>
                            <div id="btn-spc-${uId}" class="img-button btn-special">🔢 특수일</div>
                            <div id="btn-sum-${uId}" class="img-button btn-summer">☀️ 하절기</div>
                            <div id="btn-win-${uId}" class="img-button btn-winter">❄️ 동절기</div>
                        </div>
                        <div id="rule-btn-1-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도</div>
                        <div id="rule-btn-2-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 2</div>
                        <div id="rule-btn-3-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 3</div>
                        <div id="rule-btn-4-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 4</div>
                        <div id="rule-btn-5-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 5</div>
                        <div id="car-btn-1-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료</div>
                        <div id="car-btn-2-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료 2</div>
                        <div id="car-btn-3-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료 3</div>

                        <div class="admin-btn-group">
                            ${deployBtnHtml}
                            <button class="btn-action btn-edit-act" onclick="openEditModal('${v.code}')">✏️ 정보 및 사진 수정</button>
                            ${v.isHidden ? 
                                `<button class="btn-action btn-unhide-act" onclick="toggleHideShip('${v.code}', false)">👁️ 숨김 해제</button>` : 
                                `<button class="btn-action btn-hide-act" onclick="toggleHideShip('${v.code}', true)">🙈 선박 숨기기</button>`
                            }
                            <button class="btn-action btn-del-act" onclick="deleteShip('${v.code}')">🗑️ 선박 삭제</button>
                        </div>
                    </div>
                </div>`;
            });
            groupHtml += `</div></div>`;
            fullHtml += groupHtml;
        });

        const mainListEl = document.getElementById('mainList');
        if (mainListEl) mainListEl.innerHTML = fullHtml;
    } catch (e) {
        console.error("render() 예외 발생:", e);
    }
}

function renderRefSection() {
    const container = document.getElementById('ref-items-container');
    if (!container) return;

    let items = [];
    for (let k in defaultRefItems) {
        let override = cloudRefItems[k] || {};
        if (!override.isDeleted) {
            items.push({ id: k, title: override.title || defaultRefItems[k].title, imgData: override.imgData || null, fallbackNames: defaultRefItems[k].fallbackNames, order: defaultRefItems[k].order });
        }
    }
    for (let k in cloudRefItems) {
        if (!defaultRefItems[k] && !cloudRefItems[k].isDeleted) {
            items.push({ id: k, title: cloudRefItems[k].title || '참고자료', imgData: cloudRefItems[k].imgData || null, fallbackNames: [], order: cloudRefItems[k].order || 99 });
        }
    }
    items.sort((a, b) => a.order - b.order);

    let html = "";
    items.forEach((item, idx) => {
        html += `
            <div class="ref-item-row">
                <div id="ref-btn-${idx}" class="ref-view-btn" onclick="openRefImage('${item.id}', '${item.title}')">${item.title}</div>
                <button class="ref-edit-btn" onclick="openEditRefModal('${item.id}')">✏️ 수정</button>
                ${!defaultRefItems[item.id] ? `<button class="ref-edit-btn" style="background:#DC2626;" onclick="deleteRefItem('${item.id}')">🗑️</button>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

window.openRefImage = function(itemId, title) {
    let item = cloudRefItems[itemId];
    if (item && item.imgData) {
        showImg(item.imgData, title, { type: 'ref', refId: itemId, title: title });
        return;
    }
    let def = defaultRefItems[itemId];
    if (def && def.fallbackNames) {
        let exts = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.webp'];
        let attempts = [];
        def.fallbackNames.forEach(b => { exts.forEach(e => attempts.push(b + e)); });
        let idx = 0;
        function tryNext() {
            if (idx >= attempts.length) { alert("등록된 이미지가 없습니다. [수정]을 통해 등록해 주세요."); return; }
            let path = attempts[idx++];
            let img = new Image();
            img.onload = () => showImg(path, title, null);
            img.onerror = tryNext;
            img.src = encodeURI(path);
        }
        tryNext();
    } else {
        alert("등록된 이미지가 없습니다. [수정]을 통해 등록해 주세요.");
    }
};

window.openAddRefModal = function() {
    document.getElementById('ref-item-id').value = '';
    document.getElementById('ref-modal-title').innerText = '➕ 새 참고자료 항목 추가';
    document.getElementById('ref-item-title').value = '';
    document.getElementById('upload-ref-file').value = '';
    document.getElementById('ref-upload-status').style.display = 'none';
    document.getElementById('ref-modal').style.display = 'flex';
};

window.openEditRefModal = function(id) {
    let item = cloudRefItems[id] || defaultRefItems[id] || {};
    document.getElementById('ref-item-id').value = id;
    document.getElementById('ref-modal-title').innerText = '✏️ 참고자료 타이틀 및 이미지 수정';
    document.getElementById('ref-item-title').value = item.title || '';
    document.getElementById('upload-ref-file').value = '';
    document.getElementById('ref-upload-status').style.display = 'none';
    document.getElementById('ref-modal').style.display = 'flex';
};

window.closeRefModal = function() { document.getElementById('ref-modal').style.display = 'none'; };

window.saveRefUpdate = async function() {
    let id = document.getElementById('ref-item-id').value;
    let title = document.getElementById('ref-item-title').value.trim();
    if (!title) { alert("타이틀을 입력해 주세요."); return; }

    let isNew = !id;
    let docId = id || `ref_${Date.now()}`;
    const statusEl = document.getElementById('ref-upload-status');
    const btnSave = document.getElementById('btn-save-ref');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let current = cloudRefItems[docId] || {};
        let file = document.getElementById('upload-ref-file').files[0];
        let imgData = current.imgData || null;
        if (file) imgData = await processImageFile(file, 1600, 0.85);

        await db.collection("reference_materials").doc(docId).set({
            title: title, imgData: imgData, isDeleted: false, order: current.order || (isNew ? Date.now() : 1), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("참고자료가 저장되었습니다!");
        closeRefModal();
    } catch (err) { alert("저장 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.deleteRefItem = async function(id) {
    if (!confirm("해당 참고자료 항목을 삭제하시겠습니까?")) return;
    try {
        await db.collection("reference_materials").doc(id).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        alert("삭제되었습니다.");
    } catch (err) { alert("삭제 실패: " + err.message); }
};

window.toggleRoute = function(listEl) { listEl.style.display = (listEl.style.display === 'block') ? 'none' : 'block'; };
window.toggleRefGroup = function(listEl) { listEl.style.display = (listEl.style.display === 'block') ? 'none' : 'block'; };

window.toggleVessel = function(headerEl, cleanName, uId, shipCode) {
    let detail = headerEl.nextElementSibling;
    let isOpening = (detail.style.display !== 'block');
    detail.style.display = isOpening ? 'block' : 'none';

    if (isOpening && !detail.dataset.loaded) {
        detail.dataset.loaded = "true";
        let cleanNoHo = cleanName.replace(/호$/, '');
        let override = cloudCustomData[shipCode] || {};
        let customShip = customAddedShips.find(s => s.id === shipCode);
        let photoUrl = (override.images && override.images.photo) || override.photo || (customShip && (customShip.images ? customShip.images.photo : customShip.photo));

        let imgEl = document.getElementById(`auto-img-${uId}`);
        if (photoUrl) {
            imgEl.src = photoUrl;
            imgEl.style.display = 'block';
            imgEl.onclick = (e) => { e.stopPropagation(); showImg(photoUrl, '선박 대표 사진', { type: 'photo', shipCode: shipCode, title: '대표 사진' }); };
        } else {
            loadAutoImg([cleanName + '_사진', cleanName, cleanNoHo + '_사진', cleanNoHo], `auto-img-${uId}`, shipCode);
        }

        smartBtnV2([cleanName + '_시간'], `btn-ann-${uId}`, '📅 기본시간표', shipCode);
        smartBtnV2([cleanName + '_특수', cleanName + '_짝수'], `btn-spc-${uId}`, '🔢 특수일/짝수', shipCode);
        smartBtnV2([cleanName + '_하'], `btn-sum-${uId}`, '☀️ 하절기', shipCode);
        smartBtnV2([cleanName + '_동'], `btn-win-${uId}`, '❄️ 동절기', shipCode);
        smartBtnV2([cleanName], `btn-map-${uId}`, '🗺️ 항로도(PATIS)', null);

        let ruleBtns = [
            {b: `rule-btn-1-${uId}`, base: cleanName + '_운규항로도'},
            {b: `rule-btn-2-${uId}`, base: cleanName + '_운규항로도2'},
            {b: `rule-btn-3-${uId}`, base: cleanName + '_운규항로도3'},
            {b: `rule-btn-4-${uId}`, base: cleanName + '_운규항로도4'},
            {b: `rule-btn-5-${uId}`, base: cleanName + '_운규항로도5'}
        ];
        smartGroupScan(ruleBtns, "📄 운항관리규정 항로도");

        let carBtns = [
            {b: `car-btn-1-${uId}`, base: cleanName + '_차량적재'},
            {b: `car-btn-2-${uId}`, base: cleanName + '_차량적재2'},
            {b: `car-btn-3-${uId}`, base: cleanName + '_차량적재3'}
        ];
        smartGroupScan(carBtns, "🚗 차량적재도 참고자료");
    }
};

const COMMON_EXTS = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.webp'];

function smartBtnV2(baseNames, btnId, title, shipCode = null) {
    let el = document.getElementById(btnId);
    if (!el) return;
    let attempts = [];
    baseNames.forEach(b => { COMMON_EXTS.forEach(e => attempts.push(b + e)); });
    let idx = 0;
    function tryNext() {
        if (idx >= attempts.length) return;
        let path = attempts[idx++];
        let img = new Image();
        img.onload = () => { el.style.display = 'block'; el.onclick = () => showImg(path, title, shipCode ? { type: 'static_fallback', shipCode: shipCode, title: title } : null); };
        img.onerror = tryNext;
        img.src = encodeURI(path);
    }
    tryNext();
}

function smartGroupScan(btnGroup, baseText) {
    let checks = btnGroup.map(item => {
        return new Promise((resolve) => {
            let attempts = [];
            COMMON_EXTS.forEach(e => attempts.push(item.base + e));
            let idx = 0;
            function next() {
                if (idx >= attempts.length) { resolve({ exists: false, item: item }); return; }
                let path = attempts[idx++];
                let img = new Image();
                img.onload = () => resolve({ exists: true, path: path, item: item });
                img.onerror = next;
                img.src = encodeURI(path);
            }
            next();
        });
    });

    Promise.all(checks).then(results => {
        let list = results.filter(r => r.exists);
        if (list.length === 1) {
            let r = list[0]; let b = document.getElementById(r.item.b);
            b.innerText = baseText; b.style.display = 'block'; b.onclick = () => showImg(r.path, baseText, null);
        } else if (list.length > 1) {
            list.forEach((r, idx) => {
                let b = document.getElementById(r.item.b);
                b.innerText = baseText + " " + (idx + 1); b.style.display = 'block'; b.onclick = () => showImg(r.path, baseText + " " + (idx + 1), null);
            });
        }
    });
}

function loadAutoImg(baseNames, imgId, shipCode) {
    let el = document.getElementById(imgId);
    if (!el) return;
    let attempts = [];
    baseNames.forEach(b => { COMMON_EXTS.forEach(e => attempts.push(b + e)); });
    let idx = 0;
    function tryNext() {
        if (idx >= attempts.length) return;
        let path = attempts[idx++];
        let img = new Image();
        img.onload = () => { el.src = encodeURI(path); el.style.display = 'block'; el.onclick = (e) => { e.stopPropagation(); showImg(path, '선박 대표 사진', { type: 'photo', shipCode: shipCode, title: '대표 사진' }); }; };
        img.onerror = tryNext;
        img.src = encodeURI(path);
    }
    tryNext();
}

window.showImg = (path, title, deleteContext = null) => {
    document.getElementById('mImg').src = path;
    document.getElementById('mCap').innerText = `🚢 [${title}]`;
    currentViewerContext = deleteContext || { type: 'unknown', title: title };
    document.getElementById('btn-modal-delete').style.display = 'block';
    document.getElementById('modal').style.display = 'flex';
};

window.closeViewerModal = () => {
    document.getElementById('modal').style.display = 'none';
    currentViewerContext = null;
};

window.handleDirectViewerDelete = async () => {
    if (!currentViewerContext) return;
    const ctx = currentViewerContext;
    if (!confirm(`정말 '${ctx.title}' 사진을 즉시 삭제하시겠습니까?`)) return;

    try {
        if (ctx.type === 'timetable') {
            let docRef = db.collection("vessel_overrides").doc(ctx.shipCode);
            let docSnap = await docRef.get();
            if (docSnap.exists) {
                let d = docSnap.data();
                let tts = d.timetables || [];
                tts.splice(ctx.ttIndex, 1);
                await docRef.set({ timetables: tts }, { merge: true });
            }
        } else if (ctx.type === 'photo') {
            await db.collection("vessel_overrides").doc(ctx.shipCode).set({ photo: null, images: { photo: null }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else if (ctx.type === 'ref') {
            await db.collection("reference_materials").doc(ctx.refId).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else {
            alert("시스템 기본 이미지이거나 삭제 대상이 아닙니다."); return;
        }
        alert("사진이 삭제되었습니다.");
        closeViewerModal();
    } catch (err) { alert("삭제 실패: " + err.message); }
};

window.runSearch = () => {
    let q = document.getElementById('searchInput').value.toLowerCase().replace(/\s/g,'');
    Array.from(document.getElementsByClassName('vessel-card')).forEach(c => {
        if (c.parentElement.parentNode.id === 'common-ref') return;
        c.style.display = c.innerText.toLowerCase().replace(/\s/g,'').includes(q) ? 'block' : 'none';
    });
    Array.from(document.getElementsByClassName('route-group')).forEach(g => {
        if (g.id === 'common-ref') { g.style.display = (q === "") ? 'block' : 'none'; return; }
        let has = Array.from(g.getElementsByClassName('vessel-card')).some(c => c.style.display !== 'none');
        g.style.display = has ? 'block' : 'none';
        let list = g.querySelector('.vessel-list');
        if (list) list.style.display = (q !== "" && has) ? 'block' : 'none';
    });
};

function processImageFile(file, maxWidth = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                elem.width = width;
                elem.height = height;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(elem.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

window.addCustomFieldRow = (key = '', val = '') => {
    const container = document.getElementById('custom-fields-container');
    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `<input type="text" class="custom-field-key" placeholder="항목명" value="${key}"><input type="text" class="custom-field-val" placeholder="내용" value="${val}"><button type="button" class="btn-del-field" onclick="this.parentElement.remove()">🗑️</button>`;
    container.appendChild(row);
};

window.addTimetableRow = (title = '', existingImgData = null) => {
    const container = document.getElementById('timetables-container');
    const row = document.createElement('div');
    row.className = 'tt-row';
    row.dataset.existingImg = existingImgData || '';
    row.innerHTML = `
        <div class="tt-row-header"><input type="text" class="tt-row-title" placeholder="시간표 명칭" value="${title}"><button type="button" class="btn-del-tt" onclick="this.closest('.tt-row').remove()">취소</button></div>
        <div class="tt-file-area"><input type="file" class="tt-file-input" accept="image/*"><span class="tt-status-text" style="${existingImgData ? 'color:#10B981; font-weight:bold;' : 'color:#94A3B8;'}">${existingImgData ? '✅ 이미지 등록됨' : '⚠️ 이미지 선택'}</span></div>
    `;
    container.appendChild(row);
};

window.openEditModal = (shipCode) => {
    shipCode = String(shipCode).trim();
    let ship = typeof baseShipData !== 'undefined' ? baseShipData.find(s => s[1].trim() === shipCode) : null;
    let custom = customAddedShips.find(s => String(s.id).trim() === shipCode);
    let currentData = cloudCustomData[shipCode] || {};

    document.getElementById('edit-vessel-key').value = shipCode;
    document.getElementById('edit-vessel-title').innerText = `✏️ [${shipCode}] 정보 및 시간표 수정`;
    document.getElementById('upload-ship-photo').value = '';
    document.getElementById('upload-status').style.display = 'none';

    if (ship) {
        document.getElementById('edit-raw-name').value = currentData.rawName !== undefined ? currentData.rawName : ship[0];
        document.getElementById('edit-route').value = currentData.route !== undefined ? currentData.route : ship[2];
        document.getElementById('edit-company').value = currentData.company !== undefined ? currentData.company : ship[3];
        document.getElementById('edit-ports').value = currentData.ports !== undefined ? currentData.ports : ship[4];
        document.getElementById('edit-capacity').value = currentData.capacity !== undefined ? currentData.capacity : ship[6];
        document.getElementById('edit-decision').value = currentData.decision !== undefined ? currentData.decision : ship[7];
        document.getElementById('edit-notes').value = currentData.notes !== undefined ? currentData.notes : ship[5];
    } else if (custom) {
        document.getElementById('edit-raw-name').value = custom.rawName || '';
        document.getElementById('edit-route').value = custom.route || '';
        document.getElementById('edit-company').value = custom.company || '';
        document.getElementById('edit-ports').value = custom.ports || '';
        document.getElementById('edit-capacity').value = custom.capacity || '';
        document.getElementById('edit-decision').value = custom.decision || '';
        document.getElementById('edit-notes').value = custom.notes || '';
    }

    document.getElementById('timetables-container').innerHTML = '';
    const customContainer = document.getElementById('custom-fields-container');
    customContainer.innerHTML = '';
    let fields = currentData.customFields || (custom && custom.customFields) || [];
    fields.forEach(f => addCustomFieldRow(f.key, f.val));
    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = () => { document.getElementById('edit-modal').style.display = 'none'; };

window.saveVesselUpdate = async () => {
    const code = document.getElementById('edit-vessel-key').value;
    if (!code) return;

    const btnSave = document.getElementById('btn-save-edit');
    const statusEl = document.getElementById('upload-status');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let current = cloudCustomData[code] || customAddedShips.find(s => s.id === code) || {};
        let imagesMap = current.images || {};
        let timetables = current.timetables || [];

        const photoFile = document.getElementById('upload-ship-photo').files[0];
        if (photoFile) imagesMap.photo = await processImageFile(photoFile);

        const ttRows = document.querySelectorAll('#timetables-container .tt-row');
        for (let row of ttRows) {
            let title = row.querySelector('.tt-row-title').value.trim();
            let file = row.querySelector('.tt-file-input').files[0];
            if (title && file) {
                let imgData = await processImageFile(file, 1400, 0.8);
                timetables.push({ title: title, imgData: imgData });
            }
        }

        let customFields = [];
        document.querySelectorAll('#custom-fields-container .custom-field-row').forEach(r => {
            let k = r.querySelector('.custom-field-key').value.trim();
            let v = r.querySelector('.custom-field-val').value.trim();
            if (k && v) customFields.push({ key: k, val: v });
        });

        await db.collection("vessel_overrides").doc(code).set({
            rawName: document.getElementById('edit-raw-name').value,
            route: document.getElementById('edit-route').value,
            company: document.getElementById('edit-company').value,
            ports: document.getElementById('edit-ports').value,
            capacity: document.getElementById('edit-capacity').value,
            decision: document.getElementById('edit-decision').value,
            notes: document.getElementById('edit-notes').value,
            customFields: customFields,
            timetables: timetables,
            images: imagesMap,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("선박 정보가 저장되었습니다!");
        closeEditModal();
    } catch (err) { alert("저장 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.openAddShipModal = () => {
    document.getElementById('add-code').value = '';
    document.getElementById('add-raw-name').value = '';
    document.getElementById('add-route').value = '';
    document.getElementById('add-company').value = '';
    document.getElementById('add-ports').value = '';
    document.getElementById('add-capacity').value = '';
    document.getElementById('add-decision').value = '';
    document.getElementById('add-notes').value = '';
    document.getElementById('add-ship-photo').value = '';
    document.getElementById('add-upload-status').style.display = 'none';
    document.getElementById('add-modal').style.display = 'flex';
};

window.closeAddModal = () => { document.getElementById('add-modal').style.display = 'none'; };

window.saveNewShip = async () => {
    let code = document.getElementById('add-code').value.trim();
    let rawName = document.getElementById('add-raw-name').value.trim();
    let route = document.getElementById('add-route').value.trim();
    if (!code || !rawName || !route) { alert("필수 항목을 모두 입력해 주세요."); return; }

    const btnSave = document.getElementById('btn-save-add');
    const statusEl = document.getElementById('add-upload-status');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let imagesMap = {};
        const photoFile = document.getElementById('add-ship-photo').files[0];
        if (photoFile) imagesMap.photo = await processImageFile(photoFile);

        await db.collection("vessel_overrides").doc(code).set({
            isNewShip: true, rawName: rawName, route: route,
            company: document.getElementById('add-company').value.trim(),
            ports: document.getElementById('add-ports').value.trim(),
            capacity: document.getElementById('add-capacity').value.trim(),
            decision: document.getElementById('add-decision').value.trim(),
            notes: document.getElementById('add-notes').value.trim(),
            customFields: [], timetables: [], images: imagesMap,
            isHidden: false, isDeleted: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`신규 선박 [${rawName}]이(가) 등록되었습니다.`);
        closeAddModal();
    } catch (err) { alert("등록 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.toggleHideShip = (shipCode, toHide) => {
    if (!confirm(toHide ? "선박을 숨기기 처리하시겠습니까?" : "숨김을 해제하시겠습니까?")) return;
    db.collection("vessel_overrides").doc(shipCode.trim()).set({ isHidden: toHide, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .then(() => alert(toHide ? "숨김 완료" : "노출 완료")).catch(err => alert(err.message));
};

window.deleteShip = (shipCode) => {
    if (!confirm(`정말로 선박 [${shipCode}]을(를) 삭제하시겠습니까?`)) return;
    shipCode = shipCode.trim();
    let isCustom = customAddedShips.some(s => String(s.id).trim() === shipCode);
    if (isCustom) {
        db.collection("vessel_overrides").doc(shipCode).delete().then(() => alert("영구 삭제 완료"));
    } else {
        db.collection("vessel_overrides").doc(shipCode).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).then(() => alert("삭제 완료"));
    }
};

window.openDeployModal = (reserveCode) => {
    reserveCode = String(reserveCode).trim();
    const reserveShip = (typeof baseShipData !== 'undefined' ? baseShipData.find(s => s[1].trim() === reserveCode) : null) || customAddedShips.find(s => String(s.id).trim() === reserveCode);
    if (!reserveShip) return;

    let override = cloudCustomData[reserveCode] || {};
    let rName = (override.rawName || (Array.isArray(reserveShip) ? reserveShip[0] : reserveShip.rawName)).split('(')[0].split('\n')[0].trim();

    document.getElementById('deploy-ship-code').value = reserveCode;
    document.getElementById('deploy-ship-name').innerText = `${rName} (${reserveCode})`;

    const selectEl = document.getElementById('deploy-target-select');
    selectEl.innerHTML = '';

    let regularShips = [];
    if (typeof baseShipData !== 'undefined') {
        baseShipData.forEach(s => {
            let code = s[1].trim();
            let ov = cloudCustomData[code] || {};
            let route = ov.route !== undefined ? ov.route : s[2];
            let name = (ov.rawName !== undefined ? ov.rawName : s[0]).split('(')[0].split('\n')[0].trim();
            if (route.trim() !== '예비선') regularShips.push({ code: code, name: name, route: route, isHidden: !!ov.isHidden });
        });
    }

    customAddedShips.forEach(s => {
        if ((s.route || '').trim() !== '예비선') regularShips.push({ code: String(s.id).trim(), name: s.rawName.split('(')[0].trim(), route: s.route, isHidden: !!s.isHidden });
    });

    regularShips.sort((a, b) => a.route.localeCompare(b.route, 'ko'));
    regularShips.forEach(rs => {
        let opt = document.createElement('option');
        opt.value = rs.code;
        opt.innerText = `[${rs.route}] ${rs.name}${rs.isHidden ? ' (숨김)' : ''}`;
        if (override.deployedTarget && override.deployedTarget.trim() === rs.code) opt.selected = true;
        selectEl.appendChild(opt);
    });

    document.getElementById('btn-deploy-reset').style.display = override.deployedTarget ? 'inline-block' : 'none';
    document.getElementById('deploy-modal').style.display = 'flex';
};

window.closeDeployModal = () => { document.getElementById('deploy-modal').style.display = 'none'; };
window.executeDeploySave = () => { saveDeployStatus(document.getElementById('deploy-target-select').value); };

window.saveDeployStatus = async (targetCode) => {
    let reserveCode = document.getElementById('deploy-ship-code').value;
    if (!reserveCode) return;
    try {
        await db.collection("vessel_overrides").doc(reserveCode.trim()).set({ deployedTarget: targetCode ? targetCode.trim() : null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        closeDeployModal();
        alert(targetCode ? "대체 투입되었습니다." : "대체 투입이 해제되었습니다.");
    } catch (err) { alert(err.message); }
};

window.filterBoard = (mode, btnEl) => {
    boardFilterMode = mode;
    document.querySelectorAll('.board-filter-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderOperationBoard();
};

function loadSavedApiKey() {
    let key = localStorage.getItem("kma_apihub_authkey");
    if (!key || key !== DEFAULT_KMA_AUTHKEY) {
        localStorage.setItem("kma_apihub_authkey", DEFAULT_KMA_AUTHKEY);
    }
}

window.openApiSettingModal = () => {
    let currentKey = localStorage.getItem("kma_apihub_authkey") || DEFAULT_KMA_AUTHKEY;
    document.getElementById('kma-api-key-input').value = currentKey;
    let nmpntKey = localStorage.getItem("nmpnt_service_key") || DEFAULT_NMPNT_KEY;
    document.getElementById('nmpnt-key-input').value = nmpntKey;
    let khoaKey = localStorage.getItem("khoa_api_key") || DEFAULT_KHOA_KEY;
    let khoaInput = document.getElementById('khoa-key-input');
    if (khoaInput) khoaInput.value = khoaKey;
    
    document.getElementById('chk-sea-1').checked = !!activeSeaWarnings['서해남부북쪽안쪽먼바다'];
    document.getElementById('chk-sea-2').checked = !!activeSeaWarnings['서해남부남쪽안쪽먼바다'];
    document.getElementById('chk-sea-3').checked = !!activeSeaWarnings['서해남부앞바다(전남중부)'];
    document.getElementById('chk-sea-4').checked = !!activeSeaWarnings['서해남부앞바다(전남남부)'];
    document.getElementById('chk-sea-5').checked = !!activeSeaWarnings['서해남부앞바다(전남북부)'];
    document.getElementById('chk-sea-6').checked = !!activeSeaWarnings['남해서부서쪽먼바다'];
    document.getElementById('chk-sea-7').checked = !!activeSeaWarnings['제주도북부앞바다'];

    document.getElementById('api-modal').style.display = 'flex';
};

window.closeApiSettingModal = () => { document.getElementById('api-modal').style.display = 'none'; };
window.openRawWarnModal = () => { document.getElementById('raw-warn-text-area').value = latestRawWarnText; document.getElementById('raw-warn-modal').style.display = 'flex'; };
window.closeRawWarnModal = () => { document.getElementById('raw-warn-modal').style.display = 'none'; };

window.toggleManualWarning = (seaName, isChecked) => {
    activeSeaWarnings[seaName] = isChecked ? '풍랑주의보(발효중)' : null;
    renderOperationBoard();
};

window.saveApiKeyModal = () => {
    let key = document.getElementById('kma-api-key-input').value.trim() || DEFAULT_KMA_AUTHKEY;
    let nmpntKey = document.getElementById('nmpnt-key-input').value.trim() || DEFAULT_NMPNT_KEY;
    let khoaInput = document.getElementById('khoa-key-input');
    let khoaKey = khoaInput ? (khoaInput.value.trim() || DEFAULT_KHOA_KEY) : DEFAULT_KHOA_KEY;

    localStorage.setItem("kma_apihub_authkey", key);
    localStorage.setItem("nmpnt_service_key", nmpntKey);
    localStorage.setItem("khoa_api_key", khoaKey);
    alert(`설정 완료! 기상청/측위원/조사원 키가 저장되었습니다.`);
    closeApiSettingModal();
    fetchWeatherRealtime();
};

document.addEventListener("DOMContentLoaded", () => {
    try {
        render();
        renderRefSection();
    } catch (e) {
        console.error("초기 렌더링 예외:", e);
    }
});
