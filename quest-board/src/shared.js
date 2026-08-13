export const ID = "tools.horn.quest-board";
export const META = `${ID}/tasks`;
export const CONTROL = `${ID}/control`;
export const POPOVER = `${ID}/panel`;
export const groups = [
  ["main", "主线任务", "◆"],
  ["side", "支线任务", "◇"],
  ["character", "角色任务", "♙"],
];
export const emptyBoard = () => ({
  version: 1,
  updatedAt: Date.now(),
  groups: { main: [], side: [], character: [] },
});
