# 订阅退款 MVP 设计与计划

## 背景

用户确认在订阅池 MVP 中加入“申请退款”功能，并确认管理员批准退款后立即取消套餐，让 API key 当场不可用。退款只针对当前有效套餐，不处理加量包；加量包余额继续长期保留。

## 必须功能

- Account 页面在有有效套餐时显示退款入口。
- 页面直接展示预计退款金额，按会员剩余天数计算，不按当天已使用额度计算。
- 用户提交后创建待审核退款申请；同一有效套餐只允许存在一条待审核退款申请。
- Admin 页面在业务办理中展示退款审核，管理员可以批准或拒绝。
- 批准退款后退款申请变为 `approved`，当前订阅变为 `cancelled`，API key 因无有效套餐立即不可用。
- 拒绝退款后退款申请变为 `rejected`，订阅继续保持有效。
- 后端重新计算退款金额，不信任前端金额。

## 退款金额规则

退款金额使用人民币 cents：

`floor(套餐金额 cents * 剩余天数 / 套餐总天数)`

剩余天数按当前时间到 `expires_at` 的自然天数向上取整，并限制在 `0..period_days`。这样当天申请时不会因为当天已消耗额度减少退款，符合“按剩余会员天数，不按使用额度”的要求。

## 数据设计

新增 `subscription_refund_requests`：

- `id`：退款申请 id。
- `phone`：申请账号。
- `subscription_id`：对应当前有效订阅。
- `plan_id`：申请时套餐。
- `plan_amount_cents`：申请时套餐金额快照。
- `period_days`：申请时套餐周期快照。
- `remaining_days`：申请时剩余天数快照。
- `refund_amount_cents`：申请时计算出的预计退款金额。
- `status`：`pending | approved | rejected`。
- `created_at`、`confirmed_at`、`confirmed_by_phone`、`admin_note`。

通过唯一索引限制同一 `subscription_id` 只能有一条 `pending` 申请，避免重复申请。

## 接口设计

- `POST /api/account/subscription-refund-requests`
  - 登录用户提交退款申请。
  - 无有效套餐返回 `409 ACTIVE_SUBSCRIPTION_REQUIRED_FOR_REFUND`。
  - 已有待审退款返回 `409 REFUND_REQUEST_PENDING`。
- `GET /api/account/subscription-refund-requests`
  - 用户查看自己的退款申请。
- `GET /api/admin/subscription-refund-requests?status=pending`
  - 管理员查看退款申请。
- `POST /api/admin/subscription-refund-requests/:id/approve`
  - 批准退款并立即取消订阅。
- `POST /api/admin/subscription-refund-requests/:id/reject`
  - 拒绝退款，订阅保持有效。

## 前端设计

Account 在订阅池区新增一个精简退款卡片：

- 显示当前套餐、预计退款金额、剩余天数。
- 有效套餐且无待审退款时启用“申请退款”按钮。
- 无有效套餐时提示“开通套餐后才可申请退款”。
- 已有待审退款时禁用按钮并提示等待管理员审核。

Admin 在业务办理区新增“退款审核”：

- 状态筛选：待确认、已批准、已拒绝、全部。
- 表格展示手机号、套餐、套餐金额、开始/到期、剩余天数、预计退款、申请时间。
- 待确认行提供备注、批准、拒绝。

## 测试计划

1. 后端流程测试：用户有有效套餐时可以提交退款申请，金额按剩余天数计算。
2. 后端幂等测试：同一有效套餐重复提交待审退款返回 409。
3. 批准测试：管理员批准后订阅变 `cancelled`，内部 API key 状态变为 `subscription_required`。
4. 拒绝测试：管理员拒绝后订阅仍保持 active。
5. 前端结构测试：Account 包含退款按钮、预计退款容器和申请列表；Admin 包含退款审核容器、批准/拒绝调用。

## 实施步骤

1. 先写 `test/shop-flow.test.js` 和 `test/shop-frontend.test.js` 的失败测试。
2. 在 `server.js` 增加退款表、查询语句、公开 mapper、金额计算 helper、account/admin 路由。
3. 在 Account HTML/JS 接入退款卡片和申请提交。
4. 在 Admin HTML/JS 接入退款审核列表和操作。
5. 执行 targeted tests、`npm run build:css`、`npm test`、`git diff --check`。
6. 重启 `4174` 本地服务并提交。
