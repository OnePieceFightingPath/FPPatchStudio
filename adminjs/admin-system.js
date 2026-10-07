// ============================================================
// DASHBOARD
// ============================================================

const STAT_CARD_STATUS_TONES = new Set(['success', 'danger', 'warning', 'primary']);

function renderStatCardMetrics(id, metrics) {
  const container = document.getElementById(id);
  if (!container) return;

  const fragment = document.createDocumentFragment();
  metrics.forEach((metric, index) => {
    if (index > 0) {
      const divider = document.createElement('span');
      divider.className = 'stat-card-status-divider';
      divider.setAttribute('aria-hidden', 'true');
      fragment.appendChild(divider);
    }

    const item = document.createElement('span');
    item.className = 'stat-card-status-item';

    const label = document.createElement('span');
    label.className = 'stat-card-status-label';
    label.textContent = metric.label;

    const value = document.createElement('strong');
    const tone = STAT_CARD_STATUS_TONES.has(metric.tone) ? metric.tone : 'primary';
    value.className = `stat-card-status-value stat-card-status-${tone}`;
    value.textContent = String(metric.value);

    item.append(label, document.createTextNode(' : '), value);
    fragment.appendChild(item);
  });

  container.replaceChildren(fragment);
}

function initDashboardCardNavigation() {
  const dashboardGrid = document.querySelector('.dashboard-stat-grid');
  if (!dashboardGrid) return;

  const sectionsByLabel = {
    '메인 배너 관리': 'banners',
    '캐릭터 관리': 'characters',
    '현질 캐릭터 관리': 'supportchars',
    'PvP 패치 관리': 'pvppatch',
    '패치노트 관리': 'patchnote',
    '게시판 관리': 'boards',
    '이벤트 관리': 'events',
    '공지사항 관리': 'notices',
    '고객센터 관리': 'support',
  };

  dashboardGrid.querySelectorAll('.stat-card').forEach(card => {
    const label = card.querySelector('.stat-card-label')?.textContent.trim();
    const section = sectionsByLabel[label];
    if (!section) return;

    card.dataset.section = section;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${label}로 이동`);
  });

  const getCardFromEvent = event => {
    if (!(event.target instanceof Element)) return null;
    return event.target.closest('.stat-card[data-section]');
  };

  dashboardGrid.addEventListener('click', event => {
    const card = getCardFromEvent(event);
    if (card) switchSection(card.dataset.section);
  });

  dashboardGrid.addEventListener('keydown', event => {
    const card = getCardFromEvent(event);
    if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    switchSection(card.dataset.section);
  });
}

initDashboardCardNavigation();

const DASHBOARD_VISITOR_DAYS = 15;
const DASHBOARD_VISITOR_SVG_NS = 'http://www.w3.org/2000/svg';

function dashboardVisitorDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dashboardVisitorDateKey(value, fallback) {
  let dateValue = value || fallback;
  if (dateValue && typeof dateValue.toDate === 'function') dateValue = dateValue.toDate();
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    return dashboardVisitorDayKey(dateValue);
  }
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  if (dateValue !== undefined && dateValue !== null) {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) return dashboardVisitorDayKey(parsed);
  }
  return null;
}

function dashboardVisitorSvgElement(name, attributes = {}) {
  const element = document.createElementNS(DASHBOARD_VISITOR_SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderDashboardVisitorChart(dailyCounts, hasData) {
  const grid = document.getElementById('dashboardVisitorGrid');
  const yAxis = document.getElementById('dashboardVisitorYAxis');
  const xAxis = document.getElementById('dashboardVisitorXAxis');
  const line = document.getElementById('dashboardVisitorLine');
  const lastPoint = document.getElementById('dashboardVisitorLastPoint');
  const emptyState = document.getElementById('dashboardVisitorEmpty');
  const chart = document.getElementById('dashboardVisitorChart');
  if (!grid || !yAxis || !xAxis || !line || !lastPoint || !emptyState || !chart) return;

  const plot = { left: 54, right: 990, top: 20, bottom: 252 };
  const maxValue = Math.max(4, Math.ceil(Math.max(0, ...dailyCounts.map(point => point.count)) / 4) * 4);
  const yFor = value => plot.bottom - (value / maxValue) * (plot.bottom - plot.top);
  const xFor = index => plot.left + (index / Math.max(1, dailyCounts.length - 1)) * (plot.right - plot.left);
  const numberFormat = new Intl.NumberFormat('ko-KR');

  grid.replaceChildren();
  yAxis.replaceChildren();
  xAxis.replaceChildren();

  [maxValue, maxValue / 2, 0].forEach(value => {
    const y = yFor(value);
    grid.appendChild(dashboardVisitorSvgElement('line', {
      x1: plot.left, y1: y, x2: plot.right, y2: y, class: 'dashboard-visitor-grid-line',
    }));
    const label = dashboardVisitorSvgElement('text', {
      x: plot.left - 12, y: y + 4, class: 'dashboard-visitor-axis-label', 'text-anchor': 'end',
    });
    label.textContent = numberFormat.format(Math.round(value));
    yAxis.appendChild(label);
  });

  const points = dailyCounts.map((item, index) => ({ x: xFor(index), y: yFor(item.count) }));
  if (hasData && points.length) {
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const current = points[index];
      const middleX = (previous.x + current.x) / 2;
      path += ` C ${middleX} ${previous.y}, ${middleX} ${current.y}, ${current.x} ${current.y}`;
    }
    line.setAttribute('d', path);
    line.style.display = '';
    lastPoint.setAttribute('cx', points[points.length - 1].x);
    lastPoint.setAttribute('cy', points[points.length - 1].y);
    lastPoint.style.display = '';
  } else {
    line.setAttribute('d', '');
    line.style.display = 'none';
    lastPoint.style.display = 'none';
  }

  dailyCounts.forEach((item, index) => {
    if (index % 2 !== 0 && index !== dailyCounts.length - 1) return;
    const [, month, day] = item.date.split('-');
    const label = dashboardVisitorSvgElement('text', {
      x: xFor(index), y: 294, class: 'dashboard-visitor-axis-label', 'text-anchor': 'middle',
    });
    label.textContent = `${Number(month)}/${Number(day)}`;
    xAxis.appendChild(label);
  });

  emptyState.hidden = hasData;
  chart.setAttribute(
    'aria-label',
    hasData ? '최근 15일 방문자 통계 그래프' : '방문자 데이터가 없어 그래프를 표시할 수 없습니다.',
  );
}

async function loadDashboardVisitors() {
  const totalElement = document.getElementById('dashboardVisitorTotal');
  const updatedElement = document.getElementById('dashboardVisitorUpdated');
  if (!totalElement || !updatedElement || typeof db === 'undefined') return;

  try {
    const snapshot = await db.collection('visitorStats').get();
    const countsByDate = new Map();
    let total = 0;

    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const date = dashboardVisitorDateKey(data.date || data.day, doc.id);
      const rawCount = data.count ?? data.visitors ?? data.totalVisitors;
      const count = Number(rawCount);
      if (!date || !Number.isFinite(count) || count < 0) return;
      countsByDate.set(date, (countsByDate.get(date) || 0) + count);
      total += count;
    });

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const firstDay = new Date(todayStart);
    firstDay.setDate(firstDay.getDate() - (DASHBOARD_VISITOR_DAYS - 1));
    const dailyCounts = Array.from({ length: DASHBOARD_VISITOR_DAYS }, (_, index) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + index);
      const key = dashboardVisitorDayKey(date);
      return { date: key, count: countsByDate.get(key) || 0 };
    });
    const hasData = countsByDate.size > 0;
    totalElement.textContent = hasData ? new Intl.NumberFormat('ko-KR').format(total) : '—';

    if (hasData) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date());
      const time = Object.fromEntries(parts.map(part => [part.type, part.value]));
      updatedElement.textContent = `${time.year}.${time.month}.${time.day} ${time.hour}:${time.minute} 기준`;
    } else {
      updatedElement.textContent = 'Firestore visitorStats 데이터 없음';
    }

    renderDashboardVisitorChart(dailyCounts, hasData);
  } catch (error) {
    console.error('방문자 통계를 불러오지 못했습니다.', error);
    totalElement.textContent = '—';
    updatedElement.textContent = '통계를 불러오지 못했습니다. Firestore 읽기 권한을 확인해주세요.';
    renderDashboardVisitorChart([], false);
  }
}

function dashboardEventDateKey(value) {
  if (value && typeof value.toDate === 'function') value = value.toDate();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return '';
}

function getDashboardEventStatuses(events) {
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayValues = Object.fromEntries(todayParts.map(part => [part.type, part.value]));
  const today = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
  let inProgress = 0;
  let ended = 0;

  events.forEach(event => {
    const startDate = dashboardEventDateKey(event.startDate || event.date);
    const endDate = dashboardEventDateKey(event.endDate);
    if (endDate && endDate < today) {
      ended++;
    } else if ((!startDate || startDate <= today) && (!endDate || endDate >= today)) {
      inProgress++;
    }
  });

  return { inProgress, ended };
}

function loadDashboardStats() {
  loadDashboardVisitors();

  const charCount   = allCharacters.length;
  const scCount     = allSupportChars.length;
  const pvpCount    = allPvpPatches.length;
  const patchCount  = allPatchNotes.length;
  const bannerCount = allBanners.length;
  const activeBanners = allBanners.filter(b => b.isActive).length;
  const noticeCount = (typeof allNotices !== 'undefined') ? allNotices.length : 0;
  const pinnedNotices = (typeof allNotices !== 'undefined') ? allNotices.filter(n => n.pinned).length : 0;
  const eventCount = (typeof allEvtPages !== 'undefined') ? allEvtPages.length : 0;

  const attrCount = { '力': 0, '技': 0, '心': 0 };
  allCharacters.forEach(c => {
    const attr = getAttributeFromChar(c);
    if (attr && attrCount[attr] !== undefined) attrCount[attr]++;
  });

  const pvpBuff = allPvpPatches.filter(p => normalizePvpPatches(p).some(i => i.type === 'buff')).length;
  const pvpNerf = allPvpPatches.filter(p => normalizePvpPatches(p).some(i => i.type === 'nerf')).length;
  const activeSupportChars = allSupportChars.filter(character => character.visible !== false).length;
  const inactiveSupportChars = scCount - activeSupportChars;
  const publishedPatchNotes = allPatchNotes.filter(note => note.visible !== false).length;
  const hiddenPatchNotes = patchCount - publishedPatchNotes;

  document.getElementById('statCharCount').textContent   = charCount;
  document.getElementById('statScCount').textContent     = scCount;
  document.getElementById('statPvpCount').textContent    = pvpCount;
  document.getElementById('statPatchCount').textContent  = patchCount;
  document.getElementById('statBannerCount').textContent = bannerCount;
  if (document.getElementById('statNoticeCount')) {
    document.getElementById('statNoticeCount').textContent = noticeCount;
    renderStatCardMetrics('statNoticeSub', [
      { label: '고정', value: pinnedNotices, tone: 'warning' },
      { label: '등록', value: noticeCount, tone: 'primary' },
    ]);
  }
  if (document.getElementById('statEventCount')) {
    document.getElementById('statEventCount').textContent = eventCount;
    const eventStatuses = getDashboardEventStatuses(
      (typeof allEvtPages !== 'undefined') ? allEvtPages : [],
    );
    renderStatCardMetrics('statEventSub', [
      { label: '진행중', value: eventStatuses.inProgress, tone: 'success' },
      { label: '종료됨', value: eventStatuses.ended, tone: 'warning' },
    ]);
  }
  renderStatCardMetrics('statCharSub', [
    { label: '力', value: attrCount['力'], tone: 'primary' },
    { label: '技', value: attrCount['技'], tone: 'primary' },
    { label: '心', value: attrCount['心'], tone: 'primary' },
  ]);
  renderStatCardMetrics('statScSub', [
    { label: '활성화', value: activeSupportChars, tone: 'success' },
    { label: '비활성화', value: inactiveSupportChars, tone: 'danger' },
  ]);
  renderStatCardMetrics('statPvpSub', [
    { label: '버프', value: pvpBuff, tone: 'success' },
    { label: '너프', value: pvpNerf, tone: 'danger' },
  ]);
  renderStatCardMetrics('statPatchSub', [
    { label: '공개', value: publishedPatchNotes, tone: 'success' },
    { label: '비공개', value: hiddenPatchNotes, tone: 'warning' },
  ]);
  renderStatCardMetrics('statBannerSub', [
    { label: '활성화', value: activeBanners, tone: 'success' },
    { label: '비활성화', value: bannerCount - activeBanners, tone: 'warning' },
  ]);
  renderStatCardMetrics('statBoardSub', [
    { label: '게시판', value: '—', tone: 'primary' },
  ]);
  renderStatCardMetrics('statSupportSub', [
    { label: '문의', value: '—', tone: 'primary' },
  ]);

  if (currentUser) {
    const nickname = profileData?.nickname || currentUser.displayName || currentUser.email || '—';
    const nicknameEl = document.getElementById('dashNickname');
    if (nicknameEl) nicknameEl.textContent = nickname;

    const lastLoginEl = document.getElementById('dashLastLogin');
    if (lastLoginEl && currentUser.metadata?.lastSignInTime) {
      const d = new Date(currentUser.metadata.lastSignInTime);
      const formatted = `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
      lastLoginEl.textContent = `마지막 로그인은 ${formatted} 입니다.`;
    }
  }
}

