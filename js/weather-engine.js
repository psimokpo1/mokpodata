// ==========================================
// 5. 기상특보 파싱 및 통신 엔진
// ==========================================
function setSeaWarningByLatestFc(seaKey, alertType, fcTimeNum) {
    let prevFc = seaWarningTimestamps[seaKey] || 0;
    if (fcTimeNum >= prevFc) {
        activeSeaWarnings[seaKey] = alertType;
        seaWarningTimestamps[seaKey] = fcTimeNum;
    }
}

function parseKmaWarnRecords(rawText) {
    if (!rawText) return [];
    const lines = rawText.split('\n');
    const records = [];

    lines.forEach(line => {
        const l = line.trim();
        if (!l || l.startsWith('#')) return;
        const cols = l.split(',').map(c => c.trim());
        if (cols.length >= 8) {
            const cmd = cols[8] || '';
            if (cmd.includes('해제') || cmd === '3') return;
            records.push({
                regUpKo: cols[1] || '',
                regId: cols[2] || '',
                regKo: cols[3] || '',
                tmFc: cols[4] || '',
                tmEf: cols[5] || '',
                wrn: cols[6] || '',
                lvl: cols[7] || '',
                cmd: cmd,
                endTime: cols[9] || cols[10] || ''
            });
        }
    });
    return records;
}

