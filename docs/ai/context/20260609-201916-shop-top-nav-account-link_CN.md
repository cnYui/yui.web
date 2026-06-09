# Shop 顶栏账号入口删除

## 背景

`/shop/` 页面顶部导航栏的账号入口会被 `window.YuiShop.initAccountLinks()` 动态改成“我的账户”或“管理控制台”。用户希望删除顶部导航栏里多出来的账号跳转，同时保留一个登录入口。

## 设计

- 只删除 `shop/index.html` 顶部桌面导航和移动端菜单里的 `data-account-link`。
- 保留首屏正文操作区里的一个 `data-account-link` 登录按钮，登录后仍可动态跳到个人中心或管理员控制台。
- 不修改 `/shop/login/`、`/shop/register/`、`/shop/account/` 的页面能力。

## 实施计划

1. 修改 `test/shop-flow.test.js` 里的静态 HTML 断言，要求 `/shop/` 首页只保留 1 个 `data-account-link`，且 `<header>` 内不能出现账号入口。
2. 运行 `node --test test/shop-flow.test.js`，确认新断言会因现有顶栏入口失败。
3. 修改 `shop/index.html`，删除桌面导航和移动端菜单中的账号链接。
4. 重新运行 `node --test test/shop-flow.test.js`。
5. 通过本地 `http://127.0.0.1:4173/shop/` 检查顶部导航不再显示账号按钮，正文仍保留一个登录按钮。

## 取舍

不移除 `initAccountLinks()`，因为正文登录按钮仍依赖它根据 session 状态改写跳转目标。这样改动最小，也不会影响账号页和管理员控制台访问链路。
