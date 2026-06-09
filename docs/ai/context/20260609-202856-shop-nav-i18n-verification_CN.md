# Shop 顶部导航多语言验证记录

## 改动

- `js/lang.js` 的公共导航翻译新增 `shop`：
  - 中文：`商店`
  - 英文：`Shop`
  - 日文：`ショップ`
- `updateCommonElements()` 新增 `/shop` 链接识别，让桌面和移动端顶部导航都跟随语言切换。
- `test/shop-flow.test.js` 新增静态测试，防止公共导航遗漏 Shop 翻译。

## 验证

- `node --test --test-name-pattern '公共顶部导航支持 Shop 的中英日翻译' test/shop-flow.test.js`
- `npm test`
- 用 Node 模拟 DOM 执行 `js/lang.js`，确认 `/shop/` 导航在 `zh` 下显示 `商店`，在 `ja` 下显示 `ショップ`。

## 运行状态

本机 `4173` 端口已有 Node 服务监听，未重复启动服务。
