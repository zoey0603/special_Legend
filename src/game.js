const dialogEl = document.getElementById("dialog");
const dialogNameEl = document.getElementById("dialogName");
const dialogTextEl = document.getElementById("dialogText");
const dialogPortraitEl = document.getElementById("dialogPortrait");
// ===== DOM =====
const menuEl = document.getElementById("menu");
const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnSettings = document.getElementById("btnSettings");
// btnBack：返回遊戲（主選單最下方）
const btnBack = document.getElementById("btnBack");
// btnSettingsBack：返回主選單（設定面板內）
const btnSettingsBack = document.getElementById("btnSettingsBack");
const settingsPanel = document.getElementById("settingsPanel");
const musicVolEl = document.getElementById("musicVol");
const sfxVolEl = document.getElementById("sfxVol");
const endOverlayEl = document.getElementById("endOverlay");
const menuToastEl = document.getElementById("menuToast");

// ===== STATE =====
const ingameMenuEl = document.getElementById("ingameMenu");
const saveConfirmEl = document.getElementById("saveConfirm");
const statusPanel = document.getElementById("statusPanel");
const statusCard  = document.getElementById("statusCard");
const statusAvatar = document.getElementById("statusAvatar");
const statusName = document.getElementById("statusName");
const statusRace = document.getElementById("statusRace");
const statusState = document.getElementById("statusState");
const statusSkill = document.getElementById("statusSkill");
const toastEl = document.getElementById("toast");

const btnSave = document.getElementById("btnSave");
const btnStatus = document.getElementById("btnStatus");
const btnResume = document.getElementById("btnResume");
const btnSaveYes = document.getElementById("btnSaveYes");
const btnSaveNo = document.getElementById("btnSaveNo");
const SAVE_KEY = "MZ_SAVE_V1";
let ingameIndex = 0;
let ingameMode = "menu"; // "menu" | "saveConfirm" | "status"
let menuToastTimer = null;
let saveConfirmIndex = 0; // 0: Yes, 1: No
// ===== Choice Popup (two-stage) =====
const choicePopup = document.getElementById("choicePopup");
const choiceTitleEl = document.getElementById("choiceTitle");
const choiceDescEl  = document.getElementById("choiceDesc");
const choiceBtnsEl  = document.getElementById("choiceBtns");
const choiceNextBtn = document.getElementById("choiceNext");

let _choiceIndex = 0;
let _choiceResolve = null;
let _choiceMode = "real"; // "tease" | "real"
let _choiceOptions = [];
let eggOverlayEl = document.getElementById("eggOverlay");
let eggOverlayImgEl = document.getElementById("eggOverlayImg");

// 如果 HTML 沒放，也自動建立（避免你忘記加）
(function ensureEggOverlayDom(){
  if (!eggOverlayEl) {
    eggOverlayEl = document.createElement("div");
    eggOverlayEl.id = "eggOverlay";
    eggOverlayEl.innerHTML = `<img id="eggOverlayImg" alt="">`;
    document.body.appendChild(eggOverlayEl);
    eggOverlayImgEl = eggOverlayEl.querySelector("#eggOverlayImg");
  }
})();

// ===== Warning Typewriter (DOM-based) =====
// ✅ 只在「同一個分頁/同一輪遊戲」顯示一次：返回主選單/重新開始都不會再跳。
// 若你希望「關掉瀏覽器也不要再跳」，把 sessionStorage 改成 localStorage 即可。
const WARNING_KEY = "MZ_WARNING_SHOWN_V1";

// ===== Warning Audio Gate =====
// 需求：
// 1) 警語期間播放 warming（循環）
// 2) 警語沒關掉前，先不要出現 prologue_fire 的 fire 循環音效 / 地圖環境音
window.__WARNING_ACTIVE__ = window.__WARNING_ACTIVE__ ?? false;
window.__WARNING_MUSIC__ = window.__WARNING_MUSIC__ ?? null;
window.__WARNING_MUSIC_BASE_VOL__ = window.__WARNING_MUSIC_BASE_VOL__ ?? 0.6;

function stopWarningMusic(){
  const s = window.__WARNING_MUSIC__;
  if (s) {
    try { s.stop(); } catch(_e){}
    try { s.destroy(); } catch(_e){}
  }
  window.__WARNING_MUSIC__ = null;
}

function startWarningMusic(scene, { key = "warming", volume = 0.6, rate = 1, detune = 0 } = {}){
  if (!scene?.sound || !key) return;
  stopWarningMusic();

  const master = window.__MUSIC_VOL__ ?? 1;
  const s = scene.sound.add(key, {
    loop: true,
    volume: volume * master,
    rate,
    detune,
  });
  s.play();

  window.__WARNING_MUSIC__ = s;
  window.__WARNING_MUSIC_BASE_VOL__ = volume;
}

function refreshWarningMusicVolume(){
  const s = window.__WARNING_MUSIC__;
  if (!s) return;
  const base = window.__WARNING_MUSIC_BASE_VOL__ ?? 1;
  const master = window.__MUSIC_VOL__ ?? 1;
  try { s.setVolume(base * master); } catch(_e){}
}

function _warningStore(){
  try{ return window.sessionStorage; } catch(_e){ return null; }
}

function isWarningOpen(){
  const el = document.getElementById("warningOverlay");
  return el && !el.classList.contains("is-hidden");
}

function showWarningOverlay(){
  const overlay = document.getElementById("warningOverlay");
  if (!overlay) return;
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}

function hideWarningOverlay(){
  const overlay = document.getElementById("warningOverlay");
  if (!overlay) return;
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function bootShowWarningOnce(scene){
  // 只顯示一次（同一個分頁）
  const store = _warningStore();
  if (store && store.getItem(WARNING_KEY) === "1") {
    // 保險：若曾有殘留，確保不會卡住
    window.__WARNING_ACTIVE__ = false;
    try { stopWarningMusic(); } catch (_e) {}
    return false;
  }

  const full = document.getElementById("warningFull");
  const out  = document.getElementById("warningText");
  const overlay = document.getElementById("warningOverlay");
  if (!full || !out || !overlay) return false;

  const text = (full.textContent || "").replace(/\r\n/g, "\n").trimEnd();
  out.textContent = "";

  // 警語期間先暫停 Phaser（避免背景繼續跑）
  try{ scene?.scene?.pause?.(); }catch(_e){}

  // ✅ 警語期間：播放 warming 音樂，並先關掉所有循環音效/音樂（避免 fire 提前出現）
  window.__WARNING_ACTIVE__ = true;
  try { stopLoopSfx(); } catch (_e) {}
  try { pauseMapLoopSfx(); } catch (_e) {}
  try { pauseMapLoopMusic(); } catch (_e) {}
  try { startWarningMusic(scene, { key: "warming", volume: 0.6 }); } catch (_e) {}

  showWarningOverlay();

  let i = 0;
  let typing = true;
  let timer = null;
  const delay = 18; // 打字速度：數字越小越快

  function finishTyping(){
    typing = false;
    if (timer) { clearInterval(timer); timer = null; }
    out.textContent = text;
  }

  function closeAndContinue(){
    // ✅ 關閉警語：停止 warming 音樂，解除阻擋
    try { stopWarningMusic(); } catch (_e) {}
    window.__WARNING_ACTIVE__ = false;
    // 保險：如果先前有殘留 fire 聲，這裡先停掉
    try { scene?.sound?.stopByKey?.("fire"); } catch (_e) {}

    hideWarningOverlay();
    if (store) store.setItem(WARNING_KEY, "1");

    // 警語結束後要做什麼：回主選單 or 直接開始
    // 你想回主選單：
    if (typeof showMenu === "function") showMenu();
    // 如果你想直接開始遊戲，把上面那行改成：
    // if (typeof startNewGame === "function") startNewGame();
  }

  function onContinue(){
    if (typing) {
      finishTyping();
    } else {
      cleanup();
      closeAndContinue();
    }
  }

  function cleanup(){
    document.removeEventListener("keydown", onKeyDownCapture, true);
    overlay.removeEventListener("click", onContinue);
  }

  function onKeyDownCapture(e){
    // 只在警語開著時攔截
    if (!isWarningOpen()) return;

    const k = e.code;
    if (k === "Enter" || k === "Space") {
      e.preventDefault();
      e.stopPropagation();
      onContinue();
      return;
    }

    // 其他按鍵一律擋掉（避免你的遊戲快捷鍵搶走）
    e.preventDefault();
    e.stopPropagation();
  }

  // 用 capture=true 先攔截，最保險
  document.addEventListener("keydown", onKeyDownCapture, true);
  overlay.addEventListener("click", onContinue);

  timer = setInterval(() => {
    i++;
    out.textContent = text.slice(0, i);
    if (i >= text.length) {
      typing = false;
      clearInterval(timer);
      timer = null;
    }
  }, delay);

  return true;
}

// === Egg image overlay helpers ===
const EGG_IMAGE_SRC = {
  coffee: "assets/img/coffee.png", // 你專案實際路徑若不同就改這裡
  idol: "assets/img/idol.png",
};

let eggWrapEl = null;
let eggImgEl = null;
let eggHideTimer = null;

function ensureEggImageDom() {
  if (eggWrapEl && eggImgEl) return;

  eggWrapEl = document.createElement("div");
  eggWrapEl.id = "eggImageWrap";
  eggWrapEl.className = "egg-image-wrap"; // CSS 會用到

  eggImgEl = document.createElement("img");
  eggImgEl.id = "eggImage";
  eggImgEl.className = "egg-image";
  eggImgEl.alt = "egg";

  eggWrapEl.appendChild(eggImgEl);
  document.body.appendChild(eggWrapEl);
}

function showEggImage(key) {
  ensureEggImageDom();

  const src = EGG_IMAGE_SRC[key];
  if (!src) {
    console.warn("[eggImage] unknown key:", key);
    return;
  }

  // 清掉上一輪 hide 的 timer（避免你剛 show 又被上一輪 hide 收掉）
  if (eggHideTimer) {
    clearTimeout(eggHideTimer);
    eggHideTimer = null;
  }

  // ✅ 每次都更新圖片來源（重點！不然第二張永遠不換）
  eggImgEl.src = src;

  // ✅ 重新觸發動畫：移除 class → 強制 reflow → 再加回 class
  eggWrapEl.classList.remove("show");
  eggWrapEl.classList.remove("hide");

  // 強制重算樣式，讓 transition/animation 能重新跑
  void eggWrapEl.offsetWidth;

  eggWrapEl.classList.add("show");
}

function hideEggImage() {
  if (!eggWrapEl) return;

  eggWrapEl.classList.remove("show");
  eggWrapEl.classList.add("hide");

  // 等淡出結束再真正隱藏（時間要跟 CSS transition 對上）
  if (eggHideTimer) clearTimeout(eggHideTimer);
  eggHideTimer = setTimeout(() => {
    // 保持 DOM 在，但回到初始狀態
    eggWrapEl.classList.remove("hide");
  }, 260); // ← 這個數字請跟 CSS 的 transition 時間一致
}
// =========================
// Choice Popup (two-stage)
// =========================
function isChoiceOpen() {
  return !!choicePopup && choicePopup.classList.contains("show");
}

function closeChoicePopup() {
  if (!choicePopup) return;
  choicePopup.classList.remove("show");
  choicePopup.setAttribute("aria-hidden", "true");
  _choiceResolve = null;
  _choiceOptions = [];
  _choiceIndex = 0;
  _choiceMode = "real";
}

function setChoiceActive(i) {
  const btns = Array.from(choiceBtnsEl?.querySelectorAll("button") || []);
  if (!btns.length) return;

  btns.forEach(b => b.classList.remove("active"));
  _choiceIndex = (i + btns.length) % btns.length;
  btns[_choiceIndex].classList.add("active");
  btns[_choiceIndex].focus({ preventScroll: true });
}

function renderChoiceButtons({ disabled = false } = {}) {
  if (!choiceBtnsEl) return;
  choiceBtnsEl.innerHTML = "";
  const opts = _choiceOptions || [];
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt?.text ?? String(opt);
    btn.disabled = !!disabled;
    btn.addEventListener("click", () => {
      if (disabled) return;
      if (typeof _choiceResolve === "function") {
        const r = _choiceResolve;
        closeChoicePopup();
        r(i);
      }
    });
    choiceBtnsEl.appendChild(btn);
  }
  if (!disabled) setChoiceActive(0);
}

function openChoiceTease({ title = "請選擇", desc = "", options = [] } = {}) {
  if (!choicePopup) return Promise.resolve(null);

  closeChoicePopup();
  _choiceMode = "tease";
  _choiceOptions = options;

  choiceTitleEl.textContent = title;
  choiceDescEl.textContent = desc || "";
  renderChoiceButtons({ disabled: true });

  // tease：只給「繼續」按鈕
  const nextBtn = document.getElementById("choiceNext");
  if (nextBtn) {
    nextBtn.style.display = "";
    nextBtn.textContent = "繼續";
    // 用 onclick 覆蓋，避免重複綁定
    nextBtn.onclick = () => {
      if (typeof _choiceResolve === "function") {
        const r = _choiceResolve;
        closeChoicePopup();
        r(null);
      }
    };
  }

  choicePopup.classList.add("show");
  choicePopup.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    _choiceResolve = resolve;
  });
}

function openChoicePick({ title = "請選擇", desc = "", options = [] } = {}) {
  if (!choicePopup) return Promise.resolve(0);

  closeChoicePopup();
  _choiceMode = "real";
  _choiceOptions = options;

  choiceTitleEl.textContent = title;
  choiceDescEl.textContent = desc || "";

  // real：隱藏「繼續」
  const nextBtn = document.getElementById("choiceNext");
  if (nextBtn) nextBtn.style.display = "none";

  renderChoiceButtons({ disabled: false });

  choicePopup.classList.add("show");
  choicePopup.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    _choiceResolve = resolve;
  });
}

window.__SFX_VOL__ = parseFloat(sfxVolEl.value || "1");
window.__MUSIC_VOL__ = parseFloat(musicVolEl.value || "1"); // 你之後要做音樂才用

// ===== End Credits (DOM, show once per tab) =====
// 同一個分頁/同一輪遊戲只顯示一次；重新開始(A)也不再跳。
const END_CREDITS_KEY = "MZ_END_CREDITS_SHOWN_V1";

function _endStore(){
  try{ return window.sessionStorage; } catch(_e){ return null; }
}

function ensureGameState() {
  window.__GAME_STATE__ = window.__GAME_STATE__ || {
    phase: "menu", // "menu" | "playing" | "paused" | "ended"
    finished: false,
    pendingLoad: null,
  };
  return window.__GAME_STATE__;
}
ensureGameState();

// Mobile/Mouse：點擊 END 畫面也可重新開始（等同按 A）
if (endOverlayEl) {
  endOverlayEl.addEventListener("pointerdown", (e) => {
    // 避免點到 END 上的內容時觸發兩次
    e.preventDefault();
    const gs = ensureGameState();
    if (gs.phase === "ended" || window.gameFinished === true) startNewGame();
  }, { passive: false });
}

function showEndOverlay() {
  const gs = ensureGameState();
  endOverlayEl?.classList.add("show");
  gs.phase = "ended";
  gs.finished = true;

  // ✅ END 畫面就不需要循環音效了
  try { stopLoopSfx(); } catch (_e) {}
  try { pauseMapLoopSfx(); } catch (_e) {}
  try { pauseMapLoopMusic(); } catch (_e) {}

  // 在 END 畫面前先插入一次「感謝名單」(2.5 秒)
  const creditsEl = document.getElementById("endCredits");
  const finalEl   = document.getElementById("endFinal");
  const store = _endStore();

  // 沒有 endCredits/endFinal（或 DOM 尚未更新）就直接顯示原本 END
  if (!creditsEl || !finalEl) {
    return;
  }

  // 清掉上次可能留下的計時器
  if (window.__END_CREDITS_TIMER__) {
    clearTimeout(window.__END_CREDITS_TIMER__);
    window.__END_CREDITS_TIMER__ = null;
  }

  const alreadyShown = !!(store && store.getItem(END_CREDITS_KEY) === "1");
  if (alreadyShown) {
    creditsEl.classList.remove("show", "hide");
    creditsEl.style.display = "none";
    finalEl.style.display = "block";
    finalEl.classList.add("show");
    finalEl.setAttribute("aria-hidden", "false");
    creditsEl.setAttribute("aria-hidden", "true");
    return;
  }

  // 第一次：顯示 credits 2.5s，然後切回 END - 感謝遊玩
  creditsEl.style.display = "block";
  finalEl.style.display = "none";
  finalEl.classList.remove("show");
  creditsEl.classList.remove("hide");
  creditsEl.classList.add("show");
  creditsEl.setAttribute("aria-hidden", "false");
  finalEl.setAttribute("aria-hidden", "true");

  // 開始時的小延遲，讓 transition 可以吃到
  requestAnimationFrame(() => creditsEl.classList.add("show"));

  window.__END_CREDITS_TIMER__ = setTimeout(() => {
    // 先淡出
    creditsEl.classList.add("hide");

    // 淡出結束後切換畫面
    setTimeout(() => {
      creditsEl.classList.remove("show", "hide");
      creditsEl.style.display = "none";

      finalEl.style.display = "block";
      finalEl.classList.add("show");
      finalEl.setAttribute("aria-hidden", "false");
      creditsEl.setAttribute("aria-hidden", "true");

      if (store) store.setItem(END_CREDITS_KEY, "1");
      window.__END_CREDITS_TIMER__ = null;
    }, 380);
  }, 5000);
}

function hideEndOverlay() {
  endOverlayEl?.classList.remove("show");
}

// ===== Helpers =====
let menuIndex = 0;
let menuMode = "main"; // "main" | "settings"

function getMenuButtons() {
  // 用 menuEl query，避免引用錯位
  return [
    menuEl.querySelector("#btnStart"),
    menuEl.querySelector("#btnContinue"),
    menuEl.querySelector("#btnSettings"),
    menuEl.querySelector("#btnBack"),
  ].filter(Boolean);
}
// ✅ 允許選到 d（disableContinue 沒存檔也能被選到，只是 Enter 不會動作）
function setMenuActive(i) {
  const btns = getMenuButtons();
  if (btns.length === 0) return;

  btns.forEach(b => b.classList.remove("active"));
  menuIndex = (i + btns.length) % btns.length;

  // ✅ 這行一定要生效
  btns[menuIndex].classList.add("active");
}

function refreshContinueButton() {
  const hasSave = !!localStorage.getItem(SAVE_KEY);
  btnContinue.disabled = !hasSave;
}

function refreshBackButton() {
  if (!btnBack) return;
  const gs = ensureGameState();
  const hasScene = !!window.__SCENE__;
  const canBack = hasScene && gs.finished !== true;

  // 初次進入（還沒進遊戲）就不要顯示「返回遊戲」
  btnBack.style.display = hasScene ? "block" : "none";
  btnBack.disabled = !canBack;
}

function showMenu() {
  const gs = ensureGameState();
  // ✅ 回到主選單時停止段落循環音效/地圖環境音/地圖 BGM
  try { stopLoopSfx(); } catch (_e) {}
  try { pauseMapLoopSfx(); } catch (_e) {}
  try { pauseMapLoopMusic(); } catch (_e) {}
  refreshContinueButton();
  refreshBackButton();

  menuEl.classList.add("show");
  settingsPanel.classList.remove("show");
  menuMode = "main";

  menuEl.setAttribute("tabindex", "-1");
  menuEl.focus();

  // ✅ 等畫面真的顯示後再套 active + focus（你要的第一次就有框）
  requestAnimationFrame(() => {
    setMenuActive(0);
    const btns = getMenuButtons();
    btns[menuIndex]?.focus({ preventScroll: true });
  });

  gs.phase = "menu";
  window.__SCENE__?.scene.pause();
}

function hideMenu() {
  const gs = ensureGameState();

  menuEl.classList.remove("show");
  settingsPanel.classList.remove("show");
  menuMode = "main";

  gs.phase = "playing";
  window.__SCENE__?.scene.resume();

  // ✅ 回遊戲時恢復地圖環境音 / BGM
  try { resumeMapLoopSfx(); } catch (_e) {}
  try { resumeMapLoopMusic(); } catch (_e) {}
}


function showMenuToast(msg, ms = 900) {
  if (!menuToastEl) return;
  menuToastEl.textContent = msg;
  menuToastEl.classList.remove("hide");
  clearTimeout(menuToastTimer);
  menuToastTimer = setTimeout(() => menuToastEl.classList.add("hide"), ms);
}

function denyButton(btn) {
  if (!btn) return;
  // 抖動 + 亮紅
  btn.classList.remove("nudge", "denied");
  // 觸發 reflow 讓動畫每次都能重播
  void btn.offsetWidth;
  btn.classList.add("nudge", "denied");

  setTimeout(() => {
    btn.classList.remove("nudge", "denied");
  }, 450);
}

function openSettings() {
  settingsPanel.classList.add("show");
  menuMode = "settings";
  menuEl.setAttribute("tabindex","-1");
  menuEl.focus();
}

function closeSettings() {
  settingsPanel.classList.remove("show");
  menuMode = "main";
  setMenuActive(0);
  menuEl.setAttribute("tabindex","-1");
  menuEl.focus();
}

// ===== Settings volume control =====
// 你說音量/音效維持左右鍵控制：這裡先控制 musicVolEl
// 若你想切換 music/sfx 再跟我說，我幫你加「選擇音量/音效」游標
window.__SFX_VOL__ = window.__SFX_VOL__ ?? 1;
sfxVolEl.addEventListener("input", () => {
  window.__SFX_VOL__ = parseFloat(sfxVolEl.value || "1");
  try { refreshLoopSfxVolume(); } catch (_e) {}
  try { refreshMapLoopSfxVolume(); } catch (_e) {}
});

musicVolEl.addEventListener("input", () => {
  window.__MUSIC_VOL__ = parseFloat(musicVolEl.value || "1");
  try { refreshMapLoopMusicVolume(); } catch (_e) {}
  try { refreshWarningMusicVolume(); } catch (_e) {}
});


// ===== Loop SFX for whole story segment =====
// 用法：在 STAGE_LOOP_SFX 設定每段劇情要循環播放的音效 key。
// 會在 openCurrentDialog() 進入該段時自動開始，離開該段時自動停止。
// key 必須是你 preload 時有載入的音效 key（例如你 action.type==="sfx" 用過的那些 key）。

