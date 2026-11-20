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
let latestRawWarnText = "";
let latestWarnTmFc = "";
let latestWarnTmEf = "";
let lastNmpntFetchMs = 0;

const DEFAULT_KMA_AUTHKEY = "s0C3VEw6ScOAt1RMOinDFQ";
const DEFAULT_NMPNT_KEY = "A8ECE1B4-0A1E-43E9-A5D4-7D4D906FC401";
const DEFAULT_KHOA_KEY = "47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3";

function degToDirection(deg) {
    if (isNaN(deg) || deg === null || deg === undefined || deg < 0) return "북서";
    if (deg === 0) return "정온/북";
    const dirs = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"];
    let idx = Math.round(deg / 22.5) % 16;
    return dirs[idx] + "풍";
}

let latestBuoyData = {
    '신안':         { stnId: '22183',   type: 'buoy',     name: '신안 부이',           wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '추자도':       { stnId: '22184',   type: 'buoy',     name: '추자도 부이',         wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '칠발도':       { stnId: '22102',   type: 'buoy',     name: '칠발도 부이',         wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '홍도':         { stnId: '22298',   type: 'buoy',     name: '홍도 부이',           wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '가거도':       { stnId: '22297',   type: 'buoy',     name: '가거도 부이',         wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '흑산도':       { stnId: '22193',   type: 'buoy',     name: '흑산도 부이',         wind: '-', gust: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '조도파고':     { stnId: '22500',   type: 'wavebuoy', name: '조도 파고부이',       wind: null, windDir: null, sigWave: '-', maxWave: '-' },
    '맹골수도파고': { stnId: '22481',   type: 'wavebuoy', name: '맹골수도 파고부이',   wind: null, windDir: null, sigWave: '-', maxWave: '-' },
    '진도파고':     { stnId: '22449',   type: 'wavebuoy', name: '진도 파고부이',       wind: null, windDir: null, sigWave: '-', maxWave: '-' },
    '제주항파고':   { stnId: '22453',   type: 'wavebuoy', name: '제주항 파고부이',     wind: null, windDir: null, sigWave: '-', maxWave: '-' },
    '해수서파고':   { stnId: '959',     type: 'beacon',   name: '해수서 등표',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },

    '목포AWS':      { stnId: '165',     type: 'aws',      name: '목포 기상대(AWS)',    wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '옥도':         { stnId: '308',     type: 'aws',      name: '옥도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '비금':         { stnId: '743',     type: 'aws',      name: '비금 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '자은도':       { stnId: '714',     type: 'aws',      name: '자은도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '낙월도':       { stnId: '799',     type: 'aws',      name: '낙월도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '가거도AWS':    { stnId: '303',     type: 'aws',      name: '가거도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '흑산도AWS':    { stnId: '169',     type: 'aws',      name: '흑산도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '하태도':       { stnId: '797',     type: 'aws',      name: '하태도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '홍도AWS':      { stnId: '798',     type: 'aws',      name: '홍도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '서거차AWS':    { stnId: '697',     type: 'aws',      name: '서거차 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '상조도':       { stnId: '718',     type: 'aws',      name: '상조도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '하의도':       { stnId: '716',     type: 'aws',      name: '하의도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '안좌AWS':      { stnId: '771',     type: 'aws',      name: '안좌 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '압해도':       { stnId: '789',     type: 'aws',      name: '압해도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '지도':         { stnId: '707',     type: 'aws',      name: '지도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },
    '안마도':       { stnId: '264',     type: 'aws',      name: '안마도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },

    '안좌':         { stnId: '1079001', type: 'nmpnt',    name: '안좌터미널(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '외달도':       { stnId: '1079008', type: 'nmpnt',    name: '외달도등표(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '가거도등대':   { stnId: '1079003', type: 'nmpnt',    name: '가거도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '홍도등대':     { stnId: '1079002', type: 'nmpnt',    name: '홍도등대(측위)',       wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '하조도':       { stnId: '1079005', type: 'nmpnt',    name: '하조도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '계마항':       { stnId: '1079007', type: 'nmpnt',    name: '계마항등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },

    '추자조사원':   { obsCode: 'KG_0025', type: 'khoa',   name: '추자부이(조사원)',     wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '가거초조사원': { obsCode: 'IE_0061', type: 'khoa',   name: '가거초기지(조사원)',   wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '향화도조위':   { obsCode: 'DT_0065', type: 'khoa',   name: '향화도조위(조사원)',   wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '서거차조위':   { obsCode: 'DT_0094', type: 'khoa',   name: '서거차도조위(조사원)', wind: '-', windDir: '-', sigWave: null, maxWave: null },
    '우이도조사원': { obsCode: 'TW_0080', type: 'khoa',   name: '우이도관측소(조사원)', wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },
    '진도조위':     { obsCode: 'DT_0028', type: 'khoa',   name: '진도조위(조사원)',     wind: '-', windDir: '-', sigWave: null, maxWave: null }
};

// ==========================================
// 1-1. 관측소 과거 이력 스마트 병합 & 캐시 방어 엔진
// ==========================================
const HISTORY_CACHE_KEY = 'komsa_station_history_v2';
let stationHistoryMap = {};

function parseSortKeyToUtcMs(sortKey) {
    if (!sortKey) return NaN;
    const digits = String(sortKey).replace(/\D/g, '');
    if (digits.length < 12) return NaN;
    const y = parseInt(digits.substring(0, 4), 10);
    const m = parseInt(digits.substring(4, 6), 10) - 1;
    const d = parseInt(digits.substring(6, 8), 10);
    const h = parseInt(digits.substring(8, 10), 10);
    const min = parseInt(digits.substring(10, 12), 10);
    return Date.UTC(y, m, d, h - 9, min, 0);
}

function isWithinLast6Hours(sortKey) {
    const itemUtcMs = parseSortKeyToUtcMs(sortKey);
    if (isNaN(itemUtcMs)) return false;
    const diffMs = Date.now() - itemUtcMs;
    return diffMs >= -15 * 60 * 1000 && diffMs <= (6 * 60 + 30) * 60 * 1000;
}

function isWithinLast1Hour(sortKey) {
    const itemUtcMs = parseSortKeyToUtcMs(sortKey);
    if (isNaN(itemUtcMs)) return false;
    const diffMs = Date.now() - itemUtcMs;
    return diffMs >= -15 * 60 * 1000 && diffMs <= 65 * 60 * 1000;
}

function isValidMetric(val) {
    return val !== undefined && val !== null && val !== '-' && val !== '' && !isNaN(parseFloat(val));
}

function upsertStationHistory(stKey, entry) {
    if (!stKey || !entry || !entry.sortKey) return;
    const digits = String(entry.sortKey).replace(/\D/g, '');
    if (digits.length < 12) return;

    const normSortKey = digits.substring(0, 12);
    const normTime = entry.time && entry.time !== '최신'
        ? entry.time
        : `${normSortKey.substring(8, 10)}:${normSortKey.substring(10, 12)}`;

    if (!isWithinLast6Hours(normSortKey)) return;

    const hasAnyValid = isValidMetric(entry.wind) || isValidMetric(entry.gust) || isValidMetric(entry.sigWave) || isValidMetric(entry.maxWave);
    if (!hasAnyValid) return;

    if (!Array.isArray(stationHistoryMap[stKey])) stationHistoryMap[stKey] = [];
    const list = stationHistoryMap[stKey];
    const idx = list.findIndex(h => String(h.sortKey).substring(0, 12) === normSortKey);

    if (idx >= 0) {
        const prev = list[idx];
        list[idx] = {
            sortKey: normSortKey,
            time: normTime,
            wind: isValidMetric(entry.wind) ? entry.wind : (prev.wind ?? '-'),
            gust: isValidMetric(entry.gust) ? entry.gust : (prev.gust ?? '-'),
            windDir: (entry.windDir && entry.windDir !== '-') ? entry.windDir : (prev.windDir ?? '-'),
            sigWave: isValidMetric(entry.sigWave) ? entry.sigWave : (prev.sigWave ?? null),
            maxWave: isValidMetric(entry.maxWave) ? entry.maxWave : (prev.maxWave ?? null)
        };
    } else {
        list.push({
            sortKey: normSortKey,
            time: normTime,
            wind: isValidMetric(entry.wind) ? entry.wind : '-',
            gust: isValidMetric(entry.gust) ? entry.gust : '-',
            windDir: (entry.windDir && entry.windDir !== '-') ? entry.windDir : '-',
            sigWave: isValidMetric(entry.sigWave) ? entry.sigWave : null,
            maxWave: isValidMetric(entry.maxWave) ? entry.maxWave : null
        });
    }
}

function loadStationHistoryCache() {
    try {
        const saved = localStorage.getItem(HISTORY_CACHE_KEY) || localStorage.getItem('komsa_station_history_v1');
        if (saved) {
            const parsed = JSON.parse(saved);
            for (let k in parsed) {
                if (Array.isArray(parsed[k])) {
                    const validRows = parsed[k]
                        .filter(h => !h.isInterpolated && isWithinLast6Hours(h.sortKey))
                        .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
                    stationHistoryMap[k] = validRows;

                    if (validRows.length > 0 && latestBuoyData[k]) {
                        const last = validRows[validRows.length - 1];
                        if (latestBuoyData[k].wind !== null && isValidMetric(last.wind)) {
                            latestBuoyData[k].wind = parseFloat(last.wind).toFixed(1);
                            if (last.windDir && last.windDir !== '-') latestBuoyData[k].windDir = last.windDir;
                        }
                        if ((latestBuoyData[k].type === 'aws' || latestBuoyData[k].type === 'buoy') && isValidMetric(last.gust)) {
                            latestBuoyData[k].gust = parseFloat(last.gust).toFixed(1);
                        }
                        if (latestBuoyData[k].sigWave !== null && isValidMetric(last.sigWave)) {
                            latestBuoyData[k].sigWave = parseFloat(last.sigWave).toFixed(1);
                        }
                        if (latestBuoyData[k].maxWave !== null && isValidMetric(last.maxWave)) {
                            latestBuoyData[k].maxWave = parseFloat(last.maxWave).toFixed(1);
                        }
                    }
                }
            }
        }
    } catch (e) {
        stationHistoryMap = {};
    }
}
loadStationHistoryCache();

function saveStationHistoryCache() {
    try {
        for (let k in stationHistoryMap) {
            if (Array.isArray(stationHistoryMap[k])) {
                const dedupMap = {};
                stationHistoryMap[k].forEach(item => {
                    if (item.isInterpolated || !isWithinLast6Hours(item.sortKey)) return;
                    const sk = String(item.sortKey).substring(0, 12);
                    dedupMap[sk] = { ...item, sortKey: sk };
                });
                stationHistoryMap[k] = Object.values(dedupMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
            }
        }
        localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(stationHistoryMap));
    } catch (e) {}
}

function buildContinuousHistoryForModal(stKey) {
    const stData = latestBuoyData[stKey];
    const isAws = stData && stData.type === 'aws';
    return (stationHistoryMap[stKey] || [])
        .filter(h => (isAws ? isWithinLast1Hour(h.sortKey) : isWithinLast6Hours(h.sortKey)))
        .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

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