// api/khoa.js (국립해양조사원 바다누리 정식 엔드포인트)
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

    // 💡 바다누리 OpenAPI 정식 경로 (/oceangrid/grid/api/)
    const targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/tideObsRecent/search.do?ServiceKey=${encodeURIComponent(cleanKey)}&ObsCode=${encodeURIComponent(cleanObs)}&ResultType=json`;

    try {
        const response = await fetch(targetUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' 
            },
            cache: 'no-store'
        });

        const rawText = await response.text();
        
        // HTML 에러 페이지가 떨어졌는지 사전 체크
        if (rawText.trim().startsWith('<')) {
            return res.status(200).json({ 
                result: { data: null }, 
                error: "KHOA 서버가 HTML을 반환함 (경로 또는 서비스키 확인 필요)",
                preview: rawText.substring(0, 150)
            });
        }

        const data = JSON.parse(rawText);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).json(data);
    } catch (error) {
        return res.status(200).json({ 
            result: { data: null }, 
            error: error.message 
        });
    }
}
