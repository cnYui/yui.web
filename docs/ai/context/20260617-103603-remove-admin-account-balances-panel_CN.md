# 移除 Admin 用户余额面板

## 背景

截图中的「用户余额」面板属于旧人民币余额视图，展示用户数、总余额、欠费用户、待确认充值和托管 key。当前订阅池版本已经有独立的「用户额度」监控，旧余额面板不再需要展示。

## 调整

- 从 `/shop/admin/` 业务办理区域删除「用户余额」整块 DOM。
- 删除 Admin 前端的余额汇总渲染、余额表格渲染、筛选器绑定和 `/api/admin/account-balances` 拉取逻辑。
- 充值审核确认或拒绝后只刷新充值审核列表，不再触发旧余额面板刷新。
- 移除 Admin 专用 `/api/admin/account-balances` 接口，避免前端移除后保留无用入口。
- 保留账户余额基础数据结构和 Account 个人页余额展示，因为余额、充值申请和旧兼容逻辑仍被其它流程使用。

## 验收

- Admin HTML 不再包含 `adminAccountBalancesPanel`、`adminBalanceSearchInput`、`adminBalanceStatusFilter`、`adminBalanceSummary`、`adminBalanceTable`、`adminBalanceMessage`。
- Admin 前端源码不再包含 `api/admin/account-balances` 和旧余额面板渲染函数。
- `/api/admin/account-balances` 返回 404。
