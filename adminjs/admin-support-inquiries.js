// ===== CUSTOMER SUPPORT MANAGEMENT =====
(function () {
  'use strict';

  const tableBody = document.getElementById('supportInquiryTableBody');
  let unsubscribe = null;
  let listenerVersion = 0;
  let activeUid = null;

  function showMessage(message, loading) {
    if (!tableBody) return;
    tableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'table-empty-cell';
    const state = document.createElement('div');
    state.className = 'table-empty-state';
    const title = document.createElement('div');
    title.className = loading ? 'table-loading' : 'table-empty-state-title';
    title.textContent = message;
    state.appendChild(title);
    cell.appendChild(state);
    row.appendChild(cell);
    tableBody.appendChild(row);
  }

  function timestampValue(value) {
    try {
      if (value && typeof value.toDate === 'function') return value.toDate();
      if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parts = value.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    } catch (_) {
      return null;
    }
  }

  function formatDate(value) {
    const date = timestampValue(value);
    return date
      ? date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '날짜 정보 없음';
  }

  function addCell(row, value, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value == null ? '' : String(value);
    row.appendChild(cell);
  }

  function renderInquiries(snapshot) {
    if (!tableBody) return;
    const inquiries = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      const submittedAt = data.createdAt || data.created_at || data.date || data.timestamp;
      const date = timestampValue(submittedAt);
      return {
        title: data.title || data.subject || '제목 없음',
        content: data.content || data.message || data.body || '',
        contact: data.contact || data.email || data.userEmail || '연락처 미입력',
        status: data.status || '접수완료',
        submittedAt,
        sortTime: date ? date.getTime() : 0
      };
    }).sort((a, b) => b.sortTime - a.sortTime);

    tableBody.replaceChildren();
    if (!inquiries.length) {
      showMessage('아직 접수된 문의가 없습니다.', false);
      return;
    }

    inquiries.forEach(inquiry => {
      const row = document.createElement('tr');
      addCell(row, formatDate(inquiry.submittedAt));
      addCell(row, inquiry.title);
      addCell(row, inquiry.content || '내용 없음', 'support-inquiry-message');
      addCell(row, inquiry.contact);
      addCell(row, inquiry.status);
      tableBody.appendChild(row);
    });
  }

  function stopListener() {
    listenerVersion++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    activeUid = null;
  }

  function startListener() {
    if (!tableBody || !db || !currentUser) return;
    if (unsubscribe && activeUid === currentUser.uid) return;
    stopListener();
    const version = listenerVersion;
    activeUid = currentUser.uid;
    showMessage('문의 내역을 불러오는 중...', true);
    try {
      unsubscribe = db.collection('inquiries')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .onSnapshot(snapshot => {
          if (version !== listenerVersion) return;
          renderInquiries(snapshot);
        }, error => {
          if (version !== listenerVersion) return;
          console.warn('고객센터 문의 목록을 불러오지 못했습니다:', error);
          unsubscribe = null;
          activeUid = null;
          showMessage('문의 목록을 불러오지 못했습니다. Firestore 규칙 배포와 관리자 권한을 확인해 주세요.', false);
        });
    } catch (error) {
      console.warn('고객센터 문의 구독을 시작하지 못했습니다:', error);
      activeUid = null;
      showMessage('문의 목록을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.', false);
    }
  }

  auth.onAuthStateChanged(user => {
    if (!user || !currentUser || currentUser.uid !== user.uid) {
      stopListener();
      showMessage('관리자 로그인 후 문의 내역을 확인할 수 있습니다.', false);
      return;
    }
    startListener();
  });

  document.addEventListener('admin:permissions-ready', () => {
    if (auth.currentUser && currentUser && auth.currentUser.uid === currentUser.uid) {
      startListener();
    }
  });

})();
