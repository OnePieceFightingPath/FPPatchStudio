// ============================================================
// PUBLISH META — 마지막 퍼블리시 정보 저장/표시
// ============================================================

// 퍼블리시 후 publishMeta 컬렉션에 정보 기록
async function savePublishMeta(collectionName) {
  try {
    const now    = new Date();
    const label  = getCurrentUserLabel();
    // 이름(닉네임)과 이메일을 분리해서 저장
    const parenIdx = label.lastIndexOf(' (');
    const name  = parenIdx !== -1 ? label.slice(0, parenIdx) : label;
    const email = parenIdx !== -1 ? label.slice(parenIdx + 2, -1) : label;
    await db.collection('publishMeta').doc(collectionName).set({
      publishedBy:    label,
      publishedName:  name,
      publishedEmail: email,
      publishedAt:    firebase.firestore.Timestamp.fromDate(now),
    });
    // 저장 후 해당 섹션의 UI 바로 갱신
    const infoId = _publishMetaMap[collectionName];
    if (infoId) {
      renderPublishInfo(infoId, { publishedName: name, publishedEmail: email, publishedAt: firebase.firestore.Timestamp.fromDate(now) });
    }
  } catch (e) {
    // 메타 저장 실패는 조용히 무시 (퍼블리시 자체는 성공)
    console.warn('publishMeta 저장 실패:', e);
  }
}

// collectionName ↔ 정보 표시 엘리먼트 ID 매핑
const _publishMetaMap = {
  characters:        'publishInfoChars',
  pvpPatch:          'publishInfoPvp',
  patchNotes:        'publishInfoPatch',
  banners:           'publishInfoBanners',
  eventBanners:      'publishInfoEvtBanners',
  supportCharacters: 'publishInfoSupportChars',
};

// 단일 컬렉션의 퍼블리시 메타를 Firestore에서 읽어 표시
async function loadPublishMeta(collectionName, infoElId) {
  try {
    const snap = await db.collection('publishMeta').doc(collectionName).get();
    if (!snap.exists) return;
    renderPublishInfo(infoElId, snap.data());
  } catch (e) {
    // 실패해도 UI는 영향 없음
  }
}

// 4개 섹션 메타 동시 로드
async function loadAllPublishMeta() {
  await Promise.all(
    Object.entries(_publishMetaMap).map(([col, elId]) => loadPublishMeta(col, elId))
  );
}

// 날짜/시간을 "YYYY. MM. DD. HH:MM" 형식으로 변환
function formatPublishDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 정보 엘리먼트에 마지막 변경 정보 렌더링
function renderPublishInfo(infoElId, data) {
  const el = document.getElementById(infoElId);
  if (!el || !data) return;
  const dateStr = formatPublishDate(data.publishedAt);
  // 전체 레이블 (닉네임 (이메일) 또는 이메일만)
  const userLabel = data.publishedName && data.publishedEmail && data.publishedName !== data.publishedEmail
    ? `${escapeHtml(data.publishedName)} (${escapeHtml(data.publishedEmail)})`
    : escapeHtml(data.publishedName || data.publishedEmail || '—');
  el.innerHTML = `
    <span class="publish-info-label">마지막 변경</span>
    <span class="publish-info-item">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      ${userLabel}
    </span>
    <span class="publish-info-sep">·</span>
    <span class="publish-info-item">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      ${dateStr || '—'}
    </span>
  `;
  el.style.display = 'flex';
}

// escapeHtml 은 escHtml 의 별칭 (중복 방지 — escHtml 을 사용하세요)
const escapeHtml = escHtml;

