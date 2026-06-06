# 商店使用说明 Bearer 鉴权更新

## 背景

用户把 `/shop/guide/` 中的说明发给另一个 AI 修改 Codex 配置后，客户端请求公网 `/v1/responses` 返回 `401 Invalid API key`。本机和公网 `/v1/models` 已验证对应 API key 可用，因此问题更可能是客户端没有按 `Authorization: Bearer <key>` 方式发送，或实际写入的 key 不正确。

## 修改

- 使用说明明确写入：公网 API 只接受 `Authorization: Bearer <API Key>`。
- 去掉“修改环境变量文件”这类容易让 AI 改错位置的表达。
- 强调不要把 key 放在 URL、query、`x-api-key` 或其他 header 中。
- 保留 `auth.json` 的 `OPENAI_API_KEY` 配置方式，因为 Codex CLI 会从该文件读取 key 并组装 Bearer 请求。

## 验证

更新 `test/shop-flow.test.js`，确保公开说明页包含 Bearer 鉴权要求，且不出现 `sk-dummy` 或“环境变量文件”。
