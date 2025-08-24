import React from 'react';
import TextPressure from '../components/TextPressure';
import ChromaGrid from '../components/ChromaGrid';

const MusicRecommend = () => {
  return (
    <div style={{
      backgroundColor: '#000000',
      minHeight: '200vh',
      width: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      color: '#ffffff'
    }}>
      {/* MUSIC 文字标题 */}
      <div style={{
        position: 'fixed',
        top: '3rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '250px',
        height: '80px',
        zIndex: 1000,
        padding: '1rem 2rem',
        borderRadius: '10px'
      }}>
        <TextPressure
          text="MUSIC"
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '8rem',
        paddingBottom: '5rem',
        width: '100%'
      }}>
        {/* ChromaGrid 音乐组件 */}
        <div style={{
          height: '2400px',
          width: '100%',
          position: 'relative'
        }}>
          <ChromaGrid 
            items={[
              {
                image: "/images/music_pic/截屏2025-08-23 14.26.27.png",
                title: "麥恩莉",
                subtitle: "方大同",
                handle: "@方大同",
                location: "方大同",

                borderColor: "#3B82F6",
                gradient: "linear-gradient(145deg, #3B82F6, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.32.33.png",
                title: "400 metres",
                subtitle: "Chinese Football",
                handle: "@chinesefootball",
                location: "Chinese Football",
                borderColor: "#8B5CF6",
                gradient: "linear-gradient(210deg, #8B5CF6, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.33.50.png",
                title: "Feather",
                subtitle: "Nujabes",
                handle: "@Nujabes",
                location: "Nujabes",
                borderColor: "#10B981",
                gradient: "linear-gradient(165deg, #10B981, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.34.24.png",
                title: "Sonny Boy",
                subtitle: "Toe",
                handle: "@Toe",
                location: "Toe",
                borderColor: "#F59E0B",
                gradient: "linear-gradient(195deg, #F59E0B, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.34.50.png",
                title: "Time",
                subtitle: "Pink Floyd",
                handle: "@PinkFloyd",
                location: "Pink Floyd",
                borderColor: "#EF4444",
                gradient: "linear-gradient(225deg, #EF4444, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.35.19.png",
                title: "Give Me The Gun",
                subtitle: "American Football",
                handle: "@American Football",
                location: "American Football",
                borderColor: "#06B6D4",
                gradient: "linear-gradient(135deg, #06B6D4, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.37.41.png",
                title: "4",
                subtitle: "aesthetics across the color line",
                handle: "@aesthetics across the color line",
                location: "aesthetics across the color line",
                borderColor: "#06B6D4",
                gradient: "linear-gradient(180deg, #06B6D4, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.38.46.png",
                title: "more than words",
                subtitle: "羊文学",
                handle: "@羊文学",
                location: "羊文学",
                borderColor: "#4F46E5",
                gradient: "linear-gradient(150deg, #4F46E5, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.39.09.png",
                title: "简单爱",
                subtitle: "周杰伦",
                handle: "@周杰伦",
                location: "周杰伦",
                borderColor: "#EC4899",
                gradient: "linear-gradient(170deg, #EC4899, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.39.42.png",
                title: "踊り子",
                subtitle: "Vaundy",
                handle: "@Vaundy",
                location: "Vaundy",
                borderColor: "#F97316",
                gradient: "linear-gradient(190deg, #F97316, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.40.14.png",
                title: "The Other Side Of Paradise",
                subtitle: "Glass Animals",
                handle: "@Glass Animals",
                location: "Glass Animals",
                borderColor: "#14B8A6",
                gradient: "linear-gradient(200deg, #14B8A6, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.40.37.png",
                title: "多分、風",
                subtitle: "魚韻",
                handle: "@魚韻",
                location: "魚韻",
                borderColor: "#84CC16",
                gradient: "linear-gradient(220deg, #84CC16, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.41.05.png",
                title: "オトノケ",
                subtitle: "Creeoy Nuts",
                handle: "@Creeoy Nuts",
                location: "Creeoy Nuts",
                borderColor: "#8B5CF6",
                gradient: "linear-gradient(240deg, #8B5CF6, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.41.39.png",
                title: "Graduation song",
                subtitle: "Murphy Radio",
                handle: "@Murphy Radio",
                location: "Murphy Radio",
                borderColor: "#0EA5E9",
                gradient: "linear-gradient(260deg, #0EA5E9, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.42.02.png",
                title: "Just the Two of Us",
                subtitle: "Grover Washington",
                handle: "@Grover Washington",
                location: "Grover Washington",
                borderColor: "#F43F5E",
                gradient: "linear-gradient(280deg, #F43F5E, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.42.38.png",
                title: "All My Life",
                subtitle: "Lil Durk,J. Cole",
                handle: "@Lil Durk,J. Cole",
                location: "Lil Durk,J. Cole",
                borderColor: "#F59E0B",
                gradient: "linear-gradient(300deg, #F59E0B, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.43.11.png",
                title: "ANTENNA",
                subtitle: "Supercar",
                handle: "@Supercar",
                location: "Supercar",
                borderColor: "#64748B",
                gradient: "linear-gradient(320deg, #64748B, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.43.41.png",
                title: "hong kong milk tea",
                subtitle: "core wave",
                handle: "@core wave",
                location: "core wave",
                borderColor: "#78716C",
                gradient: "linear-gradient(340deg, #78716C, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.44.28.png",
                title: "白日",
                subtitle: "King Gnu",
                handle: "@King Gnu",
                location: "King Gnu",
                borderColor: "#71717A",
                gradient: "linear-gradient(360deg, #71717A, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.45.29.png",
                title: "Vanilla",
                subtitle: "落日飞车",
                handle: "@落日飞车",
                location: "落日飞车",
                borderColor: "#737373",
                gradient: "linear-gradient(30deg, #737373, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.46.02.png",
                title: "You're Beautiful",
                subtitle: "James Blunt",
                handle: "@jamesblunt",
                location: "James Blunt",
                borderColor: "#6B7280",
                gradient: "linear-gradient(60deg, #6B7280, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.46.32.png",
                title: "Talking Box",
                subtitle: "Wurs",
                handle: "@wurs",
                location: "Wurs",
                borderColor: "#60A5FA",
                gradient: "linear-gradient(90deg, #60A5FA, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.47.15.png",
                title: "Yellow",
                subtitle: "Coldplay",
                handle: "@coldplay",
                location: "Coldplay",
                borderColor: "#C084FC",
                gradient: "linear-gradient(120deg, #C084FC, #000)"
              },
              {
                image: "/images/music_pic/截屏2025-08-23 14.47.41.png",
                title: "又三郎",
                subtitle: "ヨルシカ",
                handle: "@yorushika",
                location: "ヨシカ",
                borderColor: "#4ADE80",
                gradient: "linear-gradient(150deg, #4ADE80, #000)"
              }
            ]}
            columns={3}
            rows={8}
            radius={150}
            damping={0.45}
            fadeOut={0.6}
            ease="power3.out"
          />
        </div>
      </div>
    </div>
  );
};

export default MusicRecommend;