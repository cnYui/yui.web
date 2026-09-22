// 首页线索墙的档案数据，对应 Claude Design「侦探线索墙个人主页」中的 clue-data.js（Clue Wall Study v2）。
// 内容来源：SKILL.md、resume/、js/projects.js、js/blog-data.js、js/travel.js、shop/；图片由
// `node scripts/build-optimized-images.js clue-wall` 从站内原图生成到 images/optimized/clue-wall/。
const CW_IMG = '/images/optimized/clue-wall/';

window.YuiClueData = {
    site: 'https://aaccx.pw',
    timeline: [
        { date: '2024.07', city: '杭州 Hangzhou', title: 'AdventureX 2024', note: '第一次围观黑客松 · first sighting, as a spectator', img: CW_IMG + 'adventurex24.webp', award: 'FIRST SIGHTING', rot: -2 },
        { date: '2025.06', city: '杭州 Hangzhou', title: 'Trae Solo Hackathon 杭州站', note: '带着小程序经验的应届生首战', img: CW_IMG + 'trae-hangzhou.webp', award: '', rot: 1.5 },
        { date: '2025.08', city: '上海 Shanghai', title: 'TRAE SOLO Hackathon 上海站', note: '二等奖 · 2nd Place', img: CW_IMG + 'trae-shanghai.webp', award: '2ND PLACE', rot: -1 },
        { date: '2025.09', city: '线上 Online', title: '腾讯云黑客松', note: '宠物健康陪伴小程序 · 获奖', img: CW_IMG + 'tencent.webp', award: 'WINNER', rot: 2 },
        { date: '2025.11', city: '重庆 Chongqing', title: '渝客松 · Google GDG 赛道', note: '线上一等奖 · 1st Place', img: CW_IMG + 'yukesong.webp', award: '1ST PLACE', rot: -1.5 },
        { date: '2025.11', city: '无锡 Wuxi', title: 'Rokid AR AI 眼镜开发赛', note: '三等奖 · 面向 ADHD 的阅读辅助眼镜', img: CW_IMG + 'rokid.webp', award: '3RD PLACE', rot: 1 },
        { date: '2026.01', city: '上海 Shanghai', title: '环球黑客松 Global Hackathon', note: '金奖 · Gold Award', img: CW_IMG + 'global-gold.webp', award: 'GOLD', rot: -2 },
        { date: '2026.03', city: '南京 Nanjing', title: '南京高校黑客松', note: '2026 AI Hackathon Tour · 决赛入围', img: CW_IMG + 'nanjing-finalist.webp', award: 'FINALIST', rot: 2 }
    ],
    projectCats: [
        { id: 'all', label: '全部 ALL' },
        { id: 'award', label: '获奖 AWARD' },
        { id: 'hackathon', label: '黑客松 HACKATHON' },
        { id: 'meetup', label: '聚会 MEETUP' },
        { id: 'project', label: '项目 PROJECT' }
    ],
    projects: [
        { date: '2026.09', city: '大阪 Osaka', title: '大阪 Rokid Mini Hackathon', cat: 'award', desc: '作品「DoubleTraining」并列第二名（亚军）。', img: CW_IMG + 'osaka-rokid.webp', award: '2ND PLACE', link: '', rot: -1.5 },
        { date: '2026.07', city: '京都 Kyoto', title: 'IVS2026 Kyoto', cat: 'meetup', desc: '以 Academia 通行证参加京都 IVS2026 创业大会，逛了 WaytoAGI 等展位，并参加晚宴交流。', img: CW_IMG + 'ivs-kyoto.webp', award: '', link: '', rot: 1 },
        { date: '2026.03', city: '南京 Nanjing', title: '南京高校黑客松 · 决赛入围', cat: 'hackathon', desc: '2026 AI Hackathon Tour 南京大学站，闯入决赛。', img: CW_IMG + 'nanjing-finalist.webp', award: 'FINALIST', link: '', rot: -1 },
        { date: '2026.02', city: '南京 Nanjing', title: '汤泉黑客松', cat: 'hackathon', desc: '在温泉里写代码，独一无二的黑客松氛围。', img: CW_IMG + 'tangquan.webp', award: '', link: '', rot: 1.5 },
        { date: '2026.01', city: '上海 Shanghai', title: '环球黑客松 Global Hackathon', cat: 'award', desc: '斩获金奖。', img: CW_IMG + 'global-gold.webp', award: 'GOLD', link: '', rot: -2 },
        { date: '2026.01', city: '线上 Online', title: 'OpenClaw 飞书插件 · 疯狂星期四', cat: 'project', desc: '为疯狂星期四活动开发 OpenClaw 飞书插件，提升团队协作效率。', img: CW_IMG + 'openclaw-feishu.webp', award: '', link: '', rot: 1 },
        { date: '2026.01', city: '南京 Nanjing', title: '南京 OPC 黑客松', cat: 'hackathon', desc: '探索 AI + 游戏的可能。', img: CW_IMG + 'nanjing-opc.webp', award: '', link: '', rot: -1.5 },
        { date: '2025.12', city: '线上 Online', title: 'AI 视频 / 漫画项目', cat: 'project', desc: '用 AI 生成视频与漫画，探索数字叙事的新形态。', img: CW_IMG + 'ai-video-comic.webp', award: '', link: '', rot: 1 },
        { date: '2025.12', city: '南京 Nanjing', title: '南京 MoFa 黑客松', cat: 'hackathon', desc: '参加 MoFa（Model Factory）黑客松。', img: CW_IMG + 'mofa.webp', award: '', link: '', rot: -1 },
        { date: '2025.12', city: '上海 Shanghai', title: '上海圣诞黑客松', cat: 'hackathon', desc: '圣诞主题黑客松。', img: CW_IMG + 'shanghai-xmas.webp', award: '', link: '', rot: 1.5 },
        { date: '2025.12', city: '上海 Shanghai', title: '火山引擎 Force 大会', cat: 'meetup', desc: '参加火山引擎 Force 大会。', img: CW_IMG + 'volcano-force.webp', award: '', link: '', rot: -1.5 },
        { date: '2025.11', city: '重庆 Chongqing', title: '渝客松 · Google GDG 赛道', cat: 'award', desc: 'Google GDG 赛道第一名。', img: CW_IMG + 'yukesong.webp', award: '1ST PLACE', link: '', rot: 2 },
        { date: '2025.11', city: '无锡 Wuxi', title: '无锡 Rokid AR AI 开发赛', cat: 'award', desc: '三等奖 · 面向 ADHD 的阅读辅助 AR 眼镜应用。', img: CW_IMG + 'rokid.webp', award: '3RD PLACE', link: '', rot: -1 },
        { date: '2025.10', city: '安徽 Anhui', title: '徽客松', cat: 'hackathon', desc: '作品「随口成曲」。', img: CW_IMG + 'huikesong.webp', award: '', link: 'http://xhslink.com/o/9pQHBf9V1Fv', rot: 1 },
        { date: '2025.09', city: '杭州 Hangzhou', title: '阿里云栖大会', cat: 'meetup', desc: '在杭州云栖小镇参加阿里云云栖大会。', img: CW_IMG + 'yunqi.webp', award: '', link: '', rot: -1.5 },
        { date: '2025.09', city: '线上 Online', title: '腾讯云线上黑客松', cat: 'award', desc: '宠物健康陪伴小程序获奖。', img: CW_IMG + 'tencent.webp', award: 'WINNER', link: 'http://xhslink.com/o/ATzpS0qsjaQ', rot: 1.5 },
        { date: '2025.09', city: '线上 Online', title: 'n8n + 小红书 MCP 自动发帖', cat: 'project', desc: '用 n8n 工作流自动化运营小红书账号。', img: CW_IMG + 'xhs-n8n.webp', award: '', link: 'https://www.xiaohongshu.com/user/profile/5b869e548bf5ee0001f35235', rot: -1 },
        { date: '2025.09', city: '线上 Online', title: '抖音创作者大赛', cat: 'project', desc: '基于 Coze 工作流的「法治剧场助手」。', img: CW_IMG + 'douyin-coze.webp', award: '', link: 'http://xhslink.com/o/5kBv2KfGeLj', rot: 2 },
        { date: '2025.08', city: '上海 Shanghai', title: 'TRAE SOLO Hackathon 上海站', cat: 'award', desc: '二等奖。', img: CW_IMG + 'trae-shanghai.webp', award: '2ND PLACE', link: '', rot: -1.5 },
        { date: '2025.08', city: '南京 Nanjing', title: '南客松 S1', cat: 'hackathon', desc: '参加南京 Nanckathon S1。', img: CW_IMG + 'nankesong.webp', award: '', link: '', rot: 1 },
        { date: '2025.07', city: '南京 Nanjing', title: 'TRAE Friends 南京', cat: 'meetup', desc: '技术分享会。', img: CW_IMG + 'trae-nanjing.webp', award: '', link: '', rot: -1 },
        { date: '2025.07', city: '苏州 Suzhou', title: 'TRAE Friends 苏州', cat: 'meetup', desc: '技术分享会。', img: CW_IMG + 'trae-suzhou.webp', award: '', link: '', rot: 1.5 },
        { date: '2025.07', city: '杭州 Hangzhou', title: '2025 AdventureX', cat: 'hackathon', desc: '以观众身份近距离观摩学习。', img: CW_IMG + 'adventurex25.webp', award: '', link: '', rot: -2 },
        { date: '2025.06', city: '杭州 Hangzhou', title: 'Trae Solo Hackathon 杭州站', cat: 'hackathon', desc: '带着小程序经验的应届生首战。', img: CW_IMG + 'trae-hangzhou.webp', award: '', link: '', rot: 1 },
        { date: '2024.07', city: '杭州 Hangzhou', title: '2024 AdventureX', cat: 'hackathon', desc: '第一次围观黑客松，向社区学习。', img: CW_IMG + 'adventurex24.webp', award: 'FIRST SIGHTING', link: '', rot: -1.5 }
    ],
    posts: [
        { date: '2026.06.16', read: '13 分钟', title: 'Back to Vibe Coding：AI 驱动开发之前，你需要知道的几件事（上）', excerpt: '从 Prompt 到 Loop，从聊天框到 Agent Harness，重新理解高效使用 AI Coding 工具之前需要建立的规则、记忆和工作流。', img: CW_IMG + 'blog-loop.webp', link: '/blog/back-to-vibe-coding-ai-driven-dev-before', rot: -1.5 },
        { date: '2026.06.06', read: '7 分钟', title: '低成本使用 Codex Token 的几种方法', excerpt: '从 Codex CLI、CPA/CLIProxyAPI、账号池、公网入口和排障方法出发，整理低成本使用 Codex Token 的路径和边界。', img: CW_IMG + 'blog-codex.webp', link: '/blog/codex-token-low-cost', rot: 1 },
        { date: '2026.06.04', read: '12 分钟', title: '我开源了一个又快又准的云输入软件：SpeakMore 是怎么做出来的', excerpt: '从 SenseVoiceSmall、FunASR、LLM 后处理、音频链路到自动粘贴，记录 SpeakMore 的实现细节。', img: CW_IMG + 'blog-speakmore.webp', link: '/blog/speakmore-cloud-input', rot: -0.8 },
        { date: '2026.04.13', read: '15 分钟', title: 'AI Native Developer：黑客松赛场上的开发者生存范式', excerpt: '从黑客松实战、Vibe Coding 到 AI Native Developer，记录 AI 时代作品如何更容易拿奖。', img: CW_IMG + 'blog-hackathon.webp', link: '/blog/ai-native-hackathon', rot: 1.6 },
        { date: '2026.01.04', read: '8 分钟', title: 'AI 生图生视频使用经历和经验', excerpt: 'AI 只是工具，人之所以为人是因为会使用工具。从 Sora2 到 Nano Banana Pro，分享我的 AI 创作经历。', img: CW_IMG + 'blog-factory.webp', link: '/blog/ai-image-video', rot: -1 },
        { date: '2025.12.31', read: '12 分钟', title: 'Vibe Coding 实战指南', excerpt: '一年多 AI Coding 实战经验总结，从构思设计到纠错技巧，帮助你减少「屎山代码」、提升开发效率。', img: CW_IMG + 'blog-vibe.webp', link: '/blog/vibe-coding', rot: 1.2 }
    ],
    travelCities: [
        { id: 'all', label: '全部 ALL' },
        { id: 'tokyo', label: '东京' },
        { id: 'kyoto', label: '京都' },
        { id: 'osaka', label: '大阪' },
        { id: 'nara', label: '奈良' },
        { id: 'nagoya', label: '名古屋' },
        { id: 'hiroshima', label: '广岛' },
        { id: 'yokohama', label: '横滨' },
        { id: 'kawasaki', label: '川崎' },
        { id: 'okinawa', label: '冲绳' },
        { id: 'fukui', label: '福井' },
        { id: 'hangzhou', label: '杭州' },
        { id: 'nanjing', label: '南京' },
        { id: 'food', label: '美食' },
        { id: 'others', label: '其他' }
    ],
    travel: [
        { city: 'fukui', title: '永平寺', en: 'Eiheiji Temple · Fukui', desc: '2026.09.18 · 曹洞宗大本山，据说乔布斯与库克都曾造访', img: CW_IMG + 'eiheiji.webp', rot: -2 },
        { city: 'okinawa', title: '冲绳的海', en: 'Okinawa Beach', desc: '2026.08.15 · 为期一周的冲绳之旅', img: CW_IMG + 'okinawa-beach.webp', rot: 2 },
        { city: 'okinawa', title: '与那原大绳曳', en: 'Yonabaru Great Tug-of-War', desc: '延续 450 余年的地方祭典', img: CW_IMG + 'okinawa-tug.webp', rot: -1 },
        { city: 'nara', title: '奈良的鹿', en: 'Nara Deer', desc: '2026.06.30 · 一只好奇的鹿凑到眼前', img: CW_IMG + 'nara-deer.webp', rot: 1.5 },
        { city: 'nara', title: '春日大社 吊灯笼', en: 'Kasuga Taisha Lanterns', desc: '朱红回廊下悬挂的灯笼', img: CW_IMG + 'nara-lanterns.webp', rot: -1.5 },
        { city: 'tokyo', title: '东京夜景', en: 'Tokyo Night View', desc: '夜晚闪耀的城市灯光', img: CW_IMG + 'tokyo-night.webp', rot: 2 },
        { city: 'tokyo', title: '晴空塔', en: 'Tokyo Skytree', desc: '634 米的地标电波塔', img: CW_IMG + 'skytree.webp', rot: -2 },
        { city: 'tokyo', title: '雷门', en: 'Kaminarimon · Senso-ji', desc: '浅草寺的雷门', img: CW_IMG + 'kaminarimon.webp', rot: 1 },
        { city: 'kyoto', title: '伏见稻荷大社', en: 'Fushimi Inari Shrine', desc: '千本鸟居', img: CW_IMG + 'fushimi.webp', rot: -1 },
        { city: 'kyoto', title: '金阁寺', en: 'Kinkaku-ji', desc: '金色的楼阁', img: CW_IMG + 'kinkakuji.webp', rot: 2 },
        { city: 'kyoto', title: '二年坂', en: 'Ninenzaka', desc: '石板铺就的坡道', img: CW_IMG + 'ninenzaka.webp', rot: -2 },
        { city: 'kyoto', title: '京都塔 × 京吹', en: 'Kyoto Tower', desc: '俯瞰古都', img: CW_IMG + 'kyoto-tower.webp', rot: 1.5 },
        { city: 'osaka', title: '大阪城 天守阁', en: 'Osaka Castle', desc: '大阪武士历史的象征', img: CW_IMG + 'osaka-castle.webp', rot: -1.5 },
        { city: 'osaka', title: '黑门市场', en: 'Kuromon Market', desc: '大阪的厨房 · 新鲜海产', img: CW_IMG + 'kuromon.webp', rot: -1 },
        { city: 'nagoya', title: '名古屋城', en: 'Nagoya Castle', desc: '以金鯱闻名', img: CW_IMG + 'nagoya-castle.webp', rot: 1 },
        { city: 'nagoya', title: '名古屋 蓝调时刻', en: 'Nagoya Blue Hour', desc: '魔幻的暮色时刻', img: CW_IMG + 'nagoya-blue.webp', rot: -2 },
        { city: 'nagoya', title: '名古屋城吉祥物', en: 'Nagoya Castle Mascot', desc: '可爱的城堡吉祥物', img: CW_IMG + 'nagoya-mascot.webp', rot: 1.5 },
        { city: 'hiroshima', title: '原爆圆顶', en: 'Atomic Bomb Dome', desc: '世界文化遗产', img: CW_IMG + 'abomb-dome.webp', rot: -1 },
        { city: 'hiroshima', title: '严岛神社 水中鸟居', en: 'Itsukushima Shrine', desc: '涨潮时的海上神社', img: CW_IMG + 'itsukushima.webp', rot: 2 },
        { city: 'yokohama', title: '横滨港', en: 'Yokohama Waterfront', desc: '港区的桥与水岸', img: CW_IMG + 'yokohama.webp', rot: -1.5 },
        { city: 'kawasaki', title: '川崎仲见世通', en: 'Kawasaki Nakamise-dori', desc: '川崎站旁的拱廊商店街', img: CW_IMG + 'kawasaki-nakamise.webp', rot: 2 },
        { city: 'hangzhou', title: '杭州的咖啡店', en: 'Hangzhou Coffee', desc: '舒服的咖啡馆', img: CW_IMG + 'hangzhou-coffee.webp', rot: 1 },
        { city: 'nanjing', title: '南京 鸡鸣寺', en: 'Jiming Temple', desc: '古老的佛教寺院', img: CW_IMG + 'nanjing-jiming.webp', rot: -2 },
        { city: 'food', title: '第一次吃一兰', en: 'Ichiran Ramen', desc: '著名的豚骨拉面', img: CW_IMG + 'ichiran.webp', rot: 1.5 },
        { city: 'others', title: '路过富士山', en: 'Mt. Fuji', desc: '车窗外的富士山', img: CW_IMG + 'fuji.webp', rot: -1 },
        { city: 'others', title: '大巴途中', en: 'Bus Journey', desc: '在路上', img: CW_IMG + 'bus.webp', rot: 2 }
    ],
    awards: [
        { t: '大阪 Rokid Mini Hackathon 亚军', y: '2026' },
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
