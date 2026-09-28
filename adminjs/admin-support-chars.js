// ============================================================
// SUPPORT CHARACTERS
// ============================================================

let scEditDocId = null;
let scSupportSkillCount = 0, scTipCount = 0;
let _scEditBlob = null;

async function loadSupportChars() {
  const tbody = document.getElementById('scTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('supportCharacters').get();
    allSupportChars = snap.docs.map(d => ({ _docId: d.id, ...d.data() })).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    scCurrentPage = 1;
    const _effSC = _applyPendingOps(allSupportChars, _pendingSC);
    filteredSupportCharList = _effSC;
    renderSupportCharTable(_effSC);
    updateBarFromDocs(_effSC, 'publishInfoSupportChars');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err.message)}</td></tr>`;
    showToast('서포트 캐릭터 로드 실패', 'error');
  }
}

function renderSupportCharTable(list) {
  filteredSupportCharList = list;
  const tbody = document.getElementById('scTableBody');
  const label = document.getElementById('scCountLabel');
  if (!tbody || !label) return;
  label.textContent = list.length === allSupportChars.length
    ? `총 ${list.length}명`
    : `총 ${allSupportChars.length}명 중 ${list.length}명`;

  const totalPages = Math.max(1, Math.ceil(list.length / scPageSize));
  if (scCurrentPage > totalPages) scCurrentPage = totalPages;

  const start = (scCurrentPage - 1) * scPageSize;
  const shown = list.slice(start, start + scPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">서포트 캐릭터가 없습니다</td></tr>';
    renderPaginator('scPaginator', 0, scPageSize, scCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(c => {
    const d = (c.hasDraft && c.draftData) ? { ...c, ...c.draftData } : c;
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
      <td><span class="${isVisible ? 'badge-visible-on' : 'badge-visible-off'}">${isVisible ? 'ON' : 'OFF'}</span></td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('supportChars') ? `<button class="btn-edit" data-docid="${escHtml(c._docId)}" onclick="openSupportCharForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            수정
          </button>` : ''}
          ${canDeleteIn('supportChars') ? `<button class="btn-delete" data-docid="${escHtml(c._docId)}" data-name="${safeName}" onclick="deleteSupportChar(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('scPaginator', list.length, scPageSize, scCurrentPage, (page) => {
    scCurrentPage = page;
    renderSupportCharTable(filteredSupportCharList);
  });
}

document.getElementById('scGradeFilter')?.addEventListener('change', filterSupportCharTable);
document.getElementById('scAttributeFilter')?.addEventListener('change', filterSupportCharTable);
document.getElementById('scBattleTypeFilter')?.addEventListener('change', filterSupportCharTable);
document.getElementById('scCharSearch')?.addEventListener('input', filterSupportCharTable);

function filterSupportCharTable() {
  const q     = (document.getElementById('scCharSearch')?.value || '').toLowerCase();
  const grade = document.getElementById('scGradeFilter')?.value || 'all';
  let list = _applyPendingOps(allSupportChars, _pendingSC);
  if (grade !== 'all') list = list.filter(c => c.grade === grade);
  if (q) list = list.filter(c => (c.name||'').toLowerCase().includes(q));
  scCurrentPage = 1;
  renderSupportCharTable(list);
}

document.getElementById('scPerPage')?.addEventListener('change', e => {
  scPageSize = +e.target.value;
  scCurrentPage = 1;
  renderSupportCharTable(filteredSupportCharList);
});

// ---- Support Character form ----

