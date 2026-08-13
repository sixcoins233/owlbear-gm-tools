import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, META, emptyBoard, groups } from "./shared.js";
import "./style.css";

const app = document.querySelector("#app");
const collapsedKey = "quest-board-collapsed";
let role = "PLAYER";
let board = emptyBoard();
let showCompleted = localStorage.getItem("quest-board-show-completed") !== "false";
let collapsed = JSON.parse(localStorage.getItem(collapsedKey) || "{}");
let dragStart;

const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function save() {
  board.updatedAt = Date.now();
  await OBR.room.setMetadata({ [META]: board });
}

function render() {
  app.innerHTML = `
    <header id="drag"><img src="./icon.svg" alt=""><div><h1>冒险任务</h1><p>${role === "GM" ? "拖动此处移动 · GM 编辑模式" : "拖动此处移动"}</p></div><button id="hide" title="隐藏任务栏">×</button></header>
    <div class="filters"><label><input id="completed-filter" type="checkbox" ${showCompleted ? "checked" : ""}> 显示已完成任务</label></div>
    <div class="quest-list">${groups.map(([key, title, symbol]) => groupHtml(key, title, symbol)).join("")}</div>
    <footer>${role === "GM" ? "修改会实时同步给房间内所有玩家" : "任务内容由 GM 管理"}</footer>
  `;
  bind();
}

function groupHtml(key, title, symbol) {
  const tasks = board.groups[key] || [];
  const visible = showCompleted ? tasks : tasks.filter((task) => !task.completed);
  return `<section class="quest-group ${collapsed[key] ? "collapsed" : ""}" data-group="${key}">
    <div class="group-title"><button class="collapse" title="展开或收起">▾</button><span>${symbol}</span><h2>${title}</h2><b>${visible.length}</b>${role === "GM" ? `<button class="add" title="添加任务">＋</button>` : ""}</div>
    <div class="tasks">${visible.length ? visible.map(taskHtml).join("") : `<p class="empty">暂无${showCompleted ? "" : "未完成"}任务</p>`}</div>
  </section>`;
}

function taskHtml(task) {
  return `<article class="task ${task.completed ? "done" : ""}" data-id="${escapeHtml(task.id)}">
    <input class="check" type="checkbox" ${task.completed ? "checked" : ""} ${role === "GM" ? "" : "disabled"} aria-label="任务完成状态">
    ${role === "GM" ? `<textarea rows="2" maxlength="500" aria-label="任务描述">${escapeHtml(task.description)}</textarea><button class="delete" title="删除任务">×</button>` : `<p>${escapeHtml(task.description)}</p>`}
  </article>`;
}

function findTask(element) {
  const article = element.closest(".task");
  const key = element.closest(".quest-group").dataset.group;
  return [key, board.groups[key].find((task) => task.id === article.dataset.id)];
}

function bind() {
  document.querySelector("#completed-filter").addEventListener("change", (event) => {
    showCompleted = event.target.checked;
    localStorage.setItem("quest-board-show-completed", String(showCompleted));
    render();
  });
  document.querySelector("#hide").addEventListener("click", () =>
    OBR.broadcast.sendMessage(CONTROL, { type: "hide" }, { destination: "LOCAL" }),
  );
  document.querySelectorAll(".collapse").forEach((button) => button.addEventListener("click", () => {
    const key = button.closest(".quest-group").dataset.group;
    collapsed[key] = !collapsed[key];
    localStorage.setItem(collapsedKey, JSON.stringify(collapsed));
    render();
  }));
  if (role === "GM") bindGm();
  bindDrag();
}

function bindGm() {
  document.querySelectorAll(".add").forEach((button) => button.addEventListener("click", async () => {
    const key = button.closest(".quest-group").dataset.group;
    const task = { id: id(), description: "新任务", completed: false };
    board.groups[key].push(task);
    collapsed[key] = false;
    await save();
    render();
    const textarea = document.querySelector(`[data-id="${CSS.escape(task.id)}"] textarea`);
    textarea.focus(); textarea.select();
  }));
  document.querySelectorAll(".check").forEach((box) => box.addEventListener("change", async () => {
    const [, task] = findTask(box);
    task.completed = box.checked;
    await save();
    render();
  }));
  document.querySelectorAll("textarea").forEach((textarea) => textarea.addEventListener("change", async () => {
    const [, task] = findTask(textarea);
    task.description = textarea.value.trim() || "未命名任务";
    await save();
  }));
  document.querySelectorAll(".delete").forEach((button) => button.addEventListener("click", async () => {
    const [key, task] = findTask(button);
    board.groups[key] = board.groups[key].filter((item) => item.id !== task.id);
    await save();
    render();
  }));
}

function bindDrag() {
  const header = document.querySelector("#drag");
  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    dragStart = { x: event.screenX, y: event.screenY };
    header.setPointerCapture(event.pointerId);
    header.classList.add("dragging");
  });
  header.addEventListener("pointerup", async (event) => {
    if (!dragStart) return;
    const movement = { type: "move", dx: event.screenX - dragStart.x, dy: event.screenY - dragStart.y };
    dragStart = null;
    header.classList.remove("dragging");
    if (Math.abs(movement.dx) + Math.abs(movement.dy) > 3) {
      await OBR.broadcast.sendMessage(CONTROL, movement, { destination: "LOCAL" });
    }
  });
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  const metadata = await OBR.room.getMetadata();
  const stored = metadata[META];
  if (stored?.groups) board = stored;
  render();
  OBR.room.onMetadataChange((next) => {
    if (next[META]?.groups && next[META].updatedAt !== board.updatedAt) {
      board = next[META];
      render();
    }
  });
});
