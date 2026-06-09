# Shop Usage Monitoring MVP Implementation

## 背景

本次实现 `yui.web` Shop 管理员用量监控 MVP。`CLIProxyAPI` 负责生成 usage event；`yui.web` 负责安全接收、SQLite 持久化、管理员聚合展示和手动 JSONL 补导。

## 改动范围

- 修改 `server.js`
  - `api_keys` 增加 `api_key_hash` 迁移和回填。
  - 新增 `usage_events` 原始流水表和索引。
  - 新增 `POST /api/internal/usage-events`。
    - 使用 `x-internal-token` 鉴权。
    - 使用 `x-usage-timestamp` 和 `x-usage-signature` 做 HMAC 校验。
    - 以 `request_id` 幂等写入。
  - 新增 `GET /api/admin/usage-summary`。
    - 管理员 token 鉴权。
    - 返回今日、本月、总计 token/request。
    - Shop key 通过 `api_key_hash` 关联手机号、状态、到期时间。
    - 未匹配到 Shop 的 hash 标记为 `unmanaged`。
    - 返回模型拆分、成功/失败/总请求数、last_seen_at。
  - 新增 `POST /api/admin/usage-imports`。
    - 管理员 token 鉴权。
    - 从 `CLIPROXY_USAGE_LOG_DIR/usage-events-YYYY-MM.jsonl` 导入。
    - 只接受 `YYYY-MM`。
    - 每行独立处理，重复 request_id 跳过，非法行计入 `failed_lines`。
- 修改 `.env.example`
  - 增加 `INTERNAL_TOKEN`、`USAGE_EVENT_HMAC_SECRET`、`CLIPROXY_USAGE_LOG_DIR`。
- 修改 `shop/admin/index.html`
  - 增加用量监控区域。
  - 增加 group/status/q 筛选。
  - 增加 JSONL 导入表单。
- 修改 `shop/shop.js`
  - 增加 usage summary 渲染、表格渲染、刷新、筛选和导入逻辑。
  - 保持原邀请码生成流程。
- 修改 `test/shop-flow.test.js`
  - 覆盖 schema、HMAC 接收、幂等写入、summary 聚合、JSONL 导入、admin UI 静态控件。

## 验证

通过：

```bash
node --test test/shop-flow.test.js
```

结果：26 个测试全部通过。

## 安全边界

- `usage_events` 不保存完整 API key，只保存 `api_key_hash` 和 preview。
- 内部写入接口必须同时通过 internal token、timestamp、HMAC。
- 管理员 summary 不返回完整 API key。
- JSONL 导入只读取配置目录下固定文件名。
- 不记录 prompt、response body、客户端 IP。
