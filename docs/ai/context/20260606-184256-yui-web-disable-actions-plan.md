# yui.web 关闭 GitHub Actions 自动部署计划

## 背景

- 仓库：`cnYui/yui.web`
- 官网当前已改为本地反向代理并映射到正式域名，不再需要 GitHub Pages 自动部署。
- GitHub Actions 现有 workflow：
  - `Deploy to GitHub Pages`：来自 `.github/workflows/deploy.yml`，在 `main` push 和 PR 到 `main` 时触发。
  - `pages-build-deployment`：GitHub Pages legacy branch source 自动生成的部署 workflow。
- GitHub Pages 当前配置：`build_type=legacy`，source 为 `main:/`，自定义域名为 `aaccx.pw`。

## 设计

推荐方案：远端禁用 workflow，不删除 GitHub Pages 配置，也不修改网站源码。

原因：

- 禁用 workflow 可以立即停止自动化运行，满足“关闭 Action”的目标。
- 保留 Pages 配置便于未来回滚；删除 Pages 会影响自定义域名和历史部署状态，风险更高。
- 修改 YAML 例如删除 `on:` 触发条件需要提交代码，且仍不能处理 `pages-build-deployment` 这条系统 workflow。

备选方案：

- 修改 `.github/workflows/deploy.yml`：适合长期用代码表达 CI 策略，但需要提交并推送。
- 删除 GitHub Pages 配置：能彻底停止 Pages 部署，但会改变官网托管配置，当前不需要。

## 执行计划

1. 禁用 `Deploy to GitHub Pages` workflow。
2. 尝试禁用 `pages-build-deployment` workflow。
3. 如果 GitHub 拒绝单独禁用 `pages-build-deployment`，关闭仓库级 Actions 权限，保留 Pages 配置。
4. 重新查询 workflow 和 Actions 权限状态，确认后续不会自动运行。
5. 不改网站源码，不删除 GitHub Pages 配置。

## 执行记录

- `Deploy to GitHub Pages` 已成功禁用为 `disabled_manually`。
- `pages-build-deployment` 单独禁用失败，GitHub 返回 `HTTP 422: Unable to disable this workflow`。
- 根因：`pages-build-deployment` 是 GitHub Pages legacy source 生成的系统 workflow，不能像普通 workflow 一样单独关闭。
- 后续动作：已关闭仓库级 Actions 权限，避免删除 Pages 配置带来的额外风险。

## 最终状态

- 仓库 Actions 权限：`enabled=false`。
- `Deploy to GitHub Pages`：`disabled_manually`。
- `pages-build-deployment`：仍显示 `active`，但它是 GitHub Pages 系统 workflow，不能单独禁用；仓库级 Actions 已关闭。
- GitHub Pages 配置仍保留：`build_type=legacy`，source 为 `main:/`，自定义域名为 `aaccx.pw`。

## 验证

使用以下命令验证：

```bash
gh workflow list --repo cnYui/yui.web --all
gh api repos/cnYui/yui.web/actions/workflows --jq '.workflows[] | {id,name,state,path}'
gh api repos/cnYui/yui.web/actions/permissions --jq '.'
```
