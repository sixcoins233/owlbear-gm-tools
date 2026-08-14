import OBR from "@owlbear-rodeo/sdk";
import { REQUEST, RESULT, RULES_KEY, diceTypes, themes } from "./shared.js";
import "./style.css";

const app = document.querySelector("#app");
const countsKey = "destiny-dice-counts";
const themeKey = "destiny-dice-theme";
let role = "PLAYER";
let selfConnection;
let party = [];
let counts = { ...Object.fromEntries(diceTypes.map((sides) => [sides, 0])), ...JSON.parse(localStorage.getItem(countsKey) || "{}") };
let theme = localStorage.getItem(themeKey) || "vortex";

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
counts = Object.fromEntries(diceTypes.map((sides) => [sides, clamp(counts[sides], 0, 50)]));

function totalDice() {
  return diceTypes.reduce((sum, sides) => sum + clamp(counts[sides], 0, 50), 0);
}

function formula() {
  return diceTypes.filter((sides) => counts[sides]).map((sides) => `${counts[sides]}d${sides}`).join(" + ") || "请选择骰子";
}

function render() {
  app.innerHTML = `
    <header><img src="./icon.svg" alt=""><div><h1>Destiny &amp; Dice</h1><p>让命运在桌面上显形</p></div><span>${role === "GM" ? "GM" : "PLAYER"}</span></header>
    <section class="pool"><div class="section-title"><h2>组合骰池</h2><button id="clear">清空</button></div><div class="dice-grid">${diceTypes.map(diceRow).join("")}</div><div class="formula"><span id="formula">${formula()}</span><b id="dice-total">${totalDice()} 枚</b></div></section>
    <section><h2>骰子外观</h2><div class="themes">${themes.map(themeCard).join("")}</div></section>
    ${role === "GM" ? gmSettings() : ""}
    <section class="roll-control"><button id="roll">投掷命运骰</button><p id="status">结果将由 GM 裁定，并同步显示给所有人。</p></section>
  `;
  bind();
}

function diceRow(sides) {
  return `<div class="dice-row"><i class="mini d${sides}">d${sides}</i><button data-sides="${sides}" data-delta="-1">−</button><input data-sides="${sides}" type="number" min="0" max="50" value="${clamp(counts[sides], 0, 50)}" aria-label="d${sides} 数量"><button data-sides="${sides}" data-delta="1">＋</button></div>`;
}

function themeCard([id, label, detail]) {
  return `<label class="theme ${id}"><input type="radio" name="theme" value="${id}" ${theme === id ? "checked" : ""}><i></i><span><b>${label}</b><small>${detail}</small></span></label>`;
}

function readRules() {
  const saved = JSON.parse(localStorage.getItem(RULES_KEY) || "{}");
  return Object.fromEntries(diceTypes.map((sides) => {
    const min = clamp(saved[sides]?.min || 1, 1, sides);
    return [sides, { min, max: Math.max(min, clamp(saved[sides]?.max || sides, 1, sides)) }];
  }));
}

function gmSettings() {
  const rules = readRules();
  return `<section class="gm"><div class="section-title"><div><h2>GM 隐秘裁定</h2><p>每种骰子的实际结果只会落在设定范围内</p></div><span>仅本机可见</span></div><div class="ranges">${diceTypes.map((sides) => `<label><b>d${sides}</b><input data-rule="min" data-sides="${sides}" type="number" min="1" max="${sides}" value="${rules[sides].min}"><em>—</em><input data-rule="max" data-sides="${sides}" type="number" min="1" max="${sides}" value="${rules[sides].max}"></label>`).join("")}</div></section>`;
}

function updatePool() {
  localStorage.setItem(countsKey, JSON.stringify(counts));
  document.querySelector("#formula").textContent = formula();
  document.querySelector("#dice-total").textContent = `${totalDice()} 枚`;
}

function saveRules() {
  const rules = {};
  diceTypes.forEach((sides) => {
    const minInput = document.querySelector(`[data-rule="min"][data-sides="${sides}"]`);
    const maxInput = document.querySelector(`[data-rule="max"][data-sides="${sides}"]`);
    const min = clamp(minInput.value, 1, sides);
    const max = Math.max(min, clamp(maxInput.value, 1, sides));
    minInput.value = min; maxInput.value = max;
    rules[sides] = { min, max };
  });
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

function bind() {
  document.querySelectorAll(".dice-row button").forEach((button) => button.addEventListener("click", () => {
    const sides = button.dataset.sides;
    counts[sides] = clamp(Number(counts[sides]) + Number(button.dataset.delta), 0, 50);
    document.querySelector(`.dice-row input[data-sides="${sides}"]`).value = counts[sides];
    updatePool();
  }));
  document.querySelectorAll(".dice-row input").forEach((input) => input.addEventListener("change", () => {
    counts[input.dataset.sides] = clamp(input.value, 0, 50);
    input.value = counts[input.dataset.sides];
    updatePool();
  }));
  document.querySelector("#clear").addEventListener("click", () => {
    counts = Object.fromEntries(diceTypes.map((sides) => [sides, 0]));
    render(); updatePool();
  });
  document.querySelectorAll('[name="theme"]').forEach((radio) => radio.addEventListener("change", () => {
    theme = radio.value; localStorage.setItem(themeKey, theme);
  }));
  document.querySelector("#roll").addEventListener("click", roll);
  if (role === "GM") document.querySelectorAll("[data-rule]").forEach((input) => input.addEventListener("change", saveRules));
}

async function roll() {
  const status = document.querySelector("#status");
  const pool = diceTypes.flatMap((sides) => Array(clamp(counts[sides], 0, 50)).fill(sides)).slice(0, 100);
  if (!pool.length) { status.textContent = "请至少选择一枚骰子。"; return; }
  if (totalDice() > 100) { status.textContent = "单次最多投掷 100 枚骰子。"; return; }
  if (role !== "GM" && !party.some((player) => player.role === "GM")) {
    status.textContent = "GM 当前不在线，无法进行隐藏范围裁定。"; return;
  }
  status.textContent = "命运正在回应…";
  await OBR.broadcast.sendMessage(REQUEST, { id: crypto.randomUUID(), kind: "request", dice: pool, theme }, { destination: "ALL" });
}

OBR.onReady(async () => {
  [role, selfConnection, party] = await Promise.all([
    OBR.player.getRole(), OBR.player.getConnectionId(), OBR.party.getPlayers(),
  ]);
  render();
  OBR.party.onChange((players) => { party = players; });
  OBR.broadcast.onMessage(RESULT, ({ data, connectionId }) => {
    const senderIsGm = connectionId === selfConnection ? role === "GM" : party.some((player) => player.connectionId === connectionId && player.role === "GM");
    if (!senderIsGm || data?.kind !== "result") return;
    const status = document.querySelector("#status");
    if (status) status.textContent = `${data.actor} 投出了 ${data.total}（${data.dice.length} 枚）`;
  });
});
