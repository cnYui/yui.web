# Shop 收款码不显示根因与修复

## 背景

线上 `/shop/account/` 中支付宝和微信收款码位置只显示 `alt` 文案，没有显示图片。

## 根因

- 收款码文件本身存在，线上 `/shop/assets/pay/alipay-qr.png` 和 `/shop/assets/pay/wechat-qr.png` 都返回 `200 image/png`。
- `/api/account/balance` 会返回正确的 `payment.alipayQrUrl` 和 `payment.wechatQrUrl`。
- 页面初始 HTML 中 `<img>` 没有 `src`，需要 `shop/shop.js` 初始化 Account 页后写入。
- 安全响应头为 `Content-Security-Policy: script-src 'self'`，会禁止 HTML 末尾的 inline 初始化脚本 `window.YuiShop.initAccountPage()`。
- 因此页面停在占位状态：手机号、付款备注和二维码 `src` 都没有被写入。

## 方案

- 保留 `script-src 'self'`，不放宽到 `unsafe-inline`。
- 在 `/shop/shop.js` 中新增按路径自动初始化逻辑：
  - `/shop/account/` 自动执行 `initAccountPage`
  - `/shop/admin/` 自动执行 `initAdminPage`
  - `/shop/login/`、`/shop/register/`、`/shop/redeem/` 等子页同样由外部脚本初始化
- 移除 Shop 子页末尾的 `window.YuiShop.init...` inline 脚本，避免无 CSP 环境下重复初始化。
- 移除 guide 页末尾的 inline ready 脚本，减少 CSP 噪音。

## 验证

- 新增回归测试：只执行外部 `/shop/shop.js`，不执行 HTML inline script，验证 Account 页仍会请求 `/api/account/me` 并写入两张收款码图片 `src`。
- `npm test` 通过：82 pass。
- `npm run build:css` 通过，仅 Browserslist outdated warning。
- `git diff --check` 通过。
- 本地浏览器验证：
  - 登录测试账号后进入 `http://localhost:4183/shop/account/`
  - 支付宝图片 `src=/shop/assets/pay/alipay-qr.png`，`naturalWidth=1708`
  - 微信图片 `src=/shop/assets/pay/wechat-qr.png`，`naturalWidth=828`
  - `paymentReference` 正常写入
  - 控制台无 error/warning
