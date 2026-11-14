// 시험 시간표·달력, 시험 설정, 배치 수정 화면 및 시간표 엑셀 내보내기.

const icons = {
  plus: 'M12 5v14M5 12h14',
  users:
    'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M16 3a4 4 0 010 8m6 10v-2a4 4 0 00-3-3.87M13 7a4 4 0 11-8 0 4 4 0 018 0',
  spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  undo: 'M9 5 4 10l5 5M4 10h9a7 7 0 017 7',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4M5.6 18.4 1.4-1.4m10-10 1.4-1.4M16 12a4 4 0 11-8 0 4 4 0 018 0',
  sliders: 'M4 7h16M4 17h16M9 4v6m6 4v6',
  chart: 'M4 20h16M7 16V9m5 7V4m5 12v-5',
  link: 'M9 15l6-6M7 14l-2 2a3 3 0 004 4l3-3m0-10 3-3a3 3 0 014 4l-2 2',
  lock: 'M7 10V7a5 5 0 0110 0v3M5 10h14v11H5z',
  check: 'M5 12l4 4L19 6',
  calendar: 'M5 4h14a2 2 0 012 2v14H3V6a2 2 0 012-2zM3 10h18M8 2v5m8-5v5',
  close: 'M6 6l12 12M6 18 18 6',
  up: 'M12 17V3m-5 5 5-5 5 5M4 15v6h16v-6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m13 0a3 3 0 11-6 0 3 3 0 016 0',
};

function icon(name) {
  return `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${icons[name] || icons.spark}"/></svg></span>`;
}

