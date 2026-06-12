# Shop 真实库 usage 补账与 API key 加密迁移执行记录

## 执行背景

- 用户确认执行真实库操作。
- 目标数据库：`data/shop.sqlite`
- 执行时间：2026-06-11 20:17-20:22

## 执行前状态

- fresh usage dry-run：
  - `updatedUsageBreakdowns`: 1030
  - `createdCharges`: 576
  - `adjustedUnpricedCharges`: 454
  - `skippedFailed`: 117
  - `skippedUnowned`: 0
  - `totalChargeNanos`: 32870254600
- API key 加密 dry-run：
  - `api_keys.plaintextRows`: 8
  - `orders.plaintextRows`: 6

## 备份

- usage 执行前 online backup：
  - `data/backups/shop-before-real-ops-online-20260611-201736.sqlite`
- usage 脚本备份：
  - `data/backups/shop-before-usage-reconcile-20260611-201913.sqlite`
- API key 加密执行前 online backup：
  - `data/backups/shop-before-api-key-encryption-online-20260611-202129.sqlite`
- API key 加密脚本备份：
  - `data/backups/shop-before-api-key-encryption-20260611-202129.sqlite`
- `.env` 加密 secret 写入前备份：
  - `data/backups/env-before-api-key-encryption-20260611-202037`

## 中途问题与修复

- 第一次 usage `--apply` 失败：
  - 错误：`SQLITE_CONSTRAINT_PRIMARYKEY`
  - 原因：历史补账一次事务内批量写入 576 条新扣费，旧 `Date.now() + random 4 位` id 存在碰撞风险。
  - 结果：SQLite transaction 回滚，dry-run 仍显示待处理项，未发生部分补账。
- 修复：
  - `lib/shop-usage-reconcile.js` 的补账 charge/ledger id 改为基于 `request_id` 的 SHA-256 派生稳定 id。
  - 新增测试覆盖固定时间和固定随机数下批量补账不撞主键。
  - `test/shop-flow.test.js` 显式让普通测试默认不继承 `.env` 的 `SHOP_API_KEY_ENCRYPTION_SECRET`，避免真实配置影响测试基线。

## apply 结果

### usage 补账

命令：

```bash
node scripts/shop-reconcile-usage-billing.js --apply --db data/shop.sqlite
```

结果：

- `updatedUsageBreakdowns`: 1030
- `createdCharges`: 576
- `adjustedUnpricedCharges`: 454
- `skippedFailed`: 117
- `skippedUnowned`: 0
- `totalChargeNanos`: 32870254600
- 分手机号扣费：
  - `15951875192`: 30082271400
  - `13584052801`: 1610539400
  - `15062376174`: 598872400
  - `13052071067`: 578571400

apply 后 dry-run：

- `updatedUsageBreakdowns`: 0
- `createdCharges`: 0
- `adjustedUnpricedCharges`: 0
- `totalChargeNanos`: 0

### API key 加密迁移

- 已生成并写入本地 `.env`：`SHOP_API_KEY_ENCRYPTION_SECRET`
- 不记录 secret 明文；本次 secret SHA-256 指纹前 16 位：`79c09541b842d2c1`

命令：

```bash
node -r dotenv/config scripts/shop-encrypt-api-keys.js --apply --db data/shop.sqlite
```

结果：

- `updatedApiKeys`: 8
- `updatedOrders`: 6

apply 后 dry-run：

- `apiKeys.plaintextRows`: 0
- `apiKeys.encryptedRows`: 8
- `orders.plaintextRows`: 0
- `orders.encryptedRows`: 6

密文验证：

- `apiPlaintextRows`: 0
- `orderPlaintextRows`: 0
- `apiKeyDecryptOk`: 8
- `orderDecryptOk`: 6

## 服务状态

- `http://127.0.0.1:4173/shop/login/` 返回 200。
- `http://127.0.0.1:4173/api/admin/usage-summary` 使用当前 `.env` 管理员 token 返回 200。
- 4174 / 4175 曾存在旧本地服务；维护后主服务 4173 可用，不再强行保留额外副本。

## 验证

- `node --test test/shop-usage-reconcile.test.js`：通过。
- `npm test`：通过，126 个测试通过。

## 注意事项

- `.env` 已新增 `SHOP_API_KEY_ENCRYPTION_SECRET`，不要删除或替换；否则已加密 API key 无法 reveal。
- `data/shop.sqlite` 和 `data/backups/` 被 git 忽略，不应提交。
