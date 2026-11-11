// api/khoa.js (국립해양조사원 바다누리 정식 REST API 프록시)
export default async function handler(req, res) {
    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'DT_0016'
    } = req.query;

    const cleanKey = serviceKey.trim();
    // 바다누리 조위관측소 최신자료 정식 REST 엔드포인트
    const targetUrl = `http://www.khoa.go.kr/api/oceangrid/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${obsCode}&ResultType=json`;

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).json(data);
    } catch (error) {
        console.error("KHOA API Proxy Error:", error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // 실패 시에도 JSON 파싱 에러 방지를 위해 빈 구조 반환
        return res.status(200).json({ result: { data: null }, error: error.message });
    }
}