function parseWeatherWarnings(rawText) {
    if (!rawText || rawText.includes('AUTH_ERROR') || rawText.includes('SERVICE_ERROR') || rawText.includes('"status" : 401')) return;
    latestRawWarnText = rawText;

    for (let k in activeSeaWarnings) {
        activeSeaWarnings[k] = null;
        seaWarningTimestamps[k] = 0;
    }

    const nowMs = Date.now();
    let maxFcStr = "";
    let maxEfStr = "";

    const csvRecords = parseKmaWarnRecords(rawText);
    if (csvRecords.length > 0) {
        csvRecords.forEach(rec => {
            const regUpKo = rec.regUpKo.replace(/\s/g, '');
            const regKo = rec.regKo.replace(/\s/g, '');
            const fullReg = regUpKo + regKo;
            const wrn = rec.wrn.replace(/\s/g, '');
            const lvl = rec.lvl.replace(/\s/g, '');
            const cmd = rec.cmd.replace(/\s/g, '');
            const tmEfStr = rec.tmEf.replace(/\D/g, '');
            const fcDigits = rec.tmFc.replace(/\D/g, '').substring(0, 12);
            const efDigits = tmEfStr.substring(0, 12);
            const fcTimeNum = parseInt(fcDigits || '0', 10) || 0;

            if (fcDigits.length >= 12 && fcDigits >= maxFcStr) {
                maxFcStr = fcDigits;
                if (efDigits.length >= 12) maxEfStr = efDigits;
            }

            if (!wrn.includes('풍랑') && !wrn.includes('해상')) return;

            let tmEfMs = 0;
            let efHourStr = "15:00";
            if (tmEfStr.length >= 10) {
                let y = parseInt(tmEfStr.substring(0, 4), 10);
                let m = parseInt(tmEfStr.substring(4, 6), 10) - 1;
                let d = parseInt(tmEfStr.substring(6, 8), 10);
                let h = parseInt(tmEfStr.substring(8, 10), 10);
                let min = tmEfStr.length >= 12 ? parseInt(tmEfStr.substring(10, 12), 10) : 0;
                tmEfMs = new Date(y, m, d, h, min, 0).getTime();
                efHourStr = `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
            }

            let alertType = '풍랑예비특보';
            let isPurePreWarning = lvl.includes('예비') || cmd === '2' || wrn.includes('예비') || regKo.includes('예비');

            if (isPurePreWarning) alertType = '풍랑예비특보';
            else {
                let isGyeongbo = lvl.includes('경보');
                let baseName = isGyeongbo ? '풍랑경보' : '풍랑주의보';
                if (tmEfMs > 0 && nowMs < tmEfMs) alertType = `${baseName}(발효예정 ${efHourStr})`;
                else if (tmEfMs > 0 && nowMs >= tmEfMs) alertType = `${baseName}(발효중)`;
                else alertType = `${baseName}(발효중)`;
            }

            if (fullReg.includes('서해남부') && regKo.includes('전남북부')) {
                setSeaWarningByLatestFc('서해남부앞바다(전남북부)', alertType, fcTimeNum);
            } else if (fullReg.includes('서해남부') && regKo.includes('전남중부')) {
                setSeaWarningByLatestFc('서해남부앞바다(전남중부)', alertType, fcTimeNum);
            } else if (fullReg.includes('서해남부') && regKo.includes('전남남부')) {
                setSeaWarningByLatestFc('서해남부앞바다(전남남부)', alertType, fcTimeNum);
            } else if (fullReg.includes('서해남부') && regKo.includes('북쪽안쪽먼바다')) {
                setSeaWarningByLatestFc('서해남부북쪽안쪽먼바다', alertType, fcTimeNum);
            } else if (fullReg.includes('서해남부') && (regKo.includes('남쪽안쪽먼바다') || regKo.includes('남쪽바깥먼바다'))) {
                setSeaWarningByLatestFc('서해남부남쪽안쪽먼바다', alertType, fcTimeNum);
            } else if (fullReg.includes('남해서부') && regKo.includes('서쪽먼바다')) {
                setSeaWarningByLatestFc('남해서부서쪽먼바다', alertType, fcTimeNum);
            } else if (fullReg.includes('제주도') && regKo.includes('북부앞바다')) {
                setSeaWarningByLatestFc('제주도북부앞바다', alertType, fcTimeNum);
            }
        });
        if (maxFcStr) latestWarnTmFc = maxFcStr;
        if (maxEfStr) latestWarnTmEf = maxEfStr;
        return;
    }

    try {
        let data = JSON.parse(rawText);
        let items = Array.isArray(data) ? data : (data.items || data.result || []);
        items.forEach(item => {
            let regUpKo = String(item.REG_UP_KO || '').replace(/\s/g, '');
            let regKo = String(item.REG_KO || item.REG_NAME || '').replace(/\s/g, '');
            let fullReg = regUpKo + regKo;
            let wrn = String(item.WRN || '').replace(/\s/g, '');
            let lvl = String(item.LVL || '').replace(/\s/g, '');
            let cmd = String(item.CMD || '').replace(/\s/g, '');
            let fcDigits = String(item.TM_FC || '0').replace(/\D/g, '').substring(0, 12);
            let efDigits = String(item.TM_EF || '0').replace(/\D/g, '').substring(0, 12);
            let fcTimeNum = parseInt(fcDigits, 10) || 0;
            if (fcDigits.length >= 12 && fcDigits >= maxFcStr) {
                maxFcStr = fcDigits;
                if (efDigits.length >= 12) maxEfStr = efDigits;
            }
            if (cmd.includes('해제') || cmd === '3') return;
            if (!wrn.includes('풍랑') && !wrn.includes('해상')) return;

            let alertType = lvl.includes('예비') ? '풍랑예비특보' : (lvl.includes('경보') ? '풍랑경보(발효중)' : '풍랑주의보(발효중)');
            if (fullReg.includes('서해남부') && regKo.includes('전남북부')) setSeaWarningByLatestFc('서해남부앞바다(전남북부)', alertType, fcTimeNum);
            else if (fullReg.includes('서해남부') && regKo.includes('전남중부')) setSeaWarningByLatestFc('서해남부앞바다(전남중부)', alertType, fcTimeNum);
            else if (fullReg.includes('서해남부') && regKo.includes('전남남부')) setSeaWarningByLatestFc('서해남부앞바다(전남남부)', alertType, fcTimeNum);
            else if (fullReg.includes('서해남부') && regKo.includes('북쪽안쪽먼바다')) setSeaWarningByLatestFc('서해남부북쪽안쪽먼바다', alertType, fcTimeNum);
            else if (fullReg.includes('서해남부') && regKo.includes('남쪽안쪽먼바다')) setSeaWarningByLatestFc('서해남부남쪽안쪽먼바다', alertType, fcTimeNum);
            else if (fullReg.includes('남해서부') && regKo.includes('서쪽먼바다')) setSeaWarningByLatestFc('남해서부서쪽먼바다', alertType, fcTimeNum);
            else if (fullReg.includes('제주도') && regKo.includes('북부앞바다')) setSeaWarningByLatestFc('제주도북부앞바다', alertType, fcTimeNum);
        });
        if (maxFcStr) latestWarnTmFc = maxFcStr;
        if (maxEfStr) latestWarnTmEf = maxEfStr;
    } catch (e) {}
}

function formatWarnTimestampKo(tmStr) {
    const digits = String(tmStr || '').replace(/\D/g, '');
    if (digits.length < 12) return '-';
    const yyyy = digits.substring(0, 4);
    const mm = digits.substring(4, 6);
    const dd = digits.substring(6, 8);
    const hh = digits.substring(8, 10);
    const min = digits.substring(10, 12);
    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[dateObj.getDay()] || '';
    return `${yyyy}년 ${mm}월 ${dd}일(${dayName}) ${hh}:${min}`;
}

function formatShortWarnTime(tmStr) {
    const digits = String(tmStr || '').replace(/\D/g, '');
    if (digits.length < 10) return '-';
    const mm = digits.substring(4, 6);
    const dd = digits.substring(6, 8);
    const hh = digits.substring(8, 10);
    const min = digits.length >= 12 ? digits.substring(10, 12) : '00';
    return `${mm}-${dd} ${hh}:${min}`;
}

function buildWeatherNuriSummaryHtml(rawText) {
    const records = parseKmaWarnRecords(rawText);
    if (records.length === 0) {
        return `<div style="padding:20px; text-align:center; color:#64748B;">현재 발효 중인 기상특보가 없거나 통보문을 수신 중입니다.</div>`;
    }

    let mainPair = null;
    let anyPair = null;

    records.forEach(r => {
        const isPre = r.lvl.includes('예비') || r.cmd.includes('예비') || r.cmd === '2';
        if (!anyPair || r.tmFc >= anyPair.tmFc) {
            anyPair = { tmFc: r.tmFc, tmEf: r.tmEf };
        }
        if (!isPre) {
            if (!mainPair || r.tmFc >= mainPair.tmFc) {
                mainPair = { tmFc: r.tmFc, tmEf: r.tmEf };
            }
        }
    });

    const activePair = mainPair || anyPair || { tmFc: '', tmEf: '' };

    const normalGroups = {};
    const pyungsuList = [];
    const yeonanList = [];

    records.forEach(r => {
        const isPre = r.lvl.includes('예비') || r.cmd.includes('예비') || r.cmd === '2';
        const title = isPre ? `${r.wrn}예비특보` : `${r.wrn}${r.lvl}`;
        const areaFull = (r.regUpKo && r.regUpKo !== '해상' && !r.regKo.includes(r.regUpKo))
            ? `${r.regUpKo}(${r.regKo})`
            : r.regKo;

        if (r.regKo.includes('평수구역')) {
            pyungsuList.push(`o ${r.regKo} ${title} 발표`);
        } else if (r.regKo.includes('연안바다')) {
            yeonanList.push(`o ${r.regKo} ${title} 발표`);
        } else {
            if (!normalGroups[title]) normalGroups[title] = [];
            if (!normalGroups[title].includes(areaFull)) {
                normalGroups[title].push(areaFull);
            }
        }
    });

    let bodyLinesHtml = '';
    Object.keys(normalGroups).forEach(title => {
        bodyLinesHtml += `<div style="margin-bottom:10px; line-height:1.6;"><strong>o ${title}</strong> : ${normalGroups[title].join(', ')}</div>`;
    });

    if (pyungsuList.length > 0) {
        bodyLinesHtml += `<div style="margin-top:14px; margin-bottom:4px; font-weight:bold; color:#0F172A;">&lt;특정관리해역 평수구역 특보사항&gt;</div>`;
        pyungsuList.forEach(txt => {
            bodyLinesHtml += `<div style="line-height:1.6; color:#334155;">${txt}</div>`;
        });
    }

    if (yeonanList.length > 0) {
        bodyLinesHtml += `<div style="margin-top:14px; margin-bottom:4px; font-weight:bold; color:#0F172A;">&lt;특정관리해역 연안바다 특보사항&gt;</div>`;
        yeonanList.forEach(txt => {
            bodyLinesHtml += `<div style="line-height:1.6; color:#334155;">${txt}</div>`;
        });
    }

    return `
        <div style="font-size:13px; color:#1E293B; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #E2E8F0;">
            <div><strong>발표시각</strong> : ${formatWarnTimestampKo(activePair.tmFc)}</div>
            <div style="margin-top:3px;"><strong>발효시각</strong> : ${formatWarnTimestampKo(activePair.tmEf)} 이후</div>
        </div>
        <div style="background:#FFFFFF; border:1px solid #CBD5E1; border-radius:6px; padding:14px; max-height:310px; overflow-y:auto; font-size:13.5px; color:#1E293B;">
            ${bodyLinesHtml || '<div style="color:#64748B;">발효 중인 특보 내역이 없습니다.</div>'}
        </div>
    `;
}

function buildWeatherDetailTableHtml(rawText) {
    const records = parseKmaWarnRecords(rawText);
    if (!records || records.length === 0) {
        return `<div style="padding:14px; text-align:center; color:#64748B; font-size:12.5px;">표시할 특보 상세내역이 없습니다.</div>`;
    }

    let rowsHtml = '';
    records.forEach(r => {
        const isPre = r.lvl.includes('예비') || r.cmd.includes('예비') || r.cmd === '2';
        const levelText = isPre ? '예비특보' : (r.lvl || '-');
        const areaFull = (r.regUpKo && r.regUpKo !== '해상' && !r.regKo.includes(r.regUpKo))
            ? `${r.regUpKo}(${r.regKo})`
            : (r.regKo || '-');

        let rowBg = '#FFFFFF';
        let badgeBg = '#E0F2FE';
        let badgeColor = '#0369A1';
        if (levelText.includes('경보')) {
            rowBg = '#FEF2F2';
            badgeBg = '#FEE2E2';
            badgeColor = '#B91C1C';
        } else if (levelText.includes('예비')) {
            rowBg = '#FFFBEB';
            badgeBg = '#FEF3C7';
            badgeColor = '#B45309';
        } else if (levelText.includes('주의')) {
            rowBg = '#F0FDF4';
            badgeBg = '#DCFCE7';
            badgeColor = '#15803D';
        }

        const endStr = r.endTime && !/^\d+$/.test(r.endTime) ? r.endTime : (r.endTime ? formatShortWarnTime(r.endTime) : '-');

        rowsHtml += `
            <tr style="background:${rowBg};">
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; text-align:center; font-weight:bold; color:#0F172A;">${r.wrn || '-'}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; text-align:center;">
                    <span style="display:inline-block; padding:2px 8px; border-radius:999px; font-size:11.5px; font-weight:bold; background:${badgeBg}; color:${badgeColor};">${levelText}</span>
                </td>
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; color:#1E293B; line-height:1.45;">${areaFull}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; text-align:center; white-space:nowrap; color:#475569;">${formatShortWarnTime(r.tmFc)}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; text-align:center; white-space:nowrap; color:#475569;">${formatShortWarnTime(r.tmEf)}</td>
                <td style="padding:8px 10px; border-bottom:1px solid #E2E8F0; text-align:center; white-space:nowrap; color:#64748B;">${endStr}</td>
            </tr>
        `;
    });

    return `
        <div style="margin-top:16px; background:#fff; border:1px solid #CBD5E1; border-radius:8px; padding:12px 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-size:14px; font-weight:bold; color:#0F172A;">📋 특보 상세내역 보기</span>
                <span style="font-size:11.5px; color:#64748B;">총 ${records.length}건</span>
            </div>
            <div style="max-height:260px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:6px;">
                <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
                    <thead>
                        <tr style="background:#F1F5F9; color:#334155; position:sticky; top:0; z-index:1;">
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; width:10%;">특보</th>
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; width:12%;">수준</th>
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; text-align:left;">해당지역</th>
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; width:13%;">발표시각</th>
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; width:13%;">발효시각</th>
                            <th style="padding:8px 10px; border-bottom:2px solid #CBD5E1; width:14%;">해제예고</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

window.renderFallbackWarningSvgMap = function(imgEl) {
    if (!imgEl || !imgEl.parentElement) return;
    const container = imgEl.parentElement;
    imgEl.style.display = 'none';

    const getSeaStyle = (seaKey) => {
        const st = activeSeaWarnings[seaKey] || '';
        if (st.includes('경보')) return { fill: 'url(#hatch-cyan)', label: '경보', color: '#0369A1' };
        if (st.includes('주의보')) return { fill: '#38BDF8', label: '주의보', color: '#0284C7' };
        if (st.includes('예비')) return { fill: '#BAE6FD', label: '예비', color: '#0369A1' };
        return { fill: '#F8FAFC', label: '-', color: '#64748B' };
    };

    const sNorthFar = getSeaStyle('서해남부북쪽안쪽먼바다');
    const sSouthFar = getSeaStyle('서해남부남쪽안쪽먼바다');
    const sFrontN   = getSeaStyle('서해남부앞바다(전남북부)');
    const sFrontC   = getSeaStyle('서해남부앞바다(전남중부)');
    const sFrontS   = getSeaStyle('서해남부앞바다(전남남부)');
    const sSouthW   = getSeaStyle('남해서부서쪽먼바다');
    const sJejuN    = getSeaStyle('제주도북부앞바다');

    const svgWrap = document.createElement('div');
    svgWrap.innerHTML = `
        <svg viewBox="0 0 340 330" style="width:100%; max-width:360px; border:1px solid #CBD5E1; border-radius:6px; background:#E2E8F0;">
            <defs>
                <pattern id="hatch-cyan" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="#67E8F9"/>
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#0284C7" stroke-width="2.5"/>
                </pattern>
            </defs>
            <rect x="10" y="15" width="115" height="85" fill="${sNorthFar.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="67" y="52" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">서해남부북쪽</text>
            <text x="67" y="65" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">안쪽먼바다</text>
            <text x="67" y="80" font-size="10" font-weight="bold" text-anchor="middle" fill="${sNorthFar.color}">[${sNorthFar.label}]</text>

            <rect x="10" y="100" width="115" height="95" fill="${sSouthFar.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="67" y="140" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">서해남부남쪽</text>
            <text x="67" y="153" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">안쪽먼바다</text>
            <text x="67" y="168" font-size="10" font-weight="bold" text-anchor="middle" fill="${sSouthFar.color}">[${sSouthFar.label}]</text>

            <rect x="125" y="15" width="95" height="55" fill="${sFrontN.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="172" y="40" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">전남북부앞바다</text>
            <text x="172" y="54" font-size="10" font-weight="bold" text-anchor="middle" fill="${sFrontN.color}">[${sFrontN.label}]</text>

            <rect x="125" y="70" width="95" height="65" fill="${sFrontC.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="172" y="98" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">전남중부앞바다</text>
            <text x="172" y="112" font-size="10" font-weight="bold" text-anchor="middle" fill="${sFrontC.color}">[${sFrontC.label}]</text>

            <rect x="125" y="135" width="95" height="60" fill="${sFrontS.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="172" y="162" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">전남남부앞바다</text>
            <text x="172" y="176" font-size="10" font-weight="bold" text-anchor="middle" fill="${sFrontS.color}">[${sFrontS.label}]</text>

            <rect x="125" y="195" width="135" height="60" fill="${sSouthW.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="192" y="222" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">남해서부서쪽먼바다</text>
            <text x="192" y="236" font-size="10" font-weight="bold" text-anchor="middle" fill="${sSouthW.color}">[${sSouthW.label}]</text>

            <rect x="125" y="255" width="135" height="55" fill="${sJejuN.fill}" stroke="#334155" stroke-width="1.2"/>
            <text x="192" y="280" font-size="10" font-weight="bold" text-anchor="middle" fill="#0F172A">제주도북부앞바다</text>
            <text x="192" y="294" font-size="10" font-weight="bold" text-anchor="middle" fill="${sJejuN.color}">[${sJejuN.label}]</text>

            <polygon points="220,15 330,15 330,195 220,195 232,140 225,85" fill="#F1F5F9" stroke="#475569" stroke-width="1.2"/>
            <text x="280" y="105" font-size="11" font-weight="bold" text-anchor="middle" fill="#334155">전라남도</text>
            <text x="280" y="122" font-size="9.5" text-anchor="middle" fill="#64748B">(목포·신안·진도)</text>

            <rect x="12" y="268" width="102" height="44" rx="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1"/>
            <rect x="18" y="275" width="12" height="10" fill="#38BDF8" stroke="#334155" stroke-width="0.6"/>
            <text x="35" y="284" font-size="9.5" font-weight="bold" fill="#1E293B">풍랑주의보</text>
            <rect x="18" y="292" width="12" height="10" fill="url(#hatch-cyan)" stroke="#334155" stroke-width="0.6"/>
            <text x="35" y="301" font-size="9.5" font-weight="bold" fill="#1E293B">풍랑경보(빗금)</text>
        </svg>
    `;
    container.appendChild(svgWrap);
};

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function fetchKmaApi(type, authKey, timeoutMs = 12000, extraQuery = '') {
    try {
        const url = `/api/kma?type=${type}&authKey=${encodeURIComponent(authKey)}${extraQuery}&_t=${Date.now()}`;
        const response = await fetchWithTimeout(url, {}, timeoutMs);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get('content-type') || '';
        const buffer = await response.arrayBuffer();
        let text = "";
        if (contentType.includes('utf-8')) {
            text = new TextDecoder('utf-8').decode(buffer);
        } else {
            try {
                text = new TextDecoder('euc-kr').decode(buffer);
            } catch (decErr) {
                text = new TextDecoder('utf-8').decode(buffer);
            }
        }

        if (text && text.trim().length > 5 && !text.startsWith("FETCH_ERROR")) {
            return text;
        }
        throw new Error("유효하지 않은 응답");
    } catch (err) {
        console.warn(`[KMA ${type} 실패]:`, err.message);
        return null;
    }
}

function parseSeaObsTextData(blockText, latestTsByKey = {}) {
    if (!blockText) return 0;
    const targetSeaObs = [
        { id: '22500', key: '조도파고' },
        { id: '22481', key: '맹골수도파고' },
        { id: '22449', key: '진도파고' },
        { id: '22453', key: '제주항파고' },
        { id: '959',   key: '해수서파고' }
    ];

    let count = 0;
    const lines = blockText.split('\n');
    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const cols = line.includes(',') ? line.split(',').map(c => c.trim()) : line.split(/\s+/);
        if (cols.length < 9) return;

        const tmStr = cols[1] || '';
        const timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';
        const stnId = cols[2];

        targetSeaObs.forEach(tb => {
            if (stnId === tb.id) {
                let rawWh = parseFloat(cols[6]);
                let rawWd = parseFloat(cols[7]);
                let rawWs = parseFloat(cols[8]);

                let wVal = (!isNaN(rawWs) && rawWs >= 0 && rawWs < 50.0) ? rawWs.toFixed(1) : '-';
                let dVal = (!isNaN(rawWd) && rawWd >= 0 && rawWd <= 360) ? degToDirection(rawWd) : '-';
                let whVal = (!isNaN(rawWh) && rawWh >= 0.0 && rawWh <= 15.0) ? rawWh.toFixed(1) : '-';

                if (wVal !== '-' || whVal !== '-') {
                    upsertStationHistory(tb.key, {
                        sortKey: tmStr,
                        time: timeOnly,
                        wind: wVal,
                        windDir: dVal,
                        sigWave: whVal,
                        maxWave: '-'
                    });
                }

                if (!latestTsByKey[tb.key] || tmStr >= latestTsByKey[tb.key]) {
                    latestTsByKey[tb.key] = tmStr;
                    if (latestBuoyData[tb.key].wind !== null && wVal !== '-') {
                        latestBuoyData[tb.key].wind = wVal;
                        if (dVal !== '-') latestBuoyData[tb.key].windDir = dVal;
                        count++;
                    }
                    if (whVal !== '-') {
                        latestBuoyData[tb.key].sigWave = whVal;
                        if (latestBuoyData[tb.key].wind === null || wVal === '-') count++;
                    }
                }
            }
        });
    });

    return count;
}

function parseAwsTextData(textAws) {
    if (!textAws) return 0;
    const awsLines = textAws.split('\n');
    const awsIdToKey = {};
    for (let k in latestBuoyData) {
        if (latestBuoyData[k].type === 'aws' && latestBuoyData[k].stnId) {
            awsIdToKey[String(latestBuoyData[k].stnId)] = k;
        }
    }

    let latestAwsTsByKey = {};
    let count = 0;

    awsLines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const cols = line.split(/[\s,]+/).filter(Boolean);
        if (cols.length < 4) return;

        const stnId = String(cols[1]);
        const targetKey = awsIdToKey[stnId];
        if (!targetKey) return;

        const tmStr = cols[0] || '';
        const timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';

        const wd1 = parseFloat(cols[2]);
        const ws1 = parseFloat(cols[3]);
        const wss = cols.length >= 6 ? parseFloat(cols[5]) : -99;
        const wd10 = cols.length >= 8 ? parseFloat(cols[6]) : -99;
        const ws10 = cols.length >= 8 ? parseFloat(cols[7]) : -99;

        const finalWs = (!isNaN(ws10) && ws10 >= 0 && ws10 < 100) ? ws10 : ws1;
        const finalWd = (!isNaN(wd10) && wd10 >= 0 && wd10 <= 360) ? wd10 : wd1;
        let finalGust = (!isNaN(wss) && wss >= 0 && wss < 120) ? wss : NaN;
        if (!isNaN(finalGust) && !isNaN(finalWs) && finalGust < finalWs) finalGust = finalWs;

        if (!isNaN(finalWs) && finalWs >= 0 && finalWs < 100) {
            const wStr = finalWs.toFixed(1);
            const gStr = !isNaN(finalGust) ? finalGust.toFixed(1) : '-';
            const dStr = (!isNaN(finalWd) && finalWd >= 0 && finalWd <= 360) ? degToDirection(finalWd) : '-';

            upsertStationHistory(targetKey, {
                sortKey: tmStr,
                time: timeOnly,
                wind: wStr,
                gust: gStr,
                windDir: dStr,
                sigWave: null,
                maxWave: null
            });

            if (!latestAwsTsByKey[targetKey] || tmStr >= latestAwsTsByKey[targetKey]) {
                latestAwsTsByKey[targetKey] = tmStr;
                latestBuoyData[targetKey].wind = wStr;
                if (gStr !== '-') latestBuoyData[targetKey].gust = gStr;
                if (dStr !== '-') latestBuoyData[targetKey].windDir = dStr;
                count++;
            }
        }
    });

    return count;
}

window.fetchWeatherRealtime = async (isAuto = false) => {
    let authKey = localStorage.getItem("kma_apihub_authkey") || DEFAULT_KMA_AUTHKEY;
    const recvEl = document.getElementById('weather-last-updated');
    if (recvEl) recvEl.innerText = `📡 수신 중...`;

    let nmpntKey = localStorage.getItem("nmpnt_service_key") || DEFAULT_NMPNT_KEY;
    let khoaKey = localStorage.getItem("khoa_api_key") || DEFAULT_KHOA_KEY;

    const nowMs = Date.now();
    const shouldFetchNmpnt = (!isAuto) || (nowMs - lastNmpntFetchMs >= 10 * 60 * 1000);

    let updatedCount = 0;
    let latestTsByKey = {};

    const updateStatusText = () => {
        if (recvEl && updatedCount > 0) {
            recvEl.innerText = `📡 [실시간] ${new Date().toLocaleTimeString()} (${updatedCount}개소 연동)`;
        }
    };

    const pAws = fetchKmaApi("aws_now", authKey, 12000).then(textAwsNow => {
        if (textAwsNow) {
            const c = parseAwsTextData(textAwsNow);
            if (c > 0) {
                updatedCount += c;
                saveStationHistoryCache();
                updateStatusText();
                renderOperationBoard();
            }
        }
    }).catch(() => {});

    const pBuoy = fetchKmaApi("buoy", authKey, 12000).then(textBuoy => {
        if (!textBuoy) return;
        const targetBuoys = [
            { id: '22183', key: '신안' },
            { id: '22184', key: '추자도' },
            { id: '22102', key: '칠발도' },
            { id: '22298', key: '홍도' },
            { id: '22297', key: '가거도' },
            { id: '22193', key: '흑산도' },
            { id: '22500', key: '조도파고' },
            { id: '22481', key: '맹골수도파고' },
            { id: '22449', key: '진도파고' },
            { id: '22453', key: '제주항파고' },
            { id: '959',   key: '해수서파고' }
        ];

        ['조도파고', '맹골수도파고', '진도파고', '제주항파고'].forEach(wbKey => {
            if (Array.isArray(stationHistoryMap[wbKey])) {
                stationHistoryMap[wbKey] = stationHistoryMap[wbKey].filter(h => parseFloat(h.sigWave) > 0);
            }
        });

        const parseBuoy2Block = (blockText) => {
            if (!blockText || blockText.includes('UNAUTHORIZED') || blockText.includes('DENIED') || blockText.includes('ERROR')) return;
            const lines = blockText.split('\n');
            let idxTm = 0, idxStn = 1, idxWd = 2, idxWs1 = 3, idxGst1 = 4, idxWd2 = 5, idxWs2 = 6, idxGst2 = 7, idxMaxWh = 12, idxSigWh = 13;

            for (let rawL of lines) {
                let l = rawL.trim();
                if (l.startsWith('#') && l.includes('STN') && l.includes('WH_MAX')) {
                    let hCols = l.replace(/^#+\s*/, '').split(/[\s,]+/).filter(Boolean);
                    let fTm = hCols.indexOf('TM');
                    let fStn = hCols.indexOf('STN');
                    let fWd1 = hCols.indexOf('WD1');
                    let fWs1 = hCols.indexOf('WS1');
                    let fGst1 = hCols.indexOf('WS1_GST');
                    let fWd2 = hCols.indexOf('WD2');
                    let fWs2 = hCols.indexOf('WS2');
                    let fGst2 = hCols.indexOf('WS2_GST');
                    let fMax = hCols.indexOf('WH_MAX');
                    let fSig = hCols.indexOf('WH_SIG');
                    if (fTm >= 0) idxTm = fTm;
                    if (fStn >= 0) idxStn = fStn;
                    if (fWd1 >= 0) idxWd = fWd1;
                    if (fWs1 >= 0) idxWs1 = fWs1;
                    if (fGst1 >= 0) idxGst1 = fGst1;
                    if (fWd2 >= 0) idxWd2 = fWd2;
                    if (fWs2 >= 0) idxWs2 = fWs2;
                    if (fGst2 >= 0) idxGst2 = fGst2;
                    if (fMax >= 0) idxMaxWh = fMax;
                    if (fSig >= 0) idxSigWh = fSig;
                    break;
                }
            }

            const isValidWind = (v) => !isNaN(v) && v >= 0 && v < 50.0;
            const isValidGust = (v) => !isNaN(v) && v >= 0 && v < 120.0;

            lines.forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const cols = line.includes(',') ? line.split(',').map(c => c.trim()) : line.split(/\s+/);
                if (cols.length <= idxSigWh) return;

                const tmStr = cols[idxTm] || '';
                const timeOnly = tmStr.length >= 12 ? `${tmStr.substring(8,10)}:${tmStr.substring(10,12)}` : '최신';
                const stnId = cols[idxStn];

                targetBuoys.forEach(tb => {
                    if (stnId === tb.id) {
                        if (latestBuoyData[tb.key] && latestBuoyData[tb.key].type === 'wavebuoy') return;

                        const isMarineBuoy = latestBuoyData[tb.key] && latestBuoyData[tb.key].type === 'buoy';

                        let rawWd1 = parseFloat(cols[idxWd]);
                        let rawWd2 = cols.length > idxWd2 ? parseFloat(cols[idxWd2]) : NaN;
                        let rawWs1 = parseFloat(cols[idxWs1]);
                        let rawWs2 = cols.length > idxWs2 ? parseFloat(cols[idxWs2]) : NaN;
                        let rawGst1 = cols.length > idxGst1 ? parseFloat(cols[idxGst1]) : NaN;
                        let rawGst2 = cols.length > idxGst2 ? parseFloat(cols[idxGst2]) : NaN;

                        let useWs = isValidWind(rawWs1) ? rawWs1 : (isValidWind(rawWs2) ? rawWs2 : NaN);
                        let useWd = (!isNaN(rawWd1) && rawWd1 >= 0 && rawWd1 <= 360)
                            ? rawWd1
                            : ((!isNaN(rawWd2) && rawWd2 >= 0 && rawWd2 <= 360) ? rawWd2 : NaN);

                        // 거스트: WS1_GST 우선, 결측/비정상 시 WS2_GST 대체
                        let useGst = isValidGust(rawGst1) ? rawGst1 : (isValidGust(rawGst2) ? rawGst2 : NaN);

                        let rawMaxWh = parseFloat(cols[idxMaxWh]);
                        let rawSigWh = parseFloat(cols[idxSigWh]);

                        let wVal = isValidWind(useWs) ? useWs.toFixed(1) : '-';
                        let gVal = '-';
                        if (isMarineBuoy && isValidGust(useGst)) {
                            const adjGst = (isValidWind(useWs) && useGst < useWs) ? useWs : useGst;
                            gVal = adjGst.toFixed(1);
                        }

                        let dVal = !isNaN(useWd) ? degToDirection(useWd) : '-';
                        let whVal = (!isNaN(rawSigWh) && rawSigWh >= 0.0 && rawSigWh <= 15.0) ? rawSigWh.toFixed(1) : '-';
                        let maxWhVal = (!isNaN(rawMaxWh) && rawMaxWh >= 0.0 && rawMaxWh <= 25.0) ? rawMaxWh.toFixed(1) : '-';

                        if (wVal !== '-' || gVal !== '-' || whVal !== '-') {
                            upsertStationHistory(tb.key, {
                                sortKey: tmStr,
                                time: timeOnly,
                                wind: wVal,
                                gust: isMarineBuoy ? gVal : '-',
                                windDir: dVal,
                                sigWave: whVal,
                                maxWave: maxWhVal
                            });
                        }

                        if (!latestTsByKey[tb.key] || tmStr >= latestTsByKey[tb.key]) {
                            latestTsByKey[tb.key] = tmStr;
                            if (latestBuoyData[tb.key].wind !== null && wVal !== '-') {
                                latestBuoyData[tb.key].wind = wVal;
                                if (dVal !== '-') latestBuoyData[tb.key].windDir = dVal;
                                updatedCount++;
                            }
                            if (isMarineBuoy) {
                                latestBuoyData[tb.key].gust = gVal;
                            }
                            if (whVal !== '-') {
                                latestBuoyData[tb.key].sigWave = whVal;
                                if (latestBuoyData[tb.key].wind === null || wVal === '-') updatedCount++;
                            }
                            if (maxWhVal !== '-') {
                                latestBuoyData[tb.key].maxWave = maxWhVal;
                            }
                        }
                    }
                });
            });
        };

        if (textBuoy.includes('===BUOY2_START===')) {
            const parts = textBuoy.split('===SEAOBS_START===');
            parseBuoy2Block(parts[0].replace('===BUOY2_START===', ''));
            updatedCount += parseSeaObsTextData(parts[1] || '', latestTsByKey);
        } else {
            updatedCount += parseSeaObsTextData(textBuoy, latestTsByKey);
        }

        saveStationHistoryCache();
        updateStatusText();
        renderOperationBoard();
    }).catch(() => {});

    const pWarn = fetchKmaApi("warn", authKey, 10000).then(textWarn => {
        if (textWarn) {
            parseWeatherWarnings(textWarn);
            renderOperationBoard();
        }
    }).catch(() => {});

    const pNmpnt = shouldFetchNmpnt
        ? fetchWithTimeout(`/api/nmpnt?serviceKey=${encodeURIComponent(nmpntKey)}&_t=${nowMs}`, {}, 12000)
            .then(r => r.json())
            .then(dataNmpnt => {
                const nmpntRaw = dataNmpnt?.result?.recordset || dataNmpnt?.recordset || dataNmpnt?.response?.body?.items?.item || dataNmpnt?.items || null;
                if (!nmpntRaw) return;
                lastNmpntFetchMs = nowMs;
                const records = Array.isArray(nmpntRaw) ? nmpntRaw : [nmpntRaw];
                const kstNow = new Date(nowMs + 9 * 60 * 60 * 1000);
                const flooredMin = String(Math.floor(kstNow.getUTCMinutes() / 10) * 10).padStart(2, '0');
                const yyyyMMddHH = kstNow.toISOString().replace(/\D/g, '').substring(0, 10);
                const slotSortKey = `${yyyyMMddHH}${flooredMin}`;
                const slotTime = `${yyyyMMddHH.substring(8,10)}:${flooredMin}`;
                let latestNmpntTsByKey = {};

                records.forEach(item => {
                    const code = String(item.MMSI_CODE || item.OBS_CD || item.stnId || '').trim();
                    const name = String(item.MMSI_NM || item.OBS_NM || item.stnNm || '').trim();
                    const ws = parseFloat(item.WIND_SPEED ?? item.WSPD ?? item.ws);
                    const wd = parseFloat(item.WIND_DIRECT ?? item.WDIR ?? item.wd);
                    let tmStr = String(item.RECORD_TIME || item.OBS_TIME || item.TIME || item.REG_DATE || item.REG_DT || item.TM || '');
                    let digits = tmStr.replace(/\D/g, '');
                    let sortKey = digits.length >= 12 ? digits.substring(0, 12) : slotSortKey;
                    let timeOnly = tmStr.length >= 16 ? tmStr.substring(11, 16) : (digits.length >= 12 ? `${digits.substring(8,10)}:${digits.substring(10,12)}` : slotTime);

                    if (!isNaN(ws) && ws >= 0 && ws < 60) {
                        const dirStr = (!isNaN(wd) && wd >= 0 && wd <= 360) ? degToDirection(wd) : '-';
                        const formattedWs = ws.toFixed(1);
                        let targetKey = null;
                        if (code === '1079001' || name.includes('안좌')) targetKey = '안좌';
                        else if (code === '1079008' || name.includes('외달')) targetKey = '외달도';
                        else if (code === '1079003' || (name.includes('가거') && name.includes('등대'))) targetKey = '가거도등대';
                        else if (code === '1079002' || (name.includes('홍도') && name.includes('등대'))) targetKey = '홍도등대';
                        else if (code === '1079005' || code === '1079004' || name.includes('하조도')) targetKey = '하조도';
                        else if (code === '1079007' || name.includes('계마')) targetKey = '계마항';

                        if (targetKey && latestBuoyData[targetKey]) {
                            upsertStationHistory(targetKey, { sortKey, time: timeOnly, wind: formattedWs, windDir: dirStr, sigWave: null, maxWave: null });
                            if (!latestNmpntTsByKey[targetKey] || sortKey >= latestNmpntTsByKey[targetKey]) {
                                latestNmpntTsByKey[targetKey] = sortKey;
                                latestBuoyData[targetKey].wind = formattedWs;
                                if (dirStr !== '-') latestBuoyData[targetKey].windDir = dirStr;
                                updatedCount++;
                            }
                        }
                    }
                });
                saveStationHistoryCache();
                updateStatusText();
                renderOperationBoard();
            }).catch(() => {})
        : Promise.resolve();

    const khoaTargets = [
        { code: 'KG_0025', key: '추자조사원' },
        { code: 'IE_0061', key: '가거초조사원' },
        { code: 'DT_0065', key: '향화도조위' },
        { code: 'DT_0094', key: '서거차조위' },
        { code: 'TW_0080', key: '우이도조사원' },
        { code: 'DT_0028', key: '진도조위' }
    ];

    const pKhoaList = khoaTargets.map(kt =>
        fetchWithTimeout(`/api/khoa?serviceKey=${encodeURIComponent(khoaKey)}&obsCode=${kt.code}&_t=${nowMs}`, {}, 8000)
            .then(r => r.json())
            .then(resObj => {
                if (!resObj || !resObj.result || !resObj.result.data) return;
                const kData = resObj.result.data;
                const targetKey = kt.key;
                let hasAnyData = false;

                const kstNow = new Date(nowMs + 9 * 60 * 60 * 1000);
                const flooredMin = String(Math.floor(kstNow.getUTCMinutes() / 10) * 10).padStart(2, '0');
                const yyyyMMddHH = kstNow.toISOString().replace(/\D/g, '').substring(0, 10);
                const fallbackSortKey = `${yyyyMMddHH}${flooredMin}`;
                const fallbackTime = `${yyyyMMddHH.substring(8,10)}:${flooredMin}`;

                const ws = parseFloat(kData.wind_speed);
                const wd = parseFloat(kData.wind_dir);
                let latestWStr = '-', latestDStr = '-', latestSigStr = '-', latestMaxStr = '-';

                if (!isNaN(ws) && ws >= 0 && ws < 80) {
                    latestWStr = ws.toFixed(1);
                    latestDStr = (!isNaN(wd) && wd >= 0) ? degToDirection(wd) : '-';
                    latestBuoyData[targetKey].wind = latestWStr;
                    if (latestDStr !== '-') latestBuoyData[targetKey].windDir = latestDStr;
                    hasAnyData = true;
                }
                if (latestBuoyData[targetKey].sigWave !== null) {
                    const sigW = parseFloat(kData.sig_wave);
                    if (!isNaN(sigW) && sigW >= 0 && sigW <= 20) {
                        latestSigStr = sigW.toFixed(1);
                        latestBuoyData[targetKey].sigWave = latestSigStr;
                        hasAnyData = true;
                    }
                    const maxW = parseFloat(kData.max_wave);
                    if (!isNaN(maxW) && maxW >= 0 && maxW <= 30) {
                        latestMaxStr = maxW.toFixed(1);
                        latestBuoyData[targetKey].maxWave = latestMaxStr;
                        hasAnyData = true;
                    }
                }
                if (hasAnyData) {
                    upsertStationHistory(targetKey, { sortKey: fallbackSortKey, time: fallbackTime, wind: latestWStr, windDir: latestDStr, sigWave: latestSigStr, maxWave: latestMaxStr });
                    updatedCount++;
                    saveStationHistoryCache();
                    updateStatusText();
                    renderOperationBoard();
                }
            }).catch(() => {})
    );

    await Promise.allSettled([pAws, pBuoy, pWarn, pNmpnt, ...pKhoaList]);

    if (updatedCount > 0) {
        updateStatusText();
        if (!isAuto) alert(`✅ 해양기상 관측 데이터가 정상 반영되었습니다!`);
    } else {
        if (recvEl) recvEl.innerText = `⚠️ 수신된 기상 데이터 없음`;
    }

    const needSeaObsBackfill = (!isAuto) || ['해수서파고', '진도파고', '조도파고', '맹골수도파고', '제주항파고'].some(
        k => !Array.isArray(stationHistoryMap[k]) || stationHistoryMap[k].filter(h => isWithinLast6Hours(h.sortKey)).length < 3
    );
    if (needSeaObsBackfill) {
        fetchKmaApi("sea_obs_hist", authKey, 12000).then(textSeaHist => {
            if (textSeaHist) {
                parseSeaObsTextData(textSeaHist, latestTsByKey);
                saveStationHistoryCache();
                renderOperationBoard();
            }
        }).catch(() => {});
    }
};

