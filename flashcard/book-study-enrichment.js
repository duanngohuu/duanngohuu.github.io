// Bilingual textbook study mode: cleaned text, JP–VI / JP–EN and example faces.
(() => {
  try {
    if (window.__flashcardBookStudyLoaded) return;
    window.__flashcardBookStudyLoaded = true;

    const MODE_KEY = 'fc_soumatome_language_mode_v1';
    const VI_CACHE_KEY = 'fc_soumatome_vi_cache_v1';
    const state = { mode: localStorage.getItem(MODE_KEY) === 'en' ? 'en' : 'vi', translating: false, lessonId: '' };
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

    const CORRECTIONS = {
      'soumatome-n2-kanji-w01-d01-004': { front: '危', reading: 'キ・あぶない・あやうい', vocabulary: '危険・危ない・危うい', meaning_en: 'danger; dangerous' },
      'soumatome-n2-kanji-w01-d01-009': { front: '石', reading: 'セキ・シャク・いし', vocabulary: '磁石・落石・石', meaning_en: 'magnet; falling rocks; stone' },
      'soumatome-n2-kanji-w01-d01-010': { front: '飛', reading: 'ヒ・とぶ・とばす', vocabulary: '飛行場・飛行機・飛び出す', meaning_en: 'airport; airplane; run out suddenly' },
      'soumatome-n2-kanji-w01-d01-012': { front: '捨', reading: 'シャ・すてる', vocabulary: '四捨五入・捨てる', meaning_en: 'round off; throw away' },
      'soumatome-n2-kanji-w01-d01-014': { front: '泳', reading: 'エイ・およぐ', vocabulary: '水泳・泳ぐ', meaning_en: 'swimming; swim' },
      'soumatome-n2-kanji-w01-d04-004': { front: '精', reading: 'セイ', vocabulary: '精算', meaning_en: 'fare adjustment; settlement' },
      'soumatome-n2-kanji-w01-d04-011': { front: '号', reading: 'ゴウ', vocabulary: '番号・信号', meaning_en: 'number; signal' },
      'soumatome-n2-kanji-w01-d05-003': { front: '優', reading: 'ユウ・やさしい・すぐれる', vocabulary: '優先席・優れる・優しい', meaning_en: 'priority seat; excel; kind' },
      'soumatome-n2-kanji-w01-d05-004': { front: '席', reading: 'セキ', vocabulary: '座席・出席', meaning_en: 'seat; attendance' },
      'soumatome-n2-kanji-w01-d06-001': { front: '郵', reading: 'ユウ', vocabulary: '郵便・郵送', meaning_en: 'mail; sending by post' },
      'soumatome-n2-kanji-w01-d06-005': { front: '達', reading: 'タツ', vocabulary: '速達・発達・友達', meaning_en: 'special delivery; development; friend' },
      'soumatome-n2-kanji-w01-d06-007': { front: '初', reading: 'ショ・はじめ・はじめて', vocabulary: '初診・初めて', meaning_en: 'first medical consultation; for the first time' },
      'soumatome-n2-kanji-w01-d06-008': { front: '再', reading: 'サイ・ふたたび', vocabulary: '再診・再生・再来年', meaning_en: 'follow-up consultation; regeneration; the year after next' },
      'soumatome-n2-kanji-w01-d06-009': { front: '療', reading: 'リョウ', vocabulary: '診療・治療・医療', meaning_en: 'medical examination and treatment; medical treatment' },
      'soumatome-n2-kanji-w01-d06-011': { front: '婦', reading: 'フ・ふじん', vocabulary: '産婦人科・主婦・婦人', meaning_en: 'obstetrics and gynecology; housewife; woman' },
      'soumatome-n2-kanji-w02-d03-010': { front: '児', reading: 'ジ・ニ', vocabulary: '小児科・幼児', meaning_en: 'pediatrics; infant' },
      'soumatome-n2-kanji-w03-d04-002': { front: '袋', reading: 'タイ・ふくろ', vocabulary: '袋・手袋・レジ袋', meaning_en: 'bag; glove; plastic shopping bag' },
      'soumatome-n2-kanji-w04-d01-006': { front: '希', reading: 'キ', vocabulary: '希望', meaning_en: 'hope; wish' },
      'soumatome-n2-kanji-w04-d05-011': { front: '囲', reading: 'イ・かこむ', vocabulary: '周囲・囲む', meaning_en: 'surroundings; surround' }
    };

    const VI_GLOSSARY = {
      'prohibition': 'sự cấm đoán; cấm', 'no smoking': 'cấm hút thuốc', 'smoke': 'khói; hút thuốc', 'quiet': 'yên tĩnh',
      'danger': 'nguy hiểm', 'dangerous': 'nguy hiểm', 'interest': 'sự quan tâm', 'relation': 'mối quan hệ',
      'connection': 'sự kết nối; mối liên hệ', 'person in charge': 'người phụ trách', 'falling rocks': 'đá rơi',
      'stone': 'đá', 'magnet': 'nam châm', 'airport': 'sân bay', 'airplane': 'máy bay', 'throw away': 'vứt bỏ',
      'swimming': 'bơi lội', 'swim': 'bơi', 'emergency exit': 'lối thoát hiểm', 'restroom': 'nhà vệ sinh',
      'public': 'công cộng', 'usual': 'thông thường', 'everyday': 'hằng ngày', 'examination': 'kỳ thi',
      'reception': 'quầy tiếp nhận', 'vicinity': 'khu vực lân cận', 'information': 'thông tin', 'proposal': 'đề xuất',
      'inside': 'bên trong', 'within': 'trong phạm vi', 'meeting room': 'phòng họp', 'discussion': 'thảo luận',
      'culture': 'văn hóa', 'chemistry': 'hóa học', 'toilet': 'nhà vệ sinh', 'floor': 'tầng', 'means': 'phương tiện; cách thức',
      'business': 'kinh doanh', 'broadcast': 'phát sóng', 'opening': 'mở cửa; khai trương', 'push': 'ấn; đẩy',
      'preparation': 'chuẩn bị', 'standard': 'tiêu chuẩn', 'equipment': 'thiết bị', 'capacity': 'sức chứa',
      'holiday': 'ngày nghỉ', 'set meal': 'suất ăn theo phần', 'ruler': 'thước', 'subway': 'tàu điện ngầm',
      'private railway': 'đường sắt tư nhân', 'ticket': 'vé', 'fare adjustment': 'điều chỉnh tiền vé',
      'calculation': 'tính toán', 'addition': 'phép cộng', 'subtraction': 'phép trừ', 'amendment': 'sửa đổi',
      'railway track': 'đường ray', 'bullet train': 'tàu cao tốc Shinkansen', 'time': 'thời gian', 'timetable': 'thời gian biểu',
      'number': 'số; số hiệu', 'signal': 'tín hiệu', 'high speed': 'tốc độ cao', 'fast': 'nhanh', 'road': 'đường',
      'discount': 'giảm giá', 'increase': 'sự tăng lên', 'priority seat': 'ghế ưu tiên', 'seat': 'ghế; chỗ ngồi',
      'attendance': 'sự có mặt; tham dự', 'both sides': 'cả hai phía', 'donation': 'quyên góp', 'post office': 'bưu điện',
      'drugstore': 'nhà thuốc', 'parcel': 'bưu kiện', 'special delivery': 'chuyển phát nhanh', 'international': 'quốc tế',
      'actually': 'thực tế; thực ra', 'first medical consultation': 'khám lần đầu', 'follow-up consultation': 'khám lại',
      'medical treatment': 'điều trị y tế', 'surgery department': 'khoa ngoại', 'internal medicine': 'khoa nội',
      'obstetrics and gynecology': 'khoa sản phụ', 'housewife': 'người nội trợ', 'woman': 'phụ nữ', 'skin': 'da',
      'rescue': 'cứu hộ; cứu giúp', 'ordinary': 'thông thường', 'commuter ticket': 'vé định kỳ', 'passport': 'hộ chiếu',
      'transportation': 'giao thông; vận chuyển', 'round trip': 'khứ hồi', 'one-way ticket': 'vé một chiều',
      'reserved seat': 'ghế đặt trước', 'condition': 'tình trạng; điều kiện', 'operation': 'thao tác; vận hành',
      'cash': 'tiền mặt', 'branch office': 'chi nhánh', 'support': 'hỗ trợ', 'deposit': 'tiền gửi', 'refund': 'hoàn tiền',
      'account balance': 'số dư tài khoản', 'illumination': 'chiếu sáng', 'hard': 'cứng', 'currency': 'tiền tệ',
      'confirmation': 'xác nhận', 'mistake': 'sai sót', 'cancellation': 'hủy bỏ', 'eraser': 'cục tẩy',
      'temperature': 'nhiệt độ', 'thermometer': 'nhiệt kế', 'warm': 'ấm', 'cold': 'lạnh', 'green tea': 'trà xanh',
      'lipstick': 'son môi', 'reply': 'trả lời', 'group': 'nhóm', 'organization': 'tổ chức', 'infant': 'trẻ nhỏ',
      'pediatrics': 'khoa nhi', 'years old': 'tuổi', 'future': 'tương lai', 'unknown': 'chưa biết', 'full': 'đầy; hết chỗ',
      'satisfaction': 'sự hài lòng', 'old person': 'người cao tuổi', 'setting': 'cài đặt', 'design': 'thiết kế',
      'ventilation': 'thông gió', 'direction': 'phương hướng', 'stopping': 'dừng lại', 'power outage': 'mất điện',
      'heating': 'sưởi ấm', 'dehumidification': 'hút ẩm', 'cleaning': 'vệ sinh; dọn dẹp', 'humidity': 'độ ẩm',
      'aim': 'mục tiêu', 'double': 'gấp đôi', 'recording': 'ghi âm; ghi hình', 'volume': 'âm lượng', 'schedule': 'lịch trình',
      'reservation': 'đặt trước', 'approximately': 'khoảng; xấp xỉ', 'promise': 'lời hứa', 'mobile phone': 'điện thoại di động',
      'insurance': 'bảo hiểm', 'message': 'tin nhắn; lời nhắn', 'repayment': 'hoàn trả; trả nợ', 'subject': 'chủ đề; tiêu đề',
      'communication': 'liên lạc; truyền thông', 'confidence': 'sự tự tin', 'inbox': 'hộp thư đến', 'outbox': 'hộp thư đi',
      'conversion': 'chuyển đổi', 'choice': 'lựa chọn', 'decision': 'quyết định', 'registration': 'đăng ký',
      'editing': 'biên tập; chỉnh sửa', 'function': 'chức năng', 'possible': 'có thể', 'ability': 'năng lực',
      'repair': 'sửa chữa', 'completion': 'hoàn thành', 'image': 'hình ảnh', 'document': 'tài liệu', 'classification': 'phân loại',
      'format': 'định dạng', 'preservation': 'lưu giữ; bảo quản', 'survival': 'sự sống còn', 'existence': 'sự tồn tại',
      'printing': 'in ấn', 'enlargement': 'phóng to', 'reduction': 'thu nhỏ', 'receipt': 'biên lai', 'income': 'thu nhập',
      'collection': 'thu gom; tập hợp', 'machine': 'máy móc', 'curve': 'đường cong', 'pollution': 'ô nhiễm',
      'lord': 'lãnh chúa', 'absence': 'vắng mặt', 'clothing': 'quần áo', 'refrigeration': 'bảo quản lạnh',
      'delivery': 'giao hàng', 'teacher in charge': 'giáo viên phụ trách', 'product': 'sản phẩm', 'individual': 'cá nhân',
      'common': 'chung; phổ biến', 'lost property': 'đồ thất lạc', 'experience': 'kinh nghiệm', 'economy': 'kinh tế',
      'accounting': 'kế toán', 'responsibility': 'trách nhiệm', 'burden': 'gánh nặng', 'flammable': 'dễ cháy',
      'bag': 'túi', 'glove': 'găng tay', 'plastic shopping bag': 'túi mua hàng bằng nhựa', 'branch': 'cành cây',
      'leaf': 'lá', 'bury': 'chôn; lấp', 'tableware': 'đồ dùng bàn ăn', 'musical instrument': 'nhạc cụ',
      'noise': 'tiếng ồn', 'magazine': 'tạp chí', 'resources': 'tài nguyên', 'material': 'tài liệu; vật liệu',
      'water outage': 'mất nước', 'management': 'quản lý', 'entry': 'điền thông tin', 'nuisance': 'phiền toái',
      'cooperation': 'hợp tác', 'application': 'đơn đăng ký', 'weekdays': 'ngày thường', 'equality': 'bình đẳng',
      'result': 'kết quả', 'envelope': 'phong bì', 'each': 'mỗi; từng', 'move': 'di chuyển', 'office work': 'công việc văn phòng',
      'renewal': 'gia hạn; cập nhật', 'suburbs': 'ngoại ô', 'field': 'cánh đồng', 'signature': 'chữ ký', 'request': 'yêu cầu',
      'arrival': 'đến nơi', 'hope': 'hy vọng', 'family name': 'họ', 'age': 'tuổi', 'gender': 'giới tính',
      'marriage': 'kết hôn; hôn nhân', 'invitation': 'lời mời', 'letter': 'thư', 'celebration': 'chúc mừng; lễ mừng',
      'busy': 'bận rộn', 'wife': 'vợ', 'business trip': 'chuyến công tác', 'postscript': 'tái bút', 'habit': 'thói quen',
      'life': 'cuộc sống', 'love': 'tình yêu', 'health': 'sức khỏe', 'prayer': 'lời cầu nguyện', 'happiness': 'hạnh phúc',
      'welfare': 'phúc lợi', 'trust': 'tin tưởng', 'sudden': 'đột ngột', 'chimney': 'ống khói', 'circumstance': 'hoàn cảnh',
      'retirement': 'nghỉ việc; nghỉ hưu', 'occupation': 'nghề nghiệp', 'workplace': 'nơi làm việc', 'introduction': 'giới thiệu',
      'example': 'ví dụ', 'exception': 'ngoại lệ', 'verb': 'động từ', 'adjective': 'tính từ', 'adverb': 'trạng từ',
      'assistant': 'trợ lý', 'earth': 'Trái Đất', 'light bulb': 'bóng đèn', 'peace': 'hòa bình', 'friend': 'bạn bè',
      'warmth': 'độ ấm', 'raw material': 'nguyên liệu', 'cause': 'nguyên nhân', 'device': 'thiết bị', 'bedroom': 'phòng ngủ',
      'heat': 'nhiệt', 'enthusiasm': 'nhiệt tình', 'roast': 'nướng', 'touch': 'chạm; sờ', 'lighthouse': 'hải đăng',
      'oil': 'dầu', 'extra': 'dư; thừa', 'direct': 'trực tiếp', 'indirect': 'gián tiếp', 'interview': 'phỏng vấn',
      'mud': 'bùn', 'yellow': 'màu vàng', 'tools': 'dụng cụ', 'furniture': 'đồ nội thất', 'wall': 'tường',
      'battery': 'pin', 'insecticide': 'thuốc diệt côn trùng', 'dentistry': 'nha khoa', 'prevention': 'phòng ngừa',
      'worry': 'lo lắng', 'white hair': 'tóc bạc', 'bathing': 'tắm', 'purpose': 'mục đích', 'sweat': 'mồ hôi',
      'doctor': 'bác sĩ', 'consultation': 'tư vấn', 'fracture': 'gãy xương', 'boiling water': 'nước sôi', 'powder': 'bột',
      'nutrition': 'dinh dưỡng', 'connection': 'kết nối', 'dictionary': 'từ điển', 'screen': 'màn hình', 'practice': 'thực hành',
      'train': 'tàu', 'price': 'giá', 'average': 'trung bình', 'shoes': 'giày', 'socks': 'tất', 'advertisement': 'quảng cáo',
      'recruitment': 'tuyển dụng', 'free of charge': 'miễn phí', 'exhibition': 'triển lãm', 'bankruptcy': 'phá sản',
      'apartment': 'căn hộ', 'building': 'tòa nhà', 'triangle': 'hình tam giác', 'student': 'học sinh', 'tatami': 'chiếu tatami',
      'square meter': 'mét vuông', 'resolution': 'giải quyết', 'release': 'giải phóng', 'shore': 'bờ biển', 'temple': 'ngôi chùa',
      'island': 'hòn đảo', 'park': 'công viên', 'lake': 'hồ', 'castle': 'lâu đài', 'valley': 'thung lũng',
      'property': 'tài sản', 'sightseeing': 'tham quan', 'audience': 'khán giả', 'jewel': 'đá quý', 'treasure': 'báu vật',
      'painting': 'tranh', 'route': 'lộ trình', 'publication': 'ấn phẩm', 'gardening': 'làm vườn', 'complex': 'phức tạp',
      'weekly': 'hằng tuần', 'monthly': 'hằng tháng', 'upper': 'phía trên', 'lower': 'phía dưới', 'bundle': 'bó; gói',
      'sweet': 'ngọt', 'cotton': 'bông; vải cotton', 'reform': 'cải cách', 'revolution': 'cách mạng', 'pain': 'đau đớn',
      'course': 'khóa học', 'permission': 'sự cho phép', 'salary': 'lương', 'allowance': 'phụ cấp', 'curriculum': 'chương trình học',
      'restriction': 'hạn chế', 'lecture': 'bài giảng', 'advanced level': 'trình độ nâng cao', 'foundation': 'nền tảng',
      'guidance': 'hướng dẫn', 'schoolyard': 'sân trường', 'education': 'giáo dục', 'horse riding': 'cưỡi ngựa',
      'alcohol': 'rượu', 'steam': 'hơi nước', 'dried food': 'đồ khô', 'root': 'rễ', 'roof': 'mái nhà', 'plant': 'thực vật',
      'sugar': 'đường', 'milk': 'sữa', 'carbohydrate': 'chất bột đường', 'fat': 'chất béo', 'graduation': 'tốt nghiệp',
      'achievement': 'thành tích', 'thesis': 'luận văn', 'will': 'ý chí', 'candidate': 'ứng viên', 'delay': 'chậm trễ',
      'temporary': 'tạm thời', 'adoption': 'áp dụng; tuyển dụng', 'traffic information': 'thông tin giao thông',
      'weather': 'thời tiết', 'cloudy': 'nhiều mây', 'snow': 'tuyết', 'wisdom': 'trí tuệ', 'electric current': 'dòng điện',
      'theft': 'trộm cắp', 'escape': 'trốn thoát', 'question': 'nghi vấn; câu hỏi', 'capture': 'bắt giữ', 'absolute': 'tuyệt đối',
      'political party': 'đảng chính trị', 'explosion': 'vụ nổ', 'death': 'cái chết', 'innocent': 'vô tội',
      'typical': 'điển hình', 'trade': 'thương mại', 'agriculture': 'nông nghiệp', 'victim': 'nạn nhân', 'damage': 'thiệt hại',
      'right': 'quyền', 'army': 'quân đội', 'soldier': 'binh sĩ', 'search': 'tìm kiếm', 'bone fracture': 'gãy xương',
      'principle': 'nguyên tắc', 'respect': 'tôn trọng', 'employment': 'việc làm; tuyển dụng', 'dismissal': 'sa thải',
      'conditions': 'điều kiện', 'law': 'pháp luật', 'situation': 'tình hình', 'fear': 'nỗi sợ', 'rough': 'thô; khắc nghiệt',
      'land': 'đất', 'scenery': 'phong cảnh', 'dig': 'đào', 'descendants': 'con cháu', 'daughter': 'con gái',
      'memory': 'ký ức', 'environment': 'môi trường', 'boundary': 'ranh giới', 'decrease': 'giảm', 'effort': 'nỗ lực',
      'government office': 'cơ quan nhà nước', 'director': 'trưởng phòng; giám đốc', 'universe': 'vũ trụ', 'original': 'độc đáo; nguyên bản',
      'technology': 'công nghệ; kỹ thuật', 'politics': 'chính trị', 'physical strength': 'thể lực'
    };

    function readCache() {
      try { return JSON.parse(localStorage.getItem(VI_CACHE_KEY) || '{}') || {}; } catch (_) { return {}; }
    }
    function writeCache(cache) {
      try { localStorage.setItem(VI_CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
    }
    function correctionFor(card) {
      return CORRECTIONS[card.id] || {};
    }
    function cleanJapanese(value) {
      const pieces = clean(value).replace(/[|,]/g, '・').split(/[；;、・]+/).map(item => item.trim()).filter(Boolean);
      const valid = pieces.filter(item => /^[\u3005\u3007\u3040-\u30ff\u3400-\u9fffー〜]+$/.test(item) && item.length <= 18);
      return [...new Set(valid)].slice(0, 4).join('・');
    }
    function cleanReading(value) {
      const pieces = clean(value).replace(/[|,]/g, '・').split(/[；;、・]+/).map(item => item.trim()).filter(Boolean);
      const valid = pieces.filter(item => /^[\u3040-\u30ffー]+$/.test(item) && item.length >= 2 && item.length <= 12);
      return [...new Set(valid)].slice(0, 5).join('・');
    }
    function englishScore(segment) {
      const words = segment.toLowerCase().match(/[a-z]+/g) || [];
      if (!words.length) return -100;
      const longWords = words.filter(word => word.length >= 3).length;
      const tiny = words.filter(word => word.length <= 1).length;
      return longWords * 4 + Math.min(segment.length, 50) / 10 - tiny * 5;
    }
    function cleanEnglish(value) {
      const pieces = clean(value).replace(/[|]/g, ';').split(/[；;]+/).map(item => item.replace(/[^A-Za-z0-9()' /,.&-]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const ranked = pieces.filter(item => /[A-Za-z]{2}/.test(item)).sort((a, b) => englishScore(b) - englishScore(a));
      const selected = [];
      for (const item of ranked) {
        if (englishScore(item) < 2) continue;
        if (!selected.some(old => old.toLowerCase() === item.toLowerCase())) selected.push(item);
        if (selected.length >= 3) break;
      }
      return selected.join('; ') || clean(value);
    }
    function primaryTerm(card) {
      return cleanJapanese(card.vocabulary).split('・').find(Boolean) || clean(card.front) || 'この言葉';
    }
    function localVietnamese(english) {
      const lower = clean(english).toLowerCase();
      const exact = VI_GLOSSARY[lower];
      if (exact) return exact;
      const keys = Object.keys(VI_GLOSSARY).sort((a, b) => b.length - a.length);
      const matches = [];
      for (const key of keys) {
        if (lower.includes(key) && !matches.includes(VI_GLOSSARY[key])) matches.push(VI_GLOSSARY[key]);
        if (matches.length >= 3) break;
      }
      return matches.join('; ');
    }
    function decodeHtml(value) {
      const area = document.createElement('textarea');
      area.innerHTML = value;
      return area.value;
    }
    async function translateVietnamese(english) {
      const source = clean(english);
      if (!source) return '';
      const cache = readCache();
      if (cache[source]) return cache[source];
      const local = localVietnamese(source);
      if (local) {
        cache[source] = local;
        writeCache(cache);
        return local;
      }
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(source.slice(0, 450))}&langpair=en%7Cvi&mt=1`;
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Dịch tự động lỗi ${response.status}`);
      const payload = await response.json();
      const translated = clean(decodeHtml(payload?.responseData?.translatedText || ''));
      if (!translated || translated.toLowerCase() === source.toLowerCase()) return '';
      cache[source] = translated;
      writeCache(cache);
      return translated;
    }
    function exampleFor(card, lesson) {
      const term = primaryTerm(card);
      const week = Number(lesson?.week || 0);
      const templates = {
        1: [`駅で「${term}」という表示を見ました。`, `Tôi đã nhìn thấy biển ghi “${term}” ở nhà ga.`, `I saw a sign saying “${term}” at the station.`],
        2: [`画面で「${term}」を選びました。`, `Tôi đã chọn “${term}” trên màn hình.`, `I selected “${term}” on the screen.`],
        3: [`通知には「${term}」と書かれていました。`, `Trong thông báo có ghi “${term}”.`, `The notice said “${term}”.`],
        4: [`書類で「${term}」という言葉を確認しました。`, `Tôi đã kiểm tra từ “${term}” trong tài liệu.`, `I checked the word “${term}” in the document.`],
        5: [`説明書で「${term}」を確認しました。`, `Tôi đã kiểm tra mục “${term}” trong hướng dẫn sử dụng.`, `I checked “${term}” in the instruction manual.`],
        6: [`広告で「${term}」という言葉を見ました。`, `Tôi đã thấy từ “${term}” trong quảng cáo.`, `I saw the word “${term}” in an advertisement.`],
        7: [`案内で「${term}」という言葉を確認しました。`, `Tôi đã kiểm tra từ “${term}” trong phần hướng dẫn.`, `I checked the word “${term}” in the information notice.`],
        8: [`ニュースで「${term}」について知りました。`, `Tôi biết đến “${term}” qua bản tin.`, `I learned about “${term}” from the news.`]
      };
      return templates[week] || [`日常生活で「${term}」という言葉を使います。`, `Trong đời sống hằng ngày có sử dụng từ “${term}”.`, `The word “${term}” is used in daily life.`];
    }
    function prepareCard(card, lesson) {
      const fix = correctionFor(card);
      card.front = clean(fix.front || card.front);
      card.reading = cleanReading(fix.reading || card.reading);
      card.vocabulary = cleanJapanese(fix.vocabulary || card.vocabulary);
      card.meaning_en = cleanEnglish(fix.meaning_en || card.meaning_en);
      card.meaning_vi = clean(card.meaning_vi) || localVietnamese(card.meaning_en);
      const [exampleJp, exampleVi, exampleEn] = exampleFor(card, lesson);
      card.example_jp = exampleJp;
      card.example_vi = exampleVi;
      card.example_en = exampleEn;
      rebuildFaces(card);
      return card;
    }
    function rebuildFaces(card) {
      const meaning = state.mode === 'vi' ? (card.meaning_vi || 'Đang dịch nghĩa tiếng Việt…') : (card.meaning_en || 'Meaning is being reviewed.');
      const exampleTranslation = state.mode === 'vi' ? card.example_vi : card.example_en;
      card.faces = [
        { label: 'Kanji', text: clean(card.front) },
        { label: 'Cách đọc', text: clean(card.reading) },
        { label: 'Từ vựng', text: clean(card.vocabulary) },
        { label: state.mode === 'vi' ? 'Nghĩa tiếng Việt' : 'English meaning', text: clean(meaning) },
        { label: 'Ví dụ tiếng Nhật', text: clean(card.example_jp) },
        { label: state.mode === 'vi' ? 'Dịch ví dụ' : 'Example translation', text: clean(exampleTranslation) }
      ].filter(face => face.text);
    }
    function syncSessionCard(sourceCard) {
      [window.st?.cards, window.st?.session].forEach(list => (list || []).forEach(card => {
        if (card.id !== sourceCard.id) return;
        Object.assign(card, sourceCard);
        rebuildFaces(card);
      }));
    }
    function repaint() {
      try { window.render?.(); } catch (_) {}
      try { window.paintCurrentMultiFace?.(); } catch (_) {}
    }
    function ensureControls() {
      const host = document.querySelector('.card-options');
      if (!host) return null;
      let controls = document.querySelector('#bookLanguageMode');
      if (!controls) {
        controls = document.createElement('div');
        controls.id = 'bookLanguageMode';
        controls.className = 'book-language-mode hidden';
        controls.innerHTML = '<span>Nghĩa</span><div><button type="button" data-book-lang="vi">JP–VI</button><button type="button" data-book-lang="en">JP–EN</button></div><small id="bookTranslationStatus"></small>';
        host.appendChild(controls);
        controls.addEventListener('click', event => {
          const button = event.target.closest('[data-book-lang]');
          if (!button) return;
          setMode(button.dataset.bookLang);
        });
      }
      controls.classList.toggle('hidden', window.st?.lesson?.source !== 'book-json');
      controls.querySelectorAll('[data-book-lang]').forEach(button => button.classList.toggle('active', button.dataset.bookLang === state.mode));
      return controls;
    }
    function status(text) {
      const node = document.querySelector('#bookTranslationStatus');
      if (node) node.textContent = text || '';
    }
    function setMode(mode) {
      state.mode = mode === 'en' ? 'en' : 'vi';
      localStorage.setItem(MODE_KEY, state.mode);
      [...(window.st?.cards || []), ...(window.st?.session || [])].forEach(rebuildFaces);
      ensureControls();
      repaint();
    }
    async function fillVietnamese(cards, lessonId) {
      if (state.translating) return;
      state.translating = true;
      status('Đang dịch…');
      try {
        for (const card of cards) {
          if (state.lessonId !== lessonId) break;
          if (!card.meaning_vi && card.meaning_en) {
            try {
              card.meaning_vi = await translateVietnamese(card.meaning_en);
              rebuildFaces(card);
              syncSessionCard(card);
              repaint();
            } catch (_) {}
            await sleep(120);
          }
        }
      } finally {
        state.translating = false;
        if (state.lessonId === lessonId) status('');
      }
    }
    async function enrichLesson(cards, lesson) {
      if (!lesson || lesson.source !== 'book-json') {
        ensureControls();
        return cards;
      }
      state.lessonId = lesson.id;
      (cards || []).forEach(card => prepareCard(card, lesson));
      ensureControls();
      repaint();
      fillVietnamese(cards || [], lesson.id);
      return cards;
    }

    window.flashcardBookStudy = { enrichLesson, setMode, state, rebuildFaces };
    ensureControls();
    new MutationObserver(ensureControls).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', event => {
      if (event.target.closest('.book-lesson,.lesson-btn,#startBtn')) setTimeout(ensureControls, 80);
    }, true);
  } catch (error) {
    try { console.warn('[book-study-enrichment disabled]', error); } catch (_) {}
  }
})();