async function publishChars() {
  if (!_pendingChars.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishChars');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingChars) {
      if (op.action === 'add') batch.set(db.collection('characters').doc(), { ...op.data, visible: true });
      else if (op.action === 'edit') batch.update(db.collection('characters').doc(op.docId), { ...op.data, visible: true, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('characters').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('characters');
    _pendingChars = [];
    showToast('캐릭터 저장되었습니다.', 'success');
    await loadCharacters();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}
async function publishPvpPatches() {
  if (!_pendingPvp.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishPvp');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingPvp) {
      if (op.action === 'add') batch.set(db.collection('pvpPatch').doc(), { ...op.data, visible: true });
      else if (op.action === 'edit') batch.update(db.collection('pvpPatch').doc(op.docId), { ...op.data, visible: true, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('pvpPatch').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('pvpPatch');
    _pendingPvp = [];
    showToast('PvP 패치 저장되었습니다.', 'success');
    await loadPvpPatches();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}
async function publishPatchNotes() {
  if (!_pendingPatch.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishPatchNotes');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingPatch) {
      if (op.action === 'add') batch.set(db.collection('patchNotes').doc(), { ...op.data, visible: true });
      else if (op.action === 'edit') batch.update(db.collection('patchNotes').doc(op.docId), { ...op.data, visible: true, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('patchNotes').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('patchNotes');
    _pendingPatch = [];
    showToast('패치노트 저장되었습니다.', 'success');
    await loadPatchNotes();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}
async function publishBanners() {
  if (!_pendingBanners.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishBanners');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingBanners) {
      if (op.action === 'add') {
        const newVisible = op.data.isActive !== false;
        batch.set(db.collection('banners').doc(), { ...op.data, visible: newVisible });
      } else if (op.action === 'edit') {
        const newVisible = op.data.isActive !== false;
        batch.update(db.collection('banners').doc(op.docId), {
          ...op.data,
          visible: newVisible,
          hasDraft: firebase.firestore.FieldValue.delete(),
          draftData: firebase.firestore.FieldValue.delete(),
        });
      } else if (op.action === 'delete') {
        batch.delete(db.collection('banners').doc(op.docId));
      }
    }
    await batch.commit();
    await savePublishMeta('banners');
    _pendingBanners = [];
    showToast('배너 저장되었습니다.', 'success');
    await loadBanners();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}

async function revertChars() {
  if (!_pendingChars.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingChars = [];
  const _eff = _applyPendingOps(allCharacters, _pendingChars);
  renderCharTable(_eff); updateBarFromDocs(_eff, 'publishInfoChars');
  showToast('캐릭터 변경사항을 되돌렸습니다.', 'success');
}
async function revertPvpPatches() {
  if (!_pendingPvp.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingPvp = [];
  const _eff = _applyPendingOps(allPvpPatches, _pendingPvp);
  renderPvpTable(_eff); updateBarFromDocs(_eff, 'publishInfoPvp');
  showToast('PvP 패치 변경사항을 되돌렸습니다.', 'success');
}
async function revertPatchNotes() {
  if (!_pendingPatch.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingPatch = [];
  const _eff = _applyPendingOps(allPatchNotes, _pendingPatch);
  renderPatchNoteTable(_eff); updateBarFromDocs(_eff, 'publishInfoPatch');
  showToast('패치노트 변경사항을 되돌렸습니다.', 'success');
}
async function revertBanners() {
  if (!_pendingBanners.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingBanners = [];
  const _eff = _applyPendingOps(allBanners, _pendingBanners);
  renderBannerTable(_eff); updateBarFromDocs(_eff, 'publishInfoBanners');
  showToast('배너 변경사항을 되돌렸습니다.', 'success');
}

// ============================================================
// EVENTS SECTION — 이벤트 배너 (banners 컬렉션) + 이벤트 페이지 (events 컬렉션)
// ============================================================

// ── 상태 변수 ──
let evtBnrEditDocId = null;
let evtPgEditDocId  = null;
let allEvtBanners   = [];
let allEvtPages     = [];
let _pendingEvtBanners = [];
let _pendingEvtPages   = [];
let evtBannerCurrentPage = 1;
let evtPageCurrentPage   = 1;
let evtBannerPageSize    = 10;
let evtPagePageSize      = 10;
let filteredEvtBannerList = [];
let filteredEvtPageList   = [];
let oEvtEditors = [];
let _evtPgThumbUrl = '';
let _evtActiveTab = 'evtBanner';

// ── 탭 전환 ──
document.querySelectorAll('.evt-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    _evtActiveTab = btn.dataset.evttab;
    document.querySelectorAll('.evt-tab').forEach(b => b.classList.toggle('active', b === btn));
    const isBanner = _evtActiveTab === 'evtBanner';
    document.getElementById('evtPanelBanner').style.display        = isBanner ? '' : 'none';
    document.getElementById('evtPanelPage').style.display          = isBanner ? 'none' : '';
    document.getElementById('btnAddEvtBanner').style.display       = isBanner ? '' : 'none';
    document.getElementById('btnAddEvtPage').style.display         = isBanner ? 'none' : '';
    document.getElementById('evtBannerPublishBar').style.display   = isBanner ? '' : 'none';
    document.getElementById('evtPagePublishBar').style.display     = isBanner ? 'none' : '';
  });
});

// ============================================================
// 이벤트 배너 (banners 컬렉션)
// ============================================================

async function loadEvtBanners() {
  const tbody = document.getElementById('evtBannerTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('eventBanners').orderBy('order').get();
    allEvtBanners = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    evtBannerCurrentPage = 1;
    const eff = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
    filteredEvtBannerList = eff;
    renderEvtBannerTable(eff);
    updateBarFromDocs(eff, 'publishInfoEvtBanners');
  } catch (err) {
    try {
      const snap2 = await db.collection('eventBanners').get();
      allEvtBanners = snap2.docs.map(d => ({ _docId: d.id, ...d.data() })).sort((a,b)=>(a.order||0)-(b.order||0));
      evtBannerCurrentPage = 1;
      const eff2 = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
      filteredEvtBannerList = eff2;
      renderEvtBannerTable(eff2);
      updateBarFromDocs(eff2, 'publishInfoEvtBanners');
    } catch (err2) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err2.message)}</td></tr>`;
      showToast('이벤트 배너 로드 실패', 'error');
    }
  }
}

function renderEvtBannerTable(list) {
  filteredEvtBannerList = list;
  const tbody = document.getElementById('evtBannerTableBody');
  if (!tbody) return;
  const label = document.getElementById('evtBannerCountLabel');
  if (label) label.textContent = list.length === allEvtBanners.length
    ? `총 ${list.length}개`
    : `총 ${allEvtBanners.length}개 중 ${list.length}개`;

  const totalPages = Math.max(1, Math.ceil(list.length / evtBannerPageSize));
  if (evtBannerCurrentPage > totalPages) evtBannerCurrentPage = totalPages;
  const start = (evtBannerCurrentPage - 1) * evtBannerPageSize;
  const shown = list.slice(start, start + evtBannerPageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">등록된 이벤트 배너가 없습니다</td></tr>';
    renderPaginator('evtBannerPaginator', 0, evtBannerPageSize, evtBannerCurrentPage, () => {});
    return;
  }

  tbody.innerHTML = shown.map(b => {
    const d = (b.hasDraft && b.draftData) ? { ...b, ...b.draftData } : b;
    const isVisible = b.visible !== false && d.isActive !== false;
    const hasDraft = !!b.hasDraft;
    const isPendingDelete = !!b.pendingDelete;
    const rowClass = isPendingDelete ? 'row-pending-delete' : hasDraft ? 'row-has-draft' : '';
    const safeTitle = escHtml(d.title || '');
    return `
    <tr class="${rowClass}">
      <td style="font-weight:600">${escHtml(String(d.id ?? '-'))}</td>
      <td>
        ${d.imageUrl
          ? `<img class="banner-thumb" src="${escHtml(d.imageUrl)}" alt="${safeTitle}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
             <div class="banner-thumb-placeholder" style="display:none">이미지 없음</div>`
          : `<div class="banner-thumb-placeholder">이미지 없음</div>`}
      </td>
      <td class="cell-name">${safeTitle || '<span style="color:var(--text-dim)">제목 없음</span>'}${isPendingDelete ? '<span class="badge-pending-delete">삭제 예정</span>' : ''}</td>
      <td>
        <span class="btn-toggle ${d.isActive ? 'active' : 'inactive'}" style="cursor:default;pointer-events:none">
          <span class="status-dot"></span>${d.isActive ? 'ON' : 'OFF'}
        </span>
      </td>
      <td>
        <span class="btn-toggle ${isVisible ? 'active' : 'inactive'}" style="cursor:default;pointer-events:none">
          <span class="status-dot"></span>${isVisible ? 'ON' : 'OFF'}
        </span>
      </td>
      <td><span class="admin-email-cell">${escHtml(resolveAdminLabel(d.updatedBy))}</span></td>
      <td>
        <div class="cell-actions">
          ${canEditIn('events') ? `<button class="btn-edit" data-docid="${escHtml(b._docId)}" onclick="openEvtBnrForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>수정
          </button>` : ''}
          ${canDeleteIn('events') ? `<button class="btn-delete" data-docid="${escHtml(b._docId)}" data-name="${safeTitle || '배너'}" onclick="deleteEvtBanner(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('evtBannerPaginator', list.length, evtBannerPageSize, evtBannerCurrentPage, (page) => {
    evtBannerCurrentPage = page;
    renderEvtBannerTable(filteredEvtBannerList);
  });
}

document.getElementById('evtBannerSearch')?.addEventListener('input', filterEvtBannerTable);
document.getElementById('evtBannerStatusFilter')?.addEventListener('change', filterEvtBannerTable);
document.getElementById('evtBannerPerPage')?.addEventListener('change', e => {
  evtBannerPageSize = parseInt(e.target.value) || 10;
  evtBannerCurrentPage = 1;
  renderEvtBannerTable(filteredEvtBannerList);
});

function filterEvtBannerTable() {
  const q      = (document.getElementById('evtBannerSearch')?.value || '').toLowerCase();
  const status = document.getElementById('evtBannerStatusFilter')?.value || 'all';
  let list = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
  if (status === 'active')   list = list.filter(b => b.isActive);
  if (status === 'inactive') list = list.filter(b => !b.isActive);
  if (q) list = list.filter(b => (b.title||'').toLowerCase().includes(q));
  evtBannerCurrentPage = 1;
  renderEvtBannerTable(list);
}

function _setEvtBnrLinkUI(link) {
  const type = /^https?:\/\//i.test(link) ? 'external'
             : /^page:/i.test(link)        ? 'page'
             : 'none';
  document.getElementById('evtBnrLinkType').value = type;
  document.getElementById('evtBnrLinkExternalWrap').style.display = type === 'external' ? 'block' : 'none';
  document.getElementById('evtBnrLinkPageWrap').style.display     = type === 'page'     ? 'block' : 'none';
  if (type === 'external') document.getElementById('evtBnrFieldLink').value = link;
  if (type === 'page')     document.getElementById('evtBnrFieldPage').value = link.replace(/^page:/i, '').trim();
}
function _getEvtBnrLinkValue() {
  const type = document.getElementById('evtBnrLinkType').value;
  if (type === 'external') return document.getElementById('evtBnrFieldLink').value.trim();
  if (type === 'page')     return 'page:' + document.getElementById('evtBnrFieldPage').value;
  return '';
}
document.getElementById('evtBnrLinkType')?.addEventListener('change', e => {
  document.getElementById('evtBnrLinkExternalWrap').style.display = e.target.value === 'external' ? 'block' : 'none';
  document.getElementById('evtBnrLinkPageWrap').style.display     = e.target.value === 'page'     ? 'block' : 'none';
});

function showEvtBnrImgUrl(url) {
  document.getElementById('evtBnrFieldImgBtnRow').style.display = 'none';
  document.getElementById('evtBnrFieldImgUrlRow').style.display = 'flex';
  document.getElementById('evtBnrFieldImgUrlText').textContent = url;
  _updateEvtBnrImgPreview(url);
}
function resetEvtBnrImgWidget() {
  document.getElementById('evtBnrFieldImgBtnRow').style.display = 'flex';
  document.getElementById('evtBnrFieldImgUrlRow').style.display = 'none';
  _updateEvtBnrImgPreview('');
}
function _updateEvtBnrImgPreview(url) {
  const img = document.getElementById('evtBnrImgPreview');
  const ph  = document.getElementById('evtBnrImgPreviewPlaceholder');
  if (url) {
    img.src = url; img.style.display = 'block'; ph.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  } else {
    img.style.display = 'none'; ph.style.display = 'flex';
  }
}
function _updateEvtBnrToggleText(isActive) {
  const el = document.getElementById('evtBnrToggleText');
  if (el) el.textContent = isActive ? '활성화 On' : '활성화 Off';
}

document.getElementById('evtBnrFieldIsActive')?.addEventListener('change', e => _updateEvtBnrToggleText(e.target.checked));
document.getElementById('evtBnrFieldImgRemove')?.addEventListener('click', () => {
  document.getElementById('evtBnrFieldImageUrl').value = '';
  document.getElementById('evtBnrFieldImg').value = '';
  resetEvtBnrImgWidget();
});
document.getElementById('evtBnrImgPreviewBox')?.addEventListener('click', () => {
  document.getElementById('evtBnrFieldImg')?.click();
});
document.getElementById('evtBnrFieldImg')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast(`파일 용량 초과 (${(file.size/1024/1024).toFixed(1)}MB / 최대 3MB)`, 'error');
    e.target.value = ''; return;
  }
  document.getElementById('evtBnrFieldImgBtnRow').style.display = 'none';
  document.getElementById('evtBnrFieldImgUrlRow').style.display = 'flex';
  document.getElementById('evtBnrFieldImgUrlText').textContent = '업로드 중...';
  try {
    const resized = await resizeBannerToBlob(file);
    const resizedFile = new File([resized], 'evt-banner.jpg', { type: 'image/jpeg' });
    const url = await uploadImageToStorage(resizedFile, 'banners');
    document.getElementById('evtBnrFieldImageUrl').value = url;
    showEvtBnrImgUrl(url);
  } catch (err) {
    showToast('이미지 업로드 실패: ' + err.message, 'error');
    resetEvtBnrImgWidget();
  } finally { e.target.value = ''; }
});

function openEvtBnrForm(docId) {
  evtBnrEditDocId = docId || null;
  document.getElementById('evtBnrFormError').style.display = 'none';
  if (docId) {
    const b = _applyPendingOps(allEvtBanners, _pendingEvtBanners).find(x => x._docId === docId);
    if (!b) return;
    const src = (b.hasDraft && b.draftData) ? b.draftData : b;
    document.getElementById('evtBnrFormTitle').textContent  = '이벤트 배너 수정';
    document.getElementById('evtBnrAutoIdDisplay').value    = src.id ?? b.id ?? '자동 생성';
    document.getElementById('evtBnrFieldTitle').value       = src.title || '';
    document.getElementById('evtBnrFieldOrder').value       = src.order ?? 0;
    document.getElementById('evtBnrFieldIsActive').checked  = src.isActive !== undefined ? !!src.isActive : true;
    document.getElementById('evtBnrFieldImageUrl').value    = src.imageUrl || '';
    document.getElementById('evtBnrFieldImg').value         = '';
    _setEvtBnrLinkUI(src.link || '');
    if (src.imageUrl) showEvtBnrImgUrl(src.imageUrl); else resetEvtBnrImgWidget();
    _updateEvtBnrToggleText(!!src.isActive);
  } else {
    const nextId = Math.max(0, ...allEvtBanners.map(b => b.id || 0)) + 1;
    document.getElementById('evtBnrFormTitle').textContent  = '이벤트 배너 추가';
    document.getElementById('evtBnrAutoIdDisplay').value    = nextId;
    document.getElementById('evtBnrForm').reset();
    document.getElementById('evtBnrAutoIdDisplay').value    = nextId;
    document.getElementById('evtBnrFieldImageUrl').value    = '';
    document.getElementById('evtBnrFieldImg').value         = '';
    document.getElementById('evtBnrFieldIsActive').checked  = true;
    _setEvtBnrLinkUI('');
    resetEvtBnrImgWidget();
    _updateEvtBnrToggleText(true);
  }
  document.getElementById('evtBnrSubmitBtnText').textContent = evtBnrEditDocId ? '수정' : '등록';
  document.getElementById('evtBnrSubmitSpinner').style.display = 'none';
  document.getElementById('evtBnrFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeEvtBnrForm() {
  evtBnrEditDocId = null;
  document.getElementById('evtBnrFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('btnAddEvtBanner')?.addEventListener('click', () => openEvtBnrForm(null));
document.getElementById('evtBnrFormClose')?.addEventListener('click', closeEvtBnrForm);
document.getElementById('evtBnrFormCancel')?.addEventListener('click', closeEvtBnrForm);

document.getElementById('evtBnrFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('evtBnrFormError');
  errEl.style.display = 'none';
  const imageUrl = document.getElementById('evtBnrFieldImageUrl').value;
  const title    = document.getElementById('evtBnrFieldTitle').value.trim();
  const link     = _getEvtBnrLinkValue();
  const order    = parseInt(document.getElementById('evtBnrFieldOrder').value) || 0;
  const isActive = document.getElementById('evtBnrFieldIsActive').checked;

  if (!title)    { errEl.textContent = '제목은 필수입니다.'; errEl.style.display = 'block'; return; }
  if (!imageUrl) { errEl.textContent = '이미지 파일을 선택해 주세요.'; errEl.style.display = 'block'; return; }

  const effForId = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
  const autoId = evtBnrEditDocId
    ? (effForId.find(b => b._docId === evtBnrEditDocId)?.id || Math.max(0, ...effForId.map(b => b.id||0)) + 1)
    : Math.max(0, ...effForId.map(b => b.id||0)) + 1;
  const data = { id: autoId, imageUrl, title, link, order, isActive, updatedBy: getCurrentUserLabel() };

  const isEditing = !!evtBnrEditDocId;
  document.getElementById('evtBnrFormSubmit').disabled = true;
  document.getElementById('evtBnrSubmitBtnText').textContent = isEditing ? '수정 중...' : '등록 중...';
  document.getElementById('evtBnrSubmitSpinner').style.display = 'inline-block';

  const isPendingAdd = evtBnrEditDocId ? _pendingEvtBanners.some(op => op.action === 'add' && op.tempId === evtBnrEditDocId) : false;
  if (isPendingAdd) {
    const addOp = _pendingEvtBanners.find(op => op.action === 'add' && op.tempId === evtBnrEditDocId);
    Object.assign(addOp.data, { ...data, updatedAt: nowTS() });
  } else if (evtBnrEditDocId) {
    _pendingEvtBanners = _pendingEvtBanners.filter(op => !(op.action === 'edit' && op.docId === evtBnrEditDocId));
    _pendingEvtBanners.push({ action: 'edit', docId: evtBnrEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    _pendingEvtBanners.push({ action: 'add', tempId: `temp_${Date.now()}`, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closeEvtBnrForm();
  const eff = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
  renderEvtBannerTable(eff);
  updateBarFromDocs(eff, 'publishInfoEvtBanners');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('evtBnrFormSubmit').disabled = false;
  document.getElementById('evtBnrSubmitBtnText').textContent = isEditing ? '수정' : '등록';
  document.getElementById('evtBnrSubmitSpinner').style.display = 'none';
});

function deleteEvtBanner(docId, title) {
  openDeleteModal('이벤트 배너 삭제', `"${title}" 배너를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const isPendingAdd = _pendingEvtBanners.some(op => op.action === 'add' && op.tempId === docId);
    if (isPendingAdd) {
      _pendingEvtBanners = _pendingEvtBanners.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingEvtBanners = _pendingEvtBanners.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingEvtBanners = _pendingEvtBanners.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingEvtBanners.push({ action: 'delete', docId });
    }
    const eff = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
    renderEvtBannerTable(eff);
    updateBarFromDocs(eff, 'publishInfoEvtBanners');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

async function publishEvtBanners() {
  if (!_pendingEvtBanners.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishEvtBanners');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingEvtBanners) {
      const newVisible = op.data?.isActive !== false;
      if (op.action === 'add')         batch.set(db.collection('eventBanners').doc(), { ...op.data, visible: newVisible });
      else if (op.action === 'edit')   batch.update(db.collection('eventBanners').doc(op.docId), { ...op.data, visible: newVisible, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('eventBanners').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('eventBanners');
    _pendingEvtBanners = [];
    showToast('이벤트 배너 저장되었습니다.', 'success');
    await loadEvtBanners();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}

async function revertEvtBanners() {
  if (!_pendingEvtBanners.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingEvtBanners = [];
  const eff = _applyPendingOps(allEvtBanners, _pendingEvtBanners);
  renderEvtBannerTable(eff); updateBarFromDocs(eff, 'publishInfoEvtBanners');
  showToast('이벤트 배너 변경사항을 되돌렸습니다.', 'success');
}

let evtBannerOrderList = [];
let evtBannerDragSrcIndex = null;

function openEvtBannerOrderModal() {
  evtBannerOrderList = [...allEvtBanners].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  renderEvtBannerOrderList();
  document.getElementById('evtBannerOrderError').style.display = 'none';
  document.getElementById('evtBannerOrderSaveBtnText').textContent = '저장';
  document.getElementById('evtBannerOrderSpinner').style.display = 'none';
  document.getElementById('evtBannerOrderSave').disabled = false;
  document.getElementById('evtBannerOrderOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEvtBannerOrderModal() {
  document.getElementById('evtBannerOrderOverlay').classList.remove('open');
  document.body.style.overflow = '';
  evtBannerOrderList = [];
  evtBannerDragSrcIndex = null;
}

document.getElementById('evtBannerOrderClose')?.addEventListener('click', closeEvtBannerOrderModal);
document.getElementById('evtBannerOrderCancel')?.addEventListener('click', closeEvtBannerOrderModal);
document.getElementById('evtBannerOrderOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('evtBannerOrderOverlay')) closeEvtBannerOrderModal();
});

function renderEvtBannerOrderList() {
  const ul = document.getElementById('evtBannerOrderList');
  if (!evtBannerOrderList.length) {
    ul.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted)">등록된 이벤트 배너가 없습니다</li>';
    return;
  }
  ul.innerHTML = evtBannerOrderList.map((b, i) => `
    <li class="banner-order-item"
        draggable="true"
        data-index="${i}"
        ondragstart="onEvtBnrOrderDragStart(event, ${i})"
        ondragover="onEvtBnrOrderDragOver(event)"
        ondrop="onEvtBnrOrderDrop(event, ${i})"
        ondragend="onEvtBnrOrderDragEnd(event)"
        ondragleave="onEvtBnrOrderDragLeave(event)">
      <div class="drag-handle"><span></span><span></span><span></span></div>
      <div class="order-num-badge">${i + 1}</div>
      ${b.imageUrl
        ? `<img class="order-thumb" src="${b.imageUrl}" alt="${b.title || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="order-thumb-placeholder" style="display:none">없음</div>`
        : `<div class="order-thumb-placeholder">이미지 없음</div>`}
      <span class="order-item-title">${b.title || '<span style="color:var(--text-dim)">제목 없음</span>'}</span>
      <span class="order-item-status">${b.isActive ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(79,198,106,0.12);border:1px solid rgba(79,198,106,0.35);border-radius:20px;padding:2px 10px 2px 7px;color:#4fc66a;font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:#4fc66a;flex-shrink:0;display:inline-block"></span>ON</span>' : '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(110,118,129,0.10);border:1px solid rgba(110,118,129,0.25);border-radius:20px;padding:2px 10px 2px 7px;color:var(--text-dim);font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:var(--text-dim);flex-shrink:0;display:inline-block"></span>OFF</span>'}</span>
    </li>
  `).join('');
}

function onEvtBnrOrderDragStart(e, index) {
  evtBannerDragSrcIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index);
  document.body.classList.add('dragging-banner');
  requestAnimationFrame(() => {
    const el = document.querySelector(`#evtBannerOrderList .banner-order-item[data-index="${index}"]`);
    el?.classList.add('dragging');
  });
}
function onEvtBnrOrderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const item = e.currentTarget;
  if (!item.classList.contains('dragging')) item.classList.add('drag-over');
}
function onEvtBnrOrderDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function onEvtBnrOrderDrop(e, targetIndex) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (evtBannerDragSrcIndex === null || evtBannerDragSrcIndex === targetIndex) return;
  const moved = evtBannerOrderList.splice(evtBannerDragSrcIndex, 1)[0];
  evtBannerOrderList.splice(targetIndex, 0, moved);
  evtBannerDragSrcIndex = null;
  renderEvtBannerOrderList();
}
function onEvtBnrOrderDragEnd(e) {
  document.body.classList.remove('dragging-banner');
  document.querySelectorAll('#evtBannerOrderList .banner-order-item').forEach(el => el.classList.remove('dragging', 'drag-over'));
  evtBannerDragSrcIndex = null;
}

// 이벤트 배너 순서 — 터치 드래그 지원 (모바일)
(function initEvtBannerOrderTouch() {
  const ul = document.getElementById('evtBannerOrderList');
  if (!ul) return;
  let _touchIdx = null;
  let _dragEl   = null;

  ul.addEventListener('touchstart', e => {
    const handle = e.target.closest('.drag-handle');
    const li     = e.target.closest('.banner-order-item');
    if (!li || !handle) return;
    _touchIdx = parseInt(li.dataset.index, 10);
    _dragEl   = li;
    li.classList.add('dragging');
    document.body.classList.add('dragging-banner');
  }, { passive: true });

  ul.addEventListener('touchmove', e => {
    if (_touchIdx === null) return;
    e.preventDefault();
    const touch  = e.touches[0];
    const el     = document.elementFromPoint(touch.clientX, touch.clientY);
    ul.querySelectorAll('.banner-order-item').forEach(item => item.classList.remove('drag-over'));
    const target = el?.closest('.banner-order-item');
    if (target && target !== _dragEl) target.classList.add('drag-over');
  }, { passive: false });

  ul.addEventListener('touchend', e => {
    if (_touchIdx === null) return;
    const touch  = e.changedTouches[0];
    const el     = document.elementFromPoint(touch.clientX, touch.clientY);
    const target = el?.closest('.banner-order-item');
    const toIdx  = target ? parseInt(target.dataset.index, 10) : NaN;

    ul.querySelectorAll('.banner-order-item').forEach(i => i.classList.remove('dragging', 'drag-over'));
    document.body.classList.remove('dragging-banner');

    if (!isNaN(toIdx) && toIdx !== _touchIdx) {
      const moved = evtBannerOrderList.splice(_touchIdx, 1)[0];
      evtBannerOrderList.splice(toIdx, 0, moved);
      renderEvtBannerOrderList();
    }
    _touchIdx = null;
    _dragEl   = null;
  }, { passive: true });
})();

document.getElementById('evtBannerOrderSave')?.addEventListener('click', async () => {
  const errEl = document.getElementById('evtBannerOrderError');
  errEl.style.display = 'none';
  const saveBtn = document.getElementById('evtBannerOrderSave');
  document.getElementById('evtBannerOrderSaveBtnText').textContent = '저장 중...';
  document.getElementById('evtBannerOrderSpinner').style.display = 'inline-block';
  saveBtn.disabled = true;

  try {
    const batch = db.batch();
    evtBannerOrderList.forEach((b, i) => {
      const ref = db.collection('eventBanners').doc(b._docId);
      batch.update(ref, { order: i + 1, updatedBy: getCurrentUserLabel() });
    });
    await batch.commit();
    showToast('이벤트 배너 순서가 저장되었습니다.', 'success');
    closeEvtBannerOrderModal();
    await loadEvtBanners();
  } catch (err) {
    errEl.textContent = '저장 실패: ' + err.message;
    errEl.style.display = 'block';
    showToast('순서 저장 실패', 'error');
  } finally {
    document.getElementById('evtBannerOrderSaveBtnText').textContent = '저장';
    document.getElementById('evtBannerOrderSpinner').style.display = 'none';
    saveBtn.disabled = false;
  }
});

// ============================================================
// 이벤트 페이지 (events 컬렉션)
// ============================================================

async function loadEvtPages() {
  const tbody = document.getElementById('evtPageTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading"><div class="spinner"></div><span>로딩 중...</span></td></tr>';
  try {
    const snap = await db.collection('events').orderBy('date', 'desc').get();
    allEvtPages = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    evtPageCurrentPage = 1;
    const eff = _applyPendingOps(allEvtPages, _pendingEvtPages);
    filteredEvtPageList = eff;
    renderEvtPageTable(eff);
    updateBarFromDocs(eff, 'publishInfoEvtPages');
  } catch (err) {
    try {
      const snap2 = await db.collection('events').get();
      allEvtPages = snap2.docs.map(d => ({ _docId: d.id, ...d.data() })).sort((a,b)=>(b.date||'')>(a.date||'')?1:-1);
      evtPageCurrentPage = 1;
      const eff2 = _applyPendingOps(allEvtPages, _pendingEvtPages);
      filteredEvtPageList = eff2;
      renderEvtPageTable(eff2);
      updateBarFromDocs(eff2, 'publishInfoEvtPages');
    } catch (err2) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">로드 실패: ${escHtml(err2.message)}</td></tr>`;
      showToast('이벤트 페이지 로드 실패', 'error');
    }
  }
}

function renderEvtPageTable(list) {
  filteredEvtPageList = list;
  const tbody = document.getElementById('evtPageTableBody');
  if (!tbody) return;
  const label = document.getElementById('evtPageCountLabel');
  if (label) label.textContent = list.length === allEvtPages.length
    ? `총 ${list.length}건`
    : `총 ${allEvtPages.length}건 중 ${list.length}건`;

  const totalPages = Math.max(1, Math.ceil(list.length / evtPagePageSize));
  if (evtPageCurrentPage > totalPages) evtPageCurrentPage = totalPages;
  const start = (evtPageCurrentPage - 1) * evtPagePageSize;
  const shown = list.slice(start, start + evtPagePageSize);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">등록된 이벤트 페이지가 없습니다</td></tr>';
    renderPaginator('evtPagePaginator', 0, evtPagePageSize, evtPageCurrentPage, () => {});
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
          ${canEditIn('events') ? `<button class="btn-edit" data-docid="${escHtml(p._docId)}" onclick="openEvtPgForm(this.dataset.docid)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>수정
          </button>` : ''}
          ${canDeleteIn('events') ? `<button class="btn-delete" data-docid="${escHtml(p._docId)}" data-name="${safeTitle}" onclick="deleteEvtPage(this.dataset.docid, this.dataset.name)">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>삭제
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPaginator('evtPagePaginator', list.length, evtPagePageSize, evtPageCurrentPage, (page) => {
    evtPageCurrentPage = page;
    renderEvtPageTable(filteredEvtPageList);
  });
}

document.getElementById('evtPageSearch')?.addEventListener('input', () => {
  const q = (document.getElementById('evtPageSearch')?.value || '').toLowerCase();
  evtPageCurrentPage = 1;
  renderEvtPageTable(q ? allEvtPages.filter(p => (p.title||'').toLowerCase().includes(q)) : _applyPendingOps(allEvtPages, _pendingEvtPages));
});
document.getElementById('evtPagePerPage')?.addEventListener('change', e => {
  evtPagePageSize = parseInt(e.target.value) || 10;
  evtPageCurrentPage = 1;
  renderEvtPageTable(filteredEvtPageList);
});

function initEvtCkEditor() {
    if ($('#evtEditor').next('.note-editor').length > 0) return Promise.resolve();
    return new Promise((resolve) => {
      $('#evtEditor').summernote({
        lang: 'ko-KR', height: 300,
        fontSizes: ['11', '13', '15', '16', '19', '24', '28', '30', '34', '38'],
        placeholder: '이벤트 본문 내용을 입력하세요...',
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
                const url = await uploadImageToStorage(file, 'events');
                $('#evtEditor').summernote('insertImage', url, file.name || '이미지');
              } catch (e) { showToast('이미지 업로드 실패: ' + e.message, 'error'); }
            }
          }
        }
      });
      resolve();
    });
    }
    
// ── 이벤트 카드 썸네일 유틸 ──────────────────────────────────────────
function showEvtPgThumbUrl(url) {
  _evtPgThumbUrl = url;
  document.getElementById('evtPgThumbBtnRow').style.display  = 'none';
  document.getElementById('evtPgThumbUrlRow').style.display  = 'flex';
  document.getElementById('evtPgThumbUrlText').textContent   = url;
  document.getElementById('evtPgThumbUrl').value             = url;
  updateEvtPgThumbPreview(url);
}
function resetEvtPgThumbWidget() {
  _evtPgThumbUrl = '';
  document.getElementById('evtPgThumbBtnRow').style.display  = 'flex';
  document.getElementById('evtPgThumbUrlRow').style.display  = 'none';
  document.getElementById('evtPgThumbUrl').value             = '';
  updateEvtPgThumbPreview('');
}
function updateEvtPgThumbPreview(url) {
  const img = document.getElementById('evtPgThumbPreview');
  const ph  = document.getElementById('evtPgThumbPlaceholder');
  if (!img || !ph) return;
  if (url) {
    img.src = url; img.style.display = 'block'; ph.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
  } else {
    img.style.display = 'none'; ph.style.display = 'flex';
  }
}

async function resizeEvtThumbToBlob(file) {
  const TARGET_W = 1280, TARGET_H = 720;
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.max(TARGET_W / img.naturalWidth, TARGET_H / img.naturalHeight);
        const dw = Math.round(img.naturalWidth  * scale);
        const dh = Math.round(img.naturalHeight * scale);
        const oc = document.createElement('canvas');
        oc.width = TARGET_W; oc.height = TARGET_H;
        const ctx = oc.getContext('2d');
        if (!ctx) { reject(new Error('Canvas 초기화 실패')); return; }
        ctx.drawImage(img, (TARGET_W - dw) / 2, (TARGET_H - dh) / 2, dw, dh);
        oc.toBlob(b => b ? resolve(b) : reject(new Error('리사이즈 실패')), 'image/jpeg', 0.92);
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('이미지 로드 실패')); };
    img.src = objectUrl;
  });
}



async function openEvtPgForm(docId) {
  evtPgEditDocId = docId || null;
  document.getElementById('evtPgFormError').style.display = 'none';
  const content = (() => {
    if (docId) {
      const p = _applyPendingOps(allEvtPages, _pendingEvtPages).find(x => x._docId === docId);
      if (!p) return '';
      const src = (p.hasDraft && p.draftData) ? p.draftData : p;
      document.getElementById('evtPgFormTitle').textContent = '이벤트 수정';
      document.getElementById('evtPgAutoIdDisplay').value  = src.id ?? p.id ?? '자동 생성';
      // 시작/종료일 (startDate Timestamp → string 변환, 없으면 date 폴백)
      const toDateStr = ts => ts?.toDate ? ts.toDate().toISOString().split('T')[0] : (ts || '');
      document.getElementById('evtPgFieldStartDate').value = toDateStr(src.startDate) || src.date || '';
      document.getElementById('evtPgFieldEndDate').value   = toDateStr(src.endDate)   || '';
      document.getElementById('evtPgFieldTitle').value     = src.title || '';
      // 썸네일
      if (src.thumbnailUrl) showEvtPgThumbUrl(src.thumbnailUrl);
      else resetEvtPgThumbWidget();
      return src.content || '';
    } else {
      const nextId = Math.max(0, ...allEvtPages.map(p => p.id || 0)) + 1;
      document.getElementById('evtPgFormTitle').textContent = '이벤트 추가';
      document.getElementById('evtPgAutoIdDisplay').value  = nextId;
      document.getElementById('evtPgFieldStartDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('evtPgFieldEndDate').value   = '';
      document.getElementById('evtPgFieldTitle').value     = '';
      resetEvtPgThumbWidget();
      return '';
    }
  })();
  document.getElementById('evtPgFormOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('evtPgSubmitBtnText').textContent = docId ? '수정' : '등록';
  document.getElementById('evtPgSubmitSpinner').style.display = 'none';
  await initEvtCkEditor();
  $('#evtEditor').summernote('code', content || '');
}

function closeEvtPgForm() {
  evtPgEditDocId = null;
  document.getElementById('evtPgFormOverlay').classList.remove('open');
  document.body.style.overflow = '';
  resetEvtPgThumbWidget();
}

// 이벤트 썸네일 이미지 리스너
document.getElementById('evtPgThumbPreviewBox')?.addEventListener('click', () => {
  document.getElementById('evtPgThumbImg')?.click();
});
document.getElementById('evtPgThumbRemove')?.addEventListener('click', () => {
  document.getElementById('evtPgThumbImg').value = '';
  resetEvtPgThumbWidget();
});
document.getElementById('evtPgThumbImg')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast(`파일 용량 초과: ${(file.size/1024/1024).toFixed(1)} MB (최대 3 MB)`, 'error');
    e.target.value = ''; return;
  }
  document.getElementById('evtPgThumbBtnRow').style.display = 'none';
  document.getElementById('evtPgThumbUrlRow').style.display = 'flex';
  document.getElementById('evtPgThumbUrlText').textContent  = '업로드 중...';
  try {
    const resizedBlob = await resizeEvtThumbToBlob(file);
    const resizedFile = new File([resizedBlob], 'evt_thumb.jpg', { type: 'image/jpeg' });
    const url = await uploadImageToStorage(resizedFile, 'events');
    showEvtPgThumbUrl(url);
  } catch (err) {
    showToast('이미지 업로드 실패: ' + err.message, 'error');
    resetEvtPgThumbWidget();
  } finally {
    e.target.value = '';
  }
});

document.getElementById('btnAddEvtPage')?.addEventListener('click', () => openEvtPgForm(null));
document.getElementById('evtPgFormClose')?.addEventListener('click', closeEvtPgForm);
document.getElementById('evtPgFormCancel')?.addEventListener('click', closeEvtPgForm);

document.getElementById('evtPgFormSubmit')?.addEventListener('click', async () => {
  const errEl = document.getElementById('evtPgFormError');
  errEl.style.display = 'none';
  const startDateStr = document.getElementById('evtPgFieldStartDate').value;
  const endDateStr   = document.getElementById('evtPgFieldEndDate').value;
  const title   = document.getElementById('evtPgFieldTitle').value.trim();
  const content = $('#evtEditor').summernote('code') || '';
  const thumbUrl = document.getElementById('evtPgThumbUrl').value.trim();

  if (!startDateStr || !title) { errEl.textContent = '시작 날짜와 제목은 필수입니다.'; errEl.style.display = 'block'; return; }
  if (!content)        { errEl.textContent = '본문은 필수입니다.';  errEl.style.display = 'block'; return; }

  const effForId = _applyPendingOps(allEvtPages, _pendingEvtPages);
  const autoId = evtPgEditDocId
    ? (effForId.find(p => p._docId === evtPgEditDocId)?.id || Math.max(0, ...effForId.map(p => p.id||0)) + 1)
    : Math.max(0, ...effForId.map(p => p.id||0)) + 1;
  const startTs = startDateStr ? firebase.firestore.Timestamp.fromDate(new Date(startDateStr)) : null;
  const endTs   = endDateStr   ? firebase.firestore.Timestamp.fromDate(new Date(endDateStr))   : null;
  const data = {
    id: autoId,
    date: startDateStr,                             // 하위 호환
    ...(startTs ? { startDate: startTs } : {}),
    ...(endTs   ? { endDate:   endTs   } : {}),
    ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
    title,
    content,
    updatedBy: getCurrentUserLabel()
  };

  const isEditing = !!evtPgEditDocId;
  document.getElementById('evtPgFormSubmit').disabled = true;
  document.getElementById('evtPgSubmitBtnText').textContent = isEditing ? '수정 중...' : '등록 중...';
  document.getElementById('evtPgSubmitSpinner').style.display = 'inline-block';

  const isPendingAdd = evtPgEditDocId ? _pendingEvtPages.some(op => op.action === 'add' && op.tempId === evtPgEditDocId) : false;
  if (isPendingAdd) {
    const addOp = _pendingEvtPages.find(op => op.action === 'add' && op.tempId === evtPgEditDocId);
    Object.assign(addOp.data, { ...data, updatedAt: nowTS() });
  } else if (evtPgEditDocId) {
    _pendingEvtPages = _pendingEvtPages.filter(op => !(op.action === 'edit' && op.docId === evtPgEditDocId));
    _pendingEvtPages.push({ action: 'edit', docId: evtPgEditDocId, data: { ...data, updatedAt: nowTS() } });
  } else {
    _pendingEvtPages.push({ action: 'add', tempId: `temp_${Date.now()}`, data: { ...data, visible: false, createdAt: nowTS(), updatedAt: nowTS() } });
  }
  closeEvtPgForm();
  const eff = _applyPendingOps(allEvtPages, _pendingEvtPages);
  renderEvtPageTable(eff);
  updateBarFromDocs(eff, 'publishInfoEvtPages');
  showToast('임시 반영됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  document.getElementById('evtPgFormSubmit').disabled = false;
  document.getElementById('evtPgSubmitBtnText').textContent = isEditing ? '수정' : '등록';
  document.getElementById('evtPgSubmitSpinner').style.display = 'none';
});

function deleteEvtPage(docId, title) {
  openDeleteModal('이벤트 삭제', `"${title}" 이벤트를 삭제하시겠습니까?\n"저장" 버튼을 눌러야 Live에 반영됩니다.`, () => {
    const isPendingAdd = _pendingEvtPages.some(op => op.action === 'add' && op.tempId === docId);
    if (isPendingAdd) {
      _pendingEvtPages = _pendingEvtPages.filter(op => !(op.action === 'add' && op.tempId === docId));
    } else {
      _pendingEvtPages = _pendingEvtPages.filter(op => !(op.action === 'edit' && op.docId === docId));
      _pendingEvtPages = _pendingEvtPages.filter(op => !(op.action === 'delete' && op.docId === docId));
      _pendingEvtPages.push({ action: 'delete', docId });
    }
    const eff = _applyPendingOps(allEvtPages, _pendingEvtPages);
    renderEvtPageTable(eff);
    updateBarFromDocs(eff, 'publishInfoEvtPages');
    showToast('삭제 예정으로 표시됐습니다. "저장" 버튼을 눌러 Live에 반영하세요.', 'success');
  });
}

async function publishEvtPages() {
  if (!_pendingEvtPages.length) { showToast('저장할 변경사항이 없습니다.', 'info'); return; }
  const btn = document.getElementById('btnPublishEvtPages');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const batch = db.batch();
    for (const op of _pendingEvtPages) {
      if (op.action === 'add')         batch.set(db.collection('events').doc(), { ...op.data, visible: true });
      else if (op.action === 'edit')   batch.update(db.collection('events').doc(op.docId), { ...op.data, visible: true, hasDraft: firebase.firestore.FieldValue.delete(), draftData: firebase.firestore.FieldValue.delete() });
      else if (op.action === 'delete') batch.delete(db.collection('events').doc(op.docId));
    }
    await batch.commit();
    await savePublishMeta('events');
    _pendingEvtPages = [];
    showToast('이벤트 페이지 저장되었습니다.', 'success');
    await loadEvtPages();
  } catch (err) { showToast('저장 실패: ' + err.message, 'error'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '저장'; } }
}

async function revertEvtPages() {
  if (!_pendingEvtPages.length) { showToast('되돌릴 변경사항이 없습니다.', 'info'); return; }
  _pendingEvtPages = [];
  const eff = _applyPendingOps(allEvtPages, _pendingEvtPages);
  renderEvtPageTable(eff); updateBarFromDocs(eff, 'publishInfoEvtPages');
  showToast('이벤트 페이지 변경사항을 되돌렸습니다.', 'success');
}

