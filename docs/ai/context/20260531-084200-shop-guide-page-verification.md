# 商店使用方法页验证

## 改动

- 商店首页新增灰色按钮“使用方法”，跳转 `/shop/guide/`。
- 新增 `/shop/guide/index.html`，只展示 Codex CLI 公网 API 配置说明。
- 公开说明页使用 `sk-xx` 占位，不包含真实 API key。

## 验证

- `npm test`：11 个测试全部通过。
- `npm run build:css`：构建完成。
- `curl http://localhost:4173/shop/`：能看到 `/shop/guide/` 和“使用方法”。
- `curl http://localhost:4173/shop/guide/`：能看到 `Codex 配置使用方法`、`https://api.aaccx.pw/v1`、`OPENAI_API_KEY` 和 `sk-xx`。
- 浏览器验证：从商店首页点击“使用方法”后进入 `/shop/guide/`，页面展示说明内容。
