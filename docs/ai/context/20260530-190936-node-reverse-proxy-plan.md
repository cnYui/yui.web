# aaccx.pw 整站反代到 Node 计划

## 背景

当前公网链路为 Cloudflare Tunnel -> nginx `8080` -> Python 静态服务 `8318`。Shop 模块已经需要 Node API 和 SQLite，因此用户确认将整个站点反代到 Node `4173`，减少静态服务和 API 服务拆分带来的维护成本。

## 修改方案

- Express 保持服务静态文件和 `/api/*`。
- 在 Express 中补充 `.html` fallback，让 `/blog/article?id=...` 等无后缀路径仍可访问对应 `.html` 文件。
- 修改 `/opt/homebrew/etc/nginx/servers/aaccx-root.conf`：
  - `proxy_pass http://127.0.0.1:8318` 改为 `proxy_pass http://127.0.0.1:4173`
- reload nginx。
- 用公网 `https://aaccx.pw` 验证静态页和 `/api/*`。

## 风险

- `/chunchao/` 仍由 nginx alias 单独处理，不受 Node 影响。
- 旧的 Python 静态服务可以保留或后续停止；反代切换后不再依赖它。
