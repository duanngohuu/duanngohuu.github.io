const APP_VERSION = "2026.07.02-gemini-ui";

const STORAGE_KEYS = {
  config: "fc_google_sheet_config_v2",
  progress: "fc_progress_v1",
  theme: "fc_theme_v1",
  raw: "fc_raw_data_v1",
};

const DEFAULT_CONFIG = {
  clientId: "",
  spreadsheetId: "",
  range: "vocab!A1:J",
};

const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

const state = {
  config: { ...DEFAULT_CONFIG },
  tokenClient: null,
  accessToken: "",
  sourceName: "Chưa tải",
  rawCards: [],
  sessionCards: [],
  currentIndex: 0,
  faceIndex: 0,
  knownIds: new Set(),
  againIds: new Set(),
  progress: {},
};

const el = {
  themeToggle: document.querySelector("#themeToggle"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],

  connectGoogleBtn: document.querySelector("#connectGoogleBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  clientIdInput: document.querySelector("#clientIdInput"),
  spreadsheetIdInput: document.querySelector("#spreadsheetIdInput"),
  rangeInput: document.querySelector("#rangeInput"),
  saveConfigBtn: document.querySelector("#saveConfigBtn"),
  loadSheetBtn: document.querySelector("#loadSheetBtn"),

  sourceStatus: document.querySelector("#sourceStatus"),
  authStatus: document.querySelector("#authStatus"),
  dataStatus: document.querySelector("#dataStatus"),
  filteredStatus: document.querySelector("#filteredStatus"),

  rawFormatSelect: document.querySelector("#rawFormatSelect"),
  rawInput: document.querySelector("#rawInput"),
  loadRawSampleBtn: document.querySelector("#loadRawSampleBtn"),
  convertRawBtn: document.querySelector("#convertRawBtn"),
  exportCardsBtn: document.querySelector("#exportCardsBtn"),
  clearRawBtn: document.querySelector("#clearRawBtn"),

  deckSelect: document.querySelector("#deckSelect"),
  tagSelect: document.querySelector("#tagSelect"),
  searchInput: document.querySelector("#searchInput"),
  fromInput: document.querySelector("#fromInput"),
  toInput: document.querySelector("#toInput"),
  limitSelect: document.querySelector("#limitSelect"),
  shuffleInput: document.querySelector("#shuffleInput"),
  startBtn: document.querySelector("#startBtn"),

  studyPanel: document.querySelector("#studyPanel"),
  sessionTitle: document.querySelector("#sessionTitle"),
  positionText: document.querySelector("#positionText"),
  knownText: document.querySelector("#knownText"),
  againText: document.querySelector("#againText"),
  progressBar: document.querySelector("#progressBar"),
  card: document.querySelector("#card"),
  cardDeck: document.querySelector("#cardDeck"),
  cardFront: document.querySelector("#cardFront"),
  cardSub: document.querySelector("#cardSub"),
  cardHint: document.querySelector("#cardHint"),
  prevBtn: document.querySelector("#prevBtn"),
  flipBtn: document.querySelector("#flipBtn"),
  againBtn: document.querySelector("#againBtn"),
  knownBtn: document.querySelector("#knownBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  reviewAgainBtn: document.querySelector("#reviewAgainBtn"),
  resetProgressBtn: document.querySelector("#resetProgressBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  clearLogBtn: document.querySelector("#clearLogBtn"),
  logBox: document.querySelector("#logBox"),
};

function boot() {
  loadConfig();
  loadTheme();
  loadProgress();
  loadRawDraft();
  bindEvents();
  setControlsEnabled(false);
  renderSelects();
  renderCard();
  updateStatus();
  log(`Ready v${APP_VERSION}. Dùng Google Sheet, Raw Data hoặc data mẫu.`);
}

function bindEvents() {
  el.themeToggle.addEventListener("click", toggleTheme);

  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  el.saveConfigBtn.addEventListener("click", saveConfigFromForm);
  el.connectGoogleBtn.addEventListener("click", connectGoogle);
  el.loadSheetBtn.addEventListener("click", loadSheetFromGoogle);
  el.loadSampleBtn.addEventListener("click", loadSampleData);

  el.loadRawSampleBtn.addEventListener("click", loadRawSample);
  el.convertRawBtn.addEventListener("click", convertRawData);
  el.exportCardsBtn.addEventListener("click", exportCurrentDeck);
  el.clearRawBtn.addEventListener("click", clearRawData);
  el.rawInput.addEventListener("input", () => localStorage.setItem(STORAGE_KEYS.raw, el.rawInput.value));

  el.startBtn.addEventListener("click", startSession);
  el.card.addEventListener("click", flipCard);
  el.flipBtn.addEventListener("click", flipCard);
  el.prevBtn.addEventListener("click", prevCard);
  el.nextBtn.addEventListener("click", nextCard);
  el.knownBtn.addEventListener("click", () => markCard("known"));
  el.againBtn.addEventListener("click", () => markCard("again"));
  el.reviewAgainBtn.addEventListener("click", reviewAgainCards);
  el.resetProgressBtn.addEventListener("click", resetProgress);
  el.exportBtn.addEventListener("click", exportProgress);
  el.clearLogBtn.addEventListener("click", () => (el.logBox.textContent = ""));

  [el.deckSelect, el.tagSelect, el.searchInput, el.fromInput, el.toInput, el.limitSelect, el.shuffleInput]
    .forEach((node) => node.addEventListener("change", updateFilteredCount));

  el.searchInput.addEventListener("input", updateFilteredCount);

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, select, textarea")) return;
    if (!state.sessionCards.length) return;

    if (event.code === "Space") {
      event.preventDefault();
      flipCard();
    }
    if (event.key === "ArrowRight") nextCard();
    if (event.key === "ArrowLeft") prevCard();
    if (event.key.toLowerCase() === "k") markCard("known");
    if (event.key.toLowerCase() === "a") markCard("again");
  });
}

function switchTab(tabName) {
  el.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  el.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === tabName));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function loadConfig() {
  try {
    state.config = { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || "{}") };
  } catch {
    state.config = { ...DEFAULT_CONFIG };
  }

  el.clientIdInput.value = state.config.clientId || "";
  el.spreadsheetIdInput.value = state.config.spreadsheetId || "";
  el.rangeInput.value = state.config.range || DEFAULT_CONFIG.range;
}

