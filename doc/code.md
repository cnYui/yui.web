# Ripple Grid - React 网格波纹效果组件

## 项目概述

Ripple Grid 是一个基于 WebGL 的 React 组件，提供动态网格波纹效果。该组件使用 OGL (One Graphics Library) 实现高性能的 GPU 渲染，支持鼠标交互、彩虹色彩模式和多种自定义参数。

### 主要特性
- 🌊 动态波纹效果
- 🎨 支持彩虹色彩模式
- 🖱️ 鼠标交互响应
- ⚡ WebGL 高性能渲染
- 🎛️ 丰富的自定义参数
- 📱 响应式设计支持

## 技术架构

### 核心技术栈
- **React**: 组件化开发框架
- **OGL**: 轻量级 WebGL 库
- **WebGL**: GPU 加速渲染
- **GLSL**: 着色器语言

### 架构设计
```
┌─────────────────┐
│   React App     │
├─────────────────┤
│  RippleGrid     │
│   Component     │
├─────────────────┤
│   OGL Renderer  │
├─────────────────┤
│   WebGL Canvas  │
└─────────────────┘
```

## 安装与配置

### 依赖安装
```bash
npm install ogl
```

### 基本用法
```jsx
import RippleGrid from './RippleGrid';

<div style={{position: 'relative', height: '500px', overflow: 'hidden'}}>
  <RippleGrid
    enableRainbow={false}
    gridColor="#ffffff"
    rippleIntensity={0.05}
    gridSize={10}
    gridThickness={15}
    mouseInteraction={true}
    mouseInteractionRadius={1.2}
    opacity={0.8}
  />
</div>
```

```

## 项目结构

```
Ripple_Grid/
├── src/
│   ├── components/
│   │   ├── RippleGrid.jsx      # 主组件
│   │   └── RippleGrid.css      # 样式文件
│   ├── App.jsx                 # 应用入口
│   └── main.jsx               # 主文件
├── doc/
│   └── code.md                # 项目文档
└── package.json               # 依赖配置
```

## UI 设计规范

### 整体风格
基于提供的设计图片，界面采用深色主题设计：
- **主色调**: 深蓝色背景 (#0a0a0f)
- **网格颜色**: 蓝色系 (#4169e1, #6366f1)
- **文字颜色**: 白色 (#ffffff)
- **按钮样式**: 圆角设计，白色背景

### 导航栏设计
```css
.navbar {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50px;
  padding: 12px 24px;
}
```

### 按钮样式
```css
.primary-button {
  background: #ffffff;
  color: #000000;
  border-radius: 25px;
  padding: 12px 24px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.secondary-button {
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  padding: 12px 24px;
}
```

## CSS 样式要求

### RippleGrid.css
```css
.ripple-grid-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.ripple-grid-container canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

## 核心代码实现

### RippleGrid 组件代码
```jsx
import { useRef, useEffect } from "react";
import { Renderer, Program, Triangle, Mesh } from "ogl";
import "./RippleGrid.css";

const RippleGrid = ({
  enableRainbow = false,
  gridColor = "#ffffff",
  rippleIntensity = 0.05,
  gridSize = 10.0,
  gridThickness = 15.0,
  fadeDistance = 1.5,
  vignetteStrength = 2.0,
  glowIntensity = 0.1,
  opacity = 1.0,
  gridRotation = 0,
  mouseInteraction = true,
  mouseInteractionRadius = 1,
}) => {
  const containerRef = useRef(null);
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseInfluenceRef = useRef(0);
  const uniformsRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
        : [1, 1, 1];
    };

    const renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true,
    });
    const gl = renderer.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    containerRef.current.appendChild(gl.canvas);

    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
}`;

    const frag = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        
        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));
        
        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
    
    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
    
    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}`;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: hexToRgb(gridColor) },
      rippleIntensity: { value: rippleIntensity },
      gridSize: { value: gridSize },
      gridThickness: { value: gridThickness },
      fadeDistance: { value: fadeDistance },
      vignetteStrength: { value: vignetteStrength },
      glowIntensity: { value: glowIntensity },
      opacity: { value: opacity },
      gridRotation: { value: gridRotation },
      mouseInteraction: { value: mouseInteraction },
      mousePosition: { value: [0.5, 0.5] },
      mouseInfluence: { value: 0 },
      mouseInteractionRadius: { value: mouseInteractionRadius },
    };

    uniformsRef.current = uniforms;

    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = containerRef.current;
      renderer.setSize(w, h);
      uniforms.iResolution.value = [w, h];
    };

    const handleMouseMove = (e) => {
      if (!mouseInteraction || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y coordinate
      targetMouseRef.current = { x, y };
    };

    const handleMouseEnter = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 1.0;
    };

    const handleMouseLeave = () => {
      if (!mouseInteraction) return;
      mouseInfluenceRef.current = 0.0;
    };

    window.addEventListener("resize", resize);
    if (mouseInteraction) {
      containerRef.current.addEventListener("mousemove", handleMouseMove);
      containerRef.current.addEventListener("mouseenter", handleMouseEnter);
      containerRef.current.addEventListener("mouseleave", handleMouseLeave);
    }
    resize();

    const render = (t) => {
      uniforms.iTime.value = t * 0.001;

      const lerpFactor = 0.1;
      mousePositionRef.current.x +=
        (targetMouseRef.current.x - mousePositionRef.current.x) * lerpFactor;
      mousePositionRef.current.y +=
        (targetMouseRef.current.y - mousePositionRef.current.y) * lerpFactor;

      const currentInfluence = uniforms.mouseInfluence.value;
      const targetInfluence = mouseInfluenceRef.current;
      uniforms.mouseInfluence.value +=
        (targetInfluence - currentInfluence) * 0.05;

      uniforms.mousePosition.value = [
        mousePositionRef.current.x,
        mousePositionRef.current.y,
      ];

      renderer.render({ scene: mesh });
      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (mouseInteraction && containerRef.current) {
        containerRef.current.removeEventListener("mousemove", handleMouseMove);
        containerRef.current.removeEventListener(
          "mouseenter",
          handleMouseEnter
        );
        containerRef.current.removeEventListener(
          "mouseleave",
          handleMouseLeave
        );
      }
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      containerRef.current?.removeChild(gl.canvas);
    };
  }, []);

  useEffect(() => {
    if (!uniformsRef.current) return;

    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
          parseInt(result[1], 16) / 255,
          parseInt(result[2], 16) / 255,
          parseInt(result[3], 16) / 255,
        ]
        : [1, 1, 1];
    };

    uniformsRef.current.enableRainbow.value = enableRainbow;
    uniformsRef.current.gridColor.value = hexToRgb(gridColor);
    uniformsRef.current.rippleIntensity.value = rippleIntensity;
    uniformsRef.current.gridSize.value = gridSize;
    uniformsRef.current.gridThickness.value = gridThickness;
    uniformsRef.current.fadeDistance.value = fadeDistance;
    uniformsRef.current.vignetteStrength.value = vignetteStrength;
    uniformsRef.current.glowIntensity.value = glowIntensity;
    uniformsRef.current.opacity.value = opacity;
    uniformsRef.current.gridRotation.value = gridRotation;
    uniformsRef.current.mouseInteraction.value = mouseInteraction;
    uniformsRef.current.mouseInteractionRadius.value = mouseInteractionRadius;
  }, [
    enableRainbow,
    gridColor,
    rippleIntensity,
    gridSize,
    gridThickness,
    fadeDistance,
    vignetteStrength,
    glowIntensity,
    opacity,
    gridRotation,
    mouseInteraction,
    mouseInteractionRadius,
  ]);

  return <div ref={containerRef} className="ripple-grid-container" />;
};

export default RippleGrid;
```

