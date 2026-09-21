#!/usr/bin/env node
// 用法：node scripts/build-optimized-images.js [过滤词]
// 传入过滤词时只处理输出路径包含该词的任务，例如 `clue-wall` 只重建首页线索墙的图片。
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');

// 首页线索墙：源图沿用站内原图（行踪图源图 travel-map-v4.png 是 Claude Design 的 travel-map.html 2x 渲染后转成 256 色 PNG），
// 输出使用 ASCII 文件名，缩略图够首页墙面与桌上的档案在 2x 屏上使用即可。
const clueWallImages = [
    ['images/clue-wall/travel-map-v4.png', 'travel-map-v4.webp', '1100x1100>', '85'],
    ['images/hackathon/huanqiu-gold.jpg', 'global-gold.webp', '720x720>'],
    ['images/travel/东京夜景.jpg', 'tokyo-night.webp', '720x720>'],
    ['images/hackathon/AdventureX24.jpg', 'adventurex24.webp'],
    ['images/hackathon/trae-hackathon-02.jpg', 'trae-hangzhou.webp'],
    ['images/hackathon/trae-hackathon-08.jpg', 'trae-shanghai.webp'],
    ['images/hackathon/image.png', 'tencent.webp'],
    ['images/hackathon/渝客松Google GDG赛道第一名.jpg', 'yukesong.webp'],
    ['images/hackathon/无锡Rokid ARAI三等奖.jpg', 'rokid.webp'],
    ['images/hackathon/nanjing-campus-hackathon-finalist-2026.jpg', 'nanjing-finalist.webp'],
    ['images/blog/codex-token-low-cost-cover.png', 'blog-codex.webp'],
    ['images/blog/factory-3d-render.jpg', 'blog-factory.webp'],
    ['images/blog/vibe-coding-guide.jpg', 'blog-vibe.webp'],
    ['images/travel/伏见稻田大社.jpg', 'fushimi.webp'],
    ['images/travel/二年阪.JPG', 'ninenzaka.webp'],
    ['images/travel/京都塔联动京吹.jpg', 'kyoto-tower.webp'],
    ['images/travel/名古屋蓝调时刻.jpg', 'nagoya-blue.webp'],
    ['images/travel/名古屋城.jpg', 'nagoya-castle.webp'],
    ['images/travel/南京玄武鸡鸣寺.jpg', 'nanjing-jiming.webp'],
    ['images/travel/大巴途中.jpg', 'bus.webp'],
    // v2 的项目案卷墙（25 条）与旅行照片墙（26 张）新增的缩略图。
    ['images/shop/code-transit-entry.webp', 'shop-entry.webp', '420x420>'],
    ['images/hackathon/osaka-rokid-mini-hackathon-2026.webp', 'osaka-rokid.webp'],
    ['images/hackathon/ivs2026-kyoto-waytoagi.webp', 'ivs-kyoto.webp'],
    ['images/hackathon/tangquan-hackathon.jpg', 'tangquan.webp'],
    ['images/hackathon/nanjing-mofa-hackathon.jpg', 'mofa.webp'],
    ['images/hackathon/trae-hackathon-07.jpg', 'huikesong.webp'],
    ['images/hackathon/yunqi-conference.jpg', 'yunqi.webp'],
    ['images/travel/eiheiji-gate-2026.jpg', 'eiheiji.webp'],
    ['images/travel/okinawa-beach-2026.jpg', 'okinawa-beach.webp'],
    ['images/travel/okinawa-yonabaru-tsunahiki-2026.jpg', 'okinawa-tug.webp'],
    ['images/travel/nara-deer-2026.jpg', 'nara-deer.webp'],
    ['images/travel/nara-kasuga-lanterns-2026.jpg', 'nara-lanterns.webp'],
    ['images/travel/晴空塔.jpg', 'skytree.webp'],
    ['images/travel/雷门.JPG', 'kaminarimon.webp'],
    ['images/travel/金阁寺.JPG', 'kinkakuji.webp'],
    ['images/travel/天守阁.jpg', 'osaka-castle.webp'],
    ['images/travel/竖起小指吧.jpg', 'glico.webp'],
    ['images/travel/黑门市场.jpg', 'kuromon.webp'],
    ['images/travel/名古屋城吉伊.jpg', 'nagoya-mascot.webp'],
    ['images/travel/原子弹爆照遗址.jpg', 'abomb-dome.webp'],
    ['images/travel/水中神社.jpg', 'itsukushima.webp'],
    ['images/travel/横滨某座桥.jpg', 'yokohama.webp'],
    ['images/travel/杭州某家咖啡店.JPG', 'hangzhou-coffee.webp'],
    ['images/travel/第一次吃一兰.jpg', 'ichiran.webp'],
    ['images/travel/路过富士山.jpg', 'fuji.webp'],
].map(([from, name, resize = '640x640>', quality]) => ({ from, to: `images/optimized/clue-wall/${name}`, resize, quality }));

