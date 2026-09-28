// ============================================================
// CHARACTERS
// ============================================================

let charEditDocId = null;

async function loadCharacters() {
  const tbody = document.getElementById('charTableBody');
  tbody.innerHTML = '<tr><td colspan="9" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('characters').get();
    allCharacters = snap.docs.map(d => ({ _docId: d.id, ...d.data() })).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    charCurrentPage = 1;
    const _effC = _applyPendingOps(allCharacters, _pendingChars);
    filteredCharList = _effC;
    renderCharTable(_effC);
    updatePvpCharSelect();
    updateBarFromDocs(_effC, 'publishInfoChars');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="table-empty">로드 실패: ${escHtml(err.message)}</td></tr>`;
    showToast('캐릭터 로드 실패', 'error');
  }
}

function renderCharTable(list) {
  filteredCharList = list;
  const tbody = document.getElementById('charTableBody');
  const label = document.getElementById('charCountLabel');
  label.textContent = list.length === allCharacters.length
    ? `총 ${list.length}명`
    : `총 ${allCharacters.length}명 중 ${list.length}명`;

  const totalPages = Math.max(1, Math.ceil(list.length / charPageSize));
  if (charCurrentPage > totalPages) charCurrentPage = totalPages;

  const start = (charCurrentPage - 1) * charPageSize;
  const shown = list.slice(start, start + charPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">캐릭터가 없습니다</td></tr>';
    renderPaginator('charPaginator', 0, charPageSize, charCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(c => {
    const d = (c.hasDraft && c.draftData) ? { ...c, ...c.draftData } : c;
    const attr = getAttributeFromChar(d);
    const attrClass = attr === '力' ? 'force' : attr === '技' ? 'ki' : attr === '心' ? 'sim' : '';
    const bType = getBattleTypeFromChar(d);
    const isVisible = c.visible !== false;
    const hasDraft = !!c.hasDraft;
    const isPendingDelete = !!c.pendingDelete;
    const rowClass = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';
    const safeName = escHtml(d.name || '');
    return `
    <tr class="${rowClass}">
      <td><span class="cell-id">#${escHtml(String(d.id || '-'))}</span></td>
      <td>
        ${d.img ? `<img class="cell-img" src="${escHtml(d.img)}" alt="${safeName}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}
        <div class="cell-img-placeholder" style="${d.img ? 'display:none' : ''}">${escHtml((d.name||'?')[0])}</div>
      </td>
      <td class="cell-name">${safeName || '-'}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
      <td>${d.grade ? `<span class="grade-badge grade-${escHtml(d.grade)}">${escHtml(d.grade)}</span>` : '<span style="color:var(--text-dim)">-</span>'}</td>
      <td><span class="type-badge ${attrClass}">${escHtml(attr) || '-'}</span></td>
      <td>${bType ? `<span class="type-badge">${escHtml(bType)}</span>` : '<span style="color:var(--text-dim)">-</span>'}</td>
      <td><span class="${isVisible ? 'badge-visible-on' : 'badge-visible-off'}">${isVisible ? 'ON' : 'OFF'}</span></td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('characters') ? `<button class="btn-edit" data-docid="${escHtml(c._docId)}" onclick="openCharForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            수정
          </button>` : ''}
          ${canDeleteIn('characters') ? `<button class="btn-delete" data-docid="${escHtml(c._docId)}" data-name="${safeName}" onclick="deleteChar(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('charPaginator', list.length, charPageSize, charCurrentPage, (page) => {
    charCurrentPage = page;
    renderCharTable(filteredCharList);
  });
}

// ===== 속성/타입 헬퍼 =====
function getAttributeFromChar(c) {
  if (c.attribute) return c.attribute;
  const map = { force: '力', ki: '技', sim: '心' };
  return map[c.type] || '';
}
function getBattleTypeFromChar(c) {
  if (c.attribute) return c.type || '';
  return '';
}

// ---- Character search/filter ----
document.getElementById('adminCharSearch')?.addEventListener('input', filterCharTable);
document.getElementById('adminGradeFilter')?.addEventListener('change', filterCharTable);
document.getElementById('adminAttributeFilter')?.addEventListener('change', filterCharTable);
document.getElementById('adminBattleTypeFilter')?.addEventListener('change', filterCharTable);


