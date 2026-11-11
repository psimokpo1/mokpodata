// api/khoa.js (국립해양조사원 안정화 프록시)
export default async function handler(req, res) {
    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'DT_0016', 
        type = 'tide' 
    } = req.query;

    let targetUrl = '';
    const cleanKey = encodeURIComponent(serviceKey.trim());

    if (type === 'buoy') {
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/buoyRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${obsCode}&ResultType=json`;
    } else if (type === 'history') {
        // 날짜 파라미터가 없을 경우 오늘 날짜 자동 바인딩
        const now = new Date();
        const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/tideObsPreHour/search.do?ServiceKey=${cleanKey}&ObsCode=${obsCode}&Date=${ymd}&ResultType=json`;
    } else {
        // 실시간 최신 관측
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/tideObsRecent/search.do?ServiceKey=${cleanKey}&ObsCode=${obsCode}&ResultType=json`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            cache: 'no-store'
        });

        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).json(data);
    } catch (error) {
        console.error("KHOA API Proxy Error:", error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // 프록시 실패 시에도 빈 결과 구조를 반환하여 프론트 통신이 죽지 않도록 방어
        return res.status(200).json({ result: { data: [] }, error: error.message });
    }
}
