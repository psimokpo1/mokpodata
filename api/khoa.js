// api/khoa.js
export default async function handler(req, res) {
    const { 
        serviceKey = '47f38047094726017ef3dadeff2e4c2733c634c7878d7aa7f56a6a5b226c9eb3', 
        obsCode = 'DT_0016' 
    } = req.query;

    const cleanKey = String(serviceKey).trim();
    const cleanObs = String(obsCode).trim();
    const targetUrl = `https://www.khoa.go.kr/api/oceangrid/tideObsRecent/search.do?ServiceKey=${encodeURIComponent(cleanKey)}&ObsCode=${encodeURIComponent(cleanObs)}&ResultType=json`;

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
        return res.status(200).json({ result: { data: null }, error: error.message });
    }
}
