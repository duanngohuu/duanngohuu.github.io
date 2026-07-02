(() => {
  const $ = (selector) => document.querySelector(selector);

  function getSheetId(value) {
    const input = String(value || "").trim();
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : input;
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
    const clientId = clientIdInput?.value.trim() || "";
    const spreadsheetId = getSheetId(spreadsheetIdInput?.value || "");

    if (!clientId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      switchTab("google");
      toast("Cần nhập Google OAuth Client ID trước. Đây là ID tạo trong Google Cloud, không phải email Google.", "warn");
      focusAndPulse(clientIdInput);
      return false;
    }

    if (!spreadsheetId) {
      event.preventDefault();
      event.stopImmediatePropagation();
      switchTab("google");
      toast("Cần dán Google Sheet URL hoặc Spreadsheet ID trước khi tải data.", "warn");
      focusAndPulse(spreadsheetIdInput);
      return false;
    }

    if (spreadsheetIdInput && spreadsheetIdInput.value !== spreadsheetId) {
      spreadsheetIdInput.value = spreadsheetId;
    }

    toast("Đang mở popup Google. Nếu không thấy popup, kiểm tra chặn popup của trình duyệt.", "info");
    return true;
  }

  function bootUxFix() {
    const connectBtn = $("#connectGoogleBtn");
    const loadSheetBtn = $("#loadSheetBtn");

    // Capture phase: run before original app.js click handlers.
    connectBtn?.addEventListener("click", validateGoogleConfig, true);
    loadSheetBtn?.addEventListener("click", validateGoogleConfig, true);

    toast("Tip: Bấm Dùng data mẫu để test trước. Muốn dùng Google Sheet private thì cần OAuth Client ID.", "info");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootUxFix);
  } else {
    bootUxFix();
  }
})();
