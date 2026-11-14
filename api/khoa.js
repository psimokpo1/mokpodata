// api/khoa.js (국립해양조사원 바다누리 다중 엔드포인트 자동 연결)
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

    // 바다누리 공식 API 후보 엔드포인트 목록
    const candidateUrls = [
        `http://www.khoa.go.kr/api/oceangrid/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`,
        `https://www.khoa.go.kr/api/oceangrid/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`,
        `http://www.khoa.go.kr/oceangrid/grid/api/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${cleanObs}&ResultType=json`
    ];

    let lastHtmlPreview = "";

    for (const url of candidateUrls) {
        try {
            const response = await fetch(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json, text/plain, */*'
                },
                cache: 'no-store'
            });

            const rawText = await response.text();
            
            // 순수 JSON 응답일 경우 즉시 반환
            if (rawText.trim().startsWith('{')) {
                const data = JSON.parse(rawText);
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                return res.status(200).json(data);
            } else {
                // HTML이 떨어졌을 경우 본문 텍스트만 추출해서 기록
                lastHtmlPreview = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
            }
        } catch (e) {
            lastHtmlPreview = e.message;
        }
    }

    // 모든 경로가 실패했을 경우 HTML 안의 실제 안내 문구 출력
    return res.status(200).json({ 
        result: { data: null }, 
        error: "조사원 API 응답 실패 (안내문 확인)",
        message: lastHtmlPreview
    });
}
