import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useAnimation, useTransform } from "motion/react";
import "./RollingGallery.css";

const IMGS = [
  "/images/animate/image.png",
  "/images/animate/image copy.png",
  "/images/animate/image copy 2.png",
  "/images/animate/image copy 3.png",
  "/images/animate/image copy 4.png",
  "/images/animate/image copy 5.png",
  "/images/animate/image copy 6.png",
  "/images/animate/image copy 7.png",
  "/images/animate/image copy 8.png",
  "/images/animate/image copy 9.png",
  "/images/animate/image copy 10.png",
  "/images/animate/image copy 11.png",
  "/images/animate/image copy 12.png",
  "/images/animate/image copy 13.png",
  "/images/animate/image copy 14.png",
  "/images/animate/image copy 15.png",
  "/images/animate/image copy 16.png",
  "/images/animate/image copy 17.png",
  "/images/animate/image copy 18.png",
  "/images/animate/image copy 19.png",
  "/images/animate/image copy 20.png",
  "/images/animate/image copy 21.png",
  "/images/animate/image copy 22.png",
  "/images/animate/image copy 23.png",
  "/images/animate/image copy 24.png",
  "/images/animate/image copy 25.png",
  "/images/animate/image copy 26.png",
  "/images/animate/image copy 27.png",
  "/images/animate/image copy 28.png",
  "/images/animate/image copy 29.png",
  "/images/animate/image copy 30.png",
];

const RollingGallery = ({ autoplay = false, pauseOnHover = false, images = [], speed = 1 }) => {
  images = IMGS;
  const [isScreenSizeSm, setIsScreenSizeSm] = useState(window.innerWidth <= 640);
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(autoplay);

  const cylinderWidth = isScreenSizeSm ? 2200 : 4000;
  const faceCount = images.length;
  const faceWidth = (cylinderWidth / faceCount) * 0.2;
  const radius = cylinderWidth / (2 * Math.PI);
  
  // 计算1:1拖动对应的拖动因子
  const dragFactor = 360 / cylinderWidth;
  
  // 根据speed参数计算自动滚动速度（每秒旋转角度）
  const autoScrollSpeed = speed * 30; // 每秒旋转角度
  const frameRate = 60; // 60fps
  const rotationPerFrame = autoScrollSpeed / frameRate;

  const rotation = useMotionValue(0);
  const controls = useAnimation();
  const autoplayRef = useRef();
  const animationFrameRef = useRef();
  const lastTimeRef = useRef(0);

  // 自动滚动动画函数
  const autoScroll = useCallback((currentTime) => {
    try {
      if (!isDragging && isAutoScrolling) {
        if (lastTimeRef.current === 0) {
          lastTimeRef.current = currentTime;
        }
        
        const deltaTime = currentTime - lastTimeRef.current;
        const rotationDelta = (rotationPerFrame * deltaTime) / (1000 / frameRate);
        
        rotation.set(rotation.get() - rotationDelta);
        lastTimeRef.current = currentTime;
      }
      
      if (isAutoScrolling) {
        animationFrameRef.current = requestAnimationFrame(autoScroll);
      }
    } catch (error) {
      console.warn('Auto scroll error:', error);
      // 异常处理：重置自动滚动
      setIsAutoScrolling(false);
      setTimeout(() => setIsAutoScrolling(autoplay), 100);
    }
  }, [isDragging, isAutoScrolling, rotation, rotationPerFrame, autoplay]);

  // 拖动开始处理
  const handleDragStart = useCallback(() => {
    try {
      setIsDragging(true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.stop();
    } catch (error) {
      console.warn('Drag start error:', error);
    }
  }, [controls]);

  // 拖动处理 - 实现1:1对应
  const handleDrag = useCallback((_, info) => {
    try {
      // 1:1拖动对应：鼠标移动距离直接对应旋转角度
      const newRotation = rotation.get() + info.offset.x * dragFactor;
      rotation.set(newRotation);
    } catch (error) {
      console.warn('Drag error:', error);
    }
  }, [rotation, dragFactor]);

  // 拖动结束处理
  const handleDragEnd = useCallback((_, info) => {
    try {
      setIsDragging(false);
      
      // 添加惯性滚动
      if (Math.abs(info.velocity.x) > 50) {
        const finalRotation = rotation.get() + info.velocity.x * dragFactor * 0.3;
        controls.start({
          rotateY: finalRotation,
          transition: { 
            type: "spring", 
            stiffness: 60, 
            damping: 20, 
            mass: 0.1, 
            ease: "easeOut" 
          },
        });
      }
      
      // 恢复自动滚动
      if (autoplay) {
        setTimeout(() => {
          setIsAutoScrolling(true);
          lastTimeRef.current = 0;
        }, 300);
      }
    } catch (error) {
      console.warn('Drag end error:', error);
      // 异常处理：确保状态恢复
      setIsDragging(false);
      if (autoplay) {
        setIsAutoScrolling(true);
      }
    }
  }, [rotation, dragFactor, controls, autoplay]);

  const transform = useTransform(rotation, (value) => {
    return `rotate3d(0, 1, 0, ${value}deg)`;
  });

  // 自动滚动效果
  useEffect(() => {
    try {
      if (isAutoScrolling && !isDragging) {
        lastTimeRef.current = 0;
        animationFrameRef.current = requestAnimationFrame(autoScroll);
      }
      
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    } catch (error) {
      console.warn('Auto scroll setup error:', error);
    }
  }, [isAutoScrolling, isDragging, autoScroll]);
  
  // 监听autoplay参数变化
  useEffect(() => {
    setIsAutoScrolling(autoplay && !isDragging);
  }, [autoplay, isDragging]);

  useEffect(() => {
    const handleResize = () => {
      setIsScreenSizeSm(window.innerWidth <= 640);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 鼠标悬停处理
  const handleMouseEnter = useCallback(() => {
    try {
      if (autoplay && pauseOnHover && !isDragging) {
        setIsAutoScrolling(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        controls.stop();
      }
    } catch (error) {
      console.warn('Mouse enter error:', error);
    }
  }, [autoplay, pauseOnHover, isDragging, controls]);

  const handleMouseLeave = useCallback(() => {
    try {
      if (autoplay && pauseOnHover && !isDragging) {
        setIsAutoScrolling(true);
        lastTimeRef.current = 0;
      }
    } catch (error) {
      console.warn('Mouse leave error:', error);
    }
  }, [autoplay, pauseOnHover, isDragging]);

  return (
    <div className="gallery-container">
      <div className="gallery-gradient gallery-gradient-left"></div>
      <div className="gallery-gradient gallery-gradient-right"></div>
      <div className="gallery-content">
        <motion.div
          drag="x"
          className="gallery-track"
          onMouseEnter={handleMouseEnter} 
          onMouseLeave={handleMouseLeave}
          style={{
            transform: transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          animate={controls}
          dragConstraints={false}
          dragElastic={0}
          dragMomentum={false}
        >
          {images.map((url, i) => (
            <div
              key={i}
              className="gallery-item"
              style={{
                width: `${faceWidth}px`,
                transform: `rotateY(${i * (360 / faceCount)}deg) translateZ(${radius}px)`,
              }}
            >
              <img src={url} alt="gallery" className="gallery-img" />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default RollingGallery;