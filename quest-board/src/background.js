import OBR from "@owlbear-rodeo/sdk";
import { CONTROL, POPOVER } from "./shared.js";

const positionKey = "quest-board-position";
const visibleKey = "quest-board-visible";
let position = JSON.parse(localStorage.getItem(positionKey) || "null") || { left: 14, top: 120 };
let visible = localStorage.getItem(visibleKey) !== "false";

async function open() {
  await OBR.popover.open({
    id: POPOVER,
    url: "/owlbear-gm-tools/quest-board/panel.html",
    width: 340,
    height: 650,
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
  localStorage.setItem(visibleKey, String(visible));
  if (visible) await open(); else await OBR.popover.close(POPOVER);
}

OBR.onReady(async () => {
  if (visible) await open();
  OBR.broadcast.onMessage(CONTROL, async ({ data }) => {
    if (!data) return;
    if (data.type === "toggle") await setVisible(!visible);
    if (data.type === "show") await setVisible(true);
    if (data.type === "hide") await setVisible(false);
    if (data.type === "reset") {
      position = { left: 14, top: 120 };
      localStorage.setItem(positionKey, JSON.stringify(position));
      if (visible) { await OBR.popover.close(POPOVER); await open(); }
    }
    if (data.type === "move") {
      position = {
        left: Math.max(8, position.left + Number(data.dx || 0)),
        top: Math.max(8, position.top + Number(data.dy || 0)),
      };
      localStorage.setItem(positionKey, JSON.stringify(position));
      await OBR.popover.close(POPOVER);
      await open();
    }
  });
});
