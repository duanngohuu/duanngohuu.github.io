// Pure Google Sheets reader/parser used by background sync without touching current study state.
(() => {
  try {
    const clean = value => String(value ?? '').replace(/\r/g, '').trim();
    let googlePromise = null;

    function parseRange(range) {
      const match = String(range).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (!match) return { startRow: 1, startCol: 1 };
      const col = letters => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      return { startCol: col(match[1]), startRow: +match[2] };
    }

    function loadGoogleCharts() {
      if (window.google?.visualization?.Query) return Promise.resolve();
      if (googlePromise) return googlePromise;
      googlePromise = new Promise((resolve, reject) => {
        const ready = () => {
          try {
            google.charts.load('current', { packages: ['table'] });
            google.charts.setOnLoadCallback(resolve);
          } catch (error) { reject(error); }
        };
        let script = document.querySelector('script[data-google-charts-loader]');
        if (script) {
          if (window.google?.charts) ready();
          else {
            script.addEventListener('load', ready, { once: true });
            script.addEventListener('error', () => reject(new Error('Không tải được Google Charts.')), { once: true });
          }
          return;
        }
        script = document.createElement('script');
        script.src = 'https://www.gstatic.com/charts/loader.js';
        script.async = true;
        script.dataset.googleChartsLoader = '1';
        script.onload = ready;
        script.onerror = () => reject(new Error('Không tải được Google Charts.'));
        document.head.appendChild(script);
      });
      return googlePromise;
    }

    async function queryRows(lesson) {
      if (navigator.onLine === false) throw new Error('Thiết bị đang offline.');
      const config = await window.loadSheetLibraryConfig();
      await loadGoogleCharts();
      const info = parseRange(lesson.range);
      const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(lesson.sheet)}&range=${encodeURIComponent(lesson.range)}&headers=0&_=${Date.now()}`;
      return new Promise((resolve, reject) => {
        const query = new google.visualization.Query(url);
        query.send(response => {
          if (response.isError()) return reject(new Error(response.getMessage() || 'Google Sheets query error'));
          const table = response.getDataTable();
          const rows = new Map();
          for (let r = 0; r < table.getNumberOfRows(); r++) {
            const values = [];
            for (let c = 0; c < table.getNumberOfColumns(); c++) {
              const formatted = table.getFormattedValue(r, c);
              const raw = table.getValue(r, c);
              values[info.startCol + c] = clean(formatted || raw);
            }
            rows.set(info.startRow + r, values);
          }
          resolve(rows);
        });
      });
    }

    const rowValue = (rows, row, col) => clean(rows.get(row)?.[col]);

    function fieldValue(rows, row, spec) {
      const source = Array.isArray(spec[0]) ? spec[0] : [spec[0]];
      return source.map(col => rowValue(rows, row, col)).filter(Boolean).join('\n');
    }

    function makeCard(lesson, row, faces, index) {
      const cleanFaces = faces
        .filter(face => clean(face.text))
        .slice(0, 5)
        .map(face => ({ label: clean(face.label), text: clean(face.text) }));
      if (!cleanFaces.length) return null;
      return {
        id: `${lesson.id}-${row}-${index}`,
        no: index,
        faces: cleanFaces,
        front: cleanFaces[0].text,
        meaning_vi: cleanFaces[1]?.text || '',
        reading: '',
        han_viet: '',
        years: '',
        sourceRow: row,
        sourceSheet: lesson.sheet
      };
    }

    function parseRowCards(rows, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const primary = rowValue(rows, row, lesson.primaryCol || 1);
        if (!primary && lesson.mergeContinuation && cards.length) {
          const previous = cards.at(-1);
          (lesson.fields || []).forEach((spec, index) => {
            const addition = fieldValue(rows, row, spec);
            if (addition && previous.faces[index]) previous.faces[index].text += '\n' + addition;
          });
          continue;
        }
        if (!primary) continue;
        const faces = (lesson.fields || []).map(spec => ({ label: spec[1], text: fieldValue(rows, row, spec) }));
        const card = makeCard(lesson, row, faces, cards.length + 1);
        if (card) cards.push(card);
      }
      return cards;
    }

    function parsePresentation(rows, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const value = rowValue(rows, row, 2);
        if (!value) continue;
        const lines = value.split('\n').map(clean).filter(Boolean);
        const title = lines.shift() || lesson.title;
        const card = makeCard(lesson, row, [
          { label: 'Mục', text: title },
          { label: 'Nội dung', text: lines.join('\n') || value }
        ], cards.length + 1);
        if (card) cards.push(card);
      }
      return cards;
    }

    function parseMailTemplates(rows, lesson) {
      const cards = [];
      let active = null;
      const flush = () => {
        if (!active) return;
        const card = makeCard(lesson, active.row, [
          { label: 'Tên mẫu', text: active.title },
          { label: 'Nội dung email', text: active.body.join('\n') },
          { label: 'Loại email', text: lesson.title }
        ], cards.length + 1);
        if (card) cards.push(card);
        active = null;
      };
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const title = rowValue(rows, row, 6);
        const body = [11, 12, 13, 14].map(col => rowValue(rows, row, col)).filter(Boolean).join(' ');
        if (title) {
          flush();
          active = { row, title, body: body ? [body] : [] };
        } else if (active && body) {
          active.body.push(body);
        }
      }
      flush();
      return cards;
    }

    function parseBlock(rows, lesson) {
      const title = rowValue(rows, lesson.startRow, 1) || lesson.title;
      const body = [];
      for (let row = lesson.startRow + 1; row <= lesson.endRow; row++) {
        const value = rowValue(rows, row, 1);
        if (value) body.push(value);
      }
      const card = makeCard(lesson, lesson.startRow, [
        { label: 'Tiêu đề', text: title },
        { label: 'Nội dung email', text: body.join('\n') }
      ], 1);
      return card ? [card] : [];
    }

    function parseContextRows(rows, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const value = rowValue(rows, row, 1);
        if (!value) continue;
        const card = makeCard(lesson, row, [
          { label: 'Câu đệm', text: value.replace(/^➤\s*/, '') },
          { label: 'Mục đích', text: lesson.context || lesson.title }
        ], cards.length + 1);
        if (card) cards.push(card);
      }
      return cards;
    }

    async function fetchFreshCards(lesson) {
      const rows = await queryRows(lesson);
      if (lesson.parser === 'presentation') return parsePresentation(rows, lesson);
      if (lesson.parser === 'mailTemplates') return parseMailTemplates(rows, lesson);
      if (lesson.parser === 'block') return parseBlock(rows, lesson);
      if (lesson.parser === 'contextRows') return parseContextRows(rows, lesson);
      return parseRowCards(rows, lesson);
    }

    window.fetchSheetLessonCardsFresh = fetchFreshCards;
  } catch (error) {
    try { console.warn('[sheet-sync-reader disabled]', error); } catch (_) {}
  }
})();
