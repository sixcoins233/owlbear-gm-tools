import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, PLAYER } from "./shared.js";

const visibleKey = "bilibili-music-player-visible";
const positionKey = "bilibili-music-player-position";
let visible = localStorage.getItem(visibleKey) !== "false";
let position = JSON.parse(localStorage.getItem(positionKey) || "null") || { left: 18, top: 116 };

async function open() {
  await OBR.popover.open({
    id: PLAYER,
    url: "/owlbear-gm-tools/bilibili-music/player.html",
    width: 430,
    height: 338,
    anchorReference: "POSITION",
    anchorPosition: position,
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 8,
  });
}

async function setVisible(next) {
  visible = next;
  localStorage.setItem(visibleKey, String(next));
  if (next) await open(); else await OBR.popover.close(PLAYER);
}

OBR.onReady(async () => {
  if (visible) await open();
  OBR.broadcast.onMessage(CONTROL, async ({ data }) => {
    if (!data) return;
    if (data.type === "show") await setVisible(true);
    if (data.type === "hide") await setVisible(false);
    if (data.type === "toggle") await setVisible(!visible);
    if (data.type === "move") {
      position = {
        left: Math.max(8, position.left + Number(data.dx || 0)),
        top: Math.max(8, position.top + Number(data.dy || 0)),
      };
      localStorage.setItem(positionKey, JSON.stringify(position));
      if (visible) { await OBR.popover.close(PLAYER); await open(); }
    }
  });
});
