// ============================================================
// PATCH NOTES
// ============================================================

let pnEditDocId = null;

async function loadPatchNotes() {
  const tbody = document.getElementById('patchNoteTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('patchNotes').orderBy('date', 'desc').get();
    allPatchNotes = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    patchCurrentPage = 1;
    const _effPatch = _applyPendingOps(allPatchNotes, _pendingPatch);
    filteredPatchList = _effPatch;
    renderPatchNoteTable(_effPatch);
    updateBarFromDocs(_effPatch, 'publishInfoPatch');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err.message)}</td></tr>`;
    showToast('패치노트 로드 실패', 'error');
  }
}

function renderPatchNoteTable(list) {
  filteredPatchList = list;
  const tbody = document.getElementById('patchNoteTableBody');
  const label = document.getElementById('patchNoteCountLabel');
  label.textContent = list.length === allPatchNotes.length
    ? `총 ${list.length}건`
    : `총 ${allPatchNotes.length}건 중 ${list.length}건`;

  const totalPages = Math.max(1, Math.ceil(list.length / patchPageSize));
  if (patchCurrentPage > totalPages) patchCurrentPage = totalPages;

  const start = (patchCurrentPage - 1) * patchPageSize;
  const shown = list.slice(start, start + patchPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">패치노트가 없습니다</td></tr>';
    renderPaginator('patchPaginator', 0, patchPageSize, patchCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(p => {
    const d = (p.hasDraft && p.draftData) ? { ...p, ...p.draftData } : p;
    const isVisible = p.visible !== false;
    const hasDraft = !!p.hasDraft;
    const isPendingDelete = !!p.pendingDelete;
    const rowClass = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';
    const safeTitle = escHtml(d.title || '');
    return `
    <tr class="${rowClass}">
      <td class="cell-id">#${escHtml(String(d.id ?? '-'))}</td>
      <td>${escHtml(d.date || '-')}</td>
      <td class="cell-name">${safeTitle || '-'}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
      <td><span class="${isVisible ? 'badge-visible-on' : 'badge-visible-off'}">${isVisible ? 'ON' : 'OFF'}</span></td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('patchNotes') ? `<button class="btn-edit" data-docid="${escHtml(p._docId)}" onclick="openPatchNoteForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            수정
          </button>` : ''}
          ${canDeleteIn('patchNotes') ? `<button class="btn-delete" data-docid="${escHtml(p._docId)}" data-name="${safeTitle}" onclick="deletePatchNote(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('patchPaginator', list.length, patchPageSize, patchCurrentPage, (page) => {
    patchCurrentPage = page;
    renderPatchNoteTable(filteredPatchList);
  });
}

document.getElementById('patchNoteSearch')?.addEventListener('input', () => {
  const q = document.getElementById('patchNoteSearch').value.toLowerCase();
  patchCurrentPage = 1;
  renderPatchNoteTable(q ? allPatchNotes.filter(p => (p.title||'').toLowerCase().includes(q)) : allPatchNotes);
});


// ── Summernote 초기화 (패치노트) ────────────────────────────────────
    function initCKEditor() {
    if ($('#pnEditor').next('.note-editor').length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      $('#pnEditor').summernote({
        lang: 'ko-KR', height: 300,
        fontSizes: ['11', '13', '15', '16', '19', '24', '28', '30', '34', '38'],
        placeholder: '패치노트 본문 내용을 입력하세요...',
        toolbar: [
          ['style', ['bold', 'italic', 'underline', 'strikethrough', 'clear']],
          ['font',  ['fontsize', 'color']],
          ['para',  ['ul', 'ol', 'paragraph']],
          ['table', ['table']],
          ['insert',['link', 'picture']],
          ['view',  ['fullscreen', 'codeview']]
        ],
        callbacks: {
          onImageUpload: async function(files) {
            for (const file of files) {
              try {
                const url = await uploadImageToStorage(file, 'patches');
                $('#pnEditor').summernote('insertImage', url, file.name || '이미지');
              } catch (e) { showToast('이미지 업로드 실패: ' + e.message, 'error'); }
            }
          }
        }
      });
      resolve();
    });
    }
    
async function openPatchNoteForm(docId) {
  pnEditDocId = docId || null;
  document.getElementById('pnFormError').style.display = 'none';

  const content = (() => {
    if (docId) {
      const p = _applyPendingOps(allPatchNotes, _pendingPatch).find(x => x._docId === docId);
      if (!p) return '';
      const src = (p.hasDraft && p.draftData) ? p.draftData : p;
      document.getElementById('patchNoteFormTitle').textContent = '패치노트 수정';
      document.getElementById('pnAutoIdDisplay').value  = src.id ?? p.id ?? '자동 생성';
      document.getElementById('pnFieldDate').value    = src.date || '';
      document.getElementById('pnFieldTitle').value   = src.title || '';
      return src.content || '';
    } else {
      const nextId = Math.max(0, ...allPatchNotes.map(p => p.id || 0)) + 1;
      document.getElementById('patchNoteFormTitle').textContent = '패치노트 추가';
      document.getElementById('pnAutoIdDisplay').value  = nextId;
      document.getElementById('pnFieldDate').value    = new Date().toISOString().split('T')[0];
      document.getElementById('pnFieldTitle').value   = '';
      return '';
    }
  })();

  document.getElementById('patchNoteFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('pnSubmitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('pnSubmitSpinner').style.display = 'none';

  await initCKEditor();
  $('#pnEditor').summernote('code', content || '');
}

function closePatchNoteForm() {
  pnEditDocId = null;
  document.getElementById('patchNoteFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddPatchNote')?.addEventListener('click', () => openPatchNoteForm(null));
document.getElementById('patchNoteFormClose')?.addEventListener('click', closePatchNoteForm);
document.getElementById('patchNoteFormCancel')?.addEventListener('click', closePatchNoteForm);

document.getElementById('patchNoteFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('pnFormError');
  errEl.style.display = 'none';

  const date    = document.getElementById('pnFieldDate').value;
  const title   = document.getElementById('pnFieldTitle').value.trim();
  const content = $('#pnEditor').summernote('code') || '';

  if (!date || !title) { errEl.textContent = '날짜, 제목은 필수입니다.'; errEl.style.display = 'block'; return; }
  if (!content) { errEl.textContent = '본문은 필수입니다.'; errEl.style.display = 'block'; return; }

  const _effPatchForId = _applyPendingOps(allPatchNotes, _pendingPatch);
  const autoId = pnEditDocId
    ? (_effPatchForId.find(p => p._docId === pnEditDocId)?.id || Math.max(0, ..._effPatchForId.map(p => p.id || 0)) + 1)
    : Math.max(0, ..._effPatchForId.map(p => p.id || 0)) + 1;

  const data = { id: autoId, date, title, content, updatedBy: getCurrentUserLabel() };

  const isEditingPn = !!pnEditDocId;
  document.getElementById('patchNoteFormSubmit').disabled = true;
  document.getElementById('pnSubmitBtnText').textContent = isEditingPn ? '수정 중...' : '등록 중...';
  document.getElementById('pnSubmitSpinner').style.display = 'inline-block';

  const _pnIsPendingAdd = pnEditDocId ? _pendingPatch.some(op => op.action === 'add' && op.tempId === pnEditDocId) : false;
  if (_pnIsPendingAdd) {
    const _addOp = _pendingPatch.find(op => op.action === 'add' && op.tempId === pnEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (pnEditDocId) {
    _pendingPatch = _pendingPatch.filter(op => !(op.action === 'edit' && op.docId === pnEditDocId));
    _pendingPatch.push({ action: 'edit', docId: pnEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingPatch.push({ action: 'add', tempId: _tempId, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closePatchNoteForm();
  const _effPatchPost = _applyPendingOps(allPatchNotes, _pendingPatch);
  renderPatchNoteTable(_effPatchPost);
  updateBarFromDocs(_effPatchPost, 'publishInfoPatch');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('patchNoteFormSubmit').disabled = false;
  document.getElementById('pnSubmitBtnText').textContent = isEditingPn ? '수정' : '등록';
  document.getElementById('pnSubmitSpinner').style.display = 'none';
});

function deletePatchNote(docId, title) {
  openDeleteModal('패치노트 삭제', `"${title}" 패치노트를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const _isPendingAdd = _pendingPatch.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingPatch = _pendingPatch.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingPatch = _pendingPatch.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingPatch = _pendingPatch.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingPatch.push({ action: 'delete', docId });
    }
    const _eff = _applyPendingOps(allPatchNotes, _pendingPatch);
    renderPatchNoteTable(_eff);
    updateBarFromDocs(_eff, 'publishInfoPatch');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