document.getElementById('btnRefreshDashboard')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnRefreshDashboard');
  btn.disabled = true;
  btn.textContent = '새로고침 중...';
  resetTableFilterControls();
  resetAllTableSelections();
  try {
    await loadAllData();
    showToast('대시보드를 새로고침했습니다.', 'success');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:15px;height:15px"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> 새로고침`;
  }
});

// ============================================================
// BACKUP — EXPORT
// ============================================================

function serializeDoc(docData) {
  const out = {};
  for (const [k, v] of Object.entries(docData)) {
    if (k === '_docId') continue;
    if (v && typeof v.toDate === 'function') {
      out[k] = v.toDate().toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function exportCollection(collectionName) {
  showToast(`${collectionName} 내보내는 중...`, 'info');
  try {
    const snap = await db.collection(collectionName).get();
    const docs = snap.docs.map(d => ({ _id: d.id, ...serializeDoc(d.data()) }));
    const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(`${collectionName}_${ts}.json`, { collection: collectionName, exportedAt: new Date().toISOString(), count: docs.length, docs });
    showToast(`${collectionName} (${docs.length}건) 다운로드 완료`, 'success');
  } catch (err) {
    showToast('내보내기 실패: ' + err.message, 'error');
  }
}

async function exportAll() {
  showToast('전체 백업 중...', 'info');
  try {
    const collections = ['characters', 'pvpPatch', 'patchNotes', 'banners'];
    const result = { exportedAt: new Date().toISOString(), collections: {} };
    for (const col of collections) {
      const snap = await db.collection(col).get();
      result.collections[col] = snap.docs.map(d => ({ _id: d.id, ...serializeDoc(d.data()) }));
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(`all_backup_${ts}.json`, result);
    showToast('전체 백업 다운로드 완료', 'success');
  } catch (err) {
    showToast('전체 백업 실패: ' + err.message, 'error');
  }
}

// ============================================================
// BACKUP — IMPORT
// ============================================================

let importData = null;

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      importData = JSON.parse(e.target.result);
      const docs = Array.isArray(importData) ? importData : (importData.docs || []);
      const preview = document.getElementById('importPreview');
      document.getElementById('importPreviewLabel').textContent = `파일: ${file.name}  |  문서 ${docs.length}건`;
      document.getElementById('importPreviewContent').textContent = JSON.stringify(docs.slice(0, 3), null, 2) + (docs.length > 3 ? '\n// ... 더 있음' : '');
      preview.style.display = 'block';
    } catch (err) {
      showToast('JSON 파싱 실패: ' + err.message, 'error');
      importData = null;
    }
  };
  reader.readAsText(file);
}

async function confirmImport() {
  if (!importData) { showToast('가져올 파일을 먼저 선택하세요.', 'error'); return; }

  const col  = document.getElementById('importTargetCollection').value;
  const docs = Array.isArray(importData) ? importData : (importData.docs || []);

  if (!docs.length) { showToast('가져올 문서가 없습니다.', 'error'); return; }

  const btn = document.getElementById('btnConfirmImport');
  btn.disabled = true;
  document.getElementById('importBtnText').textContent = '복원 중...';
  document.getElementById('importSpinner').style.display = 'inline-block';

  try {
    let batch = db.batch();
    let count = 0;
    for (const doc of docs) {
      const { _id, ...fields } = doc;
      const ref = _id ? db.collection(col).doc(_id) : db.collection(col).doc();
      const cleanFields = {};
      for (const [k, v] of Object.entries(fields)) {
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
          cleanFields[k] = firebase.firestore.Timestamp.fromDate(new Date(v));
        } else {
          cleanFields[k] = v;
        }
      }
      batch.set(ref, cleanFields, { merge: true });
      count++;
      if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    showToast(`${col} 컬렉션에 ${docs.length}건 복원 완료`, 'success');
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importFileInput').value = '';
    importData = null;
    await loadAllData();
  } catch (err) {
    showToast('복원 실패: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    document.getElementById('importBtnText').textContent = 'Firestore에 복원';
    document.getElementById('importSpinner').style.display = 'none';
  }
}

// ============================================================
// FIRESTORE RULES DISPLAY
// ============================================================

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─────────────────────────────────────────────
    // 관리자 이메일 목록 (ADMIN_EMAILS와 동기화 필요)
    // ─────────────────────────────────────────────
    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email in [
          'your-email@gmail.com'
          // 'another-admin@gmail.com'
        ];
    }

    // 캐릭터 — 누구나 읽기, 관리자만 쓰기
    match /characters/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // PvP 패치 — 누구나 읽기, 관리자만 쓰기
    match /pvpPatch/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 패치노트 — 누구나 읽기, 관리자만 쓰기
    match /patchNotes/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 배너 — 누구나 읽기, 관리자만 쓰기
    match /banners/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 퍼블리시 메타 — 누구나 읽기, 관리자만 쓰기
    match /publishMeta/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 서포트 캐릭터 — 누구나 읽기, 관리자만 쓰기
    match /supportCharacters/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 관리자 메타 — 관리자만 읽기/쓰기
    match /adminMeta/{docId} {
      allow read:  if isAdmin();
      allow write: if isAdmin();
    }

    // 고객센터 문의 — 관리자만 읽기 (문의 작성 규칙은 고객 페이지 정책에 맞춰 별도 유지)
    match /supportInquiries/{docId} {
      allow read: if isAdmin();
    }

    // 사용자 프로필 — 본인만 읽기/쓰기
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`;

function copyFirestoreRules() {
  navigator.clipboard.writeText(FIRESTORE_RULES).then(() => {
    showToast('보안 규칙이 클립보드에 복사되었습니다.', 'success');
  }).catch(() => {
    showToast('복사 실패 — 직접 선택해서 복사하세요.', 'error');
  });
}

(function () {
  const el = document.getElementById('firestoreRulesDisplay');
  if (el) el.textContent = FIRESTORE_RULES;
})();

// ============================================================
// MOBILE SIDEBAR TOGGLE
// ============================================================

(function initMobileSidebar() {
  const hamburgerBtn   = document.getElementById('hamburgerBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  const adminSidebar   = document.querySelector('.admin-sidebar');

  function openSidebar() {
    adminSidebar?.classList.add('open');
    sidebarOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (hamburgerBtn) { hamburgerBtn.setAttribute('aria-expanded', 'true'); hamburgerBtn.setAttribute('aria-label', '메뉴 닫기'); }
  }
  function closeSidebar() {
    adminSidebar?.classList.remove('open');
    sidebarOverlay?.classList.remove('open');
    document.body.style.overflow = '';
    if (hamburgerBtn) { hamburgerBtn.setAttribute('aria-expanded', 'false'); hamburgerBtn.setAttribute('aria-label', '메뉴 열기'); }
  }
  window.closeMobileSidebar = closeSidebar;

  hamburgerBtn?.addEventListener('click', () => {
    if (adminSidebar?.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  sidebarOverlay?.addEventListener('click', closeSidebar);

  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 600) closeSidebar();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 600) closeSidebar();
  });
})();

// ============================================================
// DESKTOP SIDEBAR COLLAPSE TOGGLE
// ============================================================

(function initDesktopSidebarCollapse() {
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const sidebar     = document.querySelector('.admin-sidebar');
  const layout      = document.querySelector('.admin-layout');
  if (!collapseBtn || !sidebar || !layout) return;

  function setCollapsed(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    layout.classList.toggle('sidebar-collapsed', collapsed);
    try { localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0'); } catch(e) {}
  }

  try {
    if (localStorage.getItem('adminSidebarCollapsed') === '1') setCollapsed(true);
  } catch(e) {}

  collapseBtn.addEventListener('click', () => {
    setCollapsed(!sidebar.classList.contains('collapsed'));
  });
})();

// ============================================================
// BANNER ORDER MANAGEMENT
// ============================================================

let bannerOrderList = [];

function openBannerOrderModal() {
  bannerOrderList = [...allBanners].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  renderBannerOrderList();
  document.getElementById('bannerOrderError').style.display = 'none';
  document.getElementById('bannerOrderSaveBtnText').textContent = '저장';
  document.getElementById('bannerOrderSpinner').style.display = 'none';
  document.getElementById('bannerOrderSave').disabled = false;
  document.getElementById('bannerOrderOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBannerOrderModal() {
  document.getElementById('bannerOrderOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('dragging-banner');
  bannerOrderList = [];
}

document.getElementById('bannerOrderClose')?.addEventListener('click', closeBannerOrderModal);
document.getElementById('bannerOrderCancel')?.addEventListener('click', closeBannerOrderModal);
document.getElementById('bannerOrderOverlay')?.addEventListener('click', e => {
  if (e.target === document.getElementById('bannerOrderOverlay')) closeBannerOrderModal();
});

function renderBannerOrderList() {
  const ul = document.getElementById('bannerOrderList');
  if (!bannerOrderList.length) {
    ul.innerHTML = '<li style="text-align:center;padding:32px;color:var(--text-muted)">등록된 배너가 없습니다</li>';
    return;
  }
  ul.innerHTML = bannerOrderList.map((b, i) => `
    <li class="banner-order-item" data-index="${i}" draggable="false">
      <div class="drag-handle"><span></span><span></span><span></span></div>
      <div class="order-num-badge">${i + 1}</div>
      ${b.imageUrl
        ? `<img class="order-thumb" src="${b.imageUrl}" alt="${b.title || ''}" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
           <div class="order-thumb-placeholder" style="display:none">없음</div>`
        : `<div class="order-thumb-placeholder">이미지 없음</div>`}
      <span class="order-item-title">${b.title || '<span style="color:var(--text-dim)">제목 없음</span>'}</span>
      <span class="order-item-status">${b.isActive ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(79,198,106,0.12);border:1px solid rgba(79,198,106,0.35);border-radius:20px;padding:2px 10px 2px 7px;color:#4fc66a;font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:#4fc66a;flex-shrink:0;display:inline-block"></span>ON</span>' : '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(110,118,129,0.10);border:1px solid rgba(110,118,129,0.25);border-radius:20px;padding:2px 10px 2px 7px;color:var(--text-dim);font-size:11px;font-weight:600;"><span style="width:6px;height:6px;border-radius:50%;background:var(--text-dim);flex-shrink:0;display:inline-block"></span>OFF</span>'}</span>
    </li>
  `).join('');
}

// 메인 배너 순서 — 목록 안에서만 포인터 드래그 허용
(function initBannerOrderPointerDrag() {
  const ul = document.getElementById('bannerOrderList');
  if (!ul) return;
  // 썸네일 등 자식 요소에서 시작되는 브라우저 기본 드래그도 차단한다.
  ul.addEventListener('dragstart', e => e.preventDefault());
  let sourceIndex = null;
  let sourceItem = null;
  let dragProxy = null;
  let activePointerId = null;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  let sourceWidth = 0;
  let sourceHeight = 0;

  const getItemAtPoint = (x, y) => {
    const bounds = ul.getBoundingClientRect();
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
    const hit = document.elementFromPoint(x, y);
    const item = hit?.closest('#bannerOrderList .banner-order-item');
    return item && ul.contains(item) ? item : null;
  };

  const clearDragState = () => {
    if (sourceItem && activePointerId !== null) {
      try {
        if (sourceItem.hasPointerCapture(activePointerId)) sourceItem.releasePointerCapture(activePointerId);
      } catch (_) {}
    }
    dragProxy?.remove();
    dragProxy = null;
    ul.querySelectorAll('.banner-order-item').forEach(item => item.classList.remove('dragging', 'drag-over'));
    document.body.classList.remove('dragging-banner');
    sourceIndex = null;
    sourceItem = null;
    activePointerId = null;
    pointerOffsetX = 0;
    pointerOffsetY = 0;
    sourceWidth = 0;
    sourceHeight = 0;
  };

  ul.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag-handle');
    const item = e.target.closest('.banner-order-item');
    if (!handle || !item || !ul.contains(item) || e.button !== 0) return;
    const index = Number(item.dataset.index);
    if (!Number.isInteger(index)) return;

    e.preventDefault();
    sourceIndex = index;
    sourceItem = item;
    activePointerId = e.pointerId;
    try { item.setPointerCapture(e.pointerId); } catch (_) {}
    item.classList.add('dragging');
    const itemRect = item.getBoundingClientRect();
    const listRect = ul.getBoundingClientRect();
    sourceWidth = itemRect.width;
    sourceHeight = itemRect.height;
    pointerOffsetX = e.clientX - itemRect.left;
    pointerOffsetY = e.clientY - itemRect.top;
    dragProxy = item.cloneNode(true);
    dragProxy.classList.remove('dragging', 'drag-over');
    dragProxy.classList.add('banner-order-drag-proxy');
    dragProxy.setAttribute('aria-hidden', 'true');
    dragProxy.style.width = `${sourceWidth}px`;
    dragProxy.style.height = `${sourceHeight}px`;
    dragProxy.style.left = `${itemRect.left - listRect.left}px`;
    dragProxy.style.top = `${itemRect.top - listRect.top}px`;
    ul.appendChild(dragProxy);
    document.body.classList.add('dragging-banner');
  });

  ul.addEventListener('pointermove', e => {
    if (sourceIndex === null || e.pointerId !== activePointerId) return;
    if (dragProxy) {
      const listRect = ul.getBoundingClientRect();
      const maxLeft = Math.max(0, ul.clientWidth - sourceWidth);
      const maxTop = Math.max(0, ul.clientHeight - sourceHeight);
      const left = Math.max(0, Math.min(maxLeft, e.clientX - listRect.left - pointerOffsetX));
      const top = Math.max(0, Math.min(maxTop, e.clientY - listRect.top - pointerOffsetY));
      dragProxy.style.left = `${left}px`;
      dragProxy.style.top = `${top}px`;
    }
    ul.querySelectorAll('.banner-order-item').forEach(item => item.classList.remove('drag-over'));
    const target = getItemAtPoint(e.clientX, e.clientY);
    if (target && target !== sourceItem) target.classList.add('drag-over');
  });

  const finishPointerDrag = (e, shouldDrop) => {
    if (sourceIndex === null || e.pointerId !== activePointerId) return;
    const fromIndex = sourceIndex;
    const target = shouldDrop && document.getElementById('bannerOrderOverlay').classList.contains('open')
      ? getItemAtPoint(e.clientX, e.clientY)
      : null;
    const toIndex = target ? Number(target.dataset.index) : NaN;
    clearDragState();

    if (Number.isInteger(toIndex) && toIndex >= 0 && toIndex < bannerOrderList.length && toIndex !== fromIndex) {
      const moved = bannerOrderList.splice(fromIndex, 1)[0];
      if (!moved) return;
      bannerOrderList.splice(toIndex, 0, moved);
      renderBannerOrderList();
    }
  };

  ul.addEventListener('pointerup', e => finishPointerDrag(e, true));
  ul.addEventListener('pointercancel', e => finishPointerDrag(e, false));
})();

document.getElementById('bannerOrderSave')?.addEventListener('click', async () => {
  const errEl = document.getElementById('bannerOrderError');
  errEl.style.display = 'none';
  const saveBtn = document.getElementById('bannerOrderSave');
  document.getElementById('bannerOrderSaveBtnText').textContent = '저장 중...';
  document.getElementById('bannerOrderSpinner').style.display = 'inline-block';
  saveBtn.disabled = true;

  try {
    const batch = db.batch();
    bannerOrderList.forEach((b, i) => {
      const ref = db.collection('banners').doc(b._docId);
      batch.update(ref, { order: i + 1, updatedBy: getCurrentUserLabel() });
    });
    await batch.commit();
    showToast('배너 순서가 저장되었습니다.', 'success');
    closeBannerOrderModal();
    await loadBanners();
  } catch (err) {
    errEl.textContent = '저장 실패: ' + err.message;
    errEl.style.display = 'block';
    showToast('순서 저장 실패', 'error');
  } finally {
    document.getElementById('bannerOrderSaveBtnText').textContent = '저장';
    document.getElementById('bannerOrderSpinner').style.display = 'none';
    saveBtn.disabled = false;
  }
});

// ============================================================
// PER-PAGE 드롭다운
// ============================================================

document.getElementById('charPerPage')?.addEventListener('change', function () {
  charPageSize = parseInt(this.value, 10);
  charCurrentPage = 1;
  filterCharTable();
});

document.getElementById('pvpPerPage')?.addEventListener('change', function () {
  pvpPageSize = parseInt(this.value, 10);
  pvpCurrentPage = 1;
  filterPvpTable();
});

document.getElementById('patchPerPage')?.addEventListener('change', function () {
  patchPageSize = parseInt(this.value, 10);
  patchCurrentPage = 1;
  renderPatchNoteTable(filteredPatchList);
});

document.getElementById('bannerPerPage')?.addEventListener('change', function () {
  bannerPageSize = parseInt(this.value, 10);
  bannerCurrentPage = 1;
  filterBannerTable();
});

// ============================================================
// 관리자 프로필 페이지
// ============================================================

// ===== 관리자 아바타 목록 =====
const ADMIN_AVATAR_LIST = {
  strawhats: [
    { id:'luffy',  src:'img/avatars/luffy.png',  label:'루피'  },
    { id:'zoro',   src:'img/avatars/zoro.png',   label:'조로'  },
    { id:'nami',   src:'img/avatars/nami.png',   label:'나미'  },
    { id:'usopp',  src:'img/avatars/usopp.png',  label:'우솝'  },
    { id:'sanji',  src:'img/avatars/sanji.png',  label:'상디'  },
    { id:'chopper',src:'img/avatars/chopper.png',label:'쵸파'  },
    { id:'robin',  src:'img/avatars/robin.png',  label:'로빈'  },
    { id:'franky', src:'img/avatars/franky.png', label:'프랑키'},
    { id:'brook',  src:'img/avatars/brook.png',  label:'브룩'  },
    { id:'jinbe',  src:'img/avatars/jinbe.png',  label:'진베'  },
  ],
  warlords: [
    { id:'mihawk',     src:'img/avatars/mihawk.png',     label:'미호크'    },
    { id:'crocodile',  src:'img/avatars/crocodile.png',  label:'크로커다일' },
    { id:'doflamingo', src:'img/avatars/doflamingo.png', label:'도플라밍고' },
    { id:'hancock',    src:'img/avatars/hancock.png',    label:'행콕'      },
    { id:'kuma',       src:'img/avatars/kuma.png',       label:'쿠마'      },
    { id:'teach',      src:'img/avatars/teach.png',      label:'티치'      },
    { id:'law',        src:'img/avatars/law.png',        label:'로'        },
    { id:'buggy',      src:'img/avatars/buggy.png',      label:'버기'      },
  ],
  marines: [
    { id:'akainu', src:'img/avatars/akainu.png', label:'아카이누' },
    { id:'kizaru', src:'img/avatars/kizaru.png', label:'키자루'   },
    { id:'smoker', src:'img/avatars/smoker.png', label:'스모커'   },
    { id:'garp',   src:'img/avatars/garp.png',   label:'가프'     },
    { id:'koby',   src:'img/avatars/koby.png',   label:'코비'     },
  ],
  yonko: [
    { id:'whitebeard', src:'img/avatars/whitebeard.png', label:'흰수염' },
    { id:'bigmom',     src:'img/avatars/bigmom.png',     label:'빅맘'  },
    { id:'kaido',      src:'img/avatars/kaido.png',      label:'카이도' },
    { id:'nika',       src:'img/avatars/nika.png',       label:'니카'  },
    { id:'shanks',     src:'img/avatars/shanks.png',     label:'샹크스' },
  ],
  allies: [
    { id:'vivi',   src:'img/avatars/vivi.png',   label:'비비'   },
    { id:'ace',    src:'img/avatars/ace.png',     label:'에이스' },
    { id:'sabo',       src:'img/avatars/sabo.png',       label:'사보'    },
    { id:'bonney',     src:'img/avatars/bonney.png',     label:'보니'    },
    { id:'carrot',     src:'img/avatars/carrot.png',     label:'캐럿'    },
    { id:'yamato',     src:'img/avatars/yamato.png',     label:'야마토'   },
    { id:'kid',        src:'img/avatars/kid.png',        label:'키드'    },
    { id:'dragon',     src:'img/avatars/dragon.png',     label:'드래곤'   },
    { id:'katakuri',   src:'img/avatars/katakuri.png',   label:'카타쿠리'  },
    { id:'dendenmushi',src:'img/avatars/dendenmushi.png',label:'전보벌레'  },
  ],
  pirate_king: [
    { id:'roger', src:'img/avatars/roger.png', label:'로저' },
  ],
};

let profileData = {};
let _adminSelectedAvatar = '';
let _adminSelectedAvatarTab = 'strawhats';

// 아바타 탭 전환
function _adminSwitchAvatarTab(tab) {
  _adminSelectedAvatarTab = tab;
  document.querySelectorAll('#adminAvatarPickerTabs .avatar-picker-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.adminavatartab === tab);
  });
  const grids = ['adminAvatarGridStrawhats','adminAvatarGridWarlords','adminAvatarGridMarines','adminAvatarGridYonko','adminAvatarGridAllies','adminAvatarGridPirateKing'];
  const gridMap = { strawhats:'adminAvatarGridStrawhats', warlords:'adminAvatarGridWarlords', marines:'adminAvatarGridMarines', yonko:'adminAvatarGridYonko', allies:'adminAvatarGridAllies', pirate_king:'adminAvatarGridPirateKing' };
  grids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const active = document.getElementById(gridMap[tab]);
  if (active) active.style.display = 'grid';
}

// 아바타 선택
function _adminSelectAvatar(src, el) {
  _adminSelectedAvatar = src;
  document.querySelectorAll('#section-profile .avatar-option').forEach(a => a.classList.remove('selected'));
  el.classList.add('selected');
  const avatarImg         = document.getElementById('profileAvatarImg');
  const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
  if (src) {
    avatarImg.src = src;
    avatarImg.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
  }
}

// 아바타 그리드 렌더링
function _adminRenderAvatarGrid(tab) {
  const items = ADMIN_AVATAR_LIST[tab] || [];
  const gridMap = { strawhats:'adminAvatarGridStrawhats', warlords:'adminAvatarGridWarlords', marines:'adminAvatarGridMarines', yonko:'adminAvatarGridYonko', allies:'adminAvatarGridAllies', pirate_king:'adminAvatarGridPirateKing' };
  const grid = document.getElementById(gridMap[tab]);
  if (!grid) return;
  grid.innerHTML = items.map(item => `
    <button type="button" class="avatar-option${_adminSelectedAvatar === item.src ? ' selected' : ''}"
      onclick="_adminSelectAvatar('${item.src}', this)" title="${item.label}" aria-label="${item.label}">
      <img src="${item.src}" alt="${item.label}" loading="lazy">
    </button>`).join('');
}

// 아바타 탭 버튼 이벤트 등록
document.getElementById('adminAvatarPickerTabs')?.addEventListener('click', (e) => {
  const tab = e.target.closest('.avatar-picker-tab')?.dataset.adminavatartab;
  if (!tab) return;
  _adminRenderAvatarGrid(tab);
  _adminSwitchAvatarTab(tab);
});

async function loadProfileSection() {
  if (!currentUser) return;

  document.getElementById('profileEmailView').textContent = currentUser.email || '—';
  document.getElementById('profileEmailEdit').textContent = currentUser.email || '—';

  const avatarImg         = document.getElementById('profileAvatarImg');
  const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');

  try {
    const docSnap = await db.collection('users').doc(currentUser.uid).get();
    profileData = docSnap.exists ? docSnap.data() : {};
  } catch (e) {
    profileData = {};
  }

  const imageUrl = profileData.avatar || profileData.profileImage || currentUser.photoURL || '';
  const nickname = profileData.nickname || currentUser.displayName || '';

  updateGNBProfile(nickname, imageUrl);

  document.getElementById('profileNicknameView').textContent = nickname || '닉네임 없음';
  document.getElementById('profileNicknameInput').value = nickname;
  const lenEl = document.getElementById('profileNicknameLen');
  if (lenEl) lenEl.textContent = nickname.length;

  _adminSelectedAvatar = imageUrl;
  _adminSelectedAvatarTab = 'strawhats';
  Object.keys(ADMIN_AVATAR_LIST).forEach(tab => _adminRenderAvatarGrid(tab));
  _adminSwitchAvatarTab('strawhats');

  if (imageUrl) {
    avatarImg.src = imageUrl;
    avatarImg.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
    avatarImg.onerror = () => {
      avatarImg.style.display = 'none';
      avatarPlaceholder.style.display = 'flex';
    };
  } else {
    avatarImg.style.display = 'none';
    avatarPlaceholder.style.display = 'flex';
  }

  showProfileView();
}

function showProfileView() {
  document.getElementById('profileView').style.display = 'block';
  document.getElementById('profileEdit').style.display = 'none';
  const editBtn = document.getElementById('profileAvatarEditBtn');
  if (editBtn) editBtn.style.display = 'none';
}

function showProfileEditMode() {
  document.getElementById('profileView').style.display = 'none';
  document.getElementById('profileEdit').style.display = 'block';
}

// 닉네임 글자수 카운터
document.getElementById('profileNicknameInput')?.addEventListener('input', (e) => {
  const lenEl = document.getElementById('profileNicknameLen');
  if (lenEl) lenEl.textContent = e.target.value.length;
});

document.getElementById('btnProfileEdit')?.addEventListener('click', showProfileEditMode);
document.getElementById('btnProfileCancel')?.addEventListener('click', () => {
  document.getElementById('profileFormError').style.display = 'none';
  loadProfileSection();
});

document.getElementById('btnProfileSave')?.addEventListener('click', async () => {
  if (!currentUser) return;
  const errEl = document.getElementById('profileFormError');
  errEl.style.display = 'none';

  const nickname = document.getElementById('profileNicknameInput').value.trim();
  const avatar   = _adminSelectedAvatar;

  if (nickname.length < 2 || nickname.length > 12) {
    errEl.textContent = '닉네임은 2~12자로 입력해주세요.';
    errEl.style.display = 'block';
    return;
  }

  document.getElementById('btnProfileSave').disabled = true;
  document.getElementById('profileSaveBtnText').textContent = '저장 중...';
  document.getElementById('profileSaveSpinner').style.display = 'inline-block';

  try {
    await db.collection('users').doc(currentUser.uid).set({
      nickname,
      avatar,
    }, { merge: true });

    profileData = { ...profileData, nickname, avatar };

    updateGNBProfile(nickname, avatar || currentUser.photoURL || '');

    const avatarImg         = document.getElementById('profileAvatarImg');
    const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
    if (avatar) {
      avatarImg.src = avatar;
      avatarImg.style.display = 'block';
      avatarPlaceholder.style.display = 'none';
    }

    document.getElementById('profileNicknameView').textContent = nickname || '닉네임 없음';
    showToast('프로필이 저장되었습니다.', 'success');
    showProfileView();
  } catch (err) {
    errEl.textContent = '저장 실패: ' + err.message;
    errEl.style.display = 'block';
    showToast('저장 실패', 'error');
  } finally {
    document.getElementById('btnProfileSave').disabled = false;
    document.getElementById('profileSaveBtnText').textContent = '저장';
    document.getElementById('profileSaveSpinner').style.display = 'none';
  }
});

// ===== CHARACTER IMAGE EDITOR (Cropper.js) =====

let _charEditBlob   = null;
let _bannerEditBlob = null;
let _charEditorTarget = 'char';

let _charCropper    = null;
let _charFlippedH   = false;
let _charEditorBlobUrl = null;
let _charEditorPreviousBodyOverflow = '';

function _getCharEditorCropBoxSize(containerData) {
  if (_charEditorTarget === 'banner') {
    const ratio = 1472 / 420;
    const width = Math.min(920, containerData.width - 4, (containerData.height - 4) * ratio);
    return { width, height: width / ratio };
  }
  const size = Math.min(500, containerData.height - 4, containerData.width - 4);
  return { width: size, height: size };
}

function _positionCharEditorCropper() {
  if (!_charCropper) return;
  const containerData = _charCropper.getContainerData();
  const imageData = _charCropper.getImageData();
  const cropSize = _getCharEditorCropBoxSize(containerData);

  _charCropper.setCropBoxData({
    left: (containerData.width - cropSize.width) / 2,
    top: (containerData.height - cropSize.height) / 2,
    width: cropSize.width,
    height: cropSize.height,
  });

  const coverZoom = Math.max(
    cropSize.width / imageData.naturalWidth,
    cropSize.height / imageData.naturalHeight
  );
  _charCropper.zoomTo(coverZoom);
  const newWidth = imageData.naturalWidth * coverZoom;
  const newHeight = imageData.naturalHeight * coverZoom;
  _charCropper.setCanvasData({
    left: (containerData.width - newWidth) / 2,
    top: (containerData.height - newHeight) / 2,
  });
}

/**
 * 캐릭터 이미지 편집기 열기
 * @param {File|null} file  - 새로 선택한 파일 (File 객체)
 * @param {string|null} srcUrl - 기존 업로드된 URL (file 없을 때 사용)
 */
function openCharEditor(file, srcUrl) {
  if (!file && !srcUrl) {
    showToast('편집할 이미지가 없습니다.', 'error');
    return;
  }

  // 이전 크로퍼 정리
  if (_charCropper) {
    _charCropper.destroy();
    _charCropper = null;
  }
  if (_charEditorBlobUrl) {
    URL.revokeObjectURL(_charEditorBlobUrl);
    _charEditorBlobUrl = null;
  }

  _charFlippedH = false;
  const editorImg = document.getElementById('charEditorImg');
  const isBannerEditor = _charEditorTarget === 'banner';
  document.getElementById('charEditorTitle').textContent = isBannerEditor ? '배너 이미지 편집' : '캐릭터 이미지 편집';
  document.getElementById('charEditorSubtitle').textContent = isBannerEditor
    ? '가로형 비율 고정 · 출력 1472×420 px'
    : '1:1 비율 고정 · 출력 500×500 px';
  editorImg.alt = isBannerEditor ? '배너 편집 이미지' : '캐릭터 편집 이미지';

  const _initCropper = () => {
    // ① 먼저 오버레이를 열어 컨테이너 치수 확보
    // (display:none 상태에서 Cropper를 초기화하면 컨테이너 크기가 0 → 이미지 좌상단 배치 버그)
    const overlay    = document.getElementById('charEditorOverlay');
    const editorBody = document.getElementById('charEditorBody');
    _charEditorPreviousBodyOverflow = document.body.style.overflow;
    overlay.classList.add('open');
    editorBody.classList.add('ce-loading'); // Cropper 준비 완료 전까지 숨김 (flash 방지)
    document.body.style.overflow = 'hidden';

    // ② 브라우저가 레이아웃(치수 계산)을 실제로 완료한 뒤 Cropper 초기화
    //    double-RAF: 첫 번째 RAF에서 스타일 적용, 두 번째 RAF에서 페인트 완료 보장
    requestAnimationFrame(() => requestAnimationFrame(() => {
      _charCropper = new Cropper(editorImg, {
        aspectRatio: isBannerEditor ? 1472 / 420 : 1,
        viewMode: 0,   // 이미지를 에디터 밖까지 자유롭게 이동 가능
        dragMode: 'move',
        autoCropArea: 1,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
        background: false,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: true,
        ready() {
          _positionCharEditorCropper();

          // ⑥ 위치 결정 완료 후 ce-loading 제거 → 편집기 표시 (flash 없음)
          editorBody.classList.remove('ce-loading');
          _addCharGuideOverlays();
        },
      });
    }));
  };

  if (file) {
    _charEditorBlobUrl = URL.createObjectURL(file);
    // onload/onerror를 src 설정 전에 반드시 먼저 등록
    // (Blob URL은 브라우저에 따라 동기 로드되어 onload가 먼저 발화할 수 있음)
    editorImg.onload  = _initCropper;
    editorImg.onerror = () => showToast('이미지 로드 실패: 지원하지 않는 파일 형식이거나 손상된 파일입니다.', 'error');
    editorImg.src     = _charEditorBlobUrl;
  } else {
    // fetch → Blob URL 방식: tainted canvas(SecurityError) 없이 getCroppedCanvas() 정상 동작
    fetch(srcUrl)
      .then(r => {
        if (!r.ok) throw new Error('fetch 실패');
        return r.blob();
      })
      .then(blob => {
        _charEditorBlobUrl = URL.createObjectURL(blob);
        editorImg.onload  = _initCropper;
        editorImg.onerror = () => showToast('이미지 로드 실패', 'error');
        editorImg.src     = _charEditorBlobUrl;
      })
      .catch(() => {
        // fetch 실패 시 직접 로드 (최후 수단)
        editorImg.onload  = _initCropper;
        editorImg.onerror = () => showToast('이미지 로드 실패', 'error');
        editorImg.src     = srcUrl;
      });
  }
}

/** Cropper.js crop-box 안에 Main Area 가이드 오버레이 추가 */
function _addCharGuideOverlays() {
  const cropBox = document.querySelector('#charEditorBody .cropper-crop-box');
  if (!cropBox) return;

  // 기존 오버레이 제거
  cropBox.querySelectorAll('.ce-guide').forEach(el => el.remove());

  const isBannerEditor = _charEditorTarget === 'banner';
  const main = document.createElement('div');
  main.className = 'ce-guide ce-guide-main';
  main.innerHTML = isBannerEditor
    ? '<span class="ce-guide-label">Banner Area (1472×420)</span>'
    : '<span class="ce-guide-label">Main Area (500×500)</span>';
  cropBox.appendChild(main);
}

/** 캐릭터 이미지 편집기 닫기 */
function closeCharEditor() {
  document.getElementById('charEditorOverlay').classList.remove('open');
  document.body.style.overflow = _charEditorPreviousBodyOverflow;
  _charEditorPreviousBodyOverflow = '';
  if (_charCropper) {
    _charCropper.destroy();
    _charCropper = null;
  }
  const editorImg = document.getElementById('charEditorImg');
  // src 변경 전 핸들러 제거 — src='' 설정 시 onerror가 발화하는 것 방지
  editorImg.onload  = null;
  editorImg.onerror = null;
  editorImg.removeAttribute('crossOrigin');
  if (_charEditorBlobUrl) {
    URL.revokeObjectURL(_charEditorBlobUrl);
    _charEditorBlobUrl = null;
  }
  editorImg.src = '';
  _charFlippedH = false;
}

/** 편집 완료 — 500×500 크롭 후 Cloudinary 업로드 */
async function applyCharEditor() {
  if (!_charCropper) return;
  const isBannerEditor = _charEditorTarget === 'banner';
  const outputWidth = isBannerEditor ? 1472 : 500;
  const outputHeight = isBannerEditor ? 420 : 500;
  const outputType = isBannerEditor ? 'image/jpeg' : 'image/png';

  const applyBtn     = document.getElementById('charEditorApplyBtn');
  const applyText    = document.getElementById('charEditorApplyText');
  const applySpinner = document.getElementById('charEditorApplySpinner');
  applyBtn.disabled  = true;
  if (applyText)    applyText.style.display    = 'none';
  if (applySpinner) applySpinner.style.display = 'inline-block';

  try {
    // 배너는 1472×420, 캐릭터 이미지는 500×500으로 크롭
    const canvas = _charCropper.getCroppedCanvas({
      width:  outputWidth,
      height: outputHeight,
      imageSmoothingEnabled:  true,
      imageSmoothingQuality: 'high',
    });

    if (!canvas) throw new Error('크롭 캔버스 생성 실패');

    const blob = await new Promise((res, rej) =>
      canvas.toBlob(
        b => b ? res(b) : rej(new Error('Canvas export 실패')),
        outputType,
        isBannerEditor ? 0.92 : undefined
      )
    );
    const file = new File([blob], isBannerEditor ? 'banner.jpg' : 'character.png', { type: outputType });
    const folder = isBannerEditor
      ? 'banners'
      : _charEditorTarget === 'supportChar' ? 'supportCharacters' : 'characters';
    const url  = await uploadImageToStorage(file, folder);

    if (isBannerEditor) {
      document.getElementById('bannerFieldImageUrl').value = url;
      _bannerEditBlob = file;
      showBannerImgUrl(url);
    } else if (_charEditorTarget === 'supportChar') {
      document.getElementById('scFieldImgData').value = url;
      _scEditBlob = file;
      showScImgUrl(url);
    } else {
      document.getElementById('fieldImgData').value = url;
      _charEditBlob = file;
      showCharImgUrl(url);
    }
    showToast(isBannerEditor ? '배너 이미지가 적용되었습니다.' : '이미지가 적용되었습니다.', 'success');
    closeCharEditor();
  } catch (err) {
    const msg = err.name === 'SecurityError'
      ? '이미지 보안 오류: 이미지를 다시 업로드한 후 편집해 주세요.'
      : '편집 적용 실패: ' + err.message;
    showToast(msg, 'error');
  } finally {
    applyBtn.disabled = false;
    if (applyText)    applyText.style.display    = '';
    if (applySpinner) applySpinner.style.display = 'none';
  }
}

/**
 * 이미지별 편집 버튼에서 공용 Cropper 편집기를 연다.
 */
function openImgEditor(target) {
  if (target === 'char') {
    _charEditorTarget = 'char';
    const srcUrl = document.getElementById('fieldImgData')?.value || '';
    openCharEditor(_charEditBlob || null, srcUrl || null);
  } else if (target === 'supportChar') {
    _charEditorTarget = 'supportChar';
    const srcUrl = document.getElementById('scFieldImgData')?.value || '';
    openCharEditor(_scEditBlob || null, srcUrl || null);
  } else if (target === 'banner') {
    _charEditorTarget = 'banner';
    const srcUrl = document.getElementById('bannerFieldImageUrl')?.value || '';
    openCharEditor(_bannerEditBlob || null, srcUrl || null);
  }
}

// ── 이벤트 바인딩 ──
(function initCharEditor() {
  document.getElementById('charEditorCloseBtn')?.addEventListener('click', closeCharEditor);
  document.getElementById('charEditorCancelBtn')?.addEventListener('click', closeCharEditor);
  document.getElementById('charEditorOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('charEditorOverlay')) closeCharEditor();
  });
  document.getElementById('charEditorApplyBtn')?.addEventListener('click', applyCharEditor);

  // 반시계 90° 회전
  document.getElementById('ceRotateL')?.addEventListener('click', () => {
    _charCropper?.rotate(-90);
  });
  // 시계 90° 회전
  document.getElementById('ceRotateR')?.addEventListener('click', () => {
    _charCropper?.rotate(90);
  });
  // 좌우 반전
  document.getElementById('ceFlipH')?.addEventListener('click', () => {
    if (!_charCropper) return;
    _charFlippedH = !_charFlippedH;
    _charCropper.scaleX(_charFlippedH ? -1 : 1);
  });
  // 확대
  document.getElementById('ceZoomIn')?.addEventListener('click', () => {
    _charCropper?.zoom(0.1);
  });
  // 축소
  document.getElementById('ceZoomOut')?.addEventListener('click', () => {
    _charCropper?.zoom(-0.1);
  });
  // 초기화
  document.getElementById('ceReset')?.addEventListener('click', () => {
    if (!_charCropper) return;
    _charFlippedH = false;
    _charCropper.reset();
    requestAnimationFrame(() => {
      if (!_charCropper) return;  // 닫기가 RAF보다 먼저 호출된 경우 방어
      _positionCharEditorCropper();
    });
  });

  // 휠 줌은 Cropper.js 내장(zoomable:true) 이 처리함
  // — charEditorBody 에 별도 wheel 리스너를 등록하면 Cropper 내부 이벤트와 겹쳐
  //   한 번 스크롤에 두 번 줌이 적용되므로 제거
})();

// ===== PERMISSIONS SECTION (총괄 관리자 전용) =====

let _permAllUsers   = [];
let _permUserPage   = 1;
const PERM_USER_PAGE_SIZE = 20;
let _permActiveTab  = 'users';

// ── 탭 전환 ──
document.querySelectorAll('.perm-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    // 관리자 권한 탭은 총괄 관리자만 접근 가능
    if (btn.dataset.permtab === 'admins' && !isSuperAdmin()) return;
    _permActiveTab = btn.dataset.permtab;
    document.querySelectorAll('.perm-tab').forEach(b => b.classList.toggle('active', b === btn));
    document.getElementById('permPanelUsers').style.display  = _permActiveTab === 'users'  ? '' : 'none';
    document.getElementById('permPanelAdmins').style.display = _permActiveTab === 'admins' ? '' : 'none';
    if (_permActiveTab === 'admins') loadPermAdmins();
  });
});

// ── 섹션 진입 ──
async function loadPermissionsSection() {
  if (!hasPermAccess()) return;
  _permActiveTab = 'admins';
  document.querySelectorAll('.perm-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('permPanelUsers').style.display  = 'none';
  document.getElementById('permPanelAdmins').style.display = '';
  await loadPermAdmins();
}

// ── 사용자 목록 로드 ──
async function loadPermUsers() {
  if (!hasMemberAccess()) return;
  const tbody = document.getElementById('permUserTableBody');
  showTableLoading(tbody, 5);
  try {
    const snap = await db.collection('users').get();
    _permAllUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    _permUserPage = 1;
    renderPermUserTable();
  } catch (e) {
    showTableError(tbody, `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--danger)">로드 실패: ${escHtml(e.message)}</td></tr>`);
  }
}

