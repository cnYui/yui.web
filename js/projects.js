const projectData = [
    // Sep 2026
    { date: 'Sep 2026', city: 'Osaka', images: ['/images/optimized/hackathon/osaka-rokid-mini-hackathon-2026.webp'], title: 'Osaka Rokid Mini Hackathon', category: 'Award', desc: 'Won runner-up (tied for 2nd place) at the Rokid mini hackathon in Osaka with the project "DoubleTraining".', link: '', badge: '🥈 2nd Place' },
    // Jul 2026
    { date: 'Jul 2026', city: 'Kyoto', images: ['/images/optimized/hackathon/ivs2026-kyoto-badge.webp', '/images/optimized/hackathon/ivs2026-kyoto-waytoagi.webp', '/images/optimized/hackathon/ivs2026-kyoto-dinner.webp'], title: 'IVS2026 Kyoto', category: 'Meetup', desc: 'Attended the IVS2026 startup conference in Kyoto with an Academia pass, visited startup booths such as WaytoAGI and joined a dinner meetup.', link: '', badge: '' },
    // Mar 2026
    { date: 'Mar 2026', city: 'Nanjing', images: ['/images/optimized/hackathon/nanjing-campus-hackathon-finalist-2026.webp'], title: 'Nanjing University Hackathon Finalist', category: 'Hackathon', desc: 'Reached the finals at the Nanjing University stop of the 2026 AI Hackathon Tour.', link: '', badge: '🏅 Finalist' },
    // Feb 2026
    { date: 'Feb 2026', city: 'Nanjing', images: ['/images/optimized/hackathon/tangquan-hackathon.webp', '/images/optimized/hackathon/tangquan-poster.webp'], title: 'Tangquan Hackathon', category: 'Hackathon', desc: 'Participated in Nanjing Tangquan Hackathon, experiencing the unique atmosphere of coding in hot springs.', link: '', badge: '' },
    // Jan 2026
    { date: 'Jan 2026', city: 'Shanghai', images: ['/images/optimized/hackathon/huanqiu-gold.webp', '/images/optimized/hackathon/huanqiu-tea.webp', '/images/optimized/hackathon/huanqiu-award.webp'], title: 'Global Hackathon', category: 'Award', desc: 'Won gold award at Global Hackathon, showcasing innovative ideas.', link: '', badge: '🥇 Gold Award' },
    { date: 'Jan 2026', city: 'Online', images: ['/images/optimized/hackathon/openclaw-feishu.webp'], title: 'OpenClaw Feishu Plugin - Crazy Thursday', category: 'Project', desc: 'Developed OpenClaw Feishu plugin for Crazy Thursday event, enhancing team collaboration efficiency.', link: '', badge: '' },
    { date: 'Jan 2026', city: 'Nanjing', images: ['/images/optimized/hackathon/nanjing-opc.webp'], title: 'Nanjing OPC Hackathon', category: 'Hackathon', desc: 'Participated in Nanjing OPC Hackathon, exploring AI + Gaming.', link: '', badge: '' },
    // Dec 2025
    { date: 'Dec 2025', city: 'Online', images: ['/images/optimized/ai-video-comic.webp'], title: 'AI Video/Comic Project', category: 'AI Video/Comic', desc: 'Creative AI-generated video and comic content exploring new forms of digital storytelling.', link: '', badge: '' },
    { date: 'Dec 2025', city: 'Nanjing', images: ['/images/optimized/hackathon/nanjing-mofa-hackathon.webp'], title: 'Nanjing MoFa Hackathon', category: 'Hackathon', desc: 'Participated in the MoFa (Model Factory) Hackathon in Nanjing.', link: '', badge: '' },
    { date: 'Dec 2025', city: 'Shanghai', images: ['/images/optimized/hackathon/shanghai-christmas-hackathon.webp'], title: 'Shanghai Christmas Hackathon', category: 'Hackathon', desc: 'Joined the festive Christmas-themed hackathon in Shanghai.', link: '', badge: '' },
    { date: 'Dec 2025', city: 'Shanghai', images: ['/images/optimized/hackathon/volcano-force.webp'], title: 'Volcano Engine Force Conference', category: 'Meetup', desc: 'Attended the Volcano Engine Force Conference in Shanghai.', link: '', badge: '' },
    // Nov 2025
    { date: 'Nov 2025', city: 'Chongqing', images: ['/images/optimized/hackathon/渝客松Google GDG赛道第一名.webp'], title: 'Yukesong Google GDG Track', category: 'Award', desc: 'Achieved 1st place in the Google GDG track at Yukesong hackathon.', link: '', badge: '🥇 1st Place' },
    { date: 'Nov 2025', city: 'Wuxi', images: ['/images/optimized/hackathon/无锡Rokid ARAI三等奖.webp'], title: 'Wuxi Rokid AR AI Competition', category: 'Award', desc: 'Won 3rd place at the Wuxi Rokid AR AI competition, showcasing innovative AR applications.', link: '', badge: '🥉 3rd Place' },
    // Oct 2025
    { date: 'Oct 2025', city: 'Anhui', images: ['/images/optimized/hackathon/trae-hackathon-07.webp'], title: 'Huikesong Hackathon', category: 'Hackathon', desc: 'Created "Suikou Chengqu" (Instant Song) project at Anhui hackathon.', link: 'http://xhslink.com/o/9pQHBf9V1Fv', badge: '' },
    // Sep 2025
    { date: 'Sep 2025', city: 'Hangzhou', images: ['/images/optimized/hackathon/yunqi-conference.webp'], title: 'Alibaba Yunqi Conference', category: 'Meetup', desc: 'Attended the Alibaba Cloud Yunqi Conference at Yunqi Town, Hangzhou.', link: '', badge: '' },
    { date: 'Sep 2025', city: 'Online', images: ['/images/optimized/hackathon/image.webp'], title: 'Tencent Cloud Online Hackathon', category: 'Award', desc: 'Pet health companion mini-program that won recognition at Tencent Cloud hackathon.', link: 'http://xhslink.com/o/ATzpS0qsjaQ', badge: '🏆 Winner' },
    { date: 'Sep 2025', city: 'Online', images: ['/images/optimized/hackathon/image copy 2.webp'], title: 'n8n + Xiaohongshu MCP Auto-posting', category: 'Project', desc: 'Automated Xiaohongshu account management using n8n workflow.', link: 'https://www.xiaohongshu.com/user/profile/5b869e548bf5ee0001f35235', badge: '' },
    { date: 'Sep 2025', city: 'Online', images: ['/images/optimized/hackathon/image copy.webp'], title: 'Douyin Creator Competition', category: 'Project', desc: 'Legal Theater Assistant built with Coze workflow for Douyin Creator competition.', link: 'http://xhslink.com/o/5kBv2KfGeLj', badge: '' },
    // Aug 2025
    { date: 'Aug 2025', city: 'Shanghai', images: ['/images/optimized/hackathon/trae-hackathon-08.webp'], title: 'TRAE SOLO Hackathon Shanghai', category: 'Award', desc: 'Won 2nd place at the TRAE SOLO Hackathon Shanghai edition.', link: '', badge: '🥈 2nd Place' },
    { date: 'Aug 2025', city: 'Nanjing', images: ['/images/optimized/hackathon/trae-hackathon-05.webp'], title: 'Nanckathon S1', category: 'Hackathon', desc: 'Participated in the Nanckathon S1 hackathon event in Nanjing.', link: '', badge: '' },
    // Jul 2025
    { date: 'Jul 2025', city: 'Nanjing', images: ['/images/optimized/hackathon/trae-hackathon-09.webp'], title: 'TRAE Friends Nanjing', category: 'Meetup', desc: 'Technical sharing session at TRAE Friends Nanjing meetup.', link: '', badge: '' },
    { date: 'Jul 2025', city: 'Suzhou', images: ['/images/optimized/hackathon/trae-hackathon-04.webp'], title: 'TRAE Friends Suzhou', category: 'Meetup', desc: 'Technical sharing session at TRAE Friends Suzhou meetup.', link: '', badge: '' },
    { date: 'Jul 2025', city: 'Hangzhou', images: ['/images/optimized/hackathon/trae-hackathon-01.webp'], title: '2025 AdventureX', category: 'Hackathon', desc: 'Attended as a visitor, first close-up observation and learning experience.', link: '', badge: '' },
    // Jun 2025
    { date: 'Jun 2025', city: 'Hangzhou', images: ['/images/optimized/hackathon/trae-hackathon-02.webp'], title: 'Trae Solo Hackathon Hangzhou', category: 'Hackathon', desc: 'Participated as a fresh graduate with WeChat mini-program experience.', link: '', badge: '' },
    // Jul 2024
    { date: 'Jul 2024', city: 'Hangzhou', images: ['/images/optimized/hackathon/AdventureX24.webp'], title: '2024 AdventureX', category: 'Hackathon', desc: 'First time observing a hackathon as a spectator, learning from the community.', link: '', badge: '👀 First Hackathon' },
];

