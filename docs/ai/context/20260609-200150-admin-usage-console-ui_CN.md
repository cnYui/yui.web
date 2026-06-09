# 管理员用量控制台页面调整记录

## 背景

`/shop/admin/` 原来同时承担“生成邀请码”和“用量监控”。用户指出这会让页面语义混乱：管理员页面应该像管理员登录/解锁入口，没有管理员口令不能查看全局用量；邀请码生成不准备做前端页面，只保留后端能力。

后续最终边界见 `20260609-201315-admin-account-session-boundary_CN.md`：管理员页面不再使用前端管理员口令输入框，而是要求唯一管理员手机号登录 session。

## 调整

- `/shop/admin/` 标题从“生成邀请码”调整为“管理员控制台”。
- 移除前端的邀请码生成表单、数量输入框、生成按钮和结果展示区域。
- `shop/shop.js` 的 `initAdminPage()` 不再调用 `/api/admin/invites`。
- 前端不再展示管理员口令输入框和“解锁用量监控”按钮。
- 用量监控最终通过唯一管理员账号 session 访问；后端 `x-admin-token` 仍保留给脚本或后端管理使用。
- `POST /api/admin/invites` 后端接口保留，用于后端或脚本管理，不展示在前端。
- Admin 页 `shop.js` 版本参数更新为 `20260609-admin-session`，避免浏览器继续使用旧脚本。

## 日志导入说明

日志导入读取 yui.web `.env` 中的 `CLIPROXY_USAGE_LOG_DIR`。

本机预期路径是：

```text
/Users/wujianxiang/CodeSpace/CLIProxyAPI/logs/usage
```

CLIProxyAPI 会在这个目录写月度 JSONL：

```text
usage-events-YYYY-MM.jsonl
```

例如 2026 年 6 月对应：

```text
/Users/wujianxiang/CodeSpace/CLIProxyAPI/logs/usage/usage-events-2026-06.jsonl
```

这个导入入口用于补账：如果 yui.web 实时同步因为重启、网络或配置问题漏了 event，可以按月份从本地 JSONL 重新导入。`request_id` 是主键，重复导入会跳过已存在记录。

## 验证目标

- 页面不出现“生成邀请码”、`adminInviteForm`、`inviteCountInput`、`adminResult`。
- 页面出现“管理员控制台”和管理员账号登录说明。
- 页面不出现“管理员口令”“解锁用量监控”。
- 页面说明 CLIProxyAPI 日志目录和 `usage-events-YYYY-MM.jsonl` 文件。
- 测试覆盖前端不再调用 `/api/admin/invites`。

## 验证结果

- `npm test`：37 个测试通过。
- `npm run build:css`：构建成功；仅出现 Browserslist/caniuse-lite 过期提示。
