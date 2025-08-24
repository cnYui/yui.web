import React from 'react';
import RippleGrid from '../components/RippleGrid';
import FallingText from '../components/FallingText';

const Home = () => {
  return (
    <>
      {/* 背景网格效果 */}
      <RippleGrid
        enableRainbow={false}
        gridColor="#2080ff"
        rippleIntensity={0.05}
        gridSize={10.0}
        gridThickness={15.0}
        fadeDistance={1.5}
        vignetteStrength={1}
        glowIntensity={0.1}
        opacity={1.0}
        gridRotation={0}
        mouseInteraction={true}
        mouseInteractionRadius={1}
      />
      
      {/* 主要内容 */}
      <main className="main-content">
        <div className="hero-section">
          <FallingText
            text="欢迎来到悠一的世界 Full-Stack & Visionary Dreamer"
            trigger="click"
            backgroundColor="transparent"
            wireframes={false}
            gravity={0.8}
            fontSize="2.5rem"
            mouseConstraintStiffness={0.3}
            className="combined-text"
          />
        </div>
      </main>
    </>
  );
};

export default Home;