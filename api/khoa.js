// api/khoa.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'DT_0016' 
    } = req.query;

    const cleanKey = String(serviceKey).trim();
    const cleanObs = String(obsCode).trim();

    // 한국 표준시(KST) 오늘 날짜 (YYYYMMDD) 계산
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    const urls = [
        `http://www.khoa.go.kr/api/oceangrid/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`,
        `http://www.khoa.go.kr/api/oceangrid/tideObs/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&Date=${todayStr}&ResultType=json`
    ];

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            });
            const text = await response.text();
            if (text.trim().startsWith('{')) {
                const json = JSON.parse(text);
                // tideObs(배열) 응답일 경우 가장 마지막 최신 레코드를 data 객체로 정규화
                if (json.result && Array.isArray(json.result.data) && json.result.data.length > 0) {
                    const latest = json.result.data[json.result.data.length - 1];
                    return res.status(200).json({ result: { data: latest } });
                }
                if (json.result && json.result.data && !Array.isArray(json.result.data)) {
                    return res.status(200).json(json);
                }
            }
        } catch (e) {}
    }

    return res.status(200).json({ result: { data: null }, error: "KHOA_NO_DATA" });
}
