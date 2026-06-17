# 订阅退款 MVP 实施记录

## 已完成

- 新增 `subscription_refund_requests` 表，用于保存套餐退款申请。
- 用户可在 Account 页面提交退款申请；同一有效套餐只能存在一条待审核退款申请。
- 退款金额由后端重新计算，使用人民币 cents，不信任前端金额。
- 退款金额按 `floor(套餐金额 * 剩余天数 / 套餐总天数)` 计算，不按当天已使用额度计算。
- 管理员可在 Admin 业务办理区查看退款审核，并批准或拒绝。
- 管理员批准后，退款申请变为 `approved`，对应套餐立即变为 `cancelled`，API key 因无有效套餐立即不可用。
- 管理员拒绝后，退款申请变为 `rejected`，套餐继续保持 `active`。
- 加量包余额不参与退款，批准退款也不会清空加量包余额。

## 涉及文件

- `server.js`
- `shop/account/index.html`
- `shop/admin/index.html`
- `shop/js/account.js`
- `shop/js/admin.js`
- `test/shop-flow.test.js`
- `test/shop-frontend.test.js`

## 验证

- RED：新增退款测试后，后端因缺表/路由失败，前端因缺退款容器和调用失败。
- GREEN：实现后 targeted 后端测试 108/108 通过，targeted 前端测试 40/40 通过。
- `npm run build:css` 通过。
- `git diff --check` 通过。
- `npm test` 190/190 通过。
- 浏览器验证：
  - `http://localhost:4174/shop/account/` 注册临时账号后显示退款卡片，无套餐时按钮禁用。
  - `http://localhost:4174/shop/admin/` 管理员登录后显示“退款审核”和退款申请列表。

## 本地服务

已在 `http://localhost:4174` 启动当前分支版本。
