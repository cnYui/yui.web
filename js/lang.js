// Language Toggle Script
(function() {
    const LANG_KEY = 'yui-portfolio-lang';
    const LANGUAGES = ['zh', 'en', 'ja']; // 语言顺序：中文 → 英文 → 日语
    
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
            },
            ja: {
                logo: 'ポートフォリオ.',
                nav: {
                    projects: 'プロジェクト',
                    blog: 'ブログ',
                    travel: '旅行',
                    music: '音楽',
                    anime: 'アニメ'
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
                agentInfoLabel: '将这个网址发给你的 agent 即可获得我的信息：',
                resume: '简历',
                contactMe: '联系我',
                portfolio: '作品集',
                selectedWorks: '精选作品',
                viewAll: '查看全部项目',
                bridgeTitle: '连接设计与代码的桥梁。',
                yearsExp: '年经验',
                projects: '项目',
                awards: '奖项',
                satisfaction: '满意度',
                aboutDesc: '我是一位充满热情的创作者，专注于构建直观且美观的数字体验。凭借设计和开发的双重背景，我深刻理解项目的技术限制和美学需求。',
                userCentric: '以用户为中心的方法',
                cleanCode: '简洁的代码架构',
                pixelPerfect: '像素级精准实现',
                learnMore: '了解更多',
                journal: '日志',
                latestThoughts: '最新想法',
                footerDesc: '用心和代码打造数字体验。坐标旧金山。专注于简洁、实用、用户友好的设计。',
                menu: '菜单',
                about: '关于',
                work: '作品',
                blog: '博客',
                contact: '联系',
                contactInfo: '联系方式',
                copyright: '© 2026 Yui. 保留所有权利。',
                privacy: '隐私政策',
                terms: '使用条款'
            },
            en: {
                title: 'Yui | Portfolio',
                available: 'Available for hire',
                hello: 'Hello, I\'m',
                name: 'Yui',
                intro: 'I focus on building clean digital products with excellent user experience.',
                role: 'Designer | Developer | Creator',
                agentInfoLabel: 'Send this URL to your agent to get my information:',
                resume: 'Resume',
                contactMe: 'Contact Me',
                portfolio: 'Portfolio',
                selectedWorks: 'Selected Works',
                viewAll: 'View All Projects',
                bridgeTitle: 'Bridging Design and Code.',
                yearsExp: 'Years Exp',
                projects: 'Projects',
                awards: 'Awards',
                satisfaction: 'Satisfaction',
                aboutDesc: 'I\'m a passionate creator focused on building intuitive and beautiful digital experiences. With a dual background in design and development, I deeply understand both technical constraints and aesthetic needs.',
                userCentric: 'User-centric approach',
                cleanCode: 'Clean code architecture',
                pixelPerfect: 'Pixel-perfect implementation',
                learnMore: 'Learn More',
                journal: 'Journal',
                latestThoughts: 'Latest Thoughts',
                footerDesc: 'Crafting digital experiences with heart and code. Based in San Francisco. Focused on clean, practical, user-friendly design.',
                menu: 'Menu',
                about: 'About',
                work: 'Work',
                blog: 'Blog',
                contact: 'Contact',
                contactInfo: 'Contact',
                copyright: '© 2026 Yui. All rights reserved.',
                privacy: 'Privacy Policy',
                terms: 'Terms of Use'
            },
            ja: {
                title: 'Yui | ポートフォリオ',
                available: '仕事募集中',
                hello: 'こんにちは、',
                name: 'Yuiです',
                intro: 'クリーンで優れたユーザー体験を持つデジタルプロダクトの構築に注力しています。',
                role: 'デザイナー | 開発者 | クリエイター',
                agentInfoLabel: 'この URL をあなたの agent に送ると、私の情報を取得できます：',
                resume: '履歴書',
                contactMe: 'お問い合わせ',
                portfolio: 'ポートフォリオ',
                selectedWorks: '厳選作品',
                viewAll: 'すべてのプロジェクトを見る',
                bridgeTitle: 'デザインとコードをつなぐ架け橋。',
                yearsExp: '年の経験',
                projects: 'プロジェクト',
                awards: '受賞',
                satisfaction: '満足度',
                aboutDesc: '私は直感的で美しいデジタル体験の構築に情熱を注ぐクリエイターです。デザインと開発の両方のバックグラウンドを持ち、技術的制約と美的ニーズの両方を深く理解しています。',
                userCentric: 'ユーザー中心のアプローチ',
                cleanCode: 'クリーンなコード設計',
                pixelPerfect: 'ピクセルパーフェクトな実装',
                learnMore: '詳しく見る',
                journal: 'ジャーナル',
                latestThoughts: '最新の考え',
                footerDesc: '心とコードでデジタル体験を創造。サンフランシスコ在住。クリーンで実用的、ユーザーフレンドリーなデザインに注力。',
                menu: 'メニュー',
                about: '概要',
                work: '作品',
                blog: 'ブログ',
                contact: '連絡先',
                contactInfo: '連絡先',
                copyright: '© 2026 Yui. All rights reserved.',
                privacy: 'プライバシーポリシー',
                terms: '利用規約'
            }
        },
        // Projects page specific
        projects: {
            zh: {
                title: '项目经历 - Yui的作品集',
                period: '2026 — 至今',
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
                footerText: '© 2026 Yui的旅程. 继续创造.'
            },
            en: {
                title: 'Projects - Yui\'s Portfolio',
                period: '2026 — Present',
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
                footerText: '© 2026 Yui\'s Journey. Keep creating.'
            },
            ja: {
                title: 'プロジェクト - Yuiのポートフォリオ',
                period: '2026 — 現在',
                journeyTitle: '私の技術',
                journeySubtitle: 'の旅',
                journeyDesc: '初めて観客としてハッカソンに参加してから、全国で受賞するまで。成長、学習、創造のタイムライン。',
                hackathons: 'ハッカソン',
                awards: '受賞',
                cities: '都市',
                connections: 'つながり',
                filter: 'フィルター:',
                all: 'すべて',
                award: '受賞',
                hackathon: 'ハッカソン',
                meetup: 'ミートアップ',
                project: 'プロジェクト',
                aiVideo: 'AI動画/漫画',
                loadMore: 'もっと見る',
                viewProject: 'プロジェクトを見る',
                journeyContinues: '旅は続く...',
                moreComing: 'さらなるマイルストーンが近日公開',
                quote: '「すべてのハッカソンは、新しいことを学び、素晴らしい人々と出会い、自分の限界を押し広げる機会です。」',
                footerText: '© 2026 Yuiの旅. 創造し続ける.'
            }
        },
        // Travel page specific
        travel: {
            zh: {
                title: '旅行足迹 - Yui的作品集',
                subtitle: '旅行日志 • 2026',
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
                footerText: '© 2026 Yui的旅行日志. 所有回忆永存.'
            },
            en: {
                title: 'Travel - Yui\'s Portfolio',
                subtitle: 'Travel Journal • 2026',
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
                footerText: '© 2026 Yui\'s Travel Journal. All memories preserved.'
            },
            ja: {
                title: '旅行 - Yuiのポートフォリオ',
                subtitle: '旅行日記 • 2026',
                mainTitle: 'アジアを',
                mainTitleLine2: '巡る旅',
                description: '東京のネオン街から京都の古寺まで。日本と中国を巡るビジュアルジャーニー。',
                countries: '国',
                cities: '都市',
                photos: '写真',
                nextDest: '次の目的地:',
                osaka: '大阪',
                all: 'すべて',
                tokyo: '東京',
                kyoto: '京都',
                nagoya: '名古屋',
                hiroshima: '広島',
                yokohama: '横浜',
                hangzhou: '杭州',
                nanjing: '南京',
                beijing: '北京',
                food: 'グルメ',
                others: 'その他',
                loadMore: 'もっと写真を見る',
                whereNext: '次はどこへ？',
                planning: '次の冒険を計画中...',
                footerText: '© 2026 Yuiの旅行日記. すべての思い出を保存.'
            }
        },
        // Blog page specific
        blog: {
            zh: {
                title: '技术博客 - Yui的作品集',
                search: '搜索',
                searchPlaceholder: '搜索文章...',
                topics: '主题',
                allPosts: '全部文章',
                frontend: '前端',
                backend: '后端',
                devops: '运维',
                design: '设计',
                ai: '人工智能',
                authorRole: '开发者 & 创作者',
                authorBio: '热衷于构建无障碍的 Web 应用，并乐于分享编程知识。',
                loadMore: '加载更多文章',
                noMore: '已经到底啦，没有更多文章了。',
                readArticle: '阅读文章',
                footerTitle: 'Yui的作品集',
                footerText: '© 2026 技术博客.',
                backToBlog: '返回博客',
                tags: '标签:',
                shareArticle: '分享文章:',
                relatedArticles: '相关文章'
            },
            en: {
                title: 'Tech Blog - Yui\'s Portfolio',
                search: 'Search',
                searchPlaceholder: 'Search articles...',
                topics: 'Topics',
                allPosts: 'All Posts',
                frontend: 'Frontend',
                backend: 'Backend',
                devops: 'DevOps',
                design: 'Design',
                ai: 'AI',
                authorRole: 'Developer & Creator',
                authorBio: 'Passionate about building accessible web apps and sharing programming knowledge.',
                loadMore: 'Load More Articles',
                noMore: 'That\'s all! No more articles.',
                readArticle: 'Read Article',
                footerTitle: 'Yui\'s Portfolio',
                footerText: '© 2026 Tech Blog.',
                backToBlog: 'Back to Blog',
                tags: 'Tags:',
                shareArticle: 'Share this article:',
                relatedArticles: 'Related Articles'
            },
            ja: {
                title: '技術ブログ - Yuiのポートフォリオ',
                search: '検索',
                searchPlaceholder: '記事を検索...',
                topics: 'トピック',
                allPosts: 'すべての記事',
                frontend: 'フロントエンド',
                backend: 'バックエンド',
                devops: 'DevOps',
                design: 'デザイン',
                ai: 'AI',
                authorRole: '開発者 & クリエイター',
                authorBio: 'アクセシブルなWebアプリの構築とプログラミング知識の共有に情熱を注いでいます。',
                loadMore: 'もっと記事を見る',
                noMore: 'これで全部です！記事はもうありません。',
                readArticle: '記事を読む',
                footerTitle: 'Yuiのポートフォリオ',
                footerText: '© 2026 技術ブログ.',
                backToBlog: 'ブログに戻る',
                tags: 'タグ:',
                shareArticle: 'この記事をシェア:',
                relatedArticles: '関連記事'
            }
        },
        // Skill page specific
        skill: {
            zh: {
                title: 'Yui Intro Skill',
                brand: 'Yui Skill.',
                navRawMarkdown: 'Raw Markdown',
                navPortfolio: '作品集',
                eyebrowAgent: '可供 agent 读取的档案',
                eyebrowMarkdown: 'Markdown 实时渲染',
                statusLoading: '正在加载 /SKILL.md...',
                statusError: '加载 /SKILL.md 失败:'
            },
            en: {
                title: 'Yui Intro Skill',
                brand: 'Yui Skill.',
                navRawMarkdown: 'Raw Markdown',
                navPortfolio: 'Portfolio',
                eyebrowAgent: 'Agent-readable profile',
                eyebrowMarkdown: 'Markdown rendered live',
                statusLoading: 'Loading /SKILL.md...',
                statusError: 'Failed to load /SKILL.md:'
            },
            ja: {
                title: 'Yui Intro Skill',
                brand: 'Yui スキル.',
                navRawMarkdown: 'Raw Markdown',
                navPortfolio: 'ポートフォリオ',
                eyebrowAgent: 'エージェントが読めるプロフィール',
                eyebrowMarkdown: 'Markdown をライブレンダリング',
                statusLoading: '/SKILL.md を読み込み中...',
                statusError: '/SKILL.md の読み込みに失敗しました:'
            }
        },
        // Notfound page specific
        notfound: {
            zh: {
                title: '404 - 页面未找到',
                heading: '页面未找到',
                description: '抱歉，您访问的页面不存在。',
                homeLink: '返回首页'
            },
            en: {
                title: '404 - Page Not Found',
                heading: 'Page Not Found',
                description: 'Sorry, the page you are looking for does not exist.',
                homeLink: 'Return home'
            },
            ja: {
                title: '404 - ページが見つかりません',
                heading: 'ページが見つかりません',
                description: '申し訳ありません、お探しのページは存在しません。',
                homeLink: 'ホームに戻る'
            }
        },
        // Music page specific
        music: {
            zh: {
                title: '音乐推荐 - Yui的作品集',
                collection: '音乐收藏',
                mainTitle: '音乐与',
                mainTitleItalic: '氛围.',
                description: '精心挑选的跨流派音乐收藏。从日本流行到爵士，从嘻哈到数学摇滚。',
                tracks: '曲目',
                artists: '艺术家',
                genres: '流派',
                mood: '心情',
                moodValue: '放松',
                browseByGenre: '按流派浏览',
                all: '全部',
                jpop: '日本流行',
                rock: '摇滚',
                hiphop: '嘻哈',
                jazz: '爵士',
                cpop: '华语流行',
                electronic: '电子',
                editorChoice: '编辑推荐',
                currentFavorite: '当前最爱: Feather',
                editorDesc: '来自 Nujabes。这位传奇爵士嘻哈制作人与 Cise Starr 合作的杰作。流畅的爵士采样与嘻哈节拍的完美融合，定义了一个时代。',
                listenNow: '立即收听',
                theCollection: '音乐合集',
                showing: '显示',
                loadMore: '加载更多曲目',
                endTitle: '播放列表到底了！',
                endDesc: '持续发现新音乐，敬请期待更新。',
                suggestTrack: '推荐曲目',
                footerTitle: 'Yui的作品集',
                footerText: '© 2026 音乐收藏.'
            },
            en: {
                title: 'Music - Yui\'s Portfolio',
                collection: 'Music Collection',
                mainTitle: 'Music &',
                mainTitleItalic: 'Vibes.',
                description: 'A curated collection of music across genres. From J-Pop to Jazz, Hip-Hop to Math Rock.',
                tracks: 'Tracks',
                artists: 'Artists',
                genres: 'Genres',
                mood: 'Mood',
                moodValue: 'Chill',
                browseByGenre: 'Browse by Genre',
                all: 'All',
                jpop: 'J-Pop',
                rock: 'Rock',
                hiphop: 'Hip-Hop',
                jazz: 'Jazz',
                cpop: 'C-Pop',
                electronic: 'Electronic',
                editorChoice: 'Editor\'s Choice',
                currentFavorite: 'Current Favorite: Feather',
                editorDesc: 'By Nujabes. A masterpiece collaboration with Cise Starr from the legendary jazz-hop producer. Smooth jazz samples blended with hip-hop beats that defined an era.',
                listenNow: 'Listen Now',
                theCollection: 'The Collection',
                showing: 'Showing',
                loadMore: 'Load More Tracks',
                endTitle: 'End of playlist!',
                endDesc: 'Always discovering new music. Stay tuned for updates.',
                suggestTrack: 'Suggest a Track',
                footerTitle: 'Yui\'s Portfolio',
                footerText: '© 2026 Music Collection.'
            },
            ja: {
                title: '音楽 - Yuiのポートフォリオ',
                collection: '音楽コレクション',
                mainTitle: '音楽と',
                mainTitleItalic: 'バイブス.',
                description: 'ジャンルを超えた厳選音楽コレクション。J-Popからジャズ、ヒップホップからマスロックまで。',
                tracks: 'トラック',
                artists: 'アーティスト',
                genres: 'ジャンル',
                mood: 'ムード',
                moodValue: 'チル',
                browseByGenre: 'ジャンルで探す',
                all: 'すべて',
                jpop: 'J-Pop',
                rock: 'ロック',
                hiphop: 'ヒップホップ',
                jazz: 'ジャズ',
                cpop: 'C-Pop',
                electronic: 'エレクトロニック',
                editorChoice: 'エディターズチョイス',
                currentFavorite: '今のお気に入り: Feather',
                editorDesc: 'Nujabesによる作品。伝説的なジャズホッププロデューサーとCise Starrのコラボレーション傑作。スムースなジャズサンプルとヒップホップビートの完璧な融合で、一つの時代を定義しました。',
                listenNow: '今すぐ聴く',
                theCollection: 'コレクション',
                showing: '表示中',
                loadMore: 'もっとトラックを見る',
                endTitle: 'プレイリストの終わり！',
                endDesc: '常に新しい音楽を発見中。更新をお楽しみに。',
                suggestTrack: 'トラックを提案',
                footerTitle: 'Yuiのポートフォリオ',
                footerText: '© 2026 音楽コレクション.'
            }
        },
        // Resume page specific
        resume: {
            zh: {
                title: 'Yui | 简历',
                badge: '个人简历',
                mainTitle: '职业',
                mainTitleItalic: '历程',
                mainDesc: '我的职业生涯、教育背景和一路培养的技能时间线。致力于打造卓越的数字体验。',
                downloadPdf: '下载PDF简历',
                experience: '工作经历',
                job1Title: '研发/运维实习生',
                job1Period: '2025 — 至今',
                job1Company: '国家能源科研所 • 南京',
                job1Desc: '主导向量数据库和 Agentic RAG 系统构建，负责国能报告的 GraphRAG 知识图谱开发与优化。',
                job1Item1: '设计并实现基于向量数据库的语义检索系统。',
                job1Item2: '构建 Agentic RAG 架构，提升知识问答准确率。',
                job1Item3: '开发 GraphRAG 知识图谱，优化国能报告的智能分析能力。',
                education: '教育背景',
                edu1Title: '福井大学 在读',
                edu1Period: '2025 — 2027',
                edu1School: '日本福井大学',
                edu2Title: '人工智能学士',
                edu2Period: '2021 — 2025',
                edu2School: '山东交通学院',
                skills: '技能专长',
                skillDesign: '设计',
                skillDev: '开发',
                skillTools: '工具',
                skillUI: '用户界面',
                skillResearch: '用户研究',
                skillPrototype: '原型设计',
                skillDesignSystem: '设计系统',
                skillWireframe: '线框图',
                awards: '荣誉奖项',
                award1Title: '优秀毕业设计',
                award1Source: '山东交通学院 • 2025',
                award2Title: 'TRAE 黑客松二等奖',
                award2Source: 'TRAE Solo Hackathon • 2025',
                award3Title: '渝客松线上一等奖',
                award3Source: '渝客松 Google GDG 赛道 • 2025',
                award4Title: 'Rokid AI 眼镜三等奖',
                award4Source: '无锡 Rokid AR AI • 2025',
                award5Title: '腾讯云黑客松获奖',
                award5Source: '腾讯云 Hackathon • 2025',
                footerDesc: '用心和代码打造数字体验。坐标旧金山。专注于简洁、实用、用户友好的设计。',
                menu: '菜单',
                menuAbout: '关于',
                menuWork: '作品',
                menuBlog: '博客',
                menuContact: '联系',
                contactInfo: '联系方式',
                copyright: '© 2026 Yui. 保留所有权利.',
                privacy: '隐私政策',
                terms: '使用条款'
            },
            en: {
                title: 'Yui | Resume',
                badge: 'Resume',
                mainTitle: 'Professional',
                mainTitleItalic: 'Journey',
                mainDesc: 'A timeline of my career, education, and skills developed along the way. Dedicated to crafting exceptional digital experiences.',
                downloadPdf: 'Download PDF Resume',
                experience: 'Experience',
                job1Title: 'R&D / DevOps Intern',
                job1Period: '2025 — Present',
                job1Company: 'National Energy Research Institute • Nanjing',
                job1Desc: 'Leading the development of vector database and Agentic RAG systems, responsible for GraphRAG knowledge graph development and optimization for national energy reports.',
                job1Item1: 'Designed and implemented semantic retrieval system based on vector database.',
                job1Item2: 'Built Agentic RAG architecture to improve Q&A accuracy.',
                job1Item3: 'Developed GraphRAG knowledge graph to enhance intelligent analysis of energy reports.',
                education: 'Education',
                edu1Title: 'University of Fukui (Current)',
                edu1Period: '2025 — 2027',
                edu1School: 'University of Fukui, Japan',
                edu2Title: 'B.S. Artificial Intelligence',
                edu2Period: '2021 — 2025',
                edu2School: 'Shandong Jiaotong University',
                skills: 'Skills',
                skillDesign: 'Design',
                skillDev: 'Development',
                skillTools: 'Tools',
                skillUI: 'UI Design',
                skillResearch: 'User Research',
                skillPrototype: 'Prototyping',
                skillDesignSystem: 'Design Systems',
                skillWireframe: 'Wireframing',
                awards: 'Awards',
                award1Title: 'Outstanding Graduation Project',
                award1Source: 'Shandong Jiaotong University • 2025',
                award2Title: 'TRAE Hackathon 2nd Place',
                award2Source: 'TRAE Solo Hackathon • 2025',
                award3Title: 'Yukesong Online 1st Place',
                award3Source: 'Yukesong Google GDG Track • 2025',
                award4Title: 'Rokid AI Glasses 3rd Place',
                award4Source: 'Wuxi Rokid AR AI • 2025',
                award5Title: 'Tencent Cloud Hackathon Award',
                award5Source: 'Tencent Cloud Hackathon • 2025',
                footerDesc: 'Crafting digital experiences with heart and code. Based in San Francisco. Focused on clean, practical, user-friendly design.',
                menu: 'Menu',
                menuAbout: 'About',
                menuWork: 'Work',
                menuBlog: 'Blog',
                menuContact: 'Contact',
                contactInfo: 'Contact',
                copyright: '© 2026 Yui. All rights reserved.',
                privacy: 'Privacy Policy',
                terms: 'Terms of Use'
            },
            ja: {
                title: 'Yui | 履歴書',
                badge: '履歴書',
                mainTitle: 'プロフェッショナル',
                mainTitleItalic: 'ジャーニー',
                mainDesc: 'キャリア、学歴、そして培ってきたスキルのタイムライン。卓越したデジタル体験の創造に専念。',
                downloadPdf: 'PDF履歴書をダウンロード',
                experience: '職歴',
                job1Title: 'R&D / DevOps インターン',
                job1Period: '2025 — 現在',
                job1Company: '国家エネルギー研究所 • 南京',
                job1Desc: 'ベクトルデータベースとAgentic RAGシステムの開発をリード。国家エネルギーレポートのGraphRAGナレッジグラフの開発と最適化を担当。',
                job1Item1: 'ベクトルデータベースに基づくセマンティック検索システムを設計・実装。',
                job1Item2: 'Agentic RAGアーキテクチャを構築し、Q&A精度を向上。',
                job1Item3: 'GraphRAGナレッジグラフを開発し、エネルギーレポートのインテリジェント分析を強化。',
                education: '学歴',
                edu1Title: '福井大学（在学中）',
                edu1Period: '2025 — 2027',
                edu1School: '福井大学、日本',
                edu2Title: '人工知能学士',
                edu2Period: '2021 — 2025',
                edu2School: '山東交通学院',
                skills: 'スキル',
                skillDesign: 'デザイン',
                skillDev: '開発',
                skillTools: 'ツール',
                skillUI: 'UIデザイン',
                skillResearch: 'ユーザーリサーチ',
                skillPrototype: 'プロトタイピング',
                skillDesignSystem: 'デザインシステム',
                skillWireframe: 'ワイヤーフレーム',
                awards: '受賞歴',
                award1Title: '優秀卒業プロジェクト',
                award1Source: '山東交通学院 • 2025',
                award2Title: 'TRAE ハッカソン 2位',
                award2Source: 'TRAE Solo Hackathon • 2025',
                award3Title: '渝客松オンライン 1位',
                award3Source: '渝客松 Google GDG トラック • 2025',
                award4Title: 'Rokid AIメガネ 3位',
                award4Source: '無錫 Rokid AR AI • 2025',
                award5Title: 'テンセントクラウドハッカソン受賞',
                award5Source: 'テンセントクラウド Hackathon • 2025',
                footerDesc: '心とコードでデジタル体験を創造。サンフランシスコ在住。クリーンで実用的、ユーザーフレンドリーなデザインに注力。',
                menu: 'メニュー',
                menuAbout: '概要',
                menuWork: '作品',
                menuBlog: 'ブログ',
                menuContact: '連絡先',
                contactInfo: '連絡先',
                copyright: '© 2026 Yui. All rights reserved.',
                privacy: 'プライバシーポリシー',
                terms: '利用規約'
            }
        },
        // Anime page specific
        anime: {
            zh: {
                title: '番剧推荐 - Yui的作品集',
                collection: '番剧收藏',
                mainTitle: '番剧与',
                mainTitleItalic: '推荐.',
                description: '精心挑选的番剧收藏。从经典到冷门佳作，塑造了我的品味。',
                total: '总数',
                types: '类型',
                favorites: '最爱',
                watching: '在追',
                browseByGenre: '按类型浏览',
                all: '全部',
                action: '动作',
                sliceOfLife: '日常',
                romance: '恋爱',
                fantasy: '奇幻',
                drama: '剧情',
                music: '音乐',
                editorChoice: '编辑推荐',
                currentFavorite: '当前最爱',
                editorDesc: '探索我个人收藏中的最佳番剧。每一部作品都代表着不同类型和叙事风格的独特旅程。',
                viewDetails: '查看详情',
                theCollection: '番剧合集',
                showing: '显示',
                loadMore: '加载更多番剧',
                endTitle: '收藏到底了！',
                endDesc: '持续追番中，敬请期待更新。',
                suggestAnime: '推荐番剧',
                footerTitle: 'Yui的作品集',
                footerText: '© 2026 番剧收藏.'
            },
            en: {
                title: 'Anime - Yui\'s Portfolio',
                collection: 'Anime Collection',
                mainTitle: 'Anime &',
                mainTitleItalic: 'Recommendations.',
                description: 'A curated collection of anime. From classics to hidden gems that shaped my taste.',
                total: 'Total',
                types: 'Types',
                favorites: 'Favorites',
                watching: 'Watching',
                browseByGenre: 'Browse by Genre',
                all: 'All',
                action: 'Action',
                sliceOfLife: 'Slice of Life',
                romance: 'Romance',
                fantasy: 'Fantasy',
                drama: 'Drama',
                music: 'Music',
                editorChoice: 'Editor\'s Choice',
                currentFavorite: 'Current Favorite',
                editorDesc: 'Explore the best anime from my personal collection. Each title represents a unique journey through different genres and storytelling styles.',
                viewDetails: 'View Details',
                theCollection: 'The Collection',
                showing: 'Showing',
                loadMore: 'Load More Titles',
                endTitle: 'That\'s the collection!',
                endDesc: 'Always watching new anime. Check back for updates.',
                suggestAnime: 'Suggest an Anime',
                footerTitle: 'Yui\'s Portfolio',
                footerText: '© 2026 Anime Collection.'
            },
            ja: {
                title: 'アニメ - Yuiのポートフォリオ',
                collection: 'アニメコレクション',
                mainTitle: 'アニメと',
                mainTitleItalic: 'おすすめ.',
                description: '厳選されたアニメコレクション。クラシックから隠れた名作まで、私の好みを形作った作品たち。',
                total: '合計',
                types: 'タイプ',
                favorites: 'お気に入り',
                watching: '視聴中',
                browseByGenre: 'ジャンルで探す',
                all: 'すべて',
                action: 'アクション',
                sliceOfLife: '日常',
                romance: 'ロマンス',
                fantasy: 'ファンタジー',
                drama: 'ドラマ',
                music: '音楽',
                editorChoice: 'エディターズチョイス',
                currentFavorite: '今のお気に入り',
                editorDesc: '私のコレクションから最高のアニメを探索。各作品は異なるジャンルとストーリーテリングスタイルを通じたユニークな旅を表しています。',
                viewDetails: '詳細を見る',
                theCollection: 'コレクション',
                showing: '表示中',
                loadMore: 'もっとタイトルを見る',
                endTitle: 'コレクションの終わり！',
                endDesc: '常に新しいアニメを視聴中。更新をお楽しみに。',
                suggestAnime: 'アニメを提案',
                footerTitle: 'Yuiのポートフォリオ',
                footerText: '© 2026 アニメコレクション.'
            }
        }
    };
    
    // Get current language
    function getCurrentLang() {
        const saved = localStorage.getItem(LANG_KEY);
        return saved || 'en'; // Default to English
    }
    
    // Save language preference
    function saveLang(lang) {
        localStorage.setItem(LANG_KEY, lang);
    }
    
    // Update toggle button text - shows next language
    function updateToggleButton(lang) {
        const toggleBtn = document.getElementById('langToggle');
        if (!toggleBtn) return;
        const span = toggleBtn.querySelector('span');
        if (span) {
            // 显示下一个语言的标识
            const currentIndex = LANGUAGES.indexOf(lang);
            const nextIndex = (currentIndex + 1) % LANGUAGES.length;
            const nextLang = LANGUAGES[nextIndex];
            const labels = { zh: '中', en: 'EN', ja: '日' };
            span.textContent = labels[nextLang];
        }
    }
    
    // Detect current page
    function detectPage() {
        const path = window.location.pathname;
        if (path === '/404.html' || path === '/404') return 'notfound';
        if (path === '/skill' || path.startsWith('/skill/')) return 'skill';
        if (path === '/' || path === '/index.html' || (path.endsWith('/index.html') && !path.includes('/projects') && !path.includes('/blog') && !path.includes('/music') && !path.includes('/travel') && !path.includes('/resume') && !path.includes('/anime'))) return 'index';
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
        
        // Update page-specific elements using data-i18n attributes
        if (pageData) {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (pageData[key] !== undefined) {
                    el.textContent = pageData[key];
                }
            });
            
            // Update HTML attributes (like placeholder)
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (pageData[key]) {
                    el.setAttribute('placeholder', pageData[key]);
                }
            });
        }
        
        // Update toggle button
        updateToggleButton(lang);
        
        // Dispatch custom event for dynamic content
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, page, translations: pageData, common } }));
    }
    
    // Update common elements across all pages
    function updateCommonElements(data) {
        // Logo - find all logo links
        document.querySelectorAll('a[href="/"]').forEach(logo => {
            const text = logo.textContent.trim();
            if (text.includes('作品集') || text.includes('Portfolio') || text.includes('ポートフォリオ')) {
                logo.textContent = data.logo;
            }
        });
        
        // Also update footer logo
        document.querySelectorAll('footer .font-display').forEach(el => {
            const text = el.textContent.trim();
            if (text.includes('作品集') || text.includes('Portfolio') || text.includes('ポートフォリオ')) {
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
    
    // Toggle language - cycle through zh -> en -> ja -> zh
    function toggleLang() {
        const current = getCurrentLang();
        const currentIndex = LANGUAGES.indexOf(current);
        const nextIndex = (currentIndex + 1) % LANGUAGES.length;
        const next = LANGUAGES[nextIndex];
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
        toggleLang,
        LANGUAGES
    };
    
    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
