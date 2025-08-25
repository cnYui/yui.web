import React from 'react';
import CircularGallery from '../components/CircularGallery';
import TextPressure from '../components/TextPressure';

const TravelFootprint = () => {
  // 旅行足迹图片数据
  const travelItems = [
    { image: '/images/travel/东京/IMG_6009.JPG', text: '晴空塔' },
    { image: '/images/travel/东京/IMG_5992.JPG', text: '雷门' },
    { image: '/images/travel/东京/IMG_5916.JPG', text: '皇城外地铁站' },
    { image: '/images/travel/东京/IMG_5915.JPG', text: '皇城外地铁站顶部' },
    { image: '/images/travel/京都/IMG_5685.JPG', text: '凌神洗手' },
    { image: '/images/travel/京都/IMG_5692.JPG', text: '凌神抽签' },
    { image: '/images/travel/京都/IMG_5697.JPG', text: '二年坂' },
    { image: '/images/travel/京都/IMG_5707.JPG', text: '百鬼夜行' },
    { image: '/images/travel/京都/IMG_5725.JPG', text: '金阁寺' },
    { image: '/images/travel/杭州/IMG_5282.JPG', text: '杭师大旁写字楼' },
    { image: '/images/travel/杭州/IMG_5287.JPG', text: '在杭师大同学宿舍' },
    { image: '/images/travel/杭州/IMG_5295.JPG', text: '阳台' },
    { image: '/images/travel/杭州/IMG_5308.JPG', text: '囧miku' },
    { image: '/images/travel/大阪/IMG_8947.JPG', text: '大半LV大楼' },
    { image: '/images/travel/大阪/IMG_8989.JPG', text: '假面骑士专卖店' },
    { image: '/images/travel/大阪/IMG_9013.JPG', text: '俯瞰大阪' },
    // 添加更多实际存在的旅行图片
    { image: '/images/travel/东京/IMG_5867.JPG', text: '东京街景' },
    { image: '/images/travel/东京/IMG_5882.JPG', text: '东京建筑' },
    { image: '/images/travel/东京/IMG_5899.JPG', text: '东京风光' },
    { image: '/images/travel/东京/IMG_5917.JPG', text: '东京印象' },
    { image: '/images/travel/东京/IMG_5950.JPG', text: '东京记忆' },
    { image: '/images/travel/大阪/IMG_8983.JPG', text: '大阪街头' },
    { image: '/images/travel/大阪/IMG_8992.JPG', text: '大阪风景' },
    { image: '/images/travel/大阪/IMG_9025.JPG', text: '大阪夜色' },
    { image: '/images/travel/横滨/IMG_5765.JPG', text: '横滨港口' },
    { image: '/images/travel/横滨/IMG_5780.JPG', text: '横滨风光' },
    { image: '/images/travel/横滨/IMG_5795.JPG', text: '横滨印象' },
    { image: '/images/travel/横滨/IMG_5796.JPG', text: '横滨记忆' },
    { image: '/images/travel/横滨/IMG_5812.JPG', text: '横滨夜景' },
    { image: '/images/travel/横滨/IMG_5813.JPG', text: '横滨美景' },
    { image: '/images/travel/杭州/IMG_5289.JPG', text: '杭州风光' },
    { image: '/images/travel/杭州/IMG_5293.JPG', text: '杭州印象' },
    { image: '/images/travel/杭州/IMG_5297.JPG', text: '杭州记忆' },
    { image: '/images/travel/杭州/IMG_5298.JPG', text: '杭州美景' },
    { image: '/images/travel/杭州/IMG_5299.JPG', text: '杭州时光' },
    { image: '/images/travel/杭州/IMG_5300.JPG', text: '杭州瞬间' },
    { image: '/images/travel/杭州/IMG_5316.JPG', text: '杭州街景' },
    { image: '/images/travel/杭州/IMG_5318.JPG', text: '杭州建筑' },
    { image: '/images/travel/杭州/IMG_5321.JPG', text: '杭州风情' },
    { image: '/images/travel/杭州/IMG_5336.JPG', text: '杭州回忆' },
  ];

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
      justifyContent: 'center'
    }}>
      {/* TRAVEL 文字标题 */}
      <div style={{
        position: 'absolute',
        top: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '300px',
        height: '80px',
        zIndex: 20
      }}>
        <TextPressure 
          text="TRAVEL"
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
      {/* 圆形画廊组件 - 完全居中并放大 */}
      <div style={{
        width: '90vw',
        height: '90vh',
        maxWidth: '1200px',
        maxHeight: '800px',
        position: 'relative'
      }}>
        <CircularGallery 
          items={travelItems}
          bend={1}
          textColor="#ffffff"
          borderRadius={0.05}
          font="bold 24px 'Microsoft YaHei', sans-serif"
          scrollSpeed={2}
          scrollEase={0.05}
        />
      </div>
      
      {/* 操作提示 */}
      <div style={{
        position: 'absolute',
        bottom: '6rem',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#ffffff',
        fontSize: '1rem',
        textAlign: 'center',
        opacity: 0.7,
        zIndex: 10
      }}>
        拖拽或滚动鼠标浏览旅行回忆
      </div>
    </div>
  );
};

export default TravelFootprint;