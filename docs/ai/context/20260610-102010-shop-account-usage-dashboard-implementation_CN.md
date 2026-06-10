# Shop Account Usage Dashboard 实施记录

## 本次目标

把 Shop 的公开手机号查询能力收敛到登录后的 Account 页面，并为 Account 页面加入个人 token 用量概览和基础图表容器。

## 已完成改动

- `/api/orders` 改为登录保护，只返回当前 session 手机号下的订单，不再信任 `phone` query 参数。
- `/api/account/me` 改为返回当前登录用户自己的完整 API key。
- 新增 `/api/account/usage-summary`：
  - 必须登录。
  - 只聚合当前 session 手机号关联的 Shop key 和 `usage_key_profiles` local key。
  - 返回今日、本周、本月、小时桶、日桶、模型排行、API key 汇总。
  - 返回 `dataFreshness.maxDelayMinutes = 60`，用于页面展示最多 1 小时延迟。
- Shop 页面路由收敛：
  - `/shop/login/` 和 `/shop/register/` 允许未登录访问。
  - `/shop/` 未登录跳 `/shop/login/`，已登录跳 Account/Admin 目的地。
  - `/shop/query/` 未登录跳 `/shop/login/`，已登录跳 `/shop/account/`。
  - 其他 page-like `/shop/*` HTML 页面未登录跳 `/shop/login/`。
  - `/shop/shop.js` 等带扩展名的静态资源不被页面登录保护拦截。
- 首页删除“手机号查询”按钮，按钮区改为登录账户、兑换 API key、使用方法。
- `/shop/query/` 页面删除手机号输入表单，只保留进入账户页的兜底说明。
- `/shop/account/` 增加：
  - “我的 API key”区域。
  - 用量概览卡片。
  - token 类型拆分卡片。
  - 最近 24 小时和本月每日基础柱状图容器。
- `shop/shop.js`：
  - Account 订单卡显示完整 API key 并绑定复制按钮。
  - Account 页面拉取 `/api/account/usage-summary` 并渲染基础图表。
  - `initQueryPage()` 改为跳转 `/shop/account/`。
- `shop/content/` 和 `shop/result/` 中旧 query 入口改为 Account 入口。

## 关键取舍

- MVP 不引入图表库，继续使用原生 HTML/CSS/JS 渲染基础柱状图。
- 个人 usage API 暂时直接从 `usage_events` 聚合；完整版本再引入 hourly/daily rollup 表。
- 完整 API key 只通过登录后的 Account API 返回，不写入 localStorage/sessionStorage。
- `/api/orders` 暂时保留为兼容接口，但已经登录保护并忽略传入手机号。

## 验证结果

- `npm test`：45 个测试全部通过。
- `npm run build:css`：构建成功；仅有 caniuse-lite 过期提示。
- `git diff --check`：无输出。
- `rg -n '^(<<<<<<<|=======|>>>>>>>)' .`：无输出。
- 请求级验证：
  - 未登录 `/shop/` 返回 302 `/shop/login/`。
  - 未登录 `/shop/query/` 返回 302 `/shop/login/`。
  - 未登录 `/shop/register/` 返回 200 并包含注册表单。
  - 登录后 `/shop/query/` 返回 302 `/shop/account/`。
  - 登录后 `/shop/account/` 返回 200，并包含 `accountUsageCards` 和 `accountHourlyChart` 容器。
  - 登录后 `/api/account/usage-summary` 返回 today/week/month、hourly、daily 和 60 分钟延迟字段。

## 未完成事项

- 内置 Browser 当前不可用，本次没有完成可视化截图检查。
- Chart.js/原生 SVG 增强、日期范围筛选、模型筛选、费用估算和 rollup 表仍按设计文档后续阶段推进。
