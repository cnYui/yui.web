# 商店兑换 SQLite 只读错误诊断

## 现象

shop 兑换页提交手机号和兑换码后，后端返回：

```text
attempt to write a readonly database
```

## 结论

这不是兑换码不存在，也不是 API key 池耗尽。接口已经进入写入订单的阶段，但 SQLite 写入失败。

当前本地文件权限检查结果：

- `data/` 属主是 `wujianxiang`，权限是 `755`。
- `data/shop.sqlite`、`data/shop.sqlite-wal`、`data/shop.sqlite-shm` 属主是 `wujianxiang`，权限是 `644`。
- `PRAGMA query_only` 为 `0`。
- `api_keys` 还有 7 个 `unused` key。

当前 `node server.js` 进程由 `TRAE SOLO.app` 的 `trae-sandbox exec` 启动。虽然系统用户是 `wujianxiang`，但运行时沙箱可能把项目文件写入限制为只读，导致 SQLite 在兑换事务中无法写订单、更新兑换码和标记 API key 已使用。

## 建议

短期修复：

1. 停掉 TRAE 里启动的 `node server.js`。
2. 在普通终端或 Codex 允许写工作区的环境里从 `/Users/wujianxiang/CodeSpace/yui.web` 启动：

```bash
npm start
```

备选修复：

- 把 SQLite 数据库路径改到运行时明确可写的位置，并通过环境变量配置。
- 不建议只改前端或跳过写库，因为兑换必须原子写入订单、邀请码状态和 API key 状态。