## 实现步骤

### 1. 环境准备
```bash
# 创建 React 项目
npm create vite@latest ripple-grid --template react
cd ripple-grid

# 安装依赖
npm install
npm install ogl
```

### 2. 创建组件文件
```bash
mkdir src/components
touch src/components/RippleGrid.jsx
touch src/components/RippleGrid.css
```

### 3. 实现主页面
创建符合设计图片的主页面布局：

```jsx
// src/App.jsx
import RippleGrid from './components/RippleGrid';
import './App.css';

function App() {
  return (
    <div className="app">
      {/* 背景网格效果 */}
      <RippleGrid
        enableRainbow={false}
        gridColor="#4169e1"
        rippleIntensity={0.05}
        gridSize={10}
        gridThickness={15}
        mouseInteraction={true}
        mouseInteractionRadius={1.2}
        opacity={0.6}
      />
      
      {/* 导航栏 */}
      <nav className="navbar">
        <div className="nav-brand">
          <span className="nav-icon">⚛️</span>
          <span className="nav-title">React Bits</span>
        </div>
        <div className="nav-links">
          <a href="#" className="nav-link">Home</a>
          <a href="#" className="nav-link">Docs</a>
        </div>
      </nav>
      
      {/* 主要内容 */}
      <main className="main-content">
        <div className="hero-section">
          <div className="hero-badge">
            <span>🆕 New Background</span>
          </div>
          <h1 className="hero-title">
            Retro yet futuristic, this is<br />
            Ripple Grid!
          </h1>
          <div className="hero-buttons">
            <button className="primary-button">Get Started</button>
            <button className="secondary-button">Learn More</button>
          </div>
        </div>
      </main>
      
      {/* 底部标识 */}
      <div className="demo-badge">
        <span>Demo Content</span>
        <div className="demo-indicator"></div>
      </div>
    </div>
  );
}

export default App;
```

