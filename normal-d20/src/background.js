import OBR from "@owlbear-rodeo/sdk";

const CHANNEL = "tools.horn.normal-d20/roll";
const hiddenKey = "normal-d20-hidden-rolls";

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  OBR.broadcast.onMessage(CHANNEL, ({ data }) => {
    if (!data) return;
    if (data.visible && (data.kind === "roll" || data.kind === "reveal")) {
      OBR.notification.show(`${data.actor} 投掷：${data.total}`);
    }
    if (role === "GM" && data.kind === "roll" && !data.visible) {
      const rolls = JSON.parse(localStorage.getItem(hiddenKey) || "[]");
      if (!rolls.some((roll) => roll.id === data.id)) {
        localStorage.setItem(hiddenKey, JSON.stringify([data, ...rolls].slice(0, 20)));
      }
      OBR.notification.show(`${data.actor} 的隐藏投掷：${data.total}`);
    }
  });
});