function renderPermUserTable() {
  const query  = (document.getElementById('permUserSearch')?.value || '').trim().toLowerCase();
  const filtered = _permAllUsers.filter(u => {
    if (!query) return true;
    return (u.nickname || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query) || u.uid.toLowerCase().includes(query);
  });

  document.getElementById('permUserCountLabel').textContent = `총 ${filtered.length}명`;

  const start  = (_permUserPage - 1) * PERM_USER_PAGE_SIZE;
  const paged  = filtered.slice(start, start + PERM_USER_PAGE_SIZE);
  const tbody  = document.getElementById('permUserTableBody');

  if (!paged.length) {
    setTableBodyHtml(tbody, tableEmptyStateRow(5));
    applyTableSelection('permUserTableBody', []);
    document.getElementById('permUserPaginator').innerHTML = '';
    return;
  }

  const rowsHtml = paged.map(u => {
    // email 필드가 아직 없는 기존 유저 대비: uid 일치 + isSuperAdmin() 이중 체크
    const isSA       = u.email === SUPER_ADMIN_EMAIL || (u.uid === currentUser?.uid && isSuperAdmin());
    const canWrite   = u.canWrite !== false;
    const avatarSrc  = u.avatar || u.profileImage || '';
    const avatarHtml = avatarSrc
      ? `<img src="${escHtml(avatarSrc)}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle">`
      : `<div class="perm-avatar-placeholder"></div>`;
    const superBadge = isSA ? ' <span class="perm-badge perm-badge-super">총괄</span>' : '';
    const badgeClass = canWrite ? 'perm-badge perm-badge-ok' : 'perm-badge perm-badge-block';
    const badgeText  = canWrite ? '허용' : '차단됨';
    return `
      <tr>
        <td>${avatarHtml}</td>
        <td>${escHtml(u.nickname || '닉네임 없음')}${superBadge}</td>
        <td class="perm-uid">${escHtml(u.uid)}</td>
        <td>${isSA
          ? '<span style="color:var(--text-muted);font-size:12px">—</span>'
          : `<span class="${badgeClass}">${badgeText}</span>`}
        </td>
        <td class="col-actions">
          ${isSA
            ? '<span style="color:var(--text-muted);font-size:12px">변경 불가</span>'
            : canWrite
              ? `<button class="btn-danger btn-sm" onclick="toggleUserWrite('${u.uid}', false)">글쓰기 차단</button>`
              : `<button class="btn-primary btn-sm" onclick="toggleUserWrite('${u.uid}', true)">차단 해제</button>`
          }
        </td>
      </tr>`;
  }).join('');
  setTableBodyHtml(tbody, rowsHtml);
  applyTableSelection('permUserTableBody', paged.map(u => u.uid));

  renderPaginator('permUserPaginator', filtered.length, PERM_USER_PAGE_SIZE, _permUserPage, (p) => {
    _permUserPage = p;
    renderPermUserTable();
  });
}

