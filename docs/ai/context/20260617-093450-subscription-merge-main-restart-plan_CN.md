# 订阅池分支合并与公网服务重启计划

## 背景

用户要求把 `codex/subscription-pool-pricing-design` 分支中的订阅池计费系统合并到 `main`，并重启当前公网服务，让线上使用新的美元订阅池扣费策略。

真实库 `data/shop.sqlite` 已在订阅池分支实施阶段完成老用户迁移：10 个确认手机号开通 `sub_29_daily_19_usd`，从 2026-06-17 东八区 0 点起算 30 天；其他用户无套餐。

## 必须保留的约束

- 不覆盖主工作区已有未提交改动，尤其是 `.env.example`、`AGENTS.md`、`server.js`、测试文件和历史文档删除状态。
- 合并代码前先保护主工作区脏状态，合并后根据冲突逐项恢复有价值改动。
- 不重新计算历史人民币扣费；新策略上线后按订阅池美元额度扣减。
- 真实库只做 dry-run 校验，不重复 apply 老用户迁移。

## 执行计划

1. 使用可恢复的 git stash 保存主工作区当前未提交状态。
2. 合并 `codex/subscription-pool-pricing-design` 到 `main`。
3. 恢复 stash，遇到冲突时保留订阅池计费主逻辑，同时保留主工作区本地改动的有效意图。
4. 运行 `npm test`、`npm run build:css`、`git diff --check`。
5. 对真实库运行 `scripts/shop-migrate-subscription-legacy-users.js --dry-run`，期望不再创建新订阅，只显示 10 个白名单已存在。
6. 确认当前公网服务进程的端口与工作目录，重启到合并后的 `main`。
7. 通过本地 HTTP 请求和数据库查询验证服务已使用新代码和新计费数据。

## 风险处理

- 如果 stash 恢复产生历史文档大量删除，不把这些删除作为本次上线必需内容；以不破坏订阅池新增文档为优先。
- 如果测试失败，按错误定位根因后再继续重启，不带失败状态上线。
- 如果存在多个 Node 服务进程，只重启监听公网 Shop 端口且 cwd 为 `/Users/wujianxiang/CodeSpace/yui.web` 的进程。
