import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './ScrollReveal.css';

gsap.registerPlugin(ScrollTrigger);

// 完全重写的ScrollReveal组件，使用React方式处理子元素
const ScrollReveal = ({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = '',
  textClassName = '',
  rotationEnd = 'bottom bottom',
  wordAnimationEnd = 'bottom bottom'
}) => {
  const containerRef = useRef(null);
  const linesRef = useRef([]);
  
  // 将子元素分割成行
  const renderChildrenAsLines = () => {
    // 如果children是字符串，按行分割
    if (typeof children === 'string') {
      // 尝试按句子分割
      const sentences = children.split(/(?<=[。！？.!?]+)/).filter(s => s.trim());
      
      if (sentences.length > 1) {
        return sentences.map((sentence, index) => (
          <div 
            key={`line-${index}`}
            ref={el => { if (el) linesRef.current[index] = el; }}
            className="scroll-reveal-line"
            style={{
              display: 'block',
              marginBottom: '0.3em',
              opacity: baseOpacity,
              filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
            }}
          >
            {sentence.trim()}
          </div>
        ));
      }
      
      // 如果没有句子，按逗号分割
      const phrases = children.split(/(?<=[，,；;]+)/).filter(p => p.trim());
      if (phrases.length > 1) {
        return phrases.map((phrase, index) => (
          <div 
            key={`line-${index}`}
            ref={el => { if (el) linesRef.current[index] = el; }}
            className="scroll-reveal-line"
            style={{
              display: 'block',
              marginBottom: '0.3em',
              opacity: baseOpacity,
              filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
            }}
          >
            {phrase.trim()}
          </div>
        ));
      }
      
      // 如果还是一行，按空格分割成几组
      const words = children.split(/\s+/).filter(w => w.trim());
      if (words.length > 8) {
        const wordsPerLine = Math.max(5, Math.ceil(words.length / 3));
        const lines = [];
        
        for (let i = 0; i < words.length; i += wordsPerLine) {
          const lineWords = words.slice(i, i + wordsPerLine);
          if (lineWords.length > 0) {
            lines.push(lineWords.join(' '));
          }
        }
        
        return lines.map((line, index) => (
          <div 
            key={`line-${index}`}
            ref={el => { if (el) linesRef.current[index] = el; }}
            className="scroll-reveal-line"
            style={{
              display: 'block',
              marginBottom: '0.3em',
              opacity: baseOpacity,
              filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
            }}
          >
            {line}
          </div>
        ));
      }
      
      // 如果是短文本，整体作为一行
      return (
        <div 
          ref={el => { if (el) linesRef.current[0] = el; }}
          className="scroll-reveal-line"
          style={{
            display: 'block',
            marginBottom: '0.3em',
            opacity: baseOpacity,
            filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
          }}
        >
          {children}
        </div>
      );
    }
    
    // 如果children是React元素，保留其结构
    if (React.isValidElement(children)) {
      // 如果是单个元素，包装它
      return (
        <div 
          ref={el => { if (el) linesRef.current[0] = el; }}
          className="scroll-reveal-line"
          style={{
            display: 'block',
            marginBottom: '0.3em',
            opacity: baseOpacity,
            filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
          }}
        >
          {children}
        </div>
      );
    }
    
    // 如果children是数组，处理每个子元素
    if (Array.isArray(children)) {
      return children.map((child, index) => {
        if (typeof child === 'string') {
          // 文本节点按行分割
          const lines = child.split(/\n/).filter(line => line.trim());
          if (lines.length > 1) {
            return lines.map((line, lineIndex) => (
              <div 
                key={`line-${index}-${lineIndex}`}
                ref={el => { if (el) linesRef.current.push(el); }}
                className="scroll-reveal-line"
                style={{
                  display: 'block',
                  marginBottom: '0.3em',
                  opacity: baseOpacity,
                  filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
                }}
              >
                {line.trim()}
              </div>
            ));
          }
        }
        
        // 其他元素保持原样
        return (
          <div 
            key={`line-${index}`}
            ref={el => { if (el) linesRef.current.push(el); }}
            className="scroll-reveal-line"
            style={{
              display: 'block',
              marginBottom: '0.3em',
              opacity: baseOpacity,
              filter: enableBlur ? `blur(${blurStrength}px)` : 'none'
            }}
          >
            {child}
          </div>
        );
      });
    }
    
    // 默认情况，直接返回children
    return children;
  };

  // 设置动画效果
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    console.log('ScrollReveal lines count:', linesRef.current.length);
    
    // 设置容器初始旋转
    gsap.set(container, { rotation: baseRotation });
    
    // 容器旋转动画
    gsap.to(container, {
      rotation: 0,
      scrollTrigger: {
        trigger: container,
        start: 'top bottom',
        end: rotationEnd,
        scrub: true,
        scroller: scrollContainerRef?.current || window,
        onEnter: () => console.log('Container animation entered')
      }
    });
    
    // 为每一行设置动画
    linesRef.current.forEach((line, index) => {
      if (!line) return;
      
      console.log(`Setting up animation for line ${index}`);
      
      // 创建行动画
      gsap.to(line, {
        opacity: 1,
        filter: 'blur(0px)',
        scrollTrigger: {
          trigger: line,
          start: 'top 85%', // 当行到达视口85%位置时开始
          end: 'bottom 15%', // 当行底部到达视口15%位置时结束
          scrub: 0.5, // 平滑过渡
          scroller: scrollContainerRef?.current || window,
          onEnter: () => console.log(`Line ${index} animation entered`),
          onUpdate: (self) => {
            // 根据进度动态调整模糊强度
            const currentBlur = blurStrength * (1 - self.progress);
            line.style.filter = enableBlur ? `blur(${currentBlur}px)` : 'none';
            if (self.progress > 0 && self.progress < 1) {
              console.log(`Line ${index} progress: ${self.progress.toFixed(2)}, blur: ${currentBlur.toFixed(1)}px`);
            }
          }
        }
      });
    });
    
    // 清理函数
    return () => {
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.vars.trigger === container || 
            linesRef.current.includes(trigger.vars.trigger)) {
          trigger.kill();
        }
      });
    };
  }, [children, scrollContainerRef, enableBlur, baseOpacity, baseRotation, blurStrength, rotationEnd, wordAnimationEnd]);

  return (
    <div 
      ref={containerRef} 
      className={`scroll-reveal ${containerClassName}`}
      data-testid="scroll-reveal-container"
    >
      <div className={`scroll-reveal-text ${textClassName}`}>
        {renderChildrenAsLines()}
      </div>
    </div>
  );
};

export default ScrollReveal;