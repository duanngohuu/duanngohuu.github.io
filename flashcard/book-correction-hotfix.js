// Align manual corrections with compact JSON indexes after unpublished OCR rows were removed.
(() => {
  try {
    if (window.__flashcardBookCorrectionHotfixLoaded) return;
    window.__flashcardBookCorrectionHotfixLoaded = true;

    const RESTORE_IDS = new Set([
      'soumatome-n2-kanji-w01-d01-012',
      'soumatome-n2-kanji-w01-d04-004',
      'soumatome-n2-kanji-w01-d04-011',
      'soumatome-n2-kanji-w01-d06-005',
      'soumatome-n2-kanji-w01-d06-009',
      'soumatome-n2-kanji-w01-d06-011'
    ]);
    const PATCHES = {
      'soumatome-n2-kanji-w01-d01-011': { front: '捨', reading: 'シャ・すてる', vocabulary: '四捨五入・捨てる', meaning_en: 'round off; throw away', meaning_vi: 'làm tròn số; vứt bỏ' },
      'soumatome-n2-kanji-w01-d01-013': { front: '泳', reading: 'エイ・およぐ', vocabulary: '水泳・泳ぐ', meaning_en: 'swimming; swim', meaning_vi: 'bơi lội; bơi' },
      'soumatome-n2-kanji-w01-d04-003': { front: '精', reading: 'セイ', vocabulary: '精算', meaning_en: 'fare adjustment; settlement', meaning_vi: 'điều chỉnh tiền vé; thanh toán' },
      'soumatome-n2-kanji-w01-d04-009': { front: '号', reading: 'ゴウ', vocabulary: '番号・信号', meaning_en: 'number; signal', meaning_vi: 'số; tín hiệu' },
      'soumatome-n2-kanji-w01-d06-004': { front: '達', reading: 'タツ', vocabulary: '速達・発達・友達', meaning_en: 'special delivery; development; friend', meaning_vi: 'chuyển phát nhanh; phát triển; bạn bè' },
      'soumatome-n2-kanji-w01-d06-006': { front: '初', reading: 'ショ・はじめ・はじめて', vocabulary: '初診・初めて', meaning_en: 'first medical consultation; for the first time', meaning_vi: 'khám lần đầu; lần đầu tiên' },
      'soumatome-n2-kanji-w01-d06-007': { front: '再', reading: 'サイ・ふたたび', vocabulary: '再診・再生・再来年', meaning_en: 'follow-up consultation; regeneration; the year after next', meaning_vi: 'khám lại; tái sinh; năm sau nữa' },
      'soumatome-n2-kanji-w01-d06-008': { front: '療', reading: 'リョウ', vocabulary: '診療・治療・医療', meaning_en: 'medical examination and treatment; medical treatment', meaning_vi: 'khám chữa bệnh; điều trị y tế' },
      'soumatome-n2-kanji-w01-d06-010': { front: '婦', reading: 'フ・ふじん', vocabulary: '産婦人科・主婦・婦人', meaning_en: 'obstetrics and gynecology; housewife; woman', meaning_vi: 'khoa sản phụ; người nội trợ; phụ nữ' }
    };

    function example(card, week) {
      const term = String(card.vocabulary || card.front || 'この言葉').split('・')[0];
      const rows = {
        1: [`駅で「${term}」という表示を見ました。`, `Tôi đã nhìn thấy biển ghi “${term}” ở nhà ga.`, `I saw a sign saying “${term}” at the station.`]
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
          if (RESTORE_IDS.has(card.id) || PATCHES[card.id]) {
            const [jp, vi, en] = example(card, Number(lesson?.week || 0));
            card.example_jp = jp; card.example_vi = vi; card.example_en = en;
            study.rebuildFaces(card);
          }
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