// ============================================================
// NOTICES (공지사항)
// ============================================================

let noticeEditDocId  = null;
let allNotices       = [];
let _pendingNotices  = [];
let noticePageSize   = 10;
let noticeCurrentPage = 1;
let filteredNoticeList = [];

async function loadNotices() {
  const tbody = document.getElementById('noticeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('notices').orderBy('createdAt', 'desc').get();
    allNotices = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    noticeCurrentPage = 1;
    const eff = _applyPendingOps(allNotices, _pendingNotices);
    filteredNoticeList = eff;
    renderNoticeTable(eff);
    updateBarFromDocs(eff, 'publishInfoNotices');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">로드 실패: ${escHtml(err.message)}</td></tr>`;
    showToast('공지사항 로드 실패', 'error');
  }
}

function renderNoticeTable(list) {
  filteredNoticeList = list;
  const tbody = document.getElementById('noticeTableBody');
  const label = document.getElementById('noticeCountLabel');
  if (!tbody) return;
  if (label) {
    label.textContent = list.length === allNotices.length
      ? `총 ${list.length}건`
      : `총 ${allNotices.length}건 중 ${list.length}건`;
  }

  const totalPages = Math.max(1, Math.ceil(list.length / noticePageSize));
  if (noticeCurrentPage > totalPages) noticeCurrentPage = totalPages;

  const start = (noticeCurrentPage - 1) * noticePageSize;
  const shown = list.slice(start, start + noticePageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">공지사항이 없습니다</td></tr>';
    renderPaginator('noticePaginator', 0, noticePageSize, noticeCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(n => {
    const d = (n.hasDraft && n.draftData) ? { ...n, ...n.draftData } : n;
    const isVisible = n.visible !== false;
    const isPinned  = !!d.pinned;
    const hasDraft  = !!n.hasDraft;
    const isPendingDelete = !!n.pendingDelete;
    const rowClass  = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';
    const safeTitle = escHtml(d.title || '');
    const dateStr   = n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString('ko-KR') : '—';
    return `
    <tr class="${rowClass}">
      <td>${isPinned ? '<span class="badge-visible-on">고정</span>' : '<span style="color:var(--text-muted);font-size:12px">—</span>'}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
      <td class="cell-name">${safeTitle || '—'}</td>
      <td><span class="${isVisible ? 'badge-visible-on' : 'badge-visible-off'}">${isVisible ? 'ON' : 'OFF'}</span></td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${dateStr}</div></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('notices') ? `<button class="btn-edit" data-docid="${escHtml(n._docId)}" onclick="openNoticeForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            수정
          </button>` : ''}
          ${canDeleteIn('notices') ? `<button class="btn-delete" data-docid="${escHtml(n._docId)}" data-name="${safeTitle}" onclick="deleteNotice(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('noticePaginator', list.length, noticePageSize, noticeCurrentPage, (page) => {
    noticeCurrentPage = page;
    renderNoticeTable(filteredNoticeList);
  });
}

document.getElementById('noticeSearch')?.addEventListener('input', () => {
  const q = document.getElementById('noticeSearch').value.toLowerCase();
  noticeCurrentPage = 1;
  const eff = _applyPendingOps(allNotices, _pendingNotices);
  renderNoticeTable(q ? eff.filter(n => (n.title || '').toLowerCase().includes(q)) : eff);
});

// ── Summernote 초기화 (공지사항) ────────────────────────────────────
function initNoticeEditor() {
  if ($('#noticeEditor').next('.note-editor').length > 0) return Promise.resolve();
  return new Promise((resolve) => {
    $('#noticeEditor').summernote({
      lang: 'ko-KR', height: 280,
      fontSizes: ['11', '13', '15', '16', '19', '24', '28'],
      placeholder: '공지사항 본문을 입력하세요...',
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
              const url = await uploadImageToStorage(file, 'notices');
              $('#noticeEditor').summernote('insertImage', url, file.name || '이미지');
            } catch (e) { showToast('이미지 업로드 실패: ' + e.message, 'error'); }
          }
        }
      }
    });
    resolve();
  });
}

