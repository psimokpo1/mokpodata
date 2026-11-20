// ==========================================
// 7. 선박 기초자료 UI 렌더링 & 모달 제어
// ==========================================
function loadVesselAssets(cleanName, uId, shipCode, fallbackCleanName = '') {
    const detail = document.getElementById(`detail-info-${uId}`);
    if (!detail || detail.dataset.loaded === "true") return;
    detail.dataset.loaded = "true";

    let cleanNoHo = cleanName.replace(/호$/, '');
    let override = cloudCustomData[shipCode] || {};
    let customShip = customAddedShips.find(s => String(s.id).trim() === String(shipCode).trim());
    let photoUrl = (override.images && override.images.photo)
        || override.photo
        || override.photoUrl
        || (customShip && ((customShip.images && customShip.images.photo) || customShip.photo || customShip.photoUrl));

    // 선박 대표 사진은 예비선 고유 자산을 우선 유지
    let imgEl = document.getElementById(`auto-img-${uId}`);
    if (imgEl) {
        if (photoUrl) {
            imgEl.src = photoUrl;
            imgEl.style.display = 'block';
            imgEl.onclick = (e) => {
                e.stopPropagation();
                showImg(photoUrl, '선박 대표 사진', { type: 'photo', shipCode: shipCode, title: '대표 사진' });
            };
        } else {
            loadAutoImg([cleanName + '_사진', cleanName, cleanNoHo + '_사진', cleanNoHo], `auto-img-${uId}`, shipCode);
        }
    }

    // 항로도·시간표·운규항로도·차량적재도는 승계 대상(본선 우선, 없으면 예비선 폴백)
    let assetNames = [cleanName];
    if (fallbackCleanName && fallbackCleanName !== cleanName) {
        assetNames.push(fallbackCleanName);
    }

    const buildCandidates = (suffixes) => {
        let list = [];
        assetNames.forEach(base => {
            suffixes.forEach(suf => list.push(base + suf));
        });
        return list;
    };

    smartBtnV2(buildCandidates(['_시간']), `btn-ann-${uId}`, '📅 기본시간표', shipCode);
    smartBtnV2(buildCandidates(['_특수', '_짝수']), `btn-spc-${uId}`, '🔢 특수일/짝수', shipCode);
    smartBtnV2(buildCandidates(['_하']), `btn-sum-${uId}`, '☀️ 하절기', shipCode);
    smartBtnV2(buildCandidates(['_동']), `btn-win-${uId}`, '❄️ 동절기', shipCode);
    smartBtnV2(assetNames, `btn-map-${uId}`, '🗺️ 항로도(PATIS)', null);

    let ruleBtns = [
        { b: `rule-btn-1-${uId}`, bases: buildCandidates(['_운규항로도']) },
        { b: `rule-btn-2-${uId}`, bases: buildCandidates(['_운규항로도2']) },
        { b: `rule-btn-3-${uId}`, bases: buildCandidates(['_운규항로도3']) },
        { b: `rule-btn-4-${uId}`, bases: buildCandidates(['_운규항로도4']) },
        { b: `rule-btn-5-${uId}`, bases: buildCandidates(['_운규항로도5']) }
    ];
    smartGroupScan(ruleBtns, "📄 운항관리규정 항로도");

    let carBtns = [
        { b: `car-btn-1-${uId}`, bases: buildCandidates(['_차량적재']) },
        { b: `car-btn-2-${uId}`, bases: buildCandidates(['_차량적재2']) },
        { b: `car-btn-3-${uId}`, bases: buildCandidates(['_차량적재3']) }
    ];
    smartGroupScan(carBtns, "🚗 차량적재도 참고자료");
}

