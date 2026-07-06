// Align manual corrections with compact JSON indexes and remove OCR fragments from study faces.
(() => {
  try {
    if (window.__flashcardBookCorrectionHotfixLoaded) return;
    window.__flashcardBookCorrectionHotfixLoaded = true;

    const RESTORE_IDS = new Set([
      'soumatome-n2-kanji-w01-d04-004',
      'soumatome-n2-kanji-w01-d04-011',
      'soumatome-n2-kanji-w01-d06-005',
      'soumatome-n2-kanji-w01-d06-009',
      'soumatome-n2-kanji-w01-d06-011'
    ]);
    const PATCHES = {
      'soumatome-n2-kanji-w01-d01-001': { front: '禁', reading: 'キン', vocabulary: '禁止', meaning_en: 'prohibition', meaning_vi: 'sự cấm đoán; cấm' },
      'soumatome-n2-kanji-w01-d01-002': { front: '煙', reading: 'エン・けむり', vocabulary: '禁煙・煙', meaning_en: 'no smoking; smoke', meaning_vi: 'cấm hút thuốc; khói' },
      'soumatome-n2-kanji-w01-d01-003': { front: '静', reading: 'セイ・しずか・しずまる', vocabulary: '安静・静か・静まる', meaning_en: 'quiet; become quiet', meaning_vi: 'yên tĩnh; trở nên yên tĩnh' },
      'soumatome-n2-kanji-w01-d01-004': { front: '危', reading: 'キ・あぶない・あやうい', vocabulary: '危ない・危うい', meaning_en: 'dangerous; danger', meaning_vi: 'nguy hiểm' },
      'soumatome-n2-kanji-w01-d01-005': { front: '険', reading: 'ケン・けわしい', vocabulary: '危険・険しい', meaning_en: 'danger; steep', meaning_vi: 'nguy hiểm; hiểm trở; dốc' },
      'soumatome-n2-kanji-w01-d01-006': { front: '関', reading: 'カン・かかわる', vocabulary: '関心・関する・関わる', meaning_en: 'interest; relate to; have to do with', meaning_vi: 'sự quan tâm; liên quan đến' },
      'soumatome-n2-kanji-w01-d01-007': { front: '係', reading: 'ケイ・かかり', vocabulary: '関係・係・係員', meaning_en: 'relation; person in charge', meaning_vi: 'mối quan hệ; người phụ trách' },
      'soumatome-n2-kanji-w01-d01-008': { front: '落', reading: 'ラク・おちる・おとす', vocabulary: '転落・落第・落ちる・落とす', meaning_en: 'fall; fail a course; drop', meaning_vi: 'rơi; ngã; trượt môn; làm rơi' },
      'soumatome-n2-kanji-w01-d01-009': { front: '石', reading: 'セキ・シャク・いし', vocabulary: '磁石・落石・石', meaning_en: 'magnet; falling rocks; stone', meaning_vi: 'nam châm; đá rơi; đá' },
      'soumatome-n2-kanji-w01-d01-010': { front: '飛', reading: 'ヒ・とぶ・とばす', vocabulary: '飛行場・飛行機・飛び出す', meaning_en: 'airport; airplane; run out suddenly', meaning_vi: 'sân bay; máy bay; bất ngờ lao ra' },
      'soumatome-n2-kanji-w01-d01-011': { front: '捨', reading: 'シャ・すてる', vocabulary: '四捨五入・捨てる', meaning_en: 'round off; throw away', meaning_vi: 'làm tròn số; vứt bỏ' },
      'soumatome-n2-kanji-w01-d01-012': { front: '補', reading: 'ホ・おぎなう', vocabulary: '補間・補う', meaning_en: 'interpolation; supplement', meaning_vi: 'nội suy; bổ sung; bù đắp' },
      'soumatome-n2-kanji-w01-d01-013': { front: '泳', reading: 'エイ・およぐ', vocabulary: '水泳・泳ぐ', meaning_en: 'swimming; swim', meaning_vi: 'bơi lội; bơi' },
      'soumatome-n2-kanji-w01-d04-003': { front: '精', reading: 'セイ', vocabulary: '精算', meaning_en: 'fare adjustment; settlement', meaning_vi: 'điều chỉnh tiền vé; thanh toán' },
      'soumatome-n2-kanji-w01-d04-009': { front: '号', reading: 'ゴウ', vocabulary: '番号・信号', meaning_en: 'number; signal', meaning_vi: 'số; tín hiệu' },
      'soumatome-n2-kanji-w01-d06-004': { front: '達', reading: 'タツ', vocabulary: '速達・発達・友達', meaning_en: 'special delivery; development; friend', meaning_vi: 'chuyển phát nhanh; phát triển; bạn bè' },
      'soumatome-n2-kanji-w01-d06-006': { front: '初', reading: 'ショ・はじめ・はじめて', vocabulary: '初診・初めて', meaning_en: 'first medical consultation; for the first time', meaning_vi: 'khám lần đầu; lần đầu tiên' },
      'soumatome-n2-kanji-w01-d06-007': { front: '再', reading: 'サイ・ふたたび', vocabulary: '再診・再生・再来年', meaning_en: 'follow-up consultation; regeneration; the year after next', meaning_vi: 'khám lại; tái sinh; năm sau nữa' },
      'soumatome-n2-kanji-w01-d06-008': { front: '療', reading: 'リョウ', vocabulary: '診療・治療・医療', meaning_en: 'medical examination and treatment; medical treatment', meaning_vi: 'khám chữa bệnh; điều trị y tế' },
      'soumatome-n2-kanji-w01-d06-010': { front: '婦', reading: 'フ・ふじん', vocabulary: '産婦人科・主婦・婦人', meaning_en: 'obstetrics and gynecology; housewife; woman', meaning_vi: 'khoa sản phụ; người nội trợ; phụ nữ' }
    };

    function unique(items) {
      return [...new Set(items.filter(Boolean))];
    }
    function cleanVocabulary(value, main) {
      const pieces = String(value || '').replace(/[|,]/g, '・').split(/[；;、・]+/)
        .map(text => text.trim())
        .filter(text => text && /^[々〇ぁ-ヿ㐀-鿿ー〜]+$/.test(text) && text.length <= 18);
      const related = main ? pieces.filter(text => text.includes(main)) : pieces;
      return unique(related.length ? related : pieces).slice(0, 4).join('・');
    }
    function cleanReading(value) {
      const pieces = String(value || '').replace(/[|,]/g, '・').split(/[；;、・]+/)
        .map(text => text.trim())
        .filter(text => text && /^[ぁ-ヿー]+$/.test(text) && text.length <= 10);
      return unique(pieces).slice(0, 5).join('・');
    }
    function example(card, week) {
      const term = String(card.vocabulary || card.front || 'この言葉').split('・')[0];
      const rows = {
        1: [`駅で「${term}」という表示を見ました。`, `Tôi đã nhìn thấy biển ghi “${term}” ở nhà ga.`, `I saw a sign saying “${term}” at the station.`],
        2: [`画面で「${term}」を選びました。`, `Tôi đã chọn “${term}” trên màn hình.`, `I selected “${term}” on the screen.`],
        3: [`通知には「${term}」と書かれていました。`, `Trong thông báo có ghi “${term}”.`, `The notice said “${term}”.`],
        4: [`書類で「${term}」という言葉を確認しました。`, `Tôi đã kiểm tra từ “${term}” trong tài liệu.`, `I checked the word “${term}” in the document.`],
        5: [`説明書で「${term}」を確認しました。`, `Tôi đã kiểm tra mục “${term}” trong hướng dẫn sử dụng.`, `I checked “${term}” in the instruction manual.`],
        6: [`広告で「${term}」という言葉を見ました。`, `Tôi đã thấy từ “${term}” trong quảng cáo.`, `I saw the word “${term}” in an advertisement.`],
        7: [`案内で「${term}」という言葉を確認しました。`, `Tôi đã kiểm tra từ “${term}” trong phần hướng dẫn.`, `I checked the word “${term}” in the information notice.`],
        8: [`ニュースで「${term}」について知りました。`, `Tôi biết đến “${term}” qua bản tin.`, `I learned about “${term}” from the news.`]
      };
      return rows[week] || [`日常生活で「${term}」という言葉を使います。`, `Trong đời sống hằng ngày có sử dụng từ “${term}”.`, `The word “${term}” is used in daily life.`];
    }

    function install() {
      const study = window.flashcardBookStudy;
      if (!study || study.enrichLesson.__indexHotfixed) return !!study;
      const base = study.enrichLesson;
      study.enrichLesson = async function correctedEnrichLesson(cards, lesson) {
        const originals = new Map((cards || []).map(card => [card.id, {
          front: card.front, reading: card.reading, vocabulary: card.vocabulary,
          meaning_en: card.meaning_en, meaning_vi: card.meaning_vi
        }]));
        const result = await base(cards, lesson);
        (cards || []).forEach(card => {
          if (RESTORE_IDS.has(card.id)) Object.assign(card, originals.get(card.id) || {});
          if (PATCHES[card.id]) Object.assign(card, PATCHES[card.id]);
          card.front = String(card.front || '').trim();
          card.reading = cleanReading(card.reading);
          card.vocabulary = cleanVocabulary(card.vocabulary, card.front);
          const [jp, vi, en] = example(card, Number(lesson?.week || 0));
          card.example_jp = jp;
          card.example_vi = vi;
          card.example_en = en;
          study.rebuildFaces(card);
        });
        try { window.render?.(); window.paintCurrentMultiFace?.(); } catch (_) {}
        return result;
      };
      study.enrichLesson.__indexHotfixed = true;
      return true;
    }

    if (!install()) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (install() || attempts > 400) clearInterval(timer);
      }, 25);
    }
  } catch (error) {
    try { console.warn('[book-correction-hotfix disabled]', error); } catch (_) {}
  }
})();