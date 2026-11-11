// api/kma.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

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
        return res.status(400).send("INVALID_TYPE");
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            cache: 'no-store'
        });

        if (!response.ok) {
            return res.status(response.status).send(`KMA_UPSTREAM_ERROR_${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        return res.send(Buffer.from(buffer));
    } catch (error) {
        console.error("KMA Proxy Fetch Error:", error);
        return res.status(500).send(`API Fetch Error: ${error.message}`);
    }
}