async function toggleUserWrite(uid, allow) {
  if (!isSuperAdmin() && !_myCanManageUsers) { showToast('권한이 없습니다.', 'error'); return; }
  // 총괄 관리자 계정은 변경 불가 (email 또는 uid 이중 체크)
  const targetUser = _permAllUsers.find(u => u.uid === uid);
  const isSA = targetUser?.email === SUPER_ADMIN_EMAIL || (uid === currentUser?.uid && isSuperAdmin());
  if (isSA) { showToast('총괄 관리자의 권한은 변경할 수 없습니다.', 'error'); return; }
  try {
    await db.collection('users').doc(uid).set({ canWrite: allow }, { merge: true });
    const idx = _permAllUsers.findIndex(u => u.uid === uid);
    if (idx !== -1) _permAllUsers[idx].canWrite = allow;
    renderPermUserTable();
    showToast(allow ? '글쓰기 권한이 허용되었습니다.' : '글쓰기 권한이 차단되었습니다.', 'success');
  } catch (e) {
    showToast('변경 실패: ' + e.message, 'error');
  }
}

// ===== 세부 권한 모달 =====
let _editingPermEmail = null;
let _editingPermData  = {};

function openSectionPermModal(email) {
  if (!isSuperAdmin()) { showToast('권한이 없습니다.', 'error'); return; }
  const admin = _permAdminList.find(a => a.email === email);
  if (!admin || admin.isSuperAdmin) return;
  _editingPermEmail = email;
  // 기존 권한 복사 (없으면 기본값 false)
  const base = admin.sectionPerms || {};
  _editingPermData = {};
  SECTION_CONFIG.forEach(sec => {
    _editingPermData[sec.permKey] = {
      view:    base[sec.permKey]?.view    ?? false,
      add:     base[sec.permKey]?.add     ?? false,
      edit:    base[sec.permKey]?.edit    ?? false,
      delete:  base[sec.permKey]?.delete  ?? false,
      publish: base[sec.permKey]?.publish ?? false,
    };
  });
  document.getElementById('permSectionModalTitle').textContent = `세부 권한 설정 — ${escHtml(admin.nickname || email)}`;
  _renderSectionPermTable();
  document.getElementById('permSectionModal').style.display = 'flex';
}

