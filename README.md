# Ripple Grid

一个基于 React 的现代化个人展示网站，集成了多种炫酷的交互组件和动画效果。

## ✨ 特性

- 🌊 **动态涟漪网格背景** - 基于 WebGL 的高性能涟漪效果
- 🎨 **多样化组件库** - 包含多种精美的 UI 组件
- 🖱️ **丰富的交互效果** - 鼠标悬停、点击等多种交互动画
- 📱 **完全响应式设计** - 适配各种屏幕尺寸
- ⚡ **高性能渲染** - 使用 WebGL 和优化的动画库
- 🎵 **多媒体支持** - 音乐播放、图片展示等功能
- 🧭 **现代化导航** - macOS 风格的 Dock 导航栏

## 🚀 快速开始

### 环境要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 查看网站

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 🛠️ 技术栈

- **React 18** - 现代化前端框架
- **React Router** - 单页应用路由管理
- **OGL** - 轻量级 WebGL 库，用于 3D 渲染
- **GSAP** - 高性能动画库
- **Matter.js** - 2D 物理引擎
- **Motion** - React 动画库
- **Vite** - 快速构建工具
- **CSS3** - 现代化样式和动画

## 📁 项目结构

```
Ripple_Grid/
├── src/
│   ├── components/          # 可复用组件
│   │   ├── ChromaGrid.jsx   # 彩色网格组件
│   │   ├── CircularGallery.jsx # 圆形画廊组件
│   │   ├── Dock.jsx         # macOS 风格导航栏
│   │   ├── FallingText.jsx  # 下落文字动画
│   │   ├── ProfileCard.jsx  # 个人资料卡片
│   │   ├── RippleGrid.jsx   # 涟漪网格背景
│   │   ├── RollingGallery.jsx # 滚动画廊
│   │   ├── ScrollReveal.jsx # 滚动显示动画
│   │   └── TextPressure.jsx # 文字压力效果
│   ├── pages/               # 页面组件
│   │   ├── Home.jsx         # 首页
│   │   ├── TechBlog.jsx     # 技术博客
│   │   ├── AnimeRecommend.jsx # 番剧推荐
│   │   ├── MusicRecommend.jsx # 音乐推荐
│   │   └── TravelFootprint.jsx # 旅行足迹
│   ├── App.jsx              # 主应用组件
│   ├── main.jsx             # 应用入口
│   └── index.css            # 全局样式
├── public/
│   ├── images/              # 图片资源
│   │   ├── music_pic/       # 音乐封面
│   │   ├── travel/          # 旅行照片
│   │   └── animate/         # 动画素材
│   ├── music/               # 音频文件
│   └── lyric/               # 歌词文件
├── doc/                     # 文档目录
├── package.json
├── vite.config.js
└── index.html
```

## 🎯 功能模块

### 🏠 首页 (Home)
- 动态涟漪网格背景
- 个人介绍和技能展示
- 炫酷的交互动画效果

### 📝 技术博客 (Tech Blog)
- 技术文章展示
- 分类和标签系统
- 响应式卡片布局

### 📺 番剧推荐 (Anime Recommend)
- 动漫作品推荐
- 图片画廊展示
- 详细信息卡片

### 🎵 音乐推荐 (Music Recommend)
- 音乐专辑展示
- 在线音乐播放
- 歌词同步显示
- 彩色网格布局

### 🗺️ 旅行足迹 (Travel Footprint)
- 旅行照片展示
- 地点和时间记录
- 圆形画廊效果

## 🎨 组件特性

### RippleGrid 涟漪网格
- 实时鼠标交互
- WebGL 高性能渲染
- 可自定义颜色和强度

### ChromaGrid 彩色网格
- 三列响应式布局
- 悬停光照效果
- 渐变遮罩动画

### Dock 导航栏
- macOS 风格设计
- 鼠标悬停放大效果
- 平滑过渡动画

### CircularGallery 圆形画廊
- 3D 旋转效果
- 自动播放功能
- 触摸手势支持

## 🔧 自定义配置

大部分组件都支持丰富的配置选项，例如：

```jsx
// RippleGrid 配置示例
<RippleGrid 
  enableRainbow={true}
  gridColor="#4169e1"
  rippleIntensity={0.05}
  gridSize={10}
  mouseInteraction={true}
  opacity={0.6}
/>

// ChromaGrid 配置示例
<ChromaGrid 
  items={musicData}
  cols={3}
  radius={150}
  enableSpotlight={true}
/>
```

## 📱 响应式设计

网站针对不同设备进行了优化：

- **桌面端** (>1124px): 完整功能展示
- **平板端** (769px-1124px): 三列布局
- **手机端** (<768px): 单列布局，优化触摸交互

## 🚀 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 自动部署完成

### 其他平台

```bash
# 构建项目
npm run build

# dist 目录包含所有静态文件
# 可以部署到任何静态托管服务
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [OGL](https://github.com/oframe/ogl) - WebGL 库
- [GSAP](https://greensock.com/gsap/) - 动画库
- [Matter.js](https://brm.io/matter-js/) - 物理引擎
- [React](https://reactjs.org/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具

---

⭐ 如果这个项目对你有帮助，请给它一个星标！