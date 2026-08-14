import OBR from "@owlbear-rodeo/sdk";
import { REQUEST, RESULT, RESULT_KEY, ROLL_POPOVER, RULES_KEY, diceTypes, themes } from "./shared.js";

let role = "PLAYER";
let self;
let party = [];
let closeTimer;
const handled = new Set();
const themeIds = themes.map(([id]) => id);

function actor(connectionId) {
  if (connectionId === self.connectionId) return self;
  return party.find((player) => player.connectionId === connectionId);
}

function random(min, max) {
  const span = max - min + 1;
  const ceiling = Math.floor(0x100000000 / span) * span;
  const data = new Uint32Array(1);
  do crypto.getRandomValues(data); while (data[0] >= ceiling);
  return min + (data[0] % span);
}

function ranges() {
  const saved = JSON.parse(localStorage.getItem(RULES_KEY) || "{}");
  return Object.fromEntries(diceTypes.map((sides) => {
    const min = Math.max(1, Math.min(sides, Number(saved[sides]?.min) || 1));
    const max = Math.max(min, Math.min(sides, Number(saved[sides]?.max) || sides));
    return [sides, { min, max }];
  }));
}

async function resolveRequest(event) {
  const request = event.data;
  const roller = actor(event.connectionId);
  const authority = [self, ...party].filter((player) => player.role === "GM").map((player) => player.connectionId).sort()[0];
  if (role !== "GM" || self.connectionId !== authority || !roller || request?.kind !== "request" || handled.has(request?.id)) return;
  const pool = Array.isArray(request?.dice)
    ? request.dice.map(Number).filter((sides) => diceTypes.includes(sides)).slice(0, 100)
    : [];
  if (!request?.id || !pool.length) return;
  handled.add(request.id);
  if (handled.size > 200) handled.clear();
  const rules = ranges();
  const dice = pool.map((sides) => ({ sides, value: random(rules[sides].min, rules[sides].max) }));
  await OBR.broadcast.sendMessage(RESULT, {
    kind: "result",
    requestId: request.id,
    actor: roller.name,
    actorId: roller.id,
    theme: themeIds.includes(request.theme) ? request.theme : "vortex",
    dice,
    total: dice.reduce((sum, die) => sum + die.value, 0),
    time: Date.now(),
  }, { destination: "ALL" });
}

async function showResult(event) {
  const sender = actor(event.connectionId);
  if (!sender || sender.role !== "GM" || event.data?.kind !== "result") return;
  localStorage.setItem(RESULT_KEY, JSON.stringify(event.data));
  const [viewWidth, viewHeight] = await Promise.all([
    OBR.viewport.getWidth(), OBR.viewport.getHeight(),
  ]).catch(() => [Math.min(screen.availWidth, 1200), Math.min(screen.availHeight, 800)]);
  const width = Math.min(760, Math.max(320, viewWidth - 80));
  const height = Math.min(500, Math.max(300, viewHeight - 180));
  clearTimeout(closeTimer);
  await OBR.popover.close(ROLL_POPOVER).catch(() => {});
  await OBR.popover.open({
    id: ROLL_POPOVER,
    url: "/owlbear-gm-tools/destiny-dice/roll.html",
    width,
    height,
    anchorReference: "POSITION",
    anchorPosition: {
      left: Math.max(12, (viewWidth - width) / 2),
      top: Math.max(70, (viewHeight - height) / 2),
    },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: false,
    marginThreshold: 12,
  });
  closeTimer = setTimeout(() => OBR.popover.close(ROLL_POPOVER), 5600);
}

OBR.onReady(async () => {
  const [name, color, connectionId, currentRole, players] = await Promise.all([
    OBR.player.getName(), OBR.player.getColor(), OBR.player.getConnectionId(), OBR.player.getRole(), OBR.party.getPlayers(),
  ]);
  role = currentRole;
  self = { id: OBR.player.id, name, color, connectionId, role };
  party = players;
  OBR.party.onChange((playersNext) => { party = playersNext; });
  OBR.broadcast.onMessage(REQUEST, resolveRequest);
  OBR.broadcast.onMessage(RESULT, showResult);
});