function saveConfigFromForm() {
  const rawSheetValue = el.spreadsheetIdInput.value.trim();
  const spreadsheetId = extractSpreadsheetId(rawSheetValue);

  state.config = {
    clientId: el.clientIdInput.value.trim(),
    spreadsheetId,
    range: el.rangeInput.value.trim() || DEFAULT_CONFIG.range,
  };

  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
  el.spreadsheetIdInput.value = spreadsheetId;
  state.tokenClient = null;
  state.accessToken = "";
  el.authStatus.textContent = "Đã lưu";
  updateStatus();
  log("Đã lưu cấu hình Google Sheet.");
}

function extractSpreadsheetId(value) {
  const input = String(value || "").trim();
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input;
}

function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.theme);
  const isDark = theme === "dark" || (!theme && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(STORAGE_KEYS.theme, isDark ? "dark" : "light");
}

function loadProgress() {
  try {
    state.progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || "{}");
  } catch {
    state.progress = {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(state.progress));
}

function loadRawDraft() {
  el.rawInput.value = localStorage.getItem(STORAGE_KEYS.raw) || "";
}

function initTokenClient() {
  saveConfigFromForm();

  if (!state.config.clientId) throw new Error("Thiếu Google OAuth Client ID.");
  if (!window.google?.accounts?.oauth2) throw new Error("Google Identity Services chưa load xong. Thử lại sau vài giây.");

  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.clientId,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        log(`OAuth lỗi: ${tokenResponse.error}`);
        return;
      }

      state.accessToken = tokenResponse.access_token;
      el.authStatus.textContent = "Đã kết nối";
      updateStatus();
      log("Đã nhận access token readonly cho Google Sheets.");
      loadSheetFromGoogle();
    },
  });
}

