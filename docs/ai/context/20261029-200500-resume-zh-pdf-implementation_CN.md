# 中文简历 PDF

## 需求

履历页中文界面里的「PDF 履历」打开的是日文履歴書（照片、現住所、〒、日文）。用户要求把这里的履历改成中文版本。

## 实现

- 新增 `files/WU_JIANXIANG_resume_zh.pdf`，一页 A4：姓名（邬健翔 / WU JIANXIANG，作品集文件名《邬健翔_作品集.pdf》里的写法）、证件照、邮箱、个人简介、实习经历、教育经历、专业技能、语言与资格、获奖经历。
- 内容来源：履历页中文版（比 7 月的日文履歴書多了 2026.09 起的 AI Mage 实习），个人简介一段由履歴書的「志望動機・特技」译成中文。
- 不放现住所、电话、出生日期。日文履歴書公开这些是用户明确选择的，这份是新文件，保持和履历页一样只放邮箱。
- 源文件 `scripts/resume-zh/resume-zh.html` + `photo.jpg`；`scripts/build-resume-zh-pdf.js` 调无头 Edge / Chrome 打印，字体是系统的微软雅黑（已嵌入 PDF）。
- `resume/index.html`：三个语言各一个 `<a data-l=...>`，中文指向 `_zh.pdf`，日文、英文仍指向日文履歴書。`?v=20261029` 对新文件是首次使用，不会撞缓存。
- 测试：`test/shop-frontend.test.js` 校验三个链接、PDF 存在、源文件没有住所 / 电话 / 出生年；`lib/static-public-policy.test.js` 校验新 PDF 路径可公开访问。

## 验证

- `npm test` 131/131 通过。
- 本地起服务，切换三种语言：中文显示「PDF 履历」→ `_zh.pdf`，日文「履歴書 PDF」和英文「Resume (PDF)」→ 原 PDF。
- PDF 渲染成图逐页看过：一页，字体全部嵌入，没有缺字方块（原日文 PDF 有）。