function _renderSectionPermTable() {
  const tbody = document.getElementById('permSectionModalBody');
  let currentGroup = '';
  tbody.innerHTML = SECTION_CONFIG.map(sec => {
    const sp = _editingPermData[sec.permKey] || {};
    const groupHeading = sec.group && sec.group !== currentGroup
      ? `<tr class="perm-section-group"><th colspan="${PERM_ACTIONS.length + 1}" style="padding:12px 12px 6px;text-align:left;color:var(--text-muted);font-size:12px;font-weight:700;border-bottom:1px solid var(--border)">${escHtml(sec.group)}</th></tr>`
      : '';
    if (sec.group) currentGroup = sec.group;
    return `${groupHeading}<tr>
      <td style="font-weight:600;padding:10px 12px">${escHtml(sec.label)}</td>
      ${PERM_ACTIONS.map(a => `
      <td style="text-align:center;padding:10px 8px">
        <label class="perm-toggle-wrap" style="justify-content:center">
          <input type="checkbox" class="perm-toggle-input" ${sp[a.key] ? 'checked' : ''}
            onchange="_editingPermData['${sec.permKey}']['${a.key}'] = this.checked; _syncViewPerm('${sec.permKey}')">
          <span class="perm-toggle-track"><span class="perm-toggle-thumb"></span></span>
        </label>
      </td>`).join('')}
    </tr>`;
  }).join('');
}