function connectGoogle() {
  try {
    if (!state.tokenClient) initTokenClient();
    state.tokenClient.requestAccessToken({ prompt: state.accessToken ? "" : "consent" });
  } catch (error) {
    logError(error);
  }
}

async function loadSheetFromGoogle() {
  try {
    saveConfigFromForm();

    if (!state.config.spreadsheetId) throw new Error("Thiếu Spreadsheet ID hoặc Google Sheet URL.");

    if (!state.accessToken) {
      if (!state.tokenClient) initTokenClient();
      state.tokenClient.requestAccessToken({ prompt: "consent" });
      return;
    }

    const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(state.config.spreadsheetId)}/values/${encodeURIComponent(state.config.range)}`);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${state.accessToken}` },
    });

    if (response.status === 401) {
      state.accessToken = "";
      el.authStatus.textContent = "Token hết hạn";
      updateStatus();
      log("Access token hết hạn. Bấm Kết nối Google lại.");
      return;
    }

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Không tải được Google Sheet: HTTP ${response.status} ${message}`);
    }

    const payload = await response.json();
    const cards = rowsToCards(payload.values || []);
    setCards(cards, `Google Sheet · ${state.config.range}`);
    switchTab("study");
  } catch (error) {
    logError(error);
  }
}

async function loadSampleData() {
  try {
    const response = await fetch("./sample-data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được sample-data.json");
    const cards = await response.json();
    setCards(normalizeCards(cards), "Data mẫu");
    switchTab("study");
  } catch (error) {
    logError(error);
  }
}

function loadRawSample() {
  el.rawFormatSelect.value = "csv";
  el.rawInput.value = `id,deck,front,reading,meaning_vi,meaning_jp,example_jp,example_vi,tags,note\n1,Business Japanese,確認,かくにん,"xác nhận","内容や状態をたしかめること","資料の内容をご確認いただけますでしょうか。","Anh/chị có thể xác nhận nội dung tài liệu giúp tôi được không?","business,mail,n2","ご確認ください = lịch sự"\n2,IT Japanese,切り分け,きりわけ,"khoanh vùng nguyên nhân","原因や責任範囲を分けて確認すること","まずフロント側とバックエンド側で原因を切り分けます。","Trước hết khoanh vùng nguyên nhân giữa frontend và backend.","it,troubleshooting","障害対応で hay dùng"`;
  localStorage.setItem(STORAGE_KEYS.raw, el.rawInput.value);
  log("Đã đổ raw mẫu. Bấm Convert & dùng raw để học.");
}

function convertRawData() {
  try {
    const text = el.rawInput.value.trim();
    if (!text) throw new Error("Raw data đang trống.");

    const format = el.rawFormatSelect.value;
    const cards = parseRawData(text, format);
    setCards(cards, `Raw Data · ${detectFormatLabel(text, format)}`);
    localStorage.setItem(STORAGE_KEYS.raw, el.rawInput.value);
    switchTab("study");
  } catch (error) {
    logError(error);
  }
}

function clearRawData() {
  if (!confirm("Xóa raw đang paste trên trình duyệt này?")) return;
  el.rawInput.value = "";
  localStorage.removeItem(STORAGE_KEYS.raw);
  log("Đã xóa raw draft.");
}

function parseRawData(text, requestedFormat) {
  const format = detectFormat(text, requestedFormat);

  if (format === "json") {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      if (Array.isArray(parsed[0])) return rowsToCards(parsed);
      return normalizeCards(parsed);
    }
    if (Array.isArray(parsed.cards)) return normalizeCards(parsed.cards);
    if (Array.isArray(parsed.values)) return rowsToCards(parsed.values);
    throw new Error("JSON cần là array card, array rows, { cards: [...] } hoặc { values: [...] }.");
  }

  if (format === "csv" || format === "tsv") {
    const delimiter = format === "tsv" ? "\t" : ",";
    return rowsToCards(parseDelimited(text, delimiter));
  }

  return parsePlainLines(text);
}

function detectFormat(text, requestedFormat) {
  if (requestedFormat && requestedFormat !== "auto") return requestedFormat;
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  const firstLine = trimmed.split(/\r?\n/).find(Boolean) || "";
  if (firstLine.includes("\t")) return "tsv";
  if (looksLikeHeader(firstLine) && firstLine.includes(",")) return "csv";
  if (firstLine.includes("|")) return "plain";
  return "csv";
}

function detectFormatLabel(text, requestedFormat) {
  return detectFormat(text, requestedFormat).toUpperCase();
}

function looksLikeHeader(line) {
  const lowered = line.toLowerCase();
  return ["front", "word", "meaning", "meaning_vi", "example", "deck", "reading"].some((key) => lowered.includes(key));
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function parsePlainLines(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const cards = lines.map((line, index) => {
    const parts = line.includes("\t") ? line.split("\t") : line.split("|");
    const [front, reading, meaningVi, exampleJp, exampleVi, tags, deck, note] = parts.map((part) => String(part || "").trim());

    return {
      id: `${index + 1}`,
      deck: deck || "Raw Data",
      front,
      reading,
      meaning_vi: meaningVi,
      meaning_jp: "",
      example_jp: exampleJp,
      example_vi: exampleVi,
      tags: splitTags(tags || "raw"),
      note: note || "",
      rowNumber: index + 1,
    };
  });

  return normalizeCards(cards);
}

function rowsToCards(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map((h) => normalizeHeader(h));
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));

  const cards = dataRows.map((row, index) => {
    const item = {};
    headers.forEach((header, columnIndex) => {
      item[header] = String(row[columnIndex] ?? "").trim();
    });

    return mapItemToCard(item, index, index + 2);
  });

  return normalizeCards(cards);
}

function mapItemToCard(item, index, rowNumber) {
  return {
    id: pick(item, ["id", "no", "number"]) || `${index + 1}`,
    deck: pick(item, ["deck", "category", "source", "nhom", "group"]) || "Default",
    front: pick(item, ["front", "word", "pattern", "term", "jp", "japanese", "cau", "tu"]) || "",
    reading: pick(item, ["reading", "kana", "furigana", "yomikata"]) || "",
    meaning_vi: pick(item, ["meaning_vi", "vi", "meaning", "vietnamese", "nghia_vi", "nghia"]) || "",
    meaning_jp: pick(item, ["meaning_jp", "jp_meaning", "definition_jp", "japanese_meaning"]) || "",
    example_jp: pick(item, ["example_jp", "jp_example", "example", "sentence_jp", "reibun"]) || "",
    example_vi: pick(item, ["example_vi", "vi_example", "sentence_vi", "translation", "dich_vi"]) || "",
    tags: splitTags(pick(item, ["tags", "tag", "labels"]) || ""),
    note: pick(item, ["note", "memo", "comment", "ghi_chu"]) || "",
    rowNumber,
  };
}

function pick(object, keys) {
  for (const key of keys) {
    if (object[key] !== undefined && object[key] !== null && String(object[key]).trim() !== "") {
      return String(object[key]).trim();
    }
  }
  return "";
}

function normalizeHeader(header) {
  return removeVietnameseAccents(String(header || ""))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function removeVietnameseAccents(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

function splitTags(value) {
  if (Array.isArray(value)) return value.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(value || "")
    .split(/[,\n、，|/]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeCards(cards) {
  return cards
    .map((card, index) => ({
      id: String(card.id || index + 1),
      deck: String(card.deck || "Default").trim(),
      front: String(card.front || card.word || card.pattern || "").trim(),
      reading: String(card.reading || "").trim(),
      meaning_vi: String(card.meaning_vi || card.meaning || card.vi || "").trim(),
      meaning_jp: String(card.meaning_jp || "").trim(),
      example_jp: String(card.example_jp || card.example || "").trim(),
      example_vi: String(card.example_vi || card.translation || "").trim(),
      tags: splitTags(card.tags || ""),
      note: String(card.note || "").trim(),
      rowNumber: Number(card.rowNumber || index + 1),
    }))
    .filter((card) => card.front || card.meaning_vi || card.example_jp);
}

function setCards(cards, sourceName) {
  state.rawCards = cards;
  state.sourceName = sourceName;
  state.sessionCards = [];
  state.currentIndex = 0;
  state.faceIndex = 0;
  state.knownIds = new Set();
  state.againIds = new Set();

  renderSelects();
  updateFilteredCount();
  setControlsEnabled(cards.length > 0);
  updateStatus();
  renderCard();
  log(`Đã tải ${cards.length} thẻ từ ${sourceName}.`);
}

function setControlsEnabled(enabled) {
  [el.deckSelect, el.tagSelect, el.searchInput, el.fromInput, el.toInput, el.limitSelect, el.shuffleInput, el.startBtn]
    .forEach((node) => (node.disabled = !enabled));
}

function updateStatus() {
  el.sourceStatus.textContent = state.sourceName;
  el.dataStatus.textContent = `${state.rawCards.length} thẻ`;
}

function renderSelects() {
  const decks = unique(state.rawCards.map((card) => card.deck).filter(Boolean));
  const tags = unique(state.rawCards.flatMap((card) => card.tags || []));
  fillSelect(el.deckSelect, decks, "Tất cả deck");
  fillSelect(el.tagSelect, tags, "Tất cả tag");
}

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = allLabel;
  select.appendChild(allOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "ja"));
}

function getFilteredCards() {
  const deck = el.deckSelect.value;
  const tag = el.tagSelect.value;
  const keyword = el.searchInput.value.trim().toLowerCase();
  const from = Math.max(1, Number(el.fromInput.value || 1));
  const to = Math.max(from, Number(el.toInput.value || 999999));

  return state.rawCards.filter((card, index) => {
    const order = index + 1;
    if (order < from || order > to) return false;
    if (deck !== "all" && card.deck !== deck) return false;
    if (tag !== "all" && !(card.tags || []).includes(tag)) return false;
    if (!keyword) return true;

    return [
      card.front,
      card.reading,
      card.meaning_vi,
      card.meaning_jp,
      card.example_jp,
      card.example_vi,
      card.note,
      card.deck,
      ...(card.tags || []),
    ].join(" ").toLowerCase().includes(keyword);
  });
}

function updateFilteredCount() {
  const count = getFilteredCards().length;
  el.filteredStatus.textContent = `${count} thẻ phù hợp`;
  updateStatus();
}

function startSession() {
  let cards = [...getFilteredCards()];

  if (!cards.length) {
    log("Không có thẻ phù hợp filter hiện tại.");
    return;
  }

  if (el.shuffleInput.checked) cards = shuffle(cards);

  const limit = el.limitSelect.value;
  if (limit !== "all") cards = cards.slice(0, Number(limit));

  state.sessionCards = cards;
  state.currentIndex = 0;
  state.faceIndex = 0;
  state.knownIds = new Set();
  state.againIds = new Set();

  el.sessionTitle.textContent = `${cards.length} thẻ đang học`;
  renderCard();
  document.querySelector("#studyPanel")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function reviewAgainCards() {
  const againCards = state.sessionCards.filter((card) => state.againIds.has(card.id));

  if (!againCards.length) {
    log("Chưa có thẻ nào trong nhóm chưa nhớ.");
    return;
  }

  state.sessionCards = againCards;
  state.currentIndex = 0;
  state.faceIndex = 0;
  state.knownIds = new Set();
  state.againIds = new Set();
  el.sessionTitle.textContent = `Ôn lại ${againCards.length} thẻ chưa nhớ`;
  renderCard();
}

function renderCard() {
  const card = state.sessionCards[state.currentIndex];

  if (!card) {
    el.cardDeck.textContent = "";
    el.cardFront.textContent = "Chưa có thẻ";
    el.cardSub.textContent = state.rawCards.length ? "Chọn filter rồi bấm Bắt đầu học." : "Vào Google Sheet hoặc Raw Data để tải deck.";
    el.cardHint.textContent = "Flashcard có 3 mặt: từ → nghĩa → ví dụ.";
    updateStats();
    return;
  }

  const faces = buildFaces(card);
  const face = faces[state.faceIndex % faces.length];

  el.cardDeck.textContent = `${card.deck || "Default"} · mặt ${state.faceIndex + 1}/${faces.length}`;
  el.cardFront.textContent = face.title;
  el.cardSub.textContent = face.body;
  el.cardHint.textContent = face.hint || "Bấm thẻ hoặc Space để lật mặt";
  updateStats();
}

function buildFaces(card) {
  return [
    {
      title: card.front || "(trống)",
      body: [card.reading, card.tags?.length ? `#${card.tags.join(" #")}` : ""].filter(Boolean).join("\n"),
      hint: "Mặt 1: nhìn từ/mẫu câu và tự nhớ nghĩa.",
    },
    {
      title: card.meaning_vi || "Chưa có nghĩa Việt",
      body: [card.meaning_jp, card.note].filter(Boolean).join("\n"),
      hint: "Mặt 2: nghĩa Việt / giải thích Nhật / note.",
    },
    {
      title: card.example_jp || card.front || "Chưa có ví dụ",
      body: card.example_vi || card.note || "",
      hint: "Mặt 3: ví dụ Nhật + dịch Việt.",
    },
  ];
}

