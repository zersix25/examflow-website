// 시험 과목 선택, 맞춤 엑셀, 작업 파일 저장 형식과 불러오기.

const CourseUI = { draft: [], grade: '2', group: 'all', query: '' };

function planKey(plan) {
  return JSON.stringify(
    plan
      .map((p) => [Curriculum.normalize(Curriculum.header(p)), p.mode])
      .sort((a, b) => a[0].localeCompare(b[0])),
  );
}

function currentPlan() {
  return state.examPlan || [];
}

function normalizeEnrollment(input, selected = []) {
  const rows = Array.isArray(input) ? input : input.rows;
  if (!Array.isArray(rows)) throw Error('학생별 응시 자료를 읽지 못했습니다.');
  const packaged =
    !Array.isArray(input) && input.planRows
      ? Curriculum.readPlanSheet(input.planRows)
      : null;
  if (packaged && selected.length && planKey(packaged) !== planKey(selected))
    throw Error(
      '파일의 시험과목과 화면에서 선택한 과목 또는 응시 방식이 다릅니다. 선택한 과목의 양식을 사용해 주세요.',
    );
  const plan = Curriculum.validatePlan(
    selected.length ? selected : packaged || Curriculum.inferPlan(rows),
  );
  const normalized = Curriculum.normalizeRoster(rows, plan),
    data = Curriculum.attach(Engine.parseRows(normalized), plan);
  return { plan, data };
}

function loadRoster(input, label) {
  const { plan, data } = normalizeEnrollment(
    input,
    state.isDemo ? [] : currentPlan(),
  );
  state.examPlan = plan;
  state.data = data;
  state.sourceLabel = label;
  state.isDemo = false;
  state.config.locks = {};
  state.grade = 'all';
  resetSchedule();
  render();
  toast(`${data.students.length}명 · 공통·선택 응시 자료를 확인했습니다.`);
}

function project() {
  return {
    format: 'examflow-project',
    version: 2,
    objective: 'daily-load-then-adjacency-v1',
    examPlan: copy(currentPlan()),
    rows: state.data.students.length
      ? Engine.toRows(state.data)
      : [['학생ID', '학년', ...currentPlan().map(Curriculum.header)]],
    config: state.config,
    assignment: state.assignment,
    baseline: state.baseline,
    isDemo: state.isDemo,
    sourceLabel: state.sourceLabel,
    lastRun: state.lastRun,
  };
}

function importProject(p) {
  if (
    p.format !== 'examflow-project' ||
    ![1, 2].includes(p.version) ||
    !Array.isArray(p.rows)
  )
    throw Error('ExamFlow 프로젝트 형식이 아닙니다.');
  const empty = p.version === 2 && p.rows.length === 1;
  const parsed = empty
    ? {
        plan: Curriculum.validatePlan(p.examPlan),
        data: { subjects: [], students: [] },
      }
    : normalizeEnrollment(p.rows, p.examPlan || []);
  const config = copy(p.config);
  Engine.checkConfig(config);
  const ctx = Engine.prepare(parsed.data, config);
  for (const a of [p.assignment, p.baseline])
    if (a != null) {
      if (empty)
        throw Error(
          '학생 자료가 없는 프로젝트에는 시간표를 저장할 수 없습니다.',
        );
      const errors = Engine.validate(ctx, a);
      if (errors.length)
        throw Error('저장된 시간표 검증 실패: ' + errors.join(' '));
    }
  Object.assign(state, {
    data: parsed.data,
    examPlan: parsed.plan,
    config,
    assignment: p.assignment || null,
    baseline: p.baseline || null,
    isDemo: !!p.isDemo,
    sourceLabel: String(p.sourceLabel || '프로젝트 자료').slice(0, 150),
    lastRun: '프로젝트 불러오기 후 검증 완료',
    grade: 'all',
    page: 'board',
    calendarMonth: config.days[0].date.slice(0, 7),
    dirty: false,
  });
  UI.history = [];
  render();
  toast('작업을 불러왔습니다. 다시 생성하면 하루 시험 분산 기준을 적용합니다.');
}

