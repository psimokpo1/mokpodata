// api/kma.js (기상청 해양기상부이 kma_buoy2 + 파고부이/등표 sea_obs + AWS 즉시/3시간 분리 + 기상특보 + 날씨누리 실시간 특보지도 프록시)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ' } = req.query;
    const cleanKey = String(authKey).trim();

    const nowUtc = Date.now();
    const kstNow = new Date(nowUtc + 9 * 60 * 60 * 1000);
    const kst6hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);
    const kst3hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000);

    const formatKst = (d) => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const hh = String(d.getUTCHours()).padStart(2, '0');
        const min = String(d.getUTCMinutes()).padStart(2, '0');
        return `${yyyy}${mm}${dd}${hh}${min}`;
    };

    const tm2 = formatKst(kstNow);
    const tm1_6h = formatKst(kst6hAgo);
    const tm1_3h = formatKst(kst3hAgo);

    try {
        // 1. 기상청 날씨누리 실시간 특보 발효현황 지도 이미지 프록시 (Referer 헤더 및 최신 이미지 경로 탐색)
        if (type === 'warn_img') {
            const kmaHeaders = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': 'https://www.weather.go.kr/w/weather/warning/status.do',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            };

            const imgCandidates = [
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data.png?_t=${nowUtc}`,
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now.png?_t=${nowUtc}`,
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/KOR_wrn_now.png?_t=${nowUtc}`
            ];

            // 최신 발표시각(TM_FC) 기반 이미지 파일명(wrn_now_data_YYYYMMDDHHMM.png) 동적 탐색 추가
            try {
                const warnUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`;
                const warnRes = await fetch(warnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
                if (warnRes.ok) {
                    const wBuf = await warnRes.arrayBuffer();
                    const wText = new TextDecoder('euc-kr').decode(wBuf);
                    let latestFc = '';
                    wText.split('\n').forEach(line => {
                        const l = line.trim();
                        if (!l || l.startsWith('#')) return;
                        const cols = l.split(',').map(c => c.trim());
                        if (cols.length >= 5) {
                            const fcDigits = (cols[4] || '').replace(/\D/g, '');
                            if (fcDigits.length >= 12 && fcDigits > latestFc) {
                                latestFc = fcDigits.substring(0, 12);
                            }
                        }
                    });
                    if (latestFc) {
                        imgCandidates.unshift(
                            `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data_${latestFc}.png`,
                            `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now_${latestFc}.png`
                        );
                    }
                }
            } catch (e) {}

            for (const imgUrl of imgCandidates) {
                try {
                    const imgRes = await fetch(imgUrl, { headers: kmaHeaders, cache: 'no-store' });
                    const cType = imgRes.headers.get('content-type') || '';
                    if (imgRes.ok && cType.startsWith('image/')) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        if (buf.length > 1000) {
                            res.setHeader('Content-Type', cType);
                            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                            return res.status(200).send(buf);
                        }
                    }
                } catch (e) {}
            }
            return res.status(404).end();
        }

        // 2. 해양기상부이(kma_buoy2) + 파고부이/등표(sea_obs) 기간조회
        if (type === 'buoy') {
            const buoy2Url = `https://apihub.kma.go.kr/api/typ01/url/kma_buoy2.php?tm1=${tm1_6h}&tm2=${tm2}&stn=0&help=1&authKey=${cleanKey}`;
            const seaObsUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm1=${tm1_6h}&tm2=${tm2}&stn=0&help=0&authKey=${cleanKey}`;

            const [resBuoy2, resSea] = await Promise.allSettled([
                fetch(buoy2Url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }),
                fetch(seaObsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
            ]);

            const decoder = new TextDecoder('euc-kr');
            let buoy2Text = '';
            let seaText = '';

            if (resBuoy2.status === 'fulfilled' && resBuoy2.value.ok) {
                const buf = await resBuoy2.value.arrayBuffer();
                buoy2Text = decoder.decode(buf);
            }
            if (resSea.status === 'fulfilled' && resSea.value.ok) {
                const buf = await resSea.value.arrayBuffer();
                seaText = decoder.decode(buf);
            }

            const combined = `===BUOY2_START===\n${buoy2Text}\n===SEAOBS_START===\n${seaText}`;
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(combined);
        }

        // 3. AWS(즉시 스냅샷 / 최근 3시간 이력) 및 기상특보 전문
        let targetUrl = '';
        if (type === 'aws_now') {
            targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=0&disp=0&help=0&authKey=${cleanKey}`;
        } else if (type === 'aws') {
            targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1_3h}&tm2=${tm2}&stn=0&itv=10&disp=0&help=0&authKey=${cleanKey}`;
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
