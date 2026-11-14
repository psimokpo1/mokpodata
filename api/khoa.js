// api/khoa.js (국립해양조사원 바다누리 정식 경로 및 실측 필드명 반영 완결본)
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

    // 한국 표준시(KST) 당일 날짜 (YYYYMMDD)
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    // 바다누리 공식 게이트웨이 경로 (/oceangrid/grid/api/)
    const meteorUrl = `http://www.khoa.go.kr/oceangrid/grid/api/obsMeteor/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`;
    const waveUrl = `http://www.khoa.go.kr/oceangrid/grid/api/obsWaveHgt/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`;

    const fetchKhoaJson = async (url) => {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                cache: 'no-store'
            });
            const text = await response.text();
            if (text.trim().startsWith('{')) {
                return JSON.parse(text);
            }
        } catch (e) {}
        return null;
    };

    const [meteorRes, waveRes] = await Promise.all([
        fetchKhoaJson(meteorUrl),
        fetchKhoaJson(waveUrl)
    ]);

    let merged = {
        wind_speed: null,
        wind_dir: null,
        sig_wave: null,
        max_wave: null,
        record_time: null
    };

    // 1. 기상 관측자료 (풍향/풍속) 추출
    if (meteorRes && meteorRes.result && Array.isArray(meteorRes.result.data) && meteorRes.result.data.length > 0) {
        const latestM = meteorRes.result.data[meteorRes.result.data.length - 1];
        if (latestM.wind_speed !== undefined) merged.wind_speed = latestM.wind_speed;
        if (latestM.wind_dir !== undefined) merged.wind_dir = latestM.wind_dir;
        if (latestM.record_time) merged.record_time = latestM.record_time;
    }

    // 2. 파고 관측자료 (wave_hgt / wave_height 모두 대응) 추출
    if (waveRes && waveRes.result && Array.isArray(waveRes.result.data) && waveRes.result.data.length > 0) {
        const latestW = waveRes.result.data[waveRes.result.data.length - 1];
        const sigVal = latestW.wave_hgt !== undefined ? latestW.wave_hgt : latestW.wave_height;
        const maxVal = latestW.max_wave_hgt !== undefined ? latestW.max_wave_hgt : latestW.max_wave_height;

        if (sigVal !== undefined) merged.sig_wave = sigVal;
        if (maxVal !== undefined) merged.max_wave = maxVal;
        if (!merged.record_time && latestW.record_time) merged.record_time = latestW.record_time;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({
        result: { data: merged },
        debug_status: {
            hasMeteor: !!(meteorRes && meteorRes.result && meteorRes.result.data),
            hasWave: !!(waveRes && waveRes.result && waveRes.result.data),
            meteorError: meteorRes?.result?.error || null,
            waveError: waveRes?.result?.error || null
        }
    });
}