window.__LOOP_SFX__ = window.__LOOP_SFX__ ?? null;
window.__LOOP_SFX_KEY__ = window.__LOOP_SFX_KEY__ ?? null;
window.__LOOP_SFX_BASE_VOL__ = window.__LOOP_SFX_BASE_VOL__ ?? 1;
window.__LOOP_SFX_STAGE__ = window.__LOOP_SFX_STAGE__ ?? null;

// ✅ 你想要「整段劇情」循環音效，就在這裡指定：
// 例：prologue_fire 一直有火焰聲；wake_blackhall 你可改成你想要的 key（或先註解掉）
const STAGE_LOOP_SFX = {
  coffee_branch: { key: "coffeeshop", volume: 0.15 },
  // white_garden: { key: "wind", volume: 0.25 }, // 如果你有 wind 音效的話
};

function stopLoopSfx() {
  const s = window.__LOOP_SFX__;
  if (s) {
    try { s.stop(); } catch (_e) {}
    try { s.destroy(); } catch (_e) {}
  }
  window.__LOOP_SFX__ = null;
  window.__LOOP_SFX_KEY__ = null;
  window.__LOOP_SFX_BASE_VOL__ = 1;
  window.__LOOP_SFX_STAGE__ = null;
}

function startLoopSfx(scene, key, opts = {}) {
  if (!scene?.sound || !key) return;
  // ✅ 警語期間先不要開啟 fire 循環音效
  if (window.__WARNING_ACTIVE__ && key === "fire") return;
  // 換段先停掉舊的
  stopLoopSfx();

  const baseVol = opts.volume ?? 1;
  const master = window.__SFX_VOL__ ?? 1;
  const rate = opts.rate ?? 1;
  const detune = opts.detune ?? 0;

  // 用 add 才能拿到 Sound 物件做 setVolume/stop
  const s = scene.sound.add(key, {
    loop: true,
    volume: baseVol * master,
    rate,
    detune,
  });
  s.play();

  window.__LOOP_SFX__ = s;
  window.__LOOP_SFX_KEY__ = key;
  window.__LOOP_SFX_BASE_VOL__ = baseVol;
}

function refreshLoopSfxVolume() {
  const s = window.__LOOP_SFX__;
  if (!s) return;
  const baseVol = window.__LOOP_SFX_BASE_VOL__ ?? 1;
  const master = window.__SFX_VOL__ ?? 1;
  try { s.setVolume(baseVol * master); } catch (_e) {}
}

function applyStageLoopSfx(stageId) {
  // ✅ 警語期間先不要出現 prologue_fire 的 fire 循環音效
  if (window.__WARNING_ACTIVE__) {
    try { stopLoopSfx(); } catch (_e) {}
    window.__LOOP_SFX_STAGE__ = null; // 之後解除警語還能正常套用
    return;
  }

  // 同一段就不用重開
  if (window.__LOOP_SFX_STAGE__ === stageId) return;

  // 先標記（避免遞迴/重入）
  window.__LOOP_SFX_STAGE__ = stageId;

  const cfg = STAGE_LOOP_SFX[stageId];
  const scene = window.__SCENE__;

  if (!cfg) {
    stopLoopSfx();
    return;
  }
  startLoopSfx(scene, cfg.key, cfg);
}


// ===== Loop SFX bound to map (ambient) =====
// 會在 loadStageMap() 換地圖時自動切換；同一張地圖不重開。
// ※ 這套「地圖綁定循環音效」不會影響你原本 action.type === "sfxLoop" / "sfxStop" 的劇情循環音效。
window.__MAP_LOOP_SFX__ = window.__MAP_LOOP_SFX__ ?? null;
window.__MAP_LOOP_SFX_KEY__ = window.__MAP_LOOP_SFX_KEY__ ?? null;
window.__MAP_LOOP_SFX_BASE_VOL__ = window.__MAP_LOOP_SFX_BASE_VOL__ ?? 1;
window.__MAP_LOOP_SFX_STAGE__ = window.__MAP_LOOP_SFX_STAGE__ ?? null;

// ✅ 你想要「某張地圖」一直有環境音，就在這裡指定：
const MAP_LOOP_SFX = {
  prologue_fire: { key: "fire", volume: 0.15 },
  white_garden: { key: "bird", volume: 0.4 }, // white_garden 綁 bird
  blackhall: { key: "Dream", volume: 0.15 },
  // coffee: { key: "coffeeshop", volume: 0.15 }, // 若你想把 coffeeshop 當環境音也可以
};

function stopMapLoopSfx() {
  const s = window.__MAP_LOOP_SFX__;
  if (s) {
    try { s.stop(); } catch (_e) {}
    try { s.destroy(); } catch (_e) {}
  }
  window.__MAP_LOOP_SFX__ = null;
  window.__MAP_LOOP_SFX_KEY__ = null;
  window.__MAP_LOOP_SFX_BASE_VOL__ = 1;
  window.__MAP_LOOP_SFX_STAGE__ = null;
}

// ===== Map Loop SFX: pause/resume (for menu) =====
window.__MAP_LOOP_SFX_PAUSED_BY_MENU__ = window.__MAP_LOOP_SFX_PAUSED_BY_MENU__ ?? false;

function pauseMapLoopSfx() {
  const s = window.__MAP_LOOP_SFX__;
  if (!s) return;
  window.__MAP_LOOP_SFX_PAUSED_BY_MENU__ = true;
  try { if (typeof s.pause === "function") s.pause(); } catch (_e) {}
}

function resumeMapLoopSfx() {
  const s = window.__MAP_LOOP_SFX__;
  if (!s) return;
  if (!window.__MAP_LOOP_SFX_PAUSED_BY_MENU__) return;
  window.__MAP_LOOP_SFX_PAUSED_BY_MENU__ = false;
  try { if (typeof s.resume === "function") s.resume(); } catch (_e) {}
}



function startMapLoopSfx(scene, key, opts = {}) {
  if (!scene?.sound || !key) return;
  // ✅ 警語期間：不要播放地圖環境音效
  if (window.__WARNING_ACTIVE__) return;
  stopMapLoopSfx();

  const baseVol = opts.volume ?? 1;
  const master = window.__SFX_VOL__ ?? 1;
  const rate = opts.rate ?? 1;
  const detune = opts.detune ?? 0;

  const s = scene.sound.add(key, {
    loop: true,
    volume: baseVol * master,
    rate,
    detune,
  });
  s.play();

  window.__MAP_LOOP_SFX__ = s;
  window.__MAP_LOOP_SFX_KEY__ = key;
  window.__MAP_LOOP_SFX_BASE_VOL__ = baseVol;
}

function refreshMapLoopSfxVolume() {
  const s = window.__MAP_LOOP_SFX__;
  if (!s) return;
  const baseVol = window.__MAP_LOOP_SFX_BASE_VOL__ ?? 1;
  const master = window.__SFX_VOL__ ?? 1;
  try { s.setVolume(baseVol * master); } catch (_e) {}
}

function applyMapLoopSfx(stageKey, sceneOverride) {
  // ✅ 警語期間：不要播放地圖環境音效
  if (window.__WARNING_ACTIVE__) {
    try { pauseMapLoopSfx(); } catch (_e) {}
    window.__MAP_LOOP_SFX_STAGE__ = null;
    return;
  }

  if (window.__MAP_LOOP_SFX_STAGE__ === stageKey) return;
  window.__MAP_LOOP_SFX_STAGE__ = stageKey;

  const cfg = MAP_LOOP_SFX[stageKey];
  const scene = sceneOverride || window.__SCENE__;

  if (!cfg) {
    stopMapLoopSfx();
    return;
  }
  startMapLoopSfx(scene, cfg.key, cfg);
}


// ===== Loop MUSIC bound to map (BGM) =====
// 會在 loadStageMap() 換地圖時自動切換；用 musicVol 控制音量。
window.__MAP_LOOP_MUSIC__ = window.__MAP_LOOP_MUSIC__ ?? null;
window.__MAP_LOOP_MUSIC_KEY__ = window.__MAP_LOOP_MUSIC_KEY__ ?? null;
window.__MAP_LOOP_MUSIC_BASE_VOL__ = window.__MAP_LOOP_MUSIC_BASE_VOL__ ?? 1;
window.__MAP_LOOP_MUSIC_STAGE__ = window.__MAP_LOOP_MUSIC_STAGE__ ?? null;

// ✅ 你想要「某張地圖」一直播放 BGM，就在這裡指定：
const MAP_LOOP_MUSIC = {
  coffee: { key: "coffeeshop", volume: 0.35 }, // coffee 綁 coffeeshop（循環 BGM）
  // white_garden: { key: "coloregg", volume: 0.30 }, // 例：白園 BGM
};

function stopMapLoopMusic() {
  const s = window.__MAP_LOOP_MUSIC__;
  if (s) {
    try { s.stop(); } catch (_e) {}
    try { s.destroy(); } catch (_e) {}
  }
  window.__MAP_LOOP_MUSIC__ = null;
  window.__MAP_LOOP_MUSIC_KEY__ = null;
  window.__MAP_LOOP_MUSIC_BASE_VOL__ = 1;
  window.__MAP_LOOP_MUSIC_STAGE__ = null;
}

// ===== Map Loop Music: pause/resume (for menu) =====
window.__MAP_LOOP_MUSIC_PAUSED_BY_MENU__ = window.__MAP_LOOP_MUSIC_PAUSED_BY_MENU__ ?? false;

function pauseMapLoopMusic() {
  const s = window.__MAP_LOOP_MUSIC__;
  if (!s) return;
  window.__MAP_LOOP_MUSIC_PAUSED_BY_MENU__ = true;
  try { if (typeof s.pause === "function") s.pause(); } catch (_e) {}
}

function resumeMapLoopMusic() {
  const s = window.__MAP_LOOP_MUSIC__;
  if (!s) return;
  if (!window.__MAP_LOOP_MUSIC_PAUSED_BY_MENU__) return;
  window.__MAP_LOOP_MUSIC_PAUSED_BY_MENU__ = false;
  try { if (typeof s.resume === "function") s.resume(); } catch (_e) {}
}



function startMapLoopMusic(scene, key, opts = {}) {
  if (!scene?.sound || !key) return;
  // ✅ 警語期間：只播 warming，不播地圖 BGM
  if (window.__WARNING_ACTIVE__) return;
  stopMapLoopMusic();

  const baseVol = opts.volume ?? 1;
  const master = window.__MUSIC_VOL__ ?? 1;
  const rate = opts.rate ?? 1;
  const detune = opts.detune ?? 0;

  const s = scene.sound.add(key, {
    loop: true,
    volume: baseVol * master,
    rate,
    detune,
  });
  s.play();

  window.__MAP_LOOP_MUSIC__ = s;
  window.__MAP_LOOP_MUSIC_KEY__ = key;
  window.__MAP_LOOP_MUSIC_BASE_VOL__ = baseVol;
}

function refreshMapLoopMusicVolume() {
  const s = window.__MAP_LOOP_MUSIC__;
  if (!s) return;
  const baseVol = window.__MAP_LOOP_MUSIC_BASE_VOL__ ?? 1;
  const master = window.__MUSIC_VOL__ ?? 1;
  try { s.setVolume(baseVol * master); } catch (_e) {}
}

function applyMapLoopMusic(stageKey, sceneOverride) {
  // ✅ 警語期間：只播 warming，不播地圖 BGM
  if (window.__WARNING_ACTIVE__) {
    try { pauseMapLoopMusic(); } catch (_e) {}
    window.__MAP_LOOP_MUSIC_STAGE__ = null;
    return;
  }

  if (window.__MAP_LOOP_MUSIC_STAGE__ === stageKey) return;
  window.__MAP_LOOP_MUSIC_STAGE__ = stageKey;

  const cfg = MAP_LOOP_MUSIC[stageKey];
  const scene = sceneOverride || window.__SCENE__;

  if (!cfg) {
    stopMapLoopMusic();
    return;
  }
  startMapLoopMusic(scene, cfg.key, cfg);
}



function getActiveSliderEl() {
  // 優先：目前聚焦的 range
  const ae = document.activeElement;
  if (ae && ae.tagName === "INPUT" && ae.type === "range") return ae;

  // 次要：如果 settingsPanel 裡面有被點擊過，通常 focus 會在 input 上；沒 focus 就預設調整音效
  return sfxVolEl || musicVolEl || ae;
}

function adjustSlider(el, delta) {
  const cur = Number.parseFloat(el.value || "0");
  const v = Math.max(0, Math.min(1, cur + delta));
  const vv = Number(v.toFixed(2));
  el.value = String(vv);

  // ✅ 真的套用
  if (el === sfxVolEl) window.__SFX_VOL__ = vv;
  if (el === musicVolEl) window.__MUSIC_VOL__ = vv;
}

// ===== Save =====
function snapshotActors(scene) {
  const out = {};
  const A = scene?.actors;
  if (!A) return out;
  for (const [key, spr] of Object.entries(A)) {
    if (!spr) continue;
    out[key] = {
      x: spr.x,
      y: spr.y,
      flipX: !!spr.flipX,
      visible: spr.visible !== false,
      alpha: (typeof spr.alpha === "number") ? spr.alpha : 1,
      angle: (typeof spr.angle === "number") ? spr.angle : 0,
      facing: spr.facing ?? null,
      __isDown: !!spr.__isDown,
      __locked: !!spr.__locked,
      __forcedFlipX: spr.__forcedFlipX ?? null,
    };
  }
  return out;
}

function restoreActors(scene, snap) {
  const A = scene?.actors;
  if (!A || !snap) return;
  for (const [key, st] of Object.entries(snap)) {
    const spr = A[key];
    if (!spr || !st) continue;
    if (typeof st.x === "number") spr.x = st.x;
    if (typeof st.y === "number") spr.y = st.y;
    if (typeof spr.setFlipX === "function") spr.setFlipX(!!st.flipX);
    else spr.flipX = !!st.flipX;
    if (typeof spr.setVisible === "function") spr.setVisible(!!st.visible);
    else spr.visible = !!st.visible;
    if (typeof st.alpha === "number") spr.alpha = st.alpha;
    if (typeof st.angle === "number") spr.angle = st.angle;
    if (st.facing != null) spr.facing = st.facing;
    spr.__isDown = !!st.__isDown;
    spr.__locked = !!st.__locked;
    spr.__forcedFlipX = st.__forcedFlipX ?? null;
  }
}

