// api/kma.js (기상청 API 허브 안정화 프록시)
export default async function handler(req, res) {
    const { type, authKey, tm, help = '1' } = req.query;

    if (!authKey) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(400).send("AUTH_KEY_REQUIRED");
    }

    let targetUrl = '';
    // tm 값이 실제로 존재할 때만 &tm= 파라미터 부착 (빈 문자열이면 절대 붙이지 않음)
    const tmParam = (tm && tm.trim().length >= 10) ? `&tm=${encodeURIComponent(tm.trim())}` : '';

    if (type === 'buoy') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?stn=0&help=${help}&authKey=${encodeURIComponent(authKey)}${tmParam}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=${help}&authKey=${encodeURIComponent(authKey)}`;
    } else if (type === 'aws') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=${help}&authKey=${encodeURIComponent(authKey)}${tmParam}`;
    } else if (type === 'beacon') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=${help}&authKey=${encodeURIComponent(authKey)}${tmParam}`;
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
