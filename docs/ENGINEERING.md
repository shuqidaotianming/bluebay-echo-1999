# 工程说明（ENGINEERING）

《白噪·1999》是**纯静态** ARG 解谜站：无服务器、无构建期依赖（Node 内置即可跑全管线）。本文说明架构与「如何安全地加内容」。

## 分层

1. **蓝图层** `arg-blueprint.json`（= `source/blueprint.json`）：可视化编辑器的图数据，`{version,title,startId,nodes,edges,customTemplates}`。是**简化可编辑图**：Chat 节点仅存 `siteName`，登录目标以 `edges` 的 `port→to` 表达。
2. **导出层** 根目录 `*.html`：真正的**玩法事实来源**。每页内嵌 `<script id="arg-config">` JSON（含整站 `files`/`names`、`rules.search`、`links`、Chat 的 `contacts/choices/passphrase`、锁 `password/loginTarget`、hash `hashClue/hashValue` 等）。运行时据此路由与记账。
3. **运行时层** `arg-runtime.js`：读 `#arg-config`，统一驱动线索状态机、路由、锁、聊天、搜索、拟真桌面、氛围、音频。构建产物（阶段2 起由 `src/runtime/*.mjs` 打包）。

## 线索门控三型（务必理解，决定「加内容」怎么不破坏防旁路）

- **锁门控 lock**：页面藏在 Login 之后，断锁后图不可达。真结局 9 条核心线索即此类。
- **知识门控 knowledge**：页面本身可达，但进入它的搜索词需先解出前序谜题（如解 hex 得 `stillhere` 再搜）。难度来自「知不知道词」，非「进不进得去」。
- **动作/校验门控 action**：线索不是普通页，而由「改地址栏 hash」（`clue_firstlight`/`clue_mem66`）或「在谜题页输入正确答案」（`clue_blackfin`）发出。

声明与断言集中在 `scripts/content/guard.mjs`；`scripts/validate.mjs` 强制：断锁后所有 lock 门控线索不可达、受保护结局存在锁门控缺口、每个结局所需 token 都可被记（可满足性）、hash 线索 host 页正确声明 `hashClue`。

## 常用命令

```
node scripts/validate.mjs                 # 防旁路 + 完整性硬门槛（CI 卡此）
node --test "tests/**/*.test.mjs"         # 算法/门控/索引测试
node scripts/build.mjs                    # 打包运行时 + 生成索引 + 校验
node scripts/build-search-index.mjs       # 仅重建 arg-search-index.js（按白名单）
```

## 加一道新硬核谜题（安全流程）

1. 在 `scripts/lib/ciphers.mjs` 确认有对应加解密原语（缺则补，并加往返测试）。
2. 写一个生成脚本/或手工产出页面：把密文写进某「锁后」页，答案词作为搜索/口令触发。
3. 新线索页若涉锁定：**不要**加入 `scripts/content/search-include.json`（否则泄进搜索索引）。
4. 在 `scripts/content/guard.mjs` 登记新线索的门控类型（`CORE`/`EXTRA_GUARDED`/`HASH_GATED`/`SOLVER_CREDITED`）并挂到有效锁 `behind`。
5. `node scripts/build.mjs && node --test`——校验器会拒绝任何让核心线索「断锁仍可达」或「结局要求悬空不可满足」的接线。

## 不变式（CI 保证）

- 任意非结局节点都有出边（无死胡同/孤岛）。
- 断掉全部锁 → 真/隐藏/ARG/名字墙结局不可点亮。
- 索引不含结局页与锁后核心线索（防剧透/防绕锁）。