// ==========================================
// 6. 타이머 제어 및 기상/API 설정 모달
// ==========================================
function startCountdownTimer() {
    stopCountdownTimer();
    let sel = document.getElementById('auto-refresh-select');
    let intervalSec = sel ? parseInt(sel.value, 10) : 300;
    nextRefreshRemainingSec = intervalSec;

    const clockEl = document.getElementById('current-clock');
    if (clockEl) clockEl.innerText = `🕒 현재시각: ${new Date().toTimeString().split(' ')[0]}`;

    countdownIntervalId = setInterval(() => {
        const curTimeStr = new Date().toTimeString().split(' ')[0];
        const clockEl = document.getElementById('current-clock');
        if (clockEl) clockEl.innerText = `🕒 현재시각: ${curTimeStr}`;

        const counterEl = document.getElementById('next-refresh-counter');
        const selectEl = document.getElementById('auto-refresh-select');
        const curSelVal = selectEl ? parseInt(selectEl.value, 10) : 300;

        if (curSelVal === 0) {
            if (counterEl) counterEl.innerText = `⏳ 다음 갱신: 정지됨`;
            return;
        }

        if (nextRefreshRemainingSec > 0) {
            nextRefreshRemainingSec--;
            const m = String(Math.floor(nextRefreshRemainingSec / 60)).padStart(2, '0');
            const s = String(nextRefreshRemainingSec % 60).padStart(2, '0');
            if (counterEl) counterEl.innerText = `⏳ 다음 갱신: ${m}:${s}`;
        } else {
            nextRefreshRemainingSec = curSelVal;
            const boardSec = document.getElementById('board-section');
            if (boardSec && boardSec.style.display === 'block') {
                fetchWeatherRealtime(true);
            }
        }
    }, 1000);
}

