// api/kma.js (기상청 APIHub 최근 6시간 이력 tm1~tm2 조회 및 중계)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    // KST 기준 현재(tm2) 및 6시간 전(tm1) 시각 생성 (YYYYMMDDHHMI)
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const past6hKst = new Date(nowKst.getTime() - 6 * 60 * 60 * 1000);

    const fmt = (d) => d.toISOString().replace(/\D/g, '').substring(0, 12);
    const tm2 = fmt(nowKst);
    const tm1 = fmt(past6hKst);

    let targetUrl = '';
    if (type === 'buoy') {
        // 해양기상부이 및 등표(959 해수서 포함) 최근 6시간 이력
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm1=${tm1}&tm2=${tm2}&stn=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'aws') {
        // 방재기상관측 AWS (옥도 308 포함) 최근 6시간 이력
        targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1}&tm2=${tm2}&stn=308&disp=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        const arrayBuffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).send(Buffer.from(arrayBuffer));
    } catch (error) {
        return res.status(200).send(`FETCH_ERROR: ${error.message}`);
    }
}
