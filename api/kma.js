// api/kma.js (기상청 부이/AWS 최근 6시간 이력 조회 + 특보 중계)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    // KST 기준 현재 시각(tm2) 및 6시간 전 시각(tm1) 계산 (YYYYMMDDHHMI)
    const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const sixHoursAgoKst = new Date(nowKst.getTime() - 6 * 60 * 60 * 1000);

    const formatKmaTime = (d) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(Math.floor(d.getUTCMinutes() / 10) * 10).padStart(2, '0');
        return `${yyyy}${mm}${dd}${hh}${min}`;
    };

    const tm2 = formatKmaTime(nowKst);
    const tm1 = formatKmaTime(sixHoursAgoKst);

    let targetUrl = '';
    if (type === 'buoy') {
        // 해양기상관측(부이/등표) 최근 6시간 구간 요청
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm1=${tm1}&tm2=${tm2}&stn=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'aws') {
        // 방재기상관측(옥도 308 AWS) 최근 6시간 구간 요청
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/kma_sfctm3.php?tm1=${tm1}&tm2=${tm2}&stn=308&help=0&authKey=${cleanKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
    } else {
        return res.status(400).send('INVALID_TYPE');
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        if (!response.ok) {
            return res.status(response.status).send(`FETCH_ERROR_${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).send(Buffer.from(buffer));
    } catch (err) {
        return res.status(500).send(`FETCH_ERROR: ${err.message}`);
    }
}
