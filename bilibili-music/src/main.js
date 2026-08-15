import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, MAX_TRACKS, META, currentPosition, emptyState, escapeHtml, normalizeState, parseTrack } from "./shared.js";
import "./style.css";

const app = document.querySelector("#app");
const favoritesKey = "bilibili-music-favorites";
let role = "PLAYER";
let state = emptyState();
let message = "";

function readFavorites() {
  try { return JSON.parse(localStorage.getItem(favoritesKey) || "[]"); }
  catch { return []; }
}

function writeFavorites(items) {
  localStorage.setItem(favoritesKey, JSON.stringify(items.slice(0, 100)));
}

function currentTrack() {
  return state.playlist.find((track) => track.id === state.playback.trackId) || null;
}

async function save(next = state) {
  state = normalizeState({ ...next, updatedAt: Date.now() });
  await OBR.room.setMetadata({ [META]: state });
}

function statusLabel() {
  if (!currentTrack()) return "尚未选择音乐";
  return state.playback.status === "PLAYING" ? "正在播放" : state.playback.status === "PAUSED" ? "已暂停" : "已停止";
}

function render() {
  const track = currentTrack();
  const favorites = readFavorites();
  app.innerHTML = `
    <header class="manager-header"><img src="./icon.svg" alt=""><div><h1>Bilibili Music</h1><p>${role === "GM" ? "GM 播放控制" : "房间共享歌单"}</p></div><span>${role}</span></header>
    <section class="now"><small>${statusLabel()}</small><h2>${escapeHtml(track?.title || "等待 GM 播放")}</h2><p>${track ? escapeHtml(`${track.bvid}${track.page > 1 ? ` · P${track.page}` : ""}`) : "播放器小窗会在桌面左侧显示"}</p>
      <button id="show-player" class="secondary">显示播放器小窗</button>
    </section>
    ${role === "GM" ? gmControls(track) : ""}
    <section><div class="section-title"><h2>房间歌单</h2><b>${state.playlist.length}/${MAX_TRACKS}</b></div>
      <div class="track-list">${state.playlist.length ? state.playlist.map((item, index) => trackRow(item, index, favorites)).join("") : '<p class="empty">歌单还是空的</p>'}</div>
    </section>
    ${role === "GM" ? favoriteSection(favorites) : ""}
    <p class="notice ${message ? "active" : ""}">${escapeHtml(message || (role === "GM" ? "歌单和播放状态会同步给房间内所有人。" : "音量仅影响你自己的播放器。"))}</p>
  `;
  bind();
}

function gmControls(track) {
  const playing = state.playback.status === "PLAYING";
  return `
    <section class="transport">
      <div class="transport-buttons"><button data-control="previous" title="上一首">⏮</button><button data-control="toggle" class="primary" ${track ? "" : "disabled"}>${playing ? "暂停" : "继续"}</button><button data-control="next" title="下一首">⏭</button><button data-control="stop" title="停止">■</button></div>
      <form id="add-track"><label>视频链接或 BV 号<input id="track-url" required maxlength="300" placeholder="https://www.bilibili.com/video/BV..." /></label><label>显示名称（可选）<input id="track-title" maxlength="100" placeholder="例如：酒馆背景音乐" /></label><button class="primary" ${state.playlist.length >= MAX_TRACKS ? "disabled" : ""}>加入歌单</button></form>
    </section>`;
}

function trackRow(track, index, favorites) {
  const active = track.id === state.playback.trackId;
  const favorite = favorites.some((item) => item.bvid === track.bvid && item.page === track.page);
  const cover = role === "GM" ? `<button class="cover" data-action="play" title="播放">${active && state.playback.status === "PLAYING" ? "♫" : "▶"}</button>` : `<span class="cover">${active && state.playback.status === "PLAYING" ? "♫" : "♪"}</span>`;
  return `<article class="track ${active ? "active" : ""}" data-id="${escapeHtml(track.id)}">${cover}<div><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.bvid)}${track.page > 1 ? ` · P${track.page}` : ""}</small></div>${role === "GM" ? `<div class="row-actions"><button data-action="favorite" title="收藏">${favorite ? "★" : "☆"}</button><button data-action="up" ${index === 0 ? "disabled" : ""} title="上移">↑</button><button data-action="down" ${index === state.playlist.length - 1 ? "disabled" : ""} title="下移">↓</button><button data-action="remove" title="移除">×</button></div>` : ""}</article>`;
}

