// api/kma.js (기상청 API 허브 서버리스 프록시)
export default async function handler(req, res) {
    const { type, authKey, tm, help = '1' } = req.query;

    if (!authKey) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).send("AUTH_KEY_REQUIRED");
    }

    let targetUrl = '';
    // 과거 특정 시각(YYYYMMDDHHmm) 파라미터 처리
    const tmParam = tm ? `&tm2=${encodeURIComponent(tm)}` : '';

    if (type === 'buoy') {
        // 해양기상부이 (tm 지정 시 해당 시점 기준 과거 전문 수신)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?stn=0&help=${help}&authKey=${encodeURIComponent(authKey)}${tmParam}`;
    } else if (type === 'warn') {
        // 기상특보 통보문 전문
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=${help}&authKey=${encodeURIComponent(authKey)}`;
    } else if (type === 'aws') {
        // 방재기상관측(AWS - 옥도 등)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=${help}&authKey=${encodeURIComponent(authKey)}${tm ? `&tm=${encodeURIComponent(tm)}` : ''}`;
    } else if (type === 'beacon') {
        // 등표 관측자료 (해수서 등)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=${help}&authKey=${encodeURIComponent(authKey)}${tmParam}`;
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).send("INVALID_TYPE");
    }

    try {
        const response = await fetch(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store' 
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        return res.send(Buffer.from(buffer));
    } catch (error) {
        console.error("KMA Proxy Error:", error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).send(`API Fetch Error: ${error.message}`);
    }
}
