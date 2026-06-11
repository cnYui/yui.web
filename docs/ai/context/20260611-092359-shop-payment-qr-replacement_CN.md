# 个人中心付款码替换计划

## 背景

个人用户中心 `/shop/account/` 的充值区域通过后端账户余额接口返回付款码 URL。当前默认 URL 是：

- 支付宝：`/shop/assets/pay/alipay-qr.png`
- 微信：`/shop/assets/pay/wechat-qr.png`

仓库里没有这两个静态资源文件，浏览器显示为破图。

## 设计

沿用 `server.js` 里已有默认配置，不修改页面结构、接口协议或环境变量。只补齐默认 URL 对应的静态资源，避免引入额外部署配置。

图片映射：

- `IMG_8268.JPG` 转为 `shop/assets/pay/alipay-qr.png`
- `IMG_8442.JPG` 转为 `shop/assets/pay/wechat-qr.png`

源文件是 JPEG，目标文件扩展名是 `.png`，因此需要做真实 PNG 转换，而不是直接复制改名。这样静态服务的 MIME 类型和文件内容一致。

## 实施步骤

1. 先运行文件存在性检查，确认当前两个默认资源缺失。
2. 创建 `shop/assets/pay/`。
3. 使用系统图片工具把两张 JPEG 转为 PNG，并写入默认路径。
4. 运行文件类型检查，确认目标文件是真实 PNG。
5. 运行相关测试，确认默认付款码 URL 和账户接口行为未被破坏。

## 验证

已执行红灯检查：

```bash
test -f shop/assets/pay/alipay-qr.png && test -f shop/assets/pay/wechat-qr.png
```

结果：退出码 `1`，说明两个默认资源尚未补齐。

已执行绿灯检查：

```bash
file shop/assets/pay/alipay-qr.png shop/assets/pay/wechat-qr.png
ls -lh shop/assets/pay/alipay-qr.png shop/assets/pay/wechat-qr.png
test -f shop/assets/pay/alipay-qr.png && test -f shop/assets/pay/wechat-qr.png
```

结果：

- `shop/assets/pay/alipay-qr.png` 是 `PNG image data, 1708 x 2560`。
- `shop/assets/pay/wechat-qr.png` 是 `PNG image data, 828 x 1124`。
- 文件存在性检查退出码 `0`。

已执行项目测试：

```bash
npm test
```

结果：`79` 个测试全部通过，`fail 0`。

已执行本地 HTTP 静态访问验证：

```bash
node <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createShopApp } = require('./server');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-pay-qr-'));
const { app, db } = createShopApp({
  dbPath: path.join(tmp, 'shop.sqlite'),
  adminToken: 'test-admin-token',
  internalApiToken: 'test-internal-token',
  usageHmacSecret: 'test-usage-hmac-secret'
});
const server = app.listen(0, async () => {
  // 请求 /shop/assets/pay/alipay-qr.png 和 /shop/assets/pay/wechat-qr.png
});
NODE
```

结果：

- `/shop/assets/pay/alipay-qr.png status=200 type=image/png bytes=627263 png=true`
- `/shop/assets/pay/wechat-qr.png status=200 type=image/png bytes=242826 png=true`

现有本地服务验证：

```bash
curl -I http://127.0.0.1:4173/shop/assets/pay/alipay-qr.png
curl -I http://127.0.0.1:4173/shop/assets/pay/wechat-qr.png
```

结果：两个 URL 都返回 `HTTP/1.1 200 OK`，`Content-Type: image/png`。
