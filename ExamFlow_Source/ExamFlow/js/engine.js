/* ExamFlow offline scheduling engine. No network or external solver. */
function createEngine() {
  'use strict';
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function parseRows(rows) {
    rows = rows.filter((r) => r.some((v) => String(v ?? '').trim() !== ''));
    if (rows.length < 2)
      throw Error(
        '첫 행에 학생ID·학년·과목명, 다음 행부터 학생별 0/1 자료를 입력해 주세요. 과목별 총인원만으로는 계산할 수 없습니다.',
      );
    const h = rows[0].map((v) => String(v ?? '').trim());
    if (
      !['학생ID', '학생 ID', '학생id', 'ID', 'id', '익명 학생 ID'].includes(
        h[0],
      ) ||
      h[1] !== '학년'
    )
      throw Error(
        '첫 두 열의 제목은 학생ID, 학년이어야 합니다. 그 뒤에 과목명을 넣어 주세요.',
      );
    if (h.length < 3 || h.length > 62)
      throw Error('과목은 1~60개까지 입력할 수 있습니다.');
    if (h.some((x) => !x) || new Set(h).size !== h.length)
      throw Error(
        '열 제목이 비어 있거나 중복되었습니다. 학년별 시험이 다르면 과목명을 구분해 주세요.',
      );
    if (h.some((x) => x.length > 80))
      throw Error('열 제목은 80자 이내로 입력해 주세요.');
    if (rows.length > 2001)
      throw Error('이 초안은 학생 2,000명까지 지원합니다.');
    const subjects = h
      .slice(2)
      .map((name, i) => ({ id: i, name, count: 0, grades: [] }));
    const ids = new Set();
    const students = rows.slice(1).map((r, i) => {
      const id = String(r[0] ?? '').trim(),
        grade = String(r[1] ?? '').trim();
      if (!id || id.length > 80 || ids.has(id))
        throw Error(`${i + 2}행: 학생ID가 비었거나 중복되었거나 너무 깁니다.`);
      if (!['1', '2', '3'].includes(grade))
        throw Error(`${i + 2}행: 학년은 1, 2, 3 중 하나여야 합니다.`);
      if (
        r.length > h.length &&
        r.slice(h.length).some((v) => String(v ?? '').trim() !== '')
      )
        throw Error(`${i + 2}행: 제목 없는 열에 값이 있습니다.`);
      ids.add(id);
      const exams = [];
      for (let j = 2; j < h.length; j++) {
        const v = String(r[j] ?? '').trim();
        if (v !== '0' && v !== '1')
          throw Error(
            `${i + 2}행 ${h[j]}: 응시는 1, 미응시는 0으로 입력해 주세요. 빈칸은 허용하지 않습니다.`,
          );
        if (v === '1') {
          const c = j - 2;
          exams.push(c);
          subjects[c].count++;
          if (!subjects[c].grades.includes(grade))
            subjects[c].grades.push(grade);
        }
      }
      if (!exams.length)
        throw Error(
          `${i + 2}행: 응시 과목이 없는 학생입니다. 해당 행을 제외해 주세요.`,
        );
      return { id, grade, exams };
    });
    const empty = subjects.filter((c) => !c.count);
    if (empty.length)
      throw Error(
        `수강생이 없는 과목: ${empty.map((c) => c.name).join(', ')}. 해당 열을 삭제해 주세요.`,
      );
    return { subjects, students };
  }
  function toRows(data) {
    return [
      ['학생ID', '학년', ...data.subjects.map((c) => c.name)],
      ...data.students.map((s) => [
        s.id,
        Number(s.grade),
        ...data.subjects.map((c) => (s.exams.includes(c.id) ? 1 : 0)),
      ]),
    ];
  }
  function checkConfig(config) {
    if (
      !config ||
      !Array.isArray(config.days) ||
      !config.days.length ||
      config.days.length > 20
    )
      throw Error('시험일은 1~20일을 선택해 주세요.');
    if (
      !config.locks ||
      typeof config.locks !== 'object' ||
      Array.isArray(config.locks)
    )
      throw Error('고정 배치 설정이 올바르지 않습니다.');
    const keys = new Set();
    config.days.forEach((d) => {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
        isNaN(Date.parse(d.date)) ||
        new Date(d.date + 'T12:00:00Z').toISOString().slice(0, 10) !== d.date ||
        keys.has(d.date)
      )
        throw Error('시험 날짜가 올바르지 않거나 중복되었습니다.');
      keys.add(d.date);
      if (!Number.isInteger(d.periods) || d.periods < 1 || d.periods > 8)
        throw Error('하루 교시는 1~8로 설정해 주세요.');
    });
    if (config.days.some((d, i) => i && d.date <= config.days[i - 1].date))
      throw Error('시험 날짜는 시간순으로 정렬되어야 합니다.');
    for (const [key, lo, hi] of [
      ['maxDaily', 1, 8],
      ['maxRun', 1, 8],
      ['maxPairs', -1, 160],
      ['capacity', 1, 60],
      ['duration', 10, 180],
      ['breakMinutes', 0, 120],
    ])
      if (
        !Number.isInteger(config[key]) ||
        config[key] < lo ||
        config[key] > hi
      )
        throw Error('시험 조건의 숫자가 허용 범위를 벗어났습니다: ' + key);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.startTime))
      throw Error('시험 시작 시각이 올바르지 않습니다.');
    const [h, m] = config.startTime.split(':').map(Number),
      p = Math.max(...config.days.map((d) => d.periods));
    if (h * 60 + m + p * config.duration + (p - 1) * config.breakMinutes > 1440)
      throw Error(
        '마지막 시험이 자정을 넘습니다. 교시 수나 시간을 조정해 주세요.',
      );
    if (typeof config.title !== 'string' || config.title.length > 100)
      throw Error('시험명은 100자 이내로 입력해 주세요.');
  }
  function prepare(data, config) {
    checkConfig(config);
    const slots = [];
    config.days.forEach((d, di) => {
      for (let p = 0; p < d.periods; p++)
        slots.push({ date: d.date, day: di, period: p });
    });
    const members = data.subjects.map((c) =>
      data.students
        .map((s, i) => (s.exams.includes(c.id) ? i : -1))
        .filter((i) => i >= 0),
    );
    const conflict = data.subjects.map(
      () => new Uint8Array(data.subjects.length),
    );
    data.students.forEach((s) =>
      s.exams.forEach((a) =>
        s.exams.forEach((b) => {
          if (a !== b) conflict[a][b] = 1;
        }),
      ),
    );
    const locks = Array(data.subjects.length).fill(-1);
    for (const [k, v] of Object.entries(config.locks || {})) {
      const c = Number(k);
      if (
        !Number.isInteger(c) ||
        c < 0 ||
        c >= locks.length ||
        !Number.isInteger(v) ||
        v < 0 ||
        v >= slots.length
      )
        throw Error('고정 배치의 과목 또는 시간이 올바르지 않습니다.');
      locks[c] = v;
    }
    return { data, config, slots, members, conflict, locks };
  }
  function studentStats(ctx, assignment, s) {
    const daily = ctx.config.days.map((d) => Array(d.periods).fill(0));
    let conflicts = 0;
    for (const c of s.exams) {
      const v = assignment[c];
      if (v >= 0) {
        const t = ctx.slots[v];
        if (!t) return { invalid: true };
        if (daily[t.day][t.period]++) conflicts++;
      }
    }
    let pairs = 0,
      maxRun = 0,
      maxDaily = 0,
      wait = 0,
      balance = 0,
      threeDays = 0,
      multiDays = 0;
    for (const row of daily) {
      let run = 0;
      const n = row.filter((x) => x > 0).length;
      maxDaily = Math.max(maxDaily, n);
      balance += n * n;
      if (n >= 3) threeDays++;
      if (n >= 2) multiDays++;
      for (let p = 0; p < row.length; p++) {
        if (row[p]) {
          run++;
          if (p && row[p - 1]) pairs++;
          maxRun = Math.max(maxRun, run);
        } else run = 0;
      }
      if (n) {
        const first = row.findIndex(Boolean),
          last = row.findLastIndex
            ? row.findLastIndex(Boolean)
            : row.length - 1 - row.slice().reverse().findIndex(Boolean);
        wait += last - first + 1 - n;
      }
    }
    return {
      pairs,
      maxRun,
      maxDaily,
      wait,
      balance,
      threeDays,
      multiDays,
      conflicts,
      daily,
    };
  }
  function validate(ctx, a, partial = false) {
    const errors = [];
    if (!Array.isArray(a) || a.length !== ctx.data.subjects.length)
      return ['과목 배치 수가 일치하지 않습니다.'];
    const load = Array(ctx.slots.length).fill(0);
    a.forEach((t, c) => {
      if (partial && t === -1) return;
      if (!Number.isInteger(t) || !ctx.slots[t])
        errors.push(
          `${ctx.data.subjects[c].name}: 배치 누락 또는 잘못된 시간입니다.`,
        );
      else {
        load[t]++;
        if (ctx.locks[c] >= 0 && ctx.locks[c] !== t)
          errors.push(`${ctx.data.subjects[c].name}: 고정 배치 위반입니다.`);
      }
    });
    if (errors.length) return errors;
    if (load.some((v) => v > ctx.config.capacity))
      errors.push('한 교시 최대 동시 과목 수를 초과했습니다.');
    for (const s of ctx.data.students) {
      const m = studentStats(ctx, a, s);
      if (m.conflicts) errors.push(`${s.id}: 같은 시간에 시험이 겹칩니다.`);
      if (m.maxDaily > ctx.config.maxDaily)
        errors.push(`${s.id}: 하루 최대 시험 수를 초과했습니다.`);
      if (m.maxRun > ctx.config.maxRun)
        errors.push(`${s.id}: 연속 응시 상한을 초과했습니다.`);
      if (ctx.config.maxPairs >= 0 && m.pairs > ctx.config.maxPairs)
        errors.push(`${s.id}: 전체 연속 시험 횟수 상한을 초과했습니다.`);
      if (errors.length >= 8) break;
    }
    return errors;
  }
  function metrics(ctx, a, detail = false) {
    let affected = 0,
      total = 0,
      maxPairs = 0,
      waiting = 0,
      balance = 0,
      three = 0,
      maxDaily = 0,
      conflicts = 0,
      multiAffected = 0,
      multiDays = 0;
    const perStudent = [];
    for (const s of ctx.data.students) {
      const m = studentStats(ctx, a, s);
      if (m.pairs) affected++;
      if (m.multiDays) multiAffected++;
      multiDays += m.multiDays;
      total += m.pairs;
      maxPairs = Math.max(maxPairs, m.pairs);
      waiting += m.wait;
      balance += m.balance;
      three += m.threeDays > 0 ? 1 : 0;
      maxDaily = Math.max(maxDaily, m.maxDaily);
      conflicts += m.conflicts;
      if (detail) perStudent.push({ id: s.id, grade: s.grade, ...m });
    }
    // Daily load is compared first. Adjacency is measured inside each date only.
    // The peak protects a small group from receiving very crowded days merely to
    // reduce the number of affected students. No cross-date penalty is used.
    return {
      affected,
      total,
      maxPairs,
      waiting,
      balance,
      three,
      maxDaily,
      conflicts,
      multiAffected,
      multiDays,
      perStudent,
      tuple: [
        maxDaily,
        multiAffected,
        multiDays,
        affected,
        total,
        balance,
        waiting,
      ],
    };
  }
  function compare(a, b) {
    for (let i = 0; i < a.tuple.length; i++) {
      if (a.tuple[i] !== b.tuple[i]) return a.tuple[i] - b.tuple[i];
    }
    return 0;
  }
  function construct(ctx, random, deadline) {
    const n = ctx.data.subjects.length,
      a = ctx.locks.slice(),
      occupied = Array(ctx.slots.length).fill(0);
    a.forEach((t) => {
      if (t >= 0) occupied[t]++;
    });
    if (validate(ctx, a, true).length) return null;
    let nodes = 0;
    function candidates(c) {
      const out = [];
      for (let t = 0; t < ctx.slots.length; t++) {
        if (occupied[t] >= ctx.config.capacity) continue;
        if (a.some((v, b) => v === t && ctx.conflict[c][b])) continue;
        a[c] = t;
        let ok = true;
        for (const i of ctx.members[c]) {
          const m = studentStats(ctx, a, ctx.data.students[i]);
          if (
            m.maxDaily > ctx.config.maxDaily ||
            m.maxRun > ctx.config.maxRun ||
            (ctx.config.maxPairs >= 0 && m.pairs > ctx.config.maxPairs)
          ) {
            ok = false;
            break;
          }
        }
        a[c] = -1;
        if (ok) out.push(t);
      }
      return out;
    }
    function rec(left) {
      if (!left) return true;
      if (++nodes > 16000 || Date.now() > deadline) return false;
      let pick = -1,
        opts = null,
        rank = -1;
      for (let c = 0; c < n; c++) {
        if (a[c] >= 0) continue;
        const degree =
          ctx.conflict[c].reduce((v, x, b) => v + (x && a[b] >= 0 ? 5 : x), 0) +
          random();
        if (degree > rank) {
          rank = degree;
          pick = c;
        }
      }
      opts = candidates(pick);
      if (!opts.length) return false;
      opts = opts
        .map((t) => ({ t, key: random() }))
        .sort((x, y) => x.key - y.key)
        .map((x) => x.t);
      for (const t of opts) {
        a[pick] = t;
        occupied[t]++;
        if (rec(left - 1)) return true;
        occupied[t]--;
        a[pick] = -1;
        if (Date.now() > deadline) return false;
      }
      return false;
    }
    return rec(a.filter((v) => v < 0).length) ? a : null;
  }
  function solve(data, config, initial, ms, seed, progress = () => {}) {
    const ctx = prepare(data, config),
      start = Date.now(),
      end = start + ms,
      random = rng(seed);
    const bound = config.days.reduce(
      (s, d) => s + Math.min(config.maxDaily, d.periods),
      0,
    );
    const excess = data.students.find((s) => s.exams.length > bound);
    if (excess)
      return {
        status: 'impossible',
        message: `${excess.id} 학생은 ${excess.exams.length}과목을 응시하지만, 현재 날짜와 하루 상한으로 최대 ${bound}과목만 배치할 수 있습니다.`,
      };
    const lockErrors = validate(ctx, ctx.locks, true);
    if (lockErrors.length)
      return {
        status: 'impossible',
        message: '고정 배치가 필수 조건과 충돌합니다. ' + lockErrors.join(' '),
      };
    let best =
      initial && validate(ctx, initial).length === 0 ? initial.slice() : null;
    let base = best ? best.slice() : null,
      tries = 0;
    if (!best) {
      while (Date.now() < start + ms * 0.55) {
        best = construct(
          ctx,
          random,
          Math.min(start + ms * 0.55, Date.now() + 350),
        );
        tries++;
        if (best) break;
      }
      if (!best)
        return {
          status: 'unknown',
          message:
            '제한 시간 안에 조건을 만족하는 배치를 찾지 못했습니다. 불가능하다는 뜻은 아닙니다. 다시 생성하거나 날짜·교시·응시 상한을 검토해 주세요.',
        };
      base = best.slice();
    }
    let bestM = metrics(ctx, best),
      current = best.slice(),
      curM = bestM,
      iterations = 0,
      last = start;
    const free = ctx.locks
      .map((t, i) => (t < 0 ? i : -1))
      .filter((i) => i >= 0);
    const count = Math.max(1, data.students.length);
    // Smooth guidance for exploration; best-result selection always uses compare.
    const energy = (m) =>
      m.maxDaily * 100 +
      (m.multiAffected / count) * 20 +
      (m.multiDays / count) * 5 +
      (m.affected / count) * 2 +
      (m.total / count) * 0.2 +
      (m.balance / count) * 0.005 +
      (m.waiting / count) * 0.0001;
    progress({ elapsed: Date.now() - start, metrics: bestM, iterations });
    while (Date.now() < end && free.length) {
      const a = current.slice(),
        kind = random(),
        c = free[Math.floor(random() * free.length)];
      if (kind < 0.45) a[c] = Math.floor(random() * ctx.slots.length);
      else if (kind < 0.8) {
        const b = free[Math.floor(random() * free.length)];
        [a[c], a[b]] = [a[b], a[c]];
      } else {
        const x = Math.floor(random() * ctx.slots.length),
          y = Math.floor(random() * ctx.slots.length);
        if (ctx.locks.some((t) => t === x || t === y)) continue;
        for (let j = 0; j < a.length; j++) {
          if (a[j] === x) a[j] = y;
          else if (a[j] === y) a[j] = x;
        }
      }
      iterations++;
      if (!validate(ctx, a).length) {
        const m = metrics(ctx, a),
          phase = (Date.now() - start) / ms,
          temp = 0.1 + 4 * (1 - phase),
          diff = energy(m) - energy(curM);
        if (compare(m, curM) < 0 || random() < Math.exp(-diff / temp)) {
          current = a;
          curM = m;
        }
        if (compare(m, bestM) < 0) {
          best = a.slice();
          bestM = m;
        }
      }
      if (iterations % 700 === 0) {
        current = best.slice();
        curM = bestM;
      }
      if (Date.now() - last > 250) {
        last = Date.now();
        progress({ elapsed: last - start, metrics: bestM, iterations });
      }
    }
    const errors = validate(ctx, best);
    if (errors.length) throw Error('최종 배치 검증 실패: ' + errors.join(' '));
    return {
      status: 'feasible',
      assignment: best,
      baseline: base,
      metrics: metrics(ctx, best, true),
      iterations,
      elapsed: Date.now() - start,
      seed,
    };
  }
  function demo() {
    const random = rng(15741),
      names = [
        '국어',
        '수학Ⅱ',
        '영어Ⅱ',
        '윤리',
        '기하',
        '생명과학Ⅰ',
        '세계사',
        '화학Ⅰ',
        '물리학Ⅰ',
        '경제',
        '정치와 법',
        '지구과학Ⅰ',
      ];
    const rows = [['학생ID', '학년', ...names]];
    for (let i = 0; i < 180; i++) {
      const choices = Array.from({ length: 9 }, (_, j) => j + 3)
        .map((j) => ({ j, r: random() }))
        .sort((a, b) => a.r - b.r)
        .slice(0, 3)
        .map((v) => v.j);
      rows.push([
        'S' + String(i + 1).padStart(3, '0'),
        2,
        ...names.map((_, j) => (j < 3 || choices.includes(j) ? 1 : 0)),
      ]);
    }
    return parseRows(rows);
  }
  return {
    rng,
    parseRows,
    toRows,
    checkConfig,
    prepare,
    studentStats,
    validate,
    metrics,
    compare,
    solve,
    demo,
  };
}
if (typeof module !== 'undefined') module.exports = { createEngine };
