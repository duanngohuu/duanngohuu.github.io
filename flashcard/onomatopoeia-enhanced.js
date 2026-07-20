// Enhanced TSV cards: optional usage + examples_json fields become dynamic faces.
(() => {
  const baseParser = window.parseTSV;
  if (typeof baseParser !== 'function') return;

  window.parseTSV = function parseEnhancedTSV(text) {
    const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines.shift().split('\t');
    return lines.map(line => {
      const cells = line.split('\t');
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] || '']));
      let examples = [];
      try { examples = row.examples_json ? JSON.parse(row.examples_json) : []; } catch (_) {}
      const card = {
        front: row.front,
        reading: row.reading,
        meaning_vi: row.meaning_vi,
        han_viet: row.han_viet,
        years: row.years,
        usage: row.usage || '',
        examples
      };
      if (examples.length) {
        card.faces = [
          { label: 'Từ', text: [row.front, row.reading].filter(Boolean).join('\n') },
          { label: 'Nghĩa và sắc thái', text: [row.meaning_vi, row.usage].filter(Boolean).join('\n\n') },
          ...examples.map((example, index) => ({
            label: `Ví dụ ${index + 1}/5 · ${example.context}`,
            text: `${example.jp}\n\n${example.vi}\n\nBối cảnh: ${example.context}`
          }))
        ];
      }
      return card;
    });
  };
})();
