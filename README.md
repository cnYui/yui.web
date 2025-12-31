# Yui's Personal Website

一个简洁优雅的个人展示网站，采用纯静态 HTML + Tailwind CSS 构建。

## 🌐 在线访问

[https://cnyui.github.io/yui.web](https://cnyui.github.io/yui.web)

## ✨ 特性

- 🎨 现代化 UI 设计，深色主题
- 🌍 粒子地球动画背景
- 📱 完全响应式，适配各种设备
- ⚡ 纯静态页面，加载极速
- 🚀 GitHub Pages 自动部署

## 📁 网站结构

```
├── index.html          # 首页
├── 个人简历/           # 个人简历页面
├── 项目经历/           # 项目经历展示
├── 技术博客/           # 技术博客文章
├── 旅行足迹/           # 旅行照片记录
├── 音乐推荐/           # 音乐推荐列表
├── 番剧推荐/           # 番剧推荐列表
├── images/             # 图片资源
└── 404.html            # 404 页面
```

## 🛠️ 技术栈

- HTML5
- Tailwind CSS (CDN)
- Vanilla JavaScript
- Canvas 2D (粒子动画)
- GeoJSON (地图数据)

## 🚀 本地运行

```bash
# 使用 Python
python -m http.server 3000

# 或使用 Node.js
npx serve
```

访问 `http://localhost:3000` 查看网站

## 📦 部署

推送到 `main` 分支后，GitHub Actions 会自动部署到 GitHub Pages。

## 📄 许可证

MIT License
