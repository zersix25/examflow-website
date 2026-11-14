/* Offline file adapters. XLSX is parsed as data; formulas/macros are never executed. */
const Files = (() => {
  const xmlEscape = (s) =>
    String(s ?? '')
      .replace(
        /[<>&"']/g,
        (c) =>
          ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&apos;',
          })[c],
      )
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  function col(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const delimiter = text.split(/\r?\n/)[0].includes('\t') ? '\t' : ',';
    const rows = [];
    let row = [],
      cell = '',
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else if (!quoted && cell.length)
          throw Error('CSV 따옴표 형식이 올바르지 않습니다.');
        else quoted = !quoted;
      } else if (c === delimiter && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else cell += c;
    }
    if (quoted) throw Error('CSV의 닫는 따옴표가 없습니다.');
    row.push(cell);
    rows.push(row);
    return rows;
  }
  function parseXML(s) {
    if (s.length > 25000000)
      throw Error(
        '엑셀 내부 자료가 너무 큽니다. 필요한 수강 자료만 새 파일에 복사해 주세요.',
      );
    const d = new DOMParser().parseFromString(s, 'application/xml');
    if (d.getElementsByTagName('parsererror').length)
      throw Error(
        '엑셀 내부 XML을 읽지 못했습니다. .xlsx로 다시 저장해 주세요.',
      );
    return d;
  }
  const nodes = (d, n) => Array.from(d.getElementsByTagNameNS('*', n));
  async function readXlsx(buffer, sheetName = null) {
    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw Error(
        '일반 .xlsx 파일이 아닙니다. 암호를 해제하고 Excel 통합 문서(.xlsx)로 저장해 주세요.',
      );
    }
    const read = async (p) => {
      const f = zip.file(p);
      if (!f) throw Error('엑셀 필수 항목을 찾지 못했습니다: ' + p);
      return parseXML(await f.async('string'));
    };
    const wb = await read('xl/workbook.xml'),
      rels = await read('xl/_rels/workbook.xml.rels');
    const sheets = nodes(wb, 'sheet');
    const sheet = sheetName
      ? sheets.find((s) => s.getAttribute('name') === sheetName)
      : sheets.find((s) =>
          ['학생별수강', '수강정보'].includes(s.getAttribute('name')),
        ) || sheets[0];
    if (!sheet) {
      if (sheetName) return null;
      throw Error('엑셀에 시트가 없습니다.');
    }
    const rid =
      sheet.getAttribute('r:id') ||
      sheet.getAttributeNS(
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'id',
      );
    const rel = nodes(rels, 'Relationship').find(
      (r) => r.getAttribute('Id') === rid,
    );
    if (!rel || rel.getAttribute('TargetMode') === 'External')
      throw Error('외부 연결 시트는 지원하지 않습니다.');
    let path = rel.getAttribute('Target');
    path = path.startsWith('/') ? path.slice(1) : 'xl/' + path;
    const normalized = [];
    for (const p of path.split('/')) {
      if (p === '..') normalized.pop();
      else if (p !== '.') normalized.push(p);
    }
    path = normalized.join('/');
    const strings = zip.file('xl/sharedStrings.xml')
      ? nodes(await read('xl/sharedStrings.xml'), 'si').map((s) =>
          nodes(s, 't')
            .map((t) => t.textContent)
            .join(''),
        )
      : [];
    const doc = await read(path),
      rows = [];
    for (const row of nodes(doc, 'row')) {
      const r = [];
      for (const cell of nodes(row, 'c')) {
        const ref = cell.getAttribute('r') || '';
        const letters = ref.match(/^[A-Z]+/i);
        if (!letters) continue;
        let index = 0;
        for (const c of letters[0].toUpperCase())
          index = index * 26 + c.charCodeAt(0) - 64;
        index--;
        if (index > 62) {
          if (nodes(cell, 'v').length || nodes(cell, 't').length)
            throw Error('열이 너무 많습니다. 최대 60과목까지 지원합니다.');
          continue;
        }
        if (nodes(cell, 'f').length)
          throw Error(
            `수강 정보 ${ref}: 수식 대신 계산된 0/1 값을 붙여 넣어 주세요.`,
          );
        const t = cell.getAttribute('t'),
          v = nodes(cell, 'v')[0]?.textContent ?? '';
        if (t === 'e') throw Error(`엑셀 오류 셀: ${ref}`);
        r[index] =
          t === 's'
            ? (strings[Number(v)] ?? '')
            : t === 'inlineStr'
              ? nodes(cell, 't')
                  .map((n) => n.textContent)
                  .join('')
              : v;
      }
      if (r.some((x) => String(x ?? '').trim() !== ''))
        rows.push(Array.from({ length: r.length }, (_, i) => r[i] ?? ''));
      if (rows.length > 2001)
        throw Error('학생은 최대 2,000명까지 입력할 수 있습니다.');
    }
    return rows;
  }
  async function readRoster(file) {
    if (file.size > 8 * 1024 * 1024)
      throw Error('파일은 8MB 이하로 준비해 주세요.');
    const buf = await file.arrayBuffer();
    if (/\.xlsx$/i.test(file.name)) return readXlsx(buf);
    if (!/\.(csv|tsv)$/i.test(file.name))
      throw Error(
        '.xlsx 또는 UTF-8 CSV 파일을 선택해 주세요. 구형 .xls는 .xlsx로 변환해 주세요.',
      );
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('\ufffd')) text = new TextDecoder('euc-kr').decode(buf);
    return parseCSV(text);
  }
  async function readRosterPackage(file) {
    if (file.size > 8 * 1024 * 1024)
      throw Error('파일은 8MB 이하로 준비해 주세요.');
    if (!/\.xlsx$/i.test(file.name))
      return { rows: await readRoster(file), planRows: null };
    const buf = await file.arrayBuffer();
    return {
      rows: await readXlsx(buf),
      planRows: await readXlsx(buf, '시험과목'),
    };
  }
  function download(bytes, name, type = 'application/octet-stream') {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function csv(rows) {
    return (
      '\uFEFF' +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v ?? '')
                  .replace(/^[=+@-]/, "'$&")
                  .replace(/"/g, '""') +
                '"',
            )
            .join(','),
        )
        .join('\r\n')
    );
  }
  async function xlsx(sheets) {
    const z = new JSZip(),
      ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    z.file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map(
            (_, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
          )
          .join('') +
        '</Types>',
    );
    z.file(
      '_rels/.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    );
    z.file(
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    );
    z.file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets
          .map(
            (s, i) =>
              `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
          )
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    );
    z.file(
      'xl/styles.xml',
      `<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF244C43"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    );
    sheets.forEach((s, i) => {
      const cols = Math.max(...s.rows.map((r) => r.length));
      z.file(
        `xl/worksheets/sheet${i + 1}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({ length: cols }, (_, j) => `<col min="${j + 1}" max="${j + 1}" width="${s.widths?.[j] || 23}" customWidth="1"/>`).join('')}</cols><sheetData>${s.rows.map((r, ri) => `<row r="${ri + 1}" ht="${ri === 0 ? 32 : s.height || 30}" customHeight="1">${r.map((v, ci) => `<c r="${col(ci)}${ri + 1}" s="${ri === 0 ? 1 : 0}"${typeof v === 'number' && Number.isFinite(v) ? `><v>${v}</v>` : ` t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`,
      );
    });
    return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }
  return {
    readRoster,
    readRosterPackage,
    readXlsx,
    parseCSV,
    download,
    csv,
    xlsx,
  };
})();
if (typeof module !== 'undefined') module.exports = Files;
