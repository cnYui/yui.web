# 行旅页「此刻」：iPhone 推城市级位置

## 需求

用户看到别人主页上的「活动地点与行程」地图，想在自己的站上展示实时位置，用手机发定位。定下来的三件事：

- 手机是 iPhone。
- 只公开到城市级。
- 在现有的行踪图（旧线索墙的 `travel-map-v4`）上打点，不用高德之类的瓦片地图。

## 实现

- `lib/now-location.js`：校验口令、解析坐标（数字或文本，逗号小数点也收）、坐标四舍五入到 0.1°（约十公里）后写 `data/now-location.json`，先写临时文件再改名。原始坐标不落盘。
- `server.js`：`GET /travel/now` 公开读（`Cache-Control: public, max-age=60`），`POST /travel/now` 要 `Authorization: Bearer <NOW_LOCATION_TOKEN>`，错八次限流十分钟。路径挂在 `/travel/` 下，cloudflared 已经转给 yui.web，不用改 tunnel，也不碰 Sub2API。
- `js/travel-now.js` + `travel/index.html`：照片列表上方的「此刻」，默认 `hidden`，读到有效位置才显示。行踪图用 CSS 褪成墨色（`grayscale + contrast + brightness`，`mix-blend-mode: multiply`），只有当前位置一个金点。
- 投影：行踪图源图 2600 × 1400，墨卡托。用重庆、冲绳、广岛、福井四个标记点拟合 `x = a + b·经度`、`y = c − b·ln(tan(π/4 + 纬度/2))`，残差都在 0.3 px 以内；合肥、京都、名古屋三个标记点也落在预测位置上。地图覆盖约东经 95°–154°、北纬 20°–46°，范围外、或者落进标题框 / 图例 / 长三角放大图的位置不画点，只留文字。
- 城市名是 iPhone 系统语言给的（中文系统就是「大阪市」），三种语言界面都原样显示。

## iPhone 快捷指令

1. 快捷指令 App → 新建快捷指令，起名「报位置」：
   - 加「获取当前位置」。
   - 加「获取 URL 内容」：
     - URL：`https://aaccx.pw/travel/now`
     - 方法：POST
     - 头部：`Authorization` = `Bearer <NOW_LOCATION_TOKEN>`
     - 请求体：JSON，三个字段：`lat`（数字，选「当前位置」→「纬度」）、`lon`（数字，选「当前位置」→「经度」）、`city`（文本，选「当前位置」→「城市」）。
2. 自动化 → 新建个人自动化，按需要选「特定时间」（例如每天 8:00 / 12:00 / 18:00 / 22:00）或「到达 / 离开」某地 → 运行「报位置」→ 选「立即运行」，关掉「运行时通知」。
3. 想临时不显示：再建一个快捷指令「藏起位置」，同样的 URL 和头部，请求体只放 `hidden`（布尔值，开）。下次「报位置」会重新显示。

`NOW_LOCATION_TOKEN` 只在 Mac 的 `.env` 里，不进仓库。