function stopCountdownTimer() {
    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }
}

window.changeAutoRefreshInterval = function(valStr) {
    let sec = parseInt(valStr, 10);
    nextRefreshRemainingSec = sec;
    const counterEl = document.getElementById('next-refresh-counter');
    if (sec === 0) {
        if (counterEl) counterEl.innerText = `⏳ 다음 갱신: 정지됨`;
    } else {
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (counterEl) counterEl.innerText = `⏳ 다음 갱신: ${m}:${s}`;
    }
};

window.manualRefreshWeather = function() {
    let sel = document.getElementById('auto-refresh-select');
    let sec = sel ? parseInt(sel.value, 10) : 300;
    nextRefreshRemainingSec = sec;
    fetchWeatherRealtime(false);
};

function loadSavedApiKey() {
    let key = localStorage.getItem("kma_apihub_authkey");
    if (!key || key !== DEFAULT_KMA_AUTHKEY) {
        localStorage.setItem("kma_apihub_authkey", DEFAULT_KMA_AUTHKEY);
    }
}

window.openApiSettingModal = () => {
    let currentKey = localStorage.getItem("kma_apihub_authkey") || DEFAULT_KMA_AUTHKEY;
    document.getElementById('kma-api-key-input').value = currentKey;
    let nmpntKey = localStorage.getItem("nmpnt_service_key") || DEFAULT_NMPNT_KEY;
    document.getElementById('nmpnt-key-input').value = nmpntKey;
    let khoaKey = localStorage.getItem("khoa_api_key") || DEFAULT_KHOA_KEY;
    let khoaInput = document.getElementById('khoa-key-input');
    if (khoaInput) khoaInput.value = khoaKey;

    document.getElementById('chk-sea-1').checked = !!activeSeaWarnings['서해남부북쪽안쪽먼바다'];
    document.getElementById('chk-sea-2').checked = !!activeSeaWarnings['서해남부남쪽안쪽먼바다'];
    document.getElementById('chk-sea-3').checked = !!activeSeaWarnings['서해남부앞바다(전남중부)'];
    document.getElementById('chk-sea-4').checked = !!activeSeaWarnings['서해남부앞바다(전남남부)'];
    document.getElementById('chk-sea-5').checked = !!activeSeaWarnings['서해남부앞바다(전남북부)'];
    document.getElementById('chk-sea-6').checked = !!activeSeaWarnings['남해서부서쪽먼바다'];
    document.getElementById('chk-sea-7').checked = !!activeSeaWarnings['제주도북부앞바다'];

    document.getElementById('api-modal').style.display = 'flex';
};

