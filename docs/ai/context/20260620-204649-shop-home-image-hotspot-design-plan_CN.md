# Shop 首页图片热区入口设计计划

## 背景

用户希望 `/shop/` 删除当前页面内可见文字和按钮，只把 `/Users/wujianxiang/Downloads/2155.PNG` 作为页面背景图，并让图片中间原本绘制好的“点击进入”按钮具备跳转功能。跳转目标沿用当前 Shop 首页的 Sub2API 公网入口配置，默认是 `https://aaccx.pw/dashboard`。

## 必须满足

- 页面视觉主体完全来自一张图片，不再显示 `天才程序员中转站入口` 或 `进入 Sub2API` 等 HTML 文案。
- 图片中间的“点击进入”区域仍可交互，点击后跳转到 Sub2API 公网入口。
- 服务端 `renderShopHomePage` 继续通过 `data-sub2api-link` 注入 `SUB2API_PUBLIC_URL`。
- 保持 Shop 首页公开访问；已登录用户访问 `/shop/` 仍停留入口页。
- 不恢复旧购买、兑换、查询或使用说明入口。

## 方案

采用“真实图片 + 透明热区链接”：

- 将图片转为高质量 WebP 并放到项目资产目录 `images/shop/code-transit-entry.webp`，避免首页首屏加载 7MB 级 PNG。
- `shop/index.html` 的正文改为全屏图片场景，使用 `<img>` 呈现背景，避免 CSS 背景图在测试和可访问性上不可见。
- 在图片中心覆盖一个透明 `<a>`，保留 `data-sub2api-link`，默认 `href="/dashboard"`，运行服务端时替换为配置后的公网地址。
- 链接使用 `aria-label="进入 Sub2API"`，不放可见文字；键盘聚焦时只显示细边框，原因是完全无焦点反馈会降低可访问性。

## 取舍

- 不让整张图片都可点击，避免误触，也更符合“图片中的按钮可交互”的语义。
- 不用 HTML/CSS 重做按钮，避免和图片内按钮产生视觉偏差。
- 桌面和移动端都使用 `object-fit: cover` 铺满视口；小屏会裁切图片边缘，但中心按钮保持在热区范围内。

## 涉及文件

- `shop/index.html`：删除旧导航和文案，保留全屏图片与透明跳转热区。
- `images/shop/code-transit-entry.webp`：新增 Shop 首页背景图资产。
- `test/shop-frontend.test.js`：改为断言图片入口、透明热区、旧文案移除。
- `test/shop-flow.test.js`：改为断言服务端返回图片入口且配置链接注入仍生效。

## TDD 计划

1. 修改 `test/shop-frontend.test.js` 中 Shop 首页相关断言，要求背景图片存在、`data-sub2api-link` 唯一、旧可见文字不存在。
2. 修改 `test/shop-flow.test.js` 中服务端首页断言，要求响应包含图片资产和热区链接，而不是旧标题文案。
3. 运行相关测试，确认因当前实现仍是旧文案页面而失败。
4. 将图片资产转为 WebP 并保存到 `images/shop/code-transit-entry.webp`。
5. 修改 `shop/index.html` 为全屏图片 + 透明热区。
6. 运行 `node --test test/shop-frontend.test.js test/shop-flow.test.js`。
7. 如需视觉确认，启动本地服务并截图检查首页是否渲染图片、中心热区可点击。

## 验证标准

- `node --test test/shop-frontend.test.js` 通过。
- `node --test test/shop-flow.test.js` 通过。
- `/shop/` HTML 不包含旧首页可见文案。
- `/shop/` 只有一个 `data-sub2api-link`，并可被服务端替换成配置的 Sub2API 公网地址。
