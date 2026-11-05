export default async function handler(req, res) {
  const { type, authKey } = req.query;

  let targetUrl = "";
  if (type === "buoy") {
    // 4번: 해양 종합 관측자료 (신안 22183, 추자 22184, 칠발 22102, 홍도 22298 등)
    targetUrl = `https://apihub.kma.go.kr/api/typ01/url/sea_obs.php?stn=0&help=0&authKey=${authKey}`;
  } else if (type === "warn") {
    // 11번: 특보현황 조회
    targetUrl = `https://apihub.kma.go.kr/api/typ01/url/wrn_now_data.php?fe=f&disp=1&help=0&authKey=${authKey}`;
  } else if (type === "aws") {
    // 2번: 방재기상관측 AWS (옥도 308, 안좌 771)
    targetUrl = `https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-aws2_min?stn=308:771&disp=0&help=0&authKey=${authKey}`;
  } else if (type === "beacon") {
    // 5번: 등표기상관측 (해수서 등표 959)
    targetUrl = `https://apihub.kma.go.kr/api/typ01/url/kma_lhaws.php?stn=959&help=0&authKey=${authKey}`;
  } else {
    return res.status(400).send("Invalid type");
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Access-Control-Allow-Origin", "*");
    if (type === "warn") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    } else {
      res.setHeader("Content-Type", "text/plain; charset=euc-kr");
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).send(buffer);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).send("API Fetch Error: " + err.message);
  }
}
