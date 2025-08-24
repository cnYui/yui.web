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
    // 新增的旅行图片
    { image: '/images/travel/新内容/DSC00142 2.JPG', text: '列车' },
    { image: '/images/travel/新内容/DSC00573 3.JPG', text: '东京塔夜景' },
    { image: '/images/travel/新内容/IMG_5545 2.JPG', text: '名古屋城' },
    { image: '/images/travel/新内容/IMG_5626 2.JPG', text: '白狐周边' },
    { image: '/images/travel/新内容/IMG_5635 2.JPG', text: '愿望' },
    { image: '/images/travel/新内容/IMG_5638 2.JPG', text: '内部' },
    { image: '/images/travel/新内容/IMG_5742 2.JPG', text: '夜景' },
    { image: '/images/travel/新内容/IMG_5827 2.JPG', text: '人与鱼' },
    { image: '/images/travel/新内容/IMG_5844 2.JPG', text: '电锯人手办互动' },
    { image: '/images/travel/新内容/IMG_5866 2.JPG', text: '打卡点' },
    { image: '/images/travel/新内容/IMG_5880 2.JPG', text: '初遇柏青哥' },
    { image: '/images/travel/新内容/IMG_5911 2.JPG', text: '可爱西施惠' },
    { image: '/images/travel/新内容/IMG_8653 2.JPG', text: '夜晚店铺黑白照' },
    { image: '/images/travel/新内容/IMG_8683 2.JPG', text: '不知名小神社' },
    { image: '/images/travel/新内容/IMG_8685 2.JPG', text: '一秒回国' },
    { image: '/images/travel/新内容/IMG_8698 2.JPG', text: '酷图案' },
    { image: '/images/travel/新内容/IMG_8713 2.JPG', text: '米游戏还在追我' },
    { image: '/images/travel/新内容/IMG_8737 2.JPG', text: 'mai' },
    { image: '/images/travel/新内容/IMG_8776 2.JPG', text: '打卡点' },
    { image: '/images/travel/新内容/IMG_8777 2.JPG', text: '继续打卡' },
    { image: '/images/travel/新内容/IMG_8834 2.JPG', text: '大阪城' },
    { image: '/images/travel/新内容/IMG_8866 2.JPG', text: '大阪警察府' },
    { image: '/images/travel/新内容/IMG_9046 2.JPG', text: '大阪水族馆外侧' },
    { image: '/images/travel/新内容/IMG_9047 2.JPG', text: '外侧企鹅🐧' },
    { image: '/images/travel/新内容/IMG_9054 2.JPG', text: '🐟' },
    { image: '/images/travel/新内容/IMG_9098 2.JPG', text: '大鱼' },
    { image: '/images/travel/新内容/IMG_9131 2.JPG', text: '世间万物皆相连' },
    { image: '/images/travel/新内容/IMG_9196 2.JPG', text: '忘了什么塔' },
    { image: '/images/travel/新内容/IMG_9199 2.JPG', text: '打卡点' },
    { image: '/images/travel/新内容/IMG_9275 2.JPG', text: '天王寺动物园' },
    { image: '/images/travel/新内容/IMG_9337 2.JPG', text: '忘了叫什么' },
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