// api/khoa.js (국립해양조사원 해양관측부이 기상+파고 정식 엔드포인트 자동 연결)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'KG_0025' 
    } = req.query;

    const cleanKey = String(serviceKey).trim();
    const cleanObs = String(obsCode).trim();
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    // 바다누리 공식 API 후보 엔드포인트 (/api/oceangrid/ 경로)
    const urls = [
        `http://www.khoa.go.kr/api/oceangrid/tidalBuoy/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`,
        `http://www.khoa.go.kr/api/oceangrid/obsWave/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`,
        `http://www.khoa.go.kr/api/oceangrid/obsMeteor/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`,
        `http://www.khoa.go.kr/api/oceangrid/buoyObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`
    ];

    const fetchJson = async (url) => {
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

    const results = await Promise.all(urls.map(u => fetchJson(u)));

    let merged = {
        wind_speed: null,
        wind_dir: null,
        sig_wave: null,
        max_wave: null,
        record_time: null
    };

    results.forEach(json => {
        if (!json || !json.result || !json.result.data) return;
        const dList = Array.isArray(json.result.data) ? json.result.data : [json.result.data];
        if (dList.length === 0) return;

        // 가장 최신 레코드(배열의 마지막 요소) 추출
        const latest = dList[dList.length - 1];
        if (!latest) return;

        if (latest.wind_speed !== undefined && latest.wind_speed !== null && latest.wind_speed !== '') {
            merged.wind_speed = latest.wind_speed;
        }
        if (latest.wind_dir !== undefined && latest.wind_dir !== null && latest.wind_dir !== '') {
            merged.wind_dir = latest.wind_dir;
        }
        const sigVal = latest.wave_hgt ?? latest.wave_height ?? latest.sig_wave_hgt;
        if (sigVal !== undefined && sigVal !== null && sigVal !== '') {
            merged.sig_wave = sigVal;
        }
        const maxVal = latest.max_wave_hgt ?? latest.max_wave_height;
        if (maxVal !== undefined && maxVal !== null && maxVal !== '') {
            merged.max_wave = maxVal;
        }
        if (latest.record_time) {
            merged.record_time = latest.record_time;
        }
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json({
        result: { data: merged },
        rawResponses: results.filter(Boolean).map(r => r.result?.error || 'OK')
    });
}
