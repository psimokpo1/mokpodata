// api/khoa.js (국립해양조사원 바다누리 OceanGrid API 서버리스 프록시)
export default async function handler(req, res) {
    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'DT_0016', // 기본값: 목포 조위관측소
        type = 'tide'        // tide(실시간), history(과거 시간별 관측), buoy(부이)
    } = req.query;

    let targetUrl = '';

    if (type === 'buoy') {
        // 해양관측부이 실시간
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/buoyRecent/search.do?ServiceKey=${encodeURIComponent(serviceKey)}&ObsCode=${obsCode}&ResultType=json`;
    } else if (type === 'history') {
        // 조위관측소 과거 시간별(PreHour) 관측 이력 조회
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/tideObsPreHour/search.do?ServiceKey=${encodeURIComponent(serviceKey)}&ObsCode=${obsCode}&ResultType=json`;
    } else {
        // 조위관측소 최신 관측자료 (실시간 조위, 풍향, 풍속, 수온 등)
        targetUrl = `http://www.khoa.go.kr/oceangrid/grid/api/tideObsRecent/search.do?ServiceKey=${encodeURIComponent(serviceKey)}&ObsCode=${obsCode}&ResultType=json`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.status(200).json(data);
    } catch (error) {
        console.error("KHOA API Proxy Error:", error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ error: error.message });
    }
}
