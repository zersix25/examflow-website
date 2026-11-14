// 시간표 탐색을 별도 워커에서 실행하고, 검증을 통과한 결과를 적용합니다.

function runSearchInWorker(event) {
  try {
    const { data, config, initial, ms, seed } = event.data;
    const result = createEngine().solve(
      data,
      config,
      initial,
      ms,
      seed,
      (progress) => {
        self.postMessage({ type: 'progress', ...progress });
      },
    );
    self.postMessage({ type: 'result', result });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
}

function startSolve() {
  if (state.worker) return;
  if (!state.data.students.length) {
    state.page = 'data';
    render();
    toast('공통·선택 과목의 학생별 자료를 먼저 불러오세요.', true);
    return;
  }
  const searchSeconds = 15;
  const ms = searchSeconds * 1000;
  const previousSchedule = snapshot();
  const startedAt = Date.now();
  Engine.checkConfig(state.config);
  $('progressBar').style.width = '0%';
  $('elapsedLabel').textContent = `경과 0초 / 최대 ${searchSeconds}초 탐색`;
  $('progressData').textContent =
    '공통·선택 시험의 하루 몰림과 같은 날 연속 교시를 줄이고 있습니다.';
  $('progressDialog').showModal();
  // Keep the worker self-contained so it can also run from a local HTML file.
  const source = `${createEngine.toString()}\nself.onmessage = ${runSearchInWorker.toString()};`;
  const url = URL.createObjectURL(
    new Blob([source], { type: 'text/javascript' }),
  );
  let worker;
  try {
    worker = new Worker(url);
  } catch {
    URL.revokeObjectURL(url);
    $('progressDialog').close();
    throw Error(
      '이 브라우저에서 로컬 계산을 시작하지 못했습니다. 파일을 Chrome 또는 Edge로 다시 열어 주세요.',
    );
  }
  URL.revokeObjectURL(url);
  state.worker = worker;
  UI.timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    $('elapsedLabel').textContent =
      `경과 ${Math.floor(elapsed / 1000)}초 / 최대 ${searchSeconds}초 탐색`;
    $('progressBar').style.width = Math.min(99, (elapsed / ms) * 100) + '%';
  }, 250);
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') {
      $('progressBar').style.width = Math.min(99, (d.elapsed / ms) * 100) + '%';
      $('progressData').textContent =
        `현재 최선: 하루 최대 ${d.metrics.maxDaily}과목 · 같은 날 연속 ${d.metrics.affected}명 / ${Math.floor(d.elapsed / 1000)}초 탐색`;
      return;
    }
    stopWorker();
    if (d.type === 'error') {
      toast(d.message, true);
      return;
    }
    const r = d.result;
    if (r.status !== 'feasible') {
      toast(r.message, true);
      return;
    }
    const err = Engine.validate(context(), r.assignment);
    if (err.length) {
      toast(err.join(' '), true);
      return;
    }
    remember(previousSchedule);
    state.assignment = r.assignment;
    if (!state.baseline) state.baseline = r.baseline;
    state.lastRun = `${(r.elapsed / 1000).toFixed(1)}초 탐색 · ${r.iterations.toLocaleString()}회 배치 검토`;
    dirty();
    render();
    toast('조건 검증을 마친 시간표를 반영했습니다.');
  };
  worker.onerror = () => {
    stopWorker();
    toast(
      '계산 중 오류가 발생했습니다. 자료와 조건을 확인하거나 Chrome/Edge에서 다시 열어 주세요.',
      true,
    );
  };
  worker.postMessage({
    data: state.data,
    config: state.config,
    initial: state.assignment,
    ms,
    seed: ++state.seed,
  });
}

function stopWorker() {
  clearInterval(UI.timer);
  UI.timer = null;
  state.worker?.terminate();
  state.worker = null;
  if ($('progressDialog').open) $('progressDialog').close();
}

function commitMove(c, t, locked) {
  const next = movementCandidate(c, t, locked);
  if (next.errors.length) {
    if ($('editDialog').open)
      $('editError').textContent = next.errors.join(' ');
    else toast(next.errors[0], true);
    return false;
  }
  remember(snapshot());
  state.config = next.cfg;
  state.assignment = next.a;
  let newBase = false;
  if (state.baseline && Engine.validate(context(), state.baseline).length) {
    state.baseline = next.a.slice();
    newBase = true;
  }
  state.lastRun = '배치 변경 후 조건 검증 완료';
  UI.changedCourse = c;
  dirty();
  if ($('editDialog').open) $('editDialog').close();
  render();
  toast('배치를 변경했습니다.');
  return true;
}

function applyEdit(c) {
  commitMove(c, Number($('editSlot').value), $('editLock').checked);
}

function undo() {
  if (!UI.history.length) return;
  Object.assign(state, UI.history.pop());
  dirty();
  render();
  toast('이전 배치로 되돌렸습니다.');
}
