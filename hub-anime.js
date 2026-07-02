(() => {
  const STORAGE_KEY = "duan_hub_anime_mode";
  const quotes = [
    "やっほー、ズアンさん！今日も一歩ずついこう ✨",
    "Flashcard mở ở đây nè. Học 10 từ thôi cũng thắng rồi 🧠",
    "日本語は毎日ちょっとずつ。焦らなくてOK！",
    "Tip: bấm card Flashcard để vào app học từ Google Sheet nha.",
    "Code + Japanese + consistency = level up 🚀",
    "休憩も大事。Nhưng nhớ quay lại học đó nha kkk"
  ];

  let sakuraTimer = null;

  function injectMarkup() {
    const layer = document.createElement("div");
    layer.className = "sakura-layer";
    document.body.appendChild(layer);

    const helper = document.createElement("div");
    helper.className = "anime-helper";
    helper.innerHTML = `
      <div class="anime-bubble" id="animeBubble">こんにちは! Mình là mascot của Duan Hub ✨</div>
      <button class="mascot" id="mascotBtn" type="button" aria-label="Anime mascot">
        <span class="mascot-ear left"></span>
        <span class="mascot-ear right"></span>
        <span class="mascot-hair"></span>
        <span class="mascot-head"></span>
        <span class="mascot-eye left"></span>
        <span class="mascot-eye right"></span>
        <span class="mascot-blush left"></span>
        <span class="mascot-blush right"></span>
        <span class="mascot-mouth"></span>
        <span class="mascot-body"></span>
      </button>`;
    document.body.appendChild(helper);

    const dock = document.createElement("nav");
    dock.className = "anime-dock";
    dock.setAttribute("aria-label", "Anime quick dock");
    dock.innerHTML = `
      <a href="/flashcard/" title="Flashcard">🧠</a>
      <a href="/valentine/" title="Valentine">💖</a>
      <button id="animeModeBtn" type="button" title="Anime mode">🌸</button>
      <button id="sakuraBtn" type="button" title="Sakura burst">✨</button>`;
    document.body.appendChild(dock);
  }

  function say(text) {
    const bubble = document.querySelector("#animeBubble");
    if (!bubble) return;
    bubble.textContent = text;
    bubble.style.animation = "none";
    bubble.offsetHeight;
    bubble.style.animation = "bubbleIn .25s ease-out";
  }

  function randomQuote() {
    say(quotes[Math.floor(Math.random() * quotes.length)]);
  }

  function createSakura(burst = false) {
    const layer = document.querySelector(".sakura-layer");
    if (!layer) return;

    const count = burst ? 18 : 1;
    for (let i = 0; i < count; i += 1) {
      const petal = document.createElement("span");
      petal.className = "sakura";
      const left = Math.random() * 100;
      const drift = (Math.random() * 160 - 80).toFixed(0) + "px";
      const fall = (Math.random() * 5 + 7).toFixed(1) + "s";
      const scale = (Math.random() * .65 + .65).toFixed(2);
      petal.style.left = `${left}vw`;
      petal.style.setProperty("--x", "0px");
      petal.style.setProperty("--drift", drift);
      petal.style.setProperty("--fall", fall);
      petal.style.transform = `scale(${scale})`;
      layer.appendChild(petal);
      setTimeout(() => petal.remove(), 13000);
    }
  }

  function startSakura() {
    if (sakuraTimer) return;
    createSakura(true);
    sakuraTimer = setInterval(() => createSakura(false), 520);
  }

  function stopSakura() {
    clearInterval(sakuraTimer);
    sakuraTimer = null;
  }

  function setAnimeMode(enabled) {
    document.body.classList.toggle("anime-mode", enabled);
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    const btn = document.querySelector("#animeModeBtn");
    if (btn) btn.textContent = enabled ? "🌙" : "🌸";
    if (enabled) {
      startSakura();
      say("Anime mode ON 🌸 Chọn app để bắt đầu nào!");
    } else {
      stopSakura();
      say("Anime mode OFF. Nhưng mình vẫn ở đây nha ✨");
    }
  }

  function bind() {
    document.querySelector("#mascotBtn")?.addEventListener("click", () => {
      randomQuote();
      createSakura(true);
    });

    document.querySelector("#animeModeBtn")?.addEventListener("click", () => {
      setAnimeMode(!document.body.classList.contains("anime-mode"));
    });

    document.querySelector("#sakuraBtn")?.addEventListener("click", () => {
      createSakura(true);
      say("キラキラ〜 ✨ Sakura burst!");
    });

    document.querySelectorAll(".app-card").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        const title = card.querySelector("h2")?.textContent?.trim();
        if (title) say(`${title} を開く？ Bấm vào là bay qua đó nha.`);
      });
    });
  }

  function boot() {
    injectMarkup();
    bind();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "on") setAnimeMode(true);
    setTimeout(() => say("Bấm mình hoặc nút 🌸 để bật anime mode nha!"), 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