function saveGame() {
  const scene = window.__SCENE__;
  const payload = {
    t: Date.now(),
    storyStep,
    storyIndex,
    currentDialogId,
    dialogOpen: !!dialogOpen,
    gameFinished: !!gameFinished,
    coffeeFreeRoam: !!window.__COFFEE_FREE_ROAM__,
    stage: window.__STAGE__ || "prologue_fire",
    whiteGardenFired: Object.fromEntries(
      WHITE_GARDEN_TRIGGERS.map(t => [t.id, !!t.fired])
    ),
    actors: {},
  };

  // ✅ 保存所有角色的完整狀態
  if (scene?.actors) {
    for (const [key, actor] of Object.entries(scene.actors)) {
      payload.actors[key] = {
        x: actor.x,
        y: actor.y,
        flipX: actor.flipX,
        facing: actor.facing,
        visible: actor.visible,
        isDown: !!actor.__isDown,
        locked: !!actor.__locked,
        forcedFlipX: actor.__forcedFlipX ?? null,
        angle: actor.angle ?? 0,
        alpha: actor.alpha ?? 1,
      };
    }
  }

  // ✅ 玩家獨立存一次（保險）
  if (scene?.player) {
    payload.player = {
      x: scene.player.x,
      y: scene.player.y,
      facing: scene.player.facing ?? "right",
      flipX: !!scene.player.flipX,
    };
  }

  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  refreshContinueButton();
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ===== Confirm =====
function confirmMenuSelection() {
  const btns = getMenuButtons();
  const currentBtn = btns[menuIndex];

  if (menuIndex === 0) { btnStart.click(); return; }

  if (menuIndex === 1) {
    if (btnContinue.disabled) {
      denyButton(currentBtn);
      showMenuToast("尚無存檔，無法繼續遊戲");
      return;
    }
    btnContinue.click();
    return;
  }

  if (menuIndex === 2) openSettings();

  if (menuIndex === 3) {
    if (!btnBack || btnBack.disabled) {
      denyButton(currentBtn);
      return;
    }
    btnBack.click();
  }
}

// ===== Keyboard =====
function onKeyDown(e) {
  const gs = ensureGameState();
  if (isWarningOpen()) return;
  // ✅ 開頭警語顯示中：擋掉所有快捷鍵（Enter/Space 由警語自己處理）

  // ===== Choice Popup =====
  if (isChoiceOpen()) {
    // 阻止捲動/預設行為
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Enter","Escape","Backspace"].includes(e.key)) e.preventDefault();

    // tease 模式：只允許 Enter/Space 觸發「繼續」
    if (_choiceMode === "tease") {
      if (e.key === "Enter" || e.key === " ") {
        document.getElementById("choiceNext")?.click();
      }
      return;
    }

    // real 模式：上下選、Enter/Space 確認
    if (e.key === "ArrowUp") { setChoiceActive(_choiceIndex - 1); return; }
    if (e.key === "ArrowDown") { setChoiceActive(_choiceIndex + 1); return; }
    if (e.key === "Enter" || e.key === " ") {
      const btns = Array.from(choiceBtnsEl?.querySelectorAll("button") || []);
      btns[_choiceIndex]?.click();
      return;
    }
    return;
  }

// ✅ 遊戲中按 S 存檔（不管 menu 有沒有開）
  if (
    e.code === "KeyS" &&
    gs.phase === "playing" &&
    !menuEl.classList.contains("show") &&
    !ingameMenuEl.classList.contains("show")
  ) {
    saveGame();
    showToast?.("已存檔");
    return;
  }
  // menu 沒開就不處理選單操作
  if (!menuEl.classList.contains("show")) return;

  // 避免捲動/預設行為（把 Enter 也擋掉，避免表單/按鈕預設）
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","Enter"].includes(e.key)) e.preventDefault();

  // ✅ 返回：settings 先關 settings，不在 settings 才關 menu
  if (e.key === "Escape" || e.key === "Backspace") {
    if (settingsPanel.classList.contains("show")) {
      closeSettings();
    } else {
      hideMenu();
    }
    return;
  }

  // ===== MAIN MENU =====
  if (menuMode === "main") {
    if (e.key === "ArrowUp") { setMenuActive(menuIndex - 1); return; }
    if (e.key === "ArrowDown") { setMenuActive(menuIndex + 1); return; }
    if (e.key === "Enter" || e.key === " ") { confirmMenuSelection(); return; }
  }

  // ===== SETTINGS =====
if (menuMode === "settings") {
  if (e.key === "ArrowLeft") { adjustSlider(getActiveSliderEl(), -0.05); return; }
  if (e.key === "ArrowRight") { adjustSlider(getActiveSliderEl(), +0.05); return; }
  if (e.key === "Enter" || e.key === " ") { closeSettings(); return; }
}
}

window.addEventListener("keydown", onKeyDown, { capture: true });

function startNewGame() {
  // ✅ 避免讀檔切場時 DOM 還殘留舊視窗
  closeDialog();
  closeChoicePopup();
  const gs = ensureGameState();
  gs.restoring = false;

  gs.finished = false;
  gs.pendingLoad = null;
  gs.phase = "playing";
  window.__STAGE__ = "prologue_fire";
  hideMenu();
  hideIngameMenu?.();
  if (typeof hideEndOverlay === "function") hideEndOverlay();

  // ✅ 劇情一定回開頭
  gameFinished = false;
  window.__COFFEE_FREE_ROAM__ = false;
  storyStep = 0;
  storyIndex = 0;
  currentDialogId = STORY_FLOW[0];
  dialogOpen = false;

  for (const cfg of WHITE_GARDEN_TRIGGERS) cfg.fired = false;
  const scene = window.__SCENE__;
  if (scene?.input?.keyboard) scene.input.keyboard.resetKeys();

  if (scene) {
    scene.scene.stop();
    scene.scene.start("MainScene", { mode: "new" });
  }
}

function continueGame() {
  // ✅ 避免讀檔切場時 DOM 還殘留舊視窗
  closeDialog();
  closeChoicePopup();
  hideEggImage()
  const gs = ensureGameState();
  gs.restoring = true;
  const data = loadGame();
  if (!data) return;

  gs.finished = !!data.gameFinished;
  gs.pendingLoad = data;
  gs.phase = "playing";

  hideMenu();
  hideIngameMenu?.();
  if (typeof hideEndOverlay === "function") hideEndOverlay();

  // ✅ 不再恢復 dialogOpen，確保回遊戲時對話框關閉
  gameFinished = !!data.gameFinished;
  window.__COFFEE_FREE_ROAM__ = !!data.coffeeFreeRoam;
  storyStep = data.storyStep ?? 0;
  storyIndex = data.storyIndex ?? 0;
  currentDialogId = data.currentDialogId ?? STORY_FLOW[0];
  dialogOpen = false; // force close dialog on continue; scene will reopen only if save says dialogOpen

  // DOM 先關掉，等場景 create() 載入完成再決定要不要打開
  dialogEl.classList.remove("show");
  const firedMap = data.whiteGardenFired || {};
  for (const cfg of WHITE_GARDEN_TRIGGERS) {
    cfg.fired = !!firedMap[cfg.id];
  }

  const scene = window.__SCENE__;
  if (scene?.input?.keyboard) scene.input.keyboard.resetKeys();

  if (scene) {
    scene.scene.stop();
    scene.scene.start("MainScene", { mode: "continue" });
  }
}

btnStart?.addEventListener("click", startNewGame);
btnContinue?.addEventListener("click", () => { if (!btnContinue.disabled) continueGame(); });
btnSettings?.addEventListener("click", openSettings);
// 設定面板內：返回主選單（只關設定，不回到遊戲）
btnSettingsBack?.addEventListener("click", closeSettings);
btnBack?.addEventListener("click", () => {
  // 從主選單返回遊戲：只在「已經進入遊戲」時才允許
  const gs = ensureGameState();
  if (!window.__SCENE__ || gs.finished === true) {
    denyButton(btnBack);
    return;
  }
  hideMenu();
});

// 角色頭像對應（你先只有褚冥漾也OK）
const PORTRAITS = {
  "褚冥漾": {
    normal: "assets/img/chu_portrait.png",
    blood: "assets/img/chu_portrait_blood.png",
    shock: "assets/img/chu_portrait_shock.png",
    deny: "assets/img/chu_portrait_deny.png",
    really: "assets/img/chu_portrait_WTF.png",
    wtf: "assets/img/chu_portrait_shit.png",
    uh: "assets/img/chu_portrait_uh.png",
    cry: "assets/img/chu_portrait_cry.png",
    nolove: "assets/img/chu_portrait_nolove.png",
    no: "assets/img/chu_portrait_no.png",
  },
  "冰炎": {
    normal: "assets/img/bing_portrait.png",
    angry:  "assets/img/bing_portrait_angry.png",
    dark:  "assets/img/bing_portrait_dark.png",
    close:  "assets/img/bing_portrait_close.png",
    closea:  "assets/img/bing_portrait_closea.png",
  },
  "冰炎.": {
    normal: "assets/img/bing_portrait1.png",
    angry:  "assets/img/bing_portrait_angry1.png",
  },
  "（假）冰炎": {
    nor: "assets/img/bing_portrait1.png",
    ang:  "assets/img/bing_portrait_angry1.png",
    dar:  "assets/img/bing_portrait_dark1.png",
    dar1:  "assets/img/bing_portrait_dark2.png",
  },
  "安地爾": {
    normal: "assets/img/coffee_portrait.png",
  },
};

function getPortrait(name, face = "normal") {
  const pack = PORTRAITS[(name || "").trim()];
  if (!pack) return "";
  if (typeof pack === "string") return pack;          // 兼容舊寫法
  return pack[face] || pack.normal || "";
}

const COMMON_TILESETS = [
  { name: "人2",        imageKey: "ts_人2",        imageFile: "assets/maps/tilesets/人2.png" },
  { name: "火",         imageKey: "ts_火",         imageFile: "assets/maps/tilesets/火.png" },
  { name: "房間",       imageKey: "ts_房間",        imageFile: "assets/maps/tilesets/房間.png" },
  { name: "背景",       imageKey: "ts_背景",       imageFile: "assets/maps/tilesets/背景.png" },
  { name: "地面_修改",   imageKey: "ts_地面_修改",  imageFile: "assets/maps/tilesets/地面_修改.png" },
  { name: "草叢下_修改", imageKey: "ts_草叢下_修改", imageFile: "assets/maps/tilesets/草叢下_修改.png" },
  { name: "草叢上_修改", imageKey: "ts_草叢上_修改", imageFile: "assets/maps/tilesets/草叢上_修改.png" },
  { name: "路燈上_修改", imageKey: "ts_路燈上_修改", imageFile: "assets/maps/tilesets/路燈上_修改.png" },
  { name: "路燈下_修改", imageKey: "ts_路燈下_修改", imageFile: "assets/maps/tilesets/路燈下_修改.png" },
  { name: "背景3",      imageKey: "ts_背景3",      imageFile: "assets/maps/tilesets/背景3.png" },
  { name: "二樓 樓梯",   imageKey: "ts_二樓樓梯", imageFile: "assets/maps/tilesets/二樓 樓梯.png" },
  { name: "樓梯欄杆",   imageKey: "ts_樓梯欄杆", imageFile: "assets/maps/tilesets/樓梯欄杆.png" },
  { name: "地毯 一樓",   imageKey: "ts_地毯一樓", imageFile: "assets/maps/tilesets/地毯 一樓.png" },
  { name: "吐司 吧檯",   imageKey: "ts_吐司吧檯", imageFile: "assets/maps/tilesets/吐司 吧檯.png" },
  { name: "咖啡機 流理台",imageKey: "ts_流理台",   imageFile: "assets/maps/tilesets/咖啡機 流理台.png" },
  { name: "小花 桌巾 桌椅",imageKey: "ts_小花桌巾桌椅", imageFile: "assets/maps/tilesets/小花 桌巾 桌椅.png" },
  { name: "外框",        imageKey: "ts_外框", imageFile: "assets/maps/tilesets/外框.png" },
  { name: "果汁機 盤子 麵包籃",   imageKey: "ts_果汁機盤子麵包籃", imageFile: "assets/maps/tilesets/果汁機 盤子 麵包籃.png" },
  { name: "花盆",        imageKey: "ts_花盆", imageFile: "assets/maps/tilesets/花盆.png" },
  { name: "架子 櫥櫃",   imageKey: "ts_架子 櫥櫃", imageFile: "assets/maps/tilesets/架子 櫥櫃.png" },
  { name: "矮櫃 書櫃",   imageKey: "ts_矮櫃 書櫃", imageFile: "assets/maps/tilesets/矮櫃 書櫃.png" },
  { name: "看板 小盆栽",  imageKey: "ts_看板 小盆栽",   imageFile: "assets/maps/tilesets/看板 小盆栽.png" },
  { name: "咖啡杯",       imageKey: "ts_咖啡杯", imageFile: "assets/maps/tilesets/咖啡杯.png" },
  { name: "相框",        imageKey: "ts_相框", imageFile: "assets/maps/tilesets/相框.png" },
];

const TILEMAPS = {
  prologue_fire: {
    mapKey: "map_prologue_fire",
    mapFile: "assets/maps/prologue_fire.tmj",
    tilesets: COMMON_TILESETS,
    collisionLayerNames: ["Collision"],   // ✅ 改成 TMJ 真的有的 layer 名
  },
  white_garden: {
    mapKey: "map_white_garden",
    mapFile: "assets/maps/white_garden.tmj",
    tilesets: COMMON_TILESETS,
    collisionLayerNames: ["Collision"],
  },
  blackhall: {
    mapKey: "map_blackhall",
    mapFile: "assets/maps/blackhall.tmj",
    tilesets: COMMON_TILESETS,
  },
  coffee: {
    mapKey: "map_coffee",
    mapFile: "assets/maps/coffee.tmj",
    collisionLayerNames: ["Collision"],
    tilesets: COMMON_TILESETS,
  },
};

const STAGE_SPAWN = {
  blackhall: {
    bed: { x: 130, y: 80 },
    default: { x: 80, y: 144 }
  },
  white_garden: {
    entry: { x: 120, y: 195 },     // 例：入口
    pond:  { x: 380, y: 140 },     // 例：池邊
    default: { x: 240, y: 200 }
  },
  coffee: {
    default: { x: 20, y: 178 }, // ✅ 對齊 tmj 的 player_spawn
  },
};

const WHITE_GARDEN_TRIGGERS = [
  // 你可以依地圖調整座標/大小
  { id: "white_garden", x: 570, y: 200, w: 30, h: 5, once: true, fired: false },
  // { id: "pond_event", x: 340, y: 120, w: 70, h: 50, once: false, fired: false },
];


const DIALOGS = {
  prologue_fire: [
    { name: "  ", text: "戰火肆虐，青青草地被大火蔓延染上枯涸色彩；空氣中瀰漫著殘缺屍體被火吻後、好似烤肉香同時卻又夾雜著腐臭味，令人作嘔。" },
    { name: "  ", text: "褚冥漾回過神看見自己熟悉的場景變化，臉上佈滿驚恐。" },
    { name: "  ", action: { type: "move", actor: "chu", dx: -24, dy: 0, ms: 300 }, auto: true },
    { name: "褚冥漾", text: "怎、怎麼回事......", face: "shock"},
    { name: "  ", text: "學院裡似乎沒有一個活口。"},
    { name: "  ", text: "他不過是出了一場黑袍任務而已，回來時候便收到公會系統癱瘓，學院遭到不知名強大力量攻擊。" },
    { name: "  ", text: "他一收到消息趕緊跑回來，卻在校園門口因為焦急一時不察踩到陷阱。" },
    { name: "  ", text: "頓時就像頭被人重擊暈眩不已，等到思緒清晰後人已在校園內。" },
    { name: "  ", text: "看著腳下的殘骸，入眼的面孔有些熟悉、有些有印象、有些陌生不已，但表情全是生前遭受到重大攻擊的驚恐與絕望。" },
    { name: "  ", text: "即便是他這樣早已走過許多荊棘、歷盡許多的人，胃都還是忍不住翻騰。" },
    { name: "褚冥漾", text: "唔......嘔......", face: "uh" },
    { name: "  ", text: "摀住嘴，褚冥漾長年累積的沉穩不允許他此時露出脆弱。" },
    { name: "  ", text: "他掏出米納斯對著地板開出一槍，以水氣在自己周遭隔開出較為清爽的空間。" },
    { name: "  ", text: "在不破壞周遭一切的情況下，他回過身想找到夥伴們會合，了解到底發生什麼事情，還有現況到底是怎麼回事。", action: { type: "face", actor: "chu", dir: "left" } },
    { name: "  ", text: "卻沒想到在自己轉身的那一剎，不知何時自己身後卻站著一個人——可利器卻已沒入自己胸口。", action: [
     { type: "set", actor: "bing", key: "__forcedFlipX", value: true },
     { type: "sfx", key: "shu", volume: 0.5 },
     { type: "dashBehind", actor: "bing", target: "chu", dx: -10, dy: 0, ms: 220 } 
     ]},
    { name: "  ", text: "他瞪大眼睛詫異，憑他的能力居然沒發覺身後有人。" },
    { name: "  ", text: "而當他看清來者時，詫異被不可置信給取代。" },
    { name: "  ", text: "沒入體內的兇器是他再熟悉不能的烽云凋戈。順著槍身，他看到那白皙蔥指有著微不可察的顫抖。" },
    { name: "褚冥漾", text: "學長......為什麼......", face: "blood" },
    { name: "冰炎.", text: "閉嘴！褚冥漾！", face: "angry" },
    { name: "  ", text: "學長打斷他的口氣有著憤恨、失望。紅瞳中倒映著褚冥漾蒼白的面容，可卻被憎恨充盈。" },
    { name: "冰炎.", text: "你——背叛了我們——", face: "angry" },
    { name: "  ", text: "褚冥漾想要辯解，但一啟唇就是一口腥甜。絳紅順著嘴角流下，褚冥漾雙腿已快無力。" },
    { name: "褚冥漾", text: "我......沒有......我......沒......背、背叛......", face: "blood" },
    { name: "冰炎.", text: "住口！", face: "angry" },
    { name: "  ", text: "不願看到曾經的學弟那乞求的目光，冰炎眼一閉。" },
    { name: "  ", text: "他還是顧及褚冥漾之間的情份；他能做的就是減少對方的痛苦，送對方儘早投胎。" },
    { name: "  ", text: "噗嗤！", action: [
  { type: "move", actor: "bing", dx: -5, dy: 0, ms: 200 },
  { type: "sfx", key: "hurt", volume: 0.5 },
  { type: "cameraZoom", from: 3, to: 4.2, ms: 200 },
  { type: "flashWhite", peak: 0.95, msIn: 50, msOut: 200 },
  { type: "sfx", key: "blooding", volume: 0.5 },
  { type: "cameraShake", ms: 180, intensity: 0.02 },
] },
    { name: "  ", text: "感受到心臟被硬生生的刺碎摧毀，褚冥漾的眼眸滑出一滴淚。" },
    { name: "  ", text: "隨後本來熠熠生輝的瞳孔失去了色彩，染上了灰；身子就如同斷了線的布娃娃，在長槍被抽出時破敗不堪的落在地上。", action: [
      { type: "move", actor: "bing", dx: 5, dy: 0, ms: 200 },
      { type: "fall", actor: "chu", ms: 650 }
    ] },
    { name: "  ", text: "死不瞑目的褚冥漾、趴在地上的褚冥漾，生命停留於此刻——",   action: [
  { type: "wait", ms: 180 },
  { type: "cameraZoom", to: 1.5, ms: 260, ease: "Quad.easeOut" },
  ] },
  { name: "  ", text: "（……）", action: [
  { type: "fadeBlack", to: 1, ms: 450 },
  { type: "gotoStage", stage: "blackhall", spawn: "bed" },
  { type: "lay", actor: "chu", ms: 1, angle: 90 },
  { type: "fadeBlack", to: 0, ms: 650 }
  ]},
  ],

  wake_blackhall: [
    { name: "  ", text: "（……）",  action: [
    { type: "flashWhite", peak: 0.8, msIn: 60, msOut: 220 },
    { type: "sitUp", actor: "chu", ms: 450 },
    { type: "fadeBlack", to: 0, ms: 450 }
  ]},
    { name: "褚冥漾", text: "哈！", face: "shock" },
    { name: "  ", text: "從床上直起身，褚冥漾額角佈滿冷汗。他環顧四周，昏暗的空間、窗外點點繁星。" },
    { name: "  ", text: "褚冥漾摸著胸口，不禁鬆口氣。" },
    { name: "褚冥漾", text: "還好只是一場夢……", face: "normal" },
    { name: "  ", text: "自己則是在黑館房內。" },
    { name: "  ", text: "深呼吸一口氣，雖然餘悸猶存，但對於還是地球人的褚冥漾睡眠還是很重要。" },
    { name: "  ", text: "他躺回床上，閉上眼前心想：希望別再做這樣的夢。" },
    { name: "  ", text: "（……）", action: [
      { type: "gotoStage", stage: "white_garden", spawn: "entry" },
      { type: "fadeBlack", to: 0, ms: 450 }
]}
  ],

  white_garden: [
    { name: "  ", text: "再一次睜眼，白園青草藍天、吹拂過臉上的微風中帶有著花草香。" },
    { name: "  ", text: "褚冥漾看著附近的大樹，上頭大氣精靈開心的唱歌跳舞。" },
    { name: "  ", text: "驀然間，一道聲音打破這樣的寧靜。" },
    { name: "？？？", text: "褚冥漾——你這個背叛者！" },
    { name: "  ", text: "回過身褚冥漾看向來者，只見對方手舉著一把它熟悉到不能再熟悉的長弓，指著他吶喊他是背叛者。", action: { type: "face", actor: "chu", dir: "left" } },
    { name: "千冬歲", text: "褚冥漾！你竟敢傷害夏碎哥！", action: [ 
      { type: "show", actor: "qian" },
      { type: "sfx", key: "running", volume: 0.3 },
      { type: "runTo", actor: "qian", x: 425, y: 196, ms: 450 }
 ]},
    { name: "褚冥漾", text: "......蛤？", face: "shock" },
    { name: "褚冥漾", text: "『他說的那個夏碎哥是我知道的那個夏碎學長嗎？』", face: "really" },
    { name: "褚冥漾", text: "『應該......？是......吧？』", face: "really" },
    { name: "褚冥漾", text: "『我打夏碎？真的假的？』", face: "uh" },
    { name: "褚冥漾", text: "修但幾類，你先冷靜一點千冬歲......", face: "really" },
    { name: "  ", text: "一句｢你是不是認錯人了？｣還沒說出口，遠處又傳來一道聲音打斷褚冥漾的辯解。" },
    { name: "？？？", text: "你為什麼要率領鬼族攻擊公會的醫療班？" },
    { name: "米可蕥", text: "喵喵對你實在是太失望了！" , action: [ 
      { type: "runTo", actor: "qian", x: 450, y: 170, ms: 500 }, 
      { type: "show", actor: "cat" },
      { type: "sfx", key: "running", volume: 0.5 },
      { type: "runTo", actor: "cat", x: 425, y: 196, ms: 450 }
    ]},
    { name: "米可蕥", text: "一直以來喵喵都看錯人了！虧喵喵一直以來都把你當朋友看！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "cat" },
   ]},
    { name: "褚冥漾", text: "喵喵？！", face: "shock" },
    { name: "米可蕥", text: "沒想到你到現在竟然還不承認罪行！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "cat" },
   ]},
    { name: "褚冥漾", text: "你們有給我辯解的機會嗎！！！", face: "wtf" },
    { name: "  ", text: "這時，米可蕥往旁邊移動了些，給來人讓出些位置。", action: [ 
      { type: "runTo", actor: "qian", x: 450, y: 165, ms: 500 }, 
      { type: "runTo", actor: "cat", x: 405, y: 170, ms: 500 },
      { type: "show", actor: "ryan" },
     { type: "sfx", key: "running", volume: 0.5 },
      { type: "runTo", actor: "ryan", x: 420, y: 196, ms: 500 }
    ]},
    { name: "米可蕥", text: "你看！把萊恩打得都只能隱身了！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "cat" },
   ]},
    { name: "萊恩？", text: "......" },
    { name: "褚冥漾", text: "......" },
    { name: "褚冥漾", text: "屁啦！！！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "褚冥漾", text: "『槽點太多了不知道該從哪裡開始吐槽......』", face: "deny" },
    { name: "褚冥漾", text: "『這絕對是有人偷工減料吧......』", face: "wtf" },
    { name: "萊恩？", text: "你不再是我萊恩．史凱爾的朋友了。" },
    { name: "褚冥漾", text: "你還是先解除隱身狀態吧！！！", face: "really", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "萊恩？", text: "我不會隱身......", action: { type: "runTo", actor: "qian", x: 455, y: 145, ms: 500 } },
    { name: "  ", text: "萊恩一臉失落（雖然其實根本看不到表情）的往旁邊移動了一些。", action:{ type: "runTo", actor: "ryan", x: 440, y: 167, ms: 600 } },
    { name: "千冬歲", text: "你這個邪惡的妖師！現在竟然還對萊恩進行精神攻擊！！！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "qian" } 
  ]},
    { name: "褚冥漾", text: "千冬歲你睜開眼睛看看啊！我不信你兩眼空空看不清楚是誰在傷害萊恩！！！", face: "wtf" },
    { name: "千冬歲", text: "閉嘴！你這個背叛者沒資格喊我的名字，聽了就噁心!", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "qian" },
   ]},
    { name: "褚冥漾", text: "到底是怎樣啊！！！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "  ", text: "在褚冥漾怒吼完後，遠處再次傳來一個聲音。" },
    { name: "？？？", text: "褚冥漾！勸你乖乖束手就擒！" },
    { name: "褚冥漾", text: "還來啊......這次又是誰？", face: "really" },
    { name: "  ", text: "出場的人有著一頭流沙般華美的金髮，潔白的翅膀和一身黑袍，身分不言而喻。", action: [ 
      { type: "show", actor: "angel" },
      { type: "runTo", actor: "angel", x: 420, y: 200, ms: 500 }
    ]},
    { name: "安因", text: "為什麼......要傷害賽塔？" },
    { name: "褚冥漾", text: "......" },
    { name: "褚冥漾", text: "......", face: "uh" },
    { name: "褚冥漾", text: "......哩喜勒靠！！！！！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "褚冥漾", text: "安因你不是天使嗎？！你要不要聽聽看你在說甚麼？！！！", face: "wtf" },
    { name: "褚冥漾", text: "我打賽塔？？！！那像話嗎？！", face: "wtf" },
    { name: "褚冥漾", text: "我怎麼打？？！用米納斯嗎？！他隨便一個肘擊就能把我肋骨打斷了好嗎！！！", face: "wtf" },
    { name: "安因", text: "漾漾，天堂地獄一念之間，路是自己走出來的，別把自己的路走絕了，好嗎？" },
    { name: "褚冥漾", text: "......我唯一的路就是跑路。", face: "uh" },
    { name: "安因", text: "那就沒辦法了......褚冥漾，我奉公會之令，在此討伐你。" },
    { name: "褚冥漾", text: "聽我說話啊！！！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "西瑞", text: "漾～要統治世界怎麼不找本大爺～", action: [ 
      { type: "show", actor: "five" },
      { type: "sfx", key: "running", volume: 0.3 },
      { type: "runTo", actor: "five", x: 420, y: 200, ms: 300 },
      { type: "sfx", key: "hit", volume: 0.3 },
      { type: "runTo", actor: "angel", x: 430, y: 225, ms: 400 },
      { type: "sfx", key: "emote", volume: 0.3 },
      { type: "emote", actor: "angel", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 },
    ]},
    { name: "褚冥漾", text: "『嗯，終於來了個正常的。』"},
    { name: "褚冥漾", text: "『但來的是最不正常的那一個......』", face: "cry" },
    { name: "  ", text: "安因微微瞇起眼睛，語氣溫和卻又帶著不可侵犯的氣勢：" },
    { name: "安因", text: "西瑞．羅耶伊亞同學，如今這個狀況，有必要再影響褚同學添一把亂嗎？" },
    { name: "西瑞", text: "干你這個天使什麼事情？本大爺說好了要跟小弟浪跡天涯統治世界！" },
    { name: "褚冥漾", text: "『不對，我根本沒說好好嗎？』", face: "uh" },
    { name: "安因", text: "這可不行，別說我們同不同意，公會已經下達命令，我們有責任阻止——妖師的叛變。" },
    { name: "西瑞", text: "哈！你想打架嗎？老子奉陪！" },
    { name: "  ", text: "就在褚冥漾思考要不要阻止眼前的一切或乾脆趁機跑路時，不知何時，西瑞已經走到了褚冥漾身前將他護在身後。", action: [ 
      { type: "toPlayer", actor: "five", side: "auto", gap: 1 },
      { type: "face", actor: "five", dir: "left" }
  ]},
    { name: "褚冥漾", text: "......西瑞？"},
    { name: "西瑞", text: "如果全世界都要殺本大爺小弟，那本大爺就帶著你殺光全世界，來一個殺一雙！" },
    { name: "褚冥漾", text: "『......雖然我應該聽了要很感動，但不需要好嗎？然後你的數學成績是誰教的，猴子嗎？』", face: "nolove" },
    { name: "？？？", text: "褚冥漾！" },
    { name: "  ", text: "褚冥漾心累了，他眼神死的望向來人，是前幾天才見過面的水妖精，但不知道是哪一個。", action: [ 
      { type: "show", actor: "twins1" },
      { type: "runTo", actor: "angel", x: 435, y: 255, ms: 500 },
      { type: "sfx", key: "running", volume: 0.3 },
      { type: "runTo", actor: "twins1", x: 420, y: 205, ms: 500 } 
      ]},
    { name: "雷多", text: "褚冥漾！你為什麼要傷害伊多！！！" },
    { name: "  ", text: "褚冥漾此時已經完全沒有驚恐、困惑以及吐槽的慾望，他只有一種｢嗯，果然如此」的感想。", face: "nolove" },
    { name: "  ", text: "而此時，褚冥漾身後傳來了另一個與雷多聲線極為相似的男聲。" },
    { name: "雅多", text: "雷多，你清醒一點！", action: [
  { type: "show", actor: "twins2" },
  { type: "sfx", key: "running", volume: 0.3 },
  { type: "toPlayer", actor: "twins2", enterFrom: "right", enterDist: 260, side: "right", gapY: 1, ms: 250 }
]},
    { name: "雅多", text: "漾漾的實力哪有辦法打傷伊多！！", action: { type: "toPlayer", actor: "twins2", side: "up", gapY: 1, ms: 450 }},
    { name: "褚冥漾", text: "『真是謝囉！！！』", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "  ", text: "聞聽此言，雷多原本憤怒如惡鬼的臉轉為困惑，紅色的雙眸逐漸變回溫潤的褐色，他張口欲言，卻又很快抿緊唇瓣，似乎是想不出更合理的理由反駁。" },
    { name: "雷多", text: "可是......影像球上......" },
    { name: "  ", text: "雷多似乎還想掙扎一下，可隨後一個溫潤的聲音打斷了他的思緒，也讓他的雙眸重新亮起。" },
    { name: "伊多", text: "雷多。", action: [
  { type: "show", actor: "bigbro" },
  { type: "face", actor: "bigbro", dir: "left" },
  { type: "sfx", key: "running", volume: 0.3 },
  { type: "toPlayer", actor: "bigbro", enterFrom: "right", enterDist: 260, side: "right", gapY: 1, ms: 450 },
  ]},
    { name: "雷多", text: "伊多！", action: { type: "toPlayer", actor: "bigbro", side: "down", gapY: 1, ms: 450 }},
    { name: "  ", text: "伴隨著雷多驚喜的聲音，水妖精如風一般衝到伊多面前，擋在他身前面向眾人。", action: [
  { type: "sfx", key: "shu", volume: 0.5 },
  { type: "toActor", actor: "twins1", target: "bigbro", side: "left", gap: 1, speed: 500 },
  { type: "face", actor: "twins1", dir: "left" }
  ]},
    { name: "雷多", text: "對不起，漾漾，我剛剛竟然懷疑你。" },
    { name: "褚冥漾", text: "......沒關係。" },
    { name: "褚冥漾", text: "『倒不如說我才想謝謝你相信我的實力。』", face: "cry" },
    { name: "  ", text: "氣氛變得有些詭譎，水妖精三兄弟的談話皆被在場眾人聽進耳裡，不少人臉上都出現了動搖。" },
    { name: "  ", text: "最後是千冬歲打破了詭異的平靜。" },
    { name: "千冬歲", text: "大家不要被騙了！邪惡的妖師肯定是使用了言靈操控了獸王族跟水妖精三兄弟！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "qian" },
   ] },
    { name: "褚冥漾", text: "千冬歲哩系中猴喔！！！你也太看得起我了吧！！！", face: "wtf", action: [
      { type: "sfx", key: "emote", volume: 0.3 },
      { type: "emote", actor: "chu", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 }
   ]},
    { name: "千冬歲", text: "大家都清楚你有怎樣強大的力量，不要再裝蒜了！" },
    { name: "？？？", text: "沒錯。", action: [
  { type: "show", actor: "ran" },
  { type: "show", actor: "moon" }
  ]},
    { name: "  ", text: "來人聲音不大，卻一下吸引了所有人的注意——是白陵然，身後跟著褚冥玥。", action: [
      { type: "sfx", key: "running", volume: 0.3 },
      { type: "runTo", actor: "ran", x: 435, y: 200, ms: 600 },
      { type: "sfx", key: "running", volume: 0.3 },
      { type: "runTo", actor: "moon", x: 400, y: 205, ms: 450 } 
    ]},
    { name: "  ", text: "若是平時，在看到白陵然後，褚冥漾應該會感到安心，然而一堆好友腦袋突然變得不正常，加上白陵然和褚冥玥兩人凝重的臉色，讓褚冥漾有種非常、非常不好的預感。" },
    { name: "  ", text: "白陵然率先開口，他幾乎是用一種痛心疾首的表情看著褚冥漾，聲音很輕：" },
    { name: "白陵然", text: "漾漾，你為什麼要傷害辛西亞？" },
    { name: "褚冥漾", text: "......" },
    { name: "褚冥漾", text: "......", face: "uh" },
    { name: "褚冥漾", text: "......", face: "wtf" },
    { name: "褚冥漾", text: "『我．就．知．道。』", face: "cry" },
    { name: "褚冥漾", text: "『不，不對，我不知道，我根本不知道我怎麼做的。』", face: "cry" },
    { name: "  ", text: "在褚冥漾還沒反應過來前，換褚冥玥咬著牙開口了。" },
    { name: "褚冥玥", text: "漾漾，辛西亞從來沒有虧待過你，她還做綠豆湯給你喝，為什麼要傷害她？" },
    { name: "褚冥漾", text: "......", face: "shock" },
    { name: "褚冥漾", text: "......", face: "deny" },
    { name: "褚冥漾", text: "你是誰？！！你！絕！對！不！是！我！姊！！！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "褚冥漾", text: "快把頭腦正常的我姊還給我！", face: "cry" },
    { name: "褚冥漾", text: "不對！快把頭腦正常的所有人還給我！！！", face: "cry", action: [
      { type: "sfx", key: "emote", volume: 0.3 },
      { type: "emote", actor: "chu", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 }
   ]},
    { name: "白陵然", text: "褚冥漾，既然你拒不承認，我也只能......把你逐出妖師一族。" },
    { name: "褚冥漾", text: "不是，我剛剛說什麼了！然你腦袋還好嗎？！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "褚冥玥", text: "褚冥漾，你再也不是我弟弟了！" },
    { name: "褚冥漾", text: "這裡有人在聽我說話嗎！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "？？？", text: "看來白色種族間的友誼不過如此。", action: { type: "show", actor: "coffee" } },
    { name: "  ", text: "耳邊的聲音相當熟悉，熟悉到讓褚冥漾的寒毛瞬間豎起，甚至不用回頭就知道對方的身分。", action: [
      { type: "face", actor: "coffee", dir: "left" },
      { type: "toPlayer", actor: "coffee", enterFrom: "right", enterDist: 260, side: "right", gapY: 3, ms: 150 }
   ] },
    { name: "  ", text: "褚冥漾幾乎是立刻回頭同時往後跳開，在腦袋反應過來前，手裡就已經握住米納斯對準來人，其餘在場眾人也紛紛改變方才宛如過家家般的態度，如臨大敵的面對不請自來的｢客人」。", action: [
      { type: "face", actor: "chu", dir: "right" },
      { type: "move", actor: "chu", dx: -15, dy: 0, ms: 200 },
      { type: "face", actor: "five", dir: "right" },
      { type: "face", actor: "bigbro", dir: "right" },
      { type: "face", actor: "twins2", dir: "left" },
      { type: "face", actor: "twins1", dir: "right" }
      ]},
    { name: "褚冥漾", text: "安地爾！", face: "uh" },
    { name: "褚冥漾", text: "『為什麼這個變臉人......呃？』", face: "really" },
    { name: "安地爾", text: " "},
    { name: "褚冥漾", text: "......" },
    { name: "安地爾", text: "（笑？）"},
    { name: "褚冥漾", text: "......", face: "deny" },
    { name: "安地爾", text: "（可能大概也許是在笑）"},
    { name: "褚冥漾", text: "......", face: "deny" },
    { name: "褚冥漾", text: "......", face: "wtf" },
    { name: "  ", text: "被眾多武器包圍的安地爾卻絲毫不顯慌張，臉上仍然掛著游刃有餘的微笑，彷彿這只不過是幼兒間的嬉戲打鬧，簡單掃過在場眾人各異的臉色後，輕笑一聲開口：" },
    { name: "安地爾", text: "不用那麼緊張，我目前正在休假中。" },
    { name: "褚冥漾", text: "『咖啡杯可以休假嗎？』", face: "really" },
    { name: "千冬歲", text: "你......" },
    { name: "褚冥漾", text: "『千冬歲？你終於要清醒了嗎？』", face: "really" },
    { name: "褚冥漾", text: "『快看清楚啊！對面這個別說是鬼族了，根本就是個咖啡杯啊！！還有很多奇怪的地方啊！！！』", face: "nolove" },
    { name: "千冬歲", text: "褚冥漾你竟然還跟鬼族勾結！！！", action: [
      { type: "sfx", key: "emote", volume: 0.3 },
      { type: "emote", actor: "qian", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 },
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "qian" }
   ]},
    { name: "褚冥漾", text: "（發自內心）幹！", face: "wtf", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
    { name: "褚冥漾", text: "千冬歲你視力還好嗎？！", face: "wtf" },
    { name: "千冬歲", text: "我的視力不需要背叛者關心！"},
    { name: "褚冥漾", text: "我不是那個意思！！", face: "wtf" },
    { name: "  ", text: "也許是笑話終於看夠了，此時安地爾才慢悠悠開口：" },
    { name: "安地爾", text: "那麼凡斯的後代，既然你都被白色種族排斥了，要不要乾脆加入我這邊呢？", action: { type: "andiel_tease" } },

  ]
};
// =========================
// Dialog patch: Andiel branch (two-stage choice) (guarded)
// =========================
(function patchAndielBranchDialogs(){
  if (window.__ANDIEL_DIALOG_PATCHED__) return;
  window.__ANDIEL_DIALOG_PATCHED__ = true;

  try{
    // Ensure ending/branch dialogs exist
    if (!DIALOGS.coffee_branch) {
      DIALOGS.coffee_branch = [
        { name: "  ", text: "(......)" },
        { name: "  ", text: "一陣白光閃過，耳邊嘈雜的人聲如潮水般退去，眼前風景迅速轉換，不再是寧靜（也許也沒那麼寧靜）的白園，來到一個詭異又荒謬......不，一個看起來意外的正常的地方。", action: { type: "show", actor: "coffee" } },
        { name: "安地爾", text: "歡迎來到我的休假地點。", action: { type: "toPlayer", actor: "coffee", enterFrom: "left", enterDist: 260, side: "right", gapY: 1, ms: 250 } },
        { name: "褚冥漾", text: "......咖啡廳？", face: "really" },
        { name: "  ", text: "不是褚冥漾想像中的黑色空間還是什麼詭異地方之類的，這裡的裝潢溫馨，空氣中甚至能聞到淡淡的咖啡香味。" },
        { name: "  ", text: "安地爾臉上仍是那副輕鬆的笑容，他緩步走到畫面中唯一的桌椅旁，卻沒有坐下。", action: { type: "runTo", actor: "coffee", x: 325, y: 175, ms: 1000 } },
        { name: "  ", text: "也許是因為根本坐不下。" },
        { name: "褚冥漾", text: "『你是在賣你自己嗎？』" },
        { name: "安地爾", text: "你好像在想一些很失禮的事情呢。" },
        { name: "褚冥漾", text: "。", face: "uh" },
        { name: "  ", text: "安地爾似乎絲毫不在意褚冥漾擺出的態度，自顧自地繼續說道：" },
        { name: "安地爾", text: "你還沒意識到嗎？你正在作夢。" },
        { name: "  ", text: "安地爾的話彷彿瞬間打通褚冥漾的任督二脈，腦海霎時閃過那些一開始就覺得奇怪的部分。" },
        { name: "  ", text: "朋友們齊齊說些奇怪的話、完全不聽自己說話、奇怪的選項......" },
        { name: "褚冥漾", text: "你在我的夢裡做什麼？！", face: "uh" },
        { name: "安地爾", text: "只是來找你敘敘舊而已。" },
        { name: "安地爾", text: "順帶一提，這裡已經不是你的夢了。" },
        { name: "褚冥漾", text: "『不要隨便帶人去奇怪的地方！』", face: "wtf" },
        { name: "褚冥漾", text: "你到底想幹嘛？", face: "deny" },
        { name: "安地爾", text: "別緊張，我都說我現在是休假狀態。" },
        { name: "  ", text: "看著褚冥漾明顯不信的表情，安地爾也只是輕笑一聲，沒有辯駁。" },
        { name: "安地爾", text: "想跟你閒談一小會也還真是不容易，這麼快就有人干涉了。" },
        { name: "安地爾", text: "我們來做個交易吧。" },
        { name: "褚冥漾", text: "我不跟咖啡杯做交易。", face: "uh" },
        { name: "  ", text: "安地爾無視了褚冥漾帶刺的話語，朝褚冥漾走去，以迅雷不及掩耳的速度拔了一搓他的毛髮。", action: [
        { type: "runTo", actor: "coffee", x: 40, y: 175, ms: 450 },
        { type: "move", actor: "chu", dx: -10, dy: 0, ms: 250 },
       ]},
        { name: "褚冥漾", text: "？？！！", face: "wtf" },
        { name: "安地爾", text: "報酬我收到了，你想留下來逛逛或是想離開都可以。", action: [
        { type: "runTo", actor: "coffee", x: 223, y: 173, ms: 900 },
        { type: "runTo", actor: "coffee", x: 223, y: -100, ms: 1200 },
       ] },
        { name: "不那麼快樂的Happy End", text: "妖師的頭髮-1，但逃脫了夢境。" },
        { name: "  ", text: "恭喜通過！可以留下來找找安地爾的咖啡廳有甚麼彩蛋喔！觸發所有彩蛋即可離開！" },
      ];
    }
    if (!DIALOGS.ending_B) {
      DIALOGS.ending_B = [
        { name: "安地爾", text: "真遺憾。", action: [
      { type: "show", actor: "qian" },
      { type: "show", actor: "cat" },
      { type: "show", actor: "ryan" },
      { type: "show", actor: "angel" },
      { type: "show", actor: "five" },
      { type: "show", actor: "twins1" },
      { type: "show", actor: "twins2" },
      { type: "show", actor: "bigbro" },
      { type: "show", actor: "ran" },
      { type: "show", actor: "moon" },
      { type: "show", actor: "coffee" },
  ] },
        { name: "褚冥漾", text: "你是不是對自己現在長什麼樣不太清楚。", face: "deny" },
        { name: "  ", text: "安地爾沒有再試圖逼迫褚冥漾，反而只是輕鬆的聳了聳肩。" },
        { name: "安地爾", text: "別緊張，我都說我現在是休假狀態。" },
        { name: "  ", text: "說完，安地爾竟然就這麼離開了，讓人完全摸不清楚頭腦。", action: { type: "runTo", actor: "coffee", x: 1000, y: 205, ms: 450 } },
        { name: "褚冥漾", text: "......這傢伙到底來幹嘛的？", face: "uh" },
        { name: "千冬歲", text: "褚冥漾你還不認罪嗎？", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "qian" },
   ] },
        { name: "褚冥漾", text: "......差點忘記你了。", face: "cry", action: [
      { type: "face", actor: "chu", dir: "left" },
      { type: "move", actor: "chu", dx: 10, dy: 0, ms: 200 },
      { type: "face", actor: "five", dir: "left" },
      { type: "face", actor: "bigbro", dir: "left" },
      { type: "face", actor: "twins2", dir: "right" },
      { type: "face", actor: "twins1", dir: "left" }
      ] },
        { name: "？？？", text: "褚冥漾！！！", action: { type: "toPlayer", actor: "bing", enterFrom: "left", side: "left", offsetX: 600, ms: 250 }},
        { name: "褚冥漾", text: "怎麼還有啊！！！", face: "wtf" },
        { name: "  ", text: "來人褚冥漾再熟悉不過，一雙紅色的眼眸穿過人群直直瞪向他，眼裡燃燒的怒火像是快把他吞噬。", action: [
      { type: "show", actor: "bing" },
      { type: "runTo", actor: "angel", x: 435, y: 255, ms: 450 },
      { type: "runTo", actor: "ran", x: 415, y: 235, ms: 450 },
      { type: "runTo", actor: "moon", x: 380, y: 235, ms: 450 },
      { type: "runTo", actor: "bing", x: 440, y: 205, ms: 450 },
    ] },
        { name: "冰炎.", text: "你——背叛了我們——", face: "angry" },
        { name: "褚冥漾", text: "學長，怎麼你也腦子不正常了！", face: "nolove" },
        { name: "褚冥漾", text: "不對，怎麼感覺這個對話似曾相似？", face: "really" },
        { name: "？？？", text: "那是因為你在作夢。", action: { type: "show", actor: "bingt" } },
        { name: "  ", text: "", action: [
      { type: "face", actor: "bingt", dir: "left" },
      { type: "toPlayer", actor: "bingt", enterFrom: "right", side: "right", offsetX: 32, ms: 250 },
       ] },
        { name: "褚冥漾", text: "咦？！！", face: "shock", action: [
      { type: "cameraShake", ms: 180, intensity: 0.05 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
        { name: "  ", text: "褚冥漾猛地回頭，身後的那人是如此的熟悉，銀色的長髮在腦後束成俐落的馬尾，紅色的眼眸微微瞇起，正似笑非笑的盯著褚冥漾。", action: { type: "face", actor: "chu", dir: "right" } },
        { name: "褚冥漾", text: "？？？", face: "shock", action: { type: "face", actor: "chu", dir: "right" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "left" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "right" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "left" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "right" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "left" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "right" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "left" }, auto: true },
        { name: "  ", text: "", action: { type: "face", actor: "chu", dir: "right" } },
        { name: "冰炎", text: "......你在幹嘛？", action: [
      { type: "sfx", key: "emote", volume: 0.3 },
      { type: "emote", actor: "bingt", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 }
   ], face: "dark" },
        { name: "褚冥漾", text: "在確認哪個是真的學長。"},
        { name: "  ", text: "冰炎的嘴角抽搐了一下，閉上眼揉了揉眉心，額角青筋直跳捏緊拳頭看向褚冥漾。" },
        { name: "冰炎", text: "需要我幫你回憶一下嗎？", face: "closea", action: { type: "move", actor: "bingt", dx: -10, dy: 0, ms: 300 } },
        { name: "褚冥漾", text: "不用了謝謝。", action: { type: "move", actor: "chu", dx: -8, dy: 0, ms: 300 }, face: "nolove" },
        { name: "（假）冰炎", text: "褚。", face: "ang" },
        { name: "  ", text: "褚冥漾回過頭，看向頭髮顏色明顯錯邊的假學長。", action: { type: "face", actor: "chu", dir: "left" } },
        { name: "  ", text: "他正用一種......彷彿看到學弟找了個拙劣替代品的表情看著褚冥漾。"},
        { name: "（假）冰炎", text: "", face: "dar" },
        { name: "  ", text: "並且準備將他分屍丟大海。"},
        { name: "冰炎", text: "給我閉腦！！", face: "dark", action: [
        { type: "move", actor: "bingt", dx: -10, dy: 0, ms: 300 },
        { type: "sfx", key: "hit", volume: 0.5 },
        { type: "cameraShake", ms: 100, intensity: 0.05 },
        { type: "move", actor: "bingt", dx: 10, dy: 0, ms: 300 }
       ]},
        { name: "褚冥漾", text: "『好熟悉的感覺......』", face: "cry", action: { type: "face", actor: "chu", dir: "right" } },
        { name: "（假）冰炎", text: "褚！你不要再墮落了！快離開那個仿冒品！", face: "dar1", action: { type: "move", actor: "bing", dx: 10, dy: 0, ms: 300 } },
        { name: "  ", text: "對於（假）冰炎的言論，冰炎沒什麼表情，只是又瞪了褚冥漾一眼。" },
        { name: "冰炎", text: "你還沒意識到你在作夢嗎？需要我再巴你一下嗎？"},
        { name: "  ", text: "冰炎的話彷彿瞬間打通褚冥漾的任督二脈，腦海霎時閃過那些一開始就覺得奇怪的部分。" },
        { name: "  ", text: "朋友們齊齊說些奇怪的話、完全不聽自己說話、奇怪的選項、還有此刻，除了冰炎與他之外的｢所有人」都僵立在原地不再動彈、說話。" },
        { name: "  ", text: "夢境，開始崩解。", action: [
        { type: "hide", actor: "qian" },
        { type: "hide", actor: "bing" },
        { type: "hide", actor: "bingt" },
        { type: "hide", actor: "cat" },
        { type: "hide", actor: "ryan" },
        { type: "hide", actor: "moon" },
        { type: "hide", actor: "five" },
        { type: "hide", actor: "angel" },
        { type: "hide", actor: "ran" },
        { type: "hide", actor: "twins2" },
        { type: "hide", actor: "bigbro" },
        { type: "hide", actor: "twins1" },
        { type: "sfx", key: "breaking", volume: 0.5 },
        { type: "cameraShake", ms: 180, intensity: 0.1 },
        { type: "fadeBlack", to: 1, ms: 650 },
        { type: "gotoStage", stage: "blackhall", spawn: "bed" },
        { type: "face", actor: "bingt", dir: "right" },
        { type: "face", actor: "chu", dir: "left" },
        { type: "lay", actor: "chu", ms: 1, angle: 90 },
        { type: "runTo", actor: "bingt", x: 101, y: 46, ms: 250 },
        { type: "runTo", actor: "cat", x: 84, y: 68, ms: 250 },
        { type: "runTo", actor: "qian", x: 81, y: 95, ms: 250 },
        { type: "runTo", actor: "ryan", x: 101, y: 114, ms: 250 },
        { type: "runTo", actor: "five", x: 140, y: 47, ms: 250 },
        { type: "runTo", actor: "moon", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "ran", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "angel", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "twins2", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "bigbro", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "twins1", x: 900, y: 900, ms: 250 },
        { type: "fadeBlack", to: 0, ms: 650 },
        { type: "show", actor: "bingt" },
        { type: "show", actor: "qian" },
        { type: "show", actor: "cat" },
        { type: "show", actor: "ryan" },
        { type: "show", actor: "five" }
       ]},
           { name: "  ", text: "（……）",  action: [
        { type: "flashWhite", peak: 0.8, msIn: 60, msOut: 220 },
        { type: "gotoStage", stage: "blackhall", spawn: "bed" },
        { type: "face", actor: "bingt", dir: "right" },
        { type: "face", actor: "chu", dir: "left" },
        { type: "lay", actor: "chu", ms: 1, angle: 90 },
        { type: "runTo", actor: "bingt", x: 101, y: 46, ms: 250 },
        { type: "runTo", actor: "cat", x: 84, y: 68, ms: 250 },
        { type: "runTo", actor: "qian", x: 81, y: 95, ms: 250 },
        { type: "runTo", actor: "ryan", x: 101, y: 114, ms: 250 },
        { type: "runTo", actor: "five", x: 127, y: 47, ms: 250 },
        { type: "runTo", actor: "moon", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "ran", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "angel", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "twins2", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "bigbro", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "twins1", x: 900, y: 900, ms: 250 },
        { type: "runTo", actor: "bing", x: 900, y: 900, ms: 250 },
        { type: "fadeBlack", to: 0, ms: 450 }
       ], auto: true},
        { name: "褚冥漾", text: "哈！", face: "shock", action: [
        { type: "sitUp", actor: "chu", ms: 450 },
        { type: "fadeBlack", to: 0, ms: 650 }
       ]},
        { name: "冰炎", text: "清醒了嗎？"},
        { name: "米可蕥", text: "太好了漾漾！你終於醒了！", action: [
      { type: "sfx", key: "jump", volume: 0.3 },
      { type: "jump", actor: "cat" },
   ]},
        { name: "千冬歲", text: "你已經昏睡三天了。" },
        { name: "  ", text: "褚冥漾環顧四周，這是他在黑館的房間，他的朋友圍繞著床，面上滿是擔憂，包括看不見的萊恩。" },
        { name: "褚冥漾", text: "『啊......萊恩還是看不見啊......』", face: "nolove" },
        { name: "萊恩", text: "？怎麼了嗎？" },
        { name: "褚冥漾", text: "沒什麼。" },
        { name: "千冬歲", text: "是說......漾漾。" },
        { name: "褚冥漾", text: "嗯？" },
        { name: "千冬歲", text: "我在你心中的印象有這麼差嗎？夢裡的我也失智得太誇張了吧？" },
        { name: "褚冥漾", text: "嗯？！", action: [
      { type: "cameraShake", ms: 180, intensity: 0.08 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ], face: "really" },
        { name: "米可蕥", text: "就是啊漾漾！夢裡的我們好過份喔！" },
        { name: "褚冥漾", text: "欸？！", action: [
      { type: "cameraShake", ms: 180, intensity: 0.08 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ], face: "really" },
        { name: "  ", text: "就連平時少言寡語的萊恩此時也開了口：" },
        { name: "萊恩", text: "我不會那麼做的，漾漾。" },
        { name: "  ", text: "褚冥漾猛地轉向冰炎，他親愛的學長正一副看好戲般的姿態，雙手環胸，背靠著牆慢悠悠開口：" },
        { name: "冰炎", text: "都看到了。" },
        { name: "冰炎", text: "你夢裡的內容大家都看到了。" },
        { name: "褚冥漾", text: "欸？！？！？！？！", action: [
      { type: "cameraShake", ms: 180, intensity: 0.1 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ], face: "shock" },
        { name: "  ", text: "最終，這件事以褚冥漾社死結束了。" },
        { name: "True End", text: "你協助褚冥漾打破次元壁，沒有付出代價就回到現實。" },
      ];
    }

    const lines = DIALOGS?.white_garden;
    if (!Array.isArray(lines)) return;

    // 找到安地爾那句（用 text 內容定位，不靠 action，避免版本打架）
    const i = lines.findIndex(l => (l?.name === "安地爾") && (typeof l?.text === "string") && l.text.includes("凡斯的後代"));
    if (i < 0) return;

    // 如果已經有 andiel_choice 注入，就不要再注入第二次
    const already = lines.slice(i+1, i+10).some(l => l?.action?.type === "andiel_choice" || l?.__andielInjected === true);
    // 把這句設成 tease（只設一次）
    if (!lines[i].action) lines[i].action = { type: "andiel_tease" };

    if (already) return;

    const injected = [
      { name: "褚冥漾", face: "wtf", text: "為什麼會有選項啊？！我是在玩遊戲嗎？", __andielInjected: true },
      { name: "  ", text: "（建議按S存檔）", __andielInjected: true },
      { name: "  ", text: "（現在，真的要做出選擇了。）", action: { type: "andiel_choice" }, __andielInjected: true },
      // opt2 的後續不要直接放在這裡，避免「沒選也看得到」；由 andiel_choice 自己切到 ending_B
    ];

    lines.splice(i+1, 0, ...injected);
  } catch(e) {
    console.warn("[patchAndielBranchDialogs] failed", e);
  }
})();


// =========================
// Coffee triggers dialogs (defaults; you can overwrite in DIALOGS)
// =========================
(function patchCoffeeTriggerDialogs(){
  if (window.__COFFEE_TRIGGER_DIALOG_PATCHED__) return;
  window.__COFFEE_TRIGGER_DIALOG_PATCHED__ = true;

  if (!DIALOGS["coffee_trigger_Memory"]) {
    DIALOGS["coffee_trigger_Memory"] = [
      { name: "  ", text: "褚冥漾在矮櫃上發現一個空空如也的相框。" },
      { name: "褚冥漾", text: "『安地爾幹嘛在這裡擺一個空相框......嗯？』", face: "uh" },
      { name: "  ", text: "（觸發了不存在的記憶。）" },
      { name: "  ", text: "（……）", action: { type: "eggImage", key: "idol", state: "in" } },
      { name: "褚冥漾", text: "『這裡是哪裡......？』", face: "really" },
      { name: "褚冥漾", text: "『舞台？！我剛剛不是還在咖啡廳嗎？！』", face: "shock" },
      { name: "路人A", text: "冰炎我們愛你！！！" },
      { name: "路人B", text: "漾漾加油！！！" },
      { name: "褚冥漾", text: "『那是在喊我嗎？......嗯？』" },
      { name: "  ", text: "褚冥漾的視線掃向台下應援的粉絲們，發現了一個熟悉的到讓人想吐的身影。" },
      { name: "褚冥漾", text: "『安！地！爾！！！怎麼又是你！怎麼總是你！！！』", face: "wtf", action: [
      { type: "cameraShake", ms: 200, intensity: 0.1 },
      { type: "sfx", key: "cameraShake", volume: 0.3 },
   ]},
      { name: "  ", text: "只見剛剛才離開的安地爾赫然出現在應援的粉絲群之中，見他看過來甚至還朝他眨眨眼。" },
      { name: "褚冥漾", text: "『......』", face: "deny" },
      { name: "  ", text: "燈光一閃，褚冥漾下意識閉上眼，等待這一陣過強的光線過去。" },
      { name: "褚冥漾", text: "『呃......燈光好亮......』", face: "uh" },
      { name: "  ", text: "（……）", action: { type: "eggImage", state: "out" } },
      { name: "褚冥漾", text: "......剛剛那是怎樣？", face: "really" },
      { name: "  ", text: "恭喜獲得彩蛋之一！────捏他自「偶像在身邊」", action: { type: "sfx", key: "ding", volume: 0.3 } },
    ];
  }
  if (!DIALOGS["coffee_trigger_coffee"]) {
    DIALOGS["coffee_trigger_coffee"] = [
      { name: "  ", text: "吧檯附近飄來濃郁的咖啡香，讓褚冥漾忍不住多看了兩眼。" },
      { name: "褚冥漾", text: "這杯咖啡怎麼單獨放在這裡......" },
      { name: "  ", text: "（不存在的記憶湧入腦海。）" },
      { name: "  ", text: "（……）", action: { type: "eggImage", key: "coffee", state: "in" } },
      { name: "  ", text: "耳邊傳來杯盤碰撞的清脆聲響，還有稀稀疏疏的談話聲，空氣中瀰漫著濃郁的咖啡香氣。" },
      { name: "褚冥漾", text: "『這裡是哪裡......？咖啡廳？』" },
      { name: "客人A", text: "不好意思，我想要點餐。" },
      { name: "冰炎", text: "來了。" },
      { name: "褚冥漾", text: "『學長？！』" },
      { name: "  ", text: "看著冰炎穿著跟自己一模一樣的服裝，褚冥漾忍不住開始想：" },
      { name: "褚冥漾", text: "『冰牙族跟燄之谷難道破產了嗎？』" },
      { name: "褚冥漾", text: "『呃，我不會因為看到學長被迫兼差打工的辛酸畫面而被滅口吧？』" },
      { name: "  ", text: "冰炎替客人點完餐，一轉頭就發現平時還算機靈的褚冥漾呆呆地站在原地一動也不動，眉頭一皺，三兩步上前低聲提醒。" },
      { name: "冰炎", text: "你在發什麼呆？要是身體不舒服就先去休息室待一會。", face: "angry" },
      { name: "褚冥漾", text: "欸？啊......我沒事。" },
      { name: "冰炎", text: "沒事就快去送餐，別傻站著。", face: "angry" },
      { name: "褚冥漾", text: "喔喔。" },
      { name: "客人B", text: "不好意思，這裡的空盤可以幫我們收一收嗎？" },
      { name: "  ", text: "趁此機會，褚冥漾趕緊逃離了自家學長彷彿要吃人的目光。" },
      { name: "褚冥漾", text: "來了。" },
      { name: "  ", text: "（……）", action: { type: "eggImage", state: "out" } },
      { name: "褚冥漾", text: "......剛剛那是怎樣？", face: "really" },
      { name: "褚冥漾", text: "呃......身體好痛，感覺像真的打了一整天工一樣......", face: "uh" },
      { name: "  ", text: "恭喜獲得彩蛋之一！────捏他自2020紀念特展咖啡廳活動", action: { type: "sfx", key: "ding", volume: 0.3 } },
    ];
  }
})();

// 1) 章節順序（一定要放在 currentDialogId 前）
const STORY_FLOW = [
  "prologue_fire",
  "wake_blackhall",
  "white_garden",
  "coffee_branch"
];

let gameFinished = false;
let storyStep = 0;          // 目前跑到第幾段（第幾章節）
let currentDialogId = STORY_FLOW[0];
let storyIndex = 0;         // 章節內第幾句
let dialogOpen = false;

// ===== Branch flags =====
let andielBranch = null;           // null | "opt1" | "opt2"
let __BLOCK_AUTO_NEXT_ONCE__ = false; // 避免換章節時 auto-next 跳過第一句

// ===== Coffee free roam (after coffee_branch) =====
window.__COFFEE_FREE_ROAM__ = window.__COFFEE_FREE_ROAM__ ?? false;

function normalizeName(n) {
  return (n || "").trim();
}

function actionMentionsActor(action, actorName) {
  if (!action) return false;
  const arr = Array.isArray(action) ? action : [action];
  return arr.some(a => a && a.actor === actorName);
}

// 這個判斷：只要在目前進度以前出現過「冰炎說話」或「action 用到 bing」，就視為冰炎應該在場
function shouldBingBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);
    if (n === "冰炎") return true;
    if (actionMentionsActor(lines[i]?.action, "bing")) return true;
  }
  return false;
}

// 第三人：只要在目前進度以前出現過 action show qian 或 speaker 為 ？？？ 就顯示
function shouldqianBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);
    if (n === "？？？") return true;

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "qian")) return true;
  }
  return false;
}

function shouldcatBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);
    if (n === "？？？") return true;

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "cat")) return true;
  }
  return false;
}

function shouldryanBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "ryan")) return true;
  }
  return false;
}

function shouldAngelBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "angel")) return true;
  }
  return false;
}

function shouldFiveBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "five")) return true;
  }
  return false;
}

function shouldMoonBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "moon")) return true;
  }
  return false;
}

function shouldRanBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "ran")) return true;
  }
  return false;
}

function shouldTwins1BeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "twins1")) return true;
  }
  return false;
}

function shouldTwins2BeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "twins2")) return true;
  }
  return false;
}

function shouldBroBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "bigbro")) return true;
  }
  return false;
}

function shouldCoffeeBeVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "coffee")) return true;
  }
  return false;
}
function shouldActorBeVisibleByShowAction(lines, idx, actorKey) {
  for (let i = 0; i <= idx; i++) {
    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === actorKey)) return true;
  }
  return false;
}

function shouldBingVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "bing")) return true;
  }
  return false;
}

function shouldBingtVisible(lines, idx) {
  for (let i = 0; i <= idx; i++) {
    const n = normalizeName(lines[i]?.name);

    const action = lines[i]?.action;
    const arr = Array.isArray(action) ? action : [action];
    if (arr.some(a => a && a.type === "show" && a.actor === "bingt")) return true;
  }
  return false;
}

