// api/kma.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type, authKey } = req.query;
    const finalKey = (authKey || 's0C3VEw6ScOAt1RMOinDFQ').trim();

    let targetUrl = '';
    if (type === 'buoy' || type === 'beacon') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?&stn=0&help=1&authKey=${finalKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${finalKey}`;
    } else if (type === 'aws') {
        // 💡 옥도 AWS 실제 동작 엔드포인트 (cgi-bin 경로)
        targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=308&disp=0&help=1&authKey=${finalKey}`;
    } else {
        return res.status(400).send("INVALID_TYPE");
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        const buffer = await response.arrayBuffer();

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        return res.status(500).send("FETCH_ERROR: " + error.message);
    }
}
