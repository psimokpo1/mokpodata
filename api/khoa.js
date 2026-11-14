// api/khoa.js (공공데이터포털 국립해양조사원 twRecent & surveyWind type=json 규격 완결본)
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

    // 관측소 코드 접두어에 따라 엔드포인트 자동 분기 (DT_: 조위관측소 풍향/풍속, 그 외 KG_/IE_/TW_: 해양관측부이)
    const isTideStation = cleanObs.startsWith('DT_');
    const candidateUrls = isTideStation
        ? [
            `https://apis.data.go.kr/1192136/surveyWind/GetSurveyWindApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&type=json&numOfRows=10&pageNo=1`
          ]
        : [
            `https://apis.data.go.kr/1192136/twRecent/GetTwRecentApiService?serviceKey=${cleanKey}&obsCode=${cleanObs}&type=json`,
            `https://apis.data.go.kr/1192136/twRecent/getTwRecent?serviceKey=${cleanKey}&obsCode=${cleanObs}&type=json`
          ];

    let debugErrors = [];

    for (const url of candidateUrls) {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                cache: 'no-store'
            });
            const text = await response.text();
            if (!text.trim().startsWith('{')) {
                debugErrors.push(text.substring(0, 100));
                continue;
            }

            const json = JSON.parse(text);

            if (json.OpenAPI_ServiceResponse) {
                debugErrors.push(json.OpenAPI_ServiceResponse.cmmMsgHeader?.returnAuthMsg || 'API_ERR');
                continue;
            }

            let item = null;
            if (json.response?.body?.items?.item) {
                const rawItem = json.response.body.items.item;
                item = Array.isArray(rawItem) ? rawItem[rawItem.length - 1] : rawItem;
            } else if (json.body?.items?.item) {
                const rawItem = json.body.items.item;
                item = Array.isArray(rawItem) ? rawItem[rawItem.length - 1] : rawItem;
            } else if (json.result?.data) {
                const rawData = json.result.data;
                item = Array.isArray(rawData) ? rawData[rawData.length - 1] : rawData;
            }

            if (item) {
                const ws = item.windSpeed ?? item.wind_speed ?? item.wspd ?? item.ws ?? null;
                const wd = item.windDir ?? item.wind_dir ?? item.wdir ?? item.wd ?? null;
                const sigW = item.waveHeight ?? item.waveHgt ?? item.wave_hgt ?? item.sigWaveHgt ?? item.swh ?? null;
                const maxW = item.maxWaveHeight ?? item.maxWaveHgt ?? item.max_wave_hgt ?? item.mwh ?? null;
                const recTime = item.obsTime ?? item.record_time ?? item.tm ?? null;

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
        } catch (e) {
            debugErrors.push(e.message);
        }
    }

    return res.status(200).json({
        result: { data: null },
        error: "KHOA_FETCH_FAILED",
        debugErrors
    });
}