function flattenActions(action) {
  if (!action) return [];
  return Array.isArray(action) ? action.filter(Boolean) : [action];
}

function lineMentionsBing(line) {
  const n = normalizeName(line?.name);
  if (n === "冰炎") return true;
  return flattenActions(line?.action).some(a => a?.actor === "bing");
}


function applyStoryWorldState(scene) {
  if (!scene?.actors) return;

  const lines = DIALOGS[currentDialogId] || [];
  const idx = Math.max(0, Math.min(storyIndex ?? 0, lines.length - 1));

  const chu  = scene.actors.chu || scene.player;
  const bing = scene.actors.bing;
  const qian = scene.actors.qian;
  const cat = scene.actors.cat;
  const ryan = scene.actors.ryan;
  const angel = scene.actors.angel;
  const five = scene.actors.five;
  const moon = scene.actors.moon;
  const ran = scene.actors.ran;
  const twins1 = scene.actors.twins1;
  const twins2 = scene.actors.twins2;
  const bigbro = scene.actors.bigbro;
  const coffee = scene.actors.coffee;
  const bingt = scene.actors.bingt;

  // ---- 預設：先清掉殘留（重要） ----
  if (bing?.setVisible) bing.setVisible(false);
  if (qian?.setVisible) qian.setVisible(false);
  if (cat?.setVisible) cat.setVisible(false);
  if (ryan?.setVisible) ryan.setVisible(false);
  if (angel?.setVisible) angel.setVisible(false);
  if (five?.setVisible) five.setVisible(false);
  if (moon?.setVisible) moon.setVisible(false);
  if (ran?.setVisible) ran.setVisible(false);
  if (twins1?.setVisible) twins1.setVisible(false);
  if (twins2?.setVisible) twins2.setVisible(false);
  if (bigbro?.setVisible) bigbro.setVisible(false);
  if (coffee?.setVisible) coffee.setVisible(false);
  if (bingt?.setVisible) bingt.setVisible(false);

  // ========== A) prologue_fire：冰炎 ==========
  if (currentDialogId === "prologue_fire" && bing && chu) {
  const gs = ensureGameState();

  // 1) 是否應該出現（你原本邏輯可沿用）
  const shouldShow = lines.slice(0, idx + 1).some(lineMentionsBing);
  if (!shouldShow) {
    bing.setVisible(false);
    bing.__locked = false; // ✅ 退場就解除鎖定
    bing.__forcedFlipX = null; // ✅ 清掉，後面不再強制朝左
    return;
  }
  bing.setVisible(true);
  if (bing.__forcedFlipX === true) bing.setFlipX(true);

  // 2) 判斷「dashBehind 是否已經在過去發生過」
  //    只看 idx 之前，避免干擾當句 dashBehind 的演出
  const upto = idx - 1;
  let lastDash = null;

  for (let i = 0; i <= upto; i++) {
    const acts = flattenActions(lines[i]?.action);
    for (const a of acts) {
      if (a?.type === "dashBehind" && a.actor === "bing") lastDash = a;
    }
  }

  // ✅ 已經 dashBehind 過：平常不要再重設 bing 位置（避免 fall 後瞬移）
  if (lastDash) {
  if (!gs.restoring && bing.__locked) {
    // ✅ 即使 return，也要保證翻面被套用
    if (bing.__forcedFlipX === true) bing.setFlipX(true);
    return;
  }

    // ✅ 只有讀檔 or 第一次需要定位時才補一次位置
    const distX = Math.abs(lastDash.dx ?? 18);
    const distY = lastDash.dy ?? 0;
    const sign = (chu.facing === "left") ? +1 : -1;

    bing.x = chu.x + sign * distX;
    bing.y = chu.y + distY;

    bing.__locked = true;     // ✅ 鎖定：之後不再跟著 chu 重算
    return;
  }

  // ✅ 還沒 dashBehind（例如在那句之前）：先放在「對面」等著
  //    這裡也用 facing 決定左右，避免方向怪
  const signOpp = (chu.facing === "left") ? -1 : +1;
  bing.x = chu.x + signOpp * 140;
  bing.y = chu.y;
}

  // ========== B) white_garden：第三人 ==========
  if (currentDialogId === "white_garden" && qian) {
  qian.setVisible(shouldqianBeVisible(lines, idx));
}

if (currentDialogId === "ending_B" && qian) {
  qian.setVisible(shouldqianBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && cat) {
  cat.setVisible(shouldcatBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && cat) {
  cat.setVisible(shouldcatBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && ryan) {
  ryan.setVisible(shouldryanBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && ryan) {
  ryan.setVisible(shouldryanBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && angel) {
  angel.setVisible(shouldAngelBeVisible(lines, idx));
}

if (currentDialogId === "ending_B" && angel) {
  angel.setVisible(shouldAngelBeVisible(lines, idx));
}

if (currentDialogId === "ending_B" && qian) {
  qian.setVisible(shouldqianBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && five) {
  five.setVisible(shouldFiveBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && five) {
  five.setVisible(shouldFiveBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && moon) {
  moon.setVisible(shouldMoonBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && moon) {
  moon.setVisible(shouldMoonBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && ran) {
  ran.setVisible(shouldRanBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && ran) {
  ran.setVisible(shouldRanBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && twins1) {
  twins1.setVisible(shouldTwins1BeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && twins1) {
  twins1.setVisible(shouldTwins1BeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && twins2) {
  twins2.setVisible(shouldTwins2BeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && twins2) {
  twins2.setVisible(shouldTwins2BeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && bigbro) {
  bigbro.setVisible(shouldBroBeVisible(lines, idx));
}
if (currentDialogId === "ending_B" && bigbro) {
  bigbro.setVisible(shouldBroBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && coffee) {
  coffee.setVisible(shouldCoffeeBeVisible(lines, idx));
}
if (currentDialogId === "coffee_branch" && coffee) {
  coffee.setVisible(shouldActorBeVisibleByShowAction(lines, idx, "coffee"));
}
if (currentDialogId === "ending_B" && coffee) {
  coffee.setVisible(shouldCoffeeBeVisible(lines, idx));
}

if (currentDialogId === "ending_B" && bing) {
  bing.setVisible(shouldBingVisible(lines, idx));
}

if (currentDialogId === "ending_B" && bingt) {
  bingt.setVisible(shouldBingtVisible(lines, idx));
}
}

function lineHasGotoStage(line) {
  const acts = Array.isArray(line?.action) ? line.action : [line?.action];
  return acts.some(a => a && a.type === "gotoStage");
}

async function renderDialog() {
  const lines = DIALOGS[currentDialogId] || [];
  const line = lines[storyIndex];
  if (!line) return;
  applyStoryWorldState(window.__SCENE__);

  const hasText = typeof line.text === "string" && line.text.trim().length > 0;
  if (!hasText && line?.action && line?.auto) {
    await runAction(line.action);

    const delay = line.autoDelay ?? 350;
    setTimeout(() => {
      if (!dialogOpen) return;
      if (__BLOCK_AUTO_NEXT_ONCE__) { __BLOCK_AUTO_NEXT_ONCE__ = false; return; }
      nextDialog();
    }, delay);

    return;
  }
  dialogNameEl.textContent = line?.name ?? "";
  dialogTextEl.textContent = line?.text ?? "";

  // ✅ 左側頭像：有對應就顯示，沒有就隱藏
  const speaker = normalizeName(line.name);
  const src = speaker ? getPortrait(speaker, line.face) : "";
  if (src) {
    dialogPortraitEl.src = src;
    dialogPortraitEl.classList.remove("hidden");
  } else {
    dialogPortraitEl.classList.add("hidden");
  }

  // ✅ 跑動作（支援 action 陣列）
  if (line?.action) {
    await runAction(line.action);
  }

  if (lineHasGotoStage(line)) {
  const b = window.__SCENE__?.actors?.bing;
  if (b) {
    b.__forcedFlipX = null;
    b.setFlipX(false);   // 你想回到預設朝右就 false
  }
}

  // ✅ auto 自動下一句
  if (line?.auto) {
    const delay = line.autoDelay ?? 350;
    setTimeout(() => {
      if (!dialogOpen) return;
      if (__BLOCK_AUTO_NEXT_ONCE__) { __BLOCK_AUTO_NEXT_ONCE__ = false; return; }
      nextDialog();
    }, delay);
  }
}

function openCurrentDialog() {
  currentDialogId = STORY_FLOW[storyStep];
  storyIndex = 0;
  dialogOpen = true;
  dialogEl.classList.add("show");
  // ✅ 進入該段劇情時，啟動/切換循環音效
  try { applyStageLoopSfx(currentDialogId); } catch (_e) {}
  // 手機：對話開啟時可讓方向鍵消失
  try { window.__MZ_UPDATE_MOBILE_PAD__?.(); } catch (_e) {}
  renderDialog();
}

function closeDialog() {
  dialogOpen = false;
  dialogEl.classList.remove("show");
  // 手機：對話關閉時恢復方向鍵
  try { window.__MZ_UPDATE_MOBILE_PAD__?.(); } catch (_e) {}
  // ✅ 以防萬一：對話關閉時也把選項收起來
  closeChoicePopup();
}

function lineHasDashBehindBing(line) {
  const acts = Array.isArray(line?.action) ? line.action : [line?.action];
  return acts.some(a => a && a.type === "dashBehind" && a.actor === "bing");
}


// side dialog ids：不推進 STORY_FLOW，也不顯示 END
function isSideDialogId(id){
  return typeof id === "string" && (
    id.startsWith("coffee_trigger_") ||
    id.startsWith("coffee_easter_")
  );
}

function openDialogById(id, { side = false } = {}) {
  if (!id) return;
  // side 對話：不改 storyStep，只換 currentDialogId
  currentDialogId = id;
  storyIndex = 0;
  dialogOpen = true;
  dialogEl.classList.add("show");
  try { applyStageLoopSfx(currentDialogId); } catch (_e) {}
  try { window.__MZ_UPDATE_MOBILE_PAD__?.(); } catch (_e) {}
  renderDialog();
}
function nextDialog() {
  const lines = DIALOGS[currentDialogId] || [];
  // ✅ 先判斷「現在這一句」是不是 dashBehind
  const wasDash = lineHasDashBehindBing(lines[storyIndex]);
  storyIndex++;

if (storyIndex >= lines.length) {
  closeDialog();

  // ✅ side dialogs：看完就回到自由探索（不推進章節，也不顯示 END）
  if (isSideDialogId(currentDialogId)) {
    // ✅ coffee 彩蛋：每個 trigger 都「至少觸發過一次」後，直接進 END
    if (window.__COFFEE_FREE_ROAM__ && Array.isArray(window.__COFFEE_EGG_IDS__) && window.__COFFEE_EGG_IDS__.length) {
      const fired = window.__COFFEE_TRIGGER_FIRED__ || {};
      const done = window.__COFFEE_EGG_IDS__.every(k => !!fired[k]);
      if (done) {
        gameFinished = true;
        showEndOverlay();
        return;
      }
    }

    // 回到主線章節 id（避免存檔時停在 side dialog）
    currentDialogId = STORY_FLOW[storyStep] || currentDialogId;
    storyIndex = (DIALOGS[currentDialogId] || []).length;
    return;
  }

  // ✅ coffee_branch 結束：進入 coffee 自由探索模式（不顯示 END）
  if (currentDialogId === "coffee_branch") {
    window.__COFFEE_FREE_ROAM__ = true;
    gameFinished = false;

    // ✅ 劇情結束後：停止原本 coffee 的 BGM，改播 coloregg
    try {
      MAP_LOOP_MUSIC.coffee = { key: "coloregg", volume: 0.30 };
      applyMapLoopMusic("coffee");
    } catch(_e) {}

    try { showToast("（咖啡廳：可自由探索彩蛋）"); } catch(_e) {}
    try { window.__SCENE__?.enableCoffeeTriggers?.(true); } catch(_e) {}
    return;
  }


  // ✅ ending_B：結局 B 結束就直接 END（不進下一章）
  if (currentDialogId === "ending_B") {
    gameFinished = true;
    showEndOverlay();
    return;
  }

  // ✅ 安地爾分支：選項二走結局 B（留在白園，不進下一章）
  if (currentDialogId === "white_garden" && andielBranch === "opt2") {
    gameFinished = true;
    showEndOverlay();
    return;
  }

  if (storyStep < STORY_FLOW.length - 1) {
    storyStep++;
    const nextId = STORY_FLOW[storyStep];
    if (nextId === "white_garden") {
      // 進白園後，等待玩家走到觸發點
      // （觸發點會在 gotoStage('white_garden') 時建立）
      return;
    }
    openCurrentDialog();
  } else {
    // ✅ 已經是最後一章：標記完成
    gameFinished = true;
    showEndOverlay();   // ✅ 這行才是顯示 END
  }
  return;
}
  renderDialog();
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 1500);
}

function getIngameButtons(){ return [btnSave, btnStatus, btnResume]; }

function setIngameActive(i) {
  const btns = getIngameButtons();
  btns.forEach(b => b.classList.remove("active"));
  ingameIndex = (i + btns.length) % btns.length;
  btns[ingameIndex].classList.add("active");
}

function showIngameMenu() {
  const gs = ensureGameState();
  if (gs.phase !== "playing") return;

  ingameMenuEl.classList.add("show");
  ingameMode = "menu";
  gs.phase = "paused";

  window.__SCENE__?.scene.pause();
  setIngameActive(0);

  ingameMenuEl.setAttribute("tabindex","-1");
  ingameMenuEl.focus();
}

function hideIngameMenu() {
  const gs = ensureGameState();

  ingameMenuEl.classList.remove("show");
  saveConfirmEl.classList.remove("show");
  statusPanel.classList.remove("show");

  ingameMode = "menu";
  gs.phase = "playing";

  window.__SCENE__?.scene.resume();
}

function getSaveConfirmButtons() {
  return [btnSaveYes, btnSaveNo];
}

function setSaveConfirmActive(i) {
  const btns = getSaveConfirmButtons();
  btns.forEach(b => b.classList.remove("active"));
  saveConfirmIndex = (i + btns.length) % btns.length;
  btns[saveConfirmIndex].classList.add("active");
  btns[saveConfirmIndex].focus();
}

btnSave.addEventListener("click", () => {
  ingameMode = "saveConfirm";
  saveConfirmEl.classList.add("show");
  saveConfirmEl.setAttribute("tabindex", "-1");
  saveConfirmEl.focus();
  setSaveConfirmActive(0);
});

btnSaveYes.addEventListener("mouseenter", () => setSaveConfirmActive(0));
btnSaveNo.addEventListener("mouseenter", () => setSaveConfirmActive(1));

btnSaveYes.addEventListener("click", () => {
  saveGame();
  showToast("已存檔");
  saveConfirmEl.classList.remove("show");
  ingameMode = "menu";
  setIngameActive?.(0);        // 可選：回到第一個選項
  ingameMenuEl.focus();        // 可選：把焦點還給副選單
});

btnSaveNo.addEventListener("click", () => {
  saveConfirmEl.classList.remove("show");
  ingameMode = "menu";
  ingameMenuEl.focus();
});

function positionStatusCard() {
  if (!statusCard || !ingameMenuEl) return;

  const gap = 16; // 卡片與選單距離
  const menuRect = ingameMenuEl.getBoundingClientRect();

  // 先以「貼右邊」為目標
  let left = menuRect.right + gap;
  let top  = menuRect.top;

  // 顯示後才能拿到正確 card 尺寸，所以確保 statusPanel 已 show
  const cardRect = statusCard.getBoundingClientRect();

  // 右側超出 → 往左貼齊螢幕邊界
  const maxLeft = window.innerWidth - cardRect.width - 16;
  left = Math.min(left, maxLeft);

  // 上下超出 → 往內縮
  const maxTop = window.innerHeight - cardRect.height - 16;
  top = Math.min(Math.max(top, 16), maxTop);

  statusCard.style.left = `${left}px`;
  statusCard.style.top  = `${top}px`;
}

// 你可以之後改成從遊戲狀態讀取
const STATUS_DATA = {
  chu: {
    name: "褚冥漾",
    race: "妖師",
    state: "生存",
    skill: "詛咒別人上廁所沒紙\n正進化成火爆小辣椒中",
    avatar: "./assets/img/chu_portrait.png" // ←換成你的實際路徑
  }
};

function isActorAlive(key) {
  const a = window.__SCENE__?.actors?.[key];
  if (!a) return true;
  return !a.__isDown;
}

function openStatus(key = "chu") {
  const d = STATUS_DATA[key];
  if (!d) return;

  statusAvatar.src = d.avatar;
  statusName.textContent = d.name;
  statusRace.textContent = d.race;
  statusState.textContent = isActorAlive(key) ? "生存" : "死亡";
  statusSkill.textContent = d.skill;

  statusPanel.classList.add("show");
  statusPanel.setAttribute("aria-hidden", "false");
  ingameMode = "status";
}

function closeStatus() {
  statusPanel.classList.remove("show");
  statusPanel.setAttribute("aria-hidden", "true");
  ingameMode = "menu";
}

btnStatus.addEventListener("click", () => {
  ingameMode = "status";
  openStatus("chu");
  statusPanel.classList.add("show");

  // 等瀏覽器把 show 套用後再量尺寸定位
  requestAnimationFrame(() => {
    positionStatusCard();
  });
});

window.addEventListener("resize", () => {
  if (ingameMode === "status" && statusPanel.classList.contains("show")) {
    positionStatusCard();
  }
});

btnResume.addEventListener("click", () => {
  hideIngameMenu();
});


window.addEventListener("keydown", (e) => {
  if (menuEl.classList.contains("show")) return;
  if (e.code === "KeyQ") {
    if (ingameMenuEl.classList.contains("show")) hideIngameMenu();
    else showIngameMenu();
    return;
  }

  if (!ingameMenuEl.classList.contains("show")) return;

  e.preventDefault();

  // ESC：返回
  if (e.key === "Escape") {
    if (ingameMode === "saveConfirm") {
      saveConfirmEl.classList.remove("show");
      ingameMode = "menu";
    } else if (ingameMode === "status") {
      statusPanel.classList.remove("show");
      ingameMode = "menu";
    } else {
      hideIngameMenu();
    }
    return;
  }

  // 主副選單操作
  if (ingameMode === "menu") {
    if (e.key === "ArrowUp") { setIngameActive(ingameIndex - 1); return; }
    if (e.key === "ArrowDown") { setIngameActive(ingameIndex + 1); return; }
    if (e.key === "Enter") { 
      getIngameButtons()[ingameIndex].click();
      return; // ✅ 超重要：避免同一次 Enter 直接「確認存檔」
    }
  }
  // 存檔確認
if (ingameMode === "saveConfirm") {
  if (e.key === "ArrowUp")   { setSaveConfirmActive(saveConfirmIndex - 1); return; }
  if (e.key === "ArrowDown") { setSaveConfirmActive(saveConfirmIndex + 1); return; }
  if (e.key === "Enter")     { getSaveConfirmButtons()[saveConfirmIndex].click(); return; }
}
}, { capture:true });
refreshContinueButton();

window.__ACTOR_VIS_SNAPSHOT__ = null;

function snapshotActorVisibility(scene) {
  const snap = {};
  const actors = scene?.actors || {};
  for (const [k, a] of Object.entries(actors)) {
    if (!a) continue;
    snap[k] = {
      visible: !!a.visible,
      alpha: a.alpha,
      angle: a.angle,
      flipX: !!a.flipX,
      // 你也可以加 facing / __isDown 等
      facing: a.facing ?? null,
      isDown: !!a.__isDown,
    };
  }
  // 也存 player（如果你 player 不在 actors）
  if (scene?.player) {
    snap.__player__ = {
      visible: !!scene.player.visible,
      alpha: scene.player.alpha,
      angle: scene.player.angle,
      flipX: !!scene.player.flipX,
      facing: scene.player.facing ?? null,
    };
  }
  window.__ACTOR_VIS_SNAPSHOT__ = snap;
}

function applyActorVisibilitySnapshot(scene) {
  const snap = window.__ACTOR_VIS_SNAPSHOT__;
  if (!snap) return false;

  const actors = scene?.actors || {};
  for (const [k, s] of Object.entries(snap)) {
    if (k === "__player__") continue;
    const a = actors[k];
    if (!a) continue;

    if (s.visible != null) a.setVisible(!!s.visible);
    if (s.alpha != null) a.alpha = s.alpha;
    if (s.angle != null) a.angle = s.angle;
    if (s.flipX != null) a.setFlipX(!!s.flipX);
    if (s.facing != null) a.facing = s.facing;

    // 倒地狀態（依你專案習慣調）
    if (s.isDown) {
      a.__isDown = true;
      // angle/alpha 已套過了，不一定要重設
    } else {
      a.__isDown = false;
    }
  }

  if (scene?.player && snap.__player__) {
    const s = snap.__player__;
    if (s.visible != null) scene.player.setVisible(!!s.visible);
    if (s.alpha != null) scene.player.alpha = s.alpha;
    if (s.angle != null) scene.player.angle = s.angle;
    if (s.flipX != null) scene.player.setFlipX(!!s.flipX);
    if (s.facing != null) scene.player.facing = s.facing;
  }

  return true;
}

function runAction(action) {
  if (!action) return Promise.resolve();

    // ✅ 支援 action: [ {...}, {...} ] 串接
  if (Array.isArray(action)) {
    return action.reduce(
      (p, a) => p.then(() => runAction(a)),
      Promise.resolve()
    );
  }

  const scene = window.__SCENE__;
  const A = scene?.actors;
  if (!scene || !A) return Promise.resolve();

  const getActor = (key) => A[key];
  // =========================
  // Andiel branch actions (A/B endings) (guarded by window flags)
  // =========================
  window.__ANDIEL_BRANCH__ = window.__ANDIEL_BRANCH__ || null;

  if (action.type === "andiel_tease") {
    return (window.openChoiceTease ? window.openChoiceTease({
      title: "請選擇",
      desc: "請先 Enter/Space 繼續",
      options: [
        { text: "我就是餓死，死外邊，從這裡跳下去，也不會跟你走！！！" },
        { text: "你要不要看看你現在長什麼樣子？？？" },
      ],
    }) : Promise.resolve());
  }

  if (action.type === "andiel_choice") {
    return (async () => {
      const pick = window.openChoicePick
        ? await window.openChoicePick({
            title: "請選擇",
            desc: "要怎麼回應安地爾？（⭡⭣選擇，Enter/Space確認）",
            options: [
              { text: "我就是餓死，死外邊，從這裡跳下去，也不會跟你走！！！" },
              { text: "你要不要看看你現在長什麼樣子？？？" },
            ],
          })
        : 0;

      // 0 = opt1, 1 = opt2
      if (pick === 0) {
        window.__ANDIEL_BRANCH__ = "opt1";
        andielBranch = "opt1";

        // 在 white_garden 當前行後插入「多講幾句」：玩家 Enter 下一句，最後才切圖
        const lines = DIALOGS?.[currentDialogId];
        if (Array.isArray(lines)) {
          // 若之前有殘留 opt2 標記，先移掉（防止章節打架）
          for (let k = storyIndex + 1; k < lines.length; ) {
            if (lines[k]?._andiel === "opt2") lines.splice(k, 1);
            else break;
          }

          const opt1Seq = [
            { name: "安地爾", text: "這可不是你能決定的。", _andiel: "opt1" },
            { name: "褚冥漾", face: "wtf", text: "你是在上演什麼霸道咖啡杯狠狠愛嗎！！！", _andiel: "opt1" },
            // ✅ 空白 auto 行：先跑 action，再自動 next
            { name: "", text: "", auto: true, autoDelay: 60, action: { type: "andiel_opt1_go" }, _andiel: "opt1" },
          ];

          lines.splice(storyIndex + 1, 0, ...opt1Seq);
        }
        return; // 交給玩家按 Enter 看完再切圖
      }

      // pick === 1 → opt2 直接走結局 B（不切圖、不進 opt1）
      window.__ANDIEL_BRANCH__ = "opt2";
      andielBranch = "opt2";

      // 直接切到 ending_B 對話（保持在當前地圖/人物位置）
      snapshotActorVisibility(window.__SCENE__);
      currentDialogId = "ending_B";
      storyIndex = 0;
      dialogOpen = true;
      dialogEl.classList.add("show");
      renderDialog();
      return;
    })();
  }

  if (action.type === "andiel_opt1_go") {
    return (async () => {
      // 防止 auto-next 把 coffee_branch 第一行直接跳過
      window.__BLOCK_AUTO_NEXT_ONCE__ = true;
      snapshotActorVisibility(window.__SCENE__);

      await runAction([
        { type: "flashWhite", peak: 0.9, msIn: 80, msOut: 220 },
        { type: "fadeBlack", to: 1, ms: 280 },
        { type: "gotoStage", stage: "coffee", spawn: "default" },
        { type: "fadeBlack", to: 0, ms: 280 },
      ]);

      // 開啟結局 A 對話（coffee_branch）
      const idx = Array.isArray(STORY_FLOW) ? STORY_FLOW.indexOf("coffee_branch") : -1;
      if (idx >= 0) storyStep = idx;
      currentDialogId = "coffee_branch";
      storyIndex = 0;
      dialogOpen = true;
      dialogEl.classList.add("show");
      renderDialog();
    })();
  }

  if (action.type === "runTo") {
  const actor = getActor(action.actor);
  if (!actor) return Promise.resolve();
  const ms = action.ms ?? 400;

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      x: action.x,
      y: action.y,
      duration: ms,
      ease: action.ease ?? "Quad.easeOut",
      onComplete: resolve
    });
  });
}

if (action.type === "toPlayer") {
  const actor = getActor(action.actor);
  const player = getActor(action.player ?? "player") || scene.player; // 依你專案命名
  if (!actor || !player) return Promise.resolve();

  const side = action.side ?? "auto" | "left" | "right" | "up" | "down"; // "auto" | "left" | "right"
  const gapX = action.gapX ?? action.gap ?? 10;
  const gapY = action.gapY ?? action.gap ?? 10;
  const speed = action.speed ?? 220;  // px/s（用距離算時間）
  const ease = action.ease ?? "Linear";

  // ✅ 新增：從哪邊「進場」(會先把 actor 放到玩家某側再開始跑)
  // enterFrom: "left" | "right" | undefined
  if (action.enterFrom === "right" || action.enterFrom === "left") {
    const sign = action.enterFrom === "right" ? 1 : -1;
    const enterDist = action.enterDist ?? 220;   // 進場起點離玩家多遠
    actor.x = player.x + sign * enterDist;
    if (action.matchY !== false) actor.y = player.y;
  }
   // 估算角色與玩家的「占位尺寸」
  const halfW_A = (actor.displayWidth ?? 0) * 0.5;
  const halfW_P = (player.displayWidth ?? 0) * 0.5;
  const halfH_A = (actor.displayHeight ?? 0) * 0.5;
  const halfH_P = (player.displayHeight ?? 0) * 0.5;
  // ✅ 允許你用 offsetX/offsetY 覆蓋自動距離
  const offsetX = action.offsetX ?? (halfW_A + halfW_P + gapX);
  const offsetY = action.offsetY ?? (halfH_A + halfH_P + gapY);

  // 決定最終要站哪裡
  let targetX = actor.x;
  let targetY = actor.y;

  const pickAuto = () => {
    // auto：選離玩家較遠的軸，避免斜角怪（也可改成你偏好）
    const dx = Math.abs(actor.x - player.x);
    const dy = Math.abs(actor.y - player.y);
    if (dx >= dy) return actor.x <= player.x ? "left" : "right";
    return actor.y <= player.y ? "up" : "down";
  };

  const finalSide = side === "auto" ? pickAuto() : side;

  if (finalSide === "left") {
    targetX = player.x - offsetX;
    if (action.matchY !== false) targetY = player.y;
  } else if (finalSide === "right") {
    targetX = player.x + offsetX;
    if (action.matchY !== false) targetY = player.y;
  } else if (finalSide === "up") {
    targetY = player.y - offsetY;
    if (action.matchX !== false) targetX = player.x;
  } else if (finalSide === "down") {
    targetY = player.y + offsetY;
    if (action.matchX !== false) targetX = player.x;
  }

  // 走路時間（或直接指定 action.ms）
  const dist = Phaser.Math.Distance.Between(actor.x, actor.y, targetX, targetY);
  const ms = action.ms ?? Math.max(120, Math.round((dist / speed) * 1000));

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      x: targetX,
      y: targetY,
      duration: ms,
      ease,
      onComplete: resolve,
    });
  });
}

if (action.type === "toActor") {
  const actor = getActor(action.actor);
  const target = getActor(action.target); // 👈 目標人物
  if (!actor || !target) return Promise.resolve();

  const side = action.side ?? "auto"; // left/right/up/down/auto
  const gapX = action.gapX ?? action.gap ?? 10;
  const gapY = action.gapY ?? action.gap ?? 10;
  const speed = action.speed ?? 220;
  const ease = action.ease ?? "Linear";

  // ✅ 進場（可選）：先放到目標某側，再跑過來
  if (action.enterFrom === "right" || action.enterFrom === "left") {
    const sign = action.enterFrom === "right" ? 1 : -1;
    const enterDist = action.enterDist ?? 220;
    actor.x = target.x + sign * enterDist;
    if (action.matchY !== false) actor.y = target.y;
  } else if (action.enterFrom === "up" || action.enterFrom === "down") {
    const sign = action.enterFrom === "down" ? 1 : -1;
    const enterDist = action.enterDist ?? 160;
    actor.y = target.y + sign * enterDist;
    if (action.matchX !== false) actor.x = target.x;
  }

  const halfW_A = (actor.displayWidth ?? 0) * 0.5;
  const halfW_T = (target.displayWidth ?? 0) * 0.5;
  const halfH_A = (actor.displayHeight ?? 0) * 0.5;
  const halfH_T = (target.displayHeight ?? 0) * 0.5;

  const offsetX = action.offsetX ?? (halfW_A + halfW_T + gapX);
  const offsetY = action.offsetY ?? (halfH_A + halfH_T + gapY);

  let targetX = actor.x;
  let targetY = actor.y;

  const pickAuto = () => {
    const dx = Math.abs(actor.x - target.x);
    const dy = Math.abs(actor.y - target.y);
    if (dx >= dy) return actor.x <= target.x ? "left" : "right";
    return actor.y <= target.y ? "up" : "down";
  };

  const finalSide = side === "auto" ? pickAuto() : side;

  if (finalSide === "left") {
    targetX = target.x - offsetX;
    if (action.matchY !== false) targetY = target.y;
  } else if (finalSide === "right") {
    targetX = target.x + offsetX;
    if (action.matchY !== false) targetY = target.y;
  } else if (finalSide === "up") {
    targetY = target.y - offsetY;
    if (action.matchX !== false) targetX = target.x;
  } else if (finalSide === "down") {
    targetY = target.y + offsetY;
    if (action.matchX !== false) targetX = target.x;
  }

  const dist = Phaser.Math.Distance.Between(actor.x, actor.y, targetX, targetY);
  const ms = action.ms ?? Math.max(120, Math.round((dist / speed) * 1000));

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      x: targetX,
      y: targetY,
      duration: ms,
      ease,
      onComplete: resolve,
    });
  });
}
  
  // ✅ 等待（節奏控制）
  if (action.type === "wait") {
    const ms = action.ms ?? 200;
    return new Promise((resolve) => scene.time.delayedCall(ms, resolve));
  }

  if (action.type === "jump") {
  const actor = getActor(action.actor);
  if (!actor) return Promise.resolve();

  const times = action.times ?? 2;      // 跳幾下（預設 2）
  const height = action.height ?? 10;   // 跳的高度（px）
  const ms = action.ms ?? 120;          // 每一「半段」時間（上去或下來）
  const baseY = actor.y;

  // 避免物理速度影響跳動（可留可不留，看你角色是否有 velocity）
  actor.setVelocity?.(0, 0);

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      y: baseY - height,
      duration: ms,
      ease: action.easeUp ?? "Quad.easeOut",
      yoyo: true,               // 會自動回到 baseY
      repeat: times - 1,        // 2 下 = repeat 1（因為第一下算一次）
      onComplete: () => {
        actor.y = baseY;        // 保險：結束後回正
        resolve();
      },
    });
  });
}

// 黑幕淡入淡出（用 Camera fade，最穩）
if (action.type === "fadeBlack") {
  const cam = scene.cameras.main;
  const to = action.to ?? 1;    // 1 = 變黑, 0 = 變亮
  const ms = action.ms ?? 400;

  return new Promise((resolve) => {
    if (to >= 1) {
      cam.fadeOut(ms, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, resolve);
    } else {
      cam.fadeIn(ms, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, resolve);
    }
  });
}

// 換場景：黑館/白園…（先用「換背景色+重置角色位置+重設 trigger」的最小版）
if (action.type === "gotoStage") {
  const scene = window.__SCENE__;
  const stage = action.stage;
  const spawnKey = action.spawn ?? "default";

  scene.loadStageMap?.(stage);
  // 你可以用不同背景色先代表不同場景
  // 背景示意（你之後換 tilemap 也可以留這個概念）
  if (stage === "blackhall") scene.cameras.main.setBackgroundColor("#0e0e14");

  const sp = STAGE_SPAWN?.[stage]?.[spawnKey]
          ?? STAGE_SPAWN?.[stage]?.default
          ?? { x: 240, y: 200 };

  if (scene.player?.body) scene.player.body.reset(sp.x, sp.y);
  else scene.player.setPosition(sp.x, sp.y);
  // ✅ 記錄目前 stage（給 trigger 系統判斷用）
  window.__STAGE__ = stage;
  // ✅ 白園 triggers 開關（這行不能少）
  scene.applyStageTriggers?.(stage);
  console.log("[gotoStage]", stage, "whiteTriggers len =", scene.whiteTriggers?.length);
  return Promise.resolve();
}

// 白閃（衝擊/醒來）
if (action.type === "flashWhite") {
  if (!scene?.fxWhite) return Promise.resolve();

  const peak = action.peak ?? 0.9;
  const msIn = action.msIn ?? 60;
  const msOut = action.msOut ?? 180;

  scene.fxWhite.alpha = 0;

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: scene.fxWhite,
      alpha: peak,
      duration: msIn,
      ease: "Linear",
      onComplete: () => {
        scene.tweens.add({
          targets: scene.fxWhite,
          alpha: 0,
          duration: msOut,
          ease: "Linear",
          onComplete: resolve
        });
      }
    });
  });
}