// 추가/수정/삭제/저장 권한이 하나라도 있으면 보기 자동 ON
function _syncViewPerm(permKey) {
  const sp = _editingPermData[permKey];
  if (sp.add || sp.edit || sp.delete || sp.publish) sp.view = true;
  // 체크박스 직접 업데이트
  _renderSectionPermTable();
}

// 행 전체 선택/해제
function toggleSectionRow(permKey, checked) {
  PERM_ACTIONS.forEach(a => { _editingPermData[permKey][a.key] = checked; });
  _renderSectionPermTable();
}

// 열 전체 선택/해제
function toggleSectionCol(actionKey, checked) {
  SECTION_CONFIG.forEach(sec => { _editingPermData[sec.permKey][actionKey] = checked; });
  _renderSectionPermTable();
}

// 전체 선택/해제
function toggleAllSectionPerms(checked) {
  SECTION_CONFIG.forEach(sec => PERM_ACTIONS.forEach(a => { _editingPermData[sec.permKey][a.key] = checked; }));
  _renderSectionPermTable();
}

function closePermSectionModal() {
  document.getElementById('permSectionModal').style.display = 'none';
  _editingPermEmail = null;
  _editingPermData  = {};
}

async function saveSectionPerms() {
  if (!isSuperAdmin()) { showToast('권한이 없습니다.', 'error'); return; }
  const email = _editingPermEmail;
  if (!email) return;
  const btn = document.getElementById('btnSaveSectionPerms');
  if (btn) { btn.disabled = true; btn.textContent = '저장 중...'; }
  try {
    const saved = JSON.parse(JSON.stringify(_editingPermData));
    await db.collection('adminPermissions').doc(email).set({
      sectionPerms: saved,
      updatedBy: currentUser.email,
      updatedAt: nowTS(),
    }, { merge: true });
    const admin = _permAdminList.find(a => a.email === email);
    if (admin) admin.sectionPerms = saved;
    showToast(`${email} 세부 권한이 저장되었습니다.`, 'success');
    closePermSectionModal();
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '저장'; }
  }
}

