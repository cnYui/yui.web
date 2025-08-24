import React from 'react';
import TextPressure from '../components/TextPressure';
import RollingGallery from '../components/RollingGallery';

const AnimeRecommend = () => {
  return (
    <div style={{
      backgroundColor: '#000000',
      minHeight: '100vh',
      width: '100%',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#ffffff'
    }}>
      {/* ANIME 文字标题 */}
      <div style={{
        position: 'absolute',
        top: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '250px',
        height: '80px',
        zIndex: 20
      }}>
        <TextPressure
          text="ANIME"
          textColor="#FFFFFF"
          minFontSize={48}
          width={true}
          weight={true}
          italic={true}
          alpha={false}
          flex={false}
          stroke={false}
          scale={false}
        />
      </div>
      
      {/* 页面内容区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <RollingGallery autoplay={true} pauseOnHover={true} speed={0.15} />
      </div>
    </div>
  );
};

export default AnimeRecommend;