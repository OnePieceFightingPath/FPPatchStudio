// ============================================================
// PVP PATCHES
// ============================================================

let pvpEditDocId = null;

// pvp 패치 items 정규화: 구 형식(string[]) → 신 형식({type,text}[]) 변환
function normalizePvpPatches(src) {
  const fallback = src.type || '';
  return (src.patches || []).map(p =>
    typeof p === 'string' ? { type: fallback, text: p } : (p || {})
  );
}

async function loadPvpPatches() {
  const tbody = document.getElementById('pvpTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('pvpPatch').get();
    allPvpPatches = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    pvpCurrentPage = 1;
    const _effPvp = _applyPendingOps(allPvpPatches, _pendingPvp);
    filteredPvpList = _effPvp;
    renderPvpTable(_effPvp);
    updateBarFromDocs(_effPvp, 'publishInfoPvp');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err.message)}</td></tr>`;
    showToast('PvP 패치 로드 실패', 'error');
  }
}

function renderPvpTable(list) {
  // 패치 날짜 기준 내림차순 정렬 (최신이 맨 위)
  list = [...list].sort((a, b) => {
    const da = (a.hasDraft && a.draftData) ? { ...a, ...a.draftData } : a;
    const db_ = (b.hasDraft && b.draftData) ? { ...b, ...b.draftData } : b;
    const keyA = da.patchDate || (da.updatedAt?.toDate ? da.updatedAt.toDate().toISOString() : (da.updatedAt || ''));
    const keyB = db_.patchDate || (db_.updatedAt?.toDate ? db_.updatedAt.toDate().toISOString() : (db_.updatedAt || ''));
    return keyB.localeCompare(keyA);
  });
  filteredPvpList = list;
  const tbody = document.getElementById('pvpTableBody');
  const label = document.getElementById('pvpCountLabel');
  label.textContent = list.length === allPvpPatches.length
    ? `총 ${list.length}건`
    : `총 ${allPvpPatches.length}건 중 ${list.length}건`;

  const totalPages = Math.max(1, Math.ceil(list.length / pvpPageSize));
  if (pvpCurrentPage > totalPages) pvpCurrentPage = totalPages;

  const start = (pvpCurrentPage - 1) * pvpPageSize;
  const shown = list.slice(start, start + pvpPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">PvP 패치가 없습니다</td></tr>';
    renderPaginator('pvpPaginator', 0, pvpPageSize, pvpCurrentPage, () => {});
    return;
  }

  const typeLabel = { buff: '▲ 버프', nerf: '▼ 너프', fix: '✦ 기능 수정' };
  const typeClass  = { buff: 'buff', nerf: 'nerf', fix: 'fix' };

  tbody.innerHTML = shown.map(p => {
    const d = (p.hasDraft && p.draftData) ? { ...p, ...p.draftData } : p;
    const char = d.charId != null ? allCharacters.find(c => c.id === d.charId) : null;
    const supportChar = (d.charId == null && d.supportCharId != null)
      ? allSupportChars.find(c => c.id === d.supportCharId)
      : null;

    const isVisible  = p.visible !== false;
    const hasDraft   = !!p.hasDraft;
    const isPendingDelete = !!p.pendingDelete;
    const rowClass   = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';

    // 항목별 타입 → 중복 제거한 뱃지 목록
    const patchItems = normalizePvpPatches(d);
    const types      = [...new Set(patchItems.map(i => i.type).filter(Boolean))];
    const typeBadges = types.length
      ? types.map(t => `<span class="pvp-type-badge ${escHtml(typeClass[t]||'')}">${escHtml(typeLabel[t]||t)}</span>`).join('')
      : `<span class="pvp-type-badge">${d.type ? escHtml(typeLabel[d.type]||d.type) : '-'}</span>`;

    const displayId   = d.charId != null ? String(d.charId) : (supportChar ? String(supportChar.id) : '-');
    const displayName = char
      ? char.name
      : (supportChar
          ? `[서폿] ${supportChar.name}`
          : (d.charName || '-'));

    return `
      <tr class="${rowClass}">
        <td class="cell-date">${escHtml(d.patchDate || '-')}</td>
        <td class="cell-id">${escHtml(displayId)}</td>
        <td class="cell-name">${escHtml(displayName)}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
        <td><div class="pvp-type-badges">${typeBadges}</div></td>
        <td><span class="${isVisible ? 'badge-visible-on' : 'badge-visible-off'}">${isVisible ? 'ON' : 'OFF'}</span></td>
        <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
        <td>
          <div class="cell-actions">
            ${canEditIn('pvpPatch') ? `<button class="btn-edit" data-docid="${escHtml(p._docId)}" onclick="openPvpForm(this.dataset.docid)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              수정
            </button>` : ''}
            ${canDeleteIn('pvpPatch') ? `<button class="btn-delete" data-docid="${escHtml(p._docId)}" onclick="deletePvp(this.dataset.docid)">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              삭제
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPaginator('pvpPaginator', list.length, pvpPageSize, pvpCurrentPage, (page) => {
    pvpCurrentPage = page;
    renderPvpTable(filteredPvpList);
  });
}

function updatePvpCharSelect() {
  // 폼이 열려 있을 때만 드롭다운 재빌드
  if (document.getElementById('pvpFormOverlay')?.classList.contains('open')) {
    const cur = document.getElementById('pvpFieldCharId')?.value || '';
    buildPvpCharDropdown(cur);
  }
}

function buildPvpCharDropdown(currentCharId) {
  // 기존 커스텀 드롭다운 제거
  document.getElementById('pvpCharCustomDd')?.remove();

  const origEl = document.getElementById('pvpFieldCharId');
  if (!origEl) return;

  // SELECT → hidden input 교체 (최초 1회)
  if (origEl.tagName === 'SELECT') {
    const hidden = document.createElement('input');
    hidden.type  = 'hidden';
    hidden.id    = 'pvpFieldCharId';
    hidden.value = currentCharId || '';
    origEl.parentNode.replaceChild(hidden, origEl);
  } else {
    origEl.value = currentCharId || '';
  }

  const wrap = document.createElement('div');
  wrap.className = 'pvp-char-dd';
  wrap.id = 'pvpCharCustomDd';

  const selChar = allCharacters.find(c => String(c.id) === String(currentCharId));
  wrap.innerHTML = `
    <button type="button" class="pvp-char-dd-btn" id="pvpCharDdBtn">
      <span id="pvpCharDdLabel">${selChar ? selChar.name : '캐릭터 선택'}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="pvp-char-dd-panel" id="pvpCharDdPanel">
      <div class="pvp-char-dd-search-wrap">
        <input type="text" class="pvp-char-dd-search" id="pvpCharDdSearch" placeholder="이름 검색...">
      </div>
      <ul class="pvp-char-dd-list" id="pvpCharDdList"></ul>
    </div>`;

  const hiddenEl = document.getElementById('pvpFieldCharId');
  hiddenEl.parentNode.insertBefore(wrap, hiddenEl);

  function renderDdList(q) {
    const ul = document.getElementById('pvpCharDdList');
    const filtered = allCharacters.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
    if (!filtered.length) {
      ul.innerHTML = '<li class="pvp-char-dd-empty">검색 결과 없음</li>';
      return;
    }
    const curVal = String(document.getElementById('pvpFieldCharId').value);
    ul.innerHTML = filtered.map(c =>
      `<li class="pvp-char-dd-item${String(c.id)===curVal?' selected':''}" data-id="${c.id}">${c.name}</li>`
    ).join('');
    ul.querySelectorAll('.pvp-char-dd-item').forEach(li => {
      li.addEventListener('click', () => {
        document.getElementById('pvpFieldCharId').value = li.dataset.id;
        document.getElementById('pvpCharDdLabel').textContent = li.textContent;
        document.getElementById('pvpCharDdPanel').style.display = 'none';
        renderDdList(document.getElementById('pvpCharDdSearch').value);
        syncPvpExclusiveState();
      });
    });
  }

  document.getElementById('pvpCharDdBtn').addEventListener('click', e => {
    e.stopPropagation();
    const panel = document.getElementById('pvpCharDdPanel');
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) { renderDdList(''); document.getElementById('pvpCharDdSearch').focus(); }
  });

  document.getElementById('pvpCharDdSearch').addEventListener('input', e => renderDdList(e.target.value));

  // 외부 클릭 시 닫기 — 이전 핸들러를 먼저 제거하고 새로 등록
  if (buildPvpCharDropdown._outsideClose) {
    document.removeEventListener('click', buildPvpCharDropdown._outsideClose);
  }
  function outsideClose(e) {
    if (!wrap.contains(e.target)) {
      const p = document.getElementById('pvpCharDdPanel');
      if (p) p.style.display = 'none';
      document.removeEventListener('click', outsideClose);
      buildPvpCharDropdown._outsideClose = null;
    }
  }
  buildPvpCharDropdown._outsideClose = outsideClose;
  document.addEventListener('click', outsideClose);

  renderDdList('');
}


function buildPvpSupportCharDropdown(currentSupportCharId) {
  document.getElementById('pvpSupportCharCustomDd')?.remove();

  const origEl = document.getElementById('pvpFieldSupportCharId');
  if (!origEl) return;

  if (origEl.tagName === 'SELECT') {
    const hidden = document.createElement('input');
    hidden.type  = 'hidden';
    hidden.id    = 'pvpFieldSupportCharId';
    hidden.value = currentSupportCharId || '';
    origEl.parentNode.replaceChild(hidden, origEl);
  } else {
    origEl.value = currentSupportCharId || '';
  }

  const effectiveSupportChars = _applyPendingOps(allSupportChars, _pendingSC)
    .filter(c => c.visible !== false)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const wrap = document.createElement('div');
  wrap.className = 'pvp-char-dd';
  wrap.id = 'pvpSupportCharCustomDd';

  const selChar = effectiveSupportChars.find(c => String(c.id) === String(currentSupportCharId));
  wrap.innerHTML = `
    <button type="button" class="pvp-char-dd-btn" id="pvpSupportCharDdBtn">
      <span id="pvpSupportCharDdLabel">${selChar ? selChar.name : '서폿 캐릭터 선택'}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="pvp-char-dd-panel" id="pvpSupportCharDdPanel">
      <div class="pvp-char-dd-search-wrap">
        <input type="text" class="pvp-char-dd-search" id="pvpSupportCharDdSearch" placeholder="이름 검색...">
      </div>
      <ul class="pvp-char-dd-list" id="pvpSupportCharDdList"></ul>
    </div>`;

  const hiddenEl = document.getElementById('pvpFieldSupportCharId');
  hiddenEl.parentNode.insertBefore(wrap, hiddenEl);

  function renderSupportDdList(q) {
    const ul = document.getElementById('pvpSupportCharDdList');
    const allOptions = [{ id: '', name: '선택 안 함' }, ...effectiveSupportChars];
    const filtered = allOptions.filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase()));
    if (!filtered.length) {
      ul.innerHTML = '<li class="pvp-char-dd-empty">검색 결과 없음</li>';
      return;
    }
    const curVal = String(document.getElementById('pvpFieldSupportCharId').value);
    ul.innerHTML = filtered.map(c =>
      `<li class="pvp-char-dd-item${String(c.id) === curVal ? ' selected' : ''}" data-id="${c.id}">${c.name}</li>`
    ).join('');
    ul.querySelectorAll('.pvp-char-dd-item').forEach(li => {
      li.addEventListener('click', () => {
        document.getElementById('pvpFieldSupportCharId').value = li.dataset.id;
        document.getElementById('pvpSupportCharDdLabel').textContent = li.textContent;
        document.getElementById('pvpSupportCharDdPanel').style.display = 'none';
        renderSupportDdList(document.getElementById('pvpSupportCharDdSearch').value);
        syncPvpExclusiveState();
      });
    });
  }

  document.getElementById('pvpSupportCharDdBtn').addEventListener('click', e => {
    e.stopPropagation();
    const panel = document.getElementById('pvpSupportCharDdPanel');
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) { renderSupportDdList(''); document.getElementById('pvpSupportCharDdSearch').focus(); }
  });

  document.getElementById('pvpSupportCharDdSearch').addEventListener('input', e => renderSupportDdList(e.target.value));

  if (buildPvpSupportCharDropdown._outsideClose) {
    document.removeEventListener('click', buildPvpSupportCharDropdown._outsideClose);
  }
  function outsideClose(e) {
    if (!wrap.contains(e.target)) {
      const p = document.getElementById('pvpSupportCharDdPanel');
      if (p) p.style.display = 'none';
      document.removeEventListener('click', outsideClose);
      buildPvpSupportCharDropdown._outsideClose = null;
    }
  }
  buildPvpSupportCharDropdown._outsideClose = outsideClose;
  document.addEventListener('click', outsideClose);

  renderSupportDdList('');
}

function syncPvpExclusiveState() {
  const charId      = document.getElementById('pvpFieldCharId')?.value || '';
  const supportId   = document.getElementById('pvpFieldSupportCharId')?.value || '';
  const charBtn     = document.getElementById('pvpCharDdBtn');
  const supportBtn  = document.getElementById('pvpSupportCharDdBtn');
  const charWrap    = document.getElementById('pvpCharCustomDd');
  const supportWrap = document.getElementById('pvpSupportCharCustomDd');

  if (charBtn) {
    charBtn.disabled = !!supportId;
    if (charWrap) charWrap.style.opacity = supportId ? '0.4' : '1';
    if (charWrap) charWrap.style.pointerEvents = supportId ? 'none' : '';
  }
  if (supportBtn) {
    supportBtn.disabled = !!charId;
    if (supportWrap) supportWrap.style.opacity = charId ? '0.4' : '1';
    if (supportWrap) supportWrap.style.pointerEvents = charId ? 'none' : '';
  }
}

document.getElementById('pvpSearch')?.addEventListener('input', filterPvpTable);
document.getElementById('pvpTypeFilter')?.addEventListener('change', filterPvpTable);


function filterPvpTable() {
  const q    = document.getElementById('pvpSearch').value.toLowerCase();
  const type = document.getElementById('pvpTypeFilter').value;
  let list = allPvpPatches;
  if (type !== 'all') {
    list = list.filter(p => {
      const src = (p.hasDraft && p.draftData) ? { ...p, ...p.draftData } : p;
      return normalizePvpPatches(src).some(item => item.type === type);
    });
  }
  if (q) {
    list = list.filter(p => {
      const src = (p.hasDraft && p.draftData) ? { ...p, ...p.draftData } : p;
      const char = src.charId != null ? allCharacters.find(c => c.id === src.charId) : null;
      const supportChar = (src.charId == null && src.supportCharId != null)
        ? allSupportChars.find(c => c.id === src.supportCharId)
        : null;
      const name = char ? char.name : (supportChar ? supportChar.name : '');
      return name.toLowerCase().includes(q);
    });
  }
  pvpCurrentPage = 1;
  renderPvpTable(list);
}

// ===== PvP Date Picker =====
const pvpPicker = (() => {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return {
    active: null, // 'start' | 'end'
    start:  null, // { y, m, d, h, min }
    end:    null,
    calY:   kst.getUTCFullYear(),
    calM:   kst.getUTCMonth() + 1,
  };
})();
function pvpFmt(o) {
  if (!o) return '날짜 선택';
  return `${o.y}-${String(o.m).padStart(2,'0')}-${String(o.d).padStart(2,'0')} ${String(o.h).padStart(2,'0')}:${String(o.min).padStart(2,'0')}`;
}
function pvpToStr(o) {
  if (!o) return '';
  return `${o.y}-${String(o.m).padStart(2,'0')}-${String(o.d).padStart(2,'0')}T${String(o.h).padStart(2,'0')}:${String(o.min).padStart(2,'0')}`;
}
function pvpFromStr(s) {
  if (!s) return null;
  const r = s.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return r ? { y:+r[1], m:+r[2], d:+r[3], h:+r[4], min:+r[5] } : null;
}
function pvpNowKST() {
  const n = new Date(Date.now() + 9*3600*1000);
  return { y:n.getUTCFullYear(), m:n.getUTCMonth()+1, d:n.getUTCDate(), h:n.getUTCHours(), min:n.getUTCMinutes() };
}
function pvpSyncHidden() {
  const noLimit = document.getElementById('pvpNoLimit')?.checked;
  const fs = document.getElementById('pvpFieldDisplayStart');
  const fe = document.getElementById('pvpFieldDisplayEnd');
  if (fs) fs.value = pvpToStr(pvpPicker.start);
  if (fe) fe.value = noLimit ? '' : pvpToStr(pvpPicker.end);
}
function pvpUpdateDisplay() {
  const noLimit = document.getElementById('pvpNoLimit')?.checked;
  const st = document.getElementById('pvpStartText');
  const et = document.getElementById('pvpEndText');
  const eb = document.getElementById('pvpEndBtn');
  if (st) st.textContent = pvpFmt(pvpPicker.start);
  if (et) et.textContent = noLimit ? '9999-12-31 23:59' : pvpFmt(pvpPicker.end);
  if (eb) { eb.disabled = !!noLimit; eb.classList.toggle('pvp-date-btn-disabled', !!noLimit); }
  pvpSyncHidden();
}
function pvpCalRender() {
  const { calY:y, calM:m } = pvpPicker;
  const cur = pvpPicker.active === 'start' ? pvpPicker.start : pvpPicker.end;
  const titleEl = document.getElementById('pvpCalTitle');
  const tbody   = document.getElementById('pvpCalBody');
  if (!titleEl || !tbody) return;
  titleEl.textContent = `${m}월  ${y}`;
  const firstDay  = new Date(y, m-1, 1).getDay();
  const daysInMon = new Date(y, m, 0).getDate();
  const total     = Math.ceil((firstDay + daysInMon) / 7) * 7;
  let html = '', day = 1;
  for (let i = 0; i < total; i++) {
    if (i % 7 === 0) html += '<tr>';
    if (i < firstDay || day > daysInMon) {
      html += '<td></td>';
    } else {
      const sel = cur && cur.y===y && cur.m===m && cur.d===day;
      html += `<td><button type="button" class="pvp-cal-day${sel?' pvp-cal-sel':''}" data-d="${day}">${day}</button></td>`;
      day++;
    }
    if (i % 7 === 6) html += '</tr>';
  }
  tbody.innerHTML = html;
  const hv = document.getElementById('pvpHVal');
  const mv = document.getElementById('pvpMVal');
  if (hv) hv.textContent = String(cur?.h  ?? 0).padStart(2,'0');
  if (mv) mv.textContent = String(cur?.min ?? 0).padStart(2,'0');
  tbody.querySelectorAll('.pvp-cal-day').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const d   = +btn.dataset.d;
      const prev = pvpPicker.active === 'start' ? pvpPicker.start : pvpPicker.end;
      const nv  = { y, m, d, h: prev?.h ?? 0, min: prev?.min ?? 0 };
      if (pvpPicker.active === 'start') pvpPicker.start = nv;
      else pvpPicker.end = nv;
      pvpCalRender(); pvpUpdateDisplay();
    });
  });
}
function pvpPickerOpen(which) {
  pvpPicker.active = which;
  const cur = which === 'start' ? pvpPicker.start : pvpPicker.end;
  if (cur) { pvpPicker.calY = cur.y; pvpPicker.calM = cur.m; }
  else { const now = pvpNowKST(); pvpPicker.calY = now.y; pvpPicker.calM = now.m; }
  pvpCalRender();
  document.getElementById('pvpCalPopup').style.display = 'block';
}
function pvpPickerClose() {
  pvpPicker.active = null;
  const p = document.getElementById('pvpCalPopup');
  if (p) p.style.display = 'none';
}
function initPvpPicker() {
  document.getElementById('pvpStartBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    pvpPicker.active === 'start' ? pvpPickerClose() : pvpPickerOpen('start');
  });
  document.getElementById('pvpEndBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    if (document.getElementById('pvpNoLimit')?.checked) return;
    pvpPicker.active === 'end' ? pvpPickerClose() : pvpPickerOpen('end');
  });
  document.getElementById('pvpCalPrev')?.addEventListener('click', e => {
    e.stopPropagation();
    pvpPicker.calM--; if (pvpPicker.calM<1){pvpPicker.calM=12;pvpPicker.calY--;} pvpCalRender();
  });
  document.getElementById('pvpCalNext')?.addEventListener('click', e => {
    e.stopPropagation();
    pvpPicker.calM++; if (pvpPicker.calM>12){pvpPicker.calM=1;pvpPicker.calY++;} pvpCalRender();
  });
  function adjTime(target, delta) {
    const cur = pvpPicker.active === 'start' ? pvpPicker.start : pvpPicker.end;
    if (!cur) return;
    if (target==='h') cur.h = (cur.h+delta+24)%24; else cur.min = (cur.min+delta+60)%60;
    pvpCalRender(); pvpUpdateDisplay();
  }
  document.getElementById('pvpHUp')?.addEventListener('click', e => { e.stopPropagation(); adjTime('h',  1); });
  document.getElementById('pvpHDn')?.addEventListener('click', e => { e.stopPropagation(); adjTime('h', -1); });
  document.getElementById('pvpMUp')?.addEventListener('click', e => { e.stopPropagation(); adjTime('m',  1); });
  document.getElementById('pvpMDn')?.addEventListener('click', e => { e.stopPropagation(); adjTime('m', -1); });
  document.getElementById('pvpNoLimit')?.addEventListener('change', () => { pvpPickerClose(); pvpUpdateDisplay(); });
  document.getElementById('pvpFormOverlay')?.addEventListener('click', e => {
    if (!e.target.closest('#pvpCalPopup') && !e.target.closest('#pvpStartBtn') && !e.target.closest('#pvpEndBtn')) {
      pvpPickerClose();
    }
  });
}
initPvpPicker();

let pvpPatchCount = 0;

function openPvpForm(docId) {
  pvpEditDocId = docId || null;
  pvpPatchCount = 0;
  document.getElementById('pvpPatchesList').innerHTML = '';
  document.getElementById('pvpFormError').style.display = 'none';

  // 전역 타입 선택 폼 그룹 숨김 (타입은 항목별로 관리)
  const typeGroup = document.getElementById('pvpFieldType')?.closest('.form-group');
  if (typeGroup) typeGroup.style.display = 'none';

  // 폼 열기 (buildPvpCharDropdown에서 컨테이너 치수 필요)
  document.getElementById('pvpFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  if (docId) {
    const p = _applyPendingOps(allPvpPatches, _pendingPvp).find(x => x._docId === docId);
    if (!p) return;
    const src = (p.hasDraft && p.draftData) ? p.draftData : p;
    document.getElementById('pvpFormTitle').textContent = 'PvP 패치 수정';
    const pdEl = document.getElementById('pvpFieldPatchDate');
    if (pdEl) pdEl.value = src.patchDate || '';
    normalizePvpPatches(src).forEach(item => addPvpPatchRow(item));
    buildPvpCharDropdown(src.charId || '');
    buildPvpSupportCharDropdown(src.supportCharId || '');
    syncPvpExclusiveState();
  } else {
    document.getElementById('pvpFormTitle').textContent = 'PvP 패치 추가';
    const pdEl2 = document.getElementById('pvpFieldPatchDate');
    if (pdEl2) pdEl2.value = '';
    buildPvpCharDropdown('');
    buildPvpSupportCharDropdown('');
    syncPvpExclusiveState();
  }

  document.getElementById('pvpSubmitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('pvpSubmitSpinner').style.display = 'none';
}

function closePvpForm() {
  pvpEditDocId = null;
  pvpPickerClose();
  document.getElementById('pvpFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddPvp')?.addEventListener('click', () => openPvpForm(null));
document.getElementById('pvpFormClose')?.addEventListener('click', closePvpForm);
document.getElementById('pvpFormCancel')?.addEventListener('click', closePvpForm);

function addPvpPatchRow(item = {}) {
  pvpPatchCount++;
  const n    = pvpPatchCount;
  const type = typeof item === 'string' ? '' : (item.type || '');
  const text = typeof item === 'string' ? item : (item.text || '');
  const div  = document.createElement('div');
  div.className = 'sub-item';
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">항목 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove()">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <select class="form-input pvp-patch-type">
        <option value="">타입 선택</option>
        <option value="buff" ${type==='buff'?'selected':''}>▲ 버프</option>
        <option value="nerf" ${type==='nerf'?'selected':''}>▼ 너프</option>
        <option value="fix"  ${type==='fix' ?'selected':''}>✦ 기능 수정</option>
      </select>
      <input type="text" class="form-input pvp-patch-text" placeholder="패치 내용" value="${escHtml(text)}">
    </div>`;
  document.getElementById('pvpPatchesList').appendChild(div);
}

