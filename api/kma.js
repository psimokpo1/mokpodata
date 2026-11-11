// api/kma.js (기상청 API 허브 실시간 정석 프록시)
export default async function handler(req, res) {
    const { type, authKey, help = '1' } = req.query;

    if (!authKey) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).send("AUTH_KEY_REQUIRED");
    }

    let targetUrl = '';
    const cleanKey = encodeURIComponent(authKey.trim());

    if (type === 'buoy') {
        // 해양기상부이 (신안, 추자도, 칠발도, 홍도, 가거도, 흑산도)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?stn=0&help=${help}&authKey=${cleanKey}`;
    } else if (type === 'warn') {
        // 기상특보 통보문 전문
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=${help}&authKey=${cleanKey}`;
    } else if (type === 'aws') {
        // 방재기상관측 AWS (옥도)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=${help}&authKey=${cleanKey}`;
    } else if (type === 'beacon') {
        // 등표 관측자료 (해수서)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=${help}&authKey=${cleanKey}`;
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).send("INVALID_TYPE");
    }

    try {
        const response = await fetch(targetUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            cache: 'no-store' 
        });

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
