// 작업 상태, 입력과 배치가 바뀔 때 함께 갱신할 값, 공통 도우미.

const Engine = createEngine();

const $ = (id) => document.getElementById(id);

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );

const copy = (v) => JSON.parse(JSON.stringify(v));

const state = {
  ...copy(INITIAL_PROJECT),
  page: 'board',
  mode: 'table',
  grade: 'all',
  calendarMonth: INITIAL_PROJECT.config.days[0].date.slice(0, 7),
  dirty: false,
  worker: null,
  seed: Date.now() >>> 0,
};

state.data = Engine.parseRows(state.rows);
delete state.rows;

const UI = {
  history: [],
  editCourse: null,
  dragCourse: null,
  lastPage: null,
  lastMode: null,
  timer: null,
  changedCourse: null,
  prefs: { theme: 'light', large: false, motion: 'system' },
};

let cachedData = null,
  cachedKey = '',
  cachedCtx = null;

function context() {
  const key = JSON.stringify(state.config);
  if (cachedData !== state.data || key !== cachedKey) {
    cachedCtx = Engine.prepare(state.data, state.config);
    cachedData = state.data;
    cachedKey = key;
  }
  return cachedCtx;
}

function stats(a = state.assignment) {
  return a ? Engine.metrics(context(), a, true) : null;
}

function dateLabel(d, long = false) {
  const dt = new Date(d + 'T12:00:00');
  return long
    ? `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일`
    : `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function weekday(d) {
  return ['일', '월', '화', '수', '목', '금', '토'][
    new Date(d + 'T12:00:00').getDay()
  ];
}

function timeOf(p) {
  const [h, m] = state.config.startTime.split(':').map(Number),
    t = h * 60 + m + p * (state.config.duration + state.config.breakMinutes),
    f = (v) =>
      `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  return f(t) + '–' + f(t + state.config.duration);
}

function slotLabel(t) {
  const s = context().slots[t];
  return s
    ? `${dateLabel(s.date)}(${weekday(s.date)}) ${s.period + 1}교시`
    : '배치 없음';
}

function dirty() {
  state.dirty = true;
}

let toastTimer;

function toast(message, error = false) {
  clearTimeout(toastTimer);
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (error ? ' error' : '');
  el.setAttribute('role', error ? 'alert' : 'status');
  el.textContent = message;
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), error ? 9000 : 4500);
}

function fail(e) {
  console.error(e);
  toast(e.message || String(e), true);
}

function resetSchedule() {
  UI.history = [];
  state.assignment = null;
  state.baseline = null;
  state.lastRun = '';
  dirty();
}

function snapshot() {
  return {
    config: copy(state.config),
    assignment: state.assignment?.slice() || null,
    baseline: state.baseline?.slice() || null,
    lastRun: state.lastRun,
  };
}

function remember(s) {
  UI.history.push(s);
  if (UI.history.length > 15) UI.history.shift();
}

function movementCandidate(c, t, lock = state.config.locks[c] !== undefined) {
  const a = state.assignment.slice(),
    cfg = copy(state.config),
    base = context();
  a[c] = t;
  delete cfg.locks[c];
  if (lock) cfg.locks[c] = t;
  const ctx = { ...base, config: cfg, locks: base.locks.slice() };
  ctx.locks[c] = lock ? t : -1;
  const errors = Engine.validate(ctx, a);
  return {
    a,
    cfg,
    errors,
    metrics: errors.length ? null : Engine.metrics(ctx, a),
  };
}