function favoriteSection(favorites) {
  return `<section><div class="section-title"><h2>我的收藏</h2><b>仅此浏览器</b></div><div class="favorite-list">${favorites.length ? favorites.map((track, index) => `<article class="favorite"><div><b>${escapeHtml(track.title)}</b><small>${escapeHtml(track.bvid)}${track.page > 1 ? ` · P${track.page}` : ""}</small></div><button data-favorite-add="${index}" title="加入歌单">＋</button><button data-favorite-remove="${index}" title="删除收藏">×</button></article>`).join("") : '<p class="empty">点击歌单中的 ☆ 收藏音乐</p>'}</div></section>`;
}

function playbackFor(trackId, status = "PLAYING", position = 0) {
  return { trackId, status, position, startedAt: status === "PLAYING" ? Date.now() : 0 };
}

async function selectRelative(delta) {
  if (!state.playlist.length) return;
  const index = state.playlist.findIndex((track) => track.id === state.playback.trackId);
  const next = index < 0 ? (delta > 0 ? 0 : state.playlist.length - 1) : (index + delta + state.playlist.length) % state.playlist.length;
  state.playback = playbackFor(state.playlist[next].id);
  await save();
}

async function togglePlayback() {
  if (!currentTrack()) return;
  if (state.playback.status === "PLAYING") {
    state.playback = playbackFor(state.playback.trackId, "PAUSED", currentPosition(state.playback));
  } else {
    state.playback = playbackFor(state.playback.trackId, "PLAYING", state.playback.position);
  }
  await save();
}

function bind() {
  document.querySelector("#show-player").addEventListener("click", () => OBR.broadcast.sendMessage(CONTROL, { type: "show" }, { destination: "LOCAL" }));
  if (role !== "GM") return;
  document.querySelector("#add-track").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (state.playlist.length >= MAX_TRACKS) throw new Error(`歌单最多保存 ${MAX_TRACKS} 首。`);
      const track = parseTrack(document.querySelector("#track-url").value, document.querySelector("#track-title").value);
      state.playlist.push(track);
      await save();
      message = "已加入歌单。";
      render();
    } catch (error) { message = error.message; render(); }
  });
  document.querySelectorAll("[data-control]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.control;
    if (action === "toggle") await togglePlayback();
    if (action === "previous") await selectRelative(-1);
    if (action === "next") await selectRelative(1);
    if (action === "stop") { state.playback = playbackFor(state.playback.trackId, "STOPPED", 0); await save(); }
  }));
  document.querySelectorAll(".track [data-action]").forEach((button) => button.addEventListener("click", async () => {
    const row = button.closest(".track");
    const index = state.playlist.findIndex((track) => track.id === row.dataset.id);
    const track = state.playlist[index];
    if (!track) return;
    const action = button.dataset.action;
    if (action === "play") state.playback = playbackFor(track.id);
    if (action === "remove") {
      state.playlist.splice(index, 1);
      if (state.playback.trackId === track.id) state.playback = playbackFor(null, "STOPPED");
    }
    if (action === "up" && index > 0) [state.playlist[index - 1], state.playlist[index]] = [track, state.playlist[index - 1]];
    if (action === "down" && index < state.playlist.length - 1) [state.playlist[index + 1], state.playlist[index]] = [track, state.playlist[index + 1]];
    if (action === "favorite") {
      const favorites = readFavorites();
      const saved = favorites.findIndex((item) => item.bvid === track.bvid && item.page === track.page);
      if (saved >= 0) favorites.splice(saved, 1); else favorites.unshift({ bvid: track.bvid, page: track.page, title: track.title, url: track.url });
      writeFavorites(favorites);
    } else await save();
    render();
  }));
  document.querySelectorAll("[data-favorite-add]").forEach((button) => button.addEventListener("click", async () => {
    if (state.playlist.length >= MAX_TRACKS) { message = `歌单最多保存 ${MAX_TRACKS} 首。`; render(); return; }
    const source = readFavorites()[Number(button.dataset.favoriteAdd)];
    if (!source) return;
    state.playlist.push({ ...source, id: crypto.randomUUID() });
    await save(); render();
  }));
  document.querySelectorAll("[data-favorite-remove]").forEach((button) => button.addEventListener("click", () => {
    const favorites = readFavorites();
    favorites.splice(Number(button.dataset.favoriteRemove), 1);
    writeFavorites(favorites); render();
  }));
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  state = normalizeState((await OBR.room.getMetadata())[META]);
  render();
  OBR.room.onMetadataChange((metadata) => {
    const next = normalizeState(metadata[META]);
    if (next.updatedAt !== state.updatedAt) { state = next; render(); }
  });
});
