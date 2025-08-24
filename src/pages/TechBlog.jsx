import React, { useEffect, useRef, useState } from 'react';
import TextPressure from '../components/TextPressure';
import ProfileCard from '../components/ProfileCard';
import ScrollReveal from '../components/ScrollReveal';

const TechBlog = () => {
  const scrollContainerRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [profileCardOffset, setProfileCardOffset] = useState(0);

  // 滚动事件监听器
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;
      const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;

      // 计算ProfileCard的同步滚动偏移量
      // 当右侧内容滚动时，左侧ProfileCard向上移动
      // 最大向上移动距离为150px，根据滚动进度线性映射
      // 使用缓动函数优化滚动体验
      // 这个逻辑不受isScrolling状态影响，确保实时同步
      const maxOffset = 150;
      const easeOutQuart = 1 - Math.pow(1 - (scrollPercentage / 100), 4);
      const newOffset = easeOutQuart * maxOffset;
      setProfileCardOffset(newOffset);

      // 只有在非自动滚动状态下才检测滚动到底部的逻辑
      if (!isScrolling) {
        // 检测是否滚动到底部（95%以上认为是底部）
        if (scrollPercentage >= 95 && !hasScrolledToBottom) {
          setHasScrolledToBottom(true);
          triggerSmoothScroll();
        }
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [isScrolling, hasScrolledToBottom]);

  // 触发平滑滚动动画
  const triggerSmoothScroll = () => {
    setIsScrolling(true);
    
    // 平滑滚动到页面底部并继续向下
    const scrollAnimation = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      // 添加额外的内容区域或触发页面整体下移效果
      const currentScrollTop = container.scrollTop;
      const targetScrollTop = container.scrollHeight;
      
      // 使用requestAnimationFrame实现平滑滚动
      const animateScroll = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / 1000, 1); // 1秒动画
        const easeInOutQuad = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const newScrollTop = currentScrollTop + (targetScrollTop - currentScrollTop) * easeInOutQuad;
        container.scrollTop = newScrollTop;
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // 动画完成后，触发页面整体下移效果
          setTimeout(() => {
            setCurrentSection(1);
            setIsScrolling(false);
            // 重置滚动状态，允许再次触发
            setTimeout(() => setHasScrolledToBottom(false), 2000);
          }, 500);
        }
      };
      
      const startTime = performance.now();
      requestAnimationFrame(animateScroll);
    };
    
    scrollAnimation();
  };

  return (
    <div style={{
      backgroundColor: '#000000',
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      color: '#ffffff'
    }}>
      {/* TECH 文字标题 */}
      <div style={{
        position: 'fixed',
        top: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '200px',
        height: '80px',
        zIndex: 999
      }}>
        <TextPressure
          text="TECH"
          textColor="#FFFFFF"
          minFontSize={36}
          width={true}
          weight={true}
          italic={true}
          alpha={false}
          flex={false}
          stroke={false}
          scale={false}
        />
      </div>
      
      {/* 左侧 ProfileCard 区域 */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '40%',
        minWidth: '450px',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        paddingTop: '8rem',
        zIndex: 10,
        transform: `translateY(-${profileCardOffset}px)`,
        transition: 'transform 0.05s ease-out'
      }}>
        <div style={{
          width: '450px',
          height: '550px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ProfileCard
            name="Full-Stack & Visionary Dreamer"
            handle="techdev"
            status="Coding"
            contactText="Contact Me"
            avatarUrl="/主题.png"
            iconUrl="https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=tech%20icon%20pattern%20geometric%20circuit%20board%20design%20minimalist%20blue%20glow&image_size=square"
            showUserInfo={true}
            showBehindGradient={true}
            enableTilt={true}
            enableMobileTilt={true}
            onContactClick={() => console.log('Contact clicked')}
          />
        </div>
      </div>

      {/* ScrollReveal组件区域 */}
      <div 
        ref={scrollContainerRef}
        style={{
          marginLeft: '40%',
          width: '60%',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '2rem 4rem 2rem 2rem',
          paddingTop: '40rem',
          paddingBottom: '4rem',
          overflowY: 'auto',
          transform: currentSection === 1 ? 'translateY(-20vh)' : 'translateY(0)',
          transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
        <div style={{
          maxWidth: '800px',
          width: '100%',
          textAlign: 'left'
        }}>
          {/* 个人介绍 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <ScrollReveal
              enableBlur={true}
              baseOpacity={0.7}
              baseRotation={8}
              blurStrength={3}
              textClassName="text-white/90"
            >
              <div style={{ lineHeight: '1.2', color: '#e8e8e8' }}>
                我是一名充满激情的技术开发者，专注于前端开发与人工智能应用的深度融合。在这个数字化的世界里，我致力于通过代码创造美好的用户体验，分享技术探索的心得与生活中的感悟。
              </div>
            </ScrollReveal>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <ScrollReveal
              enableBlur={true}
              baseOpacity={0.7}
              baseRotation={8}
              blurStrength={3}
              textClassName="text-white/90"
            >
              <div style={{ lineHeight: '1.2', color: '#e8e8e8' }}>
                对新兴技术保持着永不熄灭的好奇心，我喜欢动手实践，从绚丽的3D可视化到智能的AI应用，不断挑战自己的技术边界。每一次技术突破都是对未知领域的勇敢探索，每一行代码都承载着对完美的不懈追求。
              </div>
            </ScrollReveal>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <ScrollReveal
              enableBlur={true}
              baseOpacity={0.7}
              baseRotation={8}
              blurStrength={3}
              textClassName="text-white/90"
            >
              <div style={{ lineHeight: '1.2', color: '#d0d0d0' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#4ecdc4' }}>前端开发：</strong>React、Vue.js、TypeScript、Vite —— 构建现代化的用户界面
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#45b7d1' }}>后端技术：</strong>Node.js、Python、Go —— 打造高性能的服务端架构
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#96ceb4' }}>AI/ML领域：</strong>TensorFlow、PyTorch、OpenAI API —— 探索人工智能的无限可能
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#ffd93d' }}>开发工具：</strong>Git、Docker、Vite、Webpack —— 提升开发效率的利器
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ color: '#ff6b6b' }}>开发环境：</strong>Windsurf、Cursor、Trae、CodeBuddy —— 现代化的编程体验
                </div>
              </div>
            </ScrollReveal>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <ScrollReveal
              enableBlur={true}
              baseOpacity={0.7}
              baseRotation={8}
              blurStrength={3}
              textClassName="text-white/90"
            >
              <div style={{ lineHeight: '1.2', color: '#e8e8e8' }}>
                目前正在深入探索Web3、区块链技术和智能合约等前沿领域，相信这些技术将重新定义数字世界的未来。在技术的海洋中，我始终保持学习的热情，与时代同步前行。
              </div>
            </ScrollReveal>
          </div>

          {/* 新的内容区域 - 当滚动到底部时显示 */}
          <div style={{
            marginTop: '4rem',
            opacity: currentSection === 1 ? 1 : 0,
            transform: currentSection === 1 ? 'translateY(0)' : 'translateY(50px)',
            transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            borderTop: '1px solid #333',
            paddingTop: '3rem'
          }}>
            <div style={{ marginBottom: '2rem' }}>
              <ScrollReveal
                enableBlur={true}
                baseOpacity={0.7}
                baseRotation={8}
                blurStrength={3}
                textClassName="text-white/90"
              >
                <div style={{ lineHeight: '1.2', color: '#e8e8e8', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  🚀 探索更多技术领域
                </div>
              </ScrollReveal>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <ScrollReveal
                enableBlur={true}
                baseOpacity={0.7}
                baseRotation={8}
                blurStrength={3}
                textClassName="text-white/90"
              >
                <div style={{ lineHeight: '1.2', color: '#d0d0d0' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ color: '#ff9f43' }}>云计算与DevOps：</strong>AWS、Docker、Kubernetes、CI/CD —— 构建现代化的部署流程
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ color: '#a55eea' }}>数据库技术：</strong>MongoDB、PostgreSQL、Redis —— 高效的数据存储与管理
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ color: '#26de81' }}>移动开发：</strong>React Native、Flutter —— 跨平台移动应用开发
                  </div>
                </div>
              </ScrollReveal>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <ScrollReveal
                enableBlur={true}
                baseOpacity={0.7}
                baseRotation={8}
                blurStrength={3}
                textClassName="text-white/90"
              >
                <div style={{ lineHeight: '1.2', color: '#e8e8e8' }}>
                  在技术的道路上，每一次学习都是一次成长，每一次实践都是一次突破。让我们一起在代码的世界中探索无限可能，用技术改变世界，用创新点亮未来。
                </div>
              </ScrollReveal>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <ScrollReveal
                enableBlur={true}
                baseOpacity={0.7}
                baseRotation={8}
                blurStrength={3}
                textClassName="text-white/90"
              >
                <div style={{ 
                  lineHeight: '1.2', 
                  color: '#4ecdc4', 
                  textAlign: 'center',
                  fontSize: '1.1rem',
                  fontStyle: 'italic'
                }}>
                  "代码是诗歌，技术是艺术，创新是灵魂。"
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechBlog;