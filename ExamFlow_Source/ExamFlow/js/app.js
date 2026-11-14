// 메뉴와 버튼 연결, 날짜 설정, 화면 옵션, 앱 시작.

const actions = {
  upload: () => $('rosterFile').click(),
  loadProject: () => $('projectFile').click(),
  saveProject: () => {
    Files.download(
      JSON.stringify(project(), null, 2),
      'ExamFlow_Project.json',
      'application/json',
    );
    state.dirty = false;
    toast('프로젝트 파일을 저장했습니다.');
  },
  chooseCourses: showCoursePicker,
  closeCourses: () => $('subjectDialog').close(),
  addCustomCourse,
  applyCourses,
  template,
  solve: startSolve,
  cancelSolve: () => {
    stopWorker();
    toast('탐색을 취소했습니다. 이전 시간표를 유지합니다.');
  },
  buildDays,
  closeEdit: () => $('editDialog').close(),
  export: exportExcel,
  print: () => window.print(),
  prevMonth: () => changeMonth(-1),
  nextMonth: () => changeMonth(1),
  undo,
  display: showDisplay,
  closeDisplay: () => $('displayDialog').close(),
};

function changeMonth(step) {
  const [y, m] = state.calendarMonth.split('-').map(Number),
    d = new Date(y, m - 1 + step, 1);
  state.calendarMonth =
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  render();
}

function buildDays() {
  const from = $('startDate').value,
    to = $('endDate').value;
  if (!from || !to || from > to)
    throw Error('시작일과 종료일을 확인해 주세요.');
  const start = new Date(from + 'T12:00:00'),
    end = new Date(to + 'T12:00:00'),
    entries = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (entries.length >= 45)
      throw Error('기간은 최대 45일 이내로 설정해 주세요.');
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    entries.push({
      date,
      periods: Number($('defaultPeriods').value),
      enabled: d.getDay() !== 0 && d.getDay() !== 6,
    });
  }
  $('dayInputs').innerHTML = dayInputs(entries);
}

function saveSettings() {
  const days = [...document.querySelectorAll('[data-day]:checked')].map(
    (e) => ({
      date: e.dataset.day,
      periods: Number(
        document.querySelector(`[data-day-period="${e.dataset.day}"]`).value,
      ),
    }),
  );
  const old = context();
  const c = {
    ...state.config,
    title: $('examTitle').value.trim() || '학교 시험',
    days,
    locks: {},
  };
  for (const k of [
    'maxDaily',
    'maxRun',
    'capacity',
    'duration',
    'breakMinutes',
  ])
    c[k] = Number($(k).value);
  c.maxPairs = -1;
  c.startTime = $('startTime').value;
  Engine.checkConfig(c);
  const next = Engine.prepare(state.data, c);
  let removed = 0;
  for (const [id, t] of Object.entries(state.config.locks)) {
    const prev = old.slots[t],
      at = next.slots.findIndex(
        (s) => s.date === prev.date && s.period === prev.period,
      );
    if (at >= 0) c.locks[id] = at;
    else removed++;
  }
  state.config = c;
  resetSchedule();
  state.page = 'board';
  state.calendarMonth = days[0].date.slice(0, 7);
  render();
  toast(
    '시험 조건을 저장했습니다.' +
      (removed ? ` 사라진 시간대의 고정 ${removed}개를 해제했습니다.` : ''),
  );
}

try {
  const p = JSON.parse(localStorage.getItem('examflow-display') || '{}');
  if (['light', 'dark', 'system'].includes(p.theme)) UI.prefs.theme = p.theme;
  if (typeof p.large === 'boolean') UI.prefs.large = p.large;
  if (['system', 'reduce'].includes(p.motion)) UI.prefs.motion = p.motion;
} catch {}

function reduceMotion() {
  return (
    UI.prefs.motion === 'reduce' ||
    (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

function applyPreferences() {
  const theme =
    UI.prefs.theme === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : UI.prefs.theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.motion = UI.prefs.motion;
  document.body.classList.toggle('reading-mode', UI.prefs.large);
  try {
    localStorage.setItem('examflow-display', JSON.stringify(UI.prefs));
  } catch {}
}

function positions() {
  const m = new Map(),
    seen = {};
  for (const el of document.querySelectorAll('.schedule [data-edit]')) {
    const c = el.dataset.edit,
      k = c + ':' + (seen[c] || 0);
    seen[c] = (seen[c] || 0) + 1;
    m.set(k, el.getBoundingClientRect());
  }
  return m;
}

function animatePositions(before) {
  if (reduceMotion() || !before.size) return;
  const seen = {};
  for (const el of document.querySelectorAll('.schedule [data-edit]')) {
    const c = el.dataset.edit,
      k = c + ':' + (seen[c] || 0);
    seen[c] = (seen[c] || 0) + 1;
    const from = before.get(k),
      to = el.getBoundingClientRect();
    if (from && (Math.abs(from.x - to.x) > 2 || Math.abs(from.y - to.y) > 2))
      el.animate?.(
        [
          {
            transform: `translate(${from.x - to.x}px,${from.y - to.y}px)`,
            opacity: 0.6,
          },
          { transform: 'translate(0,0)', opacity: 1 },
        ],
        { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
      );
  }
}

function showDisplay() {
  const p = UI.prefs;
  $('displayDialog').innerHTML = /* HTML */ `<div class="edit-heading">
      <div>
        <div class="eyebrow">DISPLAY</div>
        <h2>눈에 편한 화면으로.</h2>
      </div>
      <button
        class="icon-button subtle"
        data-action="closeDisplay"
        aria-label="화면 설정 닫기"
      >
        ${icon('close')}
      </button>
    </div>
    <div class="space"></div>
    <h3>화면 모드</h3>
    <div class="display-options">
      ${[
        ['light', '밝게'],
        ['dark', '어둡게'],
        ['system', '시스템 설정'],
      ]
        .map(
          ([v, s]) =>
            `<button data-theme-option="${v}" aria-pressed="${p.theme === v}">${s}</button>`,
        )
        .join('')}
    </div>
    <div class="space"></div>
    <label class="choice"
      ><input
        id="largeText"
        type="checkbox"
        ${p.large ? 'checked' : ''}
      />시간표와 입력 글자 크게 보기</label
    >
    <div class="space"></div>
    <label class="choice"
      ><input
        id="reduceMotion"
        type="checkbox"
        ${p.motion === 'reduce' ? 'checked' : ''}
      />동작 줄이기</label
    >
    <p class="motion-hint">
      운영체제에서 동작 줄이기를 설정한 경우에도 자동 적용됩니다.
    </p>
    <p class="side-note">
      이 기기에 화면 설정만 저장됩니다. 학생 자료는 프로젝트 파일로 직접
      저장하세요.
    </p>
    <div class="actions">
      <button class="primary" data-action="closeDisplay">완료</button>
    </div>`;
  $('displayDialog').showModal();
}

function clearDrop() {
  document
    .querySelectorAll('[data-drop-slot]')
    .forEach((el) =>
      el.classList.remove('drop-allowed', 'drop-blocked', 'drop-target'),
    );
  document.querySelector('.dragging')?.classList.remove('dragging');
  UI.dragCourse = null;
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  try {
    if (b.dataset.page) {
      state.page = b.dataset.page;
      render();
      window.scrollTo(0, 0);
    } else if (b.dataset.mode) {
      state.mode = b.dataset.mode;
      render();
    } else if (b.dataset.edit !== undefined) edit(Number(b.dataset.edit));
    else if (b.dataset.applyEdit !== undefined)
      applyEdit(Number(b.dataset.applyEdit));
    else if (b.dataset.action) await actions[b.dataset.action]?.();
  } catch (err) {
    fail(err);
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'settingsForm') {
    e.preventDefault();
    try {
      saveSettings();
    } catch (err) {
      fail(err);
    }
  }
});

$('rosterFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    loadRoster(await Files.readRosterPackage(f), f.name);
  } catch (err) {
    fail(err);
  } finally {
    e.target.value = '';
  }
});

$('projectFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 8 * 1024 * 1024)
      throw Error('프로젝트 파일은 8MB 이하로 준비해 주세요.');
    importProject(JSON.parse(await f.text()));
  } catch (err) {
    fail(err);
  } finally {
    e.target.value = '';
  }
});

$('progressDialog').addEventListener('cancel', () => {
  stopWorker();
  toast('탐색을 취소했습니다.');
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.addEventListener('dragstart', (e) => {
  const card = e.target.closest?.('.schedule [data-edit]');
  if (!card) return;
  const c = Number(card.dataset.edit);
  if (state.config.locks[c] !== undefined) {
    e.preventDefault();
    return;
  }
  UI.dragCourse = c;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(c));
  card.classList.add('dragging');
  const valid = context().slots.map(
    (_, t) => !movementCandidate(c, t, false).errors.length,
  );
  document
    .querySelectorAll('[data-drop-slot]')
    .forEach((el) =>
      el.classList.add(
        valid[Number(el.dataset.dropSlot)] &&
          state.data.subjects[c].grades.includes(el.dataset.dropGrade)
          ? 'drop-allowed'
          : 'drop-blocked',
      ),
    );
});

document.addEventListener('dragover', (e) => {
  const zone = e.target.closest?.('.upload-zone');
  if (zone && e.dataTransfer?.types.includes('Files')) {
    e.preventDefault();
    zone.classList.add('drag-over');
    return;
  }
  const cell = e.target.closest?.('[data-drop-slot]');
  if (
    cell &&
    UI.dragCourse != null &&
    cell.classList.contains('drop-allowed')
  ) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document
      .querySelectorAll('.drop-target')
      .forEach((n) => n.classList.remove('drop-target'));
    cell.classList.add('drop-target');
  }
});

document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest?.('.upload-zone');
  if (zone && !zone.contains(e.relatedTarget))
    zone.classList.remove('drag-over');
});

document.addEventListener('drop', async (e) => {
  const zone = e.target.closest?.('.upload-zone');
  if (zone && e.dataTransfer?.files.length) {
    e.preventDefault();
    zone.classList.remove('drag-over');
    try {
      loadRoster(
        await Files.readRosterPackage(e.dataTransfer.files[0]),
        e.dataTransfer.files[0].name,
      );
    } catch (err) {
      fail(err);
    }
    return;
  }
  const cell = e.target.closest?.('[data-drop-slot]');
  if (cell && UI.dragCourse != null) {
    e.preventDefault();
    const c = UI.dragCourse,
      t = Number(cell.dataset.dropSlot),
      ok = cell.classList.contains('drop-allowed');
    clearDrop();
    if (ok && state.assignment[c] !== t) commitMove(c, t, false);
    else if (!ok) toast('학생 응시 조건을 충족하지 않는 시간입니다.', true);
  }
});

document.addEventListener('dragend', clearDrop);

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.themeOption) {
    UI.prefs.theme = b.dataset.themeOption;
    applyPreferences();
    document
      .querySelectorAll('[data-theme-option]')
      .forEach((el) =>
        el.setAttribute(
          'aria-pressed',
          String(el.dataset.themeOption === UI.prefs.theme),
        ),
      );
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'editSlot' || e.target.id === 'editLock')
    updateMovePreview(e.target.id === 'editLock');
  if (e.target.id === 'largeText') {
    UI.prefs.large = e.target.checked;
    applyPreferences();
  }
  if (e.target.id === 'reduceMotion') {
    UI.prefs.motion = e.target.checked ? 'reduce' : 'system';
    applyPreferences();
  }
});

document.addEventListener('keydown', (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === 'z' &&
    !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) &&
    !document.querySelector('dialog[open]') &&
    UI.history.length
  ) {
    e.preventDefault();
    actions.undo();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'gradeFilter') return;
  state.grade = e.target.value;
  render();
});

const initialPlan =
  state.examPlan || Curriculum.inferPlan(Engine.toRows(state.data));
const initialEnrollment = normalizeEnrollment(
  Engine.toRows(state.data),
  initialPlan,
);
state.examPlan = initialEnrollment.plan;
state.data = initialEnrollment.data;
applyPreferences();
render();
window
  .matchMedia?.('(prefers-color-scheme: dark)')
  .addEventListener?.('change', applyPreferences);
