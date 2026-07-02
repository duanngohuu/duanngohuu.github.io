const APP_VERSION = "2026.07.02";
const STORAGE_KEYS = {
  config: "fc_google_sheet_config_v1",
  progress: "fc_progress_v1",
  theme: "fc_theme_v1",
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
  connectGoogleBtn: document.querySelector("#connectGoogleBtn"),
  loadSampleBtn: document.querySelector("#loadSampleBtn"),
  clientIdInput: document.querySelector("#clientIdInput"),
  spreadsheetIdInput: document.querySelector("#spreadsheetIdInput"),
  rangeInput: document.querySelector("#rangeInput"),
  saveConfigBtn: document.querySelector("#saveConfigBtn"),
  loadSheetBtn: document.querySelector("#loadSheetBtn"),
  authStatus: document.querySelector("#authStatus"),
  dataStatus: document.querySelector("#dataStatus"),
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
  bindEvents();
  setControlsEnabled(false);
  renderSelects();
  log(`Ready v${APP_VERSION}. Hãy nhập Client ID + Spreadsheet ID, hoặc dùng data mẫu.`);
}

function bindEvents() {
  el.themeToggle.addEventListener("click", toggleTheme);
  el.saveConfigBtn.addEventListener("click", saveConfigFromForm);
  el.connectGoogleBtn.addEventListener("click", connectGoogle);
  el.loadSheetBtn.addEventListener("click", loadSheetFromGoogle);
  el.loadSampleBtn.addEventListener("click", loadSampleData);
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
    if (!el.studyPanel.classList.contains("active")) return;
    if (event.target.matches("input, select, textarea")) return;

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
  state.config = {
    clientId: el.clientIdInput.value.trim(),
    spreadsheetId: el.spreadsheetIdInput.value.trim(),
    range: el.rangeInput.value.trim() || DEFAULT_CONFIG.range,
  };

  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
  state.tokenClient = null;
  state.accessToken = "";
  el.authStatus.textContent = "Đã lưu cấu hình";
  log("Đã lưu cấu hình Google Sheet.");
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

function initTokenClient() {
  saveConfigFromForm();

  if (!state.config.clientId) {
    throw new Error("Thiếu Google OAuth Client ID.");
  }

  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services chưa load xong. Hãy thử lại sau vài giây.");
  }

  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: state.config.clientId,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        log(`OAuth lỗi: ${tokenResponse.error}`);
        return;
      }

      state.accessToken = tokenResponse.access_token;
      el.authStatus.textContent = "Đã kết nối Google";
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

    if (!state.config.spreadsheetId) {
      throw new Error("Thiếu Spreadsheet ID.");
    }

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
      log("Access token hết hạn. Hãy bấm Kết nối Google lại.");
      return;
    }

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Không tải được Google Sheet: HTTP ${response.status} ${message}`);
    }

    const payload = await response.json();
    const cards = rowsToCards(payload.values || []);
    setCards(cards, "Google Sheet");
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
  } catch (error) {
    logError(error);
  }
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

    return {
      id: item.id || `${index + 1}`,
      deck: item.deck || "Default",
      front: item.front || item.word || item.pattern || "",
      reading: item.reading || "",
      meaning_vi: item.meaning_vi || item.vi || item.meaning || "",
      meaning_jp: item.meaning_jp || item.jp_meaning || "",
      example_jp: item.example_jp || item.jp || "",
      example_vi: item.example_vi || item.vi_example || "",
      tags: splitTags(item.tags || item.tag || ""),
      note: item.note || "",
      rowNumber: index + 2,
    };
  });

  return normalizeCards(cards);
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
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
      meaning_vi: String(card.meaning_vi || card.meaning || "").trim(),
      meaning_jp: String(card.meaning_jp || "").trim(),
      example_jp: String(card.example_jp || "").trim(),
      example_vi: String(card.example_vi || "").trim(),
      tags: splitTags(card.tags || ""),
      note: String(card.note || "").trim(),
      rowNumber: Number(card.rowNumber || index + 2),
    }))
    .filter((card) => card.front || card.meaning_vi || card.example_jp);
}

function setCards(cards, sourceName) {
  state.rawCards = cards;
  state.sessionCards = [];
  state.currentIndex = 0;
  state.faceIndex = 0;
  state.knownIds = new Set();
  state.againIds = new Set();

  renderSelects();
  updateFilteredCount();
  setControlsEnabled(cards.length > 0);
  log(`Đã tải ${cards.length} thẻ từ ${sourceName}.`);
}

function setControlsEnabled(enabled) {
  [
    el.deckSelect,
    el.tagSelect,
    el.searchInput,
    el.fromInput,
    el.toInput,
    el.limitSelect,
    el.shuffleInput,
    el.startBtn,
  ].forEach((node) => (node.disabled = !enabled));
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

  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
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

  return state.rawCards
    .filter((card, index) => {
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
  el.dataStatus.textContent = `${state.rawCards.length} thẻ · lọc ${count}`;
}

function startSession() {
  let cards = [...getFilteredCards()];

  if (!cards.length) {
    log("Không có thẻ phù hợp filter hiện tại.");
    return;
  }

  if (el.shuffleInput.checked) {
    cards = shuffle(cards);
  }

  const limit = el.limitSelect.value;
  if (limit !== "all") {
    cards = cards.slice(0, Number(limit));
  }

  state.sessionCards = cards;
  state.currentIndex = 0;
  state.faceIndex = 0;
  state.knownIds = new Set();
  state.againIds = new Set();

  el.studyPanel.classList.add("active");
  el.sessionTitle.textContent = `${cards.length} thẻ đang học`;
  renderCard();
  el.studyPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
    el.cardSub.textContent = "";
    el.cardHint.textContent = "Hãy tải data và bắt đầu học.";
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
      hint: "Mặt 1: nhớ nghĩa / cách dùng trước khi lật",
    },
    {
      title: card.meaning_vi || "Chưa có nghĩa Việt",
      body: [card.meaning_jp, card.note].filter(Boolean).join("\n"),
      hint: "Mặt 2: nghĩa",
    },
    {
      title: card.example_jp || card.front || "Chưa có ví dụ",
      body: card.example_vi || card.note || "",
      hint: "Mặt 3: ví dụ Nhật + dịch",
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
  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    progress: state.progress,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `flashcard-progress-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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
  el.logBox.textContent = `[${time}] ${message}\n${el.logBox.textContent}`.slice(0, 5000);
}

function logError(error) {
  console.error(error);
  log(error?.message || String(error));
}

boot();
