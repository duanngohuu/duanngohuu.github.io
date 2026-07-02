(() => {
  const CONFIG_KEY = "fc_google_sheet_config_v2";
  const RAW_KEY = "fc_raw_data_v1";
  const $ = (selector) => document.querySelector(selector);

  function getSheetId(value) {
    const input = String(value || "").trim();
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input;
  }

  function readConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveConfig(partial = {}) {
    const clientIdInput = $("#clientIdInput");
    const spreadsheetIdInput = $("#spreadsheetIdInput");
    const rangeInput = $("#rangeInput");
    const current = readConfig();
    const next = {
      ...current,
      clientId: clientIdInput?.value.trim() || current.clientId || "",
      spreadsheetId: getSheetId(spreadsheetIdInput?.value || current.spreadsheetId || ""),
      range: rangeInput?.value.trim() || current.range || "vocab!A1:J",
      updatedAt: new Date().toISOString(),
      ...partial,
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }

  function hydrateConfig() {
    const config = readConfig();
    const clientIdInput = $("#clientIdInput");
    const spreadsheetIdInput = $("#spreadsheetIdInput");
    const rangeInput = $("#rangeInput");
    if (clientIdInput && config.clientId) clientIdInput.value = config.clientId;
    if (spreadsheetIdInput && config.spreadsheetId) spreadsheetIdInput.value = config.spreadsheetId;
    if (rangeInput && config.range) rangeInput.value = config.range;
  }

  function switchTab(tabName) {
    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
    });
  }

  function toast(message, type = "info") {
    let box = $("#toastBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "toastBox";
      box.setAttribute("role", "status");
      document.body.appendChild(box);
    }
    box.className = `toast-box ${type}`;
    box.textContent = message;
    box.classList.add("show");
    clearTimeout(window.__flashcardToastTimer);
    window.__flashcardToastTimer = setTimeout(() => box.classList.remove("show"), 4200);
  }

  function focusAndPulse(node) {
    if (!node) return;
    setTimeout(() => {
      node.focus({ preventScroll: false });
      node.classList.add("field-pulse");
      setTimeout(() => node.classList.remove("field-pulse"), 1800);
    }, 180);
  }

  function validateGoogleConfig(event) {
    const clientIdInput = $("#clientIdInput");
    const spreadsheetIdInput = $("#spreadsheetIdInput");
    const config = saveConfig();
    const clientId = config.clientId || "";
    const spreadsheetId = config.spreadsheetId || "";

    if (spreadsheetIdInput && spreadsheetIdInput.value !== spreadsheetId) {
      spreadsheetIdInput.value = spreadsheetId;
    }

    if (!clientId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      switchTab("google");
      toast("Cần nhập Google OAuth Client ID trước. Nhập xong app sẽ tự lưu localStorage.", "warn");
      focusAndPulse(clientIdInput);
      return false;
    }

    if (!spreadsheetId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      switchTab("google");
      toast("Cần dán Google Sheet URL hoặc Spreadsheet ID. App sẽ tự lưu localStorage.", "warn");
      focusAndPulse(spreadsheetIdInput);
      return false;
    }

    toast("Đang mở popup Google. Nếu không thấy popup, kiểm tra chặn popup của trình duyệt.", "info");
    return true;
  }

  function bindAutoSave() {
    ["#clientIdInput", "#spreadsheetIdInput", "#rangeInput"].forEach((selector) => {
      const node = $(selector);
      node?.addEventListener("input", () => {
        saveConfig();
        toast("Đã tự lưu cấu hình vào localStorage.", "info");
      });
      node?.addEventListener("change", () => saveConfig());
    });

    const rawInput = $("#rawInput");
    rawInput?.addEventListener("input", () => {
      localStorage.setItem(RAW_KEY, rawInput.value);
    });
  }

  function bootUxFix() {
    hydrateConfig();
    bindAutoSave();

    const connectBtn = $("#connectGoogleBtn");
    const loadSheetBtn = $("#loadSheetBtn");
    const saveConfigBtn = $("#saveConfigBtn");

    connectBtn?.addEventListener("click", validateGoogleConfig, true);
    loadSheetBtn?.addEventListener("click", validateGoogleConfig, true);
    saveConfigBtn?.addEventListener("click", () => {
      saveConfig();
      toast("Đã lưu Client ID, Sheet ID/URL và Range vào localStorage.", "info");
    }, true);

    const config = readConfig();
    if (config.clientId || config.spreadsheetId) {
      toast("Đã load cấu hình Google Sheet từ localStorage.", "info");
    } else {
      toast("Tip: Dùng data mẫu trước. Muốn login Google thì cần OAuth Client ID + Sheet URL.", "info");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUxFix);
  } else {
    bootUxFix();
  }
})();
