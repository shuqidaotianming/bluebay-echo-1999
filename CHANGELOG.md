# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 共享数据文件 `arg-data.js`（全站 `files/names` 单一来源）+ `scripts/build-data.mjs` + `scripts/slim-pages.mjs`：各页不再内嵌大表，页面总体积 15.7MB → 4.1MB（约 -60%）；运行时优先读全局、页内作覆盖，向后兼容。
- 声音修复师小游戏接入真·Web Audio 实时反馈（`src/runtime/audio-games.mjs` `createStudio`）：去噪门限 / 走带对位 / 调谐旋钮 / 三段均衡均可 ▶ 试听，噪声/人声/拍频随操作变化；无 `AudioContext` 环境安全降级为纯视觉。
- `scripts/golden-path.mjs`：13 个结局可达性模拟（须解题 vs 随手可达），并入 `npm run check` 与测试。
- 零依赖工程管线：`scripts/build.mjs`（运行时打包 + 共享数据 + 页面瘦身 + 缓存指纹 + 搜索索引 + 校验）、`scripts/validate.mjs`（防旁路 + 完整性硬门槛）、`scripts/build-runtime.mjs`（自研 ESM 打包器）、`scripts/gen-*.mjs`（硬核/小游戏/ARG/频谱隐写内容生成）。
- 硬核谜题集群「深潮·礁声」（Playfair / Polybius / 单表频率分析 / 双残带 XOR / 船籍 Luhn / 测向交点 / 频谱隐写 WAV）+ 新结局「深潮」；6 个小游戏 + 新结局「金耳朵」；真·ARG（真实时钟/周年日期时间锁、持续收听、双标签页、robots.txt/源码/DevTools）+ 新结局「现场直播」。
- 运行时模块化（`src/runtime/*.mjs`，19 模块单 IIFE 打包）+ `save.mjs`（存档版本化 + 导入/导出）；防旁路三型门控与结局「可满足性」校验；`node --test` 测试套件 + GitHub Actions CI。
- 规模：417 → **442 页**，6 → **7 道锁**，10 → **13 个结局**；`npm run gen:all` 一键重建全部内容（幂等）。

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
