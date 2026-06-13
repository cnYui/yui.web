# Shop B 级模块化重构实施记录

## 背景

用户确认采用 B 级重构，目标是减少个人主页 Shop 页面和后端逻辑的冗余，同时不影响当前映射到公网的本地实例。

本次实施在隔离 worktree 中完成：

- worktree：`/Users/wujianxiang/CodeSpace/yui.web/.worktrees/shop-modular-refactor-20260613`
- 分支：`codex/shop-modular-refactor-20260613`
- 开发端口：`http://127.0.0.1:4174`
- 开发数据库：`data/dev/shop-refactor.sqlite`
- usage 自动导入：关闭

## 后端拆分

- 新增 `lib/shop-money.js`，统一 cents、nanos、CNY 和非负整数处理。
- `lib/shop-usage-reconcile.js` 复用 `shop-money`，避免补账脚本和服务端金额逻辑分叉。
- `lib/shop-pricing.js` 新增 `priceForVersion(version)`，统一历史价格版本回放。
- 新增 `lib/shop-billing-summary.js`，承接 Admin 收银构成、用户消费排行和 Account 周消费统计。
- 新增 `lib/shop-model-overview.js`，承接模型列表归一化和模型价格总览 DTO。
- `server.js` 保留 Express 组装、路由、SQL statement 和事务边界，不在本次做 C 级路由 / 仓储层深拆。

## 前端拆分

- 新增 `shop/js/core.js`：手机号、密码强度、格式化、cookie、`requestJson`、DOM ready 等通用工具。
- 新增 `shop/js/charts.js`：收银饼图、三段堆叠柱、Account 周消费图和 Admin 收银图表。
- 新增 `shop/js/auth.js`：登录、注册、重置密码和重置码输入归一。
- 新增 `shop/js/account.js`：Account、兑换、余额、充值、模型总览、扣费流水。
- 新增 `shop/js/admin.js`：Admin 业务办理、用户余额、充值审核、邀请码、usage 监控、日志导入。
- 新增 `shop/js/legacy-redirects.js`：旧购买 / 支付 / 结果 / 内容页面跳转。
- `shop/shop.js` 缩减为入口和兼容层，继续暴露 `window.YuiShopReady` 与 `window.YuiShop`。
- 所有引用 `/shop/shop.js` 的 Shop HTML 只直接加载入口脚本；入口脚本负责按顺序动态加载 `shop/js/*` 模块，避免每个页面重复硬编码模块列表。

## 测试拆分

- 新增 `lib/shop-money.test.js`、`lib/shop-billing-summary.test.js`、`lib/shop-model-overview.test.js`。
- 新增 `test/shop-frontend.test.js`，承接前端 VM、HTML、CSS 静态断言。
- `test/shop-flow.test.js` 保留服务端集成流程和数据库行为测试；30 个纯前端 / 静态断言已迁入 `test/shop-frontend.test.js`。

## 浏览器验收

独立实例使用以下命令启动：

```bash
ADMIN_TOKEN=<DEV_ADMIN_TOKEN> INTERNAL_TOKEN=<DEV_INTERNAL_TOKEN> PORT=4174 node -e "const path=require('node:path'); const { createShopApp }=require('./server'); const { app, usageImporter }=createShopApp({ dbPath: path.join(process.cwd(), 'data/dev/shop-refactor.sqlite'), usageAutoImportEnabled: false, usageAutoImportStartTimer: false }); const server=app.listen(4174, '127.0.0.1', () => console.log('dev shop http://127.0.0.1:4174')); process.on('SIGINT', () => { usageImporter.stop(); server.close(() => process.exit(0)); });"
```

浏览器检查结果：

- `/shop/login/` 加载正常，Shop 模块脚本 200 返回，控制台无 error / warning。
- 登录页手机号输入会裁剪为数字，使用有效手机号和错误密码提交后显示“手机号或密码错误。”。
- `/shop/register/` 手机号输入会裁剪为数字，弱密码由 JS 显示校验提示。
- `/shop/reset-password/` 手机号输入会裁剪为数字，重置码输入会归一为大写无空格，弱密码由 JS 显示校验提示。
- 未登录访问 `/shop/account/` 和 `/shop/admin/` 都跳转到 `/shop/login/`。

前一轮浏览器“消息为空”的原因是测试输入了无效手机号，浏览器原生 `pattern` / `minlength` 校验拦截了提交，submit handler 没有触发；不是模块脚本未执行。

## 追加清理

继续复查时发现：`shop/shop.js` 已具备动态模块加载能力，但 12 个 Shop HTML 仍重复硬编码 6 个 `shop/js/*` 模块脚本。已删除这些重复标签，只保留各页原有 `/shop/shop.js` 入口脚本，并新增测试确认入口脚本会自动加载模块。

## 验证结果

- `node --test test/shop-frontend.test.js test/shop-flow.test.js`：128 个测试通过。
- `npm test`：155 个测试通过。
- `npm run build:css`：退出码 0，仅有 Browserslist 过期提示。

测试输出中的 `sendFile` 404 stack 来自既有“公网静态服务不能下载 SQLite 数据库或 AI 上下文”安全测试，测试本身通过。

## 后续边界

- 后续 Shop 前端改动优先进入 `shop/js/*` 对应模块，不要把页面逻辑重新堆回 `shop/shop.js`。
- 后续新增 Shop 页面只引用 `/shop/shop.js` 入口，不要再在 HTML 里重复写 `shop/js/*` 模块列表。
- 后续后端金额、价格回放、收银统计和模型总览纯逻辑优先进入 `lib/*`，`server.js` 只保留路由和事务边界。
- 涉及当前公网映射实例时，继续使用独立 worktree、独立端口和独立 SQLite；不要直接在公网实例目录里做半成品修改。
