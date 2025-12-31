// Language Toggle Script
(function() {
    const LANG_KEY = 'yui-portfolio-lang';
    
    // Translation data for each page
    const translations = {
        // Common elements across all pages
        common: {
            zh: {
                logo: '作品集.',
                nav: {
                    projects: '项目',
                    blog: '博客',
                    travel: '旅行',
                    music: '音乐',
                    anime: '动漫'
                }
            },
            en: {
                logo: 'Portfolio.',
                nav: {
                    projects: 'Projects',
                    blog: 'Blog',
                    travel: 'Travel',
                    music: 'Music',
                    anime: 'Anime'
                }
            }
        },
        // Index page specific
        index: {
            zh: {
                title: 'Yui | 个人作品集',
                available: '可接受工作邀请',
                hello: '你好，我是',
                name: 'Yui',
                intro: '我专注于构建简洁且用户体验优秀的数字产品。',
                role: '设计师 | 开发者 | 创作者',
                resume: '简历',
                contactMe: '联系我',
                portfolio: '作品集',
                selectedWorks: '精选作品',
                viewAll: '查看全部项目'
            },
            en: {
                title: 'Yui | Portfolio',
                available: 'Available for hire',
                hello: 'Hello, I\'m',
                name: 'Yui',
                intro: 'I focus on building clean digital products with excellent user experience.',
                role: 'Designer | Developer | Creator',
                resume: 'Resume',
                contactMe: 'Contact Me',
                portfolio: 'Portfolio',
                selectedWorks: 'Selected Works',
                viewAll: 'View All Projects'
            }
        },
        // Projects page specific
        projects: {
            zh: {
                title: '项目经历 - Yui的作品集',
                period: '2024 — 至今',
                journeyTitle: '我的技术',
                journeySubtitle: '之旅',
                journeyDesc: '从第一次作为观众参加黑客松，到在全国各地获奖。一段成长、学习和创造的时间线。',
                hackathons: '黑客松',
                awards: '奖项',
                cities: '城市',
                connections: '人脉',
                filter: '筛选:',
                all: '全部',
                award: '获奖',
                hackathon: '黑客松',
                meetup: '聚会',
                project: '项目',
                aiVideo: 'AI视频/漫画',
                loadMore: '加载更多里程碑',
                viewProject: '查看项目',
                journeyContinues: '旅程继续...',
                moreComing: '更多里程碑即将到来',
                quote: '"每一次黑客松都是学习新知识、结识优秀伙伴、突破自我极限的机会。"',
                footerText: '© 2024 Yui的旅程. 继续创造.'
            },
            en: {
                title: 'Projects - Yui\'s Portfolio',
                period: '2024 — Present',
                journeyTitle: 'My Journey',
                journeySubtitle: 'in Tech',
                journeyDesc: 'From attending my first hackathon as a spectator to winning awards across the country. A timeline of growth, learning, and creation.',
                hackathons: 'Hackathons',
                awards: 'Awards',
                cities: 'Cities',
                connections: 'Connections',
                filter: 'Filter:',
                all: 'All',
                award: 'Award',
                hackathon: 'Hackathon',
                meetup: 'Meetup',
                project: 'Project',
                aiVideo: 'AI Video/Comic',
                loadMore: 'Load More Milestones',
                viewProject: 'View Project',
                journeyContinues: 'The journey continues...',
                moreComing: 'More milestones coming soon',
                quote: '"Every hackathon is an opportunity to learn something new, meet amazing people, and push my limits."',
                footerText: '© 2024 Yui\'s Journey. Keep creating.'
            }
        },
        // Travel page specific
        travel: {
            zh: {
                title: '旅行足迹 - Yui的作品集',
                subtitle: '旅行日志 • 2024',
                mainTitle: '漫游',
                mainTitleLine2: '亚洲',
                description: '从东京的霓虹街道到京都的古老寺庙。一段穿越日本和中国的视觉之旅。',
                countries: '国家',
                cities: '城市',
                photos: '照片',
                nextDest: '下一站:',
                osaka: '大阪',
                all: '全部',
                tokyo: '东京',
                kyoto: '京都',
                nagoya: '名古屋',
                hiroshima: '广岛',
                yokohama: '横滨',
                hangzhou: '杭州',
                nanjing: '南京',
                beijing: '北京',
                food: '美食',
                others: '其他',
                loadMore: '加载更多照片',
                whereNext: '下一站去哪？',
                planning: '正在规划下一次冒险...',
                footerText: '© 2024 Yui的旅行日志. 所有回忆永存.'
            },
            en: {
                title: 'Travel - Yui\'s Portfolio',
                subtitle: 'Travel Journal • 2024',
                mainTitle: 'Wandering',
                mainTitleLine2: 'Through Asia',
                description: 'From the neon streets of Tokyo to the ancient temples of Kyoto. A visual journey across Japan and China.',
                countries: 'Countries',
                cities: 'Cities',
                photos: 'Photos',
                nextDest: 'Next destination:',
                osaka: 'Osaka',
                all: 'All',
                tokyo: 'Tokyo',
                kyoto: 'Kyoto',
                nagoya: 'Nagoya',
                hiroshima: 'Hiroshima',
                yokohama: 'Yokohama',
                hangzhou: 'Hangzhou',
                nanjing: 'Nanjing',
                beijing: 'Beijing',
                food: 'Food',
                others: 'Others',
                loadMore: 'Load More Photos',
                whereNext: 'Where to next?',
                planning: 'Planning the next adventure...',
                footerText: '© 2024 Yui\'s Travel Journal. All memories preserved.'
            }
        },
        // Blog page specific
        blog: {
            zh: {
                title: '技术博客 - Yui的作品集',
                footerText: '© 2024 Yui的博客. 持续学习.'
            },
            en: {
                title: 'Tech Blog - Yui\'s Portfolio',
                footerText: '© 2024 Yui\'s Blog. Keep learning.'
            }
        },
        // Music page specific
        music: {
            zh: {
                title: '音乐推荐 - Yui的作品集',
                footerText: '© 2024 Yui的音乐收藏. 继续聆听.'
            },
            en: {
                title: 'Music - Yui\'s Portfolio',
                footerText: '© 2024 Yui\'s Music Collection. Keep listening.'
            }
        },
        // Resume page specific
        resume: {
            zh: {
                title: 'Yui | 简历',
                footerText: '© 2025 Yui. 保留所有权利.'
            },
            en: {
                title: 'Yui | Resume',
                footerText: '© 2025 Yui. All rights reserved.'
            }
        },
        // Anime page specific
        anime: {
            zh: {
                title: '番剧推荐 - Yui的作品集',
                footerText: '© 2024 Yui的番剧收藏. 继续追番.'
            },
            en: {
                title: 'Anime - Yui\'s Portfolio',
                footerText: '© 2024 Yui\'s Anime Collection. Keep watching.'
            }
        }
    };
    
    // Get current language
    function getCurrentLang() {
        const saved = localStorage.getItem(LANG_KEY);
        return saved || 'zh'; // Default to Chinese
    }
    
    // Save language preference
    function saveLang(lang) {
        localStorage.setItem(LANG_KEY, lang);
    }
    
    // Update toggle button text
    function updateToggleButton(lang) {
        const toggleBtn = document.getElementById('langToggle');
        if (!toggleBtn) return;
        const span = toggleBtn.querySelector('span');
        if (span) {
            span.textContent = lang === 'zh' ? 'EN' : '中';
        }
    }
    
    // Detect current page
    function detectPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/index.html') return 'index';
        if (path.includes('/projects')) return 'projects';
        if (path.includes('/blog')) return 'blog';
        if (path.includes('/music')) return 'music';
        if (path.includes('/travel')) return 'travel';
        if (path.includes('/resume')) return 'resume';
        if (path.includes('/anime')) return 'anime';
        return 'index';
    }
    
    // Apply translations to page
    function applyTranslations(lang) {
        const page = detectPage();
        const common = translations.common[lang];
        const pageData = translations[page] ? translations[page][lang] : null;
        
        // Update document title if page data exists
        if (pageData && pageData.title) {
            document.title = pageData.title;
        }
        
        // Update common elements
        updateCommonElements(common);
        
        // Update page-specific elements
        if (pageData) {
            updatePageElements(page, pageData, lang);
        }
        
        // Update toggle button
        updateToggleButton(lang);
        
        // Dispatch custom event for dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, translations: pageData, common } }));
    }
    
    // Update common elements across all pages
    function updateCommonElements(data) {
        // Logo - find all logo links
        document.querySelectorAll('a[href="/"]').forEach(logo => {
            const text = logo.textContent.trim();
            if (text.includes('作品集') || text.includes('Portfolio')) {
                logo.textContent = data.logo;
            }
        });
        
        // Also update footer logo
        document.querySelectorAll('footer p.font-display').forEach(el => {
            if (el.textContent.includes('作品集') || el.textContent.includes('Portfolio')) {
                el.textContent = data.logo;
            }
        });
        
        // Navigation links
        document.querySelectorAll('nav a, header nav a').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            if (href.includes('/projects')) link.textContent = data.nav.projects;
            else if (href.includes('/blog')) link.textContent = data.nav.blog;
            else if (href.includes('/travel')) link.textContent = data.nav.travel;
            else if (href.includes('/music')) link.textContent = data.nav.music;
            else if (href.includes('/anime')) link.textContent = data.nav.anime;
        });
    }
    
    // Update page-specific elements
    function updatePageElements(page, data, lang) {
        // Use data attributes for translation targets
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (data[key] !== undefined) {
                el.textContent = data[key];
            }
        });
        
        // Update HTML attributes (like placeholder)
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (data[key]) {
                el.setAttribute('placeholder', data[key]);
            }
        });
    }
    
    // Toggle language
    function toggleLang() {
        const current = getCurrentLang();
        const next = current === 'zh' ? 'en' : 'zh';
        saveLang(next);
        applyTranslations(next);
    }
    
    // Initialize
    function init() {
        const lang = getCurrentLang();
        applyTranslations(lang);
        
        // Bind toggle button
        const toggleBtn = document.getElementById('langToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleLang);
        }
    }
    
    // Expose functions globally for dynamic content
    window.YuiLang = {
        getCurrentLang,
        getTranslations: () => translations,
        getPageTranslations: () => {
            const page = detectPage();
            const lang = getCurrentLang();
            return translations[page] ? translations[page][lang] : null;
        },
        applyTranslations,
        toggleLang
    };
    
    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
