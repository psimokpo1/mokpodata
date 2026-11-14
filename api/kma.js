// api/kma.js (기상청 API 허브 일반 도메인 apihub.kma.go.kr 연동 완결본)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type, authKey } = req.query;
    const finalKey = (authKey || 's0C3VEw6ScOAt1RMOinDFQ').trim();

    // 💡 -pub 제거 (apihub.kma.go.kr 적용)
    let targetUrl = '';
    if (type === 'buoy') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?&stn=0&help=1&authKey=${finalKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${finalKey}`;
    } else if (type === 'aws') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=1&authKey=${finalKey}`;
    } else if (type === 'beacon') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/lgt_obs.php?help=1&authKey=${finalKey}`;
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