// 검색
document.getElementById('permUserSearch')?.addEventListener('input', () => {
  _permUserPage = 1;
  renderPermUserTable();
});

// 새로고침 시 검색어와 선택 상태를 초기화
document.getElementById('btnRefreshPermUsers')?.addEventListener('click', () =>
  refreshTableWithReset(['permUserSearch'], loadPermUsers, 'permUserTableBody')
);

// ── 관리자 권한 탭 ──
let _permAdminList = [];

async function loadPermAdmins() {
  if (!isSuperAdmin()) return;
  const tbody = document.getElementById('permAdminTableBody');
  showTableLoading(tbody, 6);
  try {
    // adminMeta/nicknames 에서 닉네임 맵 가져오기
    const nickSnap = await db.collection('adminMeta').doc('nicknames').get();
    const nickMap  = nickSnap.exists ? nickSnap.data() : {};

    // 각 관리자의 권한 정보를 adminPermissions 컬렉션에서 조회
    const permSnap = await db.collection('adminPermissions').get();
    const permMap  = {};
    permSnap.docs.forEach(d => { permMap[d.id] = d.data(); });

    _permAdminList = ADMIN_EMAILS.map(email => ({
      email,
      nickname: nickMap[email] || '',
      canManageUsers:   permMap[email]?.canManageUsers   ?? false,
      canManageContent: permMap[email]?.canManageContent ?? true,
      canPermission:    permMap[email]?.canPermission    ?? false,
      sectionPerms:     permMap[email]?.sectionPerms      ?? null,
      isSuperAdmin:     email === SUPER_ADMIN_EMAIL,
    }));

    document.getElementById('permAdminCountLabel').textContent = `총 ${_permAdminList.length}명`;
    renderPermAdminTable();
  } catch (e) {
    showTableError(tbody, `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--danger)">로드 실패: ${escHtml(e.message)}</td></tr>`);
  }
}

