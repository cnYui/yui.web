# Shop 忘记密码实现记录

## 背景

本次实现承接 `20260610-095929-shop-password-reset-design_CN.md` 和 `20260610-101114-shop-password-reset-implementation-plan_CN.md`。目标是在现有手机号密码账号体系上补齐“忘记密码”能力：管理员在后台生成一次性重置码，用户在登录页凭码设置新密码。

## 实际改动

- `server.js`
  - 新增 `password_reset_codes` 表，只保存重置码 hash。
  - 新增重置码生成、归一化和 SHA-256 hash 工具。
  - 新增 `POST /api/admin/password-reset-codes`，仅管理员 session 可生成重置码。
  - 新增 `POST /api/auth/password-reset`，用户提交手机号、重置码、新密码和确认密码后完成重置。
  - 重置成功后更新密码 hash，标记重置码已使用，撤销该手机号旧 session，并创建新 session。
- `shop/admin/index.html`
  - 新增“生成密码重置码”区域，包含手机号输入、生成按钮、状态文案和重置码展示区域。
- `shop/login/index.html`
  - 新增“忘记密码？重置密码”入口。
  - 新增重置密码表单：手机号、重置码、新密码、确认密码。
- `shop/shop.js`
  - 新增登录页表单切换和重置提交逻辑。
  - 新增管理员页生成重置码逻辑。
  - 重置码输入自动大写并过滤非法字符。
- `test/shop-flow.test.js`
  - 新增 schema、管理员权限、重置码生成、弱密码、确认密码、错误码、过期码、重复使用、旧 session 失效、新 session 可用和静态入口测试。

## 安全边界

- 重置码必须由管理员 session 生成。
- 重置码绑定手机号，一次性使用，30 分钟过期。
- 数据库只保存重置码 SHA-256 hash，不保存明文重置码。
- 明文重置码只在管理员生成接口响应中返回一次。
- 重置成功后撤销该手机号所有未撤销 session，避免旧 cookie 继续使用。
- 用户重置后自动建立新的 httpOnly account session。
- 密码强度继续复用现有规则：至少 8 位，包含英文大写字母、英文小写字母和数字。

## 验证

- `npm test -- test/shop-flow.test.js`：50 个测试通过。
- `npm test`：50 个测试通过。

## 说明

本次没有运行 `npm run build:css`，因为新增页面只使用已存在的 Tailwind utility class，未引入需要重新生成 CSS 的新样式类。
