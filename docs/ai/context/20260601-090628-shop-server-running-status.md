# 商店服务运行状态确认

## 状态

`yui.web` 商店服务已成功重启并监听：

```text
http://localhost:4173
```

## 验证

- `lsof -nP -iTCP:4173 -sTCP:LISTEN` 显示 `node` 进程正在监听 4173。
- 当前进程是普通 `node server.js`，进程列表中没有 `trae-sandbox exec`。
- `GET /shop/redeem/` 返回 `200`。
- 日志显示 `Yui web shop server listening on http://localhost:4173`。

## 当前进程

```text
PID: 88897
Command: node server.js
```
