import OBR from "@owlbear-rodeo/sdk";
import "./style.css";

const ID = "tools.horn.normal-d20";
const SETTINGS = `${ID}/settings`;
const HISTORY = `${ID}/history`;
const CHANNEL = `${ID}/roll`;
const hiddenKey = "normal-d20-hidden-rolls";
const defaults = { allowed: [], publicRolls: true };

let role = "PLAYER";
let name = "玩家";
let settings = defaults;
let party = [];
let hiddenRolls = [];
let history = [];
let params = JSON.parse(localStorage.getItem("normal-d20-params") || "null") || { center: 10.5, sigma: 3, bonus: 0 };

const app = document.querySelector("#app");
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n)));
const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function probabilities(center, sigma) {
  const weights = Array.from({ length: 20 }, (_, i) =>
    Math.exp(-0.5 * ((i + 1 - center) / sigma) ** 2),
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((weight) => weight / sum);
}

function rollNormal(center, sigma) {
  const weights = probabilities(center, sigma);
  let cursor = Math.random();
  for (let i = 0; i < weights.length; i += 1) {
    cursor -= weights[i];
    if (cursor <= 0) return i + 1;
  }
  return 20;
}

function slider(id, label, min, max, step, value) {
  return `<label class="slider"><span>${label}<output for="${id}">${value}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

function render() {
  const allowed = role === "GM" || settings.allowed.includes(OBR.player.id);
  app.innerHTML = `
    <header><img src="./icon.svg" alt=""><div><h1>正态 d20</h1><p>${role === "GM" ? "GM 控制台" : name}</p></div><span class="status">${settings.publicRolls ? "公开" : "仅 GM"}</span></header>
    ${allowed ? `<section class="dice-zone">
      <div id="die" class="die"><span>20</span></div>
      <div id="result" class="result">调整分布，然后投掷</div>
      <div id="bars" class="bars" aria-label="概率分布图"></div>
    </section>
    <section class="controls">
      ${slider("center", "中心值", 1, 20, 0.5, params.center)}
      ${slider("sigma", "分布宽度 σ", 0.6, 8, 0.1, params.sigma)}
      ${slider("bonus", "额外加值", -10, 20, 1, params.bonus)}
      <button id="roll" class="primary">投掷 d20</button>
    </section>` : `<section class="locked"><div>🔒</div><h2>尚未获准投掷</h2><p>请让 GM 在插件的权限列表中勾选你的名字。</p></section>`}
    ${role === "GM" ? `<section class="gm"><h2>GM 设置</h2><label class="switch"><input id="public" type="checkbox" ${settings.publicRolls ? "checked" : ""}><span>向所有人显示投掷结果</span></label><h3>允许投掷的玩家</h3><div id="players"></div><div id="hidden"></div></section>` : ""}
    <section class="history"><h2>最近公开结果</h2><div id="history"></div></section>
  `;
  if (allowed) bindControls();
  if (role === "GM") renderGm();
  renderHistory();
}

function bindControls() {
  ["center", "sigma", "bonus"].forEach((id) => {
    const input = document.querySelector(`#${id}`);
    input.addEventListener("input", () => {
      input.closest("label").querySelector("output").textContent = input.value;
      params[id] = Number(input.value);
      localStorage.setItem("normal-d20-params", JSON.stringify(params));
      drawDistribution();
    });
  });
  document.querySelector("#roll").addEventListener("click", doRoll);
  drawDistribution();
}

function drawDistribution() {
  const center = clamp(document.querySelector("#center").value, 1, 20);
  const sigma = clamp(document.querySelector("#sigma").value, 0.6, 8);
  const values = probabilities(center, sigma);
  const max = Math.max(...values);
  document.querySelector("#bars").innerHTML = values
    .map((p, i) => `<i style="height:${Math.max(3, (p / max) * 100)}%" title="${i + 1}: ${(p * 100).toFixed(1)}%"></i>`)
    .join("");
}

async function doRoll() {
  const center = clamp(document.querySelector("#center").value, 1, 20);
  const sigma = clamp(document.querySelector("#sigma").value, 0.6, 8);
  const bonus = clamp(document.querySelector("#bonus").value, -10, 20);
  const natural = rollNormal(center, sigma);
  const roll = {
    kind: "roll",
    id: makeId(),
    actorId: OBR.player.id,
    actor: name,
    natural,
    bonus,
    total: natural + bonus,
    center,
    sigma,
    visible: settings.publicRolls,
    time: Date.now(),
  };
  showRoll(roll);
  if (!roll.visible && role === "GM") {
    hiddenRolls.unshift(roll);
    localStorage.setItem(hiddenKey, JSON.stringify(hiddenRolls.slice(0, 20)));
  }
  await OBR.broadcast.sendMessage(CHANNEL, roll);
  if (roll.visible) await addHistory(roll);
  if (role === "GM") renderHidden();
}

function showRoll(roll) {
  const die = document.querySelector("#die");
  const result = document.querySelector("#result");
  if (!die || !result) return;
  die.classList.remove("rolling");
  void die.offsetWidth;
  die.classList.add("rolling");
  die.querySelector("span").textContent = roll.natural;
  result.textContent = `${roll.actor}：${roll.natural}${roll.bonus ? ` ${roll.bonus > 0 ? "+" : "−"} ${Math.abs(roll.bonus)} = ${roll.total}` : ""}`;
  result.classList.toggle("critical", roll.natural === 20);
  burst(roll.natural === 20 ? 18 : 8);
}

