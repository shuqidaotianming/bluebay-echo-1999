# 白噪 · 1999 蓝湾镇回声事件

> 一个大型原创 ARG 风格桌面解谜游戏：**442 个页面 · 7 道锁 · 20+ 层谜题 · 10 处对话/答案校验 · 13 个结局**（含打破第四面墙的 ARG 结局、「名字墙」纪念结局，以及新增的「深潮」「金耳朵」「现场直播」硬核结局）。
> 结局不取决于你点了哪个选项，而取决于你解出并真正掌握的线索——证据不全，只会冤枉错的人。
>
> **v1.1 硬核扩展**：新增「深潮·礁声」谜题集群（Playfair / 棋盘密码 / 单表频率分析 / 双残带异或 / 船籍 Luhn / 测向交点 / 频谱隐写 WAV）；6 个「声音修复师」小游戏（补全频谱 / 去噪门限 / 走带对位 / 调谐旋钮 / 剪辑拼接 / 三段均衡，均带视觉等价通道）；以及真·ARG 层——**真实时钟时间锁、周年日期锁、持续收听、双标签页联动、robots.txt / 源码 / DevTools 彩蛋**。并落地零依赖构建 / 校验 / 测试管线与防旁路硬门槛（详见 `docs/ENGINEERING.md`）。

## 在线试玩

- **Cloudflare Pages（推荐，国内访问更稳）**：https://fm994.pages.dev/
- **GitHub Pages**：https://shuqidaotianming.github.io/bluebay-echo-1999/

纯静态站点，无需服务器。也可下载整仓库用浏览器打开 `index.html`（建议 `npx serve .` 以保证线索进度一致）。

## 玩法速览

- 你是声音修复师**沈知微**，追查失踪的电台主持人哥哥**沈砚**（序章·开机开始）。
- 在「桌面 / 加密聊天 / 千禧搜索 / 蓝湾潮声论坛 / 档案馆 / 维基 / 保险箱 / 机房 / 灯塔顶层 / 记者信箱 / 编辑室 / 灯塔纪念站」之间搜集线索。
- 每打开一个页面记一条线索（存 **localStorage**，关标签页不丢；右下角「线索 X/? ⟳」可看进度与**已收集清单**、点 ⟳ 重置；**聊天记录也会保存**）。
- **结案＝指认嫌疑人**（聊天里的记者"明月如霜"）。游戏里有**伪造证据**——看了它们只会解锁坏结局。
- **13 层密码链**：凯撒 → Base64 → 摩尔斯 → 组合锁 → 藏头诗 → 十六进制隐写 → 维吉尼亚 → 元素周期表 → 二进制 → 倒读密文 → **地址栏 hash ×2** → 双因子合成；另有 **7 处"查完真实世界 → 打字发给联系人"的答案校验**。
- **ARG 层要动真的浏览器**：地址栏加 `#firstlight` 与 `#sixtysix`、查真的元素周期表、用转换器解二进制、把整页倒过来读、拿真实经纬度去地图上找那片海。
- 9 条核心线索跨三道锁——**不解题，拿不到真结局**。

## 目录结构

```
.
├── index.html            # 游戏入口（序章·开机）
├── *.html                # 其余 401 个页面（6 道锁 / 13 层谜题 / ARG 谜题 / 10 个结局 / 名字墙……）
├── arg-runtime.js        # 线索记录(localStorage) / 路由 / 按行打字机 / 白噪 / hash 谜题 / 聊天存档
├── arg-blueprint.json    # 完整剧情蓝图（可导入 ARG-Blueprinter 再编辑）
├── assets/cover.png      # 作品封面
├── docs/                 # 剧本说明 + 完整攻略（含全部密码答案·剧透）
└── source/blueprint.json # 蓝图源文件（同 arg-blueprint.json）
```

## 二次创作 / 更新

- 可视化编辑：用开源工具 [ARG-Blueprinter](https://github.com/GallonHong/ARG-Blueprinter) 导入 `arg-blueprint.json`。
- 一键更新本站：在 ARG-Blueprinter 项目目录运行 `node sync-site.mjs "提交说明"`（自动 构建→回归测试→导出→提交→推送；回归不过不推送）。

## 本地工程管线（零依赖，仅需 Node ≥ 20）

本仓库自带一套不依赖任何 npm 包的构建 / 校验 / 测试管线：

```
node scripts/build.mjs          # 打包运行时(src/runtime) + 生成 arg-data.js + 页面瘦身 + 刷缓存指纹 + 索引 + 防旁路校验
node scripts/validate.mjs       # 完整性 + 防旁路硬门槛（断锁后核心线索不可达、结局门槛可满足性）
node scripts/golden-path.mjs    # 13 个结局可达性模拟（须解题 vs 随手可达）
node --test "tests/**/*.test.mjs"   # 算法/门控/索引/运行时冒烟/结局 测试
npm run gen:all                 # 一键重建硬核谜题/小游戏/ARG 内容 + 构建（幂等）
```

整站 `files/names` 映射集中在共享 `arg-data.js`（各页不再内嵌大表，页面体积约降 60%：15.7MB→4.1MB）。`arg-runtime.js`、`arg-search-index.js`、`arg-data.js` 均为构建产物：改运行时请改 `src/runtime/*.mjs` 后重新构建，勿直接编辑产物。CI 见 `.github/workflows/ci.yml`。架构与「如何安全地加谜题」见 `docs/ENGINEERING.md`。

## 许可

游戏内容与代码采用 [MPL-2.0](LICENSE)（与 ARG-Blueprinter 工具一致）。