if (action.type === "eggImage") {
  if (action.state === "in") showEggImage(action.key); // coffee / idol
  else hideEggImage();
}

  // 走位（相對位移）
  if (action.type === "move") {
    const actor = getActor(action.actor);
    if (!actor) return Promise.resolve();
    const ms = action.ms ?? 300;
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: actor,
        x: actor.x + (action.dx ?? 0),
        y: actor.y + (action.dy ?? 0),
        duration: ms,
        onComplete: resolve
      });
    });
  }

if (action.type === "emote") {
  const actor = getActor(action.actor);
  if (!actor) return Promise.resolve();

  const key = action.key ?? "angry";
  const ms = action.ms ?? 700;

  // 頭上位置：角色中心 + 往上抬（依你的角色圖大小可再調）
  const dx = action.dx ?? 0;
  const dy = action.dy ?? -18;
  const headY = actor.y - (actor.displayHeight * 0.5);

  const em = scene.add.image(actor.x + dx, headY + dy, key)
    .setOrigin(0.5, 1)
    .setDepth((actor.depth ?? 0) + 50)
    .setAlpha(0)
    .setScale(action.scale ?? 0.9);

  return new Promise((resolve) => {
    const baseScale = action.scale ?? 0.2;

    em.setScale(baseScale * 0.9);
    // 彈出 + 小上浮
    scene.tweens.add({
      targets: em,
      alpha: 1,
      scale: baseScale,
      y: em.y - 6,
      duration: 140,
      ease: "Back.Out",
    });

    // 晃動（像生氣抖一下）
    scene.tweens.add({
      targets: em,
      angle: { from: -10, to: 10 },
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: "Sine.InOut",
      delay: 80,
    });

    // 收尾淡出
    scene.tweens.add({
      targets: em,
      alpha: 0,
      y: em.y - 16,
      duration: 180,
      ease: "Quad.In",
      delay: Math.max(0, ms - 180),
      onComplete: () => {
        em.destroy();
        resolve();
      },
    });
  });
}

