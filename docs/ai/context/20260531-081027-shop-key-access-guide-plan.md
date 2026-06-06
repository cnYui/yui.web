# 商店兑换结果页访问保护与使用说明

## 背景

用户希望 `/shop/key/` 只在完成邀请码兑换后可访问。如果浏览器没有兑换态 cookie，说明用户没有从兑换流程进入，不应直接看到结果页。

兑换完成后页面需要展示一段给其他 AI 使用的配置说明。说明中的 API key 不能写死为示例值，必须使用本次兑换分配到的真实 API key 动态渲染。

## 设计

- 后端在 `POST /api/invites/redeem` 成功后写入 `yui_shop_redeemed=1` cookie。
- 后端在静态文件之前拦截 `GET /shop/key/` 和 `GET /shop/key/index.html`：
  - 有 cookie：继续返回页面。
  - 无 cookie：`302` 跳转到 `/shop/redeem/`。
- 前端继续把本次订单保存在 `localStorage`，用于结果页展示完整 API key。
- 结果页新增“配置使用方法”区域，用当前订单的 `apiKey` 替换文档里的 `sk-dummy`。

## Tradeoff

- cookie 只证明当前浏览器走过兑换流程，不作为长期登录态。
- 查询页仍通过手机号返回订单和 API key，这是当前业务要求；`/shop/key/` 只保护“兑换完成后的结果页”。
- 使用 HttpOnly cookie 更安全，但前端无需读取 cookie，所以由后端设置即可。

## 验证

- 单元测试增加：
  - 兑换成功响应带 `Set-Cookie`。
  - 无 cookie 访问 `/shop/key/` 会跳转。
  - 有 cookie 访问 `/shop/key/` 返回页面。
  - 结果页包含配置说明容器。
