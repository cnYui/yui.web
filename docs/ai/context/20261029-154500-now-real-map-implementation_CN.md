# 「此刻」改成真实地图（Leaflet + OpenStreetMap）

## 需求

用户看过「此刻」上线后的样子：行踪图是手绘风的旧图，城市小、看不出具体在哪。要求换成正常的地图，用开源免费的。

## 实现

- 地图库 Leaflet 1.9.4（BSD-2）自托管：`js/leaflet/leaflet.js`、`js/leaflet/LICENSE`、`styles/leaflet.css`。站点 CSP 是 `script-src 'self'`，不能走 CDN；目录不叫 `vendor`（Cloudflare 会 403）。去掉了 `leaflet.js` 末尾指向不存在的 `.map` 文件的注释。
- 瓦片用 OpenStreetMap 标准图层 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，地图右下角保留 `© OpenStreetMap` 署名（使用条款要求）。
- `server.js`：只有 `/travel` 开头的路径，CSP 的 `img-src` 多一个 `https://tile.openstreetmap.org`，其他页面不变。
- 瓦片图要带来源页，OSM 的使用规范会拒掉没有 Referer 的请求；站点默认 `Referrer-Policy: same-origin` 对跨站请求一个来源都不发，所以 `L.tileLayer` 加 `referrerPolicy: 'origin'`，只对这些图片放宽到只发 `https://aaccx.pw/`。
- `js/travel-now.js`：读到有效位置才加载 Leaflet（先 CSS、后脚本），再建地图：居中在位置上，缩放 4–11（默认 9），滚轮不缩放（留给页面滚动），手机上单指不拖动（留给页面滚动，双指可缩放）。位置点是金点 + 一圈 6 km 的虚线范围，因为服务端只存取整到 0.1°（约十公里）的坐标。库加载失败就只留下面那行「此刻在 福井市　四分钟前」。
- 删掉旧的墨卡托拟合常数、`COVERED` 遮挡区和对 `travel-map-v4.webp` 的引用；`.now-dot` 的金点和脉冲圈样式沿用。
- `styles/wabi.css`：地图块高 360px（窄屏 280px），瓦片图层用 CSS 灰度滤镜褪成灰，缩放按钮、署名条改成纸色。`leaflet.css` 是后加载的，同级选择器会输，所以样式都带 `.leaflet-container` 或 `.now-map`。
- 缓存键：`wabi.css` 在行旅页升到 `?v=20261029-7`，`travel-now.js` 升到 `?v=20261029-2`。

## 验证

- `npm test` 131/131 通过；`test/travel-now.test.js` 新增一条：脚本自托管、瓦片来源只在 `/travel/` 的 CSP 里、首页 CSP 不含 openstreetmap。
- 本地起服务、种一条福井市的位置，在内置浏览器里看：瓦片全部加载（`referrerpolicy=origin`），金点和范围圈落在福井市，窄屏无横向滚动。
- 窗口模拟缩放下能看到瓦片之间有一条细白缝，关掉 CSS 滤镜后仍在，不是样式造成的；没有在真机上确认。
