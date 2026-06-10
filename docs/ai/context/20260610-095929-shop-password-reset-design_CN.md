# Shop 忘记密码与一次性重置码设计

## 背景

当前 Shop 已有手机号密码注册、登录、账号 session、个人中心和管理员控制台。既有账号设计明确没有找回密码流程，用户忘记密码后只能依赖人工处理，不适合继续承接用户用量和账单能力。

本次补齐忘记密码功能，但不引入短信或邮件服务。采用管理员生成一次性重置码，线下发给用户，用户在登录页自助设置新密码。

## 目标

- `/shop/admin/` 增加生成一次性密码重置码的区域。
- 管理员输入手机号后生成一次性重置码，并线下发给用户。
- `/shop/login/` 增加“忘记密码？”入口和重置密码表单。
- 用户提交手机号、重置码、新密码、确认密码后完成密码重置。
- 重置成功后撤销该手机号旧 session，创建新 session，并进入 `/shop/account/`。
- 新密码复用现有强度规则：至少 8 位，包含英文大写字母、英文小写字母和数字。

## 非目标

- 不做短信验证码。
- 不做邮件找回。
- 不允许只凭手机号重置密码。
- 不新增公开管理员注册能力。
- 不改现有注册、登录、个人中心订单隔离和 API key 暴露边界。

## 推荐方案

采用“管理员后台生成码 + 用户登录页自助重置”：

1. 管理员登录 `/shop/admin/`。
2. 管理员输入用户手机号，请求后端生成一次性重置码。
3. 后端只保存重置码 hash，明文码只在响应中返回一次。
4. 管理员通过线下渠道把明文码发给用户。
5. 用户在 `/shop/login/` 切换到重置密码表单，提交手机号、重置码和新密码。
6. 后端校验手机号、重置码、过期时间和密码规则，更新密码，标记重置码已使用，撤销该用户旧 session，创建新 session。
7. 前端跳转 `/shop/account/`。

该方案不依赖外部供应商，适合当前私下开通和小范围 Shop 使用；安全边界比“只凭手机号重置”明确。

## 数据模型

新增 `password_reset_codes` 表：

- `id TEXT PRIMARY KEY`
- `phone TEXT NOT NULL`
- `code_hash TEXT NOT NULL UNIQUE`
- `created_at TEXT NOT NULL`
- `expires_at TEXT NOT NULL`
- `used_at TEXT`
- `created_by_phone TEXT NOT NULL`
- `FOREIGN KEY (phone) REFERENCES users(phone)`

索引：

- `idx_password_reset_codes_phone`：按手机号查找最近重置码。
- `idx_password_reset_codes_expires`：按过期时间清理或筛选。

重置码格式建议为 `RST-XXXXXX-XXXXXX`，便于人工传递。数据库只保存 SHA-256 hash，不保存明文。

## 后端接口

### `POST /api/admin/password-reset-codes`

调用者必须是管理员 session。

入参：

```json
{
  "phone": "13800138000"
}
```

行为：

- 校验手机号格式。
- 校验目标用户存在且已设置密码。
- 生成 30 分钟有效的一次性重置码。
- 保存 `code_hash`、手机号、创建时间、过期时间、管理员手机号。
- 返回明文重置码，仅返回一次。

错误：

- `INVALID_PHONE`：手机号格式不合法。
- `USER_NOT_FOUND`：手机号不存在或尚未注册密码。
- `ADMIN_ACCOUNT_REQUIRED`：非管理员。

### `POST /api/auth/password-reset`

公开接口，走现有 auth 限流。

入参：

```json
{
  "phone": "13800138000",
  "code": "RST-ABCDEF-123456",
  "password": "Abcdefg1",
  "confirmPassword": "Abcdefg1"
}
```

行为：

- 校验手机号格式。
- 校验密码强度和确认密码一致。
- 查找该手机号未使用、未过期、hash 匹配的重置码。
- 更新 `users.password_hash`、`password_created_at`、`updated_at`。
- 标记重置码 `used_at`。
- 撤销该手机号所有未撤销 session。
- 创建新的账号 session cookie。
- 返回公开用户信息。

错误：

- `INVALID_PHONE`：手机号格式不合法。
- `WEAK_PASSWORD`：密码不满足规则。
- `PASSWORD_MISMATCH`：两次密码不一致。
- `INVALID_RESET_CODE`：重置码错误、过期、已使用或手机号不匹配。

## 前端改动

### `/shop/admin/`

增加“生成密码重置码”区域：

- 手机号输入框。
- 生成按钮。
- 状态文案。
- 成功后展示一次性重置码和有效期提示。

该区域只生成码，不直接改密码。

### `/shop/login/`

在登录表单附近增加“忘记密码？”入口：

- 默认展示登录表单。
- 点击后切换到重置密码表单。
- 重置表单包含手机号、重置码、新密码、确认密码。
- 提供“返回登录”入口。
- 重置成功后跳转 `/shop/account/`。

## 安全边界

- 重置码必须由管理员 session 生成。
- 重置码绑定手机号，一次性使用，30 分钟过期。
- 数据库只存重置码 hash。
- 重置成功后撤销目标用户旧 session。
- 不允许通过公开注册创建管理员账号。
- `/api/account/me` 仍只按当前 session 手机号返回自己的订单，不返回完整 API key。
- 管理员生成码接口不返回用户密码、session 或 API key。

## 测试策略

新增 Node 测试覆盖：

- schema 存在 `password_reset_codes` 表和必要字段。
- 普通用户不能生成重置码，管理员可以生成。
- 非法手机号生成重置码返回 `INVALID_PHONE`。
- 不存在或未设置密码的手机号不能生成重置码。
- 生成码响应包含明文码，数据库不包含明文码。
- 用户使用错误码、过期码、已使用码重置失败。
- 弱密码和确认密码不一致重置失败。
- 重置成功后旧密码无法登录，新密码可以登录。
- 重置成功后旧 session 失效，新 session 可访问 `/api/account/me`。
- `/shop/admin/` 包含重置码生成表单。
- `/shop/login/` 包含忘记密码入口和重置表单。

## 自审

- 无占位符和未决项。
- 范围限定在 Shop 账号密码重置，不改短信、邮件和账单功能。
- 重置码不会只凭手机号生效，必须由管理员生成并匹配 hash。
- 用户选择了“重置成功后自动登录并进入个人中心”，设计与用户流程一致。
