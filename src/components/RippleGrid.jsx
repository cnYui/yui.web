import { useRef, useEffect } from "react";
import { Renderer, Program, Triangle, Mesh } from "ogl";
import "./RippleGrid.css";

const RippleGrid = ({
  enableRainbow = true,
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
  mouseInteractionRadius = 0.8,
}) => {
  const containerRef = useRef(null);
  const mousePositionRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const mouseInfluenceRef = useRef(0);
  const uniformsRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const debounceTimerRef = useRef(null);

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
uniform vec3 targetGridColor;
uniform float colorTransition;
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

// 平滑噪声函数
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 旋转矩阵
mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// 平滑步进函数
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    // 应用网格旋转
    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    
    // 增强的涟漪效果
    float baseRipple = sin(pi * (iTime * 0.8 - dist * 2.0)) * 0.5 + 0.5;
    float secondaryRipple = sin(pi * (iTime * 1.2 - dist * 1.5)) * 0.3;
    float combinedRipple = (baseRipple + secondaryRipple) * rippleIntensity;
    
    vec2 rippleUv = uv + uv * combinedRipple;

    // 增强的鼠标交互效果
    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);
        
        // 更平滑的影响范围
        float influence = mouseInfluence * smootherstep(mouseInteractionRadius, 0.0, mouseDist);
        
        // 多层涟漪效果
        float mouseWave1 = sin(pi * (iTime * 3.0 - mouseDist * 8.0)) * influence;
        float mouseWave2 = sin(pi * (iTime * 2.0 - mouseDist * 5.0)) * influence * 0.5;
        float mouseWave3 = sin(pi * (iTime * 1.5 - mouseDist * 3.0)) * influence * 0.3;
        
        vec2 mouseDirection = normalize(uv - mouseUv + vec2(0.001));
        rippleUv += mouseDirection * (mouseWave1 + mouseWave2 + mouseWave3) * rippleIntensity * 0.8;
    }

    // 网格计算
    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    // 抗锯齿处理
    float aaWidth = 0.3;
    vec2 smoothB = vec2(
        smootherstep(0.0, aaWidth, b.x),
        smootherstep(0.0, aaWidth, b.y)
    );

    // 增强的网格渲染
    vec3 color = vec3(0.0);
    
    // 主网格线
    float gridX = exp(-gridThickness * smoothB.x * (0.9 + 0.3 * sin(pi * iTime * 0.5)));
    float gridY = exp(-gridThickness * smoothB.y * (0.9 + 0.3 * cos(pi * iTime * 0.7)));
    color += gridX + gridY;
    
    // 次级网格效果
    color += 0.4 * exp(-(gridThickness * 0.7) * smoothB.x);
    color += 0.4 * exp(-(gridThickness * 0.7) * smoothB.y);

    // 增强的发光效果
    if (glowIntensity > 0.0) {
        float glowX = glowIntensity * exp(-gridThickness * 0.3 * smoothB.x);
        float glowY = glowIntensity * exp(-gridThickness * 0.3 * smoothB.y);
        
        // 动态发光强度
        float glowPulse = 0.8 + 0.4 * sin(iTime * 2.0);
        color += (glowX + glowY) * glowPulse;
        
        // 交叉发光效果
        color += glowIntensity * 0.5 * exp(-gridThickness * 0.5 * (smoothB.x + smoothB.y));
    }

    // 中心渐变
    float centerFade = exp(-1.8 * clamp(pow(dist, fadeDistance), 0.0, 1.0));
    
    // 增强的渐晕效果
    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 1.8, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);
    
    // 颜色计算
    vec3 finalColor;
    if (enableRainbow) {
        // 增强的彩虹效果
        float hue = atan(uv.y, uv.x) / (2.0 * pi) + 0.5;
        hue += iTime * 0.1;
        
        vec3 rainbow = vec3(
            0.5 + 0.5 * sin(2.0 * pi * (hue + 0.0)),
            0.5 + 0.5 * sin(2.0 * pi * (hue + 0.33)),
            0.5 + 0.5 * sin(2.0 * pi * (hue + 0.67))
        );
        
        // 添加时间变化
        rainbow *= 0.8 + 0.4 * sin(iTime * 0.8 + dist * 2.0);
        finalColor = rainbow;
    } else {
        // 颜色过渡效果
        finalColor = mix(gridColor, targetGridColor, colorTransition);
    }

    // 最终合成
    float finalFade = centerFade * vignette;
    float alpha = length(color) * finalFade * opacity;
    
    // 添加微妙的噪声以增加质感
    float noiseValue = noise(uv * 100.0 + iTime) * 0.02;
    color += noiseValue;
    
    gl_FragColor = vec4(color * finalColor * finalFade * opacity, alpha);
}`;

    // Predefined color palette for smooth transitions
    const colorPalette = [
      [0.2, 0.4, 0.8],  // Blue
      [0.6, 0.2, 0.8],  // Purple
      [0.8, 0.2, 0.4],  // Pink
      [0.8, 0.4, 0.2],  // Orange
      [0.4, 0.8, 0.2],  // Green
      [0.2, 0.8, 0.6],  // Teal
      [0.8, 0.6, 0.2],  // Yellow
      [0.4, 0.2, 0.8],  // Indigo
    ];

    // Color transition state
    let currentColorIndex = 0;
    let nextColorIndex = 1;
    let transitionStartTime = 0;
    let isTransitioning = false;

    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      enableRainbow: { value: enableRainbow },
      gridColor: { value: hexToRgb(gridColor) },
      targetGridColor: { value: hexToRgb(gridColor) },
      colorTransition: { value: 0.0 },
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
      
      // 调试信息
      console.log('Mouse move detected:', { mouseInteraction, hasContainer: !!containerRef.current });
      
      // 防抖处理
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y coordinate
        targetMouseRef.current = { x, y };
        console.log('Mouse position updated:', { x, y, clientX: e.clientX, clientY: e.clientY });
      }, 8); // 8ms 防抖延迟
    };

    const handleMouseEnter = () => {
      if (!mouseInteraction) return;
      console.log('Mouse entered - setting influence to 1.0');
      mouseInfluenceRef.current = 1.0;
    };

    const handleMouseLeave = () => {
      if (!mouseInteraction) return;
      console.log('Mouse left - setting influence to 0.0');
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
      // 帧率控制 (60fps)
      const targetFPS = 60;
      const frameInterval = 1000 / targetFPS;
      
      if (t - lastFrameTimeRef.current < frameInterval) {
        rafIdRef.current = requestAnimationFrame(render);
        return;
      }
      
      lastFrameTimeRef.current = t;
      uniforms.iTime.value = t * 0.001;

      // Color transition logic - change color every 5 seconds
      const currentTime = t * 0.001;
      const colorChangeInterval = 5.0; // 5 seconds
      const transitionDuration = 2.0; // 2 seconds for smooth transition
      
      if (!isTransitioning && currentTime - transitionStartTime >= colorChangeInterval) {
        // Start new transition
        isTransitioning = true;
        transitionStartTime = currentTime;
        
        // Set current color as the base and prepare next color
        uniforms.gridColor.value = [...colorPalette[currentColorIndex]];
        currentColorIndex = nextColorIndex;
        nextColorIndex = (nextColorIndex + 1) % colorPalette.length;
        uniforms.targetGridColor.value = [...colorPalette[currentColorIndex]];
      }
      
      if (isTransitioning) {
        const transitionProgress = (currentTime - transitionStartTime) / transitionDuration;
        
        if (transitionProgress >= 1.0) {
          // Transition complete - smoothly set to target color
          uniforms.colorTransition.value = 1.0;
          uniforms.gridColor.value = [...colorPalette[currentColorIndex]];
          uniforms.targetGridColor.value = [...colorPalette[currentColorIndex]];
          isTransitioning = false;
          transitionStartTime = currentTime; // Reset timer for next transition
        } else {
          // Smooth transition using easing function
          const easedProgress = 0.5 * (1 - Math.cos(Math.PI * transitionProgress));
          uniforms.colorTransition.value = easedProgress;
        }
      }

      // 平滑插值，提高响应性
      const lerpFactor = 0.12;
      mousePositionRef.current.x +=
        (targetMouseRef.current.x - mousePositionRef.current.x) * lerpFactor;
      mousePositionRef.current.y +=
        (targetMouseRef.current.y - mousePositionRef.current.y) * lerpFactor;

      // 鼠标影响力平滑过渡
      const currentInfluence = uniforms.mouseInfluence.value;
      const targetInfluence = mouseInfluenceRef.current;
      const influenceLerpFactor = 0.08;
      uniforms.mouseInfluence.value +=
        (targetInfluence - currentInfluence) * influenceLerpFactor;

      uniforms.mousePosition.value = [
        mousePositionRef.current.x,
        mousePositionRef.current.y,
      ];

      // 调试信息 - 每60帧输出一次
      if (Math.floor(t / 1000) !== Math.floor((t - frameInterval) / 1000)) {
        console.log('Render debug:', {
          mouseInfluence: uniforms.mouseInfluence.value,
          mousePosition: uniforms.mousePosition.value,
          rippleIntensity: uniforms.rippleIntensity.value,
          mouseInteractionRadius: uniforms.mouseInteractionRadius.value
        });
      }

      renderer.render({ scene: mesh });
      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);

    return () => {
      // 清理动画帧
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      
      // 清理防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // 清理事件监听器
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
      
      // 清理 WebGL 资源
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (containerRef.current && gl.canvas) {
        containerRef.current.removeChild(gl.canvas);
      }
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