// api/kma.js (해양기상부이 kma_buoy2 + 파고부이/등표 sea_obs + 정시 과거이력 sea_obs_hist + AWS 초고속 스냅샷/과거 3정시 + 기상특보 이중수신 + 날씨누리 실시간 특보지도 프록시)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ', tmFc = '' } = req.query;
    const cleanKey = String(authKey).trim();
    const cleanTmFc = String(tmFc).replace(/\D/g, '').substring(0, 12);

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

    const fetchWithTimeoutServer = async (url, options = {}, timeoutMs = 6000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const kmaWebHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.weather.go.kr/w/weather/warning/status.do',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    };

    const tm2 = formatKst(kstNow);
    const tm1_6h = formatKst(kst6hAgo);

    try {
        // 1. 기상청 날씨누리 실시간 특보 발효현황 지도 이미지 프록시
        if (type === 'warn_img') {
            const imgCandidates = [];

            if (cleanTmFc.length >= 12) {
                imgCandidates.push(
                    `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data_${cleanTmFc}.png`,
                    `https://www.weather.go.kr/w/repositary/xml/wrn/img/JN_wrn_now_${cleanTmFc}.png`,
                    `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now_${cleanTmFc}.png`
                );
            }

            try {
                const statusRes = await fetchWithTimeoutServer('https://www.weather.go.kr/w/weather/warning/status.do', { headers: kmaWebHeaders }, 4500);
                if (statusRes.ok) {
                    const html = await statusRes.text();
                    const imgMatches = html.match(/\/w\/repositary\/xml\/wrn\/img\/[^"'\s<>]+\.(?:png|jpg|gif)/gi) || [];
                    imgMatches.forEach(relPath => {
                        if (!relPath.includes('legend') && !relPath.includes('icon')) {
                            imgCandidates.push(`https://www.weather.go.kr${relPath}`);
                        }
                    });
                }
            } catch (e) {}

            imgCandidates.push(
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/wrn_now_data.png?_t=${nowUtc}`,
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/SEA_wrn_now.png?_t=${nowUtc}`,
                `https://www.weather.go.kr/w/repositary/xml/wrn/img/KOR_wrn_now.png?_t=${nowUtc}`
            );

            for (const imgUrl of imgCandidates) {
                try {
                    const imgRes = await fetchWithTimeoutServer(imgUrl, {
                        headers: { ...kmaWebHeaders, 'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }
                    }, 4000);
                    const cType = imgRes.headers.get('content-type') || '';
                    if (imgRes.ok && cType.startsWith('image/')) {
                        const buf = Buffer.from(await imgRes.arrayBuffer());
                        if (buf.length > 1500) {
                            res.setHeader('Content-Type', cType);
                            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                            return res.status(200).send(buf);
                        }
                    }
                } catch (e) {}
            }
            return res.status(404).end();
        }

        // 2. 해양기상부이(kma_buoy2) 6시간 + 파고부이/등표(sea_obs) 최신 1건 즉시 조회
        if (type === 'buoy') {
            const buoy2Url = `https://apihub.kma.go.kr/api/typ01/url/kma_buoy2.php?tm1=${tm1_6h}&tm2=${tm2}&stn=0&help=1&authKey=${cleanKey}`;
            const seaObsUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tm2}&stn=0&help=0&authKey=${cleanKey}`;

            const [resBuoy2, resSea] = await Promise.allSettled([
                fetchWithTimeoutServer(buoy2Url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000),
                fetchWithTimeoutServer(seaObsUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000)
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

        // 2-1. 파고부이/등표(sea_obs.php) 과거 6시간 정시(00분) 백그라운드 병렬 수집
        if (type === 'sea_obs_hist') {
            const decoder = new TextDecoder('euc-kr');
            const hourlyPromises = [];

            for (let hOffset = 0; hOffset <= 6; hOffset++) {
                const targetKst = new Date(nowUtc + 9 * 60 * 60 * 1000 - hOffset * 60 * 60 * 1000);
                const yyyy = targetKst.getUTCFullYear();
                const mm = String(targetKst.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(targetKst.getUTCDate()).padStart(2, '0');
                const hh = String(targetKst.getUTCHours()).padStart(2, '0');
                const tmHour = `${yyyy}${mm}${dd}${hh}00`;

                const url = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tmHour}&stn=0&help=0&authKey=${cleanKey}`;
                hourlyPromises.push(
                    fetchWithTimeoutServer(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 5000)
                        .then(async (r) => (r.ok ? decoder.decode(await r.arrayBuffer()) : ''))
                        .catch(() => '')
                );
            }

            const results = await Promise.all(hourlyPromises);
            const mergedSeaText = results.filter(Boolean).join('\n');

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(mergedSeaText);
        }

        // 3. 기상특보 이중 수신 (API허브 wrn_now_data.php fe=f / fe=a + 날씨누리 status.do 백업 파싱)
        if (type === 'warn') {
            const decoder = new TextDecoder('euc-kr');
            const warnUrls = [
                `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&tm=&disp=0&help=0&authKey=${cleanKey}`,
                `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=a&tm=&disp=0&help=0&authKey=${cleanKey}`
            ];

            for (const wUrl of warnUrls) {
                try {
                    const wRes = await fetchWithTimeoutServer(wUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000);
                    if (wRes.ok) {
                        const buf = await wRes.arrayBuffer();
                        const text = decoder.decode(buf);
                        const dataLines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
                        if (dataLines.length > 0 && !text.includes('AUTH_ERROR') && !text.includes('SERVICE_ERROR')) {
                            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                            return res.status(200).send(text);
                        }
                    }
                } catch (e) {}
            }

            try {
                const statusRes = await fetchWithTimeoutServer('https://www.weather.go.kr/w/weather/warning/status.do', { headers: kmaWebHeaders }, 6000);
                if (statusRes.ok) {
                    const html = await statusRes.text();
                    const syntheticLines = [];
                    const nowTm = formatKst(kstNow);

                    const cleanText = html
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<\/p>|<\/div>|<\/li>/gi, '\n')
                        .replace(/<[^>]+>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>');

                    let fcTm = nowTm;
                    let efTm = nowTm;
                    const fcMatch = cleanText.match(/발표시각\s*:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\([^)]+\)\s*(\d{2}):(\d{2})/);
                    if (fcMatch) {
                        fcTm = `${fcMatch[1]}${fcMatch[2].padStart(2, '0')}${fcMatch[3].padStart(2, '0')}${fcMatch[4]}${fcMatch[5]}`;
                    }
                    const efMatch = cleanText.match(/발효시각\s*:\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\([^)]+\)\s*(\d{2}):(\d{2})/);
                    if (efMatch) {
                        efTm = `${efMatch[1]}${efMatch[2].padStart(2, '0')}${efMatch[3].padStart(2, '0')}${efMatch[4]}${efMatch[5]}`;
                    }

                    const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);
                    lines.forEach(line => {
                        const m = line.match(/^[oㅇ•\-]\s*(풍랑|강풍|태풍|호우|대설|건조|한파|폭염)(경보|주의보|예비특보)\s*[:：]\s*(.+)$/);
                        if (m) {
                            const wrn = m[1];
                            const lvl = m[2];
                            const areas = m[3].split(',').map(a => a.trim()).filter(Boolean);
                            areas.forEach(area => {
                                syntheticLines.push(`WEB,해상,${area},${area},${fcTm},${efTm},${wrn},${lvl},발표,`);
                            });
                        }
                        const subM = line.match(/^[oㅇ•\-]\s*([^\s]+(?:평수구역|연안바다))\s+(풍랑|강풍)(경보|주의보|예비특보)\s*발표/);
                        if (subM) {
                            syntheticLines.push(`WEB,특정관리해역,${subM[1]},${subM[1]},${fcTm},${efTm},${subM[2]},${subM[3]},발표,`);
                        }
                    });

                    if (syntheticLines.length > 0) {
                        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                        return res.status(200).send(syntheticLines.join('\n'));
                    }
                }
            } catch (e) {}

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send('');
        }

        // 4-1. AWS 초고속 최신 스냅샷 (0.2초 응답)
        if (type === 'aws_now') {
            const targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=0&disp=0&help=0&authKey=${cleanKey}`;
            const response = await fetchWithTimeoutServer(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
            const buffer = Buffer.from(await response.arrayBuffer());
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
            return res.status(200).send(buffer);
        }

        // 4-2. AWS 과거 3개 정시(1h, 2h, 3h 전 정시 3건만 병렬 조회 -> CGI 병목/타임아웃 0%)
        if (type === 'aws') {
            const decoder = new TextDecoder('euc-kr');
            const hourPromises = [];

            for (let hOffset = 1; hOffset <= 3; hOffset++) {
                const targetKst = new Date(nowUtc + 9 * 60 * 60 * 1000 - hOffset * 60 * 60 * 1000);
                const yyyy = targetKst.getUTCFullYear();
                const mm = String(targetKst.getUTCMonth() + 1).padStart(2, '0');
                const dd = String(targetKst.getUTCDate()).padStart(2, '0');
                const hh = String(targetKst.getUTCHours()).padStart(2, '0');
                const tmHour = `${yyyy}${mm}${dd}${hh}00`;

                const url = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm=${tmHour}&stn=0&disp=0&help=0&authKey=${cleanKey}`;
                hourPromises.push(
                    fetchWithTimeoutServer(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000)
                        .then(async (r) => (r.ok ? decoder.decode(await r.arrayBuffer()) : ''))
                        .catch(() => '')
                );
            }

            const results = await Promise.all(hourPromises);
            const mergedAwsText = results.filter(Boolean).join('\n');

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(mergedAwsText);
        }

        return res.status(200).send('');
    } catch (err) {
        return res.status(200).send(`FETCH_ERROR: ${err.message}`);
    }
}
