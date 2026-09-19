# aaccx.pw 根目录恢复 yui.web 与内容更新实施记录

## 排查结论

- 访问 `https://aaccx.pw/` 会进入 Sub2API 前端并被其路由跳到 `/home`，所有路径都返回同一个 3188 字节的 SPA 页面。
- 根因一：`~/.cloudflared/config.yml`（2026-09-08 改为 Sub2API 云端隧道配置）把 `aaccx.pw`、`www.aaccx.pw`、`api.aaccx.pw` 全部指向 `http://127.0.0.1:8080`，而 `127.0.0.1:8080` 被 OrbStack 为 Sub2API 容器做的端口转发占用（比 nginx 的 `*:8080` 更具体，优先命中），nginx 上的旧 yui.web 分流配置已不在链路中。
- 根因二：Mac 上 `/Users/wujianxiang/CodeSpace/yui.web` 在 2026-09-08 被移到废纸篓且废纸篓已清空；LaunchAgent `com.wjx.aaccx.yui-web` 的旧 node 进程仍在运行，但 `rootDir` 指向已删除路径，本机 4173 全部 404/500。
- CLIProxyAPI 同样只剩空转进程（目录已删、无监听端口），用户确认已淘汰，本次不处理。

## 部署

- 从本地仓库 `git archive HEAD`（45edf70）解压到原路径，`npm ci --omit=dev`（Node 26 + better-sqlite3 正常），新建 `.env`（`openssl rand -hex 32` 生成 ADMIN_TOKEN / INTERNAL_TOKEN / USAGE_EVENT_HMAC_SECRET，`SHOP_USAGE_AUTO_IMPORT_ENABLED=false`，`SHOP_LEGACY_KEY_ISSUANCE_DISABLED=true`，`TRUST_PROXY=loopback`），`launchctl kickstart -k gui/501/com.wjx.aaccx.yui-web` 替换旧进程。
- cloudflared ingress 改为按路径分流（详见 AGENTS.md「2026-09-19 aaccx.pw 根目录恢复 yui.web」）；`/SKILL.md` 由新增的 nginx `127.0.0.1:8081`（`servers/yui-web-extras.conf`）以 `text/plain; charset=utf-8` 提供，沿用原部署方式。
- 切换采用双连接器交接：新配置临时连接器（`--metrics 127.0.0.1:20242 --grace-period 2m`）就绪后再 `kill -TERM` 主连接器，launchd 1 秒内以新配置拉起，最后停临时连接器，期间始终有连接器在线。
- 探测确认 Sub2API 在 `/images/generations`、`/images/edits` 有真实接口（未带 key 返回 401），因此 `/images/` 规则只接管带扩展名的静态图片。

## 内容更新

- `/projects/`：新增 2026-09 大阪 Rokid Mini Hackathon（「DoubleTraining」同率第 2 位・準優勝）与 2026-07 京都 IVS2026（Academia 身份参会）；统计 Awards 4→6、Cities 8→10。
- `/resume/` 与 `js/lang.js`：新增 `award7Title` / `award7Source` 三语文案，排在奖项首位；`SKILL.md` 同步获奖与经历。
- `/travel/`：新增永平寺（2026-09-18，福井）、冲绳（2026-08-15 起一周）、奈良（2026-06-30）各 3 张照片，新增 Nara / Okinawa / Fukui 筛选与三语城市名，Cities 10→13。
- 照片来自微信临时目录 `xwechat_files/.../temp/RWTemp/2026-09/`（用户从微信复制到对话时落盘），按落盘时间与对话顺序核对；统一 `-auto-orient -strip` 去除 EXIF；IVS 参会证上的二维码已打马赛克。
- 动漫、音乐页面暂时下线（白名单屏蔽 + 导航移除 + public-dist 排除）。
- 所有页面 `lang.js` 引用版本号更新为 `?v=20260919-1`（js 缓存 7 天）。

## 与并行 CSP 工作的合并

- 另一会话在 `.claude/worktrees/eloquent-shamir-ff7089`（分支 `claude/eloquent-shamir-ff7089`，未提交）完成了全部 14 个页面的内联脚本外置。本次直接采用其工作区文件（35 个），再叠加上述内容改动，避免两套命名不同的实现互相冲突；该工作树本身未改动。
- 其 `test/page-csp.test.js` 中「至少 14 个页面加载 ui-init.js」因动漫、音乐下线改为 12。

## 验证

- LF 副本（等同 CI）`npm test` 73/73 通过；Windows CRLF 工作区中「Resume 页面所有 data-i18n key 都有中英日翻译」为既有失败（CRLF 下正则不匹配）。
- `check:assets` 在 LF 副本通过（主工作区的缺失项只来自上述 worktree 目录）。
- 本地 4185 端口浏览器验证：项目时间线、旅行筛选、日文/中文翻译、简历奖项、首页精选与最新文章均正常，无 CSP 报错；动漫、音乐页面及图片 404。
- 部署到 Mac 后公网验证：`/`、`/projects/`、`/travel/`、`/resume/`、`/blog/` 下发的 HTML 均无内联脚本；新标签页控制台只剩 Cloudflare Web Analytics beacon 被 CSP 拦截（边缘注入，既有现象）；Sub2API `/home`、`/login`、`/health` 与带 key 的 API 请求正常。
- `/images/optimized/animate/image.webp` 在下线前被验证访问时写入了 Cloudflare 边缘缓存（`cf-cache-status: HIT`），需要在 Cloudflare 后台按 URL 清除或等待 7 天过期；其他动漫、音乐资源回源均为 404。

## 回滚

- 路由：`cp ~/.cloudflared/config.yml.bak-20260919-193006 ~/.cloudflared/config.yml`，再按双连接器方式重启 cloudflared。
- nginx：删除 `/opt/homebrew/etc/nginx/servers/yui-web-extras.conf` 后 `nginx -s reload`。
- 页面：恢复 Mac 上 `/Users/wujianxiang/CodeSpace/yui.web` 的文件并 `launchctl kickstart -k gui/501/com.wjx.aaccx.yui-web`。