function render() {
    try {
        if (typeof baseShipData === 'undefined') return;
        const showHiddenToggle = document.getElementById('showHiddenToggle');
        const showHidden = showHiddenToggle ? showHiddenToggle.checked : false;

        let allMap = {};
        baseShipData.forEach((d, idx) => {
            let code = (d[1] || `idx_${idx}`).trim();
            let override = cloudCustomData[code] || {};
            let photoUrl = (override.images && override.images.photo) || override.photo || override.photoUrl || null;
            allMap[code] = {
                isCustom: false,
                rawArray: d,
                code: code,
                rawName: override.rawName !== undefined ? override.rawName : d[0],
                route: override.route !== undefined ? override.route : d[2],
                company: override.company !== undefined ? override.company : d[3],
                ports: override.ports !== undefined ? override.ports : d[4],
                notes: override.notes !== undefined ? override.notes : d[5],
                capacity: override.capacity !== undefined ? override.capacity : d[6],
                decision: override.decision !== undefined ? override.decision : d[7],
                customFields: override.customFields || [],
                timetables: override.timetables || [],
                isHidden: !!override.isHidden,
                isDeleted: !!override.isDeleted,
                deployedTarget: override.deployedTarget ? String(override.deployedTarget).trim() : null,
                cloudPhoto: photoUrl
            };
        });

        customAddedShips.forEach(s => {
            let code = String(s.id).trim();
            let photoUrl = (s.images && s.images.photo) || s.photo || s.photoUrl || null;
            allMap[code] = {
                isCustom: true,
                code: code,
                rawName: s.rawName || '신규선박',
                route: s.route || '기타항로',
                company: s.company || '-',
                ports: s.ports || '-',
                notes: s.notes || '-',
                capacity: s.capacity || '-',
                decision: s.decision || '-',
                customFields: s.customFields || [],
                timetables: s.timetables || [],
                isHidden: !!s.isHidden,
                isDeleted: !!s.isDeleted,
                deployedTarget: s.deployedTarget ? String(s.deployedTarget).trim() : null,
                cloudPhoto: photoUrl
            };
        });

        let visibleShips = [];
        for (let c in allMap) {
            let s = allMap[c];
            if (s.isDeleted) continue;
            let isOriginalReserve = (s.route || '').trim() === '예비선';
            let isDeployedReserve = isOriginalReserve && !!s.deployedTarget;
            if (s.isHidden && !showHidden && !isDeployedReserve) continue;

            let targetShip = isDeployedReserve ? allMap[s.deployedTarget] : null;
            let effectiveRoute = (targetShip ? targetShip.route : s.route || '기타항로').trim();
            visibleShips.push({ ...s, displayRoute: effectiveRoute, targetShip: targetShip });
        }

        let regularRoutes = new Set(visibleShips.filter(s => (s.displayRoute || '').trim() !== '예비선').map(s => (s.displayRoute || '').trim()));
        let uniqueVesselCount = new Set(visibleShips.map(s => s.code)).size;

        const statsEl = document.getElementById('stats');
        if (statsEl) statsEl.innerText = `[ ${regularRoutes.size}개 항로 / 총 ${uniqueVesselCount}척 ]`;

        let groups = {};
        visibleShips.forEach(s => {
            let r = s.displayRoute;
            if (!groups[r]) groups[r] = [];
            groups[r].push(s);
        });

        let sortedRouteKeys = Object.keys(groups).sort((a, b) => {
            if (a === '예비선') return 1;
            if (b === '예비선') return -1;
            return a.localeCompare(b, 'ko');
        });

        let fullHtml = "";

        sortedRouteKeys.forEach((r, rIdx) => {
            let isReserveGroup = (r === '예비선');
            let groupHtml = `<div class="route-group"><div class="route-header ${isReserveGroup ? 'reserve' : ''}" onclick="toggleRoute(this.nextElementSibling)">📍 ${r} (${groups[r].length}척) <span>▼</span></div><div class="vessel-list">`;

            groups[r].forEach((v, idx) => {
                let reserveCleanName = (v.rawName || '').split('(')[0].split('\n')[0].trim().replace(/\s/g, '');
                if (reserveCleanName === "상동") reserveCleanName = "도초카훼리";

                let deployedBadge = '';
                let isOriginalReserve = (v.route || '').trim() === '예비선';
                let isDeployed = isOriginalReserve && !!v.targetShip;

                let targetCleanName = '';
                if (isDeployed) {
                    targetCleanName = (v.targetShip.rawName || '').split('(')[0].split('\n')[0].trim().replace(/\s/g, '');
                    if (targetCleanName === "상동") targetCleanName = "도초카훼리";
                }

                // 정적 자산(항로도·시간표·운규항로도·차량적재도) 탐색 기준 이름: 대체투입 시 본선 우선, 예비선 폴백
                let assetPrimaryName = isDeployed && targetCleanName ? targetCleanName : reserveCleanName;
                let assetFallbackName = isDeployed && targetCleanName ? reserveCleanName : '';
                let uId = `${assetPrimaryName}_${rIdx}_${idx}`;

                // 대체투입 시 본선의 기항지, 운항결정, 비고 승계
                let displayPorts = isDeployed ? (v.targetShip.ports || v.ports || '-') : (v.ports || '-');
                let displayDecision = isDeployed ? (v.targetShip.decision || v.decision || '-') : (v.decision || '-');
                let displayNotes = isDeployed ? (v.targetShip.notes || v.notes || '-') : (v.notes || '-');

                let displayNameText = v.rawName || '';
                if (isDeployed) {
                    let tName = (v.targetShip.rawName || '').split('(')[0].split('\n')[0].trim();
                    deployedBadge = `<span class="badge-deployed">⚡ [${tName} 대체운항 중]</span>`;
                    let reserveHeader = (v.rawName || '').split('\n')[0] || '';
                    let targetLines = (v.targetShip.rawName || '').split('\n').map(l => l.trim()).filter(Boolean);
                    displayNameText = [reserveHeader, targetLines[1] || '', targetLines[2] || ''].filter(Boolean).join('\n');
                }

                let vNameHTML = displayNameText.replace(/\n/g, '<br>').replace(/(통제기준:[^)]+\))/g, '<span class="highlight-red">$1</span>');

                let customRowsHtml = "";
                if (v.customFields && v.customFields.length > 0) {
                    v.customFields.forEach(f => {
                        if (f.key && f.val) customRowsHtml += `<tr><td class="label" style="color:#0284C7;">${f.key}</td><td style="font-weight:600;">${f.val.replace(/\n/g, '<br>')}</td></tr>`;
                    });
                }

                // 커스텀 시간표: 대체투입 시 본선 시간표 우선(없으면 예비선 시간표)
                let effectiveTimetables = isDeployed
                    ? ((v.targetShip.timetables && v.targetShip.timetables.length > 0) ? v.targetShip.timetables : (v.timetables || []))
                    : (v.timetables || []);
                let timetableOwnerCode = (isDeployed && v.targetShip.timetables && v.targetShip.timetables.length > 0)
                    ? v.targetShip.code
                    : v.code;

                let ttButtonsHtml = "";
                if (effectiveTimetables.length > 0) {
                    effectiveTimetables.forEach((tt, tIdx) => {
                        if (tt.title && tt.imgData) ttButtonsHtml += `<div class="btn-dynamic-tt" style="display:block;" onclick="showImg('${tt.imgData}', '${tt.title}', { type: 'timetable', shipCode: '${timetableOwnerCode}', ttIndex: ${tIdx}, title: '${tt.title}' })">📅 ${tt.title}</div>`;
                    });
                }

                let deployBtnHtml = isOriginalReserve ? `<button class="btn-action btn-deploy-act" onclick="openDeployModal('${v.code}')">🚢 대체투입 설정</button>` : '';

                groupHtml += `<div class="vessel-card ${isReserveGroup ? 'reserve' : ''} ${v.deployedTarget ? 'deployed' : ''} ${v.isHidden ? 'is-hidden' : ''}">
                    <div class="vessel-header" data-cleanname="${reserveCleanName}" data-fallbackname="${assetFallbackName}" data-assetname="${assetPrimaryName}" data-uid="${uId}" data-shipcode="${v.code}" onclick="toggleVessel(this, '${assetPrimaryName}', '${uId}', '${v.code}', '${assetFallbackName}')">
                        <div class="vessel-name">${vNameHTML} ${deployedBadge} ${v.isHidden ? '<span class="badge-hidden">선박 숨김</span>' : ''}</div>
                        <div style="font-size:12px; color:#999;">▼</div>
                    </div>
                    <div id="detail-info-${uId}" class="detail-info">
                        <img id="auto-img-${uId}" style="display:none; width:100%; height:auto; border-radius:8px; margin-bottom:15px; box-shadow:0 2px 5px rgba(0,0,0,0.1); cursor:pointer;">
                        <table>
                            <tr><td class="label">선박코드</td><td>${v.code || '-'}</td></tr>
                            <tr><td class="label">소속항로</td><td><strong>${v.displayRoute}</strong> ${isOriginalReserve ? '(원 소속: 예비선)' : ''}</td></tr>
                            <tr><td class="label">선사</td><td>${v.company || '-'}</td></tr>
                            <tr><td class="label">기항지</td><td>${displayPorts.replace(/\n/g, '<br>')}</td></tr>
                            <tr><td class="label">여객정원</td><td>${v.capacity}명</td></tr>
                            <tr><td class="label">운항결정</td><td style="font-weight:bold; color:#1A237E;">${displayDecision.replace(/\n/g, '<br>')}</td></tr>
                            <tr><td class="label">비고</td><td>${displayNotes.replace(/\n/g, '<br>')}</td></tr>
                            ${customRowsHtml}
                        </table>
                        <div class="button-grid" id="grid-${uId}">
                            <div id="btn-map-${uId}" class="img-button btn-map">🗺️ 항로도(PATIS)</div>
                            ${ttButtonsHtml}
                            <div id="btn-ann-${uId}" class="img-button btn-annual">📅 기본시간표</div>
                            <div id="btn-spc-${uId}" class="img-button btn-special">🔢 특수일</div>
                            <div id="btn-sum-${uId}" class="img-button btn-summer">☀️ 하절기</div>
                            <div id="btn-win-${uId}" class="img-button btn-winter">❄️ 동절기</div>
                        </div>
                        <div id="rule-btn-1-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도</div>
                        <div id="rule-btn-2-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 2</div>
                        <div id="rule-btn-3-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 3</div>
                        <div id="rule-btn-4-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 4</div>
                        <div id="rule-btn-5-${uId}" class="btn-rule-v2">📄 운항관리규정 항로도 5</div>
                        <div id="car-btn-1-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료</div>
                        <div id="car-btn-2-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료 2</div>
                        <div id="car-btn-3-${uId}" class="btn-car-v2">🚗 차량적재도 참고자료 3</div>

                        <div class="admin-btn-group">
                            ${deployBtnHtml}
                            <button class="btn-action btn-edit-act" onclick="openEditModal('${v.code}')">✏️ 정보 및 사진 수정</button>
                            ${v.isHidden ?
                                `<button class="btn-action btn-unhide-act" onclick="toggleHideShip('${v.code}', false)">👁️ 숨김 해제</button>` :
                                `<button class="btn-action btn-hide-act" onclick="toggleHideShip('${v.code}', true)">🙈 선박 숨기기</button>`
                            }
                            <button class="btn-action btn-del-act" onclick="deleteShip('${v.code}')">🗑️ 선박 삭제</button>
                        </div>
                    </div>
                </div>`;
            });
            groupHtml += `</div></div>`;
            fullHtml += groupHtml;
        });

        const mainListEl = document.getElementById('mainList');
        if (mainListEl) {
            mainListEl.innerHTML = fullHtml;
            document.querySelectorAll('.vessel-header[data-uid]').forEach(hdr => {
                const detailEl = hdr.nextElementSibling;
                if (detailEl && getComputedStyle(detailEl).display !== 'none') {
                    loadVesselAssets(hdr.dataset.assetname || hdr.dataset.cleanname, hdr.dataset.uid, hdr.dataset.shipcode, hdr.dataset.fallbackname || '');
                }
            });
        }
    } catch (e) {
        console.error("render() 예외 발생:", e);
    }
}

