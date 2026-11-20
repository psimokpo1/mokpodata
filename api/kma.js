// api/kma.js (기상청 해양기상부이 kma_buoy2 + 파고부이/등표 sea_obs + 정시 과거이력 sea_obs_hist + 목포관내 AWS 16개소 즉시/6시간 분리 + 기상특보 + 날씨누리 특보지도 프록시)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    const nowUtc = Date.now();
    const kstNow = new Date(nowUtc + 9 * 60 * 60 * 1000);
    const kst6hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);

    const formatKst = (d) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        return `${yyyy}${mm}${dd}${hh}${min}`;
    };

    const fetchWithTimeoutServer = async (url, options = {}, timeoutMs = 5000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const tm2 = formatKst(kstNow);
    const tm1_6h = formatKst(kst6hAgo);

    try {
        // 1. 기상청 날씨누리 실시간 특보 발효현황 지도 이미지 프록시
        if (type === 'warn_img') {
            const kmaHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.weather.go.kr/w/weather/warning/status.do',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            };

            const imgCandidates = [
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data.png?_t=${nowUtc}`, `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now.png?_t=${nowUtc}`,
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/KOR_wrn_now.png?_t=${nowUtc}` ];  try { const warnUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
                const warnRes = await fetchWithTimeoutServer(warnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4000);
                if (warnRes.ok) {
                    const wBuf = await warnRes.arrayBuffer();
                    const wText = new TextDecoder('euc-kr').decode(wBuf);
                    let latestFc = '';
                    wText.split('\n').forEach(line => {
                        const l = line.trim();
                        if (!l || l.startsWith('#')) return;
                        const cols = l.split(',').map(c => c.trim());
                        if (cols.length >= 5) {
                            const fcDigits = (cols[4] || '').replace(/\D/g, '');
                            if (fcDigits.length >= 12 && fcDigits > latestFc) {
                                latestFc = fcDigits.substring(0, 12);
                            }
                        }
                    });
                    if (latestFc) {
                        imgCandidates.unshift(
                            `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data_${latestFc}.png`, `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now_${latestFc}.png`
                        );
                    }
                }
            } catch (e) {}

            for (const imgUrl of imgCandidates) {
                try {
                    const imgRes = await fetchWithTimeoutServer(imgUrl, { headers: kmaHeaders }, 4000);
                    const cType = imgRes.headers.get('content-type') || '';
                    if (imgRes.ok && cType.startsWith('image/')) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        if (buf.length > 1000) {
                            res.setHeader('Content-Type', cType);
                            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                            return res.status(200).send(buf);
                        }
                    }
                } catch (e) {}
            }
            return res.status(404).end();
        }

        // 2. 해양기상부이(kma_buoy2) 6시간 + 파고부이/등표(sea_obs) 최신 1건 즉시 조회
        if (type === 'buoy') {
            const buoy2Url = `https://apihub.kma.go.kr/api/typ01/url/kma_buoy2.php?tm1=${tm1_6h}&tm2=${tm2}&stn=0&help=1&authKey=${cleanKey}`; const seaObsUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tm2}&stn=0&help=0&authKey=${cleanKey}`;  const [resBuoy2, resSea] = await Promise.allSettled([ fetchWithTimeoutServer(buoy2Url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000), fetchWithTimeoutServer(seaObsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000) ]);  const decoder = new TextDecoder('euc-kr'); let buoy2Text = ''; let seaText = '';  if (resBuoy2.status === 'fulfilled' && resBuoy2.value.ok) { const buf = await resBuoy2.value.arrayBuffer(); buoy2Text = decoder.decode(buf); } if (resSea.status === 'fulfilled' && resSea.value.ok) { const buf = await resSea.value.arrayBuffer(); seaText = decoder.decode(buf); }  const combined = `===BUOY2_START===\n${buoy2Text}\n===SEAOBS_START===\n${seaText}`; res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(combined); }  // 2-1. 파고부이/등표(sea_obs.php) 과거 6시간 정시(00분) 백그라운드 병렬 수집 if (type === 'sea_obs_hist') { const decoder = new TextDecoder('euc-kr'); const hourlyPromises = [];  for (let hOffset = 0; hOffset <= 6; hOffset++) { const targetKst = new Date(nowUtc + 9 * 60 * 60 * 1000 - hOffset * 60 * 60 * 1000); const yyyy = targetKst.getUTCFullYear(); const mm = String(targetKst.getUTCMonth() + 1).padStart(2, '0'); const dd = String(targetKst.getUTCDate()).padStart(2, '0'); const hh = String(targetKst.getUTCHours()).padStart(2, '0'); const tmHour = `${yyyy}${mm}${dd}${hh}00`;  const url = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tmHour}&stn=0&help=0&authKey=${cleanKey}`; hourlyPromises.push( fetchWithTimeoutServer(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 5000) .then(async (r) => (r.ok ? decoder.decode(await r.arrayBuffer()) : '')) .catch(() => '') ); }  const results = await Promise.all(hourlyPromises); const mergedSeaText = results.filter(Boolean).join('\n');  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(mergedSeaText); }  // 3. AWS(목포관내 16개소 즉시 스냅샷 / 최근 6시간 10분 간격 이력) 및 기상특보 전문 const MOKPO_AWS_STNS = "165,308,743,714,799,303,169,797,798,697,718,716,771,789,707,264"; let targetUrl = ''; if (type === 'aws_now') { targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=${MOKPO_AWS_STNS}&disp=0&help=0&authKey=${cleanKey}`; } else if (type === 'aws') { targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1_6h}&tm2=${tm2}&stn=${MOKPO_AWS_STNS}&itv=10&disp=0&help=0&authKey=${cleanKey}`; } else if (type === 'warn') { targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
        }

        const response = await fetchWithTimeoutServer(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, 8000);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        return res.status(200).send(buffer);
    } catch (err) {
        return res.status(200).send(`FETCH_ERROR: ${err.message}`); } } ```  ---  ### 2. `app.js` (전체 코드)  ```javascript // ========================================== // 1. Firebase 및 전역 변수 초기화 // ========================================== const firebaseConfig = { apiKey: "AIzaSyAYm_2RHvJwlUz1ztRJrc41D7dtD7xbgSM", authDomain: "mokpo-vee-data.firebaseapp.com", projectId: "mokpo-vee-data", storageBucket: "mokpo-vee-data.firebasestorage.app", messagingSenderId: "460234232471", appId: "1:460234232471:web:5d90b727c651fe51accfd2" };  if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); } const auth = firebase.auth(); const db = firebase.firestore();  let cloudCustomData = {}; let customAddedShips = []; let cloudRefItems = {}; let currentViewerContext = null; let boardFilterMode = 'all';  let countdownIntervalId = null; let nextRefreshRemainingSec = 300; let latestRawWarnText = "기상청 특보 통보문을 수신 중입니다..."; let lastNmpntFetchMs = 0;  const DEFAULT_KMA_AUTHKEY = "s0C3VEw6ScOAt1RMOinDFQ"; const DEFAULT_NMPNT_KEY = "A8ECE1B4-0A1E-43E9-A5D4-7D4D906FC401"; const DEFAULT_KHOA_KEY = "47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3";  function degToDirection(deg) { if (isNaN(deg) \vert{}\vert{} deg === null \vert{}\vert{} deg === undefined \vert{}\vert{} deg < 0) return "북서"; if (deg === 0) return "정온/북"; const dirs = ["북", "북북동", "북동", "동북동", "동", "동남동", "남동", "남남동", "남", "남남서", "남서", "서남서", "서", "서북서", "북서", "북북서"]; let idx = Math.round(deg / 22.5) \% 16; return dirs[idx] + "풍"; }  let latestBuoyData = { // [기상청 해양기상부이 / 파고부이 / 등표] '신안':         { stnId: '22183',   type: 'buoy',     name: '신안 부이',           wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '추자도':       { stnId: '22184',   type: 'buoy',     name: '추자도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '칠발도':       { stnId: '22102',   type: 'buoy',     name: '칠발도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '홍도':         { stnId: '22298',   type: 'buoy',     name: '홍도 부이',           wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '가거도':       { stnId: '22297',   type: 'buoy',     name: '가거도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '흑산도':       { stnId: '22193',   type: 'buoy',     name: '흑산도 부이',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '조도파고':     { stnId: '22500',   type: 'wavebuoy', name: '조도 파고부이',       wind: null, windDir: null, sigWave: '-', maxWave: '-' }, '맹골수도파고': { stnId: '22481',   type: 'wavebuoy', name: '맹골수도 파고부이',   wind: null, windDir: null, sigWave: '-', maxWave: '-' }, '진도파고':     { stnId: '22449',   type: 'wavebuoy', name: '진도 파고부이',       wind: null, windDir: null, sigWave: '-', maxWave: '-' }, '해수서파고':   { stnId: '959',     type: 'beacon',   name: '해수서 등표',         wind: '-', windDir: '-', sigWave: '-', maxWave: '-' },  // [기상청 육상 AWS 지점 - 평균풍속 + 순간바람(gust)] '목포AWS':      { stnId: '165',     type: 'aws',      name: '목포 기상대(AWS)',    wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '옥도':         { stnId: '308',     type: 'aws',      name: '옥도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '비금':         { stnId: '743',     type: 'aws',      name: '비금 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '자은도':       { stnId: '714',     type: 'aws',      name: '자은도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '낙월도':       { stnId: '799',     type: 'aws',      name: '낙월도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '가거도AWS':    { stnId: '303',     type: 'aws',      name: '가거도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '흑산도AWS':    { stnId: '169',     type: 'aws',      name: '흑산도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '하태도':       { stnId: '797',     type: 'aws',      name: '하태도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '홍도AWS':      { stnId: '798',     type: 'aws',      name: '홍도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '서거차AWS':    { stnId: '697',     type: 'aws',      name: '서거차 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '상조도':       { stnId: '718',     type: 'aws',      name: '상조도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '하의도':       { stnId: '716',     type: 'aws',      name: '하의도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '안좌AWS':      { stnId: '771',     type: 'aws',      name: '안좌 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '압해도':       { stnId: '789',     type: 'aws',      name: '압해도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '지도':         { stnId: '707',     type: 'aws',      name: '지도 AWS',            wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null }, '안마도':       { stnId: '264',     type: 'aws',      name: '안마도 AWS',          wind: '-', gust: '-', windDir: '-', sigWave: null, maxWave: null },  // [측위정보원 등대/터미널] '안좌':         { stnId: '1079001', type: 'nmpnt',    name: '안좌터미널(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null }, '외달도':       { stnId: '1079008', type: 'nmpnt',    name: '외달도등표(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null }, '가거도등대':   { stnId: '1079003', type: 'nmpnt',    name: '가거도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null }, '홍도등대':     { stnId: '1079002', type: 'nmpnt',    name: '홍도등대(측위)',       wind: '-', windDir: '-', sigWave: null, maxWave: null }, '하조도':       { stnId: '1079005', type: 'nmpnt',    name: '하조도등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null }, '계마항':       { stnId: '1079007', type: 'nmpnt',    name: '계마항등대(측위)',     wind: '-', windDir: '-', sigWave: null, maxWave: null },  // [국립해양조사원 해양관측부이 / 과학기지 / 조위관측소] '추자조사원':   { obsCode: 'KG_0025', type: 'khoa',   name: '추자부이(조사원)',     wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '가거초조사원': { obsCode: 'IE_0061', type: 'khoa',   name: '가거초기지(조사원)',   wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '향화도조위':   { obsCode: 'DT_0065', type: 'khoa',   name: '향화도조위(조사원)',   wind: '-', windDir: '-', sigWave: null, maxWave: null }, '서거차조위':   { obsCode: 'DT_0094', type: 'khoa',   name: '서거차도조위(조사원)', wind: '-', windDir: '-', sigWave: null, maxWave: null }, '우이도조사원': { obsCode: 'TW_0080', type: 'khoa',   name: '우이도관측소(조사원)', wind: '-', windDir: '-', sigWave: '-', maxWave: '-' }, '진도조위':     { obsCode: 'DT_0028', type: 'khoa',   name: '진도조위(조사원)',     wind: '-', windDir: '-', sigWave: null, maxWave: null } };  // ========================================== // 1-1. 관측소 과거 이력 스마트 병합(Smart Merge) & 캐시 방어 엔진 // ========================================== const HISTORY_CACHE_KEY = 'komsa_station_history_v2'; let stationHistoryMap = {};  function parseSortKeyToUtcMs(sortKey) { if (!sortKey) return NaN; const digits = String(sortKey).replace(/\D/g, ''); if (digits.length < 12) return NaN; const y = parseInt(digits.substring(0, 4), 10); const m = parseInt(digits.substring(4, 6), 10) - 1; const d = parseInt(digits.substring(6, 8), 10); const h = parseInt(digits.substring(8, 10), 10); const min = parseInt(digits.substring(10, 12), 10); return Date.UTC(y, m, d, h - 9, min, 0); }  function isWithinLast6Hours(sortKey) { const itemUtcMs = parseSortKeyToUtcMs(sortKey); if (isNaN(itemUtcMs)) return false; const diffMs = Date.now() - itemUtcMs; return diffMs >= -15 * 60 * 1000 && diffMs <= (6 * 60 + 30) * 60 * 1000; }  function isValidMetric(val) { return val !== undefined && val !== null && val !== '-' && val !== '' && !isNaN(parseFloat(val)); }  function upsertStationHistory(stKey, entry) { if (!stKey \vert{}\vert{} !entry \vert{}\vert{} !entry.sortKey) return; const digits = String(entry.sortKey).replace(/\D/g, ''); if (digits.length < 12) return;  const normSortKey = digits.substring(0, 12); const normTime = entry.time && entry.time !== '최신' ? entry.time : `${normSortKey.substring(8, 10)}:${normSortKey.substring(10, 12)}`;  if (!isWithinLast6Hours(normSortKey)) return;  const hasAnyValid = isValidMetric(entry.wind) \vert{}\vert{} isValidMetric(entry.gust) \vert{}\vert{} isValidMetric(entry.sigWave) \vert{}\vert{} isValidMetric(entry.maxWave); if (!hasAnyValid) return;  if (!Array.isArray(stationHistoryMap[stKey])) stationHistoryMap[stKey] = []; const list = stationHistoryMap[stKey]; const idx = list.findIndex(h => String(h.sortKey).substring(0, 12) === normSortKey);  if (idx >= 0) { const prev = list[idx]; list[idx] = { sortKey: normSortKey, time: normTime, wind: isValidMetric(entry.wind) ? entry.wind : (prev.wind ?? '-'), gust: isValidMetric(entry.gust) ? entry.gust : (prev.gust ?? '-'), windDir: (entry.windDir && entry.windDir !== '-') ? entry.windDir : (prev.windDir ?? '-'), sigWave: isValidMetric(entry.sigWave) ? entry.sigWave : (prev.sigWave ?? null), maxWave: isValidMetric(entry.maxWave) ? entry.maxWave : (prev.maxWave ?? null) }; } else { list.push({ sortKey: normSortKey, time: normTime, wind: isValidMetric(entry.wind) ? entry.wind : '-', gust: isValidMetric(entry.gust) ? entry.gust : '-', windDir: (entry.windDir && entry.windDir !== '-') ? entry.windDir : '-', sigWave: isValidMetric(entry.sigWave) ? entry.sigWave : null, maxWave: isValidMetric(entry.maxWave) ? entry.maxWave : null }); } }  function loadStationHistoryCache() { try { const saved = localStorage.getItem(HISTORY_CACHE_KEY) \vert{}\vert{} localStorage.getItem('komsa_station_history_v1'); if (saved) { const parsed = JSON.parse(saved); for (let k in parsed) { if (Array.isArray(parsed[k])) { const validRows = parsed[k] .filter(h => !h.isInterpolated && isWithinLast6Hours(h.sortKey)) .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey))); stationHistoryMap[k] = validRows;  if (validRows.length > 0 && latestBuoyData[k]) { const last = validRows[validRows.length - 1]; if (latestBuoyData[k].wind !== null && isValidMetric(last.wind)) { latestBuoyData[k].wind = parseFloat(last.wind).toFixed(1); if (last.windDir && last.windDir !== '-') latestBuoyData[k].windDir = last.windDir; } if (latestBuoyData[k].type === 'aws' && isValidMetric(last.gust)) { latestBuoyData[k].gust = parseFloat(last.gust).toFixed(1); } if (latestBuoyData[k].sigWave !== null && isValidMetric(last.sigWave)) { latestBuoyData[k].sigWave = parseFloat(last.sigWave).toFixed(1); } if (latestBuoyData[k].maxWave !== null && isValidMetric(last.maxWave)) { latestBuoyData[k].maxWave = parseFloat(last.maxWave).toFixed(1); } } } } } } catch (e) { stationHistoryMap = {}; } } loadStationHistoryCache();  function saveStationHistoryCache() { try { for (let k in stationHistoryMap) { if (Array.isArray(stationHistoryMap[k])) { const dedupMap = {}; stationHistoryMap[k].forEach(item => { if (item.isInterpolated \vert{}\vert{} !isWithinLast6Hours(item.sortKey)) return; const sk = String(item.sortKey).substring(0, 12); dedupMap[sk] = { ...item, sortKey: sk }; }); stationHistoryMap[k] = Object.values(dedupMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey)); } } localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(stationHistoryMap)); } catch (e) {} }  // 실제 수신된 관측 이력만 시간순 반환 (가짜 유지 보정 제거) function buildContinuousHistoryForModal(stKey) { return (stationHistoryMap[stKey] \vert{}\vert{} []) .filter(h => isWithinLast6Hours(h.sortKey)) .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey))); }  let activeSeaWarnings = { '서해남부북쪽안쪽먼바다': null, '서해남부남쪽안쪽먼바다': null, '서해남부앞바다(전남중부)': null, '서해남부앞바다(전남남부)': null, '서해남부앞바다(전남북부)': null, '남해서부서쪽먼바다': null, '제주도북부앞바다': null };  let seaWarningTimestamps = {};  const defaultRefItems = { 'default_ref_1': { id: 'default_ref_1', title: '🗺️ 기상특보 해역지도', fallbackNames: ['기상특보 해역지도', '0. 목포관내 해역 특보구역'], order: 1 }, 'default_ref_2': { id: 'default_ref_2', title: '🌊 평수구역 기준선', fallbackNames: ['평수구역 기준선'], order: 2 } };  // ========================================== // 2. 인증 및 실시간 동기화 // ========================================== auth.onAuthStateChanged(user => { const overlay = document.getElementById("login-overlay"); const userBar = document.getElementById("user-bar"); if (user) { if (overlay) overlay.style.display = "none"; if (userBar) userBar.style.display = "flex"; let displayId = user.email ? user.email.split('@')[0] : '사용자'; const userTextEl = document.getElementById("user-id-text"); if (userTextEl) userTextEl.innerText = `👤 ${displayId}`;
        
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

    let email = rawId.includes('@') ? rawId : `${rawId}@komsa.or.kr`;  auth.signInWithEmailAndPassword(email, pw).catch(err => { if (errEl) { errEl.style.display = "block"; if (err.code === 'auth/user-not-found' \vert{}\vert{} err.code === 'auth/invalid-credential') { errEl.innerText = `[${email}] 아이디 또는 비밀번호를 확인해 주세요.`;
            } else if (err.code === 'auth/wrong-password') {
                errEl.innerText = "비밀번호가 올바르지 않습니다.";
            } else {
                errEl.innerText = `로그인 실패 (${err.code}):${err.message}`;
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
// 3. 선박 통제기준 및 항로·기항지별 맞춤 관측소 매핑 파서
// ==========================================
function parseVesselControlCriteria(rawName, decision, route, notes, ports = '') {
    let fullText = ((rawName || '') + " " + (decision || '') + " " + (notes || '') + " " + (ports || '')).replace(/\s/g, '');
    let r = (route || '').replace(/\s/g, '');
    let p = (ports || '').replace(/\s/g, '');
    
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
    if (windMatch) {
        let parsedW = parseFloat(windMatch[1]);
        if (parsedW >= 5.0) windLimit = parsedW;
    }

    let sigWaveLimit = null;
    let maxWaveLimit = null;

    let sigMatch = fullText.match(/유의파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (sigMatch && parseFloat(sigMatch[1]) >= 1.0) sigWaveLimit = parseFloat(sigMatch[1]);

    let maxMatch = fullText.match(/최대파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (maxMatch && parseFloat(maxMatch[1]) >= 1.0) maxWaveLimit = parseFloat(maxMatch[1]);

    if (!sigMatch && !maxMatch) {
        let genMatch = fullText.match(/파고[:\s]*(\d+(?:\.\d+)?)\s*m(?!\/s)/i);
        if (genMatch && parseFloat(genMatch[1]) >= 1.0) sigWaveLimit = parseFloat(genMatch[1]);
    }

    let stations = [];
    const addSt = (key) => { if (latestBuoyData[key] && !stations.includes(key)) stations.push(key); };

    if (r.startsWith("목포-") || p.includes("목포")) {
        addSt('목포AWS');
    }

    if (r.includes("진도") || p.includes("진도")) {
        addSt('진도조위');
        addSt('진도파고');
    }

    if (r.includes("향화-낙월") || r.includes("낙월") || p.includes("낙월")) {
        addSt('향화도조위');
        addSt('낙월도');
    } else if (r.includes("향화") || p.includes("향화")) {
        addSt('향화도조위');
    }

    if (r.includes("계마-안마") || r.includes("안마") || p.includes("안마")) {
        addSt('계마항');
        addSt('안마도');
    } else if (r.includes("계마") || p.includes("계마")) {
        addSt('계마항');
    }

    if (r.includes("증도-자은") || r.includes("자은")) {
        addSt('자은도');
    }

    if (r.includes("송도-병풍")) {
        addSt('지도');
    }

    if (r.includes("송공") || p.includes("송공")) {
        addSt('압해도');
    }

    if (r.includes("가산") || p.includes("가산")) {
        addSt('비금');
    }

    if (p.includes("복호") || fullText.includes("복호")) {
        addSt('안좌');
        addSt('안좌AWS');
    } else if (fullText.includes("안좌")) {
        addSt('안좌');
    }

    if (r.includes("상태서리") || r.includes("웅곡") || r.includes("하의") || p.includes("웅곡") || p.includes("당두") || p.includes("상태서리")) {
        addSt('하의도');
    }

    if (r.includes("도초-우이") || p.includes("우이")) {
        addSt('우이도조사원');
    }

    if (r.includes("외달") || p.includes("외달")) {
        addSt('외달도');
    }

    const isGageodoVessel = r.includes("가거도") || p.includes("가거도") || fullText.includes("핑크돌핀") || fullText.includes("뉴퀸");
    if (isGageodoVessel) {
        addSt('가거도');
        addSt('가거도등대');
        addSt('가거초조사원');
        addSt('가거도AWS');
        addSt('하태도');
    }

    if (r.includes("홍도") || p.includes("홍도")) {
        addSt('홍도');
        addSt('홍도등대');
        addSt('홍도AWS');
    }

    if (r.includes("흑산") || p.includes("흑산")) {
        addSt('흑산도');
        addSt('흑산도AWS');
    }

    if (r.includes("율목") || r.includes("서거차") || r.includes("죽도") || p.includes("율목") || p.includes("서거차")) {
        addSt('조도파고');
        addSt('맹골수도파고');
        addSt('진도파고');
        addSt('해수서파고');
        addSt('하조도');
        addSt('서거차조위');
        addSt('서거차AWS');
        addSt('상조도');
    } else if (r.includes("쉬미-가사") || p.includes("창유") || p.includes("조도")) {
        addSt('조도파고');
        addSt('진도파고');
        addSt('하조도');
    }

    if (fullText.includes("옥도")) addSt('옥도');
    if (fullText.includes("신안")) addSt('신안');
    if (fullText.includes("칠발도") || r.includes("홍도") || r.includes("흑산")) addSt('칠발도');
    if (fullText.includes("추자도") || r.includes("제주")) {
        addSt('추자도');
        addSt('추자조사원');
    }

    if (stations.length === 0) {
        if (fullText.includes("평수") || r.includes("남강") || r.includes("도초") || r.includes("상태")) {
            addSt('신안');
            addSt('옥도');
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
            relatedSeas.push(isGageodoVessel ? "서해남부남쪽안쪽먼바다" : "서해남부북쪽안쪽먼바다", "서해남부앞바다(전남중부)");
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
// 4. 상황판 및 최근 6시간 과거 이력 타임테이블 모달 (AWS 순간바람 포함, 실측 데이터만 표출)
// ==========================================
window.toggleMeteoDetailRow = function(shipCode) {
    const detailRow = document.getElementById(`meteo-detail-${shipCode}`); if (!detailRow) return; const isShowing = detailRow.style.display !== 'none'; detailRow.style.display = isShowing ? 'none' : 'table-row'; const icon = document.getElementById(`meteo-toggle-icon-${shipCode}`);
    if (icon) icon.innerText = isShowing ? '▼' : '▲';
};

window.openWeatherHistoryModal = function(stKey) {
    const stData = latestBuoyData[stKey];
    const stName = stData ? (stData.name || stKey) : stKey;
    const historyArr = buildContinuousHistoryForModal(stKey);

    let modalEl = document.getElementById('weather-history-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'weather-history-modal';
        modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        document.body.appendChild(modalEl);
    }

    let isAws = (stData && stData.type === 'aws');
    let isWaveBuoy = (stData && stData.type === 'wavebuoy');
    let isWindOnly = (stData && (stData.type === 'nmpnt' || (stData.sigWave === null && !isAws)));

    let colSpanCount = isAws ? 5 : (isWindOnly ? 4 : (isWaveBuoy ? 4 : 6));

    let rowsHtml = '';
    if (historyArr.length === 0) {
        rowsHtml = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding:24px; color:#94A3B8;">최근 6시간 이내 수집된 관측 이력이 없습니다.</td></tr>`;
    } else {
        let sortedList = [...historyArr].sort((a, b) => (b.sortKey || b.time || '').localeCompare(a.sortKey || a.time || ''));
        sortedList.forEach(h => {
            let tStr = h.time || '-';
            let wDir = h.windDir || '-';
            let wSpd = (!isNaN(parseFloat(h.wind)) && h.wind !== '-') ? parseFloat(h.wind).toFixed(1) : '-';
            let gSpd = (!isNaN(parseFloat(h.gust)) && h.gust !== '-') ? parseFloat(h.gust).toFixed(1) : '-';
            let sigW = (!isNaN(parseFloat(h.sigWave)) && h.sigWave !== '-') ? parseFloat(h.sigWave).toFixed(1) : '-';
            let maxW = (!isNaN(parseFloat(h.maxWave)) && h.maxWave !== '-') ? parseFloat(h.maxWave).toFixed(1) : '-';

            if (isAws) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold; color:#D97706;">${gSpd}</td>
                    </tr>
                `;
            } else if (isWindOnly) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                    </tr>
                `;
            } else if (isWaveBuoy) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${sigW}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${maxW}</td>
                    </tr>
                `;
            } else {
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

    let headerCols = '';
    if (isAws) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">평균풍속(m/s)</th><th style="padding:10px; background:#FEF3C7; color:#92400E; border-bottom:2px solid #CBD5E1;">순간바람(m/s)</th>`;
    } else if (isWindOnly) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th>`;
    } else if (isWaveBuoy) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;
    } else {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;
    }

    modalEl.innerHTML = `
        <div style="background:#fff; width:680px; max-width:95vw; max-height:85vh; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.25); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:15px 20px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:15.5px;">📈 [${stName}] 최근 6시간 기상 관측 이력 (${historyArr.length}건)</h3>
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
        else if (stData.type === 'wavebuoy') agencyBadge = '<span style="background:#DBEAFE; color:#1E40AF; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">파고부이</span>';
        else if (stData.type === 'aws') agencyBadge = '<span style="background:#CCFBF1; color:#0F766E; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 AWS</span>';
        else if (stData.type === 'beacon') agencyBadge = '<span style="background:#EDE9FE; color:#6D28D9; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 등표</span>';
        else if (stData.type === 'nmpnt') agencyBadge = '<span style="background:#EFF6FF; color:#1D4ED8; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">측위정보원</span>';
        else if (stData.type === 'khoa') agencyBadge = '<span style="background:#ECFDF5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">해양조사원</span>';

        const windVal = parseFloat(stData.wind);
        const gustVal = parseFloat(stData.gust);
        const hasWind = (stData.wind !== null && stData.wind !== '-' && !isNaN(windVal));
        const hasGust = (stData.type === 'aws' && stData.gust !== null && stData.gust !== '-' && !isNaN(gustVal));

        let windStyle = '';
        if (hasWind) {
            if (windVal >= wLimit) windStyle = 'color:#DC2626; font-weight:bold; background:#FEE2E2;';
            else if (windVal >= wLimit * 0.85) windStyle = 'color:#D97706; font-weight:bold; background:#FEF3C7;';
        }

        const sigVal = parseFloat(stData.sigWave);
        const maxVal = parseFloat(stData.maxWave);
        let waveStr = '-';
        if (stData.sigWave === null) waveStr = '<span style="color:#94A3B8;">풍속 전용</span>';
        else if (!isNaN(sigVal) && !isNaN(maxVal)) waveStr = `유의 ${sigVal.toFixed(1)}m / 최대 ${maxVal.toFixed(1)}m`; else if (!isNaN(sigVal)) waveStr = `유의 ${sigVal.toFixed(1)}m`;

        let windDisplay = '<span style="color:#94A3B8;">수신대기</span>';
        if (stData.type === 'wavebuoy') {
            windDisplay = '<span style="color:#94A3B8;">파고 전용</span>';
        } else if (hasWind) {
            windDisplay = `${windVal.toFixed(1)} m/s (${stData.windDir || '-'})`;
            if (hasGust) windDisplay += ` <span style="color:#D97706; font-weight:bold;">[순간 ${gustVal.toFixed(1)}m/s]</span>`;
        }

        rowsHtml += `
