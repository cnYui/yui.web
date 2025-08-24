import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Dock from './components/Dock';
import Home from './pages/Home';
import TechBlog from './pages/TechBlog';
import AnimeRecommend from './pages/AnimeRecommend';
import MusicRecommend from './pages/MusicRecommend';
import TravelFootprint from './pages/TravelFootprint';
import './App.css';

function AppContent() {
  const navigate = useNavigate();
  
  // 导航项配置
  const dockItems = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
      ),
      label: '首页',
      onClick: () => navigate('/')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" x2="8" y1="13" y2="13"/>
          <line x1="16" x2="8" y1="17" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
      ),
      label: '技术博客',
      onClick: () => navigate('/tech-blog')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"/>
          <rect width="15" height="14" x="1" y="5" rx="2" ry="2"/>
        </svg>
      ),
      label: '番剧推荐',
      onClick: () => navigate('/anime-recommend')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10,8 16,12 10,16 10,8"/>
        </svg>
      ),
      label: '音乐推荐',
      onClick: () => navigate('/music-recommend')
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      label: '旅行足迹',
      onClick: () => navigate('/travel-footprint')
    }
  ];

  return (
    <div className="app">
      {/* 路由内容 */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tech-blog" element={<TechBlog />} />
        <Route path="/anime-recommend" element={<AnimeRecommend />} />
        <Route path="/music-recommend" element={<MusicRecommend />} />
        <Route path="/travel-footprint" element={<TravelFootprint />} />
      </Routes>
      
      {/* 底部导航栏 */}
      <Dock 
        items={dockItems}
        panelHeight={64}
        baseItemSize={48}
        magnification={70}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;