# Shop API key 静态加密实施记录

## 背景

- Shop 原始实现会在 `api_keys.api_key` 和 `orders.api_key` 保存完整 API key 明文。
- 完整安全修复计划要求支持 API key 静态加密，同时保留旧明文数据兼容读取。

## 实施内容

- 新增 `lib/shop-api-key-crypto.js`：
  - 统一 `hashApiKey` 和 `keyPreview` 语义。
  - 使用 AES-256-GCM 生成 `api_key_ciphertext` 和 `api_key_nonce`。
  - `readStoredApiKey` 优先解密密文，旧记录回退读取明文。
- `server.js` 支持 `SHOP_API_KEY_ENCRYPTION_SECRET` 或 `createShopApp({ apiKeyEncryptionSecret })`：
  - 配置 secret 后，新导入 API key 不再把明文写入 `api_key`。
  - `api_key` 保存非敏感唯一占位 `enc_<api_key_hash>`，避免旧唯一键在多条密文 key 下冲突。
  - `api_keys` 和 `orders` 新增 `api_key_ciphertext`、`api_key_nonce` 迁移列。
  - 兑换、账户 reveal、内部 API key status 都走 hash 查找和密文解密。
- 新增 `scripts/shop-encrypt-api-keys.js`：
  - 默认 dry-run 统计旧明文和已加密记录。
  - dry-run 兼容尚未添加 `api_key_ciphertext` / `api_key_nonce` 的旧数据库 schema，不会为了统计修改库结构。
  - `--apply` 前自动复制数据库备份，备份文件命名为 `shop-before-api-key-encryption-<timestamp>.sqlite`。
  - apply 时把旧明文 `api_key` 列替换为 `enc_<hash>`，并写入密文和 nonce。

## 验证

- `node --test lib/shop-api-key-crypto.test.js` 通过，6 个测试通过。
- `npm test -- --test-name-pattern "API key 加密|hash 查找|密文|不依赖明文|加密迁移"` 通过，123 个测试通过。
- `SHOP_API_KEY_ENCRYPTION_SECRET=... node scripts/shop-encrypt-api-keys.js --dry-run --db data/shop.sqlite` 通过，只读结果：
  - `apiKeys.plaintextRows`: 8
  - `apiKeys.encryptedRows`: 0
  - `orders.plaintextRows`: 6
  - `orders.encryptedRows`: 0

## 风险与约束

- 生产启用密文存储前必须配置 `SHOP_API_KEY_ENCRYPTION_SECRET`，长度至少 32 个字符。
- 已加密记录需要同一个 secret 才能 reveal 完整 API key。
- 旧明文迁移脚本是手动运维入口，执行 `--apply` 前必须先确认 dry-run 结果。
- 本次未对真实库执行 `--apply`。
