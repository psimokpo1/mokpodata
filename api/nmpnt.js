// api/nmpnt.js
export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 방금 검증 완료된 닷홈 국내 IDC 중계 주소
  const DOWNTIME_RELAY_URL = "http://mokpodata.dothome.co.kr/proxy.php";

  try {
    // 캐시 방지를 위해 타임스탬프 파라미터 추가 호출
    const response = await fetch(`${DOWNTIME_RELAY_URL}?_t=${Date.now()}`);
    
    if (!response.ok) {
      throw new Error(`Dothome HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
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