function headline(title, description, eyebrow = 'EXAMFLOW') {
  return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${title}</h1><p>${description}</p></div></div>`;
}

function demoBanner() {
  return state.isDemo
    ? /* HTML */ `<div class="demo-banner">
        <span
          ><strong>가상 자료로 보는 예시</strong>
          ${state.data.students.length}명의 선택 과목을 바탕으로 계산한
          시간표입니다.</span
        ><button class="small with-icon" data-page="data">
          내 자료로 시작 ${icon('arrow')}
        </button>
      </div>`
    : '';
}

function exam(c, extra = '') {
  const sub = state.data.subjects[c],
    fixed = state.config.locks[c] !== undefined;
  return /* HTML */ `<button
    class="exam ${extra} ${UI.changedCourse === c ? 'just-changed' : ''}"
    data-edit="${c}"
    draggable="${fixed ? 'false' : 'true'}"
    aria-label="${esc(sub.displayName || sub.name)}, 수강 ${sub.count}명${fixed ? ', 고정된 시험' : ''}, 배치 상세 열기"
  >
    ${fixed ? '<span class="lock">고정</span>' : ''}<strong
      >${esc(sub.displayName || sub.name)}</strong
    ><small
      >${sub.mode === 'common' ? '<span class="exam-mode">학년 공통</span>' : ''}수강
      ${sub.count}명</small
    >
  </button>`;
}

function tableHTML() {
  if (!state.assignment) return empty();
  const ctx = context(),
    grades = [...new Set(state.data.students.map((s) => s.grade))]
      .sort()
      .filter((g) => state.grade === 'all' || g === state.grade),
    max = Math.max(...state.config.days.map((d) => d.periods));
  let html = /* HTML */ `<table class="schedule">
    <caption class="sr-only">
      날짜와 학년별 시험 시간표. 과목 버튼을 누르면 배치를 수정할 수 있습니다.
    </caption>
    <thead>
      <tr>
        <th scope="col">날짜</th>
        <th scope="col">학년</th>
        ${Array.from({ length: max }, (_, p) => `<th scope="col">${p + 1}교시<small>${timeOf(p)}</small></th>`).join('')}
      </tr>
    </thead>
    <tbody></tbody>
  </table>`;
  state.config.days.forEach((d, di) =>
    grades.forEach((g, gi) => {
      html += '<tr>';
      if (!gi)
        html += `<td class="date" rowspan="${grades.length}">${dateLabel(d.date)}<small>${weekday(d.date)}요일</small></td>`;
      html += `<td><small>${g}</small></td>`;
      for (let p = 0; p < max; p++) {
        const t = ctx.slots.findIndex((s) => s.day === di && s.period === p),
          ids = state.data.subjects.filter(
            (c) => c.grades.includes(g) && state.assignment[c.id] === t,
          );
        html += /* HTML */ `<td
          ${t >= 0 ? `data-drop-slot="${t}" data-drop-grade="${g}"` : ''}
        >
          ${p >= d.periods ? '<small>미운영</small>' : ids.length ? ids.map((c) => exam(c.id)).join('') : '<span class="empty-cell" aria-label="배치 없음">—</span>'}
        </td>`;
      }
      html += '</tr>';
    }),
  );
  return html + '</tbody></table>';
}

function render() {
  if (!['board', 'data', 'settings'].includes(state.page)) state.page = 'board';
  const before =
      state.page === 'board' &&
      UI.lastPage === 'board' &&
      state.mode === 'table' &&
      UI.lastMode === 'table'
        ? positions()
        : new Map(),
    pageChanged = UI.lastPage !== state.page,
    modeChanged = UI.lastMode !== state.mode,
    focus = document.activeElement?.id,
    selection = document.activeElement?.selectionStart;
  document.querySelectorAll('.nav [data-page]').forEach((b) => {
    const selected = b.dataset.page === state.page;
    b.classList.toggle('active', selected);
    if (selected) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('crumb').textContent = {
    board: '시험 시간표',
    data: '과목·학생 자료',
    settings: '시험 설정',
  }[state.page];
  $('view').innerHTML = { board, data: dataPage, settings }[state.page]();
  $('view').classList.remove('view-enter');
  if ((pageChanged || modeChanged) && !reduceMotion()) {
    void $('view').offsetWidth;
    $('view').classList.add('view-enter');
  }
  if (focus && !pageChanged && $(focus)) {
    const target = $(focus);
    target.focus({ preventScroll: true });
    if (
      typeof selection === 'number' &&
      target.setSelectionRange &&
      ['text', 'search', 'textarea'].includes(target.type)
    )
      target.setSelectionRange(selection, selection);
  }
  UI.lastPage = state.page;
  UI.lastMode = state.mode;
  animatePositions(before);
  UI.changedCourse = null;
}

function empty() {
  return '<div class="empty-state"><h2>새로운 시간표를 만들어 보세요.</h2><p>수강 자료와 시험 조건을 확인한 뒤<br>시간표 생성 버튼을 눌러 주세요.</p></div>';
}

function calendarHTML() {
  if (!state.assignment) return empty();
  const [year, month] = state.calendarMonth.split('-').map(Number),
    first = new Date(year, month - 1, 1),
    start = new Date(year, month - 1, 1 - first.getDay()),
    last = new Date(year, month, 0),
    cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7,
    ctx = context();
  let h =
    '<div class="calendar">' +
    ['일', '월', '화', '수', '목', '금', '토']
      .map((w) => `<div class="weekday">${w}</div>`)
      .join('');
  for (let i = 0; i < cells; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      di = state.config.days.findIndex((x) => x.date === key),
      items = state.data.subjects
        .filter(
          (c) =>
            (state.grade === 'all' || c.grades.includes(state.grade)) &&
            ctx.slots[state.assignment[c.id]].date === key,
        )
        .sort((a, b) => state.assignment[a.id] - state.assignment[b.id]);
    h += /* HTML */ `<div
      class="day ${di >= 0 ? 'exam-day' : ''} ${d.getMonth() !== month - 1 ? 'out' : ''}"
    >
      <span class="num">${d.getDate()}</span
      >${items.map((c) => `<small>${ctx.slots[state.assignment[c.id]].period + 1}교시</small>${exam(c.id)}`).join('')}
    </div>`;
  }
  return h + '</div>';
}

function dayInputs(
  entries = state.config.days.map((d) => ({ ...d, enabled: true })),
) {
  return entries
    .map(
      (d) =>
        /* HTML */ `<div class="day-item">
          <input
            type="checkbox"
            data-day="${d.date}"
            ${d.enabled ? 'checked' : ''}
            aria-label="${d.date} 시험일 선택"
          /><span>${dateLabel(d.date)} ${weekday(d.date)}</span
          ><select data-day-period="${d.date}" aria-label="${d.date} 운영 교시">
            ${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}" ${d.periods === i + 1 ? 'selected' : ''}>${i + 1}교시</option>`).join('')}
          </select>
        </div>`,
    )
    .join('');
}

function board() {
  const m = stats(),
    grades = [...new Set(state.data.students.map((s) => s.grade))].sort();
  return (
    headline(
      '하루는 가볍게, 시험 사이는 여유롭게.',
      '공통 시험과 선택 시험을 날짜별로 분산하고, 같은 날 연속 교시를 줄입니다.',
    ) +
    demoBanner() +
    /* HTML */ ` <div class="schedule-summary">
        <div class="summary-counts">
          <span>학생 <strong>${state.data.students.length}명</strong></span
          ><span>과목 <strong>${state.data.subjects.length}개</strong></span
          ><span>시험 <strong>${state.config.days.length}일</strong></span>
        </div>
        <span class="result-note"
          >${m ? `하루 최대 ${m.maxDaily}과목 · 같은 날 연속 시험 ${m.affected}명` : '학생 자료를 준비하고 시간표를 생성하세요.'}</span
        >
      </div>
      <div class="toolbar">
        <div class="row">
          <span class="toolbar-title">${esc(state.config.title)}</span
          ><span class="tag"
            >${dateLabel(state.config.days[0].date)} –
            ${dateLabel(state.config.days.at(-1).date)}</span
          >
        </div>
        <div class="row">
          <button
            class="small undo-button"
            data-action="undo"
            ${UI.history.length ? '' : 'disabled'}
          >
            ${icon('undo')} 실행 취소</button
          ><button
            class="primary with-icon"
            data-action="solve"
            ${state.data.students.length ? '' : 'disabled'}
          >
            ${icon('spark')}${state.assignment ? '다시 생성' : '시간표 생성'}
          </button>
        </div>
      </div>
      <section class="panel schedule-panel">
        <div class="panel-head">
          <div>
            <h2>
              ${state.mode === 'calendar' ? esc(state.calendarMonth.replace('-', '년 ')) + '월' : '전체 시험 시간표'}
            </h2>
            <small>과목을 눌러 수정 · 끌어서 이동</small>
          </div>
          <div class="row">
            ${state.mode === 'calendar' ? '<button class="small" data-action="prevMonth" aria-label="이전 달">‹</button><button class="small" data-action="nextMonth" aria-label="다음 달">›</button>' : ''}<select
              id="gradeFilter"
              aria-label="학년 선택"
            >
              <option value="all">전체 학년</option>
              ${grades.map((g) => `<option value="${g}" ${state.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}
            </select>
            <div class="seg" role="group" aria-label="시간표 보기 방식">
              <button
                data-mode="table"
                aria-pressed="${state.mode === 'table'}"
                class="${state.mode === 'table' ? 'active' : ''}"
              >
                시간표</button
              ><button
                data-mode="calendar"
                aria-pressed="${state.mode === 'calendar'}"
                class="${state.mode === 'calendar' ? 'active' : ''}"
              >
                달력
              </button>
            </div>
          </div>
        </div>
        <div class="print-only"><h1>${esc(state.config.title)}</h1></div>
        <div
          class="table-wrap"
          tabindex="0"
          aria-label="시험 시간표, 가로로 스크롤 가능"
        >
          ${state.mode === 'table' ? tableHTML() : calendarHTML()}
        </div>
        <div class="board-footer">
          <span class="${m ? 'good' : ''}"
            >${m ? '✓ 동시 응시 충돌 없음' : '학생 자료와 시험 조건을 확인하고 시간표를 생성하세요.'}</span
          >
          <div class="row">
            <button
              class="small subtle"
              data-action="print"
              ${m ? '' : 'disabled'}
            >
              인쇄 / PDF</button
            ><button
              class="small with-icon"
              data-action="export"
              ${m ? '' : 'disabled'}
            >
              ${icon('download')} 엑셀 저장
            </button>
          </div>
        </div>
      </section>
      <p class="footer-note">
        월요일과 화요일에 각각 시험을 보는 것은 불이익으로 계산하지 않습니다.
        같은 날 시험 수와 인접 교시만 줄입니다.
      </p>
      <details class="compact-details objective-note">
        <summary>시간표를 고르는 기준</summary>
        <p>
          ① 학생 한 명의 하루 최대 시험 수 → ② 하루 2과목 이상 보는 학생 수 → ③
          그 학생들이 하루 2과목 이상 보는 날짜 수의 합 → ④ 같은 날 인접 교시에
          시험 보는 학생 수·횟수 순서로 줄입니다. 앞 기준이 같을 때 다음 기준을
          비교합니다.
        </p>
        <p>
          공통·선택 시험을 모두 합산합니다. 같은 날 1·2교시는 연속, 1·3교시는
          연속이 아닙니다. 시험일이 부족하면 하루 여러 시험은 불가피할 수
          있습니다. 제한 시간 안에서 찾은 개선안이며 최적해를 보장하지 않습니다.
        </p>
        <p>
          상단 ‘작업 저장’으로 이어서 작업할 수 있습니다. 시험실·감독 배정은
          별도 확인이 필요합니다.
        </p>
      </details>`
  );
}

function settings() {
  const c = state.config;
  return (
    headline(
      '날짜와 교시를 정하세요.',
      '기본 조건부터 정하고, 필요할 때 세부 설정을 조정하세요.',
    ) +
    /* HTML */ ` <section class="panel">
      <div class="panel-body">
        <form id="settingsForm">
          <div class="form-grid">
            <div class="field">
              <label for="examTitle">시험 이름</label
              ><input
                id="examTitle"
                value="${esc(c.title)}"
                maxlength="100"
                required
              />
            </div>
            <div class="field">
              <label for="defaultPeriods">하루 기본 교시 수</label
              ><select id="defaultPeriods">
                ${Array.from({ length: 8 }, (_, i) => `<option ${Math.max(...c.days.map((d) => d.periods)) === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="startDate">시험 시작일</label
              ><input
                id="startDate"
                type="date"
                value="${c.days[0].date}"
                required
              />
            </div>
            <div class="field">
              <label for="endDate">시험 종료일</label
              ><input
                id="endDate"
                type="date"
                value="${c.days.at(-1).date}"
                required
              />
            </div>
          </div>
          <div class="date-actions">
            <button type="button" data-action="buildDays">
              기간에서 시험일 불러오기</button
            ><span class="muted">주말은 기본 제외됩니다.</span>
          </div>
          <div id="dayInputs" class="day-list">${dayInputs()}</div>
          <div class="field daily-limit">
            <label for="maxDaily">학생 한 명의 하루 시험 수 상한</label
            ><input
              id="maxDaily"
              type="number"
              min="1"
              max="8"
              value="${c.maxDaily}"
              required
            /><small
              >공통+선택 시험 합계입니다. 이 상한 안에서 실제 하루 시험 수를 더
              줄입니다.</small
            >
          </div>
          <details class="advanced-settings">
            <summary>
              시간·배치 세부 설정 <span>필요할 때만 변경하세요</span>
            </summary>
            <div class="form-grid">
              <div class="field">
                <label for="startTime">1교시 시작 시각</label
                ><input
                  id="startTime"
                  type="time"
                  value="${c.startTime}"
                  required
                />
              </div>
              <div class="field">
                <label for="duration">시험 길이 (분)</label
                ><input
                  id="duration"
                  type="number"
                  min="10"
                  max="180"
                  value="${c.duration}"
                  required
                />
              </div>
              <div class="field">
                <label for="breakMinutes">쉬는 시간 (분)</label
                ><input
                  id="breakMinutes"
                  type="number"
                  min="0"
                  max="120"
                  value="${c.breakMinutes}"
                  required
                />
              </div>
              <div class="field">
                <label for="capacity">한 교시 최대 동시 과목 수</label
                ><input
                  id="capacity"
                  type="number"
                  min="1"
                  max="60"
                  value="${c.capacity}"
                  required
                /><small>공동 수강생이 없는 과목만 동시에 배치합니다.</small>
              </div>
              <div class="field">
                <label for="maxRun">같은 날 최대 연속 응시 수</label
                ><select id="maxRun">
                  ${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}" ${c.maxRun === i + 1 ? 'selected' : ''}>${i + 1}과목</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <span class="field-label">날짜가 다른 시험</span>
                <p class="side-note">
                  다른 날에 응시하는 것은 벌점이 없습니다. 같은 날의 시험 몰림과
                  연속 교시만 계산합니다.
                </p>
              </div>
            </div>
          </details>
          <div class="settings-submit">
            <p class="side-note">조건을 저장하면 현재 시간표가 초기화됩니다.</p>
            <button type="submit" class="primary">
              조건 저장하고 시간표로
            </button>
          </div>
        </form>
      </div>
    </section>`
  );
}

function edit(c) {
  if (!state.assignment) return;
  UI.editCourse = c;
  const sub = state.data.subjects[c];
  $('editDialog').innerHTML = /* HTML */ `<div class="edit-heading">
      <div>
        <h2>${esc(sub.name)}</h2>
        <p class="muted">${sub.grades.join(', ')}학년 · 수강 ${sub.count}명</p>
      </div>
      <button
        class="icon-button subtle"
        data-action="closeEdit"
        aria-label="상세 창 닫기"
      >
        ${icon('close')}
      </button>
    </div>
    <div class="space"></div>
    <div class="field">
      <label for="editSlot">시험 날짜와 교시</label
      ><select id="editSlot">
        ${context()
          .slots.map(
            (_, t) =>
              `<option value="${t}" ${state.assignment[c] === t ? 'selected' : ''}>${slotLabel(t)}</option>`,
          )
          .join('')}
      </select>
    </div>
    <div class="space"></div>
    <label class="choice"
      ><input
        id="editLock"
        type="checkbox"
        ${state.config.locks[c] !== undefined ? 'checked' : ''}
      />다시 생성해도 이 시간에 고정</label
    >
    <div id="movePreview" class="move-summary" aria-live="polite"></div>
    <div id="editError" class="text-warning" role="alert"></div>
    <div class="actions">
      <button data-action="closeEdit">취소</button
      ><button class="primary" data-apply-edit="${c}" id="applyMove">
        변경 적용
      </button>
    </div>`;
  updateMovePreview();
  $('editDialog').showModal();
}

function updateMovePreview() {
  if (UI.editCourse == null || !$('editSlot')) return;
  const next = movementCandidate(
      UI.editCourse,
      Number($('editSlot').value),
      $('editLock').checked,
    ),
    errors = next.errors;
  $('movePreview').classList.toggle('invalid', !!errors.length);
  $('movePreview').innerHTML = errors.length
    ? `<strong>이 시간으로 이동할 수 없습니다.</strong><br>${errors.slice(0, 2).map(esc).join('<br>')}${errors.length > 2 ? '<br>외 ' + (errors.length - 2) + '건' : ''}`
    : '✓ 변경 가능한 배치입니다.';
  $('applyMove').disabled = !!errors.length;
  $('editError').textContent = '';
}

async function exportExcel() {
  if (!state.assignment) return;
  const ctx = context(),
    max = Math.max(...state.config.days.map((d) => d.periods)),
    grades = [...new Set(state.data.students.map((s) => s.grade))].sort();
  const rows = [
    [
      '날짜',
      '요일',
      '학년',
      ...Array.from({ length: max }, (_, p) => `${p + 1}교시 ${timeOf(p)}`),
    ],
  ];
  for (const d of state.config.days)
    for (const g of grades)
      rows.push([
        d.date,
        weekday(d.date),
        Number(g),
        ...Array.from({ length: max }, (_, p) =>
          p >= d.periods
            ? '미운영'
            : state.data.subjects
                .filter(
                  (c) =>
                    c.grades.includes(g) &&
                    ctx.slots[state.assignment[c.id]].date === d.date &&
                    ctx.slots[state.assignment[c.id]].period === p,
                )
                .map((c) => `${c.name} (${c.count}명)`)
                .join('\n') || '—',
        ),
      ]);
  const subjects = [
    [
      '과목',
      '학년',
      '응시 방식',
      '교육과정 분류',
      '수강 인원',
      '날짜',
      '교시',
      '시간',
    ],
    ...state.data.subjects.map((c) => {
      const t = ctx.slots[state.assignment[c.id]];
      return [
        c.displayName || c.name,
        c.grades.join(', '),
        c.mode === 'common' ? '학년 공통' : '학생 선택',
        c.category || '학교 지정',
        c.count,
        t.date,
        t.period + 1,
        timeOf(t.period),
      ];
    }),
  ];
  const bytes = await Files.xlsx([
    {
      name: '전체시간표',
      rows,
      widths: [15, 8, 8, ...Array(max).fill(27)],
      height: 55,
    },
    { name: '과목배치', rows: subjects },
  ]);
  Files.download(
    bytes,
    'ExamFlow_시간표.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  toast('시간표를 엑셀로 저장했습니다.');
}
