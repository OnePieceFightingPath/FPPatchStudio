// ============================================================
// USER COMMUNITY PAGE VISIBILITY
// Stored alongside existing public-readable publish metadata.
// ============================================================

const COMMUNITY_VISIBILITY_DOC = 'communityVisibility';
const COMMUNITY_VISIBILITY_DEFAULTS = { boardsEnabled: true, eventsEnabled: true };

function renderCommunityVisibilityControl(key, enabled, saving = false) {
  const toggle = document.getElementById(`${key}VisibilityToggle`);
  const state = document.getElementById(`${key}VisibilityState`);
  if (!toggle || !state) return;

  const canEdit = key === 'board' ? canPublishIn('boards') : canPublishIn('events');
  toggle.checked = enabled;
  toggle.disabled = saving || !canEdit;
  state.textContent = saving ? '저장 중' : (enabled ? 'ON' : 'OFF');
  const control = toggle.closest('.content-visibility-control');
  control?.classList.toggle('is-on', enabled);
  control?.classList.toggle('is-saving', saving);
  if (!canEdit) toggle.title = '이 항목을 변경할 권한이 없습니다.';
}

async function loadCommunityVisibility() {
  try {
    const snapshot = await db.collection('publishMeta').doc(COMMUNITY_VISIBILITY_DOC).get();
    const data = snapshot.exists ? snapshot.data() : {};
    renderCommunityVisibilityControl('board', data.boardsEnabled !== false);
    renderCommunityVisibilityControl('event', data.eventsEnabled !== false);
  } catch (error) {
    console.warn('사용자 페이지 노출 설정을 불러오지 못했습니다:', error);
    renderCommunityVisibilityControl('board', true);
    renderCommunityVisibilityControl('event', true);
    showToast('사용자 페이지 노출 설정을 불러오지 못했습니다.', 'error');
  }
}

async function saveCommunityVisibility(key, enabled) {
  if (!(key === 'board' ? canPublishIn('boards') : canPublishIn('events'))) {
    renderCommunityVisibilityControl(key, !enabled);
    showToast('사용자 페이지 노출 설정 저장 권한이 없습니다.', 'error');
    return;
  }
  const field = key === 'board' ? 'boardsEnabled' : 'eventsEnabled';
  renderCommunityVisibilityControl(key, enabled, true);
  try {
    await firestoreWrite(db.collection('publishMeta').doc(COMMUNITY_VISIBILITY_DOC).set({
      [field]: enabled,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser?.email || '',
    }, { merge: true }));
    renderCommunityVisibilityControl(key, enabled);
    showToast(`${key === 'board' ? '게시판' : '이벤트'} 사용자 페이지가 ${enabled ? 'On' : 'Off'} 되었습니다.`, 'success');
  } catch (error) {
    renderCommunityVisibilityControl(key, !enabled);
    showToast('설정 저장 실패: ' + error.message, 'error');
  }
}

document.getElementById('boardVisibilityToggle')?.addEventListener('change', event => {
  saveCommunityVisibility('board', event.target.checked);
});
document.getElementById('eventVisibilityToggle')?.addEventListener('change', event => {
  saveCommunityVisibility('event', event.target.checked);
});

loadCommunityVisibility();
document.addEventListener('admin:permissions-ready', loadCommunityVisibility);
