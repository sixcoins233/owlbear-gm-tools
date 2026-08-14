# Owlbear Rodeo 免费静态插件

这里包含两个互相独立的 Owlbear Rodeo 扩展：

- `normal-d20/`：Normal Dice，离散正态分布 d20、GM 玩家授权、公开/隐藏结果、动画及概率图。
- `quest-board/`：左侧悬浮可拖动任务栏，含主线、支线、角色任务和 GM 编辑功能。
- `destiny-dice/`：Destiny & Dice，自由组合骰池、GM 隐藏范围裁定和全桌同步动画。

两者都只使用 Owlbear Rodeo SDK、浏览器本地存储和房间元数据，无需自己的服务器或数据库。完整发布和使用步骤见 [发布与使用](./发布与使用.md)。

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
```

开发服务器已只允许 `https://www.owlbear.rodeo` 跨域访问。测试时把相应的 `http://localhost:5173/manifest.json` 添加到 Owlbear 个人资料；如果端口被占用，请使用 Vite 输出的实际端口。
