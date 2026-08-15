import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, META, PLAYER, currentPosition, embedUrl, emptyState, escapeHtml, normalizeState } from "./shared.js";
import "./style.css";

const app = document.querySelector("#player-app");
const volumeKey = "bilibili-music-volume";
const collapsedKey = "bilibili-music-collapsed";
let state = emptyState();
const storedVolume = localStorage.getItem(volumeKey);
let volume = Math.min(100, Math.max(0, storedVolume === null ? 70 : Number(storedVolume)));
let collapsed = localStorage.getItem(collapsedKey) === "true";
let mediaKey = "";
let dragStart;

function currentTrack() {
  return state.playlist.find((track) => track.id === state.playback.trackId) || null;
}

function sendVolume() {
  const frame = document.querySelector("#bili-frame");
  if (!frame?.contentWindow) return;
  const value = { type: "changeVolume", value: { volume: volume / 100 } };
  frame.contentWindow.postMessage(`setPlayer-${JSON.stringify(value)}`, "https://player.bilibili.com");
}

function mountMedia(force = false) {
  const track = currentTrack();
  const nextKey = track && state.playback.status === "PLAYING"
    ? `${track.id}:${state.playback.startedAt}:${Math.floor(state.playback.position)}` : state.playback.status;
  if (!force && nextKey === mediaKey) return;
  mediaKey = nextKey;
  const host = document.querySelector("#media");
  if (!track) { host.innerHTML = '<div class="player-empty"><b>等待歌单</b><span>请由 GM 添加并播放音乐</span></div>'; return; }
  if (state.playback.status !== "PLAYING") {
    host.innerHTML = `<div class="player-empty"><b>${state.playback.status === "PAUSED" ? "GM 已暂停" : "播放已停止"}</b><span>${escapeHtml(track.title)}</span></div>`;
    return;
  }
  host.innerHTML = `<iframe id="bili-frame" title="Bilibili 播放器" src="${embedUrl(track, currentPosition(state.playback), volume === 0)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  document.querySelector("#bili-frame").addEventListener("load", () => setTimeout(sendVolume, 400));
}

function render() {
  const track = currentTrack();
  app.className = collapsed ? "collapsed" : "";
  app.innerHTML = `
    <header id="drag"><img src="./icon.svg" alt=""><div><b>${escapeHtml(track?.title || "Bilibili Music")}</b><small>${state.playback.status === "PLAYING" ? "正在播放" : state.playback.status === "PAUSED" ? "已暂停" : "等待播放"}</small></div><button id="collapse" title="${collapsed ? "展开" : "收起"}">${collapsed ? "▢" : "—"}</button><button id="hide" title="隐藏">×</button></header>
    <div id="media"></div>
    <div class="local-volume"><span>🔈</span><input id="volume" type="range" min="0" max="100" value="${volume}" aria-label="本地音量"><output>${volume}%</output></div>
    <p class="player-hint">首次播放若静音，请展开并点击播放器；滑条无效时请用播放器右下角音量。</p>
  `;
  bind();
  mountMedia(true);
}

async function setCollapsed(next) {
  collapsed = next;
  localStorage.setItem(collapsedKey, String(next));
  app.classList.toggle("collapsed", next);
  document.querySelector("#collapse").textContent = next ? "▢" : "—";
  document.querySelector("#collapse").title = next ? "展开" : "收起";
  await OBR.popover.setHeight(PLAYER, next ? 104 : 338);
}

function bind() {
  document.querySelector("#collapse").addEventListener("click", () => setCollapsed(!collapsed));
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
  if (collapsed) await OBR.popover.setHeight(PLAYER, 104);
  OBR.room.onMetadataChange((metadata) => {
    const next = normalizeState(metadata[META]);
    if (next.updatedAt === state.updatedAt) return;
    const titleChanged = next.playlist.find((track) => track.id === next.playback.trackId)?.title !== currentTrack()?.title;
    state = next;
    if (titleChanged) render(); else {
      const track = currentTrack();
      const title = document.querySelector("header b");
      if (title) title.textContent = track?.title || "Bilibili Music";
      const status = document.querySelector("header small");
      if (status) status.textContent = state.playback.status === "PLAYING" ? "正在播放" : state.playback.status === "PAUSED" ? "已暂停" : "等待播放";
      mountMedia();
    }
  });
});
