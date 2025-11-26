import React from 'react';
import TextPressure from '../components/TextPressure.jsx';

function ProjectExperience() {
  const hackathonImages = [
    {
      src: '/images/hackathon/无锡Rokid ARAI三等奖.jpg',
      title: '无锡Rokid ARAI三等奖',
      description: '在无锡Rokid ARAI比赛中荣获三等奖'
    },
    {
      src: '/images/hackathon/渝客松Google GDG赛道第一名.jpg',
      title: '渝客松Google GDG赛道第一名',
      description: '在渝客松Google GDG赛道比赛中荣获第一名'
    },
    {
      src: '/images/hackathon/AdventureX24.jpg',
      title: '2024AdventureX',
      description: '第一次观摩黑客松'
    },
    {
      src: '/images/hackathon/trae-hackathon-01.jpg',
      title: '2025AdventureX',
      description: '作为游客，第一次静距离观摩学习'
    },
    {
      src: '/images/hackathon/image.png',
      title: '腾讯云线上黑客送获奖',
      description: '宠物健康陪伴小程序，项目链接：http://xhslink.com/o/ATzpS0qsjaQ'
    },
    {
      src: '/images/hackathon/image copy 2.png',
      title: 'n8n+小红书mcp全自动定时发帖（本人还未开源）',
      description: '当前使用n8n工作流全自动运营的小红书账号：https://www.xiaohongshu.com/user/profile/5b869e548bf5ee0001f35235'
    },
    {
       src: '/images/hackathon/image copy.png',
      title: '抖音创变者线上复赛作品',
      description: 'coze工作流的法律剧场小助手，项目链接：http://xhslink.com/o/5kBv2KfGeLj'
    },
    {
      src: '/images/hackathon/trae-hackathon-02.jpg',
      title: 'Trae Solo Hackathon杭州场',
      description: '作为刚刚毕业的学生，带着一个微信小程序的经历参赛'
    },
    {
      src: '/images/hackathon/trae-hackathon-08.jpg',
      title: 'TRAE SOLO Hackathon上海场',
      description: '荣获二等奖'
    },
    {
      src: '/images/hackathon/trae-hackathon-05.jpg',
      title: '南京黑客松参赛选手',
      description: '南客松Nanckathon S1活动'
    },
    {
      src: '/images/hackathon/trae-hackathon-09.jpg',
      title: 'TRAE Friends南京',
      description: 'TRAE Friends南京站技术分享'
    },
    {
      src: '/images/hackathon/trae-hackathon-07.jpg',
      title: '安徽黑客松',
      description: '参加了徽客松，制作了随口成曲项目，项目链接：http://xhslink.com/o/9pQHBf9V1Fv'
    },
    {
      src: '/images/hackathon/trae-hackathon-04.jpg',
      title: 'TRAE Friends苏州',
      description: 'TRAE Friends苏州站技术分享'
    }
  ];



  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: 'white',
      padding: '2rem',
      paddingBottom: '8rem',
      position: 'relative'
    }}>
      {/* PROJECT 文字标题（与其他页面保持一致） */}
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
          text="PROJECT"
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

      {/* TRAE黑客松项目 */}
      <section style={{ marginBottom: '4rem', paddingTop: '8rem' }}>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '2rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {hackathonImages.map((image, index) => (
            <div key={index} style={{
              backgroundColor: '#111',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #333',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(78, 205, 196, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <img 
                src={image.src} 
                alt={image.title}
                style={{
                  width: '100%',
                  height: '250px',
                  objectFit: 'cover'
                }}
              />
              <div style={{ padding: '1.5rem', maxWidth: '100%', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                <h3 style={{
                  fontSize: '1.3rem',
                  color: '#fff',
                  marginBottom: '0.5rem'
                }}>
                  {image.title}
                </h3>
                <p style={{
                  color: '#aaa',
                  lineHeight: '1.5',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere'
                }}>
                  {image.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      
    </div>
  );
}

export default ProjectExperience;