window.closeApiSettingModal = () => { document.getElementById('api-modal').style.display = 'none'; };

window.openRawWarnModal = () => {
    const modal = document.getElementById('raw-warn-modal');
    if (!modal) return;

    const summaryHtml = buildWeatherNuriSummaryHtml(latestRawWarnText);
    const detailTableHtml = buildWeatherDetailTableHtml(latestRawWarnText);
    const mapImgUrl = `/api/kma?type=warn_img&tmFc=${encodeURIComponent(latestWarnTmFc)}&tmEf=${encodeURIComponent(latestWarnTmEf)}&_t=${Date.now()}`;

    modal.innerHTML = `
        <div style="background:#fff; width:920px; max-width:96vw; max-height:90vh; border-radius:12px; box-shadow:0 12px 30px rgba(0,0,0,0.3); display:flex; flex-direction:column; overflow:hidden;">
            <div style="padding:14px 20px; background:#1E293B; color:#fff; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:16px;">📢 기상특보 종합 현황 (기상청 날씨누리 연동)</h3>
                <button onclick="closeRawWarnModal()" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer; font-weight:bold;">✕</button>
            </div>
            <div style="padding:18px; overflow-y:auto; flex:1; background:#F8FAFC;">
                <div style="display:flex; flex-wrap:wrap; gap:18px; align-items:flex-start;">
                    <div style="flex:1 1 320px; background:#fff; border:1px solid #CBD5E1; border-radius:8px; padding:10px; text-align:center;">
                        <div style="font-size:13px; font-weight:bold; color:#0F172A; margin-bottom:8px;">🗺️ 특보 발효현황 해역도</div>
                        <img src="${mapImgUrl}"
                             onerror="renderFallbackWarningSvgMap(this)"
                             alt="기상특보 발효현황 지도"
                             style="width:100%; max-width:380px; height:auto; border-radius:6px; border:1px solid #E2E8F0;">
                    </div>
                    <div style="flex:1.4 1 400px; background:#fff; border:1px solid #CBD5E1; border-radius:8px; padding:14px;">
                        <div style="font-size:14px; font-weight:bold; color:#0F172A; margin-bottom:8px;">▪ 특보 발효현황 및 특보 내용</div>
                        ${summaryHtml}
                    </div>
                </div>

                ${detailTableHtml}

                <details style="margin-top:14px; background:#fff; border:1px solid #CBD5E1; border-radius:8px; padding:10px 14px;">
                    <summary style="cursor:pointer; font-size:12.5px; font-weight:bold; color:#475569;">📄 기상청 API 원본 전문 보기 (클릭 시 펼침)</summary>
                    <textarea readonly style="width:100%; height:160px; margin-top:8px; font-family:monospace; font-size:11.5px; border:1px solid #E2E8F0; border-radius:6px; padding:8px; background:#F1F5F9; color:#334155;">${latestRawWarnText || ''}</textarea>
                </details>
            </div>
            <div style="padding:12px 20px; background:#E2E8F0; text-align:right;">
                <button onclick="closeRawWarnModal()" style="padding:7px 18px; background:#334155; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold;">닫기</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
};

window.closeRawWarnModal = () => { document.getElementById('raw-warn-modal').style.display = 'none'; };

window.toggleManualWarning = (seaName, isChecked) => {
    activeSeaWarnings[seaName] = isChecked ? '풍랑주의보(발효중)' : null;
    renderOperationBoard();
};

window.saveApiKeyModal = () => {
    let key = document.getElementById('kma-api-key-input').value.trim() || DEFAULT_KMA_AUTHKEY;
    let nmpntKey = document.getElementById('nmpnt-key-input').value.trim() || DEFAULT_NMPNT_KEY;
    let khoaInput = document.getElementById('khoa-key-input');
    let khoaKey = khoaInput ? (khoaInput.value.trim() || DEFAULT_KHOA_KEY) : DEFAULT_KHOA_KEY;

    localStorage.setItem("kma_apihub_authkey", key);
    localStorage.setItem("nmpnt_service_key", nmpntKey);
    localStorage.setItem("khoa_api_key", khoaKey);
    alert(`설정 완료! 기상청/측위원/조사원 키가 저장되었습니다.`);
    closeApiSettingModal();
    fetchWeatherRealtime();
};
