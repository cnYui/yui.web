# Shop usage 历史补账脚本实施记录

## 背景

- 当前分支已新增 `lib/shop-usage-reconcile.js`，用于把历史 `usage_events` 按内部 nanos 价格补写扣费记录和账户流水。
- 补账属于账务写操作，`apply` 前必须先复制数据库备份，避免手工补账不可回退。

## 实施内容

- 新增 `scripts/shop-reconcile-usage-billing.js`：
  - 默认读取 `data/shop.sqlite`。
  - 支持 `--dry-run`，只输出待补账汇总。
  - 支持 `--apply`，先复制 `shop-before-usage-reconcile-<timestamp>.sqlite` 备份，再执行补账。
  - 导出 `backupShopDatabase`、`main`、`parseArgs`，便于测试。
- 补充 `test/shop-usage-reconcile.test.js`：
  - 验证 `dry-run` 不写数据库。
  - 验证 `apply` 后幂等扣费。
  - 验证 `apply` 前使用的备份函数会创建 sqlite 备份文件。

## 验证

- `node --test test/shop-usage-reconcile.test.js` 通过，2 个测试通过。

## 风险

- 脚本是手动运维入口，默认不会在服务启动时执行。
- `--apply` 会真实修改指定数据库，只能在确认 dry-run 结果后执行。