function burst(count) {
  const zone = document.querySelector(".dice-zone");
  if (!zone) return;
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement("b");
    particle.className = "particle";
    particle.style.setProperty("--x", `${(Math.random() - 0.5) * 260}px`);
    particle.style.setProperty("--y", `${-40 - Math.random() * 150}px`);
    zone.append(particle);
    particle.addEventListener("animationend", () => particle.remove());
  }
}

async function saveSettings(next) {
  settings = { ...settings, ...next };
  await OBR.room.setMetadata({ [SETTINGS]: settings });
}

function renderGm() {
  document.querySelector("#public").addEventListener("change", async (event) => {
    await saveSettings({ publicRolls: event.target.checked });
  });
  const unique = [...new Map(party.filter((p) => p.role === "PLAYER").map((p) => [p.id, p])).values()];
  const players = document.querySelector("#players");
  players.replaceChildren();
  if (!unique.length) players.innerHTML = `<p class="muted">当前没有其他玩家在线。</p>`;
  unique.forEach((player) => {
    const label = document.createElement("label");
    label.className = "player";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = settings.allowed.includes(player.id);
    box.addEventListener("change", () => {
      const allowed = box.checked
        ? [...new Set([...settings.allowed, player.id])]
        : settings.allowed.filter((id) => id !== player.id);
      saveSettings({ allowed });
    });
    const dot = document.createElement("i");
    dot.style.background = player.color;
    const text = document.createElement("span");
    text.textContent = player.name;
    label.append(box, dot, text);
    players.append(label);
  });
  renderHidden();
}

function renderHidden() {
  const target = document.querySelector("#hidden");
  if (!target) return;
  target.innerHTML = hiddenRolls.length ? `<h3>待公开的隐藏结果</h3>` : "";
  hiddenRolls.slice(0, 5).forEach((roll) => {
    const row = document.createElement("div");
    row.className = "hidden-roll";
    const text = document.createElement("span");
    text.textContent = `${roll.actor}：${roll.total}`;
    const button = document.createElement("button");
    button.textContent = "公开";
    button.addEventListener("click", async () => {
      roll.visible = true;
      hiddenRolls = hiddenRolls.filter((item) => item.id !== roll.id);
      localStorage.setItem(hiddenKey, JSON.stringify(hiddenRolls));
      await OBR.broadcast.sendMessage(CHANNEL, { ...roll, kind: "reveal" });
      await addHistory(roll);
      renderHidden();
    });
    row.append(text, button);
    target.append(row);
  });
}

async function addHistory(roll) {
  if (history.some((item) => item.id === roll.id)) return;
  history = [roll, ...history].slice(0, 10);
  await OBR.room.setMetadata({ [HISTORY]: history });
}

function renderHistory() {
  const target = document.querySelector("#history");
  if (!target) return;
  target.replaceChildren();
  if (!history.length) target.innerHTML = `<p class="muted">还没有公开结果。</p>`;
  history.slice(0, 6).forEach((roll) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const who = document.createElement("span");
    who.textContent = roll.actor;
    const score = document.createElement("strong");
    score.textContent = `${roll.total}`;
    const detail = document.createElement("small");
    detail.textContent = `d20 ${roll.natural}${roll.bonus ? ` ${roll.bonus > 0 ? "+" : "−"}${Math.abs(roll.bonus)}` : ""}`;
    row.append(who, detail, score);
    target.append(row);
  });
}

OBR.onReady(async () => {
  [role, name, party] = await Promise.all([
    OBR.player.getRole(),
    OBR.player.getName(),
    OBR.party.getPlayers(),
  ]);
  if (role === "GM") hiddenRolls = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
  const metadata = await OBR.room.getMetadata();
  settings = { ...defaults, ...(metadata[SETTINGS] || {}) };
  history = Array.isArray(metadata[HISTORY]) ? metadata[HISTORY] : [];
  render();

  OBR.room.onMetadataChange((next) => {
    const changedSettings = { ...defaults, ...(next[SETTINGS] || {}) };
    const changedHistory = Array.isArray(next[HISTORY]) ? next[HISTORY] : [];
    const mustRender = JSON.stringify(changedSettings) !== JSON.stringify(settings);
    settings = changedSettings;
    history = changedHistory;
    if (mustRender) render(); else renderHistory();
  });
  OBR.party.onChange((players) => {
    party = players;
    if (role === "GM") render();
  });
  OBR.broadcast.onMessage(CHANNEL, ({ data }) => {
    if (!data || data.actorId === OBR.player.id) return;
    if (data.kind === "reveal" || data.visible || role === "GM") showRoll(data);
    if (data.kind === "roll" && !data.visible && role === "GM") {
      if (!hiddenRolls.some((roll) => roll.id === data.id)) hiddenRolls.unshift(data);
      localStorage.setItem(hiddenKey, JSON.stringify(hiddenRolls.slice(0, 20)));
      renderHidden();
    }
  });
});
