// api/kma.js (부이+등표 통합 + 옥도 AWS + 특보 완결본)
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
        // 해양기상부이(B) 및 등표(L, 해수서 959 포함) 통합 관측자료
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?&stn=0&help=1&authKey=${finalKey}`;
    } else if (type === 'warn') {
        // 기상특보 통보문
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${finalKey}`;
    } else if (type === 'aws') {
        // 방재기상관측 AWS (옥도 308 포함)
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/nph-aws2_min?stn=308&disp=0&help=1&authKey=${finalKey}`;
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
