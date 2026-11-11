// api/kma.js (기상청 API 허브 실시간 연동 완결본)
export default async function handler(req, res) {
    // 1. CORS 및 브라우저 프리플라이트 완벽 대응
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 2. 파라미터 및 인증키 추출
    const { type, authKey } = req.query;
    const finalKey = (authKey || 's0C3VEw6ScOAt1RMOinDFQ').trim();[cite: 2]

    if (!finalKey) {
        return res.status(400).send("AUTH_KEY_REQUIRED");
    }

    // 3. 기상청 API 허브 검증된 원본 URL 매핑
    let targetUrl = '';
    if (type === 'buoy') {
        // 해양기상부이 관측자료 (신안, 추자도, 칠발도, 홍도, 가거도, 흑산도)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/sea_obs.php?&stn=0&help=1&authKey=${finalKey}`;
    } else if (type === 'warn') {
        // 기상특보 통보문 전문
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/fct_shrt_reg.php?mode=0&help=1&authKey=${finalKey}`;
    } else if (type === 'aws') {
        // 방재기상관측 AWS (옥도 등)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/kma_sfctm2.php?help=1&authKey=${finalKey}`;
    } else if (type === 'beacon') {
        // 등표 관측자료 (해수서 등)
        targetUrl = `https://apihub-pub.kma.go.kr/api/typ01/url/lgt_obs.php?help=1&authKey=${finalKey}`;
    } else {
        return res.status(400).send("INVALID_TYPE");
    }

    // 4. 기상청 서버 호출 및 EUC-KR 바이너리 버퍼 안전 중계
    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return res.status(response.status).send(`KMA_SERVER_RETURNED_HTTP_${response.status}`);
        }

        const buffer = await response.arrayBuffer();

        // 5. 프론트엔드(app.js)에서 한글 깨짐 없이 디코딩하도록 헤더 전달
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'text/plain; charset=euc-kr');
        
        return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        console.error("Vercel KMA Proxy Internal Error:", error);
        return res.status(500).send(`PROXY_FETCH_ERROR: ${error.message}`);
    }
}