function renderRefSection() {
    const container = document.getElementById('ref-items-container');
    if (!container) return;

    let items = [];
    for (let k in defaultRefItems) {
        let override = cloudRefItems[k] || {};
        if (!override.isDeleted) {
            items.push({ id: k, title: override.title || defaultRefItems[k].title, imgData: override.imgData || null, fallbackNames: defaultRefItems[k].fallbackNames, order: defaultRefItems[k].order });
        }
    }
    for (let k in cloudRefItems) {
        if (!defaultRefItems[k] && !cloudRefItems[k].isDeleted) {
            items.push({ id: k, title: cloudRefItems[k].title || '참고자료', imgData: cloudRefItems[k].imgData || null, fallbackNames: [], order: cloudRefItems[k].order || 99 });
        }
    }
    items.sort((a, b) => a.order - b.order);

    let html = "";
    items.forEach((item, idx) => {
        html += `
            <div class="ref-item-row">
                <div id="ref-btn-${idx}" class="ref-view-btn" onclick="openRefImage('${item.id}', '${item.title}')">${item.title}</div>
                <button class="ref-edit-btn" onclick="openEditRefModal('${item.id}')">✏️ 수정</button>
                ${!defaultRefItems[item.id] ? `<button class="ref-edit-btn" style="background:#DC2626;" onclick="deleteRefItem('${item.id}')">🗑️</button>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;
}

window.openRefImage = function(itemId, title) {
    let item = cloudRefItems[itemId];
    if (item && item.imgData) {
        showImg(item.imgData, title, { type: 'ref', refId: itemId, title: title });
        return;
    }
    let def = defaultRefItems[itemId];
    if (def && def.fallbackNames) {
        let exts = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.webp'];
        let attempts = [];
        def.fallbackNames.forEach(b => { exts.forEach(e => attempts.push(b + e)); });
        let idx = 0;
        function tryNext() {
            if (idx >= attempts.length) { alert("등록된 이미지가 없습니다. [수정]을 통해 등록해 주세요."); return; }
            let path = attempts[idx++];
            let img = new Image();
            img.onload = () => showImg(path, title, null);
            img.onerror = tryNext;
            img.src = encodeURI(path);
        }
        tryNext();
    } else {
        alert("등록된 이미지가 없습니다. [수정]을 통해 등록해 주세요.");
    }
};

window.openAddRefModal = function() {
    document.getElementById('ref-item-id').value = '';
    document.getElementById('ref-modal-title').innerText = '➕ 새 참고자료 항목 추가';
    document.getElementById('ref-item-title').value = '';
    document.getElementById('upload-ref-file').value = '';
    document.getElementById('ref-upload-status').style.display = 'none';
    document.getElementById('ref-modal').style.display = 'flex';
};

window.openEditRefModal = function(id) {
    let item = cloudRefItems[id] || defaultRefItems[id] || {};
    document.getElementById('ref-item-id').value = id;
    document.getElementById('ref-modal-title').innerText = '✏️ 참고자료 타이틀 및 이미지 수정';
    document.getElementById('ref-item-title').value = item.title || '';
    document.getElementById('upload-ref-file').value = '';
    document.getElementById('ref-upload-status').style.display = 'none';
    document.getElementById('ref-modal').style.display = 'flex';
};

window.closeRefModal = function() { document.getElementById('ref-modal').style.display = 'none'; };

window.saveRefUpdate = async function() {
    let id = document.getElementById('ref-item-id').value;
    let title = document.getElementById('ref-item-title').value.trim();
    if (!title) { alert("타이틀을 입력해 주세요."); return; }

    let isNew = !id;
    let docId = id || `ref_${Date.now()}`;
    const statusEl = document.getElementById('ref-upload-status');
    const btnSave = document.getElementById('btn-save-ref');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let current = cloudRefItems[docId] || {};
        let file = document.getElementById('upload-ref-file').files[0];
        let imgData = current.imgData || null;
        if (file) imgData = await processImageFile(file, 1600, 0.85);

        await db.collection("reference_materials").doc(docId).set({
            title: title, imgData: imgData, isDeleted: false, order: current.order || (isNew ? Date.now() : 1), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("참고자료가 저장되었습니다!");
        closeRefModal();
    } catch (err) { alert("저장 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.deleteRefItem = async function(id) {
    if (!confirm("해당 참고자료 항목을 삭제하시겠습니까?")) return;
    try {
        await db.collection("reference_materials").doc(id).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        alert("삭제되었습니다.");
    } catch (err) { alert("삭제 실패: " + err.message); }
};

window.toggleRoute = function(listEl) {
    const isOpening = (listEl.style.display !== 'block');
    listEl.style.display = isOpening ? 'block' : 'none';
    if (isOpening) {
        listEl.querySelectorAll('.vessel-header[data-uid]').forEach(hdr => {
            const detailEl = hdr.nextElementSibling;
            if (detailEl && getComputedStyle(detailEl).display !== 'none') {
                loadVesselAssets(hdr.dataset.assetname || hdr.dataset.cleanname, hdr.dataset.uid, hdr.dataset.shipcode, hdr.dataset.fallbackname || '');
            }
        });
    }
};
window.toggleRefGroup = function(listEl) { listEl.style.display = (listEl.style.display === 'block') ? 'none' : 'block'; };

window.toggleVessel = function(headerEl, cleanName, uId, shipCode, fallbackCleanName = '') {
    let detail = headerEl.nextElementSibling;
    let isOpening = (detail.style.display !== 'block');
    detail.style.display = isOpening ? 'block' : 'none';

    if (isOpening) {
        loadVesselAssets(cleanName, uId, shipCode, fallbackCleanName);
    }
};

const COMMON_EXTS = ['.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.webp'];

function smartBtnV2(baseNames, btnId, title, shipCode = null) {
    let el = document.getElementById(btnId);
    if (!el) return;
    let attempts = [];
    baseNames.forEach(b => { COMMON_EXTS.forEach(e => attempts.push(b + e)); });
    let idx = 0;
    function tryNext() {
        if (idx >= attempts.length) return;
        let path = attempts[idx++];
        let img = new Image();
        img.onload = () => { el.style.display = 'block'; el.onclick = () => showImg(path, title, shipCode ? { type: 'static_fallback', shipCode: shipCode, title: title } : null); };
        img.onerror = tryNext;
        img.src = encodeURI(path);
    }
    tryNext();
}

function smartGroupScan(btnGroup, baseText) {
    let checks = btnGroup.map(item => {
        return new Promise((resolve) => {
            let bases = item.bases || [item.base];
            let attempts = [];
            bases.forEach(b => { COMMON_EXTS.forEach(e => attempts.push(b + e)); });
            let idx = 0;
            function next() {
                if (idx >= attempts.length) { resolve({ exists: false, item: item }); return; }
                let path = attempts[idx++];
                let img = new Image();
                img.onload = () => resolve({ exists: true, path: path, item: item });
                img.onerror = next;
                img.src = encodeURI(path);
            }
            next();
        });
    });

    Promise.all(checks).then(results => {
        let list = results.filter(r => r.exists);
        if (list.length === 1) {
            let r = list[0]; let b = document.getElementById(r.item.b);
            if (b) { b.innerText = baseText; b.style.display = 'block'; b.onclick = () => showImg(r.path, baseText, null); }
        } else if (list.length > 1) {
            list.forEach((r, idx) => {
                let b = document.getElementById(r.item.b);
                if (b) { b.innerText = baseText + " " + (idx + 1); b.style.display = 'block'; b.onclick = () => showImg(r.path, baseText + " " + (idx + 1), null); }
            });
        }
    });
}

function loadAutoImg(baseNames, imgId, shipCode) {
    let el = document.getElementById(imgId);
    if (!el) return;
    let attempts = [];
    baseNames.forEach(b => { COMMON_EXTS.forEach(e => attempts.push(b + e)); });
    let idx = 0;
    function tryNext() {
        if (idx >= attempts.length) return;
        let path = attempts[idx++];
        let img = new Image();
        img.onload = () => { el.src = encodeURI(path); el.style.display = 'block'; el.onclick = (e) => { e.stopPropagation(); showImg(path, '선박 대표 사진', { type: 'photo', shipCode: shipCode, title: '대표 사진' }); }; };
        img.onerror = tryNext;
        img.src = encodeURI(path);
    }
    tryNext();
}

window.showImg = (path, title, deleteContext = null) => {
    document.getElementById('mImg').src = path;
    document.getElementById('mCap').innerText = `🚢 [${title}]`;
    currentViewerContext = deleteContext || { type: 'unknown', title: title };
    document.getElementById('btn-modal-delete').style.display = 'block';
    document.getElementById('modal').style.display = 'flex';
};

window.closeViewerModal = () => {
    document.getElementById('modal').style.display = 'none';
    currentViewerContext = null;
};

window.handleDirectViewerDelete = async () => {
    if (!currentViewerContext) return;
    const ctx = currentViewerContext;
    if (!confirm(`정말 '${ctx.title}' 사진을 즉시 삭제하시겠습니까?`)) return;

    try {
        if (ctx.type === 'timetable') {
            let docRef = db.collection("vessel_overrides").doc(ctx.shipCode);
            let docSnap = await docRef.get();
            if (docSnap.exists) {
                let d = docSnap.data();
                let tts = d.timetables || [];
                tts.splice(ctx.ttIndex, 1);
                await docRef.set({ timetables: tts }, { merge: true });
            }
        } else if (ctx.type === 'photo') {
            await db.collection("vessel_overrides").doc(ctx.shipCode).set({ photo: null, images: { photo: null }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else if (ctx.type === 'ref') {
            await db.collection("reference_materials").doc(ctx.refId).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else {
            alert("시스템 기본 이미지이거나 삭제 대상이 아닙니다."); return;
        }
        alert("사진이 삭제되었습니다.");
        closeViewerModal();
    } catch (err) { alert("삭제 실패: " + err.message); }
};

window.runSearch = () => {
    let q = document.getElementById('searchInput').value.toLowerCase().replace(/\s/g,'');
    Array.from(document.getElementsByClassName('vessel-card')).forEach(c => {
        if (c.parentElement.parentNode.id === 'common-ref') return;
        c.style.display = c.innerText.toLowerCase().replace(/\s/g,'').includes(q) ? 'block' : 'none';
    });
    Array.from(document.getElementsByClassName('route-group')).forEach(g => {
        if (g.id === 'common-ref') { g.style.display = (q === "") ? 'block' : 'none'; return; }
        let has = Array.from(g.getElementsByClassName('vessel-card')).some(c => c.style.display !== 'none');
        g.style.display = has ? 'block' : 'none';
        let list = g.querySelector('.vessel-list');
        if (list) list.style.display = (q !== "" && has) ? 'block' : 'none';
    });
};

function processImageFile(file, maxWidth = 1200, quality = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const elem = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                elem.width = width;
                elem.height = height;
                const ctx = elem.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(elem.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

window.addCustomFieldRow = (key = '', val = '') => {
    const container = document.getElementById('custom-fields-container');
    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `<input type="text" class="custom-field-key" placeholder="항목명" value="${key}"><input type="text" class="custom-field-val" placeholder="내용" value="${val}"><button type="button" class="btn-del-field" onclick="this.parentElement.remove()">🗑️</button>`;
    container.appendChild(row);
};

window.addTimetableRow = (title = '', existingImgData = null) => {
    const container = document.getElementById('timetables-container');
    const row = document.createElement('div');
    row.className = 'tt-row';
    row.dataset.existingImg = existingImgData || '';
    row.innerHTML = `
        <div class="tt-row-header"><input type="text" class="tt-row-title" placeholder="시간표 명칭" value="${title}"><button type="button" class="btn-del-tt" onclick="this.closest('.tt-row').remove()">취소</button></div>
        <div class="tt-file-area"><input type="file" class="tt-file-input" accept="image/*"><span class="tt-status-text" style="${existingImgData ? 'color:#10B981; font-weight:bold;' : 'color:#94A3B8;'}">${existingImgData ? '✅ 이미지 등록됨' : '⚠️ 이미지 선택'}</span></div>
    `;
    container.appendChild(row);
};

window.openEditModal = (shipCode) => {
    shipCode = String(shipCode).trim();
    let ship = typeof baseShipData !== 'undefined' ? baseShipData.find(s => s[1].trim() === shipCode) : null;
    let custom = customAddedShips.find(s => String(s.id).trim() === shipCode);
    let currentData = cloudCustomData[shipCode] || {};

    document.getElementById('edit-vessel-key').value = shipCode;
    document.getElementById('edit-vessel-title').innerText = `✏️ [${shipCode}] 정보 및 시간표 수정`;
    document.getElementById('upload-ship-photo').value = '';
    document.getElementById('upload-status').style.display = 'none';

    if (ship) {
        document.getElementById('edit-raw-name').value = currentData.rawName !== undefined ? currentData.rawName : ship[0];
        document.getElementById('edit-route').value = currentData.route !== undefined ? currentData.route : ship[2];
        document.getElementById('edit-company').value = currentData.company !== undefined ? currentData.company : ship[3];
        document.getElementById('edit-ports').value = currentData.ports !== undefined ? currentData.ports : ship[4];
        document.getElementById('edit-capacity').value = currentData.capacity !== undefined ? currentData.capacity : ship[6];
        document.getElementById('edit-decision').value = currentData.decision !== undefined ? currentData.decision : ship[7];
        document.getElementById('edit-notes').value = currentData.notes !== undefined ? currentData.notes : ship[5];
    } else if (custom) {
        document.getElementById('edit-raw-name').value = custom.rawName || '';
        document.getElementById('edit-route').value = custom.route || '';
        document.getElementById('edit-company').value = custom.company || '';
        document.getElementById('edit-ports').value = custom.ports || '';
        document.getElementById('edit-capacity').value = custom.capacity || '';
        document.getElementById('edit-decision').value = custom.decision || '';
        document.getElementById('edit-notes').value = custom.notes || '';
    }

    const ttContainer = document.getElementById('timetables-container');
    ttContainer.innerHTML = '';
    let existingTts = currentData.timetables || (custom && custom.timetables) || [];
    existingTts.forEach(tt => {
        if (tt && (tt.title || tt.imgData)) {
            addTimetableRow(tt.title || '', tt.imgData || null);
        }
    });

    const customContainer = document.getElementById('custom-fields-container');
    customContainer.innerHTML = '';
    let fields = currentData.customFields || (custom && custom.customFields) || [];
    fields.forEach(f => addCustomFieldRow(f.key, f.val));
    document.getElementById('edit-modal').style.display = 'flex';
};

window.closeEditModal = () => { document.getElementById('edit-modal').style.display = 'none'; };

window.saveVesselUpdate = async () => {
    const code = document.getElementById('edit-vessel-key').value;
    if (!code) return;

    const btnSave = document.getElementById('btn-save-edit');
    const statusEl = document.getElementById('upload-status');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let current = cloudCustomData[code] || customAddedShips.find(s => s.id === code) || {};
        let imagesMap = current.images || {};
        let timetables = [];

        const photoFile = document.getElementById('upload-ship-photo').files[0];
        if (photoFile) imagesMap.photo = await processImageFile(photoFile);

        const ttRows = document.querySelectorAll('#timetables-container .tt-row');
        for (let row of ttRows) {
            let title = row.querySelector('.tt-row-title').value.trim();
            let file = row.querySelector('.tt-file-input').files[0];
            let existingImg = row.dataset.existingImg || '';
            if (title && file) {
                let imgData = await processImageFile(file, 1400, 0.8);
                timetables.push({ title: title, imgData: imgData });
            } else if (title && existingImg) {
                timetables.push({ title: title, imgData: existingImg });
            }
        }

        let customFields = [];
        document.querySelectorAll('#custom-fields-container .custom-field-row').forEach(r => {
            let k = r.querySelector('.custom-field-key').value.trim();
            let v = r.querySelector('.custom-field-val').value.trim();
            if (k && v) customFields.push({ key: k, val: v });
        });

        await db.collection("vessel_overrides").doc(code).set({
            rawName: document.getElementById('edit-raw-name').value,
            route: document.getElementById('edit-route').value,
            company: document.getElementById('edit-company').value,
            ports: document.getElementById('edit-ports').value,
            capacity: document.getElementById('edit-capacity').value,
            decision: document.getElementById('edit-decision').value,
            notes: document.getElementById('edit-notes').value,
            customFields: customFields,
            timetables: timetables,
            images: imagesMap,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        alert("선박 정보가 저장되었습니다!");
        closeEditModal();
    } catch (err) { alert("저장 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.openAddShipModal = () => {
    document.getElementById('add-code').value = '';
    document.getElementById('add-raw-name').value = '';
    document.getElementById('add-route').value = '';
    document.getElementById('add-company').value = '';
    document.getElementById('add-ports').value = '';
    document.getElementById('add-capacity').value = '';
    document.getElementById('add-decision').value = '';
    document.getElementById('add-notes').value = '';
    document.getElementById('add-ship-photo').value = '';
    document.getElementById('add-upload-status').style.display = 'none';
    document.getElementById('add-modal').style.display = 'flex';
};

window.closeAddModal = () => { document.getElementById('add-modal').style.display = 'none'; };

window.saveNewShip = async () => {
    let code = document.getElementById('add-code').value.trim();
    let rawName = document.getElementById('add-raw-name').value.trim();
    let route = document.getElementById('add-route').value.trim();
    if (!code || !rawName || !route) { alert("필수 항목을 모두 입력해 주세요."); return; }

    const btnSave = document.getElementById('btn-save-add');
    const statusEl = document.getElementById('add-upload-status');
    btnSave.disabled = true;
    statusEl.style.display = 'block';

    try {
        let imagesMap = {};
        const photoFile = document.getElementById('add-ship-photo').files[0];
        if (photoFile) imagesMap.photo = await processImageFile(photoFile);

        await db.collection("vessel_overrides").doc(code).set({
            isNewShip: true, rawName: rawName, route: route,
            company: document.getElementById('add-company').value.trim(),
            ports: document.getElementById('add-ports').value.trim(),
            capacity: document.getElementById('add-capacity').value.trim(),
            decision: document.getElementById('add-decision').value.trim(),
            notes: document.getElementById('add-notes').value.trim(),
            customFields: [], timetables: [], images: imagesMap,
            isHidden: false, isDeleted: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`신규 선박 [${rawName}]이(가) 등록되었습니다.`);
        closeAddModal();
    } catch (err) { alert("등록 실패: " + err.message); }
    finally { btnSave.disabled = false; statusEl.style.display = 'none'; }
};

window.toggleHideShip = (shipCode, toHide) => {
    if (!confirm(toHide ? "선박을 숨기기 처리하시겠습니까?" : "숨김을 해제하시겠습니까?")) return;
    db.collection("vessel_overrides").doc(shipCode.trim()).set({ isHidden: toHide, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
        .then(() => alert(toHide ? "숨김 완료" : "노출 완료")).catch(err => alert(err.message));
};

window.deleteShip = (shipCode) => {
    if (!confirm(`정말로 선박 [${shipCode}]을(를) 삭제하시겠습니까?`)) return;
    shipCode = shipCode.trim();
    let isCustom = customAddedShips.some(s => String(s.id).trim() === shipCode);
    if (isCustom) {
        db.collection("vessel_overrides").doc(shipCode).delete().then(() => alert("영구 삭제 완료"));
    } else {
        db.collection("vessel_overrides").doc(shipCode).set({ isDeleted: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }).then(() => alert("삭제 완료"));
    }
};

window.openDeployModal = (reserveCode) => {
    reserveCode = String(reserveCode).trim();
    const reserveShip = (typeof baseShipData !== 'undefined' ? baseShipData.find(s => s[1].trim() === reserveCode) : null) || customAddedShips.find(s => String(s.id).trim() === reserveCode);
    if (!reserveShip) return;

    let override = cloudCustomData[reserveCode] || {};
    let rName = (override.rawName || (Array.isArray(reserveShip) ? reserveShip[0] : reserveShip.rawName)).split('(')[0].split('\n')[0].trim();

    document.getElementById('deploy-ship-code').value = reserveCode;
    document.getElementById('deploy-ship-name').innerText = `${rName} (${reserveCode})`;

    const selectEl = document.getElementById('deploy-target-select');
    selectEl.innerHTML = '';

    let regularShips = [];
    if (typeof baseShipData !== 'undefined') {
        baseShipData.forEach(s => {
            let code = s[1].trim();
            let ov = cloudCustomData[code] || {};
            let route = ov.route !== undefined ? ov.route : s[2];
            let name = (ov.rawName !== undefined ? ov.rawName : s[0]).split('(')[0].split('\n')[0].trim();
            if (route.trim() !== '예비선') regularShips.push({ code: code, name: name, route: route, isHidden: !!ov.isHidden });
        });
    }

    customAddedShips.forEach(s => {
        if ((s.route || '').trim() !== '예비선') regularShips.push({ code: String(s.id).trim(), name: s.rawName.split('(')[0].trim(), route: s.route, isHidden: !!s.isHidden });
    });

    regularShips.sort((a, b) => a.route.localeCompare(b.route, 'ko'));
    regularShips.forEach(rs => {
        let opt = document.createElement('option');
        opt.value = rs.code;
        opt.innerText = `[${rs.route}] ${rs.name}${rs.isHidden ? ' (숨김)' : ''}`;
        if (override.deployedTarget && override.deployedTarget.trim() === rs.code) opt.selected = true;
        selectEl.appendChild(opt);
    });

    document.getElementById('btn-deploy-reset').style.display = override.deployedTarget ? 'inline-block' : 'none';
    document.getElementById('deploy-modal').style.display = 'flex';
};

window.closeDeployModal = () => { document.getElementById('deploy-modal').style.display = 'none'; };
window.executeDeploySave = () => { saveDeployStatus(document.getElementById('deploy-target-select').value); };

window.saveDeployStatus = async (targetCode) => {
    let reserveCode = document.getElementById('deploy-ship-code').value;
    if (!reserveCode) return;
    try {
        await db.collection("vessel_overrides").doc(reserveCode.trim()).set({ deployedTarget: targetCode ? targetCode.trim() : null, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        closeDeployModal();
        alert(targetCode ? "대체 투입되었습니다." : "대체 투입이 해제되었습니다.");
    } catch (err) { alert(err.message); }
};

document.addEventListener("DOMContentLoaded", () => {
    try {
        render();
        renderRefSection();
    } catch (e) {
        console.error("초기 렌더링 예외:", e);
    }
});