let currentIndex = 0;
let currentFilter = 'All';
let filteredData = [...projectData];
const itemsPerPage = 6;
const timeline = document.getElementById('timeline');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const filterButtons = document.querySelectorAll('.filter-btn');
const projectCategoryLabels = {
    zh: { Award: '获奖', Hackathon: '黑客松', Meetup: '聚会', Project: '项目', 'AI Video/Comic': 'AI视频/漫画' },
    en: { Award: 'Award', Hackathon: 'Hackathon', Meetup: 'Meetup', Project: 'Project', 'AI Video/Comic': 'AI Video/Comic' },
    ja: { Award: '受賞', Hackathon: 'ハッカソン', Meetup: 'ミートアップ', Project: 'プロジェクト', 'AI Video/Comic': 'AI動画/漫画' }
};
const cityLabels = {
    zh: { Nanjing: '南京', Shanghai: '上海', Online: '线上', Chongqing: '重庆', Wuxi: '无锡', Anhui: '安徽', Hangzhou: '杭州', Suzhou: '苏州', Osaka: '大阪', Kyoto: '京都' },
    en: { Nanjing: 'Nanjing', Shanghai: 'Shanghai', Online: 'Online', Chongqing: 'Chongqing', Wuxi: 'Wuxi', Anhui: 'Anhui', Hangzhou: 'Hangzhou', Suzhou: 'Suzhou', Osaka: 'Osaka', Kyoto: 'Kyoto' },
    ja: { Nanjing: '南京', Shanghai: '上海', Online: 'オンライン', Chongqing: '重慶', Wuxi: '無錫', Anhui: '安徽', Hangzhou: '杭州', Suzhou: '蘇州', Osaka: '大阪', Kyoto: '京都' }
};
const monthLabels = {
    zh: { Jan: '1月', Feb: '2月', Mar: '3月', Jun: '6月', Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月' },
    en: { Jan: 'Jan', Feb: 'Feb', Mar: 'Mar', Jun: 'Jun', Jul: 'Jul', Aug: 'Aug', Sep: 'Sep', Oct: 'Oct', Nov: 'Nov', Dec: 'Dec' },
    ja: { Jan: '1月', Feb: '2月', Mar: '3月', Jun: '6月', Jul: '7月', Aug: '8月', Sep: '9月', Oct: '10月', Nov: '11月', Dec: '12月' }
};
const badgeLabels = {
    zh: { '🥇 Gold Award': '🥇 金奖', '🥇 1st Place': '🥇 第一名', '🥉 3rd Place': '🥉 第三名', '🏆 Winner': '🏆 获奖', '🥈 2nd Place': '🥈 第二名', '🏅 Finalist': '🏅 决赛入围', '👀 First Hackathon': '👀 第一次黑客松' },
    en: { '🥇 Gold Award': '🥇 Gold Award', '🥇 1st Place': '🥇 1st Place', '🥉 3rd Place': '🥉 3rd Place', '🏆 Winner': '🏆 Winner', '🥈 2nd Place': '🥈 2nd Place', '🏅 Finalist': '🏅 Finalist', '👀 First Hackathon': '👀 First Hackathon' },
    ja: { '🥇 Gold Award': '🥇 金賞', '🥇 1st Place': '🥇 1位', '🥉 3rd Place': '🥉 3位', '🏆 Winner': '🏆 受賞', '🥈 2nd Place': '🥈 2位', '🏅 Finalist': '🏅 決勝進出', '👀 First Hackathon': '👀 初めてのハッカソン' }
};
const projectJaContent = {
    'Osaka Rokid Mini Hackathon': ['大阪 Rokid ミニハッカソン', '大阪で開催された Rokid ミニハッカソンで、「DoubleTraining」が同率第2位（準優勝）を獲得しました。'],
    'IVS2026 Kyoto': ['IVS2026 京都', '京都で開催されたスタートアップカンファレンス IVS2026 に Academia 枠で参加し、WaytoAGI などのブースを回り、夜の交流会にも参加しました。'],
    'Tangquan Hackathon': ['湯泉ハッカソン', '南京の湯泉ハッカソンに参加し、温泉地でコードを書く独特の空気を体験しました。'],
    'Nanjing University Hackathon Finalist': ['南京高校ハッカソン 決勝進出', '2026年 AI Hackathon Tour 南京大学站で決勝進出を果たしました。'],
    'Global Hackathon': ['グローバルハッカソン', 'グローバルハッカソンで金賞を獲得し、アイデアを形にしました。'],
    'OpenClaw Feishu Plugin - Crazy Thursday': ['OpenClaw Feishu プラグイン - Crazy Thursday', 'Crazy Thursday 向けの OpenClaw Feishu プラグインを開発し、チーム協業の効率を高めました。'],
    'Nanjing OPC Hackathon': ['南京 OPC ハッカソン', '南京 OPC ハッカソンに参加し、AI とゲームの組み合わせを探りました。'],
    'AI Video/Comic Project': ['AI動画・漫画プロジェクト', 'AI生成動画と漫画を通じて、新しいデジタルストーリーテリングを試しました。'],
    'Nanjing MoFa Hackathon': ['南京 MoFa ハッカソン', '南京で開催された MoFa（Model Factory）ハッカソンに参加しました。'],
    'Shanghai Christmas Hackathon': ['上海クリスマスハッカソン', 'クリスマステーマの上海ハッカソンに参加しました。'],
    'Volcano Engine Force Conference': ['Volcano Engine Force カンファレンス', '上海で開催された Volcano Engine Force カンファレンスに参加しました。'],
    'Yukesong Google GDG Track': ['渝客松 Google GDG トラック', '渝客松ハッカソンの Google GDG トラックで 1 位を獲得しました。'],
    'Wuxi Rokid AR AI Competition': ['無錫 Rokid AR AI コンテスト', '無錫 Rokid AR AI コンテストで 3 位を獲得し、AR アプリのアイデアを発表しました。'],
    'Huikesong Hackathon': ['徽客松ハッカソン', '安徽のハッカソンで「随口成曲」プロジェクトを制作しました。'],
    'Alibaba Yunqi Conference': ['Alibaba 雲栖大会', '杭州・雲栖小鎮で開催された Alibaba Cloud 雲栖大会に参加しました。'],
    'Tencent Cloud Online Hackathon': ['Tencent Cloud オンラインハッカソン', 'ペット健康コンパニオンのミニアプリで Tencent Cloud ハッカソンの評価を獲得しました。'],
    'n8n + Xiaohongshu MCP Auto-posting': ['n8n + Xiaohongshu MCP 自動投稿', 'n8n ワークフローで小紅書アカウント運用を自動化しました。'],
    'Douyin Creator Competition': ['抖音クリエイターコンテスト', 'Coze ワークフローを使ったリーガルシアターアシスタントを制作しました。'],
    'TRAE SOLO Hackathon Shanghai': ['TRAE SOLO ハッカソン上海', 'TRAE SOLO ハッカソン上海大会で 2 位を獲得しました。'],
    'Nanckathon S1': ['Nanckathon S1', '南京で開催された Nanckathon S1 ハッカソンに参加しました。'],
    'TRAE Friends Nanjing': ['TRAE Friends 南京', 'TRAE Friends 南京で技術共有を行いました。'],
    'TRAE Friends Suzhou': ['TRAE Friends 蘇州', 'TRAE Friends 蘇州で技術共有を行いました。'],
    '2025 AdventureX': ['2025 AdventureX', '来場者として参加し、初めて近い距離でハッカソン文化を観察しました。'],
    'Trae Solo Hackathon Hangzhou': ['Trae Solo ハッカソン杭州', '新卒として WeChat ミニアプリの経験を持って参加しました。'],
    '2024 AdventureX': ['2024 AdventureX', '観客として初めてハッカソンを見学し、コミュニティから多くを学びました。']
};

function currentLang() {
    return window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
}

function localizedDate(date, lang) {
    const match = date.match(/^([A-Za-z]{3}) (\d{4})$/);
    if (!match) return date;
    const month = (monthLabels[lang] && monthLabels[lang][match[1]]) || match[1];
    if (lang === 'en') return `${month} ${match[2]}`;
    return `${match[2]}年${month}`;
}

function createTimelineItem(item, index) {
    const isEven = index % 2 === 0;
    const lang = currentLang();
    const badge = item.badge && badgeLabels[lang] ? (badgeLabels[lang][item.badge] || item.badge) : item.badge;
    const badgeHtml = badge ? `<span class="inline-block px-3 py-1 bg-accent-gold/10 dark:bg-accent-gold/20 text-accent-gold text-xs font-semibold rounded-full mb-3">${badge}</span>` : '';
    const linkText = lang === 'zh' ? '查看项目' : lang === 'ja' ? 'プロジェクトを見る' : 'View Project';
    const localizedCategory = (projectCategoryLabels[lang] && projectCategoryLabels[lang][item.category]) || item.category;
    const localizedCity = (cityLabels[lang] && cityLabels[lang][item.city]) || item.city;
    const displayDate = localizedDate(item.date, lang);
    const jaContent = lang === 'ja' ? projectJaContent[item.title] : null;
    const title = jaContent ? jaContent[0] : item.title;
    const desc = jaContent ? jaContent[1] : item.desc;
    const linkHtml = item.link ? `<a href="${item.link}" target="_blank" class="inline-flex items-center gap-1 text-sm text-primary dark:text-dark-text hover:underline mt-3"><span>${linkText}</span><span class="material-symbols-outlined text-sm">arrow_outward</span></a>` : '';

    // Handle multiple images.
    const images = item.images || [item.image];
    const hasMultipleImages = images.length > 1;
    const carouselId = `carousel-${index}`;

    let imageHtml = '';
    if (hasMultipleImages) {
        imageHtml = `
                    <div class="relative group/carousel">
                        <div class="aspect-[4/3] overflow-hidden">
                            ${images.map((img, imgIndex) => `
                                <img class="carousel-image w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${imgIndex === 0 ? '' : 'hidden'}"
                                     src="${img}"
                                     alt="${title} - ${imgIndex + 1}"
                                     loading="lazy"
                                     decoding="async"
                                     data-carousel="${carouselId}"
                                     data-index="${imgIndex}"/>
                            `).join('')}
                        </div>
                        <button class="carousel-prev absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10" data-carousel="${carouselId}">
                            <span class="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <button class="carousel-next absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10" data-carousel="${carouselId}">
                            <span class="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                        <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            ${images.map((_, imgIndex) => `
                                <div class="carousel-dot w-1.5 h-1.5 rounded-full ${imgIndex === 0 ? 'bg-white' : 'bg-white/50'} transition-all" data-carousel="${carouselId}" data-index="${imgIndex}"></div>
                            `).join('')}
                        </div>
                    </div>
                `;
    } else {
        imageHtml = `
                    <div class="aspect-[4/3] overflow-hidden">
                        <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src="${images[0]}" alt="${title}" loading="lazy" decoding="async"/>
                    </div>
                `;
    }

    return `
                <div class="timeline-item flex flex-col md:flex-row gap-6 md:gap-12 items-start">
                    <!-- Date Column -->
                    <div class="md:w-[120px] shrink-0 text-right hidden md:block">
                        <p class="text-lg font-display font-medium text-primary dark:text-dark-text">${displayDate}</p>
                        <p class="text-sm text-text-light dark:text-dark-text-muted flex items-center justify-end gap-1 mt-1">
                            <span class="material-symbols-outlined text-sm">location_on</span>
                            ${localizedCity}
                        </p>
                    </div>

                    <!-- Timeline Dot -->
                    <div class="hidden md:flex flex-col items-center">
                        <div class="w-4 h-4 rounded-full bg-primary dark:bg-dark-text border-4 border-white dark:border-dark-bg shadow-md z-10"></div>
                    </div>

                    <!-- Content Card -->
                    <div class="flex-1 group">
                        <!-- Mobile Date -->
                        <div class="md:hidden flex items-center gap-2 text-sm text-text-light dark:text-dark-text-muted mb-3">
                            <span class="font-medium text-primary dark:text-dark-text">${displayDate}</span>
                            <span>•</span>
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">location_on</span>${localizedCity}</span>
                        </div>

                        <div class="flex flex-col md:flex-row gap-6 items-start">
                            <!-- Image Card -->
                            <div class="bg-secondary dark:bg-dark-card rounded-2xl overflow-hidden hover:shadow-lg transition-shadow duration-300 max-w-xs shrink-0">
                                ${imageHtml}
                            </div>

                            <!-- Text Content with dash -->
                            <div class="flex items-start gap-4 flex-1">
                                <span class="text-2xl text-text-light dark:text-dark-text-muted font-light hidden md:block">—</span>
                                <div class="flex-1">
                                    ${badgeHtml}
                                    <span class="text-xs uppercase tracking-widest text-text-light dark:text-dark-text-muted">${localizedCategory}</span>
                                    <h3 class="text-xl font-display font-semibold text-primary dark:text-dark-text mt-2 group-hover:text-text-muted dark:group-hover:text-dark-text-muted transition-colors">${title}</h3>
                                    <p class="text-text-muted dark:text-dark-text-muted text-sm leading-relaxed mt-3">${desc}</p>
                                    ${linkHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
}

function updateFilterButtons(activeFilter) {
    filterButtons.forEach(btn => {
        const btnFilter = btn.dataset.filter;
        if (btnFilter === activeFilter) {
            btn.classList.remove('border', 'border-border-subtle', 'text-text-main');
            btn.classList.add('bg-primary', 'text-white', 'border-primary');
        } else {
            btn.classList.remove('bg-primary', 'text-white', 'border-primary');
            btn.classList.add('border', 'border-border-subtle', 'text-text-main');
        }
    });
}

function filterTimeline(filter) {
    currentFilter = filter;
    currentIndex = 0;

    if (filter === 'All') {
        filteredData = [...projectData];
    } else {
        filteredData = projectData.filter(item => item.category === filter);
    }

    timeline.innerHTML = '';

    const lang = currentLang();
    const loadMoreText = lang === 'zh' ? '加载更多里程碑' : lang === 'ja' ? 'もっとマイルストーンを見る' : 'Load More Milestones';
    loadMoreContainer.innerHTML = `
                <button id="loadMoreBtn" class="group flex items-center gap-3 px-8 py-4 border-2 border-primary text-primary rounded-full hover:bg-primary hover:text-white transition-all">
                    <span class="font-medium">${loadMoreText}</span>
                    <span class="material-symbols-outlined group-hover:translate-y-1 transition-transform">expand_more</span>
                </button>
            `;
    document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

    updateFilterButtons(filter);
    loadMore();
}

function loadMore() {
    const endIndex = Math.min(currentIndex + itemsPerPage, filteredData.length);

    for (let i = currentIndex; i < endIndex; i++) {
        const itemHtml = createTimelineItem(filteredData[i], i);
        timeline.insertAdjacentHTML('beforeend', itemHtml);
    }

    setTimeout(() => {
        const items = timeline.querySelectorAll('.timeline-item:not(.visible)');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 150);
        });
    }, 50);

    currentIndex = endIndex;

    if (currentIndex >= filteredData.length) {
        const lang = currentLang();
        const journeyText = lang === 'zh' ? '旅程继续...' : lang === 'ja' ? '旅は続きます...' : 'The journey continues...';
        const moreText = lang === 'zh' ? '更多里程碑即将到来' : lang === 'ja' ? 'さらに多くのマイルストーンを準備中です' : 'More milestones coming soon';
        loadMoreContainer.innerHTML = `
                    <div class="text-center py-8">
                        <div class="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
                            <span class="material-symbols-outlined text-3xl text-primary">rocket_launch</span>
                        </div>
                        <p class="font-display text-xl text-primary">${journeyText}</p>
                        <p class="text-text-light text-sm mt-2">${moreText}</p>
                    </div>
                `;
    }
}

filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterTimeline(btn.dataset.filter);
    });
});

// Bind the initial load-more button.
document.getElementById('loadMoreBtn').addEventListener('click', loadMore);
loadMore();

window.addEventListener('languageChanged', (event) => {
    if (event.detail.page === 'projects') {
        filterTimeline(currentFilter);
    }
});

// Carousel controls.
document.addEventListener('click', function(e) {
    // Handle the previous button.
    if (e.target.closest('.carousel-prev')) {
        const btn = e.target.closest('.carousel-prev');
        const carouselId = btn.dataset.carousel;
        navigateCarousel(carouselId, -1);
    }

    // Handle the next button.
    if (e.target.closest('.carousel-next')) {
        const btn = e.target.closest('.carousel-next');
        const carouselId = btn.dataset.carousel;
        navigateCarousel(carouselId, 1);
    }
});

function navigateCarousel(carouselId, direction) {
    const images = document.querySelectorAll(`img[data-carousel="${carouselId}"]`);
    const dots = document.querySelectorAll(`.carousel-dot[data-carousel="${carouselId}"]`);

    let currentIndex = -1;
    images.forEach((img, idx) => {
        if (!img.classList.contains('hidden')) {
            currentIndex = idx;
        }
    });

    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;

    // Hide the current image.
    images[currentIndex].classList.add('hidden');
    dots[currentIndex].classList.remove('bg-white');
    dots[currentIndex].classList.add('bg-white/50');

    // Show the new image.
    images[newIndex].classList.remove('hidden');
    dots[newIndex].classList.remove('bg-white/50');
    dots[newIndex].classList.add('bg-white');
}
