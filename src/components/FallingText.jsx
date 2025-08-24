import { useRef, useState, useEffect } from "react";
import Matter from "matter-js";
import "./FallingText.css";

const FallingText = ({
  className = '',
  text = '',
  highlightWords = [],
  highlightClass = "highlighted",
  trigger = "auto",
  backgroundColor = "transparent",
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = "1rem"
}) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const [effectStarted, setEffectStarted] = useState(false);

  // 判断是否为中文字符
  const isChinese = (char) => {
    return /[\u4e00-\u9fff]/.test(char);
  };

  // 拆分文本：汉字按字符，英文按单词，特殊处理Full-Stack
  const splitText = (text) => {
    const result = [];
    let currentWord = '';
    
    // 首先分离中文和英文部分
    const parts = text.split(' ');
    const chineseParts = [];
    const englishParts = [];
    
    parts.forEach(part => {
      if (/[\u4e00-\u9fff]/.test(part)) {
        // 包含中文字符的部分
        for (let char of part) {
          if (isChinese(char)) {
            chineseParts.push({ text: char, type: 'chinese', position: 'title' });
          }
        }
      } else if (part.trim()) {
        // 英文部分，特殊处理Full-Stack
        if (part === 'Full-Stack') {
          englishParts.push({ text: 'Full', type: 'english', position: 'subtitle' });
          englishParts.push({ text: '-', type: 'english', position: 'subtitle' });
          englishParts.push({ text: 'Stack', type: 'english', position: 'subtitle' });
        } else {
          englishParts.push({ text: part, type: 'english', position: 'subtitle' });
        }
      }
    });
    
    // 合并结果，中文在前，英文在后
    return [...chineseParts, ...englishParts];
  };

  useEffect(() => {
    if (!textRef.current) return;
    const words = splitText(text);
    
    // 分离标题和副标题
    const titleWords = words.filter(w => w.position === 'title');
    const subtitleWords = words.filter(w => w.position === 'subtitle');
    
    const createWordSpan = (wordObj) => {
      const isHighlighted = highlightWords.some((hw) => wordObj.text.includes(hw));
      const typeClass = wordObj.type === 'english' ? 'english-word' : 'chinese-word';
      const positionClass = wordObj.position === 'subtitle' ? 'subtitle-word' : 'title-word';
      // 为特定字符添加蓝色样式类
      const isBlueWord = ['欢', '迎', '悠', '一'].includes(wordObj.text);
      const blueClass = isBlueWord ? 'blue-word' : '';
      return `<span class="word ${typeClass} ${positionClass} ${blueClass} ${isHighlighted ? highlightClass : ""}">${wordObj.text}</span>`;
    };
    
    const titleHTML = titleWords.map(createWordSpan).join(" ");
    const subtitleHTML = subtitleWords.map(createWordSpan).join(" ");
    
    textRef.current.innerHTML = `
      <div class="title-section">${titleHTML}</div>
      <div class="subtitle-section">${subtitleHTML}</div>
    `;
  }, [text, highlightWords, highlightClass]);

  useEffect(() => {
    if (trigger === "auto") {
      setEffectStarted(true);
      return;
    }
    if (trigger === "scroll" && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setEffectStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [trigger]);

  useEffect(() => {
    if (!effectStarted) return;

    const {
      Engine,
      Render,
      World,
      Bodies,
      Runner,
      Mouse,
      MouseConstraint,
    } = Matter;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) {
      return;
    }

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const render = Render.create({
      element: canvasContainerRef.current,
      engine,
      options: {
        width,
        height,
        background: backgroundColor,
        wireframes,
      },
    });

    const boundaryOptions = {
      isStatic: true,
      render: { fillStyle: "transparent" },
    };
    // 将地板设置在页面底部
    const floor = Bodies.rectangle(width / 2, height - 25, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const wordSpans = textRef.current.querySelectorAll(".word");
    const wordBodies = [...wordSpans].map((elem) => {
      const rect = elem.getBoundingClientRect();

      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      // 根据元素类型设置不同的物理属性
      const isSubtitle = elem.classList.contains('subtitle-word');
      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: "transparent" },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2,
      });

      // 为副标题元素设置稍微不同的初始速度，保持同步
      const baseVelocityX = (Math.random() - 0.5) * 5;
      const baseAngularVelocity = (Math.random() - 0.5) * 0.05;
      
      Matter.Body.setVelocity(body, {
        x: baseVelocityX,
        y: 0
      });
      Matter.Body.setAngularVelocity(body, baseAngularVelocity);
      return { elem, body };
    });

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = "absolute";
      elem.style.left = `${body.position.x - body.bounds.max.x + body.bounds.min.x / 2}px`;
      elem.style.top = `${body.position.y - body.bounds.max.y + body.bounds.min.y / 2}px`;
      elem.style.transform = "none";
    });

    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: mouseConstraintStiffness,
        render: { visible: false },
      },
    });
    render.mouse = mouse;

    World.add(engine.world, [
      floor,
      leftWall,
      rightWall,
      ceiling,
      mouseConstraint,
      ...wordBodies.map((wb) => wb.body),
    ]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      Matter.Engine.update(engine);
      requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => {
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas && canvasContainerRef.current) {
        canvasContainerRef.current.removeChild(render.canvas);
      }
      World.clear(engine.world);
      Engine.clear(engine);
    };
  }, [
    effectStarted,
    gravity,
    wireframes,
    backgroundColor,
    mouseConstraintStiffness,
  ]);

  const handleTrigger = () => {
    if (!effectStarted && (trigger === "click" || trigger === "hover")) {
      setEffectStarted(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`falling-text-container ${className}`}
      onClick={trigger === "click" ? handleTrigger : undefined}
      onMouseEnter={trigger === "hover" ? handleTrigger : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={textRef}
        className="falling-text-target"
        style={{
          fontSize: fontSize,
          lineHeight: 1.4,
        }}
      />
      <div ref={canvasContainerRef} className="falling-text-canvas" />
    </div>
  );
};

export default FallingText;