# 贡献指南

## 环境
- Node ≥ 20（推荐 22）。管线零依赖，无需 `npm install`。

## 提交前自检（等价于 CI）
```
node scripts/build.mjs
node --test "tests/**/*.test.mjs"
```
两步任一失败都不得提交——尤其防旁路硬门槛会拒绝破坏「不解题到不了真结局」的改动。

## 约定
- 谜题算法一律复用 `scripts/lib/ciphers.mjs`，不要在页面里手写加解密，避免与校验器/测试脱节。
- 新增线索必须先在 `scripts/content/guard.mjs` 声明门控类型；涉锁定内容严禁进 `scripts/content/search-include.json`。
- 运行时改动写在 `src/runtime/*.mjs` 并重新 `build`，不直接编辑 `arg-runtime.js`（构建产物）。
- 遵循 `.editorconfig`；文案避免「真实」等出戏措辞，外部检索统一称「外部引擎/外部检索」。

## 许可
游戏内容与代码采用 MPL-2.0。
