import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, META, emptyState, escapeHtml, normalizeState } from "./shared.js";
import "./style.css";

const app = document.querySelector("#player-app");
const volumeKey = "bilibili-music-volume";
let state = emptyState();
const storedVolume = localStorage.getItem(volumeKey);
let volume = storedVolume === null ? 70 : Math.min(100, Math.max(0, Number(storedVolume) || 0));
let dragStart;

const currentTrack = () => state.playlist.find((track) => track.id === state.playback.trackId) || null;
const statusText = () => state.playback.status === "PLAYING" ? "正在播放 · 自动循环" : state.playback.status === "PAUSED" ? "已暂停" : "等待播放";
const send = (data) => OBR.broadcast.sendMessage(CONTROL, data, { destination: "LOCAL" });

function render() {
  app.innerHTML = `
    <header id="drag"><img src="./icon.svg" alt=""><div><b>${escapeHtml(currentTrack()?.title || "Bilibili Music")}</b><small>${statusText()}</small></div><button id="activate" title="重新启用声音">🔊</button><button id="hide" title="隐藏控制器">×</button></header>
    <div class="local-volume"><span>🔈</span><input id="volume" type="range" min="0" max="100" value="${volume}" aria-label="本地音量"><output>${volume}%</output></div>`;
  bind();
}

function bind() {
  document.querySelector("#activate").addEventListener("click", () => send({ type: "activate" }));
  document.querySelector("#hide").addEventListener("click", () => send({ type: "hide" }));
  document.querySelector("#volume").addEventListener("input", (event) => {
    volume = Number(event.target.value);
    localStorage.setItem(volumeKey, String(volume));
    document.querySelector("output").textContent = `${volume}%`;
    send({ type: "volume", value: volume });
  });
  const drag = document.querySelector("#drag");
  drag.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    dragStart = { x: event.screenX, y: event.screenY };
    drag.setPointerCapture(event.pointerId);
  });
  drag.addEventListener("pointerup", (event) => {
    if (!dragStart) return;
    const dx = event.screenX - dragStart.x;
    const dy = event.screenY - dragStart.y;
    dragStart = null;
    if (Math.abs(dx) + Math.abs(dy) > 4) send({ type: "move", dx, dy });
  });
}

OBR.onReady(async () => {
  state = normalizeState((await OBR.room.getMetadata())[META]);
  render();
  OBR.room.onMetadataChange((metadata) => {
    const next = normalizeState(metadata[META]);
    if (next.updatedAt === state.updatedAt) return;
    state = next;
    document.querySelector("header b").textContent = currentTrack()?.title || "Bilibili Music";
    document.querySelector("header small").textContent = statusText();
  });
});