function openSupportCharForm(docId) {
  scEditDocId = docId || null;
  scSupportSkillCount = 0; scTipCount = 0;
  document.getElementById('scSupportSkillsList').innerHTML = '';
  document.getElementById('scTipsList').innerHTML = '';
  document.getElementById('scFormError').style.display = 'none';

  if (docId) {
    const c = _applyPendingOps(allSupportChars, _pendingSC).find(x => x._docId === docId);
    if (!c) return;
    const src = (c.hasDraft && c.draftData) ? c.draftData : c;
    document.getElementById('scFormTitle').textContent = '서포트 캐릭터 수정';
    document.getElementById('scAutoIdDisplay').value   = src.id ?? c.id ?? '자동 생성';
    document.getElementById('scFieldName').value       = src.name || '';
    document.getElementById('scFieldGrade').value      = src.grade || '';
    const charImg = src.img || '';
    document.getElementById('scFieldImgData').value = charImg;
    document.getElementById('scFieldImg').value = '';
    _scEditBlob = null;
    if (charImg) { showScImgUrl(charImg); } else { resetScImgWidget(); }
    (src.supportSkills || []).forEach(s => addScSupportSkillRow(s));
    (src.tips || []).forEach(t => addScTipRow(t));
  } else {
    const nextId = Math.max(0, ...allSupportChars.map(c => c.id || 0)) + 1;
    document.getElementById('scFormTitle').textContent = '서포트 캐릭터 추가';
    document.getElementById('scAutoIdDisplay').value   = nextId;
    document.getElementById('scForm').reset();
    document.getElementById('scAutoIdDisplay').value   = nextId;
    document.getElementById('scFieldImgData').value = '';
    document.getElementById('scFieldImg').value = '';
    _scEditBlob = null;
    resetScImgWidget();
  }
  document.getElementById('scSubmitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('scSubmitSpinner').style.display = 'none';
  ['scSupportSkillsList', 'scTipsList'].forEach(id => {
    const list = document.getElementById(id);
    if (!list) return;
    if (docId) {
      list.parentElement.classList.add('skill-collapsed');
    } else {
      list.parentElement.classList.remove('skill-collapsed');
    }
  });
  if (docId) {
    updateSkillCount('scSupportSkillsList', 'scSupportSkillCountBadge');
    updateSkillCount('scTipsList', 'scTipCountBadge');
  } else {
    document.getElementById('scSupportSkillCountBadge').style.display = 'none';
    document.getElementById('scTipCountBadge').style.display = 'none';
  }
  document.getElementById('scFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSupportCharForm() {
  scEditDocId = null;
  document.getElementById('scFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddSupportChar')?.addEventListener('click', () => openSupportCharForm(null));
document.getElementById('scFormClose')?.addEventListener('click', closeSupportCharForm);
document.getElementById('scFormCancel')?.addEventListener('click', closeSupportCharForm);

function showScImgUrl(url) {
  document.getElementById('scFieldImgBtnRow').style.display = 'none';
  document.getElementById('scFieldImgUrlRow').style.display = 'flex';
  document.getElementById('scFieldImgUrlText').textContent = url;
  updateScImgPreview(url);
}
function resetScImgWidget() {
  document.getElementById('scFieldImgBtnRow').style.display = 'flex';
  document.getElementById('scFieldImgUrlRow').style.display = 'none';
  updateScImgPreview('');
}
function updateScImgPreview(url) {
  const img = document.getElementById('scImgPreview');
  const placeholder = document.getElementById('scImgPreviewPlaceholder');
  if (!img || !placeholder) return;
  if (url) {
    img.src = url; img.style.display = 'block'; placeholder.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'flex'; };
  } else {
    img.style.display = 'none'; placeholder.style.display = 'flex';
  }
}

document.getElementById('scFieldImgRemove')?.addEventListener('click', () => {
  document.getElementById('scFieldImgData').value = '';
  document.getElementById('scFieldImg').value = '';
  _scEditBlob = null;
  resetScImgWidget();
});
document.getElementById('scImgPreviewBox')?.addEventListener('click', () => {
  document.getElementById('scFieldImg')?.click();
});
document.getElementById('scFieldImg')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast(`파일 용량이 초과되었습니다. 현재 ${(file.size / 1024 / 1024).toFixed(1)} MB · 최대 3 MB`, 'error');
    e.target.value = ''; return;
  }
  document.getElementById('scFieldImgBtnRow').style.display = 'none';
  document.getElementById('scFieldImgUrlRow').style.display = 'flex';
  document.getElementById('scFieldImgUrlText').textContent = '업로드 중...';
  try {
    const url = await uploadImageToStorage(file, 'supportCharacters');
    document.getElementById('scFieldImgData').value = url;
    _scEditBlob = file;
    showScImgUrl(url);
  } catch (err) {
    showToast('이미지 업로드 실패: ' + err.message, 'error');
    e.target.value = '';
    _scEditBlob = null;
    resetScImgWidget();
  }
  e.target.value = '';
});

