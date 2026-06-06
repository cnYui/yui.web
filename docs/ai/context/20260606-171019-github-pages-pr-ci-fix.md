# GitHub Pages PR CI 修复记录

## 现象

PR `#1` 的 `Deploy to GitHub Pages / deploy` check 在 `pull_request` 事件上 1 秒失败，job 没有 runner、steps 和日志。

## 根因

workflow 在 `pull_request` 上直接运行 GitHub Pages 部署 job，并绑定 `github-pages` environment。PR 分支不应该执行真实部署，环境保护会在 runner 启动前拒绝该 job，因此日志为空。

## 修复

- 新增 `validate` job，在 PR 和 main push 上运行：
  - `npm ci`
  - `npm test`
  - `npm run build:css`
- `deploy` job 增加条件：
  - 只在 `github.event_name == 'push'`
  - 且 `github.ref == 'refs/heads/main'`
- `deploy` 依赖 `validate`，避免未验证就部署 main。

## 取舍

GitHub Pages 仍然只适合静态站点部署；Shop 的 API 和 SQLite 运行依赖 Node 服务，生产链路以 `cloudflared -> nginx -> node:4173` 为准。
