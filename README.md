# Owlbear Rodeo 免费静态插件

本仓库包含四个独立扩展，均可由 GitHub Pages 免费托管：

- `normal-d20/`：Normal Dice，离散正态分布 d20、GM 授权、公开/隐藏结果与动画。
- `quest-board/`：可拖动、可缩放的悬浮任务栏，含主线、支线与角色任务。
- `destiny-dice/`：Destiny & Dice，自由组合骰池、GM 隐藏范围裁定和全桌动画。
- `bilibili-music/`：Bilibili Music，GM 房间歌单、同步播放、本地收藏和独立音量。

完整发布与使用方法见 [发布与使用.md](./发布与使用.md)。

## 本地构建

需要 Node.js 22 和 pnpm：

```bash
pnpm install
pnpm build
```

单独开发：

```bash
pnpm --filter normal-d20 dev --host
pnpm --filter quest-board dev --host
pnpm --filter destiny-dice dev --host
pnpm --filter bilibili-music dev --host
```
