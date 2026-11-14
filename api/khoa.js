// api/khoa.js (국립해양조사원 해양관측부이 풍속 + 유의/최대파고 통합 프록시)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'KG_0025' 
    } = req.query;

    const cleanKey = String(serviceKey).trim();
    const cleanObs = String(obsCode).trim();

    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    // 기상(풍향/풍속) 및 파고(유의/최대) API 병렬 조회
    const meteorUrl = `http://www.khoa.go.kr/api/oceangrid/obsMeteor/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`;
    const waveUrl = `http://www.khoa.go.kr/api/oceangrid/obsWaveHgt/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`;
    const recentUrl = `http://www.khoa.go.kr/api/oceangrid/buoyObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`;

    const fetchJsonSafe = async (url) => {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            });
            const text = await response.text();
            if (text.trim().startsWith('{')) return JSON.parse(text);
        } catch (e) {}
        return null;
    };

    const [meteorRes, waveRes, recentRes] = await Promise.all([
        fetchJsonSafe(meteorUrl),
        fetchJsonSafe(waveUrl),
        fetchJsonSafe(recentUrl)
    ]);

    let merged = {
        wind_speed: null,
        wind_dir: null,
        sig_wave: null,
        max_wave: null,
        record_time: null
    };

    // 1. 최신 통합 부이 API(buoyObsRecent) 우선 반영
    if (recentRes && recentRes.result && recentRes.result.data) {
        const d = Array.isArray(recentRes.result.data) 
            ? recentRes.result.data[recentRes.result.data.length - 1] 
            : recentRes.result.data;
        if (d) {
            if (d.wind_speed !== undefined) merged.wind_speed = d.wind_speed;
            if (d.wind_dir !== undefined) merged.wind_dir = d.wind_dir;
            if (d.wave_height !== undefined) merged.sig_wave = d.wave_height;
            if (d.max_wave_height !== undefined) merged.max_wave = d.max_wave_height;
            if (d.record_time) merged.record_time = d.record_time;
        }
    }

    // 2. 기상(obsMeteor) 최신 레코드 보완
    if (meteorRes && meteorRes.result && Array.isArray(meteorRes.result.data) && meteorRes.result.data.length > 0) {
        const latestM = meteorRes.result.data[meteorRes.result.data.length - 1];
        if (!merged.wind_speed && latestM.wind_speed !== undefined) merged.wind_speed = latestM.wind_speed;
        if (!merged.wind_dir && latestM.wind_dir !== undefined) merged.wind_dir = latestM.wind_dir;
        if (!merged.record_time && latestM.record_time) merged.record_time = latestM.record_time;
    }

    // 3. 파고(obsWaveHgt) 최신 레코드 보완
    if (waveRes && waveRes.result && Array.isArray(waveRes.result.data) && waveRes.result.data.length > 0) {
        const latestW = waveRes.result.data[waveRes.result.data.length - 1];
        if (!merged.sig_wave && latestW.wave_height !== undefined) merged.sig_wave = latestW.wave_height;
        if (!merged.max_wave && latestW.max_wave_height !== undefined) merged.max_wave = latestW.max_wave_height;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({
        result: { data: merged }
    });
}