document.getElementById('btnAddPvpPatch')?.addEventListener('click', () => addPvpPatchRow());

document.getElementById('pvpFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('pvpFormError');
  errEl.style.display = 'none';

  const charIdRaw    = document.getElementById('pvpFieldCharId')?.value || '';
  const charId       = charIdRaw ? parseInt(charIdRaw) : null;
  const patches      = [...document.querySelectorAll('#pvpPatchesList .sub-item')].map(el => ({
    type: el.querySelector('.pvp-patch-type')?.value || '',
    text: el.querySelector('.pvp-patch-text')?.value.trim() || '',
  })).filter(p => p.text);
  const patchDate = document.getElementById('pvpFieldPatchDate')?.value || '';
  const supportCharIdRaw = document.getElementById('pvpFieldSupportCharId')?.value || '';
  const supportCharId = supportCharIdRaw ? parseInt(supportCharIdRaw) : null;

  if (!charId && !supportCharId) { errEl.textContent = '캐릭터나 서포트 캐릭터 중 하나를 선택해주세요.'; errEl.style.display = 'block'; return; }
  if (!patches.length) { errEl.textContent = '패치 항목을 1개 이상 추가해주세요.'; errEl.style.display = 'block'; return; }

  const data = { charId, patches, patchDate, supportCharId, updatedBy: getCurrentUserLabel() };

  document.getElementById('pvpFormSubmit').disabled = true;
  const isEditingPvp = !!pvpEditDocId;
  document.getElementById('pvpSubmitBtnText').textContent = isEditingPvp ? '수정 중...' : '등록 중...';
  document.getElementById('pvpSubmitSpinner').style.display = 'inline-block';

  const _pvpIsPendingAdd = pvpEditDocId ? _pendingPvp.some(op => op.action === 'add' && op.tempId === pvpEditDocId) : false;
  if (_pvpIsPendingAdd) {
    const _addOp = _pendingPvp.find(op => op.action === 'add' && op.tempId === pvpEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (pvpEditDocId) {
    _pendingPvp = _pendingPvp.filter(op => !(op.action === 'edit' && op.docId === pvpEditDocId));
    _pendingPvp.push({ action: 'edit', docId: pvpEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingPvp.push({ action: 'add', tempId: _tempId, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closePvpForm();
  const _effPvpPost = _applyPendingOps(allPvpPatches, _pendingPvp);
  renderPvpTable(_effPvpPost);
  updateBarFromDocs(_effPvpPost, 'publishInfoPvp');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('pvpFormSubmit').disabled = false;
  document.getElementById('pvpSubmitBtnText').textContent = isEditingPvp ? '수정' : '등록';
  document.getElementById('pvpSubmitSpinner').style.display = 'none';
});

function deletePvp(docId) {
  openDeleteModal('PvP 패치 삭제', 'PvP 패치를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.', () => {
    const _isPendingAdd = _pendingPvp.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingPvp = _pendingPvp.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingPvp = _pendingPvp.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingPvp = _pendingPvp.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingPvp.push({ action: 'delete', docId });
    }
    const _eff = _applyPendingOps(allPvpPatches, _pendingPvp);
    renderPvpTable(_eff);
    updateBarFromDocs(_eff, 'publishInfoPvp');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

