// api/kma.js (기상청 해양기상부이/등표, AWS, 기상특보 - 최근 6시간 이력 전체 조회 지원)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    // KST(한국표준시) 기준 현재 시각(tm2) 및 6시간 전 시각(tm1) 계산 (YYYYMMDDHHMI)
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
        // 해양기상부이 및 등표: 최근 6시간 전체 로그(tm1 ~ tm2)
        targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm1=${tm1}&tm2=${tm2}&stn=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'aws') {
        // 방재기상관측(AWS) 옥도(308): 최근 6시간 정시/분 자료 전체 조회
        targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1}&tm2=${tm2}&stn=308&disp=0&help=0&authKey=${cleanKey}`;
    } else if (type === 'warn') {
        // 기상특보 현황
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
