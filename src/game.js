// Phaser 最小「像素探索 + 事件觸發 + 對話」範例
// 特色：
// - 方向鍵移動
// - 走進發光區域 => 觸發劇情對話（Enter/Space 下一句）
// - 不用任何圖片資產（先用幾何圖形），你之後再換成像素素材

const dialogEl = document.getElementById("dialog");
const dialogNameEl = document.getElementById("dialogName");
const dialogTextEl = document.getElementById("dialogText");
const dialogPortraitEl = document.getElementById("dialogPortrait");
// ===== DOM =====
const menuEl = document.getElementById("menu");
const btnStart = document.getElementById("btnStart");
const btnContinue = document.getElementById("btnContinue");
const btnSettings = document.getElementById("btnSettings");
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


function ensureGameState() {
  window.__GAME_STATE__ = window.__GAME_STATE__ || {
    phase: "menu", // "menu" | "playing" | "paused" | "ended"
    finished: false,
    pendingLoad: null,
  };
  return window.__GAME_STATE__;
}
ensureGameState();

function showEndOverlay() {
  const gs = ensureGameState();
  endOverlayEl?.classList.add("show");
  gs.phase = "ended";
  gs.finished = true;
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

function showMenu() {
  const gs = ensureGameState();
  refreshContinueButton();

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
function adjustSlider(delta) {
  const target = musicVolEl;
  const cur = Number.parseFloat(target.value || "0");
  const v = Math.max(0, Math.min(1, cur + delta));
  target.value = String(Number(v.toFixed(2)));
}

// ===== Save =====
function saveGame() {
  const scene = window.__SCENE__;
  const payload = {
    t: Date.now(),
    storyStep,
    storyIndex,
    currentDialogId,
    dialogOpen,
    gameFinished: !!gameFinished,
    player: scene?.player ? { x: scene.player.x, y: scene.player.y } : null,
    stage: window.__STAGE__ || "prologue_fire",
    playerFacing: scene?.player?.facing ?? "right",
    playerFlipX: !!scene?.player?.flipX,
    whiteGardenFired: Object.fromEntries(
      WHITE_GARDEN_TRIGGERS.map(t => [t.id, !!t.fired])
    ),
  };
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
}

// ===== Keyboard =====
function onKeyDown(e) {
  const gs = ensureGameState();
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
    if (e.key === "ArrowLeft") adjustSlider(-0.05);
    if (e.key === "ArrowRight") adjustSlider(+0.05);
    if (e.key === "Enter" || e.key === " ") { closeSettings(); return; }
  }
}

window.addEventListener("keydown", onKeyDown, { capture: true });

function startNewGame() {
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

  // ✅ 先把劇情變數還原
  gameFinished = !!data.gameFinished;
  storyStep = data.storyStep ?? 0;
  storyIndex = data.storyIndex ?? 0;
  currentDialogId = data.currentDialogId ?? STORY_FLOW[0];
  dialogOpen = !!data.dialogOpen;   // ✅ 還原

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
  },
  "冰炎": {
    normal: "assets/img/bing_portrait.png",
    angry:  "assets/img/bing_portrait_angry.png",
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
};

const STAGE_SPAWN = {
  blackhall: {
    bed: { x: 144, y: 80 },
    default: { x: 80, y: 144 }
  },
  white_garden: {
    entry: { x: 120, y: 195 },     // 例：入口
    pond:  { x: 380, y: 140 },     // 例：池邊
    default: { x: 240, y: 200 }
  }
};

const WHITE_GARDEN_TRIGGERS = [
  // 你可以依地圖調整座標/大小
  { id: "white_garden", x: 560, y: 190, w: 20, h: 75, once: true, fired: false },
  // { id: "pond_event", x: 340, y: 120, w: 70, h: 50, once: false, fired: false },
];

const DIALOGS = {
  prologue_fire: [
    { name: "  ", text: "戰火肆虐，青青草地被大火蔓延染上枯涸色彩；空氣中瀰漫著殘缺屍體被火吻後、好似烤肉香同時卻又夾雜著腐臭味，令人作嘔。" },
    { name: "  ", text: "褚冥漾回過神看見自己熟悉的場景變化，臉上佈滿驚恐。" },
    { name: "  ", action: { type: "move", actor: "chu", dx: -24, dy: 0, ms: 300 }, auto: true },
    { name: "褚冥漾", text: "怎、怎麼回事......", face: "shock"},
    { name: "  ", text: "學院裡似乎沒有一個活口。" },
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
     { type: "dashBehind", actor: "bing", target: "chu", dx: -10, dy: 0, ms: 220 } 
     ]},
    { name: "  ", text: "他瞪大眼睛詫異，憑他的能力居然沒發覺身後有人。" },
    { name: "  ", text: "而當他看清來者時，詫異被不可置信給取代。" },
    { name: "  ", text: "沒入體內的兇器是他再熟悉不能的峰云凋戈。順著槍身，他看到那白皙蔥指有著微不可察的顫抖。" },
    { name: "褚冥漾", text: "學長......為什麼......", face: "blood" },
    { name: "冰炎", text: "閉嘴！褚冥漾！", face: "angry" },
    { name: "  ", text: "學長打斷他的口氣有著憤恨、失望。紅瞳中倒映著褚冥漾蒼白的面容，可卻被憎恨充盈。" },
    { name: "冰炎", text: "你——背叛了我們——", face: "angry" },
    { name: "  ", text: "褚冥漾想要辯解，但一啟唇就是一口腥甜。絳紅順著嘴角流下，褚冥漾雙腿已快無力。" },
    { name: "褚冥漾", text: "我......沒有......我......沒......背、背叛......", face: "blood" },
    { name: "冰炎", text: "住口！", face: "angry" },
    { name: "  ", text: "不願看到曾經的學弟那乞求的目光，冰炎眼一閉。" },
    { name: "  ", text: "他還是顧及褚冥漾之間的情份；他能做的就是減少對方的痛苦，送對方儘早投胎。" },
    { name: "  ", text: "噗嗤！", action: [
  { type: "move", actor: "bing", dx: -5, dy: 0, ms: 200 },
  { type: "cameraZoom", from: 3, to: 4.2, ms: 200 },
  { type: "flashWhite", peak: 0.95, msIn: 50, msOut: 200 },
  { type: "cameraShake", ms: 180, intensity: 0.02 }
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
    { type: "sitUp", actor: "chu", ms: 450 },
    { type: "flashWhite", peak: 0.8, msIn: 60, msOut: 220 },
    { type: "fadeBlack", to: 0, ms: 450 }
  ]},
    { name: "褚冥漾", text: "哈！", face: "shock" },
    { name: "  ", text: "從床上直起身，褚冥漾額角佈滿冷汗。他環顧四周，昏暗的空間、窗外點點繁星。" },
    { name: "  ", text: "褚冥漾摸著胸口，不禁鬆口氣。" },
    { name: "褚冥漾", text: "還好只是一場夢……", face: "normal" },
    { name: "  ", text: "自己則是在黑館房內。" },
    { name: "  ", text: "深呼吸一口氣，雖然餘悸猶存，但對於還是地球人的褚冥漾睡眠還是很重要。" },
    { name: "  ", text: "他躺回床上，閉上眼前心想：希望別再做這場夢境。" },
    { name: "  ", text: "（……）", action: [
      { type: "gotoStage", stage: "white_garden", spawn: "entry" },
      { type: "fadeBlack", to: 0, ms: 450 }
]}
  ],

  white_garden: [
    { name: "  ", text: "再一次睜眼，白園青草藍天、吹拂過臉上的微風中帶有著花草香。" },
    { name: "  ", text: "褚冥漾看著附近的大樹，上頭空氣精靈開心的唱歌跳舞。" },
    { name: "  ", text: "驀然間，一道聲音打破這樣的寧靜。" },
    { name: "？？？", text: "褚冥漾——你這個背叛者！" },
    { name: "  ", text: "回過身褚冥漾看向來者，只見對方手舉著一把它熟悉到不能再熟悉的長弓，指著他吶喊他是背叛者。", action: { type: "face", actor: "chu", dir: "left" } },
    { name: "千冬歲", text: "褚冥漾！你竟敢傷害夏碎哥！", action: [ 
      { type: "show", actor: "qian" },
      { type: "runTo", actor: "qian", x: 425, y: 196, ms: 450 }
 ]},
    { name: "褚冥漾", text: "......蛤？", face: "shock" },
    { name: "褚冥漾", text: "『他說的那個夏碎哥是我知道的那個夏碎嗎？』", face: "really" },
    { name: "褚冥漾", text: "『應該......？是......吧？』", face: "really" },
    { name: "褚冥漾", text: "『我打夏碎？真的假的？』", face: "really" },
    { name: "褚冥漾", text: "修但幾類，你先冷靜一點千冬歲......", face: "really" },
    { name: "  ", text: "一句｢你是不是認錯人了？｣還沒說出口，遠處又傳來一道聲音打斷褚冥漾的辯解。" },
    { name: "？？？", text: "你為什麼要率領鬼族攻擊公會的醫療班？" },
    { name: "米可蕥", text: "喵喵對你實在是太失望了！" , action: [ 
      { type: "runTo", actor: "qian", x: 450, y: 170, ms: 500 }, 
      { type: "show", actor: "cat" },
      { type: "runTo", actor: "cat", x: 425, y: 196, ms: 450 }
    ]},
    { name: "米可蕥", text: "一直以來喵喵都看錯人了！虧喵喵一直以來都把你當朋友看！",action: { type: "jump", actor: "cat" } },
    { name: "褚冥漾", text: "喵喵？！", face: "shock" },
    { name: "米可蕥", text: "沒想到你到現在竟然還不承認罪刑！",action: { type: "jump", actor: "cat" } },
    { name: "褚冥漾", text: "你們有給我辯解的機會嗎！！！", face: "wtf" },
    { name: "  ", text: "這時，米可蕥往旁邊移動了些，給來人讓出些位置。", action: [ 
      { type: "runTo", actor: "qian", x: 450, y: 165, ms: 500 }, 
      { type: "runTo", actor: "cat", x: 405, y: 170, ms: 500 },
      { type: "show", actor: "ryan" },
      { type: "runTo", actor: "ryan", x: 420, y: 196, ms: 500 }
    ]},
    { name: "米可蕥", text: "你看！把萊恩打得都只能隱身了！", action: { type: "jump", actor: "cat" } },
    { name: "萊恩？", text: "......" },
    { name: "褚冥漾", text: "......" },
    { name: "褚冥漾", text: "屁啦！！！", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
    { name: "褚冥漾", text: "『槽點太多了不知道該從哪裡開始吐槽......』", face: "deny" },
    { name: "褚冥漾", text: "『這絕對是有人偷工減料吧......』", face: "wtf" },
    { name: "萊恩？", text: "你不再是我萊恩·史凱爾的朋友了。" },
    { name: "褚冥漾", text: "你還是先解除隱身狀態吧！！！", face: "really", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
    { name: "萊恩？", text: "我不會隱身......", action: { type: "runTo", actor: "qian", x: 455, y: 145, ms: 500 } },
    { name: "  ", text: "萊恩一臉失落(雖然其實根本看不到表情)的往旁邊移動了一些。", action:{ type: "runTo", actor: "ryan", x: 440, y: 167, ms: 600 } },
    { name: "千冬歲", text: "你這個邪惡的妖師！現在竟然還對萊恩進行精神攻擊！！！", action: { type: "jump", actor: "qian" } },
    { name: "褚冥漾", text: "千冬歲你睜開眼睛看看啊！我不信你兩眼空空看不清楚是誰在傷害萊恩！！！", face: "wtf" },
    { name: "千冬歲", text: "閉嘴！你這個背叛者沒資格喊我的名字，聽了就噁心!", action: { type: "jump", actor: "qian" } },
    { name: "褚冥漾", text: "到底是怎樣啊！！！", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
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
    { name: "褚冥漾", text: "......哩喜勒靠！！！！！", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
    { name: "褚冥漾", text: "安因你不是天使嗎？！你要不要聽聽看你在說甚麼？！！！", face: "wtf" },
    { name: "褚冥漾", text: "我打賽塔？？！！那像話嗎？！", face: "wtf" },
    { name: "褚冥漾", text: "我怎麼打？？！用米納斯嗎？！他隨便一個肘擊就能把我肋骨打斷了好嗎！！！", face: "wtf" },
    { name: "安因", text: "漾漾，天堂地獄一念之間，路是自己走出來的，別把自己的路走絕了，好嗎？" },
    { name: "褚冥漾", text: "......我唯一的路就是跑路。", face: "uh" },
    { name: "安因", text: "那就沒辦法了......褚冥漾，我奉公會之令，在此討伐你。" },
    { name: "褚冥漾", text: "聽我說話啊！！！", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
    { name: "西瑞", text: "漾～要統治世界怎麼不找本大爺～", action: [ 
      { type: "show", actor: "five" },
      { type: "runTo", actor: "five", x: 420, y: 200, ms: 300 },
      { type: "sfx", key: "hit", volume: 0.3 },
      { type: "runTo", actor: "angel", x: 430, y: 225, ms: 400 },
      { type: "emote", actor: "angel", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 },
    ]},
    { name: "褚冥漾", text: "『嗯，終於來了個正常的。』"},
    { name: "褚冥漾", text: "『但來的是最不正常的那一個......』", face: "cry" },
    { name: "  ", text: "安因微微瞇起眼睛，語氣溫和卻又帶著不可侵犯的氣勢：" },
    { name: "安因", text: "西瑞．羅耶伊亞同學，如今這個狀況，有必要再影響褚同學添一把亂嗎？" },
    { name: "西瑞", text: "乾你這個天使什麼事情？本大爺說好了要跟小弟浪跡天涯統治世界！" },
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
      { type: "runTo", actor: "twins1", x: 420, y: 205, ms: 500 } 
      ]},
    { name: "雷多", text: "褚冥漾！你為什麼要傷害伊多！！！" },
    { name: "  ", text: "褚冥漾此時已經完全沒有驚恐、困惑以及吐槽的慾望，他只有一種｢嗯，果然如此」的感想。", face: "nolove" },
    { name: "  ", text: "而此時，褚冥漾身後傳來了另一個與雷多聲線極為相似的男聲。" },
    { name: "雅多", text: "雷多，你清醒一點！", action: [
  { type: "show", actor: "twins2" },
  { type: "toPlayer", actor: "twins2", enterFrom: "right", enterDist: 260, side: "right", gapY: 1, ms: 250 }
]},
    { name: "雅多", text: "漾漾的實力哪有辦法打傷伊多！！", action: { type: "toPlayer", actor: "twins2", side: "up", gapY: 1, ms: 450 }},
    { name: "褚冥漾", text: "『真是謝囉！！！』", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
    { name: "  ", text: "聞聽此言，雷多原本憤怒如惡鬼的臉轉為困惑，紅色的雙眸逐漸變回溫潤的褐色，他張口欲言，卻又很快抿緊唇瓣，似乎是想不出更合理的理由反駁。" },
    { name: "雷多", text: "可是......影像球上......" },
    { name: "  ", text: "雷多似乎還想掙扎一下，可隨後一個溫潤的聲音打斷了他的思緒，也讓他的雙眸重新亮起。" },
    { name: "伊多", text: "雷多。", action: [
  { type: "show", actor: "bigbro" },
  { type: "face", actor: "bigbro", dir: "left" },
  { type: "toPlayer", actor: "bigbro", enterFrom: "right", enterDist: 260, side: "right", gapY: 1, ms: 450 },
  ]},
    { name: "雷多", text: "伊多！", action: { type: "toPlayer", actor: "bigbro", side: "down", gapY: 1, ms: 450 } },
    { name: "  ", text: "伴隨著雷多驚喜的聲音，水妖精如風一般衝到伊多面前，擋在他身前面向眾人。", action: [
  { type: "toActor", actor: "twins1", target: "bigbro", side: "left", gap: 1, speed: 200 },
  { type: "face", actor: "twins1", dir: "left" }
  ]},
    { name: "雷多", text: "對不起，漾漾，我剛剛竟然懷疑你。" },
    { name: "褚冥漾", text: "......沒關係。" },
    { name: "褚冥漾", text: "『倒不如說我才想謝謝你相信我的實力。』", face: "cry" },
    { name: "  ", text: "氣氛變得有些詭譎，水妖精三兄弟的談話皆被在場眾人聽進耳裡，不少人臉上都出現了動搖。" },
    { name: "  ", text: "最後是千冬歲打破了詭異的平靜。" },
    { name: "千冬歲", text: "大家不要被騙了！邪惡的妖師肯定是使用了言靈操控了獸王族跟水妖精三兄弟！", action: { type: "jump", actor: "qian" } },
    { name: "褚冥漾", text: "千冬歲哩系中猴喔！！！你也太看得起我了吧！！！", face: "wtf", action: { type: "emote", actor: "chu", key: "angry", ms: 800, dx: 10, dy: 15, scale: 0.4 } },
    { name: "千冬歲", text: "大家都清楚你有怎樣強大的力量，不要再裝蒜了！" },
    { name: "？？？", text: "沒錯。", action: [
  { type: "show", actor: "ran" },
  { type: "show", actor: "moon" }
  ]},
    { name: "  ", text: "來人聲音不大，卻一下吸引了所有人的注意——是白陵然。", action: [
      { type: "runTo", actor: "ran", x: 435, y: 200, ms: 800 },
      { type: "runTo", actor: "moon", x: 400, y: 205, ms: 600 } 
    ]},
    { name: "  ", text: "若是平時，在看到白陵然後，褚冥漾應該會感到安心，然而一堆好友腦袋突然變得不正常，加上白陵然和褚冥玥兩人凝重的臉色，讓褚冥漾有種非常、非常不好的預感。" },
    { name: "  ", text: "白陵然率先開口，他幾乎是用一種痛心疾首的表情看著褚冥漾，聲音很輕：" },
    { name: "白陵然", text: "漾漾，你為什麼要傷害辛西亞？" },
    { name: "褚冥漾", text: "......" },
    { name: "褚冥漾", text: "......", face: "uh" },
    { name: "褚冥漾", text: "......", face: "wtf" },
    { name: "褚冥漾", text: "『我．就．知．道。』", face: "cry" },
    { name: "褚冥漾", text: "『不，不對，我不知道，我根本不知道我怎麼做的。』", face: "cry" },
    { name: "  ", text: "在褚冥漾還沒反應過來前，這次換褚冥玥咬著牙開口了。" },
    { name: "褚冥玥", text: "漾漾，辛西亞從來沒有虧待過你，她還做綠豆湯給你喝，為什麼要傷害她？" },
    { name: "褚冥漾", text: "......", face: "shock" },
    { name: "褚冥漾", text: "......", face: "deny" },
    { name: "褚冥漾", text: "你是誰？！！你！絕！對！不！是！我！姊！！！", face: "wtf", action: { type: "cameraShake", ms: 180, intensity: 0.05 } },
  ]
};

// 1) 章節順序（一定要放在 currentDialogId 前）
const STORY_FLOW = [
  "prologue_fire",
  "wake_blackhall",
  "white_garden"
];

let gameFinished = false;
let storyStep = 0;          // 目前跑到第幾段（第幾章節）
let currentDialogId = STORY_FLOW[0];
let storyIndex = 0;         // 章節內第幾句
let dialogOpen = false;

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
    if (arr.some(a => a && a.type === "show" && a.actor === "Coffee")) return true;
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

if (currentDialogId === "white_garden" && cat) {
  cat.setVisible(shouldcatBeVisible(lines, idx));
}
  
if (currentDialogId === "white_garden" && ryan) {
  ryan.setVisible(shouldryanBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && angel) {
  angel.setVisible(shouldAngelBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && five) {
  five.setVisible(shouldFiveBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && moon) {
  moon.setVisible(shouldMoonBeVisible(lines, idx));
}
  
if (currentDialogId === "white_garden" && ran) {
  ran.setVisible(shouldRanBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && twins1) {
  twins1.setVisible(shouldTwins1BeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && twins2) {
  twins2.setVisible(shouldTwins2BeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && bigbro) {
  bigbro.setVisible(shouldBroBeVisible(lines, idx));
}

if (currentDialogId === "white_garden" && coffee) {
  coffee.setVisible(shouldCoffeeBeVisible(lines, idx));
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
      if (dialogOpen) nextDialog();
    }, delay);

    return;
  }
  dialogNameEl.textContent = line?.name ?? "";
  dialogTextEl.textContent = line?.text ?? "";

  // ✅ 左側頭像：有對應就顯示，沒有就隱藏
  const speaker = normalizeName(line.name);
  const src = speaker ? getPortrait(speaker, line.face) : "";
  if (src) {
    dialogPortrait.src = src;
    dialogPortrait.classList.remove("hidden");
  } else {
    dialogPortrait.classList.add("hidden");
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
      if (dialogOpen) nextDialog();
    }, delay);
  }
}

function openCurrentDialog() {
  currentDialogId = STORY_FLOW[storyStep];
  storyIndex = 0;
  dialogOpen = true;
  dialogEl.classList.add("show");
  renderDialog();
}

function closeDialog() {
  dialogOpen = false;
  dialogEl.classList.remove("show");
}

function lineHasDashBehindBing(line) {
  const acts = Array.isArray(line?.action) ? line.action : [line?.action];
  return acts.some(a => a && a.type === "dashBehind" && a.actor === "bing");
}

function nextDialog() {
  const lines = DIALOGS[currentDialogId] || [];
  // ✅ 先判斷「現在這一句」是不是 dashBehind
  const wasDash = lineHasDashBehindBing(lines[storyIndex]);
  storyIndex++;

if (storyIndex >= lines.length) {
  closeDialog();

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
  const key = action.key ?? "hit";
  const volume = action.volume ?? 1;
  const rate = action.rate ?? 1;
  const detune = action.detune ?? 0;

  // allowMultiple=false 會避免同音效疊太多（可選）
  if (action.allowMultiple === false) scene.sound.stopByKey(key);

  scene.sound.play(key, { volume, rate, detune });

  return Promise.resolve(); // 播放不用等，直接往下跑劇情
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
  this.load.image("angry", "assets/img/angry.png"); 
  // 你如果之後有冰炎/第三人，也可以加
  // this.load.image("bing_front", "assets/bing_front.png");
  this.load.audio("hit", "assets/audio/hit.mp3");

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
  if (!cfg) {
    console.warn("[loadStageMap] unknown stage:", stageKey);
    return;
  }
  this.clearCurrentMap();
  const map = this.make.tilemap({ key: cfg.mapKey });
  this._tilemap = map;

  // 建 tilesets（可多張）
  const phaserTilesets = [];
  for (const ts of (cfg.tilesets || [])) {
    const tset = map.addTilesetImage(ts.name, ts.imageKey);
    if (!tset) {
      console.warn("[tilemap] addTilesetImage failed:", ts.name, ts.imageKey);
      continue;
    }
    phaserTilesets.push(tset);
  }

  // 建立 layers：不指定就把所有 tile layer 都建出來
  const want = cfg.buildLayerNames ? new Set(cfg.buildLayerNames) : null;

this._mapLayers = [];
this._layersByName = {};   // ✅ 每次換地圖都重建

function depthForLayer(name) {
  // 依你截圖的層級（上到下：人、火、路燈下、草叢下、人1、草叢上、路燈上、地面、背景3）
  if (name.includes("背景")) return 0;
  if (name === "地面") return 10;

  // 中景（在角色下面）
  if (name === "路燈上") return 18;
  if (name === "草叢上") return 19;
  if (name === "房間") return 19;

  // 前景（要蓋住角色）
  if (name === "草叢下") return 40;
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
}

  create(data = {}) {
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

  // ============ GameState / 讀檔決定初始地圖 ============
  const gs = ensureGameState();
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

// 初始依照地圖決定是否啟用（只在白園才需要先建）
if (initStage === "white_garden") {
  this.buildWhiteGardenTriggers();
  this.enableWhiteGardenTriggers(true);
} else {
  this.enableWhiteGardenTriggers(false);
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

  console.log("[WG enable]", stage,
    this.whiteTriggers?.length,
    this.whiteTriggers?.[0]?.zone?.active,
    this.whiteTriggers?.[0]?.zone?.body?.enable
  );
  } else {
    this.enableWhiteGardenTriggers(false);
  }

  this.canTrigger = true;
};

  // ============ 輸入鍵 ============
  this.cursors = this.input.keyboard.createCursorKeys();
  this.keyEnter = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

  // ============ 相機 ============
  this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  this.cameras.main.setZoom(1.5);

  // 讓全域可取到 scene
  window.__SCENE__ = this;

  // ============ Continue：套用讀檔（只做一次） ============
  if (gs.pendingLoad) {
    const d = gs.pendingLoad;
    gs.pendingLoad = null;

    // 玩家位置
    if (this.player && d.player) {
      if (this.player.body) this.player.body.reset(d.player.x, d.player.y);
      else { this.player.x = d.player.x; this.player.y = d.player.y; }
    }

    this.player.facing = d.playerFacing ?? "right";
    this.player.setFlipX(!!d.playerFlipX);

    // 還原劇情世界狀態（角色顯示/鎖定等你原本的邏輯）
    applyStoryWorldState(this);

    // 避免一讀檔就立刻觸發
    this.canTrigger = false;

    // 還原對話視窗
    if (d.dialogOpen) {
      dialogOpen = true;
      dialogEl.classList.add("show");
      renderDialog(); // 不要用 openCurrentDialog（會推進進度）
    }

  this.applyStageTriggers?.(window.__STAGE__);
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

  if (this.cursors.left.isDown) vx = -speed;
  else if (this.cursors.right.isDown) vx = speed;

  if (this.cursors.up.isDown) vy = -speed;
  else if (this.cursors.down.isDown) vy = speed;

  // ✅ 新增：左右鍵改面向（用 flipX 鏡像）
  if (vx < 0) {
    this.player.facing = "left";
    this.player.setFlipX(true);
  } else if (vx > 0) {
    this.player.facing = "right";
    this.player.setFlipX(false);
  }
  // vx==0（只走上下或停住）就保持上一個 facing，不動

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
