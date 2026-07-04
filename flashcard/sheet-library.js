// Live Google Sheets library + dynamic multi-face flashcards.
(() => {
  try {
    if (!window.st || !window.e) return;
    const $ = s => document.querySelector(s);
    const CONFIG_PATH = './data/sheet-library-manifest.json';
    let configPromise = null;
    let googlePromise = null;
    const courseById = new Map();

    const clean = value => String(value ?? '').replace(/\r/g, '').trim();
    const isNumber = value => /^\d+(?:\.0+)?$/.test(clean(value));
    const parseRange = range => {
      const m = String(range).match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
      if (!m) return { startRow: 1, endRow: 1, startCol: 1, endCol: 1 };
      const col = letters => [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
      return { startCol: col(m[1]), startRow: +m[2], endCol: col(m[3]), endRow: +m[4] };
    };
    const colLetters = number => {
      let value = number, out = '';
      while (value > 0) { value--; out = String.fromCharCode(65 + value % 26) + out; value = Math.floor(value / 26); }
      return out || 'A';
    };

    async function loadConfig() {
      if (!configPromise) {
        configPromise = getText(CONFIG_PATH + '?v=' + Date.now()).then(text => {
          const cfg = JSON.parse(text);
          (cfg.courses || []).forEach(course => courseById.set(course.id, course));
          return cfg;
        });
      }
      return configPromise;
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
          else { script.addEventListener('load', ready, { once: true }); script.addEventListener('error', reject, { once: true }); }
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

    async function queryCourse(course) {
      if (course._rows) return course._rows;
      const cfg = await loadConfig();
      await loadGoogleCharts();
      const info = parseRange(course.usedRange);
      const url = `https://docs.google.com/spreadsheets/d/${cfg.spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(course.title)}&range=${encodeURIComponent(course.usedRange)}&headers=0`;
      course._rows = await new Promise((resolve, reject) => {
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
      return course._rows;
    }

    const rowValue = (course, row, col) => clean(course._rows?.get(row)?.[col]);
    const usedInfo = course => parseRange(course.usedRange);
    const countRows = (course, start, end, primaryCol = course.primaryCol || 1) => {
      let count = 0;
      for (let row = start; row <= end; row++) if (rowValue(course, row, primaryCol)) count++;
      return count;
    };
    function lesson(course, index, title, startRow, endRow, extra = {}) {
      const endCol = usedInfo(course).endCol;
      return {
        id: `${course.id}-${String(index).padStart(3, '0')}`,
        title: clean(title) || `Bài ${String(index).padStart(2, '0')}`,
        count: extra.count ?? countRows(course, startRow, endRow, extra.primaryCol || course.primaryCol),
        source: 'google-sheet', courseId: course.id, courseTitle: course.title, sheet: course.title,
        range: `A${startRow}:${colLetters(endCol)}${endRow}`, startRow, endRow,
        parser: extra.parser || course.parser || 'rows', fields: extra.fields || course.fields || [],
        primaryCol: extra.primaryCol || course.primaryCol || 1,
        mergeContinuation: extra.mergeContinuation ?? course.mergeContinuation ?? false,
        ...extra
      };
    }

    function chunkRows(course, start, end, grouped = false) {
      const primary = course.primaryCol || 1;
      const groupCol = course.groupCol || 1;
      const target = course.chunkSize || 50;
      const groups = [];
      let current = [];
      for (let row = start; row <= end; row++) {
        if (!rowValue(course, row, primary)) continue;
        if (grouped && rowValue(course, row, groupCol) && current.length) { groups.push(current); current = []; }
        if (!grouped && current.length) { groups.push(current); current = []; }
        current.push(row);
      }
      if (current.length) groups.push(current);
      const chunks = [];
      let active = [], size = 0;
      groups.forEach(group => {
        if (active.length && size >= target) { chunks.push(active.flat()); active = []; size = 0; }
        active.push(group); size += group.length;
      });
      if (active.length) chunks.push(active.flat());
      if (chunks.length > 1 && chunks.at(-1).length <= 15 && chunks.at(-2).length + chunks.at(-1).length <= 65) {
        chunks[chunks.length - 2].push(...chunks.pop());
      }
      return chunks;
    }

    function numberRangeTitle(course, rows, fallback) {
      const numbers = rows.map(row => rowValue(course, row, course.groupCol || 1)).filter(isNumber).map(Number);
      return numbers.length ? `STT ${Math.floor(numbers[0])}–${Math.floor(numbers.at(-1))}` : fallback;
    }

    function deriveLessons(course) {
      const result = [];
      const pushChunks = (ranges, grouped = true) => ranges.forEach(([start, end]) => {
        chunkRows(course, start, end, grouped).forEach(rows => {
          const i = result.length + 1;
          result.push(lesson(course, i, numberRangeTitle(course, rows, `Bài ${String(i).padStart(2, '0')}`), rows[0], rows.at(-1), { count: rows.length }));
        });
      });

      if (course.kind === 'mixedVocab') {
        pushChunks(course.ordinary || [], true);
        (course.sections || []).forEach(([start, end]) => {
          result.push(lesson(course, result.length + 1, rowValue(course, start, 2), start + 1, end, { mergeContinuation: start === 616 }));
        });
      } else if (course.kind === 'patternVocab') {
        pushChunks(course.ordinary || [], true);
        (course.sections || []).forEach(([start, end]) => result.push(lesson(course, result.length + 1, rowValue(course, start, 2), start + 1, end)));
      } else if (course.kind === 'titleRegex') {
        const info = usedInfo(course), regex = new RegExp(course.titleRegex);
        const starts = [];
        for (let row = info.startRow; row <= info.endRow; row++) {
          if (!rowValue(course, row, 1) && regex.test(rowValue(course, row, 2))) starts.push(row);
        }
        starts.forEach((start, index) => {
          const end = (starts[index + 1] || info.endRow + 1) - 1;
          result.push(lesson(course, result.length + 1, rowValue(course, start, 2), start + 1, end));
        });
      } else if (course.kind === 'grammar') {
        const info = usedInfo(course), starts = [];
        for (let row = info.startRow; row <= info.endRow; row++) if (isNumber(rowValue(course, row, 1))) starts.push(row);
        starts.forEach((start, index) => {
          const end = (starts[index + 1] || info.endRow + 1) - 1;
          const number = Math.floor(Number(rowValue(course, start, 1)));
          let title = rowValue(course, start, 2) || `Ngữ pháp ${number}`;
          if (course.warningAfter && start > course.warningAfter) title = `⚠ ${number}. Mazii chưa kiểm chứng`;
          result.push(lesson(course, result.length + 1, title, start, end));
        });
      } else if (course.kind === 'presentation') {
        const info = usedInfo(course), starts = [];
        for (let row = info.startRow; row <= info.endRow; row++) if (rowValue(course, row, 1)) starts.push(row);
        starts.forEach((start, index) => {
          const end = (starts[index + 1] || info.endRow + 1) - 1;
          result.push(lesson(course, result.length + 1, rowValue(course, start, 1), start, end, { parser: 'presentation', primaryCol: 2 }));
        });
      } else if (course.kind === 'fixedSections') {
        (course.sections || []).forEach(([start, end, title]) => result.push(lesson(course, result.length + 1, title, start, end, { parser: course.parser, count: countRows(course, start, end, 6) })));
      } else if (course.kind === 'titleRows') {
        const info = usedInfo(course);
        (course.titleRows || []).forEach((start, index, all) => {
          const end = (all[index + 1] || info.endRow + 1) - 1;
          result.push(lesson(course, result.length + 1, rowValue(course, start, 1), start, end, { parser: course.parser, count: 1 }));
        });
      } else if (course.kind === 'single') {
        const info = usedInfo(course);
        result.push(lesson(course, 1, course.lessonTitle || course.title, info.startRow, info.endRow));
      } else if (course.kind === 'cushion') {
        const info = usedInfo(course), starts = [];
        for (let row = info.startRow; row <= info.endRow; row++) if (/^[①-⑳]/.test(rowValue(course, row, 1))) starts.push(row);
        starts.forEach((start, index) => {
          const end = (starts[index + 1] || info.endRow + 1) - 1;
          const title = rowValue(course, start, 1);
          result.push(lesson(course, result.length + 1, title, start + 1, end, { parser: 'contextRows', context: title, count: countRows(course, start + 1, end, 1) }));
        });
      } else {
        const info = usedInfo(course);
        pushChunks([[info.startRow, info.endRow]], course.kind === 'groupChunk');
      }

      result.sort((a, b) => a.startRow - b.startRow);
      result.forEach((item, index) => item.id = `${course.id}-${String(index + 1).padStart(3, '0')}`);
      return result;
    }

    async function ensureCourseLessons(course) {
      if (course._lessonsReady) return course.lessons || [];
      await queryCourse(course);
      course.lessons = deriveLessons(course);
      course._lessonsReady = true;
      courseById.set(course.id, course);
      return course.lessons;
    }

    function fieldValue(course, row, spec) {
      const source = Array.isArray(spec[0]) ? spec[0] : [spec[0]];
      return source.map(col => rowValue(course, row, col)).filter(Boolean).join('\n');
    }
    function makeCard(lesson, row, faces, index) {
      const cleanFaces = faces.filter(face => clean(face.text)).slice(0, 5).map(face => ({ label: clean(face.label), text: clean(face.text) }));
      if (!cleanFaces.length) return null;
      return {
        id: `${lesson.id}-${row}-${index}`, no: index, faces: cleanFaces,
        front: cleanFaces[0].text, meaning_vi: cleanFaces[1]?.text || '', reading: '', han_viet: '', years: '',
        sourceRow: row, sourceSheet: lesson.sheet
      };
    }

    function parseRowCards(course, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const primary = rowValue(course, row, lesson.primaryCol);
        if (!primary && lesson.mergeContinuation && cards.length) {
          const previous = cards.at(-1);
          (lesson.fields || []).forEach((spec, index) => {
            const addition = fieldValue(course, row, spec);
            if (addition && previous.faces[index]) previous.faces[index].text += '\n' + addition;
          });
          continue;
        }
        if (!primary) continue;
        const faces = (lesson.fields || []).map(spec => ({ label: spec[1], text: fieldValue(course, row, spec) }));
        const card = makeCard(lesson, row, faces, cards.length + 1);
        if (card) cards.push(card);
      }
      return cards;
    }

    function parsePresentation(course, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const value = rowValue(course, row, 2);
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

    function parseMailTemplates(course, lesson) {
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
        const title = rowValue(course, row, 6);
        const body = [11, 12, 13, 14].map(col => rowValue(course, row, col)).filter(Boolean).join(' ');
        if (title) { flush(); active = { row, title, body: body ? [body] : [] }; }
        else if (active && body) active.body.push(body);
      }
      flush();
      return cards;
    }

    function parseBlock(course, lesson) {
      const title = rowValue(course, lesson.startRow, 1) || lesson.title;
      const body = [];
      for (let row = lesson.startRow + 1; row <= lesson.endRow; row++) {
        const value = rowValue(course, row, 1);
        if (value) body.push(value);
      }
      const card = makeCard(lesson, lesson.startRow, [
        { label: 'Tiêu đề', text: title },
        { label: 'Nội dung email', text: body.join('\n') }
      ], 1);
      return card ? [card] : [];
    }

    function parseContextRows(course, lesson) {
      const cards = [];
      for (let row = lesson.startRow; row <= lesson.endRow; row++) {
        const value = rowValue(course, row, 1);
        if (!value) continue;
        const card = makeCard(lesson, row, [
          { label: 'Câu đệm', text: value.replace(/^➤\s*/, '') },
          { label: 'Mục đích', text: lesson.context || lesson.title }
        ], cards.length + 1);
        if (card) cards.push(card);
      }
      return cards;
    }

    async function loadLessonCards(lesson) {
      const course = courseById.get(lesson.courseId);
      if (!course) throw new Error('Không tìm thấy sheet cho bài học.');
      await queryCourse(course);
      if (lesson.parser === 'presentation') return parsePresentation(course, lesson);
      if (lesson.parser === 'mailTemplates') return parseMailTemplates(course, lesson);
      if (lesson.parser === 'block') return parseBlock(course, lesson);
      if (lesson.parser === 'contextRows') return parseContextRows(course, lesson);
      return parseRowCards(course, lesson);
    }

    const oldSelectLesson = window.selectLesson;
    window.selectLesson = async function sheetLibrarySelectLesson(id) {
      const selected = (st.lessons || []).find(item => item.id === id);
      if (!selected || selected.source !== 'google-sheet') return oldSelectLesson?.(id);
      try {
        st.lesson = selected;
        document.body.classList.remove('library-open');
        document.querySelectorAll('.lesson-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lessonId === id));
        if (e.front) e.front.textContent = 'Đang tải Google Sheets…';
        if (e.sub) e.sub.textContent = selected.title;
        st.cards = await loadLessonCards(selected);
        st.cards.forEach((card, index) => card.no = index + 1);
        e.from.value = 1;
        e.to.value = st.cards.length;
        if (e.meta) e.meta.textContent = `${selected.title} · ${st.cards.length} thẻ`;
        st.session = [];
        st.i = 0;
        st.face = 0;
        st.done = false;
        st.multiFaceMode = true;
        loadProgress?.();
        saveLast?.();
        render();
        log?.(`Đã tải ${selected.title}: ${st.cards.length} thẻ từ Google Sheets.`);
      } catch (error) {
        err?.(error);
        if (e.front) e.front.textContent = 'Không tải được Google Sheets';
        if (e.sub) e.sub.textContent = error.message;
      }
    };

    function renderFace() {
      const card = st.session?.[st.i];
      const faces = card?.faces;
      if (!faces?.length) {
        st.multiFaceMode = false;
        e.card?.classList.remove('fc-multiface', 'fc-long-face');
        return;
      }
      st.multiFaceMode = true;
      st.face = Math.max(0, Math.min(st.face, faces.length - 1));
      const face = faces[st.face];
      const long = face.text.length > 90 || face.text.split('\n').length > 3;
      e.card?.classList.add('fc-multiface');
      e.card?.classList.toggle('fc-long-face', long);
      if (long) {
        e.front.textContent = face.label || `Mặt ${st.face + 1}`;
        e.sub.textContent = face.text;
      } else {
        e.front.textContent = face.text;
        e.sub.textContent = face.label || '';
      }
      if (e.hint) e.hint.textContent = `Mặt ${st.face + 1}/${faces.length} · ${face.label || 'Nội dung'}`;
      const meta = $('#cardMeta');
      if (meta) meta.textContent = `Mặt ${st.face + 1}/${faces.length} · ${card.sourceSheet || st.lesson?.courseTitle || ''}`;
    }

    const oldRender = window.render;
    if (typeof oldRender === 'function' && !oldRender.__multiFaceWrapped) {
      window.render = function multiFaceRender() {
        oldRender();
        renderFace();
      };
      window.render.__multiFaceWrapped = true;
    }

    const oldFlip = window.flip;
    window.flip = function multiFaceFlip() {
      const card = st.session?.[st.i];
      if (!card?.faces?.length) return oldFlip?.();
      st.face = (st.face + 1) % card.faces.length;
      render();
    };
    if (e.flip) e.flip.onclick = window.flip;
    if (e.card) e.card.onclick = window.flip;

    window.loadSheetLibraryConfig = loadConfig;
    window.ensureSheetCourseLessons = ensureCourseLessons;
    window.getSheetLibraryCourse = id => courseById.get(id);
    window.getCurrentFaceCount = () => st.session?.[st.i]?.faces?.length || 2;
    loadConfig().catch(error => err?.(error));
  } catch (error) {
    try { console.warn('[sheet-library disabled]', error); } catch (_) {}
  }
})();
