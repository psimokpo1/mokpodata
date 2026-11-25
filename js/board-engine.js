// ==========================================
// 3. 선박 통제기준 및 항로·기항지별 맞춤 관측소 매핑 파서
// ==========================================
function parseVesselControlCriteria(rawName, decision, route, notes, ports = '') {
    let fullText = ((rawName || '') + " " + (decision || '') + " " + (notes || '') + " " + (ports || '')).replace(/\s/g, '');
    let r = (route || '').replace(/\s/g, '');
    let p = (ports || '').replace(/\s/g, '');

    let tonnage = 0;
    let tonMatch = (rawName || '').match(/([\d,]+)\s*G\s*\/\s*T/i);
    if (tonMatch) tonnage = parseFloat(tonMatch[1].replace(/,/g, ''));

    let isCaptainOpinion = fullText.includes("선장의견") || fullText.includes("선장협의") || fullText.includes("선장의의견");
    let isOfficeDecision = fullText.includes("진도사무소") || fullText.includes("도초근무자") || fullText.includes("도초사무소") || fullText.includes("하의사무소") || fullText.includes("남강사무소");

    let officeName = null;
    if (fullText.includes("진도사무소")) officeName = "진도파견지";
    else if (fullText.includes("도초근무자") || fullText.includes("도초사무소")) officeName = "도초파견지";
    else if (fullText.includes("하의사무소")) officeName = "하의파견지";

    let windLimit = null;
    let windMatch = fullText.match(/(\d+(?:\.\d+)?)\s*m\/s/i);
    if (windMatch) {
        let parsedW = parseFloat(windMatch[1]);
        if (parsedW >= 5.0) windLimit = parsedW;
    }

    let sigWaveLimit = null;
    let maxWaveLimit = null;

    let sigMatch = fullText.match(/유의파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (sigMatch && parseFloat(sigMatch[1]) >= 1.0) sigWaveLimit = parseFloat(sigMatch[1]);

    let maxMatch = fullText.match(/최대파고[:\s]*(\d+(?:\.\d+)?)\s*m/i);
    if (maxMatch && parseFloat(maxMatch[1]) >= 1.0) maxWaveLimit = parseFloat(maxMatch[1]);

    if (!sigMatch && !maxMatch) {
        let genMatch = fullText.match(/파고[:\s]*(\d+(?:\.\d+)?)\s*m(?!\/s)/i);
        if (genMatch && parseFloat(genMatch[1]) >= 1.0) sigWaveLimit = parseFloat(genMatch[1]);
    }

    let stations = [];
    const addSt = (key) => { if (latestBuoyData[key] && !stations.includes(key)) stations.push(key); };

    if (r.startsWith("목포-") || p.includes("목포")) addSt('목포AWS');
    if (r.includes("진도") || p.includes("진도")) { addSt('진도조위'); addSt('진도파고'); }
    if (r.includes("향화-낙월") || r.includes("낙월") || p.includes("낙월")) { addSt('향화도조위'); addSt('낙월도'); }
    else if (r.includes("향화") || p.includes("향화")) { addSt('향화도조위'); }
    if (r.includes("계마-안마") || r.includes("안마") || p.includes("안마")) { addSt('계마항'); addSt('안마도'); }
    else if (r.includes("계마") || p.includes("계마")) { addSt('계마항'); }
    if (r.includes("증도-자은") || r.includes("자은")) addSt('자은도');
    if (r.includes("송도-병풍")) addSt('지도');
    if (r.includes("송공") || p.includes("송공")) addSt('압해도');
    if (r.includes("가산") || p.includes("가산")) addSt('비금');
    if (p.includes("복호") || fullText.includes("복호")) { addSt('안좌'); addSt('안좌AWS'); }
    else if (fullText.includes("안좌")) { addSt('안좌'); }
    if (r.includes("상태서리") || r.includes("웅곡") || r.includes("하의") || p.includes("웅곡") || p.includes("당두") || p.includes("상태서리")) addSt('하의도');
    if (r.includes("도초-우이") || p.includes("우이")) addSt('우이도조사원');
    if (r.includes("외달") || p.includes("외달")) addSt('외달도');

    const isGageodoVessel = r.includes("가거도") || p.includes("가거도") || fullText.includes("핑크돌핀") || fullText.includes("뉴퀸");
    if (isGageodoVessel) {
        addSt('가거도'); addSt('가거도등대'); addSt('가거초조사원'); addSt('가거도AWS'); addSt('하태도');
    }
    if (r.includes("홍도") || p.includes("홍도")) { addSt('홍도'); addSt('홍도등대'); addSt('홍도AWS'); }
    if (r.includes("흑산") || p.includes("흑산")) { addSt('흑산도'); addSt('흑산도AWS'); }

    if (r.includes("율목") || r.includes("서거차") || r.includes("죽도") || p.includes("율목") || p.includes("서거차")) {
        addSt('조도파고'); addSt('맹골수도파고'); addSt('진도파고'); addSt('해수서파고'); addSt('하조도'); addSt('서거차조위'); addSt('서거차AWS'); addSt('상조도');
    } else if (r.includes("쉬미-가사") || p.includes("창유") || p.includes("조도")) {
        addSt('조도파고'); addSt('진도파고'); addSt('하조도'); addSt('수유AWS');
    }

    if (fullText.includes("옥도")) addSt('옥도');
    if (fullText.includes("신안")) addSt('신안');
    if (fullText.includes("칠발도") || r.includes("홍도") || r.includes("흑산")) addSt('칠발도');
    if (fullText.includes("추자도") || r.includes("제주")) {
        addSt('추자도'); addSt('추자조사원');
        if (r.includes("제주") || p.includes("제주")) addSt('제주항파고');
    }
    if (stations.length === 0) {
        if (fullText.includes("평수") || r.includes("남강") || r.includes("도초") || r.includes("상태")) {
            addSt('신안'); addSt('옥도');
        }
    }

    let relatedSeas = [];
    if (fullText.includes("북쪽안쪽먼바다") || fullText.includes("서해남부북쪽안쪽먼바다")) relatedSeas.push("서해남부북쪽안쪽먼바다");
    if (fullText.includes("남쪽안쪽먼바다") || fullText.includes("서해남부남쪽안쪽먼바다")) relatedSeas.push("서해남부남쪽안쪽먼바다");
    if (fullText.includes("전남중부앞바다") || fullText.includes("전남중부") || fullText.includes("서해남부앞바다(전남중부)")) relatedSeas.push("서해남부앞바다(전남중부)");
    if (fullText.includes("전남남부앞바다") || fullText.includes("전남남부") || fullText.includes("서해남부앞바다(전남남부)")) relatedSeas.push("서해남부앞바다(전남남부)");
    if (fullText.includes("전남북부앞바다") || fullText.includes("전남북부") || fullText.includes("서해남부앞바다(전남북부)")) relatedSeas.push("서해남부앞바다(전남북부)");
    if (fullText.includes("남해서부서쪽먼바다")) relatedSeas.push("남해서부서쪽먼바다");
    if (fullText.includes("제주도북부앞바다")) relatedSeas.push("제주도북부앞바다");

    if (relatedSeas.length === 0) {
        if (r.includes("홍도") || r.includes("흑산")) {
            relatedSeas.push(isGageodoVessel ? "서해남부남쪽안쪽먼바다" : "서해남부북쪽안쪽먼바다", "서해남부앞바다(전남중부)");
        } else if (r.includes("제주")) {
            relatedSeas.push("서해남부앞바다(전남중부)", "서해남부앞바다(전남남부)", "서해남부남쪽안쪽먼바다", "남해서부서쪽먼바다", "제주도북부앞바다");
        } else if (r.includes("안마") || r.includes("계마")) {
            relatedSeas.push("서해남부북쪽안쪽먼바다", "서해남부앞바다(전남북부)");
        } else if (r.includes("향화") || r.includes("낙월") || r.includes("송이")) {
            relatedSeas.push("서해남부앞바다(전남북부)");
        } else if (r.includes("진도") || r.includes("가사") || r.includes("쉬미") || r.includes("율목")) {
            relatedSeas.push("서해남부앞바다(전남남부)", "서해남부남쪽안쪽먼바다");
        } else if (fullText.includes("평수")) {
            relatedSeas.push("서해남부앞바다(전남중부)");
        }
    }

    let isJodoPyungsu = fullText.includes("조도부근평수구역") || fullText.includes("조도부근평수");
    let isYulmokRoute = r.includes("율목") || fullText.includes("목포-율목") || fullText.includes("평수구역으로단축운항");
    let isPyungSuOnly = (fullText.includes("(평수)") && !fullText.includes("연해") && !fullText.includes("먼바다")) || isJodoPyungsu;
    let isJejuMegaShip = (tonnage >= 10000) && (r.includes("제주") || fullText.includes("제주"));
    let hasBypassRoute = fullText.includes("우회항로") || (r.includes("목포") && r.includes("제주"));

    let rawAreaText = ((rawName || '') + " " + (decision || '') + " " + (notes || ''));
    let areaMatch = rawAreaText.match(/\(([^)]*(?:평수|연해|앞바다|먼바다|근해)[^)]*)\)/);
    let navArea = areaMatch ? areaMatch[1].trim() : '';

    if (navArea.includes('핵심') || navArea.includes('통제')) navArea = '평수';
    if (!navArea) {
        let decClean = (decision || '').replace(/\s/g, '');
        if (decClean.includes('평수구역') && !decClean.includes('연해') && !decClean.includes('먼바다')) navArea = '평수';
        else if (decClean.includes('연해') && decClean.includes('먼바다')) navArea = '연해/먼바다';
        else if (decClean.includes('먼바다')) navArea = '먼바다';
        else if (decClean.includes('연해')) navArea = '연해';
    }

    return {
        tonnage, navArea, isCaptainOpinion, isOfficeDecision, officeName,
        stations, windLimit, sigWaveLimit, maxWaveLimit, relatedSeas,
        isPyungSuOnly, isJodoPyungsu, isYulmokRoute, isJejuMegaShip, hasBypassRoute
    };
}