function renderPermAdminTable() {
  const tbody = document.getElementById('permAdminTableBody');
  if (!_permAdminList.length) {
    setTableBodyHtml(tbody, tableEmptyStateRow(6));
    applyTableSelection('permAdminTableBody', []);
    return;
  }
  const rowsHtml = _permAdminList.map((admin, idx) => {
    const superBadge = admin.isSuperAdmin ? ' <span class="perm-badge perm-badge-super">총괄</span>' : '';
    const disabled   = admin.isSuperAdmin ? ' disabled title="총괄 관리자는 변경 불가"' : '';
    return `
      <tr>
        <td>${escHtml(admin.nickname || '—')}${superBadge}</td>
        <td>${escHtml(admin.email)}</td>
        <td>
          <label class="perm-toggle-wrap">
            <input type="checkbox" class="perm-toggle-input" ${admin.canManageUsers ? 'checked' : ''} ${disabled}
              onchange="updateAdminPerm('${admin.email}', 'canManageUsers', this.checked)">
            <span class="perm-toggle-track"><span class="perm-toggle-thumb"></span></span>
          </label>
        </td>
        <td>
          ${admin.isSuperAdmin
            ? '<span style="color:var(--text-muted);font-size:12px">총괄 (전체)</span>'
            : `<button class="btn-primary btn-sm" onclick="openSectionPermModal('${admin.email}')">세부 권한 설정</button>`}
        </td>
        <td>
          <label class="perm-toggle-wrap">
            <input type="checkbox" class="perm-toggle-input" ${admin.canPermission ? 'checked' : ''} ${disabled}
              onchange="updateAdminPerm('${admin.email}', 'canPermission', this.checked)">
            <span class="perm-toggle-track"><span class="perm-toggle-thumb"></span></span>
          </label>
        </td>
        <td class="col-actions">
          ${admin.isSuperAdmin ? '<span style="color:var(--text-muted);font-size:12px">변경 불가</span>' : `<button class="btn-primary btn-sm" onclick="saveAdminPermRow('${admin.email}')">저장</button>`}
        </td>
      </tr>`;
  }).join('');
  setTableBodyHtml(tbody, rowsHtml);
  applyTableSelection('permAdminTableBody', _permAdminList.map(admin => admin.email));
}

async function updateAdminPerm(email, field, value) {
  const admin = _permAdminList.find(a => a.email === email);
  if (admin) admin[field] = value;
}

async function saveAdminPermRow(email) {
  if (!isSuperAdmin()) { showToast('권한이 없습니다.', 'error'); return; }
  const admin = _permAdminList.find(a => a.email === email);
  if (!admin) return;
  try {
    await db.collection('adminPermissions').doc(email).set({
      canManageUsers:   admin.canManageUsers,
      canPermission:    admin.canPermission,
      updatedBy: currentUser.email,
      updatedAt: nowTS(),
    }, { merge: true });
    showToast(`${email} 권한이 저장되었습니다.`, 'success');
  } catch (e) {
    showToast('저장 실패: ' + e.message, 'error');
  }
}

document.getElementById('btnRefreshPermAdmins')?.addEventListener('click', () =>
  refreshTableWithReset([], loadPermAdmins, 'permAdminTableBody')
);