function updateStats() {
  const total = state.sessionCards.length;
  const current = total ? state.currentIndex + 1 : 0;
  const percent = total ? Math.round((current / total) * 100) : 0;

  el.positionText.textContent = `${current}/${total}`;
  el.knownText.textContent = `Biết: ${state.knownIds.size}`;
  el.againText.textContent = `Chưa nhớ: ${state.againIds.size}`;
  el.progressBar.style.width = `${percent}%`;

  el.prevBtn.disabled = state.currentIndex <= 0;
  el.nextBtn.disabled = state.currentIndex >= total - 1;
}

function flipCard() {
  if (!state.sessionCards.length) return;
  state.faceIndex = (state.faceIndex + 1) % buildFaces(state.sessionCards[state.currentIndex]).length;
  renderCard();
}

function prevCard() {
  if (state.currentIndex <= 0) return;
  state.currentIndex -= 1;
  state.faceIndex = 0;
  renderCard();
}

function nextCard() {
  if (state.currentIndex >= state.sessionCards.length - 1) {
    log("Đã tới cuối phiên học.");
    return;
  }

  state.currentIndex += 1;
  state.faceIndex = 0;
  renderCard();
}

function markCard(type) {
  const card = state.sessionCards[state.currentIndex];
  if (!card) return;

  if (type === "known") {
    state.knownIds.add(card.id);
    state.againIds.delete(card.id);
  } else {
    state.againIds.add(card.id);
    state.knownIds.delete(card.id);
  }

  state.progress[card.id] = {
    status: type,
    updatedAt: new Date().toISOString(),
    front: card.front,
    deck: card.deck,
    source: state.sourceName,
  };
  saveProgress();
  updateStats();

  if (state.currentIndex < state.sessionCards.length - 1) {
    nextCard();
  } else {
    log(`Hoàn thành phiên: biết ${state.knownIds.size}, chưa nhớ ${state.againIds.size}.`);
  }
}

function resetProgress() {
  if (!confirm("Reset toàn bộ tiến độ lưu trên trình duyệt này?")) return;

  state.progress = {};
  state.knownIds = new Set();
  state.againIds = new Set();
  saveProgress();
  updateStats();
  log("Đã reset tiến độ localStorage.");
}

function exportProgress() {
  downloadJson(`flashcard-progress-${today()}.json`, {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    source: state.sourceName,
    progress: state.progress,
  });
}

function exportCurrentDeck() {
  if (!state.rawCards.length) {
    log("Chưa có deck để export. Hãy tải Google Sheet, raw hoặc data mẫu trước.");
    return;
  }

  downloadJson(`flashcard-deck-${today()}.json`, state.rawCards);
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function log(message) {
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  el.logBox.textContent = `[${time}] ${message}\n${el.logBox.textContent}`.slice(0, 6000);
}

function logError(error) {
  console.error(error);
  log(error?.message || String(error));
}

boot();
