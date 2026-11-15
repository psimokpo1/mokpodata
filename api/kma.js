// api/kma.js (기상청 해양기상부이/등표/파고부이, AWS 전체, 기상특보 - 최근 6시간 이력 전체 조회 지원)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    const nowUtc = Date.now();
    const kstNow = new Date(nowUtc + 9 * 60 * 60 * 1000);
    const kst6hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);

    const formatKst = (d) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        return `${yyyy}${mm}${dd}${hh}${min}`;
    };

    const tm2 = formatKst(kstNow);
    const tm1 = formatKst(kst6hAgo);

    let targetUrl = '';

    if (type === 'buoy') {
        // help=1을 포함하여 컬럼 헤더(# TP TM STN ...)를 함께 받아 최대파고(MAX_WH) 컬럼 위치를 정확히 식별
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm1=${tm1}&tm2=${tm2}&stn=0&disp=0&help=1&authKey=${cleanKey}`;
    } else if (type === 'aws') {
        // nph-aws2_min은 stn=0(전체)으로 조회해야 15개 지점 모두가 한 번에 수신됨
        targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1}&tm2=${tm2}&stn=0&disp=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        return res.status(200).send(buffer);
    } catch (err) {
        return res.status(200).send(`FETCH_ERROR: ${err.message}`);
    }
}
