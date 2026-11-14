// api/nmpnt.js (측위정보원 시간별 레코드셋 전체 전달 지원)
export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const DOWNTIME_RELAY_URL = "http://mokpodata.dothome.co.kr/proxy.php";

    try {
        const response = await fetch(`${DOWNTIME_RELAY_URL}?_t=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Dothome HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // recordset 전체 배열을 클라이언트로 그대로 전달하여 타임테이블 구성에 활용
        return res.status(200).json(data);
    } catch (err) {
        console.error("NMPNT Proxy Fetch Error:", err);
        return res.status(500).json({
            result: {
                status: "FAIL",
                message: err.message
            }
        });
    }
}