async function openNoticeForm(docId) {
  noticeEditDocId = docId || null;
  document.getElementById('noticeFormError').style.display = 'none';

  const content = (() => {
    if (docId) {
      const n = _applyPendingOps(allNotices, _pendingNotices).find(x => x._docId === docId);
      if (!n) return '';
      const src = (n.hasDraft && n.draftData) ? n.draftData : n;
      document.getElementById('noticeFormTitle').textContent = '공지사항 수정';
      document.getElementById('noticeFieldTitle').value   = src.title   || '';
      document.getElementById('noticeFieldPinned').checked = !!src.pinned;
      document.getElementById('noticeFieldVisible').checked = src.visible !== false;
      return src.content || '';
    } else {
      document.getElementById('noticeFormTitle').textContent = '공지사항 추가';
      document.getElementById('noticeFieldTitle').value   = '';
      document.getElementById('noticeFieldPinned').checked  = false;
      document.getElementById('noticeFieldVisible').checked = true;
      return '';
    }
  })();

  document.getElementById('noticeFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('noticeSubmitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('noticeSubmitSpinner').style.display = 'none';

  await initNoticeEditor();
  $('#noticeEditor').summernote('code', content || '');
}

function closeNoticeForm() {
  noticeEditDocId = null;
  document.getElementById('noticeFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddNotice')?.addEventListener('click', () => openNoticeForm(null));
document.getElementById('noticeFormClose')?.addEventListener('click', closeNoticeForm);
document.getElementById('noticeFormCancel')?.addEventListener('click', closeNoticeForm);

document.getElementById('noticeFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('noticeFormError');
  errEl.style.display = 'none';

  const title   = document.getElementById('noticeFieldTitle').value.trim();
  const pinned  = document.getElementById('noticeFieldPinned').checked;
  const visible = document.getElementById('noticeFieldVisible').checked;
  const content = $('#noticeEditor').summernote('code') || '';

  if (!title)   { errEl.textContent = '제목은 필수입니다.';   errEl.style.display = 'block'; return; }
  if (!content) { errEl.textContent = '본문은 필수입니다.';   errEl.style.display = 'block'; return; }

  const data = { title, content, pinned, visible, updatedBy: getCurrentUserLabel() };

  const isEditing = !!noticeEditDocId;
  document.getElementById('noticeFormSubmit').disabled = true;
  document.getElementById('noticeSubmitBtnText').textContent = isEditing ? '수정 중...' : '등록 중...';
  document.getElementById('noticeSubmitSpinner').style.display = 'inline-block';

  const _isPendingAdd = noticeEditDocId ? _pendingNotices.some(op => op.action === 'add' && op.tempId === noticeEditDocId) : false;
  if (_isPendingAdd) {
    const _addOp = _pendingNotices.find(op => op.action === 'add' && op.tempId === noticeEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (noticeEditDocId) {
    _pendingNotices = _pendingNotices.filter(op => !(op.action === 'edit' && op.docId === noticeEditDocId));
    _pendingNotices.push({ action: 'edit', docId: noticeEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingNotices.push({ action: 'add', tempId: _tempId, data: { ...data, createdAt: nowTS(), updatedAt: nowTS() } });
  }

  closeNoticeForm();
  const eff = _applyPendingOps(allNotices, _pendingNotices);
  renderNoticeTable(eff);
  updateBarFromDocs(eff, 'publishInfoNotices');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('noticeFormSubmit').disabled = false;
  document.getElementById('noticeSubmitBtnText').textContent = isEditing ? '수정' : '등록';
  document.getElementById('noticeSubmitSpinner').style.display = 'none';
});

function deleteNotice(docId, title) {
  openDeleteModal('공지사항 삭제', `"${title}" 공지사항을 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const _isPendingAdd = _pendingNotices.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingNotices = _pendingNotices.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingNotices = _pendingNotices.filter(op => !(op.action === 'edit'   && op.docId === docId));
      _pendingNotices = _pendingNotices.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingNotices.push({ action: 'delete', docId });
    }
    const eff = _applyPendingOps(allNotices, _pendingNotices);
    renderNoticeTable(eff);
    updateBarFromDocs(eff, 'publishInfoNotices');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

// ── 저장 / 되돌리기 ──────────────────────────────────────────────
async function publishNotices() {
  if (!canPublishIn('notices')) { showToast('저장 권한이 없습니다.', 'error'); return; }
  const btn = document.getElementById('btnPublishNotices');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    for (const op of _pendingNotices) {
      if (op.action === 'add') {
        await firestoreWrite(db.collection('notices').add(op.data));
      } else if (op.action === 'edit') {
        await firestoreWrite(db.collection('notices').doc(op.docId).update(op.data));
      } else if (op.action === 'delete') {
        await firestoreWrite(db.collection('notices').doc(op.docId).delete());
      }
    }
    _pendingNotices = [];
    await loadNotices();
    showToast('공지사항이 저장됐습니다.', 'success');
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

async function revertNotices() {
  if (!_pendingNotices.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingNotices = [];
  const eff = _applyPendingOps(allNotices, _pendingNotices);
  renderNoticeTable(eff);
  updateBarFromDocs(eff, 'publishInfoNotices');
  showToast('마지막 저장 버전으로 되돌렸습니다.', 'success');
}

// per-page select
document.getElementById('noticePerPage')?.addEventListener('change', function() {
  noticePageSize    = parseInt(this.value) || 10;
  noticeCurrentPage = 1;
  renderNoticeTable(filteredNoticeList);
});
