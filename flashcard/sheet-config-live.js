// Load course/chunk/parser configuration from the public __CONFIG Google Sheet.
(() => {
  try {
    const originalLoadConfig = window.loadSheetLibraryConfig;
    if (typeof originalLoadConfig !== 'function') return;
    const APPROVED = /^OK@(TV|NP|BUN)\s*/i;
    const CONFIG_TIMEOUT = 5500;
    let livePromise = null;
    let lastLiveConfig = null;

    const text = value => String(value ?? '').trim();
    const numberOrBlank = value => {
      const parsed = Number(value);
      return text(value) !== '' && Number.isFinite(parsed) ? parsed : undefined;
    };
    const bool = value => value === true || /^(true|1|yes|on)$/i.test(text(value));
    const jsonValue = (value, fallback = []) => {
      if (!text(value)) return fallback;
      try { return JSON.parse(String(value)); }
      catch (_) { throw new Error(`JSON config không hợp lệ: ${String(value).slice(0, 80)}`); }
    };
    const hashText = value => {
      let hash = 2166136261;
      const source = String(value || '');
      for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16).padStart(8, '0');
    };

    function parseGviz(source) {
      const start = source.indexOf('(');
      const end = source.lastIndexOf(')');
      if (start < 0 || end <= start) throw new Error('Google Sheets trả về config không hợp lệ.');
      const payload = JSON.parse(source.slice(start + 1, end));
      if (payload.status === 'error') throw new Error(payload.errors?.[0]?.detailed_message || 'Không đọc được __CONFIG.');
      const table = payload.table || {};
      const columns = (table.cols || []).map((column, index) => text(column.label || column.id || `col_${index}`));
      return (table.rows || []).map(row => {
        const output = {};
        columns.forEach((column, index) => {
          const cell = row.c?.[index];
          output[column] = cell?.v ?? cell?.f ?? '';
        });
        return output;
      });
    }

    function rowToCourse(row) {
      const sheetName = text(row.sheet_name);
      const match = sheetName.match(APPROVED);
      if (!bool(row.enabled) || !match) return null;
      const group = text(row.group || match[1]).toUpperCase();
      const course = {
        id: text(row.id),
        title: sheetName,
        displayTitle: text(row.display_title || sheetName.replace(APPROVED, '')),
        sheetGroup: group,
        sheetGroupLabel: text(row.group_label || (group === 'TV' ? 'Từ vựng' : group === 'NP' ? 'Ngữ pháp' : 'Văn mẫu')),
        usedRange: text(row.used_range),
        kind: text(row.kind || 'chunk'),
        fields: jsonValue(row.fields_json, []),
        ordinary: jsonValue(row.ordinary_json, []),
        sections: jsonValue(row.sections_json, []),
        titleRows: jsonValue(row.title_rows_json, [])
      };
      const optional = {
        chunkSize: numberOrBlank(row.chunk_size),
        primaryCol: numberOrBlank(row.primary_col),
        groupCol: numberOrBlank(row.group_col),
        parser: text(row.parser) || undefined,
        mergeContinuation: bool(row.merge_continuation),
        warningAfter: numberOrBlank(row.warning_after),
        lessonTitle: text(row.lesson_title) || undefined,
        titleRegex: text(row.title_regex) || undefined
      };
      Object.entries(optional).forEach(([key, value]) => {
        if (value !== undefined && value !== '') course[key] = value;
      });
      if (!course.id || !course.usedRange) return null;
      return course;
    }

    async function fetchLiveConfig(bootstrap) {
      const spreadsheetId = bootstrap.spreadsheetId;
      const configSheet = bootstrap.configSheet || '__CONFIG';
      if (!spreadsheetId) throw new Error('Thiếu spreadsheetId trong bootstrap.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CONFIG_TIMEOUT);
      try {
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${encodeURIComponent(configSheet)}&range=A1:U100&headers=1&tqx=out:json&_=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(`Không tải được ${configSheet}: ${response.status}`);
        const rows = parseGviz(await response.text());
        const courses = rows.map(rowToCourse).filter(Boolean);
        if (!courses.length) throw new Error(`${configSheet} không có course được bật.`);
        const rowVersion = text(rows.find(row => text(row.config_version))?.config_version) || 'config';
        const configHash = hashText(JSON.stringify(rows));
        const config = {
          ...bootstrap,
          version: `${rowVersion}-${configHash}`,
          configVersion: rowVersion,
          configHash,
          configSource: 'google-sheet',
          courses
        };
        lastLiveConfig = config;
        window.__lastLiveSheetConfig = config;
        return config;
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('Google Sheets phản hồi quá chậm.');
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    async function refresh() {
      const bootstrap = await originalLoadConfig();
      const config = await fetchLiveConfig(bootstrap);
      try { await window.flashcardOffline?.putLibrary?.('sheet-manifest', config); } catch (_) {}
      return config;
    }

    window.loadSheetLibraryConfig = function loadLiveSheetConfig() {
      if (!livePromise) livePromise = refresh().catch(error => {
        livePromise = null;
        throw error;
      });
      return livePromise;
    };
    window.refreshSheetLibraryConfig = async function refreshSheetLibraryConfig() {
      livePromise = refresh().catch(error => {
        livePromise = null;
        throw error;
      });
      return livePromise;
    };

    if (window.flashcardOffline?.putLibrary && !window.flashcardOffline.putLibrary.__liveConfigGuard) {
      const originalPut = window.flashcardOffline.putLibrary.bind(window.flashcardOffline);
      const guardedPut = async (key, value) => {
        if (key === 'sheet-manifest' && !value?.courses?.length && (lastLiveConfig || window.__lastLiveSheetConfig)) {
          return originalPut(key, lastLiveConfig || window.__lastLiveSheetConfig);
        }
        return originalPut(key, value);
      };
      guardedPut.__liveConfigGuard = true;
      window.flashcardOffline.putLibrary = guardedPut;
    }

    window.addEventListener('flashcard-connectivity', event => {
      if (event.detail?.online && event.detail?.previous === false) {
        window.refreshSheetLibraryConfig?.().catch(() => {});
      }
    });
  } catch (error) {
    try { console.warn('[sheet-config-live disabled]', error); } catch (_) {}
  }
})();