// ==========================================
// 4. 상황판 및 과거 이력 타임테이블 모달
// ==========================================
window.toggleMeteoDetailRow = function(shipCode) {
    const detailRow = document.getElementById(`meteo-detail-${shipCode}`);
    if (!detailRow) return;
    const isShowing = detailRow.style.display !== 'none';
    detailRow.style.display = isShowing ? 'none' : 'table-row';
    const icon = document.getElementById(`meteo-toggle-icon-${shipCode}`);
    if (icon) icon.innerText = isShowing ? '▼' : '▲';
};

function renderWeatherHistoryModalBody(stKey, isLoading = false) {
    const stData = latestBuoyData[stKey];
    const stName = stData ? (stData.name || stKey) : stKey;
    const historyArr = buildContinuousHistoryForModal(stKey);

    const modalEl = document.getElementById('weather-history-modal');
    if (!modalEl) return;

    let isAws = (stData && stData.type === 'aws');
    let isMarineBuoy = (stData && stData.type === 'buoy');
    let isWaveBuoy = (stData && stData.type === 'wavebuoy');
    let isWindOnly = (stData && (stData.type === 'nmpnt' || (stData.sigWave === null && !isAws)));
    let rangeLabel = isAws ? '최근 1시간 (1분 단위)' : '최근 6시간';
    let colSpanCount = isAws ? 5 : (isMarineBuoy ? 7 : (isWindOnly ? 4 : (isWaveBuoy ? 4 : 6)));

    let rowsHtml = '';
    if (isLoading && historyArr.length <= 2) {
        rowsHtml = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding:24px; color:#0284C7; font-weight:bold;">📡 [${stName}] 최근 1시간 1분 단위 실측 이력을 불러오는 중입니다...</td></tr>`;
    } else if (historyArr.length === 0) {
        rowsHtml = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding:24px; color:#94A3B8;">${rangeLabel} 이내 수집된 관측 이력이 없습니다.</td></tr>`;
    } else {
        let sortedList = [...historyArr].sort((a, b) => (b.sortKey || b.time || '').localeCompare(a.sortKey || a.time || ''));
        sortedList.forEach(h => {
            let tStr = h.time || '-';
            let wDir = h.windDir || '-';
            let wSpd = (!isNaN(parseFloat(h.wind)) && h.wind !== '-') ? parseFloat(h.wind).toFixed(1) : '-';
            let gSpd = (!isNaN(parseFloat(h.gust)) && h.gust !== '-') ? parseFloat(h.gust).toFixed(1) : '-';
            let sigW = (!isNaN(parseFloat(h.sigWave)) && h.sigWave !== '-') ? parseFloat(h.sigWave).toFixed(1) : '-';
            let maxW = (!isNaN(parseFloat(h.maxWave)) && h.maxWave !== '-') ? parseFloat(h.maxWave).toFixed(1) : '-';

            if (isAws) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold; color:#D97706;">${gSpd}</td>
                    </tr>
                `;
            } else if (isMarineBuoy) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold; color:#D97706;">${gSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${sigW}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${maxW}</td>
                    </tr>
                `;
            } else if (isWindOnly) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                    </tr>
                `;
            } else if (isWaveBuoy) {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${sigW}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${maxW}</td>
                    </tr>
                `;
            } else {
                rowsHtml += `
                    <tr>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${tStr}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${stName}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${wDir}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold;">${wSpd}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${sigW}</td>
                        <td style="padding:8px; border-bottom:1px solid #E2E8F0; text-align:center;">${maxW}</td>
                    </tr>
                `;
            }
        });
    }

    let headerCols = '';
    if (isAws) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">평균풍속(m/s)</th><th style="padding:10px; background:#FEF3C7; color:#92400E; border-bottom:2px solid #CBD5E1;">순간바람(m/s)</th>`;
    } else if (isMarineBuoy) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th><th style="padding:10px; background:#FEF3C7; color:#92400E; border-bottom:2px solid #CBD5E1;">순간풍속(m/s)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;
    } else if (isWindOnly) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th>`;
    } else if (isWaveBuoy) {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;
    } else {
        headerCols = `<th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">시간</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">관측소</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍향</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">풍속(m/s)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">유의파고(m)</th><th style="padding:10px; background:#F8FAFC; border-bottom:2px solid #CBD5E1;">최대파고(m)</th>`;
    }

    modalEl.innerHTML = `
        <div style="background:#fff; width:680px; max-width:95vw; max-height:85vh; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.25); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:15px 20px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:15.5px;">📈 [${stName}] ${rangeLabel} 기상 관측 이력 (${historyArr.length}건)</h3>
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
            </div>
            <div style="padding:18px; overflow-y:auto; flex:1;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; color:#334155;">
                    <thead><tr>${headerCols}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="padding:12px 20px; background:#F1F5F9; text-align:right; border-top:1px solid #E2E8F0;">
                <button onclick="document.getElementById('weather-history-modal').style.display='none'" style="padding:6px 16px; background:#475569; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">닫기</button>
            </div>
        </div>
    `;
    modalEl.style.display = 'flex';
}

window.openWeatherHistoryModal = async function(stKey) {
    const stData = latestBuoyData[stKey];
    let modalEl = document.getElementById('weather-history-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'weather-history-modal';
        modalEl.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;';
        document.body.appendChild(modalEl);
    }

    const isAws = (stData && stData.type === 'aws' && stData.stnId);
    renderWeatherHistoryModalBody(stKey, isAws);

    if (isAws) {
        try {
            let authKey = localStorage.getItem("kma_apihub_authkey") || DEFAULT_KMA_AUTHKEY;
            const textAwsSingle = await fetchKmaApi("aws", authKey, 10000, `&stn=${encodeURIComponent(stData.stnId)}`);
            if (textAwsSingle) {
                parseAwsTextData(textAwsSingle);
                saveStationHistoryCache();
            }
        } catch (e) {}
        renderWeatherHistoryModalBody(stKey, false);
    }
};

function buildMeteoSubTableHtml(parsed, shipName, routeName) {
    if (!parsed.stations || parsed.stations.length === 0) {
        return `<div style="text-align:center; padding:12px; color:#94A3B8;">연계된 관측소 정보가 없습니다. (선장 또는 파견지 협의 항로)</div>`;
    }

    let rowsHtml = '';
    const wLimit = parsed.windLimit || 12.0;

    parsed.stations.forEach(stKey => {
        const stData = latestBuoyData[stKey];
        if (!stData) return;

        let agencyBadge = '';
        if (stData.type === 'buoy') agencyBadge = '<span style="background:#E0F2FE; color:#0369A1; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 부이</span>';
        else if (stData.type === 'wavebuoy') agencyBadge = '<span style="background:#DBEAFE; color:#1E40AF; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">파고부이</span>';
        else if (stData.type === 'aws') agencyBadge = '<span style="background:#CCFBF1; color:#0F766E; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 AWS</span>';
        else if (stData.type === 'beacon') agencyBadge = '<span style="background:#EDE9FE; color:#6D28D9; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">기상청 등표</span>';
        else if (stData.type === 'nmpnt') agencyBadge = '<span style="background:#EFF6FF; color:#1D4ED8; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">측위정보원</span>';
        else if (stData.type === 'khoa') agencyBadge = '<span style="background:#ECFDF5; color:#047857; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:10.5px;">해양조사원</span>';

        const windVal = parseFloat(stData.wind);
        const gustVal = parseFloat(stData.gust);
        const hasWind = (stData.wind !== null && stData.wind !== '-' && !isNaN(windVal));
        const hasGust = ((stData.type === 'aws' || stData.type === 'buoy') && stData.gust !== null && stData.gust !== '-' && !isNaN(gustVal));

        let windStyle = '';
        if (hasWind) {
            if (windVal >= wLimit) windStyle = 'color:#DC2626; font-weight:bold; background:#FEE2E2;';
            else if (windVal >= wLimit * 0.85 || (hasGust && gustVal >= wLimit * 0.85)) windStyle = 'color:#D97706; font-weight:bold; background:#FEF3C7;';
        }

        const sigVal = parseFloat(stData.sigWave);
        const maxVal = parseFloat(stData.maxWave);
        let waveStr = '-';
        if (stData.sigWave === null) waveStr = '<span style="color:#94A3B8;">풍속 전용</span>';
        else if (!isNaN(sigVal) && !isNaN(maxVal)) waveStr = `유의 ${sigVal.toFixed(1)}m / 최대 ${maxVal.toFixed(1)}m`;
        else if (!isNaN(sigVal)) waveStr = `유의 ${sigVal.toFixed(1)}m`;

        let windDisplay = '<span style="color:#94A3B8;">수신대기</span>';
        if (stData.type === 'wavebuoy') {
            windDisplay = '<span style="color:#94A3B8;">파고 전용</span>';
        } else if (hasWind) {
            windDisplay = `${windVal.toFixed(1)} m/s (${stData.windDir || '-'})`;
            if (hasGust) windDisplay += ` <span style="color:#D97706; font-weight:bold;">[순간 ${gustVal.toFixed(1)}m/s]</span>`;
        }

        rowsHtml += `
            <tr>
                <td>${agencyBadge}</td>
                <td><strong style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="openWeatherHistoryModal('${stKey}')" title="클릭 시 '${stData.name || stKey}' 과거 이력 조회">${stData.name || stKey}</strong></td>
                <td style="${windStyle}">${windDisplay}</td>
                <td>${waveStr}</td>
                <td><span style="color:#059669; font-weight:bold;">실시간 연동</span></td>
            </tr>
        `;
    });

    return `
        <div class="meteo-detail-container">
            <div class="meteo-detail-header">
                <span>📊 [${routeName}] ${shipName} — 연계 관측소 실시간 관측 상세 테이블 (관측소명 클릭 시 과거 이력 조회)</span>
                <span style="font-size:11.5px; color:#64748B; font-weight:normal;">선박 통제기준: 풍속 ${wLimit}m/s ${parsed.sigWaveLimit ? '/ 유의파고 ' + parsed.sigWaveLimit + 'm' : ''}</span>
            </div>
            <table class="meteo-sub-table">
                <thead>
                    <tr>
                        <th style="width: 16%;">관측 기관</th>
                        <th style="width: 22%;">관측소명 (클릭 조회)</th>
                        <th style="width: 28%;">풍향 / 풍속 (순간바람)</th>
                        <th style="width: 22%;">파고 (유의/최대)</th>
                        <th style="width: 12%;">상태</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function buildNavAreaBadgeHtml(navArea) {
    if (!navArea) return '';
    let isPyung = navArea.includes('평수') && !navArea.includes('연해') && !navArea.includes('먼바다') && !navArea.includes('앞바다');
    let badgeStyle = isPyung
        ? 'color:#0284C7; background:#E0F2FE; border:1px solid #BAE6FD;'
        : 'color:#4338CA; background:#EEF2FF; border:1px solid #C7D2FE;';
    return ` <span style="font-size:11px; font-weight:600; padding:1px 5px; border-radius:4px; ${badgeStyle}">(${navArea})</span>`;
}

