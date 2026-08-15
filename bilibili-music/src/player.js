import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, META, currentPosition, embedUrl, emptyState, escapeHtml, normalizeState } from "./shared.js";
import "./style.css";

const app = document.querySelector("#player-app");
const volumeKey = "bilibili-music-volume";
let state = emptyState();
const storedVolume = localStorage.getItem(volumeKey);
const savedVolume = storedVolume === null ? 70 : Number(storedVolume);
let volume = Number.isFinite(savedVolume) ? Math.min(100, Math.max(0, savedVolume)) : 70;
let mediaKey = "";
let dragStart;

const currentTrack = () => state.playlist.find((track) => track.id === state.playback.trackId) || null;

function sendVolume() {
  const frame = document.querySelector("#bili-frame");
  if (!frame?.contentWindow) return;
  const command = { type: "changeVolume", value: { volume: volume / 100 } };
  frame.contentWindow.postMessage(`setPlayer-${JSON.stringify(command)}`, "https://player.bilibili.com");
}

function mountMedia(force = false) {
  const track = currentTrack();
  const nextKey = track && state.playback.status === "PLAYING"
    ? `${track.id}:${state.playback.startedAt}:${Math.floor(state.playback.position)}:${volume === 0}`
    : state.playback.status;
  if (!force && nextKey === mediaKey) return;
  mediaKey = nextKey;
  const host = document.querySelector("#media");
  if (!track || state.playback.status !== "PLAYING") { host.replaceChildren(); return; }
  host.innerHTML = `<iframe id="bili-frame" title="Bilibili 音频播放器" src="${embedUrl(track, currentPosition(state.playback), volume === 0)}" allow="autoplay" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  document.querySelector("#bili-frame").addEventListener("load", () => setTimeout(sendVolume, 400));
}

function statusText() {
  return state.playback.status === "PLAYING" ? "正在播放" : state.playback.status === "PAUSED" ? "已暂停" : "等待播放";
}

function render() {
  app.innerHTML = `
    <header id="drag"><img src="./icon.svg" alt=""><div><b>${escapeHtml(currentTrack()?.title || "Bilibili Music")}</b><small>${statusText()}</small></div><button id="activate" title="重新启用声音">🔊</button><button id="hide" title="隐藏">×</button></header>
    <div class="local-volume"><span>🔈</span><input id="volume" type="range" min="0" max="100" value="${volume}" aria-label="本地音量"><output>${volume}%</output></div>
    <p class="player-hint">若没有声音，请点击右上角 🔊</p>
    <div id="media" aria-hidden="true"></div>`;
  bind();
  mountMedia(true);
}

function bind() {
  document.querySelector("#activate").addEventListener("click", () => mountMedia(true));
  document.querySelector("#hide").addEventListener("click", () => OBR.broadcast.sendMessage(CONTROL, { type: "hide" }, { destination: "LOCAL" }));
  document.querySelector("#volume").addEventListener("input", (event) => {
    const wasMuted = volume === 0;
    volume = Number(event.target.value);
    localStorage.setItem(volumeKey, String(volume));
    document.querySelector(".local-volume output").textContent = `${volume}%`;
    if (wasMuted !== (volume === 0)) mountMedia(true); else sendVolume();
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
    if (Math.abs(dx) + Math.abs(dy) > 4) OBR.broadcast.sendMessage(CONTROL, { type: "move", dx, dy }, { destination: "LOCAL" });
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
    mountMedia();
  });
});
