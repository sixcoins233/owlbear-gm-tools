import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, LEGACY_PLAYER, META, PLAYER, currentPosition, embedUrl, emptyState, normalizeState } from "./shared.js";

const visibleKey = "bilibili-music-player-visible";
const positionKey = "bilibili-music-player-position";
const volumeKey = "bilibili-music-volume";
let visible = localStorage.getItem(visibleKey) !== "false";
let position = JSON.parse(localStorage.getItem(positionKey) || "null") || { left: 18, top: 116 };
let state = emptyState();
let mediaKey = "";
let loopTimer;
const storedVolume = localStorage.getItem(volumeKey);
let volume = storedVolume === null ? 70 : Math.min(100, Math.max(0, Number(storedVolume) || 0));

const currentTrack = () => state.playlist.find((track) => track.id === state.playback.trackId) || null;

function sendVolume() {
  const frame = document.querySelector("#bili-audio");
  if (!frame?.contentWindow) return;
  const command = { type: "changeVolume", value: { volume: volume / 100 } };
  frame.contentWindow.postMessage(`setPlayer-${JSON.stringify(command)}`, "https://player.bilibili.com");
}

function mountAudio(force = false, restart = false) {
  const track = currentTrack();
  const nextKey = track && state.playback.status === "PLAYING"
    ? `${track.id}:${state.playback.startedAt}:${Math.floor(state.playback.position)}:${volume === 0}:${Number(track.duration) || 0}`
    : state.playback.status;
  if (!force && nextKey === mediaKey) return;
  clearTimeout(loopTimer);
  mediaKey = nextKey;
  document.body.replaceChildren();
  if (!track || state.playback.status !== "PLAYING") return;
  const elapsed = restart ? 0 : currentPosition(state.playback);
  const duration = Math.max(0, Number(track.duration) || 0);
  const start = duration ? elapsed % duration : elapsed;
  const frame = document.createElement("iframe");
  frame.id = "bili-audio";
  frame.src = embedUrl(track, start, volume === 0, !duration);
  frame.allow = "autoplay";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:320px;height:180px;border:0;opacity:.01";
  frame.addEventListener("load", () => setTimeout(sendVolume, 400));
  document.body.append(frame);
  if (duration) loopTimer = setTimeout(() => mountAudio(true, true), Math.max(1000, (duration - start + 2) * 1000));
}

async function openController() {
  await OBR.popover.open({
    id: PLAYER,
    url: "/owlbear-gm-tools/bilibili-music/player.html",
    width: 320,
    height: 96,
    anchorReference: "POSITION",
    anchorPosition: position,
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 8,
  });
  await Promise.all([OBR.popover.setWidth(PLAYER, 320), OBR.popover.setHeight(PLAYER, 96)]);
}

async function setVisible(next) {
  visible = next;
  localStorage.setItem(visibleKey, String(next));
  if (next) await openController(); else await OBR.popover.close(PLAYER);
}

OBR.onReady(async () => {
  await OBR.popover.close(LEGACY_PLAYER).catch(() => {});
  state = normalizeState((await OBR.room.getMetadata())[META]);
  mountAudio(true);
  if (visible) await openController();
  OBR.room.onMetadataChange((metadata) => {
    const next = normalizeState(metadata[META]);
    if (next.updatedAt === state.updatedAt) return;
    state = next; mountAudio();
  });
  OBR.broadcast.onMessage(CONTROL, async ({ data }) => {
    if (!data) return;
    if (data.type === "show") await setVisible(true);
    if (data.type === "hide") await setVisible(false);
    if (data.type === "toggle") await setVisible(!visible);
    if (data.type === "activate") mountAudio(true);
    if (data.type === "volume") {
      const wasMuted = volume === 0;
      volume = Math.min(100, Math.max(0, Number(data.value) || 0));
      localStorage.setItem(volumeKey, String(volume));
      if (wasMuted !== (volume === 0)) mountAudio(true); else sendVolume();
    }
    if (data.type === "move") {
      position = { left: Math.max(8, position.left + Number(data.dx || 0)), top: Math.max(8, position.top + Number(data.dy || 0)) };
      localStorage.setItem(positionKey, JSON.stringify(position));
      if (visible) { await OBR.popover.close(PLAYER); await openController(); }
    }
  });
});
