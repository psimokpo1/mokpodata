// api/kma.js
export default async function handler(req, res) {
    const { type, authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;

    const cleanKey = String(authKey).trim();
    let targetUrl = '';

    if (type === 'buoy') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?stn=0&help=1&authKey=${encodeURIComponent(cleanKey)}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${encodeURIComponent(cleanKey)}`;
    } else if (type === 'aws') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=1&authKey=${encodeURIComponent(cleanKey)}`;
    } else if (type === 'beacon') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=1&authKey=${encodeURIComponent(cleanKey)}`;
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
        console.error("KMA Proxy Fetch Error:", error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).send(`API Fetch Error: ${error.message}`);
    }
}
