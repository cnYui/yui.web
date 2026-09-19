// 首页线索墙的档案数据，对应 Claude Design「侦探线索墙个人主页」中的 clue-data.js。
// 内容来源：SKILL.md、resume/、projects/、js/blog-data.js；图片由
// `node scripts/build-optimized-images.js clue-wall` 生成到 images/optimized/clue-wall/。
window.YuiClueData = {
    timeline: [
        { date: '2024.07', city: '杭州 Hangzhou', title: 'AdventureX 2024', note: '第一次围观黑客松 · first sighting, as a spectator', img: '/images/optimized/clue-wall/adventurex24.webp', award: 'FIRST SIGHTING', rot: -2 },
        { date: '2025.06', city: '杭州 Hangzhou', title: 'Trae Solo Hackathon 杭州站', note: '带着小程序经验的应届生首战', img: '/images/optimized/clue-wall/trae-hangzhou.webp', award: '', rot: 1.5 },
        { date: '2025.08', city: '上海 Shanghai', title: 'TRAE SOLO Hackathon 上海站', note: '二等奖 · 2nd Place', img: '/images/optimized/clue-wall/trae-shanghai.webp', award: '2ND PLACE', rot: -1 },
        { date: '2025.09', city: '线上 Online', title: '腾讯云黑客松', note: '宠物健康陪伴小程序 · 获奖', img: '/images/optimized/clue-wall/tencent.webp', award: 'WINNER', rot: 2 },
        { date: '2025.11', city: '重庆 Chongqing', title: '渝客松 · Google GDG 赛道', note: '线上一等奖 · 1st Place', img: '/images/optimized/clue-wall/yukesong.webp', award: '1ST PLACE', rot: -1.5 },
        { date: '2025.11', city: '无锡 Wuxi', title: 'Rokid AR AI 眼镜开发赛', note: '三等奖 · 面向 ADHD 的阅读辅助眼镜', img: '/images/optimized/clue-wall/rokid.webp', award: '3RD PLACE', rot: 1 },
        { date: '2026.01', city: '上海 Shanghai', title: '环球黑客松 Global Hackathon', note: '金奖 · Gold Award', img: '/images/optimized/clue-wall/global-gold.webp', award: 'GOLD', rot: -2 },
        { date: '2026.03', city: '南京 Nanjing', title: '南京高校黑客松', note: '2026 AI Hackathon Tour · 决赛入围', img: '/images/optimized/clue-wall/nanjing-finalist.webp', award: 'FINALIST', rot: 2 }
    ],
    posts: [
        { date: '2026.06.16', read: '13 分钟', title: 'Back to Vibe Coding：AI 驱动开发之前，你需要知道的几件事（上）', excerpt: '从 Prompt 到 Loop，从聊天框到 Agent Harness，重新理解高效使用 AI Coding 工具之前需要建立的规则、记忆和工作流。', img: '', link: '/blog/back-to-vibe-coding-ai-driven-dev-before', rot: -1.5 },
        { date: '2026.06.06', read: '7 分钟', title: '低成本使用 Codex Token 的几种方法', excerpt: '从 Codex CLI、CPA/CLIProxyAPI、账号池、公网入口和排障方法出发，整理低成本使用 Codex Token 的路径和边界。', img: '/images/optimized/clue-wall/blog-codex.webp', link: '/blog/codex-token-low-cost', rot: 1 },
        { date: '2026.06.04', read: '12 分钟', title: '我开源了一个又快又准的云输入软件：SpeakMore 是怎么做出来的', excerpt: '从 SenseVoiceSmall、FunASR、LLM 后处理、音频链路到自动粘贴，记录 SpeakMore 的实现细节。', img: '', link: '/blog/speakmore-cloud-input', rot: -0.8 },
        { date: '2026.04.13', read: '15 分钟', title: 'AI Native Developer：黑客松赛场上的开发者生存范式', excerpt: '从黑客松实战、Vibe Coding 到 AI Native Developer，记录 AI 时代作品如何更容易拿奖。', img: '', link: '/blog/ai-native-hackathon', rot: 1.6 },
        { date: '2026.01.04', read: '8 分钟', title: 'AI 生图生视频使用经历和经验', excerpt: 'AI 只是工具，人之所以为人是因为会使用工具。从 Sora2 到 Nano Banana Pro，分享我的 AI 创作经历。', img: '/images/optimized/clue-wall/blog-factory.webp', link: '/blog/ai-image-video', rot: -1 },
        { date: '2025.12.31', read: '12 分钟', title: 'Vibe Coding 实战指南', excerpt: '一年多 AI Coding 实战经验总结，从构思设计到纠错技巧，帮助你减少"屎山代码"、提升开发效率。', img: '/images/optimized/clue-wall/blog-vibe.webp', link: '/blog/vibe-coding', rot: 1.2 }
    ],
    // x / y 是照片在行踪图上的位置，px / py 是对应图钉的位置（行踪图画框坐标，1300 × 650）。
    photos: [
        { cap: '东京夜景 · Tokyo', img: '/images/optimized/clue-wall/tokyo-night.webp', x: 300, y: 10, rot: 3, px: 390, py: 20 },
        { cap: '伏见稻荷大社 · Kyoto', img: '/images/optimized/clue-wall/fushimi.webp', x: 500, y: 8, rot: -3, px: 590, py: 18 },
        { cap: '二年坂 · Kyoto', img: '/images/optimized/clue-wall/ninenzaka.webp', x: 700, y: 12, rot: 2, px: 790, py: 22 },
        { cap: '京都塔 × 京吹 · Kyoto', img: '/images/optimized/clue-wall/kyoto-tower.webp', x: 900, y: 8, rot: -2, px: 990, py: 18 },
        { cap: '名古屋 蓝调时刻 · Nagoya', img: '/images/optimized/clue-wall/nagoya-blue.webp', x: 30, y: 200, rot: -3, px: 120, py: 210 },
        { cap: '名古屋城 · Nagoya Castle', img: '/images/optimized/clue-wall/nagoya-castle.webp', x: 1100, y: 170, rot: 3, px: 1190, py: 180 },
        { cap: '南京 鸡鸣寺 · Nanjing', img: '/images/optimized/clue-wall/nanjing-jiming.webp', x: 420, y: 470, rot: 4, px: 510, py: 480 },
        { cap: '大巴途中 · en route', img: '/images/optimized/clue-wall/bus.webp', x: 620, y: 468, rot: -3, px: 710, py: 478 }
    ],
    awards: [
        { t: '大阪 Rokid Mini Hackathon 同率第 2 位 · 準優勝', y: '2026' },
        { t: '环球黑客松 金奖 · Global Hackathon Gold', y: '2026' },
        { t: '南京高校 AI 黑客松巡回赛 决赛入围', y: '2026' },
        { t: 'TRAE Solo Hackathon 二等奖', y: '2025' },
        { t: '渝客松 Google GDG 赛道 一等奖', y: '2025' },
        { t: 'Rokid AR AI 智能眼镜开发赛 三等奖', y: '2025' },
        { t: '腾讯云黑客松 获奖', y: '2025' }
    ],
    keywords: [
        { t: 'Vibe Coding', rot: -3 }, { t: 'Agentic RAG', rot: 2 }, { t: 'GraphRAG', rot: -1 }, { t: 'LangGraph', rot: 3 },
        { t: 'Coding Agent', rot: -2 }, { t: '黑客松 Hackathon', rot: 1.5 }, { t: '产品思维', rot: -2.5 }, { t: 'Nano Banana', rot: 2 }, { t: 'n8n · Coze · Dify', rot: -1.5 }
    ]
};
