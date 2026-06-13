# Shop B 级模块化重构设计

## 背景

用户希望检查个人主页项目中的冗余，重点是 `/shop/` 页面和后端逻辑，并选择 B 级重构：中等力度拆分，不做一次性大迁移。

当前本地运行的网页会映射到公网。如果直接在当前工作区修改静态文件，运行中的 Express 静态服务可能在不重启的情况下读到半成品 `shop/shop.js` 或 HTML。因此实现阶段必须使用独立 worktree 和独立开发服务，不在当前公网实例所在目录改业务代码。

## 调查结果

- `server.js` 约 3891 行，混合数据库迁移、SQL statement、认证、CSRF、余额、扣费、usage 导入、Admin 接口、内部接口和 Shop 页面守卫。
- `shop/shop.js` 约 1672 行，混合通用格式化、请求封装、图表渲染、Auth、Account、Admin、旧页面跳转等逻辑。
- `test/shop-flow.test.js` 约 4357 行，既包含后端集成测试，也包含大量前端 VM 和 HTML 静态断言。
- `renderCustomerSpendingBars` 和 `renderAccountWeeklySpendingChart` 重复实现三段堆叠柱。
- `nanosToBalanceCents`、`nonNegativeInteger`、历史价格版本回放分散在 `server.js`、`lib/shop-pricing.js`、`lib/shop-usage-reconcile.js` 和测试中。
- 多个 Shop HTML 页面重复 head、字体、主题预初始化、header 和 `shop/shop.js` 引用。
- 基线验证：`npm test` 在当前工作区通过，142 个测试全部通过。

## 目标

- 降低 Shop 前后端核心文件体积和职责混杂程度。
- 保持所有外部 API 路径、请求体、响应体和页面 DOM id 兼容。
- 保持账务、扣费、余额、CSRF、安全响应头、内部 API key 状态接口行为不变。
- 开发验证使用独立端口和独立 SQLite，避免影响当前公网映射实例。
- 不在本阶段做 C 级深拆：不把全部 SQL statement、所有路由和数据库迁移一次性搬离 `server.js`。

## 方案取舍

推荐方案 B：

- 后端先抽纯函数和低耦合逻辑：
  - `lib/shop-money.js`：金额、nanos、cents、CNY 和整数归一。
  - `lib/shop-pricing.js`：当前价格、模型价格、历史 `price_version` 回放。
  - `lib/shop-billing-summary.js`：收银构成、用户消费排行、周消费统计。
  - `lib/shop-model-overview.js`：模型列表解析、模型价格展示 DTO。
- 前端保留一个入口 `shop/shop.js`，把页面和渲染逻辑拆到 `shop/js/`：
  - `shop/js/core.js`
  - `shop/js/charts.js`
  - `shop/js/auth.js`
  - `shop/js/account.js`
  - `shop/js/admin.js`
  - `shop/js/legacy-redirects.js`
- 浏览器仍只需要加载 `/shop/shop.js`；入口脚本负责加载子模块并按路径初始化页面，避免每个 Shop HTML 都追加多段重复 `<script>`。
- 测试拆分一部分前端 VM / HTML 断言到独立测试文件，避免继续膨胀 `test/shop-flow.test.js`。

不选方案 A：只抽少量纯函数风险最低，但无法实质解决 `shop/shop.js` 和图表重复。

不选方案 C：直接拆路由、SQL、迁移和仓储层收益更大，但账务和安全边界牵动太广，当前更适合先用 B 级重构建立模块边界。

## 开发隔离

实现阶段必须先创建独立 worktree，例如：

```bash
git worktree add .worktrees/shop-modular-refactor-20260613 -b codex/shop-modular-refactor-20260613
```

开发服务使用独立端口和独立数据库，例如：

```bash
PORT=4174 node -e "const path=require('node:path'); const { createShopApp }=require('./server'); const { app, usageImporter }=createShopApp({ dbPath: path.join(process.cwd(), 'data/dev/shop-refactor.sqlite'), usageAutoImportEnabled: false, usageAutoImportStartTimer: false }); const server=app.listen(4174, '127.0.0.1', () => console.log('dev shop http://127.0.0.1:4174')); process.on('SIGINT', () => { usageImporter.stop(); server.close(() => process.exit(0)); });"
```

约束：

- 不使用当前 `data/shop.sqlite`。
- 不开启 usage 自动导入定时器。
- 不在当前公网实例目录改业务代码。
- 本地验收地址固定为 `http://127.0.0.1:4174`，除非端口已占用。

## 模块边界

### 后端

- `server.js` 保留 Express app 组装、路由注册、SQL statement 所在闭包和数据库事务。
- 金额转换、价格回放、收银统计、模型总览 DTO 必须从 `lib/` 导入。
- 账务事实字段继续使用 nanos；旧 cents 字段只做兼容展示。
- 历史价格回放不能丢失：
  - `deepseek-v4-pro-rmb-20260424`
  - `deepseek-v4-pro-rmb-20260612-cache-hit-10x`
  - `deepseek-v4-pro-rmb-20260612-output-20rmb`
  - `gpt-5.4-rmb-20260613`
  - `gpt-5.5-rmb-20260613`
- 未知 `price_version` 回退当前默认 `gpt-5.4` 价格。

### 前端

- `shop/js/core.js` 只提供基础工具：手机号、密码强度、日期、金额、数字、HTML escape、cookie、`requestJson`、DOM ready。
- `shop/js/charts.js` 只负责收银饼图和堆叠柱，Account 周消费和 Admin 用户消费排行共用一个堆叠柱函数。
- `shop/js/auth.js` 只负责登录、注册、重置密码、重置码输入归一。
- `shop/js/account.js` 只负责账户页、兑换、余额、充值、模型总览、扣费流水、周消费。
- `shop/js/admin.js` 只负责 Admin 业务办理、余额、充值审核、邀请码、usage 监控、日志导入。
- `shop/js/legacy-redirects.js` 只负责旧页面跳转。
- `shop/shop.js` 只负责加载模块、按路径分发初始化、对外兼容 `window.YuiShop`。

## 测试策略

- TDD 顺序：先写失败测试，再拆模块。
- 纯函数优先单元测试，减少只靠大集成测试兜底。
- 每次后端抽取后跑对应 `lib/*.test.js` 和相关 `test/shop-flow.test.js --test-name-pattern`。
- 前端拆分后用 VM 加载所有 `shop/js/*.js` 和 `shop/shop.js`，确保 `window.YuiShop` 对外 API 不变。
- 最终验证：
  - `npm test`
  - `npm run build:css`
  - 独立端口 `http://127.0.0.1:4174` 浏览器检查登录页、账户页、Admin 页关键区域。

## 风险与控制

- 风险：动态加载前端模块导致页面初始化时序变化。控制：入口脚本暴露 `window.YuiShopReady`，测试等待该 Promise，页面初始化只在模块加载完成后执行。
- 风险：价格回放迁移导致历史 Admin 收银构成变化。控制：新增单元测试覆盖旧 DeepSeek 和 GPT 价格版本。
- 风险：开发实例写入生产库。控制：开发命令显式传入 `data/dev/shop-refactor.sqlite`，并禁用 usage 自动导入。
- 风险：当前工作区已有未提交改动。控制：实现阶段使用独立 worktree；当前目录只记录设计和计划。
