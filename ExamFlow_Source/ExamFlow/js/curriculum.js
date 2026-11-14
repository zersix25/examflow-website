/* 2022 revised curriculum, ordinary subjects (표 5). Verified 2026-11-14.
 * A school's actual openings and written-exam subjects must be selected by it.
 * Curriculum category and school-wide required enrollment are separate fields.
 */
const Curriculum = (() => {
  const sources = [
    {
      title: '부산광역시교육청 고교학점제 지원센터 · 2022 개정 교육과정',
      url: 'https://home.pen.go.kr/hscredit/cm/cntnts/cntntsView.do?cntntsId=3817&mi=17411',
    },
    {
      title: '경기도교육청 · 2026 고시 외 과목 개설 길라잡이, 표 5 (28쪽)',
      url: 'https://www.goe.go.kr/resource/goe/na/bbs_2675/2026/02/b1f199d4-819f-4f84-9e8b-092e66eeddd0.pdf',
    },
    {
      title: '교육부 · 2028 대학입시제도 개편 확정안',
      url: 'https://www.moe.go.kr/boardCnts/viewRenew.do?boardID=294&boardSeq=97551&lev=0',
    },
  ];
  const groups = [
    [
      '국어',
      ['공통국어1', '공통국어2'],
      ['화법과 언어', '독서와 작문', '문학'],
      ['주제 탐구 독서', '문학과 영상', '직무 의사소통'],
      ['독서 토론과 글쓰기', '매체 의사소통', '언어생활 탐구'],
    ],
    [
      '수학',
      ['공통수학1', '공통수학2', '기본수학1', '기본수학2'],
      ['대수', '미적분Ⅰ', '확률과 통계'],
      ['기하', '미적분Ⅱ', '경제 수학', '인공지능 수학', '직무 수학'],
      ['수학과 문화', '실용 통계', '수학과제 탐구'],
    ],
    [
      '영어',
      ['공통영어1', '공통영어2', '기본영어1', '기본영어2'],
      ['영어Ⅰ', '영어Ⅱ', '영어 독해와 작문'],
      [
        '영미 문학 읽기',
        '영어 발표와 토론',
        '심화 영어',
        '심화 영어 독해와 작문',
        '직무 영어',
      ],
      ['실생활 영어 회화', '미디어 영어', '세계 문화와 영어'],
    ],
    [
      '사회',
      ['한국사1', '한국사2', '통합사회1', '통합사회2'],
      ['세계시민과 지리', '세계사', '사회와 문화', '현대사회와 윤리'],
      [
        '한국지리 탐구',
        '도시의 미래 탐구',
        '동아시아 역사 기행',
        '정치',
        '법과 사회',
        '경제',
        '윤리와 사상',
        '인문학과 윤리',
        '국제 관계의 이해',
      ],
      [
        '여행지리',
        '역사로 탐구하는 현대 세계',
        '사회문제 탐구',
        '금융과 경제생활',
        '윤리문제 탐구',
        '기후변화와 지속가능한 세계',
      ],
    ],
    [
      '과학',
      ['통합과학1', '통합과학2', '과학탐구실험1', '과학탐구실험2'],
      ['물리학', '화학', '생명과학', '지구과학'],
      [
        '역학과 에너지',
        '전자기와 양자',
        '물질과 에너지',
        '화학 반응의 세계',
        '세포와 물질대사',
        '생물의 유전',
        '지구시스템과학',
        '행성우주과학',
      ],
      ['과학의 역사와 문화', '기후변화와 환경생태', '융합과학 탐구'],
    ],
    [
      '체육',
      [],
      ['체육1', '체육2'],
      ['운동과 건강', '스포츠 문화', '스포츠 과학'],
      ['스포츠 생활1', '스포츠 생활2'],
    ],
    [
      '예술',
      [],
      ['음악', '미술', '연극'],
      ['음악 연주와 창작', '음악 감상과 비평', '미술 창작', '미술 감상과 비평'],
      ['음악과 미디어', '미술과 매체'],
    ],
    [
      '기술·가정/정보',
      [],
      ['기술·가정', '정보'],
      ['로봇과 공학세계', '생활과학 탐구', '인공지능 기초', '데이터 과학'],
      [
        '창의 공학 설계',
        '지식 재산 일반',
        '생애 설계와 자립',
        '아동발달과 부모',
        '소프트웨어와 생활',
      ],
    ],
    [
      '제2외국어/한문',
      [],
      [
        '독일어',
        '프랑스어',
        '스페인어',
        '중국어',
        '일본어',
        '러시아어',
        '아랍어',
        '베트남어',
        '한문',
      ],
      [
        '독일어 회화',
        '프랑스어 회화',
        '스페인어 회화',
        '중국어 회화',
        '일본어 회화',
        '러시아어 회화',
        '아랍어 회화',
        '베트남어 회화',
        '심화 독일어',
        '심화 프랑스어',
        '심화 스페인어',
        '심화 중국어',
        '심화 일본어',
        '심화 러시아어',
        '심화 아랍어',
        '심화 베트남어',
        '한문 고전 읽기',
      ],
      [
        '독일어권 문화',
        '프랑스어권 문화',
        '스페인어권 문화',
        '중국 문화',
        '일본 문화',
        '러시아 문화',
        '아랍 문화',
        '베트남 문화',
        '언어생활과 한자',
      ],
    ],
    [
      '교양',
      [],
      ['진로와 직업', '생태와 환경'],
      [
        '인간과 철학',
        '논리와 사고',
        '인간과 심리',
        '교육의 이해',
        '삶과 종교',
        '보건',
      ],
      ['인간과 경제활동', '논술'],
    ],
  ];
  const categories = ['공통 과목', '일반 선택', '진로 선택', '융합 선택'];
  const catalog = groups.flatMap(([group, ...types]) =>
    types.flatMap((names, i) =>
      names.map((name) => ({ name, group, category: categories[i] })),
    ),
  );
  const normalize = (s) =>
    String(s ?? '')
      .normalize('NFKC')
      .replace(/[\s·ㆍ⋅]/g, '')
      .toLowerCase();
  const find = (name) =>
    catalog.find((c) => normalize(c.name) === normalize(name));
  const header = (p) => `${p.grade}학년 ${p.name}`;
  function make(name, grade, mode) {
    name = String(name ?? '').trim();
    grade = String(grade ?? '');
    const c = find(name);
    if (!name || name.length > 70 || !['1', '2', '3'].includes(grade))
      throw Error('과목명(70자 이내)과 대상 학년을 확인해 주세요.');
    if (mode == null)
      mode = c?.category === '공통 과목' ? 'common' : 'elective';
    if (!['common', 'elective'].includes(mode))
      throw Error('응시 방식은 학년 공통 또는 학생 선택이어야 합니다.');
    return {
      name: c?.name || name,
      grade,
      mode,
      category: c?.category || '학교 지정',
      group: c?.group || '직접 추가',
    };
  }
  function validatePlan(plan) {
    if (!Array.isArray(plan) || !plan.length || plan.length > 60)
      throw Error('시험 과목을 1~60개 선택해 주세요.');
    const result = plan.map((p) => make(p.name, p.grade, p.mode));
    if (new Set(result.map((p) => normalize(header(p)))).size !== result.length)
      throw Error('같은 학년의 과목이 중복되었습니다.');
    return result;
  }
  function inferPlan(rows) {
    const data = createEngine().parseRows(rows);
    return validatePlan(
      data.subjects.map((c) => {
        const match = c.name.match(/^([123])학년\s*(.+)$/),
          name = match ? match[2] : c.name;
        if (!match && c.grades.length !== 1)
          throw Error(
            `${c.name}: 학년별 시험이 다르면 열 이름을 '1학년 ${c.name}', '2학년 ${c.name}'처럼 나눠 주세요.`,
          );
        const grade = match ? match[1] : c.grades[0],
          members = data.students.filter((s) => s.grade === grade);
        const common =
          members.length > 0 && members.every((s) => s.exams.includes(c.id));
        return make(name, grade, common ? 'common' : 'elective');
      }),
    );
  }
  function normalizeRoster(rows, plan) {
    plan = validatePlan(plan);
    rows = rows.filter((r) => r.some((v) => String(v ?? '').trim() !== ''));
    if (rows.length < 2)
      throw Error('학생별수강 시트에 학생ID·학년·응시 여부를 입력해 주세요.');
    const headers = rows[0],
      used = new Set(),
      indices = plan.map((p) => {
        const aliases = [normalize(header(p))];
        if (
          plan.filter((x) => normalize(x.name) === normalize(p.name)).length ===
          1
        )
          aliases.push(normalize(p.name));
        const matches = headers
          .map((h, i) => (i >= 2 && aliases.includes(normalize(h)) ? i : -1))
          .filter((i) => i >= 0);
        if (matches.length !== 1)
          throw Error(
            `${header(p)}: 엑셀 과목 열이 없거나 중복되었습니다. 선택한 과목의 양식을 다시 받아 주세요.`,
          );
        used.add(matches[0]);
        return matches[0];
      });
    if (headers.length !== plan.length + 2 || used.size !== plan.length)
      throw Error(
        '엑셀의 과목 열과 선택한 시험 과목이 다릅니다. 시험 과목 선택을 확인해 주세요.',
      );
    const result = [
      [headers[0], headers[1], ...plan.map(header)],
      ...rows.slice(1).map((r, i) => {
        if (
          r.length > headers.length &&
          r.slice(headers.length).some((v) => String(v ?? '').trim() !== '')
        )
          throw Error(`${i + 2}행: 제목 없는 열에 값이 있습니다.`);
        const grade = String(r[1] ?? '').trim();
        return [
          r[0],
          r[1],
          ...indices.map((j, k) => {
            const v = String(r[j] ?? '').trim(),
              p = plan[k];
            if (v !== '0' && v !== '1')
              throw Error(
                `${i + 2}행 ${header(p)}: 빈칸 없이 0 또는 1을 입력해 주세요.`,
              );
            if (grade !== p.grade && v === '1')
              throw Error(
                `${i + 2}행 ${header(p)}: 다른 학년의 시험은 0이어야 합니다.`,
              );
            if (grade === p.grade && p.mode === 'common' && v !== '1')
              throw Error(
                `${i + 2}행 ${header(p)}: 학년 공통 시험은 1이어야 합니다. 일부만 응시하면 과목 선택에서 '학생 선택'으로 바꿔 주세요.`,
              );
            return Number(v);
          }),
        ];
      }),
    ];
    return result;
  }
  function attach(data, plan) {
    data.subjects.forEach((c) => {
      const p = plan.find((p) => normalize(header(p)) === normalize(c.name));
      if (p)
        Object.assign(c, {
          displayName: p.name,
          mode: p.mode,
          category: p.category,
          group: p.group,
        });
    });
    return data;
  }
  function planSheet(plan) {
    return [
      ['엑셀 열 이름', '학년', '과목명', '응시 방식', '교육과정 분류', '교과'],
      ...plan.map((p) => [
        header(p),
        Number(p.grade),
        p.name,
        p.mode === 'common' ? '학년 공통' : '학생 선택',
        p.category,
        p.group,
      ]),
    ];
  }
  function readPlanSheet(rows) {
    if (!rows.length) return null;
    if (rows[0].slice(0, 4).join('|') !== '엑셀 열 이름|학년|과목명|응시 방식')
      throw Error(
        '시험과목 시트의 열 제목이 변경되었습니다. 새 양식을 받아 주세요.',
      );
    const plan = validatePlan(
      rows.slice(1).map((r, i) => {
        if (!['학년 공통', '학생 선택'].includes(r[3]))
          throw Error(`시험과목 ${i + 2}행: 응시 방식을 확인해 주세요.`);
        const p = make(
          r[2],
          r[1],
          r[3] === '학년 공통' ? 'common' : 'elective',
        );
        if (normalize(r[0]) !== normalize(header(p)))
          throw Error(
            `시험과목 ${i + 2}행: 과목명과 엑셀 열 이름이 일치하지 않습니다.`,
          );
        return p;
      }),
    );
    return plan;
  }
  function template(plan, perGrade = 30) {
    plan = validatePlan(plan);
    const grades = [...new Set(plan.map((p) => p.grade))].sort();
    if (
      !Number.isInteger(perGrade) ||
      perGrade < 1 ||
      perGrade * grades.length > 2000
    )
      throw Error(
        '학생 수는 학년별 1명 이상, 전체 2,000명 이내로 입력해 주세요.',
      );
    const rows = [['학생ID', '학년', ...plan.map(header)]];
    for (const grade of grades)
      for (let i = 1; i <= perGrade; i++)
        rows.push([
          `S${grade}-${String(i).padStart(3, '0')}`,
          Number(grade),
          ...plan.map((p) =>
            p.grade === grade && p.mode === 'common' ? 1 : 0,
          ),
        ]);
    return [
      { name: '학생별수강', rows, widths: [19, 9, ...plan.map(() => 25)] },
      {
        name: '시험과목',
        rows: planSheet(plan),
        widths: [32, 9, 30, 17, 18, 22],
      },
      {
        name: '작성안내',
        widths: [24, 100],
        rows: [
          ['항목', '내용'],
          [
            '학생ID',
            '임시 ID를 실제 익명 학생ID로 교체하세요. 행을 추가하거나 삭제해 실제 인원에 맞추세요.',
          ],
          [
            '응시 여부',
            '학년 공통은 해당 학년 1, 다른 학년 0으로 채웠습니다. 학생 선택 과목은 실제 응시자만 1로 변경하세요. 빈칸은 허용하지 않습니다.',
          ],
          [
            '분류와 응시 방식',
            '교육과정의 공통/일반/진로/융합 분류와 학교의 학년 공통/학생 선택 응시 방식은 서로 다릅니다.',
          ],
          [
            '자료 범위',
            '이번에 지필시험을 보는 과목만 포함하세요. 한 학생의 공통 시험과 선택 시험을 모두 입력합니다.',
          ],
          [
            '검사',
            '학생ID 중복, 다른 학년 응시, 공통 시험 누락, 빈칸, 수식, 수강생이 없는 과목을 검사합니다.',
          ],
          [
            '기존 엑셀',
            '학생ID·학년 뒤에 과목별 0/1을 입력한 .xlsx·CSV·TSV도 지원합니다. 과목명과 학년이 선택 목록에 맞아야 합니다.',
          ],
          [
            '계산 기준',
            '학생별 하루 최대 시험 수 → 하루 2과목 이상 학생 수 → 해당 학생·날짜 수 → 같은 날 인접 교시 학생 수·횟수를 줄입니다. 다른 날짜에 시험을 보는 것은 벌점이 없습니다.',
          ],
          ['공식 자료 확인일', '2026-11-14'],
          ...sources.map((s) => [s.title, s.url]),
        ],
      },
    ];
  }
  return {
    catalog,
    groups: groups.map((x) => x[0]),
    categories,
    sources,
    normalize,
    find,
    make,
    header,
    validatePlan,
    inferPlan,
    normalizeRoster,
    attach,
    planSheet,
    readPlanSheet,
    template,
  };
})();
if (typeof module !== 'undefined') module.exports = Curriculum;