function addScSupportSkillRow(data = {}) {
  scSupportSkillCount++;
  const n = scSupportSkillCount;
  expandSkillSection('scSupportSkillsList', 'scSupportSkillCountBadge');
  const div = document.createElement('div');
  div.className = 'sub-item';
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">서포트 스킬 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove(); updateSkillCount('scSupportSkillsList','scSupportSkillCountBadge');">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <input type="text" class="form-input support-name" placeholder="서포트 스킬 이름" value="${escHtml(data.name||'')}">
      <textarea class="form-input support-desc" placeholder="스킬 설명" rows="2">${escHtml(data.desc||'')}</textarea>
    </div>`;
  document.getElementById('scSupportSkillsList').appendChild(div);
  updateSkillCount('scSupportSkillsList', 'scSupportSkillCountBadge');
}

function addScTipRow(data = {}) {
  scTipCount++;
  const n = scTipCount;
  expandSkillSection('scTipsList', 'scTipCountBadge');
  const div = document.createElement('div');
  div.className = 'sub-item';
  div.innerHTML = `
    <div class="sub-item-header">
      <span class="sub-item-num">꿀팁 #${n}</span>
      <button type="button" class="btn-remove-sub" onclick="this.closest('.sub-item').remove();updateSkillCount('scTipsList','scTipCountBadge')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="sub-item-fields">
      <textarea class="form-input tip-text" placeholder="꿀팁 내용을 입력하세요" rows="2">${escHtml(data.text||'')}</textarea>
    </div>`;
  document.getElementById('scTipsList').appendChild(div);
  updateSkillCount('scTipsList', 'scTipCountBadge');
}

document.getElementById('scBtnAddSupportSkill')?.addEventListener('click', () => addScSupportSkillRow());
document.getElementById('scBtnAddTip')?.addEventListener('click', () => addScTipRow());

document.getElementById('scFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('scFormError');
  errEl.style.display = 'none';

  const name  = document.getElementById('scFieldName').value.trim();
  const grade = document.getElementById('scFieldGrade').value;
  const img   = document.getElementById('scFieldImgData').value;

  if (!name || !grade || !img) {
    errEl.textContent = '등급, 이름, 이미지 파일은 필수입니다.';
    errEl.style.display = 'block'; return;
  }

  const _effSCForId = _applyPendingOps(allSupportChars, _pendingSC);
  const autoId = scEditDocId
    ? (_effSCForId.find(c => c._docId === scEditDocId)?.id || Math.max(0, ..._effSCForId.map(c => c.id || 0)) + 1)
    : Math.max(0, ..._effSCForId.map(c => c.id || 0)) + 1;

  const supportSkills = [...document.querySelectorAll('#scSupportSkillsList .sub-item')].map(el => ({
    name: el.querySelector('.support-name')?.value.trim() || '',
    desc: el.querySelector('.support-desc')?.value.trim() || '',
  })).filter(s => s.name);

  const tips = [...document.querySelectorAll('#scTipsList .sub-item')].map(el => ({
    text: el.querySelector('.tip-text')?.value.trim() || '',
  })).filter(t => t.text);

  const data = { id: autoId, name, grade, img, supportSkills, tips, updatedBy: getCurrentUserLabel() };

  const isEditing = !!scEditDocId;
  document.getElementById('scFormSubmit').disabled = true;
  document.getElementById('scSubmitBtnText').textContent = isEditing ? '수정 중...' : '등록 중...';
  document.getElementById('scSubmitSpinner').style.display = 'inline-block';

  const _scIsPendingAdd = scEditDocId ? _pendingSC.some(op => op.action === 'add' && op.tempId === scEditDocId) : false;
  if (_scIsPendingAdd) {
    const _addOp = _pendingSC.find(op => op.action === 'add' && op.tempId === scEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (scEditDocId) {
    _pendingSC = _pendingSC.filter(op => !(op.action === 'edit' && op.docId === scEditDocId));
    _pendingSC.push({ action: 'edit', docId: scEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingSC.push({ action: 'add', tempId: _tempId, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closeSupportCharForm();
  const _effSCPost = _applyPendingOps(allSupportChars, _pendingSC);
  renderSupportCharTable(_effSCPost);
  updateBarFromDocs(_effSCPost, 'publishInfoSupportChars');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('scFormSubmit').disabled = false;
  document.getElementById('scSubmitBtnText').textContent = isEditing ? '수정' : '등록';
  document.getElementById('scSubmitSpinner').style.display = 'none';
});

function deleteSupportChar(docId, name) {
  openDeleteModal('서포트 캐릭터 삭제', `"${name}" 서포트 캐릭터를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const _isPendingAdd = _pendingSC.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingSC = _pendingSC.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingSC = _pendingSC.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingSC = _pendingSC.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingSC.push({ action: 'delete', docId });
    }
    const _eff = _applyPendingOps(allSupportChars, _pendingSC);
    renderSupportCharTable(_eff);
    updateBarFromDocs(_eff, 'publishInfoSupportChars');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

async function publishSupportChars() {
  if (!_pendingSC.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishSupportChars');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingSC) {
      if (op.action === 'add') batch.set(db.collection('supportCharacters').doc(), { ...op.data, visible: true });
      else if (op.action === 'edit') batch.update(db.collection('supportCharacters').doc(op.docId), { ...op.data, visible: true, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('supportCharacters').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('supportCharacters');
    _pendingSC = [];
    showToast('서포트 캐릭터 저장되었습니다.', 'success');
    await loadSupportChars();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}
async function revertSupportChars() {
  if (!_pendingSC.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingSC = [];
  const _eff = _applyPendingOps(allSupportChars, _pendingSC);
  renderSupportCharTable(_eff);
  updateBarFromDocs(_eff, 'publishInfoSupportChars');
  showToast('서포트 캐릭터 변경사항을 되돌렸습니다.', 'success');
}

