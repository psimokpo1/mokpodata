// api/kma.js (기상청 해양기상부이 기간조회 kma_buoy.php + 등표/파고부이 + AWS 전체 + 기상특보)
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

    try {
        if (type === 'buoy') {
            // 1) 해양기상부이 기간조회(kma_buoy.php: 최근 6시간 전체 이력 + 실제 MAX_WH 최대파고 포함)
            // 2) 등표(959) 및 파고부이(22500, 22481, 22449)용 sea_obs.php 병행 조회
            const buoyPeriodUrl = `https://apihub.kma.go.kr/api/typ01/url/kma_buoy.php?tm1=${tm1}&tm2=${tm2}&stn=0&disp=0&help=1&authKey=${cleanKey}`;
            const seaObsUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tm2}&stn=0&disp=0&help=1&authKey=${cleanKey}`;

            const [resBuoy, resSea] = await Promise.allSettled([
                fetch(buoyPeriodUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }),
                fetch(seaObsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
            ]);

            const decoder = new TextDecoder('euc-kr');
            let buoyText = '';
            let seaText = '';

            if (resBuoy.status === 'fulfilled' && resBuoy.value.ok) {
                const buf = await resBuoy.value.arrayBuffer();
                buoyText = decoder.decode(buf);
            }
            if (resSea.status === 'fulfilled' && resSea.value.ok) {
                const buf = await resSea.value.arrayBuffer();
                seaText = decoder.decode(buf);
            }

            const combined = `===BUOY_PERIOD===\n${buoyText}\n===SEA_OBS===\n${seaText}`;
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(combined);
        }

        let targetUrl = '';
        if (type === 'aws') {
            targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1}&tm2=${tm2}&stn=0&disp=0&help=0&authKey=${cleanKey}`;
        } else if (type === 'warn') {
            targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
        }

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