function dataPage() {
  const plan = currentPlan(),
    ready = state.data.students.length > 0;
  return (
    headline(
      '우리 학교 시험 과목부터.',
      '과목을 고르고, 맞춤 엑셀에 학생별 응시 여부를 입력하세요.',
    ) +
    /* HTML */ ` <section class="panel course-plan-panel">
        <div class="panel-head">
          <div>
            <span class="step-kicker">01 · 시험 과목</span>
            <h2>
              ${plan.length ? `${plan.length}개 과목을 선택했습니다.` : '이번에 시험 보는 과목을 고르세요.'}
            </h2>
            <small
              >학년 공통 ${plan.filter((p) => p.mode === 'common').length}개 ·
              학생 선택
              ${plan.filter((p) => p.mode === 'elective').length}개</small
            >
          </div>
          <button class="primary with-icon" data-action="chooseCourses">
            ${icon('plus')} 시험 과목 선택
          </button>
        </div>
        ${
          plan.length
            ? /* HTML */ `<div class="table-wrap selected-course-table">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>시험 과목</th>
                      <th>학년</th>
                      <th>응시 방식</th>
                      <th>응시 학생</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${plan
                      .map((p) => {
                        const c = state.data.subjects.find(
                          (c) =>
                            Curriculum.normalize(c.name) ===
                            Curriculum.normalize(Curriculum.header(p)),
                        );
                        return /* HTML */ `<tr>
                          <td>
                            <strong>${esc(p.name)}</strong
                            ><small class="course-category"
                              >${esc(p.category)} · ${esc(p.group)}</small
                            >
                          </td>
                          <td>${p.grade}학년</td>
                          <td>
                            <span class="course-type ${p.mode}"
                              >${p.mode === 'common' ? '학년 공통' : '학생 선택'}</span
                            >
                          </td>
                          <td>${c ? c.count + '명' : '입력 전'}</td>
                        </tr>`;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>`
            : '<div class="panel-body muted">공통 시험과 학생별 선택 시험을 함께 선택하세요.</div>'
        }
        <div class="panel-body course-source">${sourcesHTML()}</div>
      </section>
      <div class="enrollment-steps">
        <section class="panel">
          <div class="panel-body">
            <span class="step-kicker">02 · 엑셀 작성</span>
            <h2>선택 과목으로 양식 받기</h2>
            <p class="side-note">
              학년 공통 시험은 해당 학년 학생에게 1을 미리 채웁니다. 선택 시험은
              실제 응시자만 1로 바꾸세요.
            </p>
            <div class="template-controls">
              <div class="field">
                <label for="templateCount">학년별 작성할 학생 수</label
                ><input
                  id="templateCount"
                  type="number"
                  min="1"
                  max="2000"
                  value="30"
                />
              </div>
              <button data-action="template" ${plan.length ? '' : 'disabled'}>
                ${icon('download')} 맞춤 엑셀 양식
              </button>
            </div>
            <small class="muted"
              >ID는 임시값입니다. 실제 익명 ID와 인원으로 수정하세요.</small
            >
          </div>
        </section>
        <section class="panel">
          <div class="panel-body">
            <span class="step-kicker">03 · 학생 자료</span>
            <div class="upload-zone compact-upload">
              <strong>작성한 엑셀 불러오기</strong>
              <p>.xlsx · CSV · TSV<br />파일을 끌어 놓거나 선택하세요.</p>
              <button class="primary" data-action="upload">파일 선택</button>
            </div>
            <p class="side-note">
              ${ready ? `✓ ${state.data.students.length}명 확인 · ${state.isDemo ? '가상 예시 자료' : esc(state.sourceLabel)}` : '학생ID·학년 다음에 과목별 0/1을 입력합니다. 최대 2,000명·60과목·8MB.'}
            </p>
            <details class="compact-details">
              <summary>기존 엑셀을 사용하는 경우</summary>
              <p>
                과목별 총인원이 아닌 학생별 0/1 자료가 필요합니다. ‘2학년
                대수’처럼 학년과 과목명으로 열을 구분하세요. 한 학년에만 있는
                과목은 과목명만 적어도 연결합니다. .xls는 .xlsx로 저장하고
                수식은 값으로 붙여 넣으세요.
              </p>
              <p>
                처음의 가상 예시 상태에서는 파일의 과목 목록을 불러옵니다. 직접
                과목을 선택한 뒤에는 선택 목록과 파일의 과목·응시 방식이
                일치해야 합니다. 기본 화면에서 선택한 과목을 바꾸면 학생 자료를
                새로 입력합니다.
              </p>
            </details>
          </div>
        </section>
      </div>
      <div class="data-next">
        <span class="muted"
          >${ready ? '학생 자료가 준비되었습니다. 시험 날짜와 교시를 정하세요.' : '학생 자료를 불러오면 시간표를 생성할 수 있습니다.'}</span
        ><button class="with-icon" data-page="settings">
          시험 조건 설정 ${icon('arrow')}
        </button>
      </div>`
  );
}

function sourcesHTML() {
  return /* HTML */ `<details class="compact-details source-note">
    <summary>2022 교육과정 · 2028 대입 안내</summary>
    <p>
      2028 수능은 국어·수학·탐구 선택과목이 폐지되는 통합형 체제입니다. 여기서는
      내신 시간표를 위해 2022 개정 교육과정의 보통 교과(표 5)
      ${Curriculum.catalog.length}과목을 제공합니다. 학교마다 개설 과목과
      지필시험 여부가 다릅니다.
    </p>
    <p>
      공통·일반 선택·진로 선택·융합 선택은 교육과정 분류입니다. ‘학년 공통’은
      이번 시험에 해당 학년의 등록 학생이 모두 응시한다는 뜻입니다. 일반 선택
      과목도 학교가 모두 응시하도록 운영하면 학년 공통으로 지정할 수 있습니다.
    </p>
    <p>
      특수목적고 계열·전문교과·학교 지정 과목은 ‘직접 추가’를 이용하세요.
      기본수학·기본영어는 학교의 실제 편성에 맞춰 선택하세요.
    </p>
    <p>
      공식 자료 확인: 2026.11.14 · 과목 목록은 파일에 포함되어 오프라인으로
      사용할 수 있습니다.
    </p>
    ${Curriculum.sources.map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}
  </details>`;
}

function renderCourseChoices() {
  const items = Curriculum.catalog.filter(
    (c) =>
      (CourseUI.group === 'all' || c.group === CourseUI.group) &&
      Curriculum.normalize(c.name).includes(
        Curriculum.normalize(CourseUI.query),
      ),
  );
  $('courseMatches').textContent = `${items.length}개 과목`;
  $('courseChoices').innerHTML =
    items
      .map((c) => {
        const index = Curriculum.catalog.indexOf(c),
          chosen = CourseUI.draft.some(
            (p) => p.grade === CourseUI.grade && p.name === c.name,
          );
        return /* HTML */ `<label
          class="catalog-choice ${chosen ? 'chosen' : ''}"
          ><input
            type="checkbox"
            data-catalog="${index}"
            ${chosen ? 'checked' : ''}
          /><span
            ><strong>${esc(c.name)}</strong
            ><small>${esc(c.category)} · ${esc(c.group)}</small></span
          ></label
        >`;
      })
      .join('') ||
    '<p class="muted">검색 결과가 없습니다. 아래에서 학교 과목을 직접 추가할 수 있습니다.</p>';
}

function renderPickedCourses() {
  $('pickedCount').textContent = `선택한 시험 ${CourseUI.draft.length}개`;
  $('pickedCourses').innerHTML =
    CourseUI.draft
      .map(
        (p, i) =>
          /* HTML */ `<div class="picked-course">
            <div>
              <strong>${esc(p.name)}</strong
              ><small>${p.grade}학년 · ${esc(p.category)}</small>
            </div>
            <select
              data-course-mode="${i}"
              aria-label="${p.grade}학년 ${esc(p.name)} 응시 방식"
            >
              <option value="common" ${p.mode === 'common' ? 'selected' : ''}>
                학년 공통
              </option>
              <option
                value="elective"
                ${p.mode === 'elective' ? 'selected' : ''}
              >
                학생 선택
              </option></select
            ><button
              class="icon-button subtle"
              data-remove-course="${i}"
              aria-label="${p.grade}학년 ${esc(p.name)} 제거"
            >
              ×
            </button>
          </div>`,
      )
      .join('') || '<p class="muted">왼쪽 목록에서 시험 과목을 선택하세요.</p>';
  $('applyCourses').disabled = !CourseUI.draft.length;
}

function showCoursePicker() {
  CourseUI.draft = copy(currentPlan());
  CourseUI.group = 'all';
  CourseUI.query = '';
  $('subjectDialog').innerHTML = /* HTML */ `<div class="edit-heading">
      <div>
        <h2>이번 시험 과목 선택</h2>
        <p class="muted">공통 시험과 선택 시험을 한 번에 준비하세요.</p>
      </div>
      <button
        class="icon-button subtle"
        data-action="closeCourses"
        aria-label="과목 선택 닫기"
      >
        ${icon('close')}
      </button>
    </div>
    <div class="catalog-filters">
      <div class="field">
        <label for="courseGrade">대상 학년</label
        ><select id="courseGrade">
          ${['1', '2', '3'].map((g) => `<option value="${g}" ${CourseUI.grade === g ? 'selected' : ''}>${g}학년</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="courseGroup">교과</label
        ><select id="courseGroup">
          <option value="all">전체 교과</option>
          ${Curriculum.groups.map((g) => `<option>${esc(g)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="courseSearch">과목 검색</label
        ><input
          type="search"
          id="courseSearch"
          placeholder="예: 미적분, 윤리, 생명"
        />
      </div>
    </div>
    <p class="picker-note">
      교육과정 분류와 별도로, 해당 학년이 모두 시험을 보면 ‘학년 공통’을
      선택하세요. 학교에서 실제 개설하고 이번에 시험 보는 과목만 선택합니다.
    </p>
    <div class="catalog-columns">
      <section>
        <h3 id="courseMatches"></h3>
        <div id="courseChoices" class="catalog-list"></div>
      </section>
      <section>
        <h3 id="pickedCount"></h3>
        <div id="pickedCourses" class="picked-list"></div>
      </section>
    </div>
    <details class="compact-details">
      <summary>목록에 없는 학교 과목 직접 추가</summary>
      <div class="custom-course">
        <label class="sr-only" for="customCourse">추가할 과목명</label
        ><input
          id="customCourse"
          maxlength="70"
          placeholder="학교 지정 과목명"
        /><button data-action="addCustomCourse">현재 학년에 추가</button>
      </div>
      <p>특수목적고 계열·전문교과·학교 지정 과목은 직접 추가하세요.</p>
    </details>
    <p id="courseError" class="text-warning" role="alert"></p>
    <div class="course-dialog-footer">
      <p class="side-note">
        과목이나 응시 방식을 바꾸어 적용하면 현재 학생 자료와 시간표가
        초기화됩니다. 새 양식으로 다시 입력하세요.
      </p>
      <div class="row">
        <button data-action="closeCourses">취소</button
        ><button class="primary" id="applyCourses" data-action="applyCourses">
          과목 적용
        </button>
      </div>
    </div>`;
  renderCourseChoices();
  renderPickedCourses();
  $('subjectDialog').showModal();
}

function addCustomCourse() {
  try {
    const p = Curriculum.make($('customCourse').value, CourseUI.grade);
    if (
      CourseUI.draft.some(
        (x) =>
          Curriculum.normalize(Curriculum.header(x)) ===
          Curriculum.normalize(Curriculum.header(p)),
      )
    )
      throw Error('이미 선택한 과목입니다.');
    if (CourseUI.draft.length >= 60)
      throw Error('한 시간표에 최대 60과목을 선택할 수 있습니다.');
    CourseUI.draft.push(p);
    $('customCourse').value = '';
    $('courseError').textContent = '';
    renderPickedCourses();
    renderCourseChoices();
  } catch (e) {
    $('courseError').textContent = e.message;
  }
}

function applyCourses() {
  try {
    const plan = Curriculum.validatePlan(CourseUI.draft);
    if (planKey(plan) === planKey(currentPlan())) {
      $('subjectDialog').close();
      return;
    }
    state.examPlan = plan;
    state.data = { subjects: [], students: [] };
    state.config.locks = {};
    state.isDemo = false;
    state.sourceLabel = '학생 자료 미등록';
    state.grade = 'all';
    resetSchedule();
    state.page = 'data';
    $('subjectDialog').close();
    render();
    toast('과목을 적용했습니다. 맞춤 엑셀을 작성해 불러오세요.');
  } catch (e) {
    $('courseError').textContent = e.message;
  }
}

async function template() {
  const sheets = Curriculum.template(
    currentPlan(),
    Number($('templateCount').value),
  );
  Files.download(
    await Files.xlsx(sheets),
    'ExamFlow_학생별수강_맞춤양식.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  toast('공통 응시와 과목 분류를 포함한 양식을 저장했습니다.');
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'courseSearch') {
    CourseUI.query = e.target.value;
    renderCourseChoices();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'courseGrade') {
    CourseUI.grade = e.target.value;
    renderCourseChoices();
  }
  if (e.target.id === 'courseGroup') {
    CourseUI.group = e.target.value;
    renderCourseChoices();
  }
  if (e.target.dataset.catalog !== undefined) {
    const c = Curriculum.catalog[Number(e.target.dataset.catalog)];
    if (e.target.checked) {
      if (CourseUI.draft.length >= 60) {
        e.target.checked = false;
        $('courseError').textContent =
          '한 시간표에 최대 60과목을 선택할 수 있습니다.';
        return;
      }
      CourseUI.draft.push(Curriculum.make(c.name, CourseUI.grade));
    } else
      CourseUI.draft = CourseUI.draft.filter(
        (p) => !(p.name === c.name && p.grade === CourseUI.grade),
      );
    $('courseError').textContent = '';
    renderCourseChoices();
    renderPickedCourses();
  }
  if (e.target.dataset.courseMode !== undefined)
    CourseUI.draft[Number(e.target.dataset.courseMode)].mode = e.target.value;
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b?.dataset.removeCourse !== undefined) {
    CourseUI.draft.splice(Number(b.dataset.removeCourse), 1);
    renderCourseChoices();
    renderPickedCourses();
  }
});