let boardSearchQuery = '';

window.handleBoardSearchInput = function(val) {
    boardSearchQuery = (val || '').toLowerCase().replace(/\s+/g, '');
    renderOperationBoard();
};

window.handleBoardShipNameClick = function(event, shipCode) {
    if (event) event.stopPropagation();
    if (typeof window.navigateToVesselDetail === 'function') {
        window.navigateToVesselDetail(shipCode);
    }
};

function renderOperationBoard() {
    const tbody = document.getElementById('board-tbody');
    const mobileContainer = document.getElementById('board-mobile-cards');
    if (!tbody || !mobileContainer) return;

    let allShipsMap = {};
    if (typeof baseShipData !== 'undefined') {
        baseShipData.forEach((d, idx) => {
            let code = (d[1] || `idx_${idx}`).trim();
            let override = cloudCustomData[code] || {};
            allShipsMap[code] = {
                code: code,
                rawName: override.rawName !== undefined ? override.rawName : d[0],
                route: override.route !== undefined ? override.route : d[2],
                ports: override.ports !== undefined ? override.ports : d[4],
                decision: override.decision !== undefined ? override.decision : d[7],
                notes: override.notes !== undefined ? override.notes : d[5],
                deployedTarget: override.deployedTarget ? String(override.deployedTarget).trim() : null,
                isHidden: !!override.isHidden,
                isDeleted: !!override.isDeleted
            };
        });
    }

    customAddedShips.forEach(s => {
        let code = String(s.id).trim();
        allShipsMap[code] = {
            code: code,
            rawName: s.rawName || '신규선박',
            route: s.route || '기타항로',
            ports: s.ports || '',
            decision: s.decision || '-',
            notes: s.notes || '',
            deployedTarget: s.deployedTarget ? String(s.deployedTarget).trim() : null,
            isHidden: !!s.isHidden,
            isDeleted: !!s.isDeleted
        };
    });

    let deployedMap = {};
    for (let c in allShipsMap) {
        let s = allShipsMap[c];
        if (!s.isDeleted && s.deployedTarget) deployedMap[s.deployedTarget] = s;
    }

    let displayList = [];
    for (let c in allShipsMap) {
        let s = allShipsMap[c];
        if (s.isDeleted) continue;
        let isOriginalReserve = (s.route || '').trim() === '예비선';
        let isDeployedReserve = isOriginalReserve && !!s.deployedTarget;
        if (isOriginalReserve && !isDeployedReserve) continue;
        if (s.isHidden && !isDeployedReserve) continue;
        displayList.push(s);
    }

    displayList.sort((a, b) => {
        let aTarget = a.deployedTarget ? allShipsMap[a.deployedTarget] : null;
        let bTarget = b.deployedTarget ? allShipsMap[b.deployedTarget] : null;
        let aRoute = aTarget ? aTarget.route : a.route;
        let bRoute = bTarget ? bTarget.route : b.route;
        return (aRoute || '').localeCompare(bRoute || '', 'ko');
    });

    let countTotal = displayList.length;
    let countOk = 0;
    let countWarn = 0;
    let countDanger = 0;
    let countSpecial = 0;

    let rowsHtml = "";
    let mobileHtml = "";

    displayList.forEach(ship => {
        try {
            let cleanName = (ship.rawName || '').split('(')[0].split('\n')[0].trim();
            let isOriginalReserve = (ship.route || '').trim() === '예비선';
            let isDeployedReserve = isOriginalReserve && !!ship.deployedTarget;
            let targetShip = isDeployedReserve ? allShipsMap[ship.deployedTarget] : null;
            let isRestingBySub = !!deployedMap[ship.code];
            let substituteShip = isRestingBySub ? deployedMap[ship.code] : null;

            let ownParsed = parseVesselControlCriteria(ship.rawName, ship.decision, ship.route, ship.notes, ship.ports);
            let parsed = ownParsed;
            let effectiveRoute = ship.route;

            if (isDeployedReserve && targetShip) {
                let targetParsed = parseVesselControlCriteria(targetShip.rawName, targetShip.decision, targetShip.route, targetShip.notes, targetShip.ports);
                effectiveRoute = targetShip.route;
                parsed = {
                    tonnage: ownParsed.tonnage,
                    navArea: targetParsed.navArea || ownParsed.navArea,
                    isCaptainOpinion: targetParsed.isCaptainOpinion,
                    isOfficeDecision: targetParsed.isOfficeDecision,
                    officeName: targetParsed.officeName,
                    stations: targetParsed.stations,
                    windLimit: targetParsed.windLimit,
                    sigWaveLimit: targetParsed.sigWaveLimit,
                    maxWaveLimit: targetParsed.maxWaveLimit,
                    relatedSeas: targetParsed.relatedSeas,
                    isPyungSuOnly: targetParsed.isPyungSuOnly,
                    isJodoPyungsu: targetParsed.isJodoPyungsu,
                    isYulmokRoute: targetParsed.isYulmokRoute,
                    isJejuMegaShip: false,
                    hasBypassRoute: targetParsed.hasBypassRoute
                };
            }

            let areaBadgeHtml = buildNavAreaBadgeHtml(parsed.navArea);
            let tonnageText = ownParsed.tonnage ? `${ownParsed.tonnage.toLocaleString()}G/T` : '-';

            if (isRestingBySub && !ship.isHidden) {
                let subCleanName = (substituteShip.rawName || '').split('(')[0].split('\n')[0].trim();
                rowsHtml += `
                    <tr class="resting-row">
                        <td><strong>${ship.route}</strong>${areaBadgeHtml}</td>
                        <td><strong style="color:#0284C7; text-decoration:underline; cursor:pointer;" onclick="handleBoardShipNameClick(event, '${ship.code}')">${cleanName}</strong> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></td>
                        <td colspan="3" style="text-align:center; color:#64748B;">대체선 [${subCleanName}] 투입에 따른 운항정지 및 정비</td>
                        <td><span class="status-badge badge-off">⚪ 휴항/정비 (${subCleanName} 대선)</span></td>
                        <td style="color:#94A3B8;">-</td>
                    </tr>
                `;
                return;
            }

            let activeWarningItems = [];
            let hasRealIssuedWarning = false;
            let hasPreWarning = false;
            let hasGaleGyeongbo = false;
            let isUsingBypassRoute = false;

            if (parsed.relatedSeas && parsed.relatedSeas.length > 0) {
                for (let sea of parsed.relatedSeas) {
                    let alertType = activeSeaWarnings[sea];
                    if (alertType) {
                        activeWarningItems.push({ sea: sea, alert: alertType });
                        if (alertType.includes('예비') || alertType.includes('예정')) {
                            hasPreWarning = true;
                        } else {
                            hasRealIssuedWarning = true;
                            if (alertType.includes('경보')) {
                                if (parsed.hasBypassRoute && (sea === '서해남부남쪽안쪽먼바다' || sea === '남해서부서쪽먼바다')) {
                                    const westSouthAlert = activeSeaWarnings['서해남부남쪽안쪽먼바다'] || '';
                                    const southWestAlert = activeSeaWarnings['남해서부서쪽먼바다'] || '';
                                    if (westSouthAlert.includes('경보') && southWestAlert.includes('경보')) {
                                        hasGaleGyeongbo = true;
                                    } else {
                                        isUsingBypassRoute = true;
                                    }
                                } else {
                                    hasGaleGyeongbo = true;
                                }
                            }
                        }
                    }
                }
            }

            let status = 'ok';
            let statusBadge = '';
            let currentDisplay = '';
            let criteriaDisplay = '';
            let pointDisplay = '';

            let isAutoControlledByWarning = false;
            if (hasRealIssuedWarning && parsed.tonnage < 2000 && !parsed.isPyungSuOnly && !parsed.isYulmokRoute) isAutoControlledByWarning = true;

            let wLimit = (parsed.windLimit && parsed.windLimit >= 5.0) ? parsed.windLimit : 12.0;
            let sigLimit = (parsed.sigWaveLimit && parsed.sigWaveLimit >= 1.0) ? parsed.sigWaveLimit : 2.0;
            let maxLimit = (parsed.maxWaveLimit && parsed.maxWaveLimit >= 1.0) ? parsed.maxWaveLimit : 3.0;

            let isAnyWindDanger = false;
            let isAnyWindWarn = false;
            let isAnyWaveDanger = false;
            let isAnyWaveWarn = false;

            if (parsed.stations && parsed.stations.length > 0) {
                let stationPoints = [];
                let stationRenders = [];

                parsed.stations.forEach(stKey => {
                    let stData = latestBuoyData[stKey];
                    if (!stData) return;

                    let stTitle = stData.name || stKey;
                    let isAws = (stData.type === 'aws');
                    let isWaveBuoy = (stData.type === 'wavebuoy');
                    let isBeacon = (stData.type === 'beacon');
                    let isNmpnt = (stData.type === 'nmpnt');
                    let isKhoa = (stData.type === 'khoa');
                    let isTideOnlyWind = (stData.sigWave === null);

                    let windVal = Number(stData.wind);
                    let gustVal = Number(stData.gust);
                    let hasRealWind = (!isWaveBuoy && stData.wind !== '-' && stData.wind !== null && !isNaN(windVal) && windVal >= 0 && windVal < 100);
                    let hasRealGust = ((isAws || stData.type === 'buoy') && stData.gust !== '-' && stData.gust !== null && !isNaN(gustVal) && gustVal >= 0 && gustVal < 120);

                    if (hasRealWind && (windVal >= wLimit)) isAnyWindDanger = true;
                    else if (hasRealWind && (windVal >= (wLimit * 0.85))) isAnyWindWarn = true;

                    if (hasRealGust && (gustVal >= wLimit)) {
                        if (!isAnyWindDanger) isAnyWindWarn = true;
                    } else if (hasRealGust && (gustVal >= (wLimit * 0.85))) {
                        if (!isAnyWindDanger) isAnyWindWarn = true;
                    }

                    let sigVal = Number(stData.sigWave);
                    let maxVal = Number(stData.maxWave);
                    let hasRealSig = (stData.sigWave !== '-' && stData.sigWave !== null && !isNaN(sigVal) && sigVal >= 0 && sigVal <= 20);
                    let hasRealMax = (stData.maxWave !== '-' && stData.maxWave !== null && !isNaN(maxVal) && maxVal >= 0 && maxVal <= 20 && (!hasRealSig || maxVal >= sigVal));

                    if (!isAws && !isNmpnt && !isTideOnlyWind) {
                        if (hasRealSig && sigVal >= sigLimit) isAnyWaveDanger = true;
                        else if (hasRealSig && sigVal >= (sigLimit * 0.85)) isAnyWaveWarn = true;

                        if (parsed.maxWaveLimit && hasRealMax && maxVal >= maxLimit) isAnyWaveDanger = true;
                    }

                    let windText = hasRealWind ? `${windVal.toFixed(1)}m/s (${stData.windDir || '-'})` : `<span style="color:#94A3B8;">수신대기</span>`;
                    if (hasRealWind && hasRealGust) {
                        windText += ` <span style="color:#D97706; font-weight:bold;">(순간 ${gustVal.toFixed(1)}m/s)</span>`;
                    }

                    let waveText = `<span style="color:#94A3B8;">수신대기</span>`;
                    if (hasRealSig && hasRealMax) waveText = `유의 ${sigVal.toFixed(1)}m (최대 ${maxVal.toFixed(1)}m)`;
                    else if (hasRealSig) waveText = `유의 ${sigVal.toFixed(1)}m`;

                    let clickableTitle = `<span style="cursor:pointer; color:#0284C7; text-decoration:underline;" onclick="event.stopPropagation(); openWeatherHistoryModal('${stKey}')" title="클릭 시 '${stTitle}' 과거 이력 조회">${stTitle}</span>`;

                    if (isWaveBuoy) {
                        stationPoints.push(`🌊 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 파고: ${waveText}</div>`);
                    } else if (isKhoa) {
                        stationPoints.push(`🌊 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}${!isTideOnlyWind ? ' / 파고: ' + waveText : ''}</div>`);
                    } else if (isNmpnt) {
                        stationPoints.push(`🏢 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}</div>`);
                    } else if (isAws) {
                        stationPoints.push(`📡 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}</div>`);
                    } else if (isBeacon) {
                        stationPoints.push(`🗼 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText}${hasRealSig ? ' / 파고: ' + waveText : ''}</div>`);
                    } else {
                        stationPoints.push(`📍 ${clickableTitle}`);
                        stationRenders.push(`<div style="margin-bottom:3px;"><span style="font-size:11px;">[${clickableTitle}]</span> 풍속: ${windText} / 파고: ${waveText}</div>`);
                    }
                });

                pointDisplay = stationPoints.join('<br>');
                currentDisplay = stationRenders.join('');
                criteriaDisplay = `풍속 ${wLimit}m/s<br>${parsed.sigWaveLimit ? '유의 ' + parsed.sigWaveLimit + 'm' : '파고 2.0m'}`;
            }

            if (parsed.tonnage >= 2000) {
                if (hasGaleGyeongbo || isAnyWindDanger || isAnyWaveDanger) {
                    status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++;
                } else if (isAnyWindWarn || isAnyWaveWarn) {
                    status = 'warn'; statusBadge = '<span class="status-badge badge-warn">🟡 통제주의</span>'; countWarn++;
                } else if (isUsingBypassRoute) {
                    status = 'ok'; statusBadge = '<span class="status-badge badge-ok">🟢 정상 (우회항로 가능)</span>'; countOk++;
                } else {
                    status = 'ok'; statusBadge = '<span class="status-badge badge-ok">🟢 정상 (2,000G/T 이상)</span>'; countOk++;
                }
            } else if (isAutoControlledByWarning) {
                status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 자동통제(특보발효)</span>'; countDanger++;
            } else if (parsed.isYulmokRoute) {
                if (isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn || hasPreWarning) { status = 'warn'; statusBadge = `<span class="status-badge badge-warn">🟡 평수단축운항</span>`; countWarn++; }
                else { status = 'ok'; statusBadge = `<span class="status-badge badge-ok">🟢 정상</span>`; countOk++; }
            } else if (parsed.isPyungSuOnly) {
                if (isAnyWindDanger || isAnyWaveDanger) { status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++; }
                else if (isAnyWindWarn || isAnyWaveWarn || hasPreWarning) {
                    status = 'warn';
                    statusBadge = parsed.isCaptainOpinion
                        ? '<span class="status-badge badge-warn">🟡 통제주의(선장협의)</span>'
                        : '<span class="status-badge badge-warn">🟡 통제주의</span>';
                    countWarn++;
                } else {
                    status = 'ok';
                    statusBadge = `<span class="status-badge badge-ok">🟢 정상 (평수)</span>`;
                    countOk++;
                }
            } else if (parsed.stations && parsed.stations.length > 0) {
                if (isAnyWindDanger || isAnyWaveDanger) {
                    status = 'danger'; statusBadge = '<span class="status-badge badge-danger">🔴 통제위험</span>'; countDanger++;
                } else if (isAnyWindWarn || isAnyWaveWarn || hasPreWarning) {
                    status = 'warn';
                    statusBadge = parsed.isCaptainOpinion
                        ? '<span class="status-badge badge-warn">🟡 통제주의(선장협의)</span>'
                        : '<span class="status-badge badge-warn">🟡 통제주의(예비/근접)</span>';
                    countWarn++;
                } else {
                    status = 'ok';
                    statusBadge = '<span class="status-badge badge-ok">🟢 정상</span>';
                    countOk++;
                }
            } else if (parsed.isCaptainOpinion) {
                status = 'captain'; statusBadge = '<span class="status-badge badge-captain">🔵 선장협의</span>'; countSpecial++;
            } else if (parsed.isOfficeDecision) {
                status = 'office'; statusBadge = '<span class="status-badge badge-office">🏢 파견지결정</span>'; countSpecial++;
            } else {
                status = 'office'; statusBadge = '<span class="status-badge badge-office">운항확인</span>'; countSpecial++;
            }

            let warningCellHtml = '<span style="color:#94A3B8; font-weight:bold;">-</span>';
            if (activeWarningItems.length > 0) {
                warningCellHtml = activeWarningItems.map(w => {
                    let isAdv = w.alert.includes('예비') || w.alert.includes('예정');
                    return `<span class="warn-alert-badge ${isAdv ? 'warning-adv' : ''}">🚨 ${w.sea} ${w.alert}</span>`;
                }).join('<br>');
            }

            let isFiltered = false;
            if (boardFilterMode === 'danger' && status !== 'danger') isFiltered = true;
            if (boardFilterMode === 'warn_danger' && (status !== 'warn' && status !== 'danger')) isFiltered = true;
            if (boardFilterMode === 'special' && (status !== 'captain' && status !== 'office')) isFiltered = true;
            if (boardFilterMode === 'ok' && status !== 'ok') isFiltered = true;

            if (!isFiltered && boardSearchQuery) {
                let stNames = (parsed.stations || [])
                    .map(k => (latestBuoyData[k] && latestBuoyData[k].name) ? latestBuoyData[k].name : k)
                    .join(' ');
                let warnNames = activeWarningItems.map(w => `${w.sea} ${w.alert}`).join(' ');
                let searchableText = `${effectiveRoute} ${parsed.navArea || ''} ${cleanName} ${ship.rawName || ''} ${ship.ports || ''} ${ship.notes || ''} ${stNames} ${warnNames}`
                    .toLowerCase()
                    .replace(/\s+/g, '');
                if (!searchableText.includes(boardSearchQuery)) {
                    isFiltered = true;
                }
            }

            if (!isFiltered) {
                rowsHtml += `
                    <tr id="ship-row-${ship.code}">
                        <td><strong>${effectiveRoute}</strong>${areaBadgeHtml}</td>
                        <td><strong style="color:#0284C7; text-decoration:underline; cursor:pointer;" onclick="handleBoardShipNameClick(event, '${ship.code}')" title="클릭 시 [${cleanName}] 기초자료로 이동">${cleanName}</strong> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></td>
                        <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')" title="클릭 시 관측 상세 테이블이 펼쳐집니다.">
                            ${pointDisplay || '-'} <span class="meteo-expand-indicator" id="meteo-toggle-icon-${ship.code}">▼</span>
                        </td>
                        <td class="clickable-meteo-cell" onclick="toggleMeteoDetailRow('${ship.code}')" title="클릭 시 관측 상세 테이블이 펼쳐집니다.">
                            ${currentDisplay || '-'}
                        </td>
                        <td style="color:#475569;">${criteriaDisplay || '-'}</td>
                        <td>${statusBadge}</td>
                        <td>${warningCellHtml}</td>
                    </tr>
                    <tr id="meteo-detail-${ship.code}" class="meteo-detail-row" style="display: none;">
                        <td colspan="7" style="padding: 0;">
                            ${buildMeteoSubTableHtml(parsed, cleanName, effectiveRoute)}
                        </td>
                    </tr>
                `;

                mobileHtml += `
                    <div style="background:#fff; border:1px solid #E2E8F0; border-radius:8px; padding:12px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="font-weight:bold; color:#1E293B;">[${effectiveRoute}${parsed.navArea ? ' (' + parsed.navArea + ')' : ''}] <span style="color:#0284C7; text-decoration:underline; cursor:pointer;" onclick="handleBoardShipNameClick(event, '${ship.code}')">${cleanName}</span> <span style="font-size:11px; color:#64748B;">(${tonnageText})</span></div>
                            <div>${statusBadge}</div>
                        </div>
                        <div style="font-size:12px; color:#334155; margin-bottom:4px;">${currentDisplay || '관측소 연계 없음'}</div>
                        <div style="font-size:11.5px; color:#64748B;">기준: 풍속 ${wLimit}m/s / ${parsed.sigWaveLimit ? '유의 ' + parsed.sigWaveLimit + 'm' : '파고 2.0m'}</div>
                    </div>
                `;
            }
        } catch (errInner) {
            console.error("선박 렌더링 예외:", errInner);
        }
    });

    const sumTotalEl = document.getElementById('sum-total');
    const sumOkEl = document.getElementById('sum-ok');
    const sumWarnEl = document.getElementById('sum-warn');
    const sumDangerEl = document.getElementById('sum-danger');
    const sumSpecialEl = document.getElementById('sum-special');

    if (sumTotalEl) sumTotalEl.innerText = countTotal;
    if (sumOkEl) sumOkEl.innerText = countOk;
    if (sumWarnEl) sumWarnEl.innerText = countWarn;
    if (sumDangerEl) sumDangerEl.innerText = countDanger;
    if (sumSpecialEl) sumSpecialEl.innerText = countSpecial;

    tbody.innerHTML = rowsHtml || `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94A3B8;">해당 조건에 일치하는 선박이 없습니다.</td></tr>`;
    mobileContainer.innerHTML = mobileHtml || `<div style="text-align:center; padding:20px; color:#94A3B8;">표출할 선박이 없습니다.</div>`;
}

window.filterBoard = (mode, btnEl) => {
    boardFilterMode = mode;
    document.querySelectorAll('.board-filter-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderOperationBoard();
};
