// ===== CUSTOMER SUPPORT MANAGEMENT =====
(function () {
  'use strict';

  const COLUMN_COUNT = 8;
  const STATUS = {
    RECEIVED: '접수완료',
    WAITING: '문의대기',
    IN_PROGRESS: '진행중',
    COMPLETED: '완료됨'
  };
  const tableBody = document.getElementById('supportInquiryTableBody');
  const countLabel = document.getElementById('supportInquiryCountLabel');
  const selectAllCheckbox = document.getElementById('supportInquirySelectAll');
  const modal = document.getElementById('supportInquiryModal');
  const modalTitle = document.getElementById('supportInquiryModalTitle');
  const modalRequester = document.getElementById('supportInquiryModalRequester');
  const modalDate = document.getElementById('supportInquiryModalDate');
  const modalEmail = document.getElementById('supportInquiryModalEmail');
  const modalContent = document.getElementById('supportInquiryModalContent');
  const answerGroup = document.getElementById('supportInquiryAnswerGroup');
  const answerInput = document.getElementById('supportInquiryAnswer');
  const modalCancel = document.getElementById('supportInquiryModalCancel');
  const modalClose = document.getElementById('supportInquiryModalClose');
  const answerSubmit = document.getElementById('supportInquiryAnswerSubmit');

  let unsubscribe = null;
  let listenerVersion = 0;
  let activeUid = null;
  let inquiries = [];
  let activeInquiry = null;
  let modalMode = 'content';
  let savingReply = false;
  const selectedIds = new Set();
  const busyIds = new Set();

  function setCount(text) {
    if (countLabel) countLabel.textContent = text;
  }

  function showMessage(message, loading) {
    if (!tableBody) return;
    tableBody.replaceChildren();
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = COLUMN_COUNT;
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
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.disabled = true;
    }
    setCount(loading ? '로딩 중...' : '총 0건');
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

  function firstValue(values, fallback) {
    for (const value of values) {
      if (value != null && String(value).trim()) return String(value).trim();
    }
    return fallback;
  }

  function normalizeStatus(value) {
    const status = String(value || '').trim();
    if (Object.values(STATUS).includes(status)) return status;
    const aliases = {
      received: STATUS.RECEIVED,
      new: STATUS.RECEIVED,
      waiting: STATUS.WAITING,
      pending: STATUS.WAITING,
      in_progress: STATUS.IN_PROGRESS,
      processing: STATUS.IN_PROGRESS,
      completed: STATUS.COMPLETED,
      done: STATUS.COMPLETED
    };
    return aliases[status.toLowerCase()] || STATUS.RECEIVED;
  }

  function getAnswer(data) {
    return firstValue([data.reply, data.answer, data.adminReply, data.replyContent], '');
  }

  function mapInquiry(doc) {
    const data = doc.data() || {};
    const submittedAt = data.createdAt || data.created_at || data.submittedAt || data.date || data.timestamp;
    const submittedDate = timestampValue(submittedAt);
    const email = firstValue([data.replyEmail, data.contactEmail, data.email, data.userEmail, data.contact], '이메일 미입력');
    return {
      id: doc.id,
      requester: firstValue([
        data.nickname,
        data.name,
        data.userName,
        data.requesterName,
        data.writer,
        data.author,
        data.displayName,
        data.user && data.user.nickname
      ], '닉네임 정보 없음'),
      title: firstValue([data.title, data.subject, data.inquiryTitle, data.questionTitle], '제목 없음'),
      content: firstValue([data.content, data.message, data.body, data.question], '내용 없음'),
      email,
      status: normalizeStatus(data.status),
      answer: getAnswer(data),
      submittedAt,
      sortTime: submittedDate ? submittedDate.getTime() : 0
    };
  }

  function addCell(row, value, className) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = value == null ? '' : String(value);
    row.appendChild(cell);
    return cell;
  }

  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const selectedCount = inquiries.filter(inquiry => selectedIds.has(inquiry.id)).length;
    selectAllCheckbox.checked = inquiries.length > 0 && selectedCount === inquiries.length;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < inquiries.length;
    selectAllCheckbox.disabled = inquiries.length === 0;
  }

  function makeActionButton(row, inquiry, label, action, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className || 'btn-secondary';
    button.textContent = label;
    button.disabled = busyIds.has(inquiry.id);
    button.addEventListener('click', async () => {
      if (busyIds.has(inquiry.id)) return;
      if (action === 'view') {
        openModal(inquiry, 'content');
        return;
      }
      if (action === 'compose') {
        openModal(inquiry, 'compose');
        return;
      }
      if (action === 'completed') {
        openModal(inquiry, 'completed');
        return;
      }

      busyIds.add(inquiry.id);
      button.disabled = true;
      try {
        await updateStatus(inquiry, action);
      } finally {
        busyIds.delete(inquiry.id);
        renderRows();
      }
    });
    row.appendChild(button);
  }

  function renderActions(cell, inquiry) {
    const group = document.createElement('div');
    group.className = 'support-inquiry-actions';
    if (inquiry.status === STATUS.RECEIVED) {
      makeActionButton(group, inquiry, '응답', STATUS.IN_PROGRESS, 'btn-primary');
      makeActionButton(group, inquiry, '대기', STATUS.WAITING, 'btn-secondary');
    } else if (inquiry.status === STATUS.WAITING) {
      makeActionButton(group, inquiry, '응답', STATUS.IN_PROGRESS, 'btn-primary');
    } else if (inquiry.status === STATUS.IN_PROGRESS) {
      makeActionButton(group, inquiry, '답변', 'compose', 'btn-primary');
      makeActionButton(group, inquiry, '대기', STATUS.WAITING, 'btn-secondary');
    } else {
      makeActionButton(group, inquiry, '답변보기', 'completed', 'btn-secondary');
    }
    cell.appendChild(group);
  }

  function renderRows() {
    if (!tableBody) return;
    tableBody.replaceChildren();
    setCount(`총 ${inquiries.length}건`);
    updateSelectAllState();

    if (!inquiries.length) {
      showMessage('아직 접수된 문의가 없습니다.', false);
      return;
    }

    inquiries.forEach(inquiry => {
      const row = document.createElement('tr');
      const checkboxCell = document.createElement('td');
      checkboxCell.className = 'support-checkbox-column';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'support-inquiry-checkbox';
      checkbox.checked = selectedIds.has(inquiry.id);
      checkbox.setAttribute('aria-label', `${inquiry.requester} 문의 선택`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedIds.add(inquiry.id);
        else selectedIds.delete(inquiry.id);
        updateSelectAllState();
      });
      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);

      addCell(row, inquiry.requester, 'support-inquiry-requester');
      addCell(row, formatDate(inquiry.submittedAt), 'support-inquiry-date');
      addCell(row, inquiry.title, 'support-inquiry-title');

      const contentCell = document.createElement('td');
      const viewButton = document.createElement('button');
      viewButton.type = 'button';
      viewButton.className = 'btn-secondary support-inquiry-view-btn';
      viewButton.textContent = '보기';
      viewButton.setAttribute('aria-label', `${inquiry.title} 문의 내용 보기`);
      viewButton.addEventListener('click', () => openModal(inquiry, 'content'));
      contentCell.appendChild(viewButton);
      row.appendChild(contentCell);

      addCell(row, inquiry.email, 'support-inquiry-email');
      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      const statusClass = inquiry.status === STATUS.RECEIVED ? 'received'
        : inquiry.status === STATUS.WAITING ? 'waiting'
          : inquiry.status === STATUS.IN_PROGRESS ? 'in-progress' : 'completed';
      statusBadge.className = `support-status-badge support-status-${statusClass}`;
      statusBadge.textContent = inquiry.status;
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);

      const actionCell = document.createElement('td');
      actionCell.className = 'support-inquiry-action-cell';
      renderActions(actionCell, inquiry);
      row.appendChild(actionCell);
      tableBody.appendChild(row);
    });
  }

  async function updateStatus(inquiry, status) {
    try {
      await db.collection('inquiries').doc(inquiry.id).update({
        status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast(`문의 상태를 '${status}'(으)로 변경했습니다.`);
    } catch (error) {
      console.warn('고객센터 문의 상태를 변경하지 못했습니다:', error);
      showToast('문의 상태를 변경하지 못했습니다. Firestore 권한을 확인해 주세요.', 'error');
    }
  }

  function setModalVisible(visible) {
    if (!modal) return;
    modal.classList.toggle('open', visible);
    modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }

  function openModal(inquiry, mode) {
    activeInquiry = inquiry;
    modalMode = mode;
    if (modalTitle) {
      modalTitle.textContent = mode === 'compose'
        ? '문의 답변'
        : mode === 'completed' ? '답변 보기' : '문의 내용';
    }
    if (modalRequester) modalRequester.textContent = inquiry.requester;
    if (modalDate) modalDate.textContent = formatDate(inquiry.submittedAt);
    if (modalEmail) modalEmail.textContent = inquiry.email;
    if (modalContent) modalContent.textContent = inquiry.content;

    const showAnswer = mode === 'compose' || mode === 'completed';
    if (answerGroup) answerGroup.hidden = !showAnswer;
    if (answerInput) {
      answerInput.value = inquiry.answer || '';
      answerInput.readOnly = mode === 'completed';
    }
    if (modalCancel) modalCancel.textContent = mode === 'compose' ? '취소' : '닫기';
    if (answerSubmit) {
      answerSubmit.hidden = mode !== 'compose';
      answerSubmit.disabled = false;
    }
    savingReply = false;
    setModalVisible(true);
    if (mode === 'compose' && answerInput) answerInput.focus();
    else if (modalCancel) modalCancel.focus();
  }

  function closeModal() {
    if (savingReply) return;
    setModalVisible(false);
    activeInquiry = null;
  }

  async function saveReply() {
    if (!activeInquiry || modalMode !== 'compose' || savingReply) return;
    const answer = answerInput ? answerInput.value.trim() : '';
    if (!answer) {
      showToast('답변 내용을 입력해 주세요.', 'error');
      if (answerInput) answerInput.focus();
      return;
    }

    savingReply = true;
    if (answerSubmit) answerSubmit.disabled = true;
    if (modalCancel) modalCancel.disabled = true;
    if (modalClose) modalClose.disabled = true;
    try {
      await db.collection('inquiries').doc(activeInquiry.id).update({
        reply: answer,
        status: STATUS.COMPLETED,
        repliedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('답변을 저장하고 문의를 완료 처리했습니다.');
      savingReply = false;
      setModalVisible(false);
      activeInquiry = null;
    } catch (error) {
      console.warn('고객센터 답변을 저장하지 못했습니다:', error);
      showToast('답변을 저장하지 못했습니다. Firestore 권한을 확인해 주세요.', 'error');
      savingReply = false;
      if (answerSubmit) answerSubmit.disabled = false;
      if (modalCancel) modalCancel.disabled = false;
      if (modalClose) modalClose.disabled = false;
    }
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      inquiries.forEach(inquiry => {
        if (selectAllCheckbox.checked) selectedIds.add(inquiry.id);
        else selectedIds.delete(inquiry.id);
      });
      renderRows();
    });
  }
  if (modalCancel) modalCancel.addEventListener('click', closeModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (answerSubmit) answerSubmit.addEventListener('click', saveReply);
  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
  });

  function stopListener() {
    listenerVersion++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    activeUid = null;
    inquiries = [];
    selectedIds.clear();
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
          inquiries = snapshot.docs.map(mapInquiry).sort((a, b) => b.sortTime - a.sortTime);
          const inquiryIds = new Set(inquiries.map(inquiry => inquiry.id));
          [...selectedIds].forEach(id => {
            if (!inquiryIds.has(id)) selectedIds.delete(id);
          });
          renderRows();
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