function filterCharTable() {
  const q          = document.getElementById('adminCharSearch').value.toLowerCase();
  const grade      = document.getElementById('adminGradeFilter')?.value || 'all';
  const attribute  = document.getElementById('adminAttributeFilter')?.value || 'all';
  const battleType = document.getElementById('adminBattleTypeFilter')?.value || 'all';
  let list = _applyPendingOps(allCharacters, _pendingChars);
  if (grade !== 'all')      list = list.filter(c => c.grade === grade);
  if (attribute !== 'all')  list = list.filter(c => getAttributeFromChar(c) === attribute);
  if (battleType !== 'all') list = list.filter(c => getBattleTypeFromChar(c) === battleType);
  if (q) list = list.filter(c => (c.name||'').toLowerCase().includes(q));
  charCurrentPage = 1;
  renderCharTable(list);
}

// ---- Character form ----
let skillCount = 0, supportSkillCount = 0, tipCount = 0;

function openCharForm(docId) {
  charEditDocId = docId || null;
  skillCount = 0; supportSkillCount = 0; tipCount = 0;
  document.getElementById('skillsList').innerHTML = '';
  document.getElementById('supportSkillsList').innerHTML = '';
  document.getElementById('tipsList').innerHTML = '';
  document.getElementById('formError').style.display = 'none';

  if (docId) {
    const c = _applyPendingOps(allCharacters, _pendingChars).find(x => x._docId === docId);
    if (!c) return;
    const src = (c.hasDraft && c.draftData) ? c.draftData : c;
    document.getElementById('charFormTitle').textContent   = '캐릭터 수정';
    document.getElementById('charAutoIdDisplay').value    = src.id ?? c.id ?? '자동 생성';
    document.getElementById('fieldName').value      = src.name || '';
    document.getElementById('fieldGrade').value     = src.grade || '';
    document.getElementById('fieldAttribute').value = src.attribute || getAttributeFromChar(src) || '';
    document.getElementById('fieldType').value      = getBattleTypeFromChar(src);
    const charImg = src.img || '';
    document.getElementById('fieldImgData').value = charImg;
    document.getElementById('fieldImg').value = '';
    _charEditBlob = null;  // 이전 업로드 Blob 초기화 — 편집기는 Cloudinary URL로 열림
    if (charImg) { showCharImgUrl(charImg); } else { resetCharImgWidget(); }
    (src.skills || []).forEach(s => addSkillRow(s));
    (src.supportSkills || []).forEach(s => addSupportSkillRow(s));
    (src.tips || []).forEach(t => addTipRow(t));
  } else {
    const nextId = Math.max(0, ...allCharacters.map(c => c.id || 0)) + 1;
    document.getElementById('charFormTitle').textContent = '캐릭터 추가';
    document.getElementById('charAutoIdDisplay').value   = nextId;
    document.getElementById('charForm').reset();
    document.getElementById('charAutoIdDisplay').value   = nextId;
    document.getElementById('fieldImgData').value = '';
    document.getElementById('fieldImg').value = '';
    _charEditBlob = null;  // 새 캐릭터 추가 시 Blob 초기화
    resetCharImgWidget();
  }
  document.getElementById('submitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('submitSpinner').style.display = 'none';
  // 스킬/꿀팁 섹션 접힘 상태 초기화 (수정 모드: 접힘, 추가 모드: 펼침)
  ['skillsList', 'supportSkillsList', 'tipsList'].forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;
    if (docId) {
      list.parentElement.classList.add('skill-collapsed');
    } else {
      list.parentElement.classList.remove('skill-collapsed');
    }
  });
  if (docId) {
    updateSkillCount('skillsList', 'skillCountBadge');
    updateSkillCount('supportSkillsList', 'supportSkillCountBadge');
    updateSkillCount('tipsList', 'tipCountBadge');
  } else {
    document.getElementById('skillCountBadge').style.display = 'none';
    document.getElementById('supportSkillCountBadge').style.display = 'none';
    document.getElementById('tipCountBadge').style.display = 'none';
  }
  document.getElementById('charFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCharForm() {
  charEditDocId = null;
  document.getElementById('charFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddChar')?.addEventListener('click', () => openCharForm(null));
document.getElementById('charFormClose')?.addEventListener('click', closeCharForm);
document.getElementById('charFormCancel')?.addEventListener('click', closeCharForm);

function showCharImgUrl(url) {
  document.getElementById('fieldImgBtnRow').style.display = 'none';
  document.getElementById('fieldImgUrlRow').style.display = 'flex';
  document.getElementById('fieldImgUrlText').textContent = url;
  updateImgPreview(url);
}
function resetCharImgWidget() {
  document.getElementById('fieldImgBtnRow').style.display = 'flex';
  document.getElementById('fieldImgUrlRow').style.display = 'none';
  updateImgPreview('');
}
document.getElementById('fieldImgRemove')?.addEventListener('click', () => {
  document.getElementById('fieldImgData').value = '';
  document.getElementById('fieldImg').value = '';
  _charEditBlob = null;
  resetCharImgWidget();
});

document.getElementById('charImgPreviewBox')?.addEventListener('click', () => {
  document.getElementById('fieldImg')?.click();
});

document.getElementById('fieldImg')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast(`파일 용량이 초과되었습니다. 현재 ${(file.size / 1024 / 1024).toFixed(1)} MB · 최대 3 MB`, 'error');
    e.target.value = ''; return;
  }
  // 즉시 업로드 → 등록 완료 후 편집 버튼으로 편집기 열기
  document.getElementById('fieldImgBtnRow').style.display = 'none';
  document.getElementById('fieldImgUrlRow').style.display = 'flex';
  document.getElementById('fieldImgUrlText').textContent = '업로드 중...';
  try {
    const url = await uploadImageToStorage(file, 'characters');
    document.getElementById('fieldImgData').value = url;
    _charEditBlob = file;
    showCharImgUrl(url);
  } catch (err) {
    showToast('이미지 업로드 실패: ' + err.message, 'error');
    e.target.value = '';
    _charEditBlob = null;
    resetCharImgWidget();
  }
  e.target.value = '';
});