if (action.type === "sfx") {
  const key = action.key ?? "hit" | "breaking" | "running" | "blooding" | "fire" | "cameraShake" | "jump" | "hurt" | "bird" | "shu" | "emote" | "hurt" | "ding";
  const volume = action.volume ?? 1;
  const rate = action.rate ?? 1;
  const detune = action.detune ?? 0;

  // allowMultiple=false 會避免同音效疊太多（可選）
  if (action.allowMultiple === false) scene.sound.stopByKey(key);

  const master = window.__SFX_VOL__ ?? 1;
  scene.sound.play(key, { volume: volume * master, rate, detune });

  return Promise.resolve(); // 播放不用等，直接往下跑劇情
}


if (action.type === "sfxLoop") {
  // 在劇情中手動開啟循環音效（覆蓋 STAGE_LOOP_SFX 的預設也可以）
  const key = action.key;
  const volume = action.volume ?? 1;
  const rate = action.rate ?? 1;
  const detune = action.detune ?? 0;

  startLoopSfx(scene, key, { volume, rate, detune });
  return Promise.resolve();
}

if (action.type === "sfxStop") {
  // 在劇情中手動停止循環音效
  stopLoopSfx();
  return Promise.resolve();
}

  // 衝刺到某角色背後（動畫）
  if (action.type === "dashBehind") {
  const actor = getActor(action.actor);
  const target = getActor(action.target);
  if (!actor || !target) return Promise.resolve();

  actor.setVisible(true);

  actor.__forcedFlipX = true;   // true = 翻轉（你這套邏輯等於朝 left）
  actor.setFlipX(true);
  actor.facing = "left";

  const ms = action.ms ?? 220;
  const distX = Math.abs(action.dx ?? 18);
  const distY = action.dy ?? 0;

  // target 面向 left → 背後在右(+)，面向 right → 背後在左(-)
  const behindSign = (target.facing === "left") ? +1 : -1;
  const endX = target.x + behindSign * distX;
  const endY = target.y + distY;

  // ✅ 想要有「逼近」感：只在第一次或 actor 目前很靠近時，才把起點放到另一側
  const startX = target.x - behindSign * 140;
  const startY = target.y;

  if (!actor.visible || Math.abs(actor.x - endX) < 5) {
    actor.x = startX;
    actor.y = startY;
  }

  // ✅ 先解除鎖（等動畫跑完再鎖）
  actor.__locked = false;

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      x: endX,
      y: endY,
      duration: ms,
      ease: "Quad.easeOut",
      onComplete: () => {
        actor.__locked = true;
        actor.__lockPos = { x: actor.x, y: actor.y };
        resolve();
      }
    });
  });
}

  // 出現 / 消失
  if (action.type === "show") {
    const actor = getActor(action.actor);
    if (actor) actor.setVisible(true);
    return Promise.resolve();
  }
  if (action.type === "hide") {
    const actor = getActor(action.actor);
    if (actor) actor.setVisible(false);
    return Promise.resolve();
  }

  // 倒地（簡單：旋轉+下沉）
  if (action.type === "fall") {
    const actor = getActor(action.actor);
    if (!actor) return Promise.resolve();
    const ms = action.ms ?? 600;
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: actor,
        x: actor.x - 10,
        y: actor.y + 5,
        angle: -90,
        alpha: 0.85,
        duration: ms,
        ease: "Quad.easeIn",
        onComplete: () => {
        actor.__isDown = true;          // ✅ 倒下 = 死亡
        resolve();
      }
      });
    });
  }

  if (action.type === "lay") {
  const actor = getActor(action.actor);
  if (!actor) return Promise.resolve();

  actor.setVisible(true);

  const ms = action.ms ?? 1;

  // 反方向：讓角色「進入躺姿」
  // 你可以依床的方向改成 +90 或 -90
  const dx = action.dx ?? 10;      // 跟 fall 相反
  const dy = action.dy ?? -5;
  const angle = action.angle ?? 90;
  const alpha = action.alpha ?? 1;

  // ✅ 如果你希望躺床≠死亡，這裡把死亡旗標清掉
  actor.__isDown = false;

  // ms 很小就直接 set（避免 tween 閃一下）
  if (ms <= 1) {
    actor.x = actor.x + dx;
    actor.y = actor.y + dy;
    actor.angle = angle;
    actor.alpha = alpha;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: actor,
      x: actor.x + dx,
      y: actor.y + dy,
      angle,
      alpha,
      duration: ms,
      ease: action.ease ?? "Quad.easeOut",
      onComplete: resolve
    });
  });
}


  // 鏡頭拉近 / 縮放
if (action.type === "cameraZoom") {
  const cam = scene.cameras.main;
  const to = action.to ?? cam.zoom;
  const ms = action.ms ?? 250;

  return new Promise((resolve) => {
    scene.tweens.add({
      targets: cam,
      zoom: to,
      duration: ms,
      ease: action.ease ?? "Quad.easeOut",
      onComplete: resolve
    });
  });
}

// 鏡頭震動
if (action.type === "cameraShake") {
  scene.cameras.main.shake(action.ms ?? 200, action.intensity ?? 0.01);
  return new Promise((resolve) => scene.time.delayedCall(action.ms ?? 200, resolve));
}

  // 坐起（簡單：從躺著回正）
  if (action.type === "sitUp") {
    const actor = getActor(action.actor);
    if (!actor) return Promise.resolve();
    actor.setVisible(true);
    const ms = action.ms ?? 450;
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: actor,
        angle: 0,
        y: actor.y - 14,
        alpha: 1,
        duration: ms,
        ease: "Quad.easeOut",
        onComplete: () =>{
          actor.__isDown = false;         // ✅ 起身 = 活著
          resolve();
        }
      });
    });
  }

  // 轉身 / 面向某方向
if (action.type === "face") {
  const actor = getActor(action.actor);
  if (!actor) return Promise.resolve();

  const dir = action.dir;
  actor.facing = dir;

  // ✅ bing：保留你原本的特殊處理
  if (action.actor === "bing") {
    if (actor.__forcedFlipX === true) {
      actor.setFlipX(true);
      actor.facing = "left";
      actor.setTexture("bing_front");
      return Promise.resolve();
    }

    if (dir === "left") actor.setFlipX(true);
    else if (dir === "right") actor.setFlipX(false);

    actor.setTexture("bing_front");
    return Promise.resolve();
  }
  // ✅ 其他角色：基礎面向右 → dir=left 就 flipX=true
  actor.setFlipX(dir === "left");

  const TEX = {
    qian: "qian_front",
    five: "five_front",
    twins1: "twins1_front",
    twins2: "twins2_front",
    bigbro: "bigbro_front",
    coffee: "coffee_front",
    chu: "chu_front",
    bingt: "bingt_front",
  };

  actor.setTexture(TEX[action.actor] ?? "chu_front");
  return Promise.resolve();

}

}


class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

preload() {
  this.load.image("chu_front", "assets/img/chu_front.png");
  this.load.image("bing_front", "assets/img/bing_front.png");
  this.load.image("qian_front_red", "assets/img/qian_front_red.png");
  this.load.image("cat_front", "assets/img/cat_front.png");
  this.load.image("ryan_front", "assets/img/ryan_front.png");
  this.load.image("angel_front", "assets/img/angel_front.png");
  this.load.image("five_front", "assets/img/five_front.png");
  this.load.image("moon_front", "assets/img/moon_front.png");
  this.load.image("ran_front", "assets/img/ran_front.png");
  this.load.image("twins1_front", "assets/img/twins1_front.png");
  this.load.image("twins2_front", "assets/img/twins2_front.png");
  this.load.image("bigbro_front", "assets/img/bigbro_front.png");
  this.load.image("coffee_front", "assets/img/coffee_front.png");
  this.load.image("bingt_front", "assets/img/bingt_front.png");
  this.load.image("angry", "assets/img/angry.png");
  this.load.image("idol", "assets/img/idol.png"); 
  this.load.image("coffee", "assets/img/coffee.png"); 

  // 你如果之後有冰炎/第三人，也可以加
  // this.load.image("bing_front", "assets/bing_front.png");
  this.load.audio("hit", "assets/audio/hit.mp3");
  this.load.audio("breaking", "assets/audio/breaking.mp3");
  this.load.audio("blooding", "assets/audio/blooding.mp3");
  this.load.audio("jump", "assets/audio/jump.mp3");
  this.load.audio("running", "assets/audio/running.mp3");
  this.load.audio("cameraShake", "assets/audio/cameraShake.mp3");
  this.load.audio("fire", "assets/audio/fire.mp3");
  this.load.audio("hurt", "assets/audio/hurt.mp3");
  this.load.audio("no", "assets/audio/no.mp3");
  this.load.audio("sure", "assets/audio/sure.mp3");
  this.load.audio("walk", "assets/audio/walk.mp3");
  this.load.audio("warming", "assets/audio/warming.mp3");
  this.load.audio("bird", "assets/audio/bird.mp3");
  this.load.audio("emote", "assets/audio/emote.mp3");
  this.load.audio("shu", "assets/audio/shu.mp3");
  this.load.audio("ding", "assets/audio/ding.mp3");

  this.load.audio("coloregg", "assets/audio/coloregg.mp3");
  this.load.audio("coffeeshop", "assets/audio/coffeeshop.mp3");
  this.load.audio("Dream", "assets/audio/Dream.mp3");

  for (const cfg of Object.values(TILEMAPS)) {
    this.load.tilemapTiledJSON(cfg.mapKey, cfg.mapFile);

    for (const ts of (cfg.tilesets || [])) {
      this.load.image(ts.imageKey, ts.imageFile);
    }
  }
}

clearCurrentMap() {
  // 刪除舊 layers
  if (this._mapLayers) {
    for (const lyr of this._mapLayers) lyr.destroy();
  }
  this._mapLayers = [];

  // 刪除舊 tilemap
  if (this._tilemap) {
    this._tilemap.destroy();
    this._tilemap = null;
  }

  // 刪除舊 collider（注意：多個）
  if (this._mapColliders) {
    for (const c of this._mapColliders) c.destroy();
  }
  this._mapColliders = [];
}

loadStageMap(stageKey) {
  const cfg = TILEMAPS[stageKey];
  this.clearCurrentMap();
  const map = this.make.tilemap({ key: cfg.mapKey });
  this._tilemap = map;

  // 建 tilesets（可多張）
  const phaserTilesets = [];
  for (const ts of (cfg.tilesets || [])) {
    const tset = map.addTilesetImage(ts.name, ts.imageKey);
    phaserTilesets.push(tset);
  }

  // 建立 layers：不指定就把所有 tile layer 都建出來
  const want = cfg.buildLayerNames ? new Set(cfg.buildLayerNames) : null;

this._mapLayers = [];
this._layersByName = {};   // ✅ 每次換地圖都重建

function depthForLayer(name) {
  if (name.includes("背景")) return 0;
  if (name === "地面") return 10;
  if (name === "一樓") return 10;
  if (name === "二樓樓梯") return 11;

  // 中景（在角色下面）
  if (name === "路燈上") return 18;
  if (name === "草叢上") return 19;
  if (name === "房間") return 19;
  if (name === "欄杆") return 19;
  if (name === "桌子") return 19;
  if (name === "上層架") return 19;
  if (name === "上層架的麵包") return 20;
  if (name === "流理臺") return 21;
  if (name === "矮櫃上的物品") return 22;

  // 前景（要蓋住角色）
  if (name === "草叢下") return 40;
  if (name === "吧檯") return 40;
  if (name === "方框") return 40;
  if (name === "路燈下") return 41;
  if (name === "火") return 42;

  if (name === "人" || name === "人1") return 45; 

  return 15;
}

for (const layerData of map.layers) {
  const name = layerData.name;
  if (want && !want.has(name)) continue;

  const lyr = map.createLayer(name, phaserTilesets, 0, 0);
  if (!lyr) {
    console.warn("[tilemap] createLayer failed:", name);
    continue;
  }

  lyr.setDepth(depthForLayer(name));

  this._mapLayers.push(lyr);
  this._layersByName[name] = lyr; // ✅ 同時存起來
}
  // 世界 / 相機範圍
  this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);


  // ✅ 碰撞：支援多層
const collisionNames = cfg.collisionLayerNames || [];
this._mapColliders = [];

