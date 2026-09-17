# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 零依赖工程管线：`scripts/build.mjs`（运行时打包 + 缓存指纹 + 搜索索引 + 校验）、`scripts/validate.mjs`（防旁路 + 完整性硬门槛）、`scripts/build-runtime.mjs`（自研 ESM 打包器）、`scripts/build-search-index.mjs`（白名单口径重建）、`scripts/gen-stego-audio.mjs`（频谱隐写 WAV）、`scripts/gen-hardcore.mjs`、`scripts/gen-minigames.mjs`、`scripts/gen-arg.mjs`。
- 运行时模块化：`arg-runtime.js` 拆为 `src/runtime/*.mjs`（17+1 模块）单一 IIFE 打包；新增 `puzzles.mjs`（解锁前置遮蔽 / 答案校验 solve-credit / 时间锁 / 双标签页）、`games.mjs`+`games-builtin.mjs`（声音修复师小游戏宿主 + 6 个游戏）、`save.mjs`（存档版本化 + 导入/导出）、`logic.mjs`（纯函数）。
- **硬核谜题集群「深潮·礁声」**：新锁 + 枢纽 + 6 份硬核卷宗（Playfair / Polybius / 单表频率分析 / 双残带 XOR / 船籍 Luhn / 测向交点 / 频谱隐写 WAV）+ 新结局「深潮」。
- **6 个「声音修复师」小游戏**（补全频谱 / 去噪门限 / 走带对位 / 调谐旋钮 / 剪辑拼接 / 三段均衡，均带纯视觉等价通道）+ 新结局「金耳朵」。
- **真·ARG 层**：真实时钟时间锁、周年日期锁、持续收听、双标签页联动、robots.txt / 源码 / DevTools 彩蛋 + 新结局「现场直播」。
- 防旁路三型门控（锁 / 知识 / 动作·校验）与结局「可满足性」校验；42 项自动化测试；GitHub Actions CI；工程文档 `docs/ENGINEERING.md`、`CONTRIBUTING.md`、`.editorconfig`。
- 规模：417→**442 页**，6→**7 道锁**，10→**13 个结局**。

### Changed
- 线索记账新增「解锁前置」`requiresClue`：未满足时即使直接输入 URL 也不记线索，静态站防旁路更硬。
- `fallbackSearch` 分词正则修复（原 `/s+/` 误按字母 s 切词）；剥协议头正则修正。
- 新增 `prefers-reduced-motion` 适配（关打字机/扫描线/噪点）；聊天/署名/统计的 `innerHTML` 统一走 `escapeHtml`。
- 修复历史页面 `<script src="arg-runtime.js?v=…""">` 多余引号；每次构建按内容哈希刷新全部 442 页缓存指纹。

### Fixed
- **ARG 结局 `end_signal` 原不可达**：其所需线索 `clue_blackfin` 全站无任何页面发出。现由「频率元素谜题」经答案校验机制（`config.verify`）在解出 `blackfin` 时发出 `clue_blackfin`；防旁路校验器新增「可满足性」检查防此类回归。

## [1.1.0] - 2026-09-17
- 引入构建/校验/测试基线，纳入版本管理（此前为纯导出产物）。

## [1.0.0]
- 初版：417 页、6 锁、13 层谜题、7 处对话校验、10 结局。
