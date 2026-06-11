# `/shop/login/` 透明人物背景图实施记录

## 已完成

- 使用 Pillow 从 `/Users/wujianxiang/Downloads/2080.PNG` 生成 `shop/assets/login/yui-login-bg.png`。
- 抠图算法只移除从画布边缘连通进入的近白色区域，避免误删主体内部白色衣领。
- PNG 输出为 RGBA，背景透明，边缘使用轻微高斯模糊柔化。
- `/shop/login/` 标题和 `<title>` 改为“这里是登录页面”。
- `js/lang.js` 不再把 `/shop/` 路由误判为作品集首页，避免浏览器标签标题被覆盖为 `Yui | Portfolio`。
- 登录页新增居中背景图层 `login-background-figure`，表单卡片使用半透明背景和 blur 保障可读性。
- 保留登录、重置密码和注册入口 DOM id，不改 `shop/shop.js`。

## 验证

- 新增测试覆盖标题、旧文案删除、背景图引用和 PNG RGBA 类型。
- 目标测试已通过：`node --test test/shop-flow.test.js --test-name-pattern '登录页使用新的小店文案并移除旧说明小字|登录页引用透明背景人物图作为居中背景|Shop 首页顶部不显示账号入口且正文只保留固定登录入口'`。

## 备注

- 背景图使用 `img` 元素而不是 CSS background，便于静态测试和浏览器调试。
- 如后续要更强的主体轮廓质量，可改成专用抠图模型；本次按用户要求使用代码完成。
