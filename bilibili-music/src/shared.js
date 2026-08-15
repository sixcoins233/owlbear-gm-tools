export const ID = "tools.horn.bilibili-music";
export const META = `${ID}/state`;
export const CONTROL = `${ID}/control`;
export const PLAYER = `${ID}/player-v2`;
export const LEGACY_PLAYER = `${ID}/player`;
export const MAX_TRACKS = 25;

export const emptyState = () => ({
  version: 1,
  playlist: [],
  playback: { trackId: null, status: "STOPPED", position: 0, startedAt: 0 },
  updatedAt: Date.now(),
});

export function normalizeState(value) {
  const base = emptyState();
  if (!value || !Array.isArray(value.playlist)) return base;
  return {
    ...base,
    ...value,
    playlist: value.playlist.slice(0, MAX_TRACKS),
    playback: { ...base.playback, ...(value.playback || {}) },
  };
}

export function parseTrack(raw, title = "") {
  const text = String(raw || "").trim();
  const match = text.match(/BV[0-9A-Za-z]{10}/i);
  if (!match) throw new Error("请粘贴包含 BV 号的完整视频链接，或直接输入 BV 号。");
  const bvid = `BV${match[0].slice(2)}`;
  let page = 1;
  try {
    const url = new URL(text);
    page = Math.max(1, Number.parseInt(url.searchParams.get("p") || "1", 10) || 1);
  } catch { /* 直接输入 BV 号 */ }
  return {
    id: crypto.randomUUID(),
    bvid,
    page,
    title: String(title || "").trim().slice(0, 100) || `${bvid}${page > 1 ? ` · P${page}` : ""}`,
    url: `https://www.bilibili.com/video/${bvid}${page > 1 ? `?p=${page}` : ""}`,
  };
}

export function currentPosition(playback, now = Date.now()) {
  const base = Math.max(0, Number(playback?.position) || 0);
  if (playback?.status !== "PLAYING") return base;
  return base + Math.max(0, now - (Number(playback.startedAt) || now)) / 1000;
}

export function embedUrl(track, position = 0, muted = false, loop = true) {
  const query = new URLSearchParams({
    bvid: track.bvid,
    p: String(track.page || 1),
    autoplay: "1",
    muted: muted ? "1" : "0",
    danmaku: "0",
    loop: loop ? "1" : "0",
    t: String(Math.floor(Math.max(0, position))),
  });
  return `https://player.bilibili.com/player.html?${query}`;
}

export const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
