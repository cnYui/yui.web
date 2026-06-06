# SpeakMore 三语博客发布验证记录

## 本次写入

- 新增文章页：`blog/speakmore-cloud-input.html`
- 新增封面图：`images/blog/speakmore-note-cover-guizang.png`
- 更新博客列表：`js/blog-data.js`
- 新增计划文档：`docs/ai/context/20260604-221031-speakmore-blog-publish-plan.md`

## 验证结果

- `node -e` 校验博客列表首条为 SpeakMore，链接为 `/blog/speakmore-cloud-input`。
- `npm test` 通过：20 个测试全部通过。
- 本地文章页返回 200：`http://127.0.0.1:4173/blog/speakmore-cloud-input`
- 公网文章页返回 200：`https://aaccx.pw/blog/speakmore-cloud-input`
- 公网封面图返回 200：`https://aaccx.pw/images/blog/speakmore-note-cover-guizang.png`
- 浏览器验证通过：
  - 封面图加载完成，实际尺寸 `5120x2680`。
  - 中文、英文、日文标题均可通过语言按钮切换。
  - 正文包含 SpeakMore GitHub 链接。

## 重启记录

- 当前反代理链路：`cloudflared -> nginx:8080 -> node:4173`。
- 已重启 `yui.web`，后台会话为 `screen`：`34153.yui-web-server`。
- 新服务监听：`*:4173`。

## 运行时处理

重启前发现 `better-sqlite3` 是 Node 25 ABI，而当前可用 Node 是 26。为了保证项目能用当前运行时重启，执行了 `npm rebuild better-sqlite3`，随后测试恢复通过。
