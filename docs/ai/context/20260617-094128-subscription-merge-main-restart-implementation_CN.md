# 订阅池分支合并 main 与公网服务重启实施记录

## 实施范围

- 将 `codex/subscription-pool-pricing-design` 合并到 `main`。
- 保留真实库已完成的订阅池迁移结果，不重复 apply。
- 重启监听 `4173` 的公网 yui.web 服务，使线上使用新的订阅池美元计费策略。

## 合并处理

- 合并前订阅池 worktree 验证：
  - `npm test`：193/193 通过。
  - `git diff --check`：无输出。
- 主工作区合并前存在未提交本地状态，已用 stash 保护后执行 `git merge --no-ff codex/subscription-pool-pricing-design`。
- stash 恢复时冲突文件：
  - `AGENTS.md`：保留精简归档入口，并补充订阅池、迁移和本次上线关键记忆。
  - `test/shop-flow.test.js`：保留订阅池语义，即托管 API key 没有有效订阅时返回 `subscription_required`。
- 已推送远端：`origin/main` 从 `9844cce` 更新到 `b6c08ff`。

## 验证结果

- `npm run build:css`：通过，仅有 Browserslist/caniuse-lite 过期提示。
- `npm test`：193/193 通过。
- `git diff --check`：无输出。
- 真实库 dry-run：
  - `skippedExistingSubscriptions: 10`
  - `createdSubscriptions: 0`
  - `createdOrders: 0`
  - `activeNonWhitelistSubscriptions: []`
  - `missingUsers: []`
- 真实库只读查询：
  - active 订阅数为 10。
  - 10 条均为 `sub_29_daily_19_usd`。
  - 有效期均为 `2026-06-17T00:00:00+08:00` 到 `2026-07-17T00:00:00+08:00`。
  - `api_usd_charge_records` 仍为 0。

## 服务重启

- 重启前公网实例：
  - PID `98539`
  - cwd `/Users/wujianxiang/CodeSpace/yui.web`
  - 监听 `*:4173`
- 已终止旧 PID 并从主工作区重新启动 `node server.js`。
- 重启后公网实例：
  - PID `39051`
  - cwd `/Users/wujianxiang/CodeSpace/yui.web`
  - 监听 `*:4173`
  - 日志 `/tmp/yui-web-4173.log`
- `4174` 仍是订阅池 worktree 预览实例，未触碰。

## 线上检查

- `http://127.0.0.1:4173/shop/login/` 返回 200。
- 未登录访问 `http://127.0.0.1:4173/shop/account/` 返回 302 到 `/shop/login/`。
- `https://aaccx.pw/shop/login/` 返回 200。
- `https://aaccx.pw/shop/js/account.js` 已包含订阅池 Account 逻辑，包括套餐、加量包、退款和额度条相关代码。
- 内部 API key 状态接口抽查白名单用户返回：
  - HTTP 200
  - `active: true`
  - `status: active`
  - 每日额度 `19000000` USD micros，即 `$19`
  - `quotaDate: 2026-06-17`

## 遗留说明

- 主工作区仍保留合并前已有的本地未提交状态：`.env.example`、`server.js`、`AGENTS.md` 以及一批历史 `docs/ai/context` 删除状态。它们没有被本次推送提交到远端。
- `stash@{0}` 仍保留为合并前主工作区脏状态备份，便于需要时回看原始本地状态。
