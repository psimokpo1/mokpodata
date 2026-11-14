// api/khoa.js (공공데이터포털 국립해양조사원 GetTWRecentApiService 정식 규격 완결본)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'TW_0089' 
    } = req.query;

    const cleanKey = String(serviceKey).trim();
    const cleanObs = String(obsCode).trim();

    // 한국 표준시(KST) 당일 날짜 (YYYYMMDD)
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    // DT_ 로 시작하면 조위관측소 바람(GetSurveyWindApiService), 그 외는 해양관측부이(GetTWRecentApiService)
    const isTideStation = cleanObs.startsWith('DT_');
    const url = isTideStation
        ? `https://apis.data.go.kr/1192136/surveyWind/GetSurveyWindApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&reqDate=${todayStr}&type=json&pageNo=1&numOfRows=10`
        : `https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&reqDate=${todayStr}&type=json&pageNo=1&numOfRows=10`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });
        const text = await response.text();
        
        if (!text.trim().startsWith('{')) {
            return res.status(200).json({ result: { data: null }, rawText: text.substring(0, 200) });
        }

        const json = JSON.parse(text);

        // 공공데이터포털 표준 응답 파싱 (response.body.items.item 또는 body.items.item)
        let item = null;
        if (json.response?.body?.items?.item) {
            const rawItem = json.response.body.items.item;
            item = Array.isArray(rawItem) ? rawItem[rawItem.length - 1] : rawItem;
        } else if (json.body?.items?.item) {
            const rawItem = json.body.items.item;
            item = Array.isArray(rawItem) ? rawItem[rawItem.length - 1] : rawItem;
        }

        if (item) {
            // 풍향, 풍속, 유의파고, 최대파고 추출 (다양한 영문 키 대응)
            const ws = item.windSpeed ?? item.wind_speed ?? item.wspd ?? item.ws ?? null;
            const wd = item.windDir ?? item.wind_dir ?? item.wdir ?? item.wd ?? null;
            const sigW = item.waveHeight ?? item.waveHgt ?? item.wave_hgt ?? item.sigWaveHgt ?? item.swh ?? item.wh ?? null;
            const maxW = item.maxWaveHeight ?? item.maxWaveHgt ?? item.max_wave_hgt ?? item.mwh ?? null;
            const recTime = item.obsTime ?? item.record_time ?? item.tm ?? item.obsDt ?? null;

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            return res.status(200).json({
                result: {
                    data: {
                        wind_speed: ws,
                        wind_dir: wd,
                        sig_wave: sigW,
                        max_wave: maxW,
                        record_time: recTime
                    }
                },
                rawItem: item
            });
        }

        return res.status(200).json({ result: { data: null }, rawResponse: json });
    } catch (e) {
        return res.status(200).json({ result: { data: null }, error: e.message });
    }
}
