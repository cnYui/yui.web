# 商店服务重启修复记录

## 操作

1. 停止了原先由 TRAE 沙箱启动的 `node server.js` 进程。
2. 在 `/Users/wujianxiang/CodeSpace/yui.web` 下使用 `npm start` 重新启动服务。

## 当前状态

- 服务监听：`http://localhost:4173`
- 当前监听进程：`node server.js`
- 当前进程不再来自 `trae-sandbox exec`
- `/shop/redeem/` 返回 `200`
- SQLite 写入探针已通过：可以 `BEGIN IMMEDIATE`、写入临时探针表并 `ROLLBACK`

## 结论

此前 `attempt to write a readonly database` 的直接原因是服务运行环境导致 SQLite 写入失败。重启到普通项目运行环境后，数据库写入能力恢复。

## 注意

本次验证没有消耗兑换码 `YUI-CDA05B-DDF7D6`，也没有分配 API key。用户可以回到页面重新点击兑换。
