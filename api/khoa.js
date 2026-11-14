// api/khoa.js (국립해양조사원 실시간 및 과거 이력 rawItems 완벽 지원)
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

    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

    const isTideStation = cleanObs.startsWith('DT_');
    const url = isTideStation
        ? `https://apis.data.go.kr/1192136/surveyWind/GetSurveyWindApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&reqDate=${todayStr}&type=json&pageNo=1&numOfRows=24`
        : `https://apis.data.go.kr/1192136/twRecent/GetTWRecentApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&reqDate=${todayStr}&type=json&pageNo=1&numOfRows=24`;

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
        const text = await response.text();
        
        if (!text.trim().startsWith('{')) {
            return res.status(200).json({ result: { data: null }, rawText: text.substring(0, 200) });
        }

        const json = JSON.parse(text);

        let rawItems = null;
        if (json.response?.body?.items?.item) {
            rawItems = json.response.body.items.item;
        } else if (json.body?.items?.item) {
            rawItems = json.body.items.item;
        } else if (json.result?.data) {
            rawItems = [json.result.data];
        }

        if (rawItems) {
            const itemsArr = Array.isArray(rawItems) ? rawItems : [rawItems];
            const latestItem = itemsArr[itemsArr.length - 1];

            const ws = latestItem.windSpeed ?? latestItem.wind_speed ?? latestItem.wspd ?? latestItem.ws ?? null;
            const wd = latestItem.windDir ?? latestItem.wind_dir ?? latestItem.wdir ?? latestItem.wd ?? null;
            const sigW = latestItem.waveHeight ?? latestItem.waveHgt ?? latestItem.wave_hgt ?? latestItem.sigWaveHgt ?? latestItem.swh ?? latestItem.wh ?? null;
            const maxW = latestItem.maxWaveHeight ?? latestItem.maxWaveHgt ?? latestItem.max_wave_hgt ?? latestItem.mwh ?? null;
            const recTime = latestItem.obsTime ?? latestItem.record_time ?? latestItem.tm ?? latestItem.obsDt ?? null;

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
                rawItem: latestItem,
                rawItems: itemsArr
            });
        }

        return res.status(200).json({ result: { data: null }, rawResponse: json });
    } catch (e) {
        return res.status(200).json({ result: { data: null }, error: e.message });
    }
}
