# Yui's Personal Website

A clean and elegant personal portfolio website built with pure static HTML + Tailwind CSS.

## 🌐 Live Demo

[https://cnyui.github.io/yui.web](https://cnyui.github.io/yui.web)

## ✨ Features

- 🎨 Modern UI design with dark/light theme toggle
- 🌍 Interactive particle globe animation background
- 🌐 Bilingual support (English/Chinese)
- 📱 Fully responsive, works on all devices
- ⚡ Pure static pages, lightning fast loading
- 🚀 Auto-deployment via GitHub Pages

## 📁 Site Structure

```
├── index.html          # Homepage
├── resume/             # Resume page
├── projects/           # Project timeline & hackathon experiences
├── blog/               # Tech blog articles
├── travel/             # Travel photo gallery
├── music/              # Music recommendations
├── anime/              # Anime recommendations
├── images/             # Image assets
├── js/                 # JavaScript modules
│   ├── lang.js         # Language toggle
│   └── theme.js        # Theme toggle
└── 404.html            # 404 page
```

## 🛠️ Tech Stack

- HTML5
- Tailwind CSS (CDN)
- Vanilla JavaScript
- Canvas 2D (particle animation)
- GeoJSON (map data)
- Material Icons

## 🚀 Local Development

```bash
# Using Python
python -m http.server 3000

# Or using Node.js
npx serve
```

Visit `http://localhost:3000` to view the site.

## 📦 Deployment

Push to the `main` branch and GitHub Actions will automatically deploy to GitHub Pages.

## 📄 License

MIT License
