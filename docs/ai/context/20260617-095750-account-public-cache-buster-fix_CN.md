# Account 公网订阅池静态缓存修复

## 背景

用户反馈公网 Account 页面与本地 `4174` 预览不一致：模型价格显示为空或旧人民币样式，购买套餐下拉框为空白。当前公网服务运行在 `4173`，本地预览运行在 `4174`。

## 排查结论

- 主库 `data/shop.sqlite` 已包含订阅池套餐，`subscription_plans` 有 `29/39/59` 三档。
- `4173` 本地接口 `/api/account/subscription-state` 返回三档套餐正常。
- `4173` 本地接口 `/api/account/model-overview` 返回美元模型价格字段正常。
- 主分支 `shop/js/account.js` 已是美元订阅池渲染版本。
- `shop/account/index.html` 仍引用旧入口 `/shop/shop.js?v=20260614-account-price-display`。
- `shop/shop.js` 仍加载旧 Account 模块版本 `/shop/js/account.js?v=20260616-account-credit-limit-display`。
- 静态资源存在较长缓存时间，公网浏览器或 CDN 可能继续使用旧 JS。

## 修复方案

把 Account 页面入口和 Account 模块 loader 的版本号统一滚动到 `20260617-subscription-rollout`，让公网客户端强制请求订阅池上线后的最新前端资源。

## 验收点

- `shop/account/index.html` 引用 `/shop/shop.js?v=20260617-subscription-rollout`。
- `shop/shop.js` 加载 `/shop/js/account.js?v=20260617-subscription-rollout`。
- 前端测试覆盖这两个 cache-buster，防止以后上线订阅池代码但旧资源继续缓存。