function updateImgPreview(url) {
  const img = document.getElementById('imgPreview');
  const placeholder = document.getElementById('imgPreviewPlaceholder');
  if (url) {
    img.src = url; img.style.display = 'block'; placeholder.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'flex'; };
  } else {
    img.style.display = 'none'; placeholder.style.display = 'flex';
  }
}

/* ── 스킬 섹션 접기/펼치기 ── */
function toggleSkillSection(listId, badgeId, toggleBtnId) {
  const list = document.getElementById(listId);
  const section = list.parentElement;
  const badge = document.getElementById(badgeId);
  const isCollapsed = section.classList.toggle('skill-collapsed');
  if (badge) {
    const count = list.querySelectorAll('.sub-item').length;
    badge.textContent = count;
    badge.style.display = (isCollapsed && count > 0) ? 'inline-flex' : 'none';
  }
}

function updateSkillCount(listId, badgeId) {
  const list = document.getElementById(listId);
  const badge = document.getElementById(badgeId);
  if (!list || !badge) return;
  const count = list.querySelectorAll('.sub-item').length;
  badge.textContent = count;
  const section = list.parentElement;
  if (section.classList.contains('skill-collapsed')) {
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

function expandSkillSection(listId, badgeId) {
  const list = document.getElementById(listId);
  if (!list) return;
  const section = list.parentElement;
  if (section.classList.contains('skill-collapsed')) {
    section.classList.remove('skill-collapsed');
    const badge = document.getElementById(badgeId);
    if (badge) badge.style.display = 'none';
  }
}

function addSkillRow(data = {}) {
  skillCount++;
  const n = skillCount;
  expandSkillSection('skillsList', 'skillCountBadge');
  const div = document.createElement('div');
  div.className = 'sub-item';
  div.dataset.idx = n;
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">스킬 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove(); updateSkillCount('skillsList','skillCountBadge');">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <input type="text" class="form-input skill-name" placeholder="스킬 이름" value="${data.name||''}">
      <textarea class="form-input skill-desc" placeholder="스킬 설명" rows="2">${data.desc||''}</textarea>
    </div>`;
  document.getElementById('skillsList').appendChild(div);
  updateSkillCount('skillsList', 'skillCountBadge');
}

function addSupportSkillRow(data = {}) {
  supportSkillCount++;
  const n = supportSkillCount;
  expandSkillSection('supportSkillsList', 'supportSkillCountBadge');
  const div = document.createElement('div');
  div.className = 'sub-item';
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">서포트 스킬 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove(); updateSkillCount('supportSkillsList','supportSkillCountBadge');">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <input type="text" class="form-input support-name" placeholder="서포트 스킬 이름" value="${data.name||''}">
      <textarea class="form-input support-desc" placeholder="스킬 설명" rows="2">${data.desc||''}</textarea>
    </div>`;
  document.getElementById('supportSkillsList').appendChild(div);
  updateSkillCount('supportSkillsList', 'supportSkillCountBadge');
}

function addTipRow(data = {}) {
  tipCount++;
  const n = tipCount;
  expandSkillSection('tipsList', 'tipCountBadge');
  const div = document.createElement('div');
  div.className = 'sub-item';
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">꿀팁 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove();updateSkillCount('tipsList','tipCountBadge')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <textarea class="form-input tip-text" placeholder="꿀팁 내용을 입력하세요" rows="2">${data.text||''}</textarea>
    </div>`;
  document.getElementById('tipsList').appendChild(div);
  updateSkillCount('tipsList', 'tipCountBadge');
}

document.getElementById('btnAddSkill')?.addEventListener('click', () => {
  const presetCheck = document.getElementById('skillPresetCheck');
  if (presetCheck?.checked) {
    const defaultSkills = [
      '1 스킬', '1 스킬 부가', '2 스킬', '2 스킬 부가',
      '3 스킬 (필살기)', '4 스킬 (궁극기)', '카드 스킬 1', '카드 스킬 2',
    ];
    defaultSkills.forEach(name => addSkillRow({ name, desc: '' }));
    presetCheck.checked = false;
  } else {
    addSkillRow();
  }
});
document.getElementById('btnAddSupportSkill')?.addEventListener('click', () => addSupportSkillRow());
document.getElementById('btnAddTip')?.addEventListener('click', () => addTipRow());

document.getElementById('charFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('formError');
  errEl.style.display = 'none';

  const name      = document.getElementById('fieldName').value.trim();
  const grade     = document.getElementById('fieldGrade').value;
  const attribute = document.getElementById('fieldAttribute').value;
  const type      = document.getElementById('fieldType').value;
  const img       = document.getElementById('fieldImgData').value;

  if (!name || !grade || !attribute || !type || !img) {
    errEl.textContent = '등급, 속성, 특성, 이름, 이미지 파일은 필수입니다.'; errEl.style.display = 'block'; return;
  }

  const _effCharsForId = _applyPendingOps(allCharacters, _pendingChars);
  const autoId = charEditDocId
    ? (_effCharsForId.find(c => c._docId === charEditDocId)?.id || Math.max(0, ..._effCharsForId.map(c => c.id || 0)) + 1)
    : Math.max(0, ..._effCharsForId.map(c => c.id || 0)) + 1;

  const skills = [...document.querySelectorAll('#skillsList .sub-item')].map(el => ({
    name: el.querySelector('.skill-name')?.value.trim() || '',
    desc: el.querySelector('.skill-desc')?.value.trim() || '',
  })).filter(s => s.name);

  const supportSkills = [...document.querySelectorAll('#supportSkillsList .sub-item')].map(el => ({
    name: el.querySelector('.support-name')?.value.trim() || '',
    desc: el.querySelector('.support-desc')?.value.trim() || '',
  })).filter(s => s.name);

  const tips = [...document.querySelectorAll('#tipsList .sub-item')].map(el => ({
    text: el.querySelector('.tip-text')?.value.trim() || '',
  })).filter(t => t.text);


  const data = { id: autoId, name, grade, attribute, type, img, skills, supportSkills, tips, updatedBy: getCurrentUserLabel() };

  const isEditing = !!charEditDocId;
  document.getElementById('charFormSubmit').disabled = true;
  document.getElementById('submitBtnText').textContent = isEditing ? '수정 중...' : '등록 중...';
  document.getElementById('submitSpinner').style.display = 'inline-block';

  const _charIsPendingAdd = charEditDocId ? _pendingChars.some(op => op.action === 'add' && op.tempId === charEditDocId) : false;
  if (_charIsPendingAdd) {
    const _addOp = _pendingChars.find(op => op.action === 'add' && op.tempId === charEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (charEditDocId) {
    _pendingChars = _pendingChars.filter(op => !(op.action === 'edit' && op.docId === charEditDocId));
    _pendingChars.push({ action: 'edit', docId: charEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingChars.push({ action: 'add', tempId: _tempId, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closeCharForm();
  const _effCharsPost = _applyPendingOps(allCharacters, _pendingChars);
  renderCharTable(_effCharsPost);
  updateBarFromDocs(_effCharsPost, 'publishInfoChars');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('charFormSubmit').disabled = false;
  document.getElementById('submitBtnText').textContent = isEditing ? '수정' : '등록';
  document.getElementById('submitSpinner').style.display = 'none';
});

function deleteChar(docId, name) {
  openDeleteModal('캐릭터 삭제', `"${name}" 캐릭터를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const _isPendingAdd = _pendingChars.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingChars = _pendingChars.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingChars = _pendingChars.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingChars = _pendingChars.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingChars.push({ action: 'delete', docId });
    }
    const _eff = _applyPendingOps(allCharacters, _pendingChars);
    renderCharTable(_eff);
    updateBarFromDocs(_eff, 'publishInfoChars');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

