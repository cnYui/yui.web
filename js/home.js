const homeLocalizedContent = {
    zh: {
        featuredWorks: [
            { title: '渝客松 Google GDG - 第一名', type: '获奖', desc: '在渝客松黑客松 Google GDG 赛道获得第一名。' },
            { title: 'TRAE SOLO 黑客松上海站', type: '获奖', desc: '在 TRAE SOLO 黑客松上海站获得第二名。' },
            { title: '无锡 Rokid AR AI - 三等奖', type: '获奖', desc: '在无锡 Rokid AR AI 比赛中获得三等奖。' }
        ]
    },
    en: {
        featuredWorks: [
            { title: 'Yukesong Google GDG - 1st Place', type: 'Award', desc: 'Won first place in the Google GDG track at Yukesong Hackathon.' },
            { title: 'TRAE SOLO Hackathon Shanghai', type: 'Award', desc: 'Won second place at the TRAE SOLO Hackathon Shanghai edition.' },
            { title: 'Wuxi Rokid AR AI - 3rd Place', type: 'Award', desc: 'Won third place at the Wuxi Rokid AR AI competition.' }
        ]
    },
    ja: {
        featuredWorks: [
            { title: '渝客松 Google GDG トラック 優勝', type: '受賞', desc: '渝客松ハッカソンの Google GDG トラックで 1 位を獲得。' },
            { title: 'TRAE SOLO ハッカソン上海', type: '受賞', desc: 'TRAE SOLO ハッカソン上海大会で 2 位を獲得。' },
            { title: '無錫 Rokid AR AI 3 位', type: '受賞', desc: '無錫 Rokid AR AI コンテストで 3 位を受賞。' }
        ]
    }
};

function applyHomeLocalizedContent(lang) {
    const data = homeLocalizedContent[lang] || homeLocalizedContent.zh;
    const workCards = document.querySelectorAll('#work .grid .group.flex.flex-col');
    data.featuredWorks.forEach((item, index) => {
        const card = workCards[index];
        if (!card) return;
        const title = card.querySelector('h3');
        const type = card.querySelector('span.text-\\[10px\\]');
        const desc = card.querySelector('p');
        if (title) title.textContent = item.title;
        if (type) type.textContent = item.type;
        if (desc) desc.textContent = item.desc;
    });
    renderHomeLatestPosts(lang);
}

function getSortedLatestPosts(limit = 2) {
    return [...(window.YuiBlogData || [])]
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, limit);
}

function renderHomeLatestPosts(lang) {
    const container = document.getElementById('homeLatestPosts');
    if (!container) return;
    const posts = getSortedLatestPosts(2);
    container.innerHTML = posts.map((post) => {
        const title = post.title[lang] || post.title.zh;
        const excerpt = post.excerpt[lang] || post.excerpt.zh;
        const shortDate = post.shortDate?.[lang] || post.date[lang] || post.date.zh;
        return `
            <a class="group flex gap-6 items-start" href="${post.link}">
                <div class="w-32 h-24 md:w-40 md:h-28 bg-gray-200 dark:bg-dark-card shrink-0 overflow-hidden rounded-md" style='background-image: url("${post.image}"); background-size: cover; background-position: center;'></div>
                <div class="flex flex-col gap-2">
                    <span class="text-xs text-text-muted dark:text-dark-text-muted uppercase tracking-wider">${post.category} — ${shortDate}</span>
                    <h3 class="text-xl font-serif font-medium leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors text-text-main dark:text-dark-text">${title}</h3>
                    <p class="text-sm text-text-muted dark:text-dark-text-muted font-light line-clamp-2 leading-relaxed">${excerpt}</p>
                </div>
            </a>
        `;
    }).join('');
}

window.addEventListener('languageChanged', (event) => {
    if (event.detail.page === 'index') {
        applyHomeLocalizedContent(event.detail.lang);
    }
});

applyHomeLocalizedContent(window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh');
