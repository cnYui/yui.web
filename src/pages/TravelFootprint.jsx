import React, { useRef, useCallback } from 'react';
import CircularGallery from '../components/CircularGallery';
import TextPressure from '../components/TextPressure';
import travelImages from '../data/travelImages';

const TravelFootprint = () => {
    const scrollPosition = useRef(0);

    // 处理滚动位置更新
    const handleScroll = useCallback((currentScroll) => {
        scrollPosition.current = currentScroll;
    }, []);

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
                width: '250px',
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
                    items={travelImages}
                    bend={1}
                    textColor="#ffffff"
                    borderRadius={0.05}
                    font="bold 24px 'Microsoft YaHei', sans-serif"
                    scrollSpeed={2}
                    scrollEase={0.05}
                    initialScroll={scrollPosition.current}
                    onScroll={handleScroll}
                />
            </div>

            {/* 操作提示 */}
            <div style={{
                position: 'absolute',
                bottom: '6rem',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10
            }}>
                <div style={{
                    color: '#ffffff',
                    fontSize: '1rem',
                    textAlign: 'center',
                    opacity: 0.7,
                }}>
                    拖拽或滚动鼠标浏览旅行回忆
                </div>
            </div>
        </div>
    );
};

export default TravelFootprint;