### 4. 样式实现
```css
/* src/App.css */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a0f;
  color: white;
  overflow-x: hidden;
}

.app {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 导航栏样式 */
.navbar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50px;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 300px;
  z-index: 100;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-icon {
  font-size: 20px;
}

.nav-title {
  font-weight: 600;
  font-size: 16px;
}

.nav-links {
  display: flex;
  gap: 20px;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-size: 14px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.nav-link:hover {
  opacity: 1;
}

/* 主要内容样式 */
.main-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100px 20px 50px;
}

.hero-section {
  text-align: center;
  max-width: 600px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  margin-bottom: 30px;
}

.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 40px;
  background: linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.primary-button {
  background: #ffffff;
  color: #000000;
  border-radius: 25px;
  padding: 14px 28px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.primary-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(255, 255, 255, 0.2);
}

.secondary-button {
  background: transparent;
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 25px;
  padding: 14px 28px;
  font-weight: 600;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s, border-color 0.2s;
}

.secondary-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
}

/* 底部标识 */
.demo-badge {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  opacity: 0.6;
}

.demo-indicator {
  width: 8px;
  height: 8px;
  background: #4169e1;
  border-radius: 50%;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navbar {
    min-width: 280px;
    padding: 10px 20px;
  }
  
  .nav-links {
    gap: 15px;
  }
  
  .hero-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .primary-button,
  .secondary-button {
    width: 200px;
  }
}
```

## 开发环境配置

### 推荐开发工具
- **IDE**: VS Code
- **Node.js**: 版本 16+
- **包管理器**: npm 或 yarn

### VS Code 扩展推荐
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### 项目配置文件
```json
// package.json
{
  "name": "ripple-grid",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "ogl": "^1.0.6"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "vite": "^4.4.5"
  }
}
```

## 最佳实践

### 性能优化
1. **WebGL 上下文管理**: 确保在组件卸载时正确释放 WebGL 资源
2. **事件监听器清理**: 及时移除事件监听器避免内存泄漏
3. **动画帧优化**: 使用 requestAnimationFrame 确保流畅动画

### 代码规范
1. **组件拆分**: 将复杂逻辑拆分为独立的自定义 Hook
2. **类型安全**: 使用 TypeScript 提供类型检查
3. **错误处理**: 添加 WebGL 支持检测和错误边界

### 调试技巧
1. **WebGL 调试**: 使用浏览器开发者工具的 WebGL 面板
2. **性能监控**: 使用 React DevTools Profiler
3. **着色器调试**: 使用 Spector.js 等工具

## 参数配置说明

### 可自定义参数

| 参数名称 | 类型 | 默认值 | 描述 |
|---------|------|--------|------|
| **enableRainbow** | boolean | false | 启用彩虹色彩循环动画 |
| **gridColor** | string | '#ffffff' | 网格颜色（非彩虹模式时） |
| **rippleIntensity** | number | 0.05 | 波纹效果强度 |
| **gridSize** | number | 10.0 | 网格密度/大小 |
| **gridThickness** | number | 15.0 | 网格线条粗细 |
| **fadeDistance** | number | 1.5 | 淡出效果距离 |
| **vignetteStrength** | number | 2.0 | 暗角效果强度 |
| **glowIntensity** | number | 0.1 | 发光效果强度 |
| **opacity** | number | 1.0 | 整体透明度 |
| **gridRotation** | number | 0 | 网格旋转角度（度） |
| **mouseInteraction** | boolean | false | 启用鼠标交互 |
| **mouseInteractionRadius** | number | 0.8 | 鼠标交互半径 |

### 推荐配置组合

#### 1. 经典蓝色主题（推荐）
```jsx
<RippleGrid
  enableRainbow={false}
  gridColor="#4169e1"
  rippleIntensity={0.05}
  gridSize={10}
  gridThickness={15}
  mouseInteraction={true}
  mouseInteractionRadius={1.2}
  opacity={0.6}
/>
```

#### 2. 彩虹动态效果
```jsx
<RippleGrid
  enableRainbow={true}
  rippleIntensity={0.08}
  gridSize={8}
  gridThickness={12}
  mouseInteraction={true}
  mouseInteractionRadius={1.5}
  opacity={0.8}
/>
```

#### 3. 简约白色主题
```jsx
<RippleGrid
  enableRainbow={false}
  gridColor="#ffffff"
  rippleIntensity={0.03}
  gridSize={12}
  gridThickness={20}
  mouseInteraction={false}
  opacity={0.4}
/>
```

## 技术依赖

### 核心依赖
- **ogl**: WebGL 渲染库
- **react**: React 框架
- **react-dom**: React DOM 操作

### 开发依赖
- **vite**: 构建工具
- **@vitejs/plugin-react**: React 插件

### 浏览器兼容性
- Chrome 56+
- Firefox 51+
- Safari 15+
- Edge 79+

## 故障排除

### 常见问题

1. **WebGL 不支持**
   ```jsx
   // 添加 WebGL 检测
   const isWebGLSupported = () => {
     try {
       const canvas = document.createElement('canvas');
       return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
     } catch (e) {
       return false;
     }
   };
   ```

2. **性能问题**
   - 降低 `gridSize` 值
   - 减少 `rippleIntensity`
   - 关闭 `mouseInteraction`

3. **移动端适配**
   ```css
   @media (max-width: 768px) {
     .ripple-grid-container {
       transform: scale(0.8);
     }
   }
   ```

## 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🎨 支持基础网格波纹效果
- 🖱️ 添加鼠标交互功能
- 🌈 支持彩虹色彩模式

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**注意**: 本文档基于设计图片中的 React Bits 界面进行设计，确保实现效果与设计保持一致。