// 页面只引用这里生成的 WebP；images/ 下其余目录是源图，不进 public-dist。
const jobs = [
    { from: 'images/music_pic', to: 'images/optimized/music_pic', resize: '800x800>' },
    { from: 'images/animate', to: 'images/optimized/animate', resize: '760x760>' },
    { from: 'images/travel', to: 'images/optimized/travel', resize: '1000x1000>', quality: '72' },
    { from: 'images/travel/东京夜景.jpg', to: 'images/optimized/travel-hero-tokyo-night.webp', resize: '1600x1600>', quality: '70' },
    { from: 'images/hackathon', to: 'images/optimized/hackathon', resize: '1000x1000>', quality: '76' },
    { from: 'images/ai-video-comic.jpg', to: 'images/optimized/ai-video-comic.webp', resize: '1000x1000>', quality: '76' },
    { from: 'images/blog', to: 'images/optimized/blog', resize: '1400x1400>', quality: '76' },
    { from: 'images/blog/ai-native-hackathon', to: 'images/optimized/blog/ai-native-hackathon', resize: '1200x1200>', quality: '76' },
    { from: 'images/blog/back-to-vibe-coding', to: 'images/optimized/blog/back-to-vibe-coding', resize: '1400x1400>' },
    { from: 'images/profile/portrait-compressed.jpg', to: 'images/optimized/profile/portrait-compressed.webp', resize: '1000x1000>', quality: '80' },
    { from: 'images/profile/avatar-small.jpg', to: 'images/optimized/profile/avatar-small.webp', resize: '200x200>', quality: '80' },
    { from: 'images/shop/code-transit-entry.webp', to: 'images/optimized/shop/code-transit-entry.webp', resize: '1800x1800>' },
    ...clueWallImages,
];

function listImages(source) {
    const full = path.join(rootDir, source);
    if (!fs.existsSync(full)) return [];
    if (fs.statSync(full).isFile()) return [source];
    return fs.readdirSync(full)
        .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
        .map((name) => path.join(source, name));
}

function outputPath(job, input) {
    const source = path.join(rootDir, job.from);
    const inputPath = path.join(rootDir, input);
    if (fs.existsSync(source) && fs.statSync(source).isFile()) return path.join(rootDir, job.to);
    const parsed = path.parse(path.relative(source, inputPath));
    return path.join(rootDir, job.to, `${parsed.name}.webp`);
}

const filter = process.argv[2] || '';
for (const job of jobs.filter((item) => item.to.includes(filter))) {
    for (const input of listImages(job.from)) {
        const source = path.join(rootDir, input);
        const target = outputPath(job, input);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        // 保留 ICC 颜色配置，去掉 EXIF（含 GPS）等其余元数据。
        const result = spawnSync('magick', [source, '-auto-orient', '+profile', '!icc,*', '-resize', job.resize, '-quality', job.quality || '78', target], {
            stdio: 'inherit',
        });
        if (result.status !== 0) process.exit(result.status || 1);
    }
}

console.log('图片派生资源生成完成。');
