import React, { useState, useEffect, useRef, useCallback } from 'react';
import CircularGallery from '../components/CircularGallery';
import TextPressure from '../components/TextPressure';
import travelImages from '../data/travelImages';

const BATCH_SIZE = 15;

const TravelFootprint = () => {
    const [displayedImages, setDisplayedImages] = useState([]);
    const [hasMore, setHasMore] = useState(true);
    const scrollPosition = useRef(0);

    // 初始化加载
    useEffect(() => {
        setDisplayedImages(travelImages.slice(0, BATCH_SIZE));
    }, []);

    // 加载更多
    const loadMore = useCallback(() => {
        setDisplayedImages(prev => {
            const currentLength = prev.length;
            const nextBatch = travelImages.slice(currentLength, currentLength + BATCH_SIZE);
            if (currentLength + BATCH_SIZE >= travelImages.length) {
                setHasMore(false);
            }
            return [...prev, ...nextBatch];
        });
    }, []);

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
                    items={displayedImages}
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

            {/* 操作提示和加载更多按钮 */}
            <div style={{
                position: 'absolute',
                bottom: '6rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
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

                {hasMore && (
                    <button
                        onClick={loadMore}
                        style={{
                            padding: '0.5rem 1.5rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '20px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(5px)'
                        }}
                        onMouseEnter={e => {
                            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                            e.target.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={e => {
                            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                            e.target.style.transform = 'scale(1)';
                        }}
                    >
                        加载更多 ({travelImages.length - displayedImages.length})
                    </button>
                )}
            </div>
        </div>
    );
};

export default TravelFootprint;