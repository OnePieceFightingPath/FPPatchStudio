// ============================================================
// BANNERS
// ============================================================

let bannerEditDocId = null;

async function loadBanners() {
  const tbody = document.getElementById('bannerTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('banners').orderBy('order').get();
    allBanners = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    bannerCurrentPage = 1;
    const _effBanners = _applyPendingOps(allBanners, _pendingBanners);
    filteredBannerList = _effBanners;
    renderBannerTable(_effBanners);
    updateBarFromDocs(_effBanners, 'publishInfoBanners');
  } catch (err) {
    try {
      const snap2 = await db.collection('banners').get();
      allBanners = snap2.docs.map(d => ({ _docId: d.id, ...d.data() })).sort((a,b) => (a.order||0)-(b.order||0));
      bannerCurrentPage = 1;
      const _effBanners2 = _applyPendingOps(allBanners, _pendingBanners);
      filteredBannerList = _effBanners2;
      renderBannerTable(_effBanners2);
      updateBarFromDocs(_effBanners2, 'publishInfoBanners');
    } catch (err2) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err2.message)}</td></tr>`;
      showToast('배너 로드 실패', 'error');
    }
  }
}

function renderBannerTable(list) {
  filteredBannerList = list;
  const tbody = document.getElementById('bannerTableBody');
  const label = document.getElementById('bannerCountLabel');
  label.textContent = list.length === allBanners.length
    ? `총 ${list.length}개`
    : `총 ${allBanners.length}개 중 ${list.length}개`;

  const totalPages = Math.max(1, Math.ceil(list.length / bannerPageSize));
  if (bannerCurrentPage > totalPages) bannerCurrentPage = totalPages;

  const start = (bannerCurrentPage - 1) * bannerPageSize;
  const shown = list.slice(start, start + bannerPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">등록된 배너가 없습니다</td></tr>';
    renderPaginator('bannerPaginator', 0, bannerPageSize, bannerCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(b => {
    const d = (b.hasDraft && b.draftData) ? { ...b, ...b.draftData } : b;
    const isVisible = b.visible !== false && d.isActive !== false;
    const hasDraft = !!b.hasDraft;
    const isPendingDelete = !!b.pendingDelete;
    const rowClass = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';
    const safeBannerTitle = escHtml(d.title || '');
    return `
    <tr class="${rowClass}">
      <td style="font-weight:600">${escHtml(String(d.id ?? '-'))}</td>
      <td>
        ${d.imageUrl
          ? `<img class="banner-thumb" src="${escHtml(d.imageUrl)}" alt="${safeBannerTitle}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="banner-thumb-placeholder" style="display:none">이미지 없음</div>`
          : `<div class="banner-thumb-placeholder">이미지 없음</div>`}
      </td>
      <td class="cell-name">${safeBannerTitle || '<span style="color:var(--text-dim)">제목 없음</span>'}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
      <td>
        <span class="btn-toggle ${d.isActive ? 'active' : 'inactive'}" style="cursor:default;pointer-events:none">
          <span class="status-dot"></span>
          ${d.isActive ? 'ON' : 'OFF'}
        </span>
      </td>
      <td>
        <span class="btn-toggle ${isVisible ? 'active' : 'inactive'}" style="cursor:default;pointer-events:none">
          <span class="status-dot"></span>
          ${isVisible ? 'ON' : 'OFF'}
        </span>
      </td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('banners') ? `<button class="btn-edit" data-docid="${escHtml(b._docId)}" onclick="openBannerForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            수정
          </button>` : ''}
          ${canDeleteIn('banners') ? `<button class="btn-delete" data-docid="${escHtml(b._docId)}" data-name="${safeBannerTitle || '배너'}" onclick="deleteBanner(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('bannerPaginator', list.length, bannerPageSize, bannerCurrentPage, (page) => {
    bannerCurrentPage = page;
    renderBannerTable(filteredBannerList);
  });
}

document.getElementById('bannerSearch')?.addEventListener('input', filterBannerTable);
document.getElementById('bannerStatusFilter')?.addEventListener('change', filterBannerTable);


function filterBannerTable() {
  const q      = document.getElementById('bannerSearch').value.toLowerCase();
  const status = document.getElementById('bannerStatusFilter').value;
  let list = _applyPendingOps(allBanners, _pendingBanners);
  if (status === 'active')   list = list.filter(b => b.isActive);
  if (status === 'inactive') list = list.filter(b => !b.isActive);
  if (q) list = list.filter(b => (b.title||'').toLowerCase().includes(q));
  bannerCurrentPage = 1;
  renderBannerTable(list);
}

function toggleBannerActive(docId, newVal) {
  const _isPendingAdd = _pendingBanners.some(op => op.action === 'add' && op.tempId === docId);
  if (_isPendingAdd) {
    const _addOp = _pendingBanners.find(op => op.action === 'add' && op.tempId === docId);
    _addOp.data.isActive = newVal;
  } else {
    const existingEdit = _pendingBanners.find(op => op.action === 'edit' && op.docId === docId);
    if (existingEdit) {
      existingEdit.data = { ...existingEdit.data, isActive: newVal, updatedBy: getCurrentUserLabel(), updatedAt: nowTS() };
    } else {
      const existing = allBanners.find(b => b._docId === docId) || {};
      _pendingBanners.push({ action: 'edit', docId, data: { ...existing, isActive: newVal, updatedBy: getCurrentUserLabel(), updatedAt: nowTS() } });
    }
  }
  const _eff = _applyPendingOps(allBanners, _pendingBanners);
  renderBannerTable(_eff);
  updateBarFromDocs(_eff, 'publishInfoBanners');
  showToast(newVal ? '활성화됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.' : '비활성화됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
}

// ── 배너 링크 타입 UI 헬퍼 ──────────────────────────────────────────
function _setBannerLinkUI(link) {
  const type = /^https?:\/\//i.test(link) ? 'external'
             : /^page:/i.test(link)        ? 'page'
             : 'none';
  document.getElementById('bannerLinkType').value = type;
  document.getElementById('bannerLinkExternalWrap').style.display = type === 'external' ? 'block' : 'none';
  document.getElementById('bannerLinkPageWrap').style.display     = type === 'page'     ? 'block' : 'none';
  if (type === 'external') document.getElementById('bannerFieldLink').value = link;
  if (type === 'page')     document.getElementById('bannerFieldPage').value = link.replace(/^page:/i, '').trim();
}

function _getBannerLinkValue() {
  const type = document.getElementById('bannerLinkType').value;
  if (type === 'external') return document.getElementById('bannerFieldLink').value.trim();
  if (type === 'page')     return 'page:' + document.getElementById('bannerFieldPage').value;
  return '';
}

document.getElementById('bannerLinkType')?.addEventListener('change', e => {
  const type = e.target.value;
  document.getElementById('bannerLinkExternalWrap').style.display = type === 'external' ? 'block' : 'none';
  document.getElementById('bannerLinkPageWrap').style.display     = type === 'page'     ? 'block' : 'none';
});

function openBannerForm(docId) {
  bannerEditDocId = docId || null;
  document.getElementById('bannerFormError').style.display = 'none';

  if (docId) {
    const b = _applyPendingOps(allBanners, _pendingBanners).find(x => x._docId === docId);
    if (!b) return;
    const src = (b.hasDraft && b.draftData) ? b.draftData : b;
    document.getElementById('bannerFormTitle').textContent     = '배너 수정';
    document.getElementById('bannerAutoIdDisplay').value       = src.id ?? b.id ?? '자동 생성';
    const bannerImg = src.imageUrl || '';
    document.getElementById('bannerFieldImageUrl').value = bannerImg;
    document.getElementById('bannerFieldImg').value = '';
    document.getElementById('bannerFieldTitle').value           = src.title    || '';
    _setBannerLinkUI(src.link || '');
    document.getElementById('bannerFieldOrder').value           = src.order    ?? 0;
    document.getElementById('bannerFieldIsActive').checked      = src.isActive !== undefined ? !!src.isActive : true;
    if (bannerImg) { showBannerImgUrl(bannerImg); } else { resetBannerImgWidget(); }
    updateBannerToggleText(!!src.isActive);
  } else {
    const nextId = Math.max(0, ...allBanners.map(b => b.id || 0)) + 1;
    document.getElementById('bannerFormTitle').textContent       = '배너 추가';
    document.getElementById('bannerAutoIdDisplay').value         = nextId;
    document.getElementById('bannerForm').reset();
    document.getElementById('bannerAutoIdDisplay').value         = nextId;
    document.getElementById('bannerFieldImageUrl').value = '';
    document.getElementById('bannerFieldImg').value = '';
    document.getElementById('bannerFieldIsActive').checked = true;
    _setBannerLinkUI('');
    resetBannerImgWidget();
    updateBannerToggleText(true);
  }

  document.getElementById('bannerSubmitBtnText').textContent = bannerEditDocId ? '수정' : '등록';
  document.getElementById('bannerSubmitSpinner').style.display = 'none';
  document.getElementById('bannerFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBannerForm() {
  bannerEditDocId = null;
  document.getElementById('bannerFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddBanner')?.addEventListener('click', () => openBannerForm(null));
document.getElementById('bannerFormClose')?.addEventListener('click', closeBannerForm);
document.getElementById('bannerFormCancel')?.addEventListener('click', closeBannerForm);

function showBannerImgUrl(url) {
  document.getElementById('bannerFieldImgBtnRow').style.display = 'none';
  document.getElementById('bannerFieldImgUrlRow').style.display = 'flex';
  document.getElementById('bannerFieldImgUrlText').textContent = url;
  updateBannerImgPreview(url);
}
function resetBannerImgWidget() {
  document.getElementById('bannerFieldImgBtnRow').style.display = 'flex';
  document.getElementById('bannerFieldImgUrlRow').style.display = 'none';
  updateBannerImgPreview('');
}
document.getElementById('bannerFieldImgRemove')?.addEventListener('click', () => {
  document.getElementById('bannerFieldImageUrl').value = '';
  document.getElementById('bannerFieldImg').value = '';
  resetBannerImgWidget();
});

document.getElementById('bannerImgPreviewBox')?.addEventListener('click', () => {
  document.getElementById('bannerFieldImg')?.click();
});

async function resizeBannerToBlob(file) {
  const TARGET_W = 1920;
  const TARGET_H = 645;
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const srcW = img.naturalWidth;
        const srcH = img.naturalHeight;
        if (!srcW || !srcH) { reject(new Error('이미지 크기를 읽을 수 없습니다')); return; }
        // cover: 1920×645를 꽉 채우고 넘치는 부분 잘라냄
        const scale = Math.max(TARGET_W / srcW, TARGET_H / srcH);
        const dw = Math.round(srcW * scale);
        const dh = Math.round(srcH * scale);
        const oc  = document.createElement('canvas');
        oc.width  = TARGET_W;
        oc.height = TARGET_H;
        const ctx = oc.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 초기화 실패')); return; }
        ctx.drawImage(img, (TARGET_W - dw) / 2, (TARGET_H - dh) / 2, dw, dh);
        oc.toBlob(b => b ? resolve(b) : reject(new Error('리사이즈 실패')), 'image/jpeg', 0.92);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 로드 실패')); };
    img.src = objectUrl;
  });
}

document.getElementById('bannerFieldImg')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast(`파일 용량이 초과되었습니다. 현재 ${(file.size / 1024 / 1024).toFixed(1)} MB · 최대 3 MB`, 'error');
    e.target.value = ''; return;
  }
  document.getElementById('bannerFieldImgBtnRow').style.display = 'none';
  document.getElementById('bannerFieldImgUrlRow').style.display = 'flex';
  document.getElementById('bannerFieldImgUrlText').textContent = '업로드 중...';
  try {
    const resizedBlob = await resizeBannerToBlob(file);
    const resizedFile = new File([resizedBlob], 'banner.jpg', { type: 'image/jpeg' });
    const url = await uploadImageToStorage(resizedFile, 'banners');
    document.getElementById('bannerFieldImageUrl').value = url;
    _bannerEditBlob = resizedFile;
    showBannerImgUrl(url);
  } catch (err) {
    showToast('이미지 업로드 실패: ' + err.message, 'error');
    _bannerEditBlob = null;
    resetBannerImgWidget();
  } finally {
    e.target.value = '';
  }
});
document.getElementById('bannerFieldIsActive')?.addEventListener('change', e => updateBannerToggleText(e.target.checked));

function updateBannerImgPreview(url) {
  const img = document.getElementById('bannerImgPreview');
  const placeholder = document.getElementById('bannerImgPreviewPlaceholder');
  if (url) {
    img.src = url; img.style.display = 'block'; placeholder.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; placeholder.style.display = 'flex'; };
  } else {
    img.style.display = 'none'; placeholder.style.display = 'flex';
  }
}

function updateBannerToggleText(isActive) {
  document.getElementById('bannerToggleText').textContent = isActive ? '활성화 On' : '활성화 Off';
}

document.getElementById('bannerFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('bannerFormError');
  errEl.style.display = 'none';

  const imageUrl = document.getElementById('bannerFieldImageUrl').value;
  const title    = document.getElementById('bannerFieldTitle').value.trim();
  const link     = _getBannerLinkValue();
  const order    = parseInt(document.getElementById('bannerFieldOrder').value) || 0;
  const isActive = document.getElementById('bannerFieldIsActive').checked;

  if (!title) { errEl.textContent = '제목은 필수입니다.'; errEl.style.display = 'block'; return; }
  if (!imageUrl) { errEl.textContent = '이미지 파일을 선택해 주세요.'; errEl.style.display = 'block'; return; }

  const _effBannersForId = _applyPendingOps(allBanners, _pendingBanners);
  const autoId = bannerEditDocId
    ? (_effBannersForId.find(b => b._docId === bannerEditDocId)?.id || Math.max(0, ..._effBannersForId.map(b => b.id || 0)) + 1)
    : Math.max(0, ..._effBannersForId.map(b => b.id || 0)) + 1;

  const data = { id: autoId, imageUrl, title, link, order, isActive, updatedBy: getCurrentUserLabel() };

  const isEditingBanner = !!bannerEditDocId;
  document.getElementById('bannerFormSubmit').disabled = true;
  document.getElementById('bannerSubmitBtnText').textContent = isEditingBanner ? '수정 중...' : '등록 중...';
  document.getElementById('bannerSubmitSpinner').style.display = 'inline-block';

  const _bannerIsPendingAdd = bannerEditDocId ? _pendingBanners.some(op => op.action === 'add' && op.tempId === bannerEditDocId) : false;
  if (_bannerIsPendingAdd) {
    const _addOp = _pendingBanners.find(op => op.action === 'add' && op.tempId === bannerEditDocId);
    Object.assign(_addOp.data, { ...data, updatedAt: nowTS() });
  } else if (bannerEditDocId) {
    _pendingBanners = _pendingBanners.filter(op => !(op.action === 'edit' && op.docId === bannerEditDocId));
    _pendingBanners.push({ action: 'edit', docId: bannerEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    const _tempId = `temp_${Date.now()}`;
    _pendingBanners.push({ action: 'add', tempId: _tempId, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closeBannerForm();
  const _effBannersPost = _applyPendingOps(allBanners, _pendingBanners);
  renderBannerTable(_effBannersPost);
  updateBarFromDocs(_effBannersPost, 'publishInfoBanners');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('bannerFormSubmit').disabled = false;
  document.getElementById('bannerSubmitBtnText').textContent = isEditingBanner ? '수정' : '등록';
  document.getElementById('bannerSubmitSpinner').style.display = 'none';
});

function deleteBanner(docId, title) {
  openDeleteModal('배너 삭제', `"${title}" 배너를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const _isPendingAdd = _pendingBanners.some(op => op.action === 'add' && op.tempId === docId);
    if (_isPendingAdd) {
      _pendingBanners = _pendingBanners.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingBanners = _pendingBanners.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingBanners = _pendingBanners.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingBanners.push({ action: 'delete', docId });
    }
    const _eff = _applyPendingOps(allBanners, _pendingBanners);
    renderBannerTable(_eff);
    updateBarFromDocs(_eff, 'publishInfoBanners');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

// ============================================================
// PUBLISH — 페이지 반영
// ============================================================

async function publishAllInCollection(collectionName, loadFn, btnId, label) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const snap = await db.collection(collectionName).get();
    const batch = db.batch();
    let hasChanges = false;

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pendingDelete) {
        batch.delete(doc.ref);
        hasChanges = true;
      } else if (data.hasDraft && data.draftData) {
        const updateFields = { ...data.draftData, hasDraft: false, visible: true, updatedAt: nowTS() };
        batch.update(doc.ref, { ...updateFields, draftData: firebase.firestore.FieldValue.delete() });
        hasChanges = true;
      } else if (data.visible === false) {
        batch.update(doc.ref, { visible: true });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      await batch.commit();
      // 퍼블리시 메타 저장 (마지막 퍼블리시 정보 표시용)
      await savePublishMeta(collectionName);
      showToast(label + ' 저장되었습니다.', 'success');
    } else {
      showToast('저장할 변경사항이 없습니다.', 'info');
    }
    await loadFn();
  } catch (err) {
    showToast('저장 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

async function revertAllInCollection(collectionName, loadFn, btnId, label) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.textContent = '되돌리는 중...'; }
  try {
    const snap = await db.collection(collectionName).get();
    const batch = db.batch();
    let hasChanges = false;

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pendingDelete) {
        batch.update(doc.ref, { pendingDelete: firebase.firestore.FieldValue.delete(), visible: true });
        hasChanges = true;
      } else if (data.hasDraft) {
        batch.update(doc.ref, { hasDraft: false, draftData: firebase.firestore.FieldValue.delete() });
        hasChanges = true;
      } else if (data.visible === false) {
        batch.delete(doc.ref);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      await batch.commit();
      showToast(label + ' 마지막 저장 버전으로 되돌렸습니다.', 'success');
    } else {
      showToast('되돌릴 변경사항이 없습니다.', 'info');
    }
    await loadFn();
  } catch (err) {
    showToast('되돌리기 실패: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '마지막 저장 버전으로 되돌리기'; }
  }
}

