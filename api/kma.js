// api/kma.js (부이/파고부이/등표 + AWS 스냅샷 및 단일지점 1분단위 1시간 이력 + 기상특보 이중수신 + 공식 특보지도 nph-wrn7)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type = 'buoy', authKey = 's0C3VEw6ScOAt1RMOinDFQ', tmFc = '', stn = '0' } = req.query;
    const cleanKey = String(authKey).trim();
    const cleanTmFc = String(tmFc).replace(/\D/g, '').substring(0, 12);
    const cleanStn = String(stn).replace(/\D/g, '') || '0';

    const nowUtc = Date.now();
    const kstNow = new Date(nowUtc + 9 * 60 * 60 * 1000);
    const kstSlightlyBack = new Date(nowUtc + 9 * 60 * 60 * 1000 - 2 * 60 * 1000);
    const kst6hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);
    const kst1hAgo = new Date(nowUtc + 9 * 60 * 60 * 1000 - 60 * 60 * 1000);

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
    const tm2Fallback = formatKst(kstSlightlyBack);
    const tm1_6h = formatKst(kst6hAgo);
    const tm1_1h = formatKst(kst1hAgo);

    const hasDataRows = (txt) => {
        if (!txt) return false;
        return txt.split('\n').some(line => {
            const t = line.trim();
            return t && !t.startsWith('#') && !t.includes('UNAUTHORIZED') && !t.includes('DENIED') && !t.includes('ERROR');
        });
    };

    try {
        // 1. 기상청 API허브 공식 특보 발효현황 지도 이미지 API (nph-wrn7)
        if (type === 'warn_img') {
            const targetTm = cleanTmFc.length >= 12 ? cleanTmFc : tm2;
            const nphWrnUrl = `https://apihub.kma.go.kr/api/typ03/cgi/wrn/nph-wrn7?out=0&tmef=1&city=1&name=0&tm=${targetTm}&lon=126.1&lat=34.4&range=260&size=685&wrn=W,R,C,D,O,V,T,S,Y,H,F,K&authKey=${cleanKey}`;

            try {
                const imgRes = await fetchWithTimeoutServer(nphWrnUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                }, 7000);
                if (imgRes.ok) {
                    const buf = Buffer.from(await imgRes.arrayBuffer());
                    const isPng = buf.length > 1000 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
                    if (isPng) {
                        res.setHeader('Content-Type', 'image/png');
                        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
                        return res.status(200).send(buf);
                    }
                }
            } catch (e) {}

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
                buoy2Text = decoder.decode(await resBuoy2.value.arrayBuffer());
            }
            if (!hasDataRows(buoy2Text)) {
                try {
                    const buoy2RetryUrl = `https://apihub.kma.go.kr/api/typ01/url/kma_buoy2.php?tm1=${tm1_6h}&tm2=${tm2Fallback}&stn=0&help=1&authKey=${cleanKey}`;
                    const retryRes = await fetchWithTimeoutServer(buoy2RetryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
                    if (retryRes.ok) {
                        const retryText = decoder.decode(await retryRes.arrayBuffer());
                        if (hasDataRows(retryText)) buoy2Text = retryText;
                    }
                } catch (e) {}
            }

            if (resSea.status === 'fulfilled' && resSea.value.ok) {
                seaText = decoder.decode(await resSea.value.arrayBuffer());
            }
            if (!hasDataRows(seaText)) {
                try {
                    const seaRetryUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?tm=${tm2Fallback}&stn=0&help=0&authKey=${cleanKey}`;
                    const retrySeaRes = await fetchWithTimeoutServer(seaRetryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 6000);
                    if (retrySeaRes.ok) {
                        const retrySeaText = decoder.decode(await retrySeaRes.arrayBuffer());
                        if (hasDataRows(retrySeaText)) seaText = retrySeaText;
                    }
                } catch (e) {}
            }

            const combined = `===BUOY2_START===\n${buoy2Text}\n===SEAOBS_START===\n${seaText}`;
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(combined);
        }

        // 2-1. 파고부이/등표(sea_obs.php) 과거 6시간 정시(00분) 병렬 수집
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

        // 3. 기상특보 이중 수신 (API허브 wrn_now_data.php + 날씨누리 백업)
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
                        const text = decoder.decode(await wRes.arrayBuffer());
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

        // 4-1. AWS 초고속 최신 스냅샷 (전국 stn=0, 0.2초 응답)
        if (type === 'aws_now') {
            const targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=0&disp=0&help=0&authKey=${cleanKey}`;
            const response = await fetchWithTimeoutServer(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 8000);
            const buffer = Buffer.from(await response.arrayBuffer());
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
            return res.status(200).send(buffer);
        }

        // 4-2. AWS 특정 단일 관측소(stn=308 등) 직전 1시간 1분 단위 실측 이력 (60건 즉시 응답)
        if (type === 'aws') {
            const targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1_1h}&tm2=${tm2}&stn=${cleanStn}&disp=0&help=0&authKey=${cleanKey}`;
            let response = await fetchWithTimeoutServer(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 10000);
            let buffer = Buffer.from(await response.arrayBuffer());

            if (buffer.length <= 10) {
                const retryUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?tm1=${tm1_1h}&tm2=${tm2Fallback}&stn=${cleanStn}&disp=0&help=0&authKey=${cleanKey}`;
                response = await fetchWithTimeoutServer(retryUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 10000);
                buffer = Buffer.from(await response.arrayBuffer());
            }

            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
            return res.status(200).send(buffer);
        }

        return res.status(200).send('');
    } catch (err) {
        return res.status(200).send(`FETCH_ERROR: ${err.message}`);
    }
}
