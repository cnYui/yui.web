# 悠一的二次元小站 🌸

一个关于二次元文化（动漫、游戏、轻小说）的个人静态网站，支持帖子发布和管理员功能。

## ✨ 功能特性

- 📝 **帖子系统**：发布和查看个人帖子
- 👑 **管理员功能**：登录后可删除帖子
- 💾 **本地存储**：使用 localStorage 保存数据
- 📱 **响应式设计**：适配各种设备
- 🎨 **现代化UI**：美观的界面设计

## 🚀 GitHub Pages 部署

### 自动部署

本项目已配置 GitHub Actions 自动部署，推送到 `main` 或 `master` 分支时会自动部署到 GitHub Pages。

### 手动设置步骤

1. **启用 GitHub Pages**
   - 进入仓库设置 (Settings)
   - 找到 "Pages" 选项
   - Source 选择 "GitHub Actions"

2. **推送代码**
   ```bash
   git add .
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```

3. **访问网站**
   - 部署完成后，访问：`https://你的用户名.github.io/yui.web`

## 🔧 本地开发

直接用浏览器打开 `index.html` 或 `posts.html` 即可预览。

## 👑 管理员功能

- **用户名**：`admin`
- **密码**：`yui2025`

登录后可以删除帖子。

## 📁 项目结构

```
yui.web/
├── index.html          # 主页
├── posts.html          # 帖子页面
├── css/
│   └── style.css       # 样式文件
├── js/
│   └── main.js         # 主要逻辑
├── .github/
│   └── workflows/
│       └── deploy.yml  # GitHub Actions 配置
└── README.md           # 说明文档
```

## 🎯 技术栈

- **前端**：HTML5, CSS3, JavaScript (ES6+)
- **存储**：localStorage
- **部署**：GitHub Pages + GitHub Actions
- **图标**：Font Awesome

## 📝 更新日志

- ✅ 静态版本适配 GitHub Pages
- ✅ 管理员登录和删除功能
- ✅ 响应式设计
- ✅ 自动部署配置

---

💖 **悠一的二次元小站** - 分享二次元的美好时光