for (const colName of collisionNames) {
  const colLayer = this._layersByName[colName];
  if (!colLayer) {
    console.warn("[tilemap] collision layer not built:", colName);
    continue;
  }

  // ✅ 很重要：把參數寫死（不同 Phaser 版本/狀況下更穩）
  colLayer.setCollisionByExclusion([-1], true, true);

  const c = this.physics.add.collider(this.player, colLayer);
  this._mapColliders.push(c);

  // ✅ Debug：同時看 nonEmpty + collides
  let nonEmpty = 0, collides = 0;
  colLayer.forEachTile(t => {
    if (t.index !== -1) nonEmpty++;
    if (t.collides) collides++;
  });
}
  // ✅ 依地圖自動切換循環環境音 / BGM
  try { applyMapLoopSfx(stageKey, this); } catch (_e) {}
  try { applyMapLoopMusic(stageKey, this); } catch (_e) {}

}

  create(data = {}) {
  const gs = ensureGameState();  
  const shown = bootShowWarningOnce(this);
  // 只有「首次進入或回主選單」才顯示主選單；
  // startNewGame()/continueGame() 會把 phase 設為 playing，再重啟場景時就不該被這裡拉回主選單。
  if (!shown && gs.phase === "menu") showMenu();
  // ============ 熱鍵：選單 / 重開 ============
  this.input.keyboard.on("keydown-R", () => {
    const gs = ensureGameState();
    if (gs.phase === "ended") return;

    if (menuEl.classList.contains("show")) hideMenu();
    else showMenu();
  });

  this.input.keyboard.on("keydown-A", () => {
    const gs = ensureGameState();
    if (gs.phase === "ended" || window.gameFinished === true) {
      startNewGame();
    }
  });

  // ============ 基礎畫面設定 ============
  this.cameras.main.setBackgroundColor("#1b1b1b");
  this.scale.setParentSize(window.innerWidth, window.innerHeight);

  // 轉場遮罩
  this.fxBlack = this.add.rectangle(0, 0, 9999, 9999, 0x000000, 0)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(9999);

  this.fxWhite = this.add.rectangle(0, 0, 9999, 9999, 0xffffff, 0)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(10000);

  // ============ 劇情角色（chu 用 physics，其他先用 add sprite） ============
  this.actors = {
    chu:  this.physics.add.sprite(240, 200, "chu_front"),
    bing: this.add.sprite(240, 200, "bing_front").setVisible(false),
    qian: this.add.sprite(240, 200, "qian_front_red").setVisible(false),
    cat:  this.add.sprite(240, 200, "cat_front").setVisible(false),
    ryan: this.add.sprite(240, 200, "ryan_front").setVisible(false),
    angel: this.add.sprite(240, 200, "angel_front").setVisible(false),
    five: this.add.sprite(240, 200, "five_front").setVisible(false),
    moon: this.add.sprite(240, 200, "moon_front").setVisible(false),
    ran: this.add.sprite(240, 200, "ran_front").setVisible(false),
    twins1: this.add.sprite(240, 200, "twins1_front").setVisible(false),
    twins2: this.add.sprite(240, 200, "twins2_front").setVisible(false),
    bigbro: this.add.sprite(240, 200, "bigbro_front").setVisible(false),
    coffee: this.add.sprite(240, 200, "coffee_front").setVisible(false),
    bingt: this.add.sprite(240, 200, "bingt_front").setVisible(false),
  };

  this.player = this.actors.chu;

  // 玩家碰撞與大小
  this.player.body.setCollideWorldBounds(true);
  this.player.setOrigin(0.5, 0.5);
  this.player.setScale(1);
  this.player.body.setSize(this.player.displayWidth, this.player.displayHeight, true);

  // facing 預設
  this.actors.chu.facing = "right";
  this.actors.qian.facing = "right";
  this.actors.cat.facing = "right";
  this.actors.ryan.facing = "right";
  this.actors.angel.facing = "right";
  this.actors.five.facing = "right";
  this.actors.moon.facing = "right";
  this.actors.ran.facing = "right";
  this.actors.twins1.facing = "right";
  this.actors.twins2.facing = "right";
  this.actors.bigbro.facing = "right";
  this.actors.coffee.facing = "right";
  this.actors.bingt.facing = "left";

  // 角色比例
  this.actors.bing.setScale(1.08);
  this.actors.qian.setScale(1.02);
  this.actors.cat.setScale(0.89);
  this.actors.ryan.setScale(1.1);
  this.actors.angel.setScale(1.1);
  this.actors.five.setScale(1.02);
  this.actors.moon.setScale(1.08);
  this.actors.ran.setScale(1.08);
  this.actors.twins1.setScale(1.11);
  this.actors.twins2.setScale(1.11);
  this.actors.bigbro.setScale(1.1);
  this.actors.coffee.setScale(1.09);
  this.actors.bingt.setScale(1.08);

  // 深度（你之後會用 layer depth 再蓋過這些）
  this.actors.chu.setDepth(30);
  this.actors.bing.setDepth(29);
  this.actors.qian.setDepth(29);
  this.actors.cat.setDepth(29);
  this.actors.ryan.setDepth(29);
  this.actors.angel.setDepth(29);
  this.actors.five.setDepth(28);
  this.actors.moon.setDepth(29);
  this.actors.ran.setDepth(29);
  this.actors.twins1.setDepth(29);
  this.actors.twins2.setDepth(29);
  this.actors.bigbro.setDepth(29);
  this.actors.coffee.setDepth(29);
  this.actors.bingt.setDepth(29);

  // ============ GameState / 讀檔決定初始地圖 ============
  const initStage = gs.pendingLoad?.stage || window.__STAGE__ || "prologue_fire";

  // 載入地圖（一定要在 overlap/trigger 之前）
  this.loadStageMap(initStage);
  window.__STAGE__ = initStage;

  // ============ 通用觸發區（你原本 560,200 那顆） ============
  // 如果這顆只該出現在特定地圖，你可以用 enabledStage 判斷（下面有做）
  this.triggerZone = this.add.rectangle(560, 200, 60, 60, 0x00ffcc, 0);
  this.physics.add.existing(this.triggerZone, true);

  this.canTrigger = true;

  // 這顆 zone 要不要啟用（避免黑館也一直觸發）
  const triggerEnabledStage = (initStage === "prologue_fire");
  this.triggerZone.body.enable = triggerEnabledStage;
  this.triggerZone.active = triggerEnabledStage;

  this.physics.add.overlap(this.player, this.triggerZone, () => {
    if (!this.triggerZone?.body?.enable) return;
    if (dialogOpen) return;
    if (!this.canTrigger) return;
    if (gameFinished) return;

    this.canTrigger = false;
    openCurrentDialog();
  });

  // 離開觸發區才允許再次觸發（防站著連續觸發）
  this.physics.world.on("worldstep", () => {
    if (!this.triggerZone?.body?.enable) return;

    const p = this.player.getBounds();
    const z = this.triggerZone.getBounds();
    const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(p, z);
    if (!overlapping) this.canTrigger = true;
  });

  // ============ white garden triggers ============
this.whiteTriggers = [];
this._whiteTriggerOverlaps = [];

// ✅ enable / disable（只做開關）
const setZoneEnabled = (zone, enabled) => {
  if (!zone?.body) return;
  zone.body.enable = enabled;
  zone.active = enabled;                 // ✅ 很重要
  zone.body.updateFromGameObject?.();
};

// ✅ 只負責開關（不做建置）
this.enableWhiteGardenTriggers = (enabled) => {
  for (const t of this.whiteTriggers) setZoneEnabled(t.zone, enabled);
};

// ✅ 建置/重建 white garden triggers（可重複呼叫）
this.buildWhiteGardenTriggers = () => {
  // 1) 清掉舊 overlaps（避免重建後疊加）
  if (this._whiteTriggerOverlaps?.length) {
    for (const o of this._whiteTriggerOverlaps) o?.destroy?.();
  }
  this._whiteTriggerOverlaps = [];

  // 2) 清掉舊 zones
  if (this.whiteTriggers?.length) {
    for (const t of this.whiteTriggers) t.zone?.destroy?.();
  }
  this.whiteTriggers = [];

  // 3) 重建 zones + overlaps
  for (const cfg of WHITE_GARDEN_TRIGGERS) {
    const zone = this.add.rectangle(cfg.x, cfg.y, cfg.w, cfg.h, 0x00ffcc, 0.5);
    this.physics.add.existing(zone, true);
    zone.body.updateFromGameObject();

    this.whiteTriggers.push({ cfg, zone });

    const overlap = this.physics.add.overlap(this.player, zone, () => {
      if (!zone.active || !zone?.body?.enable) return;
      if (dialogOpen || gameFinished) return;
      if (cfg.once && cfg.fired) return;
      if (cfg.once) cfg.fired = true;

      const idx = STORY_FLOW.indexOf(cfg.id);
      if (idx >= 0) storyStep = idx;

      openCurrentDialog();
    });

    this._whiteTriggerOverlaps.push(overlap);
  }
};


// ============ coffee triggers (from Tiled object layer: Triggers) ============
this.coffeeTriggers = [];
this._coffeeTriggerOverlaps = [];

// enable / disable（只做開關）
this.enableCoffeeTriggers = (enabled) => {
  for (const t of this.coffeeTriggers) setZoneEnabled(t.zone, enabled);
};

// 建置/重建 coffee triggers（從 tilemap 的 Triggers 物件層讀取）
this.buildCoffeeTriggersFromMap = () => {
  // 清 overlaps
  if (this._coffeeTriggerOverlaps?.length) {
    for (const o of this._coffeeTriggerOverlaps) o?.destroy?.();
  }
  this._coffeeTriggerOverlaps = [];

  // 清 zones
  if (this.coffeeTriggers?.length) {
    for (const t of this.coffeeTriggers) t.zone?.destroy?.();
  }
  this.coffeeTriggers = [];

  const map = this._tilemap;
  if (!map?.getObjectLayer) {
    console.warn("[coffee] no tilemap for triggers");
    return;
  }

  const layer = map.getObjectLayer("Triggers");
  const objs = layer?.objects || [];

  // ✅ once 觸發記錄（避免未初始化導致錯誤）
  window.__COFFEE_TRIGGER_FIRED__ = window.__COFFEE_TRIGGER_FIRED__ || {};

    // ✅ 收集所有彩蛋 trigger 的 id（用於「全部觸發過一次後進 END」）
  // 會從 object.name / type / properties.id 推導，並去重
  const _allEggIds = [];
  for (const o of objs) {
    const ps = o.properties || [];
    const pid2 = ps.find(p => p?.name === "id")?.value;
    const _id = (pid2 || o.name || o.type || "trigger").toString().trim();
    if (_id && !_allEggIds.includes(_id)) _allEggIds.push(_id);
  }
  window.__COFFEE_EGG_IDS__ = _allEggIds;

  if (!objs.length) {
    console.warn("[coffee] Triggers object layer is empty / missing");
    return;
  }

  for (const obj of objs) {
    const props = obj.properties || [];
    const pid = props.find(p => p?.name === "id")?.value;
    const id = (pid || obj.name || obj.type || "trigger").toString().trim();
    const once = !!props.find(p => p?.name === "once")?.value;

    const w = (obj.width && obj.width > 0) ? obj.width : 26;
    const h = (obj.height && obj.height > 0) ? obj.height : 26;
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2;

    // alpha 設 0 → 不可見；要 debug 可以改 0.35
    const zone = this.add.rectangle(cx, cy, w, h, 0x00ffcc, 0);
    this.physics.add.existing(zone, true);
    zone.body.updateFromGameObject();

    this.coffeeTriggers.push({ id, zone, once, inside:false, lastFire:0 });

    const entry = this.coffeeTriggers[this.coffeeTriggers.length - 1];

    const overlap = this.physics.add.overlap(this.player, zone, () => {
      if (!zone?.body?.enable) return;
      if (dialogOpen || gameFinished) return;

      // 只有 coffee_branch 結束後才允許觸發彩蛋
      if (!window.__COFFEE_FREE_ROAM__) return;

      // ✅ 防止同一格「每幀都觸發」：只在「進入」時觸發一次，離開後才可再觸發
      if (entry.inside) return;

      // ✅ 小冷卻（保險）：避免邊界抖動造成連發
      const now = (this.time && typeof this.time.now === "number") ? this.time.now : Date.now();
      if (now - (entry.lastFire || 0) < 500) return;

      entry.inside = true;
      entry.lastFire = now;

      // ✅ 記錄「曾經觸發過」（用於彩蛋完成判定），但仍允許重複觸發
      window.__COFFEE_TRIGGER_FIRED__ = window.__COFFEE_TRIGGER_FIRED__ || {};
      window.__COFFEE_TRIGGER_FIRED__[id] = true;

      const dialogId = "coffee_trigger_" + id;
      if (!DIALOGS[dialogId]) {
        // 沒有設定對話就給提示（你也可以改成 return）
        try { showToast("（尚未設定彩蛋對話：" + dialogId + "）"); } catch(_e) {}
        return;
      }

      openDialogById(dialogId, { side: true });
    });

    this._coffeeTriggerOverlaps.push(overlap);
  }

  // 離開 trigger 才允許再次觸發（只要還在區域內就不會再觸發）
// 用 inside flag 來做「進入一次、離開後才可再進入」
// （避免 overlap callback 在同一格每幀觸發）
if (!this.__coffeeWorldStepBound) {
  this.__coffeeWorldStepBound = true;

  this.physics.world.on("worldstep", () => {
    if (!this.coffeeTriggers?.length) return;
    const p = this.player.getBounds();
    for (const t of this.coffeeTriggers) {
      const z = t.zone;
      if (!z?.body?.enable) continue;

      const overlapping = Phaser.Geom.Intersects.RectangleToRectangle(p, z.getBounds());
      // inside=true 表示「人還在 trigger 裡面」，所以不會再觸發
      t.inside = overlapping;
    }
  });
}};

// 初始依照地圖決定是否啟用（只在白園才需要先建）
if (initStage === "white_garden") {
  this.buildWhiteGardenTriggers();
  this.enableWhiteGardenTriggers(true);
} else {
  this.enableWhiteGardenTriggers(false);
}

if (initStage === "coffee") {
  this.buildCoffeeTriggersFromMap();
  this.enableCoffeeTriggers(!!window.__COFFEE_FREE_ROAM__);
} else {
  this.enableCoffeeTriggers(false);
}

this.applyStageTriggers = (stage) => {
  // 主 triggerZone
  const mainOn = (stage === "prologue_fire");
  if (this.triggerZone?.body) {
    this.triggerZone.body.enable = mainOn;
    this.triggerZone.active = mainOn;
  }

  // ✅ 白園 triggers：進白園就確保存在
  if (stage === "white_garden") {
    const broken = !this.whiteTriggers?.length || !this.whiteTriggers[0]?.zone?.body;
    if (broken) this.buildWhiteGardenTriggers();     // ✅ 被清掉就重建
    this.enableWhiteGardenTriggers(true);
  } else {
    this.enableWhiteGardenTriggers(false);
  }

  // ✅ coffee triggers：進 coffee 就確保存在（從 tilemap 的 Triggers 物件層讀）
  if (stage === "coffee") {
    const broken = !this.coffeeTriggers?.length || !this.coffeeTriggers[0]?.zone?.body;
    if (broken) this.buildCoffeeTriggersFromMap(); // ✅ 被清掉或尚未建就重建
    this.enableCoffeeTriggers(true);
  } else {
    this.enableCoffeeTriggers(false);
  }

  this.canTrigger = true;
};

  // ============ 輸入鍵 ============
  // 你的鍵位（PC）：
  // - ↑↓←→：移動
  // - Enter / Space：確認 / 繼續劇情
  // - Esc：返回 / 關閉
  // - 設定：←→ 調整音量
  // - 遊戲中：S 存檔、Q 開啟副選單、R 開主選單
  //
  // ✅ 手機需求：
  // - 移動與繼續劇情「也能用 click/tap」
  // - S/Q/R 保留鍵盤，並在手機顯示 S/Q/R 按鍵

  // 方向鍵（保留原本）
  this.cursors = this.input.keyboard.createCursorKeys();

  // 確認/繼續（保留原本）
  this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // click-to-move 狀態（作為「替代操作」，不取代方向鍵）
  this._clickMove = { active: false, tx: 0, ty: 0 };

  // 手機虛擬按鍵狀態
  this._vkeys = { up: false, down: false, left: false, right: false };

  const isTouchDevice = () => {
    try {
      return ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
    } catch (_e) {
      return false;
    }
  };

  const stop = (e) => {
    try { e.preventDefault(); } catch (_e) {}
    try { e.stopPropagation(); } catch (_e) {}
  };

  // 點一下：
  // - 若對話開著 -> 下一句
  // - 否則 -> 設定 click move 目標（世界座標）
  this.input.on("pointerdown", (pointer) => {
    // 主選單/副選單開著就不吃
    if (menuEl.classList.contains("show") || ingameMenuEl?.classList.contains("show")) return;

    // 有選項彈窗時，讓按鈕自己處理（避免點背景跳過）
    if (typeof isChoiceOpen === "function" && isChoiceOpen()) return;

    if (dialogOpen) {
      nextDialog();
      return;
    }

    // 遊戲結束就不移動
    if (window.gameFinished === true) return;

    this._clickMove.active = true;
    this._clickMove.tx = pointer.worldX;
    this._clickMove.ty = pointer.worldY;
  });

  // 點對話框本身也能下一句（對話框是 DOM，不一定點得到 canvas）
  if (!dialogEl.__clickNextBound) {
    dialogEl.addEventListener("click", () => {
      if (!dialogOpen) return;
      if (typeof isChoiceOpen === "function" && isChoiceOpen()) return;
      nextDialog();
    });
    dialogEl.__clickNextBound = true;
  }

  // ===== 手機：建立虛擬按鍵（方向 + S/Q/R） =====
  // 需求：
  // - Q/R/S 移到右上角（避免被對話框擋）
  // - 對話框開啟時，方向鍵可消失（保留 Q/R/S）
  const updateMobilePadVisibility = () => {
    const ui = document.querySelector('.mz-mobile-ui');
    if (!ui) return;
    ui.classList.toggle('mz-dialog-open', !!dialogOpen);
  };

  // 讓其他函式（openCurrentDialog/closeDialog/讀檔）也能同步手機方向鍵顯示
  window.__MZ_UPDATE_MOBILE_PAD__ = updateMobilePadVisibility;

  if (isTouchDevice() && !window.__MZ_MOBILE_UI__) {
    window.__MZ_MOBILE_UI__ = true;

    // 注入簡單 CSS（避免你還要改 CSS 檔）
    const style = document.createElement("style");
    style.textContent = `
      .mz-mobile-ui{position:fixed;inset:0;pointer-events:none;z-index:9999;font-family:system-ui, -apple-system, Segoe UI, Roboto, Noto Sans TC, sans-serif;}
      .mz-pad{position:absolute;left:12px;bottom:12px;width:168px;height:168px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:8px;pointer-events:auto;touch-action:none;}
      .mz-mobile-ui.mz-dialog-open .mz-pad{display:none;}
      .mz-btn{border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;}
      .mz-btn:active{transform:scale(.98);background:rgba(0,0,0,.5);}
      /* ✅ Q/R/S 移到右上角 */
      .mz-actions{position:absolute;right:12px;top:12px;bottom:auto;display:flex;flex-direction:column;gap:10px;pointer-events:auto;touch-action:none;}
      .mz-actions .mz-btn{width:72px;height:56px;font-size:16px;letter-spacing:.5px;}
      .mz-actions .mz-btn.small{height:46px;font-size:15px;}
      .mz-actions .mz-btn.ghost{background:rgba(0,0,0,.25);}
    `;
    document.head.appendChild(style);

    // 容器
    const ui = document.createElement("div");
    ui.className = "mz-mobile-ui";

    // 方向鍵
    const pad = document.createElement("div");
    pad.className = "mz-pad";

    const mk = (label, cls) => {
      const b = document.createElement("div");
      b.className = `mz-btn ${cls||""}`;
      b.textContent = label;
      return b;
    };
    const empty = () => {
      const e = document.createElement("div");
      e.style.pointerEvents = "none";
      return e;
    };

    const bUp = mk("↑");
    const bLeft = mk("←");
    const bRight = mk("→");
    const bDown = mk("↓");

    pad.appendChild(empty());
    pad.appendChild(bUp);
    pad.appendChild(empty());
    pad.appendChild(bLeft);
    pad.appendChild(empty());
    pad.appendChild(bRight);
    pad.appendChild(empty());
    pad.appendChild(bDown);
    pad.appendChild(empty());

    // 綁定按住移動
    const bindHold = (el, key) => {
      const down = (ev) => { stop(ev); this._vkeys[key] = true; this._clickMove.active = false; };
      const up   = (ev) => { stop(ev); this._vkeys[key] = false; };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    bindHold(bUp, "up");
    bindHold(bDown, "down");
    bindHold(bLeft, "left");
    bindHold(bRight, "right");

    // S / Q / R
    const actions = document.createElement("div");
    actions.className = "mz-actions";
    const bS = mk("S\n存檔");
    const bQ = mk("Q\n副選單", "ghost small");
    const bR = mk("R\n主選單", "ghost small");
    bS.style.whiteSpace = "pre-line";
    bQ.style.whiteSpace = "pre-line";
    bR.style.whiteSpace = "pre-line";

    const clickBtn = (el, fn) => {
      el.addEventListener("pointerdown", (ev) => { stop(ev); fn?.(); });
    };
    clickBtn(bS, () => {
      const gs = ensureGameState();
      // 跟你原本熱鍵一致：playing 且沒有開選單
      if (gs.phase === "playing" && !menuEl.classList.contains("show") && !ingameMenuEl.classList.contains("show")) {
        saveGame();
        showToast?.("已存檔");
      }
    });
    clickBtn(bQ, () => {
      if (!ingameMenuEl) return;
      if (ingameMenuEl.classList.contains("show")) hideIngameMenu();
      else showIngameMenu();
    });
    clickBtn(bR, () => {
      const gs = ensureGameState();
      if (gs.phase === "ended") return;
      if (menuEl.classList.contains("show")) hideMenu();
      else showMenu();
    });

    actions.appendChild(bS);
    actions.appendChild(bQ);
    actions.appendChild(bR);

    ui.appendChild(pad);
    ui.appendChild(actions);
    document.body.appendChild(ui);

    // 初始同步一次
    updateMobilePadVisibility();
  }

  // ============ 相機 ============
  this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  this.cameras.main.setZoom(1.5);

  // 讓全域可取到 scene
  window.__SCENE__ = this;

  // （警語已在 create() 一開始處理；這裡不要再呼叫，避免重複綁事件/開兩次計時器）

  // ============ Continue：套用讀檔（只做一次） ============
  if (gs.pendingLoad) {
  const d = gs.pendingLoad;
  gs.pendingLoad = null;


  // ✅ 讀檔進場先確保 UI 乾淨（避免延續上一輪的對話框）
  try { closeDialog(); } catch(_e) {}
  try { closeChoicePopup(); } catch(_e) {}
  // ✅ 玩家位置
  if (this.player && d.player) {
    if (this.player.body) this.player.body.reset(d.player.x, d.player.y);
    else { this.player.x = d.player.x; this.player.y = d.player.y; }
  }
  this.player.facing = d.player?.facing ?? "right";
  this.player.setFlipX(!!d.player?.flipX);

  // ✅ 還原其他角色狀態
  if (d.actors && this.actors) {
    for (const [key, state] of Object.entries(d.actors)) {
      const a = this.actors[key];
      if (!a) continue;
      if (state.x != null) a.x = state.x;
      if (state.y != null) a.y = state.y;
      if (state.flipX != null) a.setFlipX(state.flipX);
      if (state.facing) a.facing = state.facing;
      if (state.visible != null) a.setVisible(state.visible);
      if (state.locked != null) a.__locked = !!state.locked;
      if ("forcedFlipX" in state) a.__forcedFlipX = state.forcedFlipX;
      if (state.angle != null) a.angle = state.angle;
      if (state.alpha != null) a.alpha = state.alpha;
      if (state.isDown) {
        a.__isDown = true;
        a.angle = -90; // 或你想呈現的倒地角度
        a.alpha = 0.85;
      } else {
        a.__isDown = false;
        a.angle = 0;
        a.alpha = 1;
      }
    }
  }
  applyStoryWorldState(this);
  this.applyStageTriggers?.(window.__STAGE__);
  // ✅ 讀檔時避免「一進場就立刻觸發」：先暫時關閉，再延遲開回來
  this.canTrigger = false;
  this.time?.delayedCall?.(200, () => { this.canTrigger = true; });

  // ✅ 讀檔後「接續進度」：
// - 若存檔時對話正在開啟：一定要接回去
// - 若存檔時對話關閉，但 storyIndex > 0：通常代表你已經在某章中途，避免重踩觸發器把 storyIndex 重置成 0
  const shouldResumeDialog = !!d.dialogOpen;
  if (shouldResumeDialog && !d.gameFinished) {
    currentDialogId = d.currentDialogId ?? currentDialogId;
    storyIndex = d.storyIndex ?? storyIndex;

    dialogOpen = true;
    dialogEl.classList.add("show");
    // 手機：讀檔若直接進對話，方向鍵要隱藏
    try { window.__MZ_UPDATE_MOBILE_PAD__?.(); } catch (_e) {}
    renderDialog();
  }
}

  gs.restoring = false;
}

update() {
  // ✅ 若主選單或副選單打開，就不要處理移動（避免還能走）
  if (menuEl.classList.contains("show") || ingameMenuEl?.classList.contains("show")) {
    this.player.body.setVelocity(0, 0);
    return;
  }

  // 開對話時禁止移動，只允許翻頁
  if (dialogOpen) {
    this.player.body.setVelocity(0, 0);
    if (
      Phaser.Input.Keyboard.JustDown(this.keyEnter) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace)
    ) {
      nextDialog();
    }
    return;
  }

  const speed = 120;
  let vx = 0, vy = 0;

  // ===== 方向鍵 / 手機虛擬方向鍵（優先） =====
  const leftDown  = !!this.cursors?.left?.isDown  || !!this._vkeys?.left;
  const rightDown = !!this.cursors?.right?.isDown || !!this._vkeys?.right;
  const upDown    = !!this.cursors?.up?.isDown    || !!this._vkeys?.up;
  const downDown  = !!this.cursors?.down?.isDown  || !!this._vkeys?.down;

  if (leftDown || rightDown || upDown || downDown) {
    // 只要玩家有在按方向，就中止 click move
    if (this._clickMove) this._clickMove.active = false;

    if (leftDown) vx = -speed;
    else if (rightDown) vx = speed;
    else vx = 0;

    if (upDown) vy = -speed;
    else if (downDown) vy = speed;
    else vy = 0;

    // 4 向優先：同時按斜向時，保留你原本的習慣（這裡允許斜向；如你要鎖 4 向可再改）
  } else {
    // ===== Click/Tap to move（沒按方向時才生效） =====
    if (this._clickMove?.active) {
      const dx = this._clickMove.tx - this.player.x;
      const dy = this._clickMove.ty - this.player.y;

      // 到達目標就停
      const eps = 6;
      if (Math.abs(dx) <= eps && Math.abs(dy) <= eps) {
        this._clickMove.active = false;
        vx = 0; vy = 0;
      } else {
        // 4 向：哪個方向差距大就先走哪個
        if (Math.abs(dx) > Math.abs(dy)) {
          vx = dx > 0 ? speed : -speed;
          vy = 0;
        } else {
          vy = dy > 0 ? speed : -speed;
          vx = 0;
        }
      }
    }
  }

  // 面向（用 flipX 鏡像）
  if (vx < 0) {
    this.player.facing = "left";
    this.player.setFlipX(true);
  } else if (vx > 0) {
    this.player.facing = "right";
    this.player.setFlipX(false);
  }

  this.player.body.setVelocity(vx, vy);
}
}

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 640,
  height: 360,
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  },
  dom: { createContainer: true }, // ✅ 必須
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);

// 視窗縮放時自動調整
window.addEventListener("resize", () => {
  // Phaser 會自己 FIT；這裡留著也行
});



