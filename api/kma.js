// api/kma.js (기상청 부이/AWS/등표/특보 자체 파싱 및 정제 프록시)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type, authKey } = req.query;
    const finalKey = (authKey || 's0C3VEw6ScOAt1RMOinDFQ').trim();

    // 1. 관측소 고유 매핑 테이블 정의
    const TARGET_STATIONS = {
        // [해양기상부이 - stnId]
        buoy: [
            { id: '22183', name: '신안' },
            { id: '22184', name: '추자도' },
            { id: '22102', name: '칠발도' },
            { id: '22298', name: '홍도' },
            { id: '22297', name: '가거도' },
            { id: '22193', name: '흑산도' }
        ],
        // [방재기상관측 AWS - stnId]
        aws: [
            { id: '308', name: '옥도' }
        ],
        // [등표 관측자료 - stnId]
        beacon: [
            { id: '959', name: '해수서' }
        ]
    };

    let targetUrl = '';
    if (type === 'buoy') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?&stn=0&help=1&authKey=${finalKey}`;
    } else if (type === 'warn') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${finalKey}`;
    } else if (type === 'aws') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=1&authKey=${finalKey}`;
    } else if (type === 'beacon') {
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=1&authKey=${finalKey}`;
    } else {
        return res.status(400).json({ error: "INVALID_TYPE" });
    }

    try {
        const response = await fetch(targetUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            cache: 'no-store'
        });

        // EUC-KR 텍스트 디코딩
        const buffer = await response.arrayBuffer();
        let text = '';
        try {
            const decoder = new TextDecoder('euc-kr');
            text = decoder.decode(buffer);
        } catch (e) {
            const decoder = new TextDecoder('utf-8');
            text = decoder.decode(buffer);
        }

        // 특보문 전문 호출일 경우 원본 텍스트 그대로 반환
        if (type === 'warn') {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            return res.status(200).send(text);
        }

        // 2. 부이 / AWS / 등표 데이터 파싱
        const parsedResults = {};
        const lines = text.split('\n');

        if (type === 'buoy') {
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const cols = trimmed.split(',').map(c => c.trim());
                if (cols.length < 9) return;

                const stnId = cols[2];
                const matched = TARGET_STATIONS.buoy.find(s => s.id === stnId);
                if (matched) {
                    const rawWs = parseFloat(cols[8]);
                    const rawWd = parseFloat(cols[7]);
                    const rawWh = parseFloat(cols[6]);

                    parsedResults[matched.name] = {
                        stnId: stnId,
                        name: matched.name + ' 부이',
                        wind: (!isNaN(rawWs) && rawWs >= 0) ? rawWs.toFixed(1) : '-',
                        windDeg: !isNaN(rawWd) ? rawWd : null,
                        sigWave: (!isNaN(rawWh) && rawWh >= 0) ? rawWh.toFixed(1) : '-'
                    };
                }
            });
        } else if (type === 'aws') {
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const cols = trimmed.split(/[\s,]+/).filter(Boolean);
                if (cols.length < 4) return;

                const stnId = cols[1];
                const matched = TARGET_STATIONS.aws.find(s => s.id === stnId);
                if (matched) {
                    const ws1 = parseFloat(cols[3]);
                    const wd1 = parseFloat(cols[2]);
                    const ws10 = cols.length >= 8 ? parseFloat(cols[7]) : -99;
                    const wd10 = cols.length >= 8 ? parseFloat(cols[6]) : -99;

                    const finalWs = (!isNaN(ws10) && ws10 >= 0 && ws10 < 100) ? ws10 : ws1;
                    const finalWd = (!isNaN(wd10) && wd10 >= 0 && wd10 <= 360) ? wd10 : wd1;

                    parsedResults[matched.name] = {
                        stnId: stnId,
                        name: matched.name + ' AWS',
                        wind: (!isNaN(finalWs) && finalWs >= 0) ? finalWs.toFixed(1) : '-',
                        windDeg: !isNaN(finalWd) ? finalWd : null
                    };
                }
            });
        } else if (type === 'beacon') {
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) return;
                const cols = trimmed.split(/[\s,]+/).filter(Boolean);
                if (cols.length < 4) return;

                const stnId = cols[0] || '';
                const matched = TARGET_STATIONS.beacon.find(s => line.includes(s.id) || s.id === stnId);
                if (matched) {
                    const bWd = parseFloat(cols[2]);
                    const bWs = parseFloat(cols[3]);

                    parsedResults[matched.name] = {
                        stnId: matched.id,
                        name: matched.name + ' 등표',
                        wind: (!isNaN(bWs) && bWs >= 0) ? bWs.toFixed(1) : '-',
                        windDeg: !isNaN(bWd) ? bWd : null
                    };
                }
            });
        }

        // 3. 정제된 JSON 응답 및 fallback 원본 반환
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).json({
            success: true,
            data: parsedResults,
            rawText: text
        });
    } catch (error) {
        console.error("KMA Proxy Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
