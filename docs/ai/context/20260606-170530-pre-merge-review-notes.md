# 合并前 Review 记录

## 已修复问题

- 后台页面仍尝试渲染 `invite.apiKey`，但当前设计已经拆分为“先导入 API key 库存，兑换时分配未使用 key”。
- 修复方式：后台生成邀请码结果只展示邀请码，页面文案同步为兑换时从库存分配。
- 测试补充：`后台生成邀请码页面不渲染已经拆分的 API key 字段`。

## 安全边界复核

- `superpowers/` 是外部嵌套 Git 仓库，本次排除并加入 `.gitignore`。
- `.env` 继续忽略，`.env.example` 只包含占位配置。
- `/data`、`/.env`、`/docs/ai` 的静态访问本地返回 404。
- `trust proxy = 1` 与当前 `cloudflared -> nginx -> node:4173` 部署链路匹配，本次不改默认。

## 已知非阻塞风险

- 手机号查询仍返回完整 API key，这是既有业务取舍，安全审计文档已记录为产品级风险。
- 如后续要降低泄露面，优先把手机号查询改为只返回 masked key，并把完整 key 限定在 result token 会话页或二次验证后展示。

## 验证补充

- `npm test`：21 个测试通过。
- `npm run build:css`：构建成功，仅提示 Browserslist 数据可更新。
- 内置浏览器验证被浏览器 URL 策略阻断，已改用本地 HTTP 请求验证关键页面和敏感路径。
