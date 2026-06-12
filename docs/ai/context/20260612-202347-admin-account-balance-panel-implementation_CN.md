# Admin 用户余额面板实施

## 实施内容

- `/shop/admin/` 的「业务办理」section 已新增只读「用户余额」面板。
- 面板位于充值审核下方、邀请码记录 / API key 池记录上方。
- 新增 `/api/admin/account-balances`，返回全部 Shop 用户余额、欠费、待确认充值和托管 key 数量。
- 「业务办理」统一刷新会刷新余额面板。
- 充值审核确认或拒绝后会同步刷新余额面板。

## 口径

- 余额面板是账户台账视图，不计入「今日收银 / 本月收银」。
- Local / 未托管 usage key 不作为 Shop 用户余额展示。
- 第一版只读，不提供直接调余额操作。
- 管理员账号不进入余额列表。

## 验证

- `node --test --test-name-pattern "Admin 前端兑换码管理" test/shop-flow.test.js`：通过。
- `node --test test/shop-flow.test.js`：117 个测试通过。
- `npm run build:css`：通过，提示 Browserslist 数据较旧。
- `npm test`：133 个测试通过。
- 浏览器验证 `/shop/admin/`：通过；未登录跳转登录页，登录后业务办理顺序为充值审核、用户余额、邀请码记录 / API key 池记录，业务办理刷新会刷新余额面板。
