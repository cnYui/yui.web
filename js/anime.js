const animeData = [
    { image: '/images/optimized/animate/image.webp', title: '进击的巨人', genre: 'Action', rating: '9.5' },
    { image: '/images/optimized/animate/image copy.webp', title: '来自深渊', genre: 'Romance', rating: '9.2' },
    { image: '/images/optimized/animate/image copy 2.webp', title: 'Sonny Boy', genre: 'Slice of Life', rating: '8.8' },
    { image: '/images/optimized/animate/image copy 3.webp', title: '光が死んだ夏', genre: 'Fantasy', rating: '9.0' },
    { image: '/images/optimized/animate/image copy 4.webp', title: 'CITY', genre: 'Drama', rating: '9.3' },
    { image: '/images/optimized/animate/image copy 5.webp', title: '葬送的芙莉莲', genre: 'Action', rating: '8.9' },
    { image: '/images/optimized/animate/image copy 6.webp', title: '日常', genre: 'Music', rating: '9.1' },
    { image: '/images/optimized/animate/image copy 7.webp', title: '摇曳露营', genre: 'Romance', rating: '8.7' },
    { image: '/images/optimized/animate/image copy 8.webp', title: 'GIRLS BAND CRY', genre: 'Slice of Life', rating: '9.4' },
    { image: '/images/optimized/animate/image copy 9.webp', title: '不吉波普不笑', genre: 'Fantasy', rating: '8.6' },
    { image: '/images/optimized/animate/image copy 10.webp', title: '攻壳机动队', genre: 'Action', rating: '9.2' },
    { image: '/images/optimized/animate/image copy 11.webp', title: 'JOJO 的奇妙冒险', genre: 'Drama', rating: '8.8' },
    { image: '/images/optimized/animate/image copy 12.webp', title: '摇滚乃淑女的爱好', genre: 'Romance', rating: '9.0' },
    { image: '/images/optimized/animate/image copy 13.webp', title: '孤独摇滚！', genre: 'Music', rating: '8.5' },
    { image: '/images/optimized/animate/image copy 14.webp', title: '银魂', genre: 'Slice of Life', rating: '9.1' },
    { image: '/images/optimized/animate/image copy 15.webp', title: '幸运星', genre: 'Fantasy', rating: '8.9' },
    { image: '/images/optimized/animate/image copy 16.webp', title: 'Serial Experiments Lain', genre: 'Action', rating: '9.3' },
    { image: '/images/optimized/animate/image copy 17.webp', title: 'GIRLS BAND CRY', genre: 'Drama', rating: '8.7' },
    { image: '/images/optimized/animate/image copy 18.webp', title: '跃动青春', genre: 'Romance', rating: '9.0' },
    { image: '/images/optimized/animate/image copy 19.webp', title: 'DARKER THAN BLACK -黑之契约者-', genre: 'Music', rating: '8.8' },
    { image: '/images/optimized/animate/image copy 20.webp', title: '青春猪头少年系列', genre: 'Slice of Life', rating: '9.2' },
    { image: '/images/optimized/animate/image copy 21.webp', title: '凉宫春日的忧郁', genre: 'Fantasy', rating: '8.6' },
    { image: '/images/optimized/animate/image copy 22.webp', title: '悠哉日常大王', genre: 'Action', rating: '9.4' },
    { image: '/images/optimized/animate/image copy 23.webp', title: '齐木楠雄的灾难', genre: 'Drama', rating: '8.9' },
    { image: '/images/optimized/animate/image copy 24.webp', title: '86 -不存在的战区-', genre: 'Romance', rating: '9.1' },
    { image: '/images/optimized/animate/image copy 25.webp', title: '某科学的超电磁炮', genre: 'Music', rating: '8.5' },
    { image: '/images/optimized/animate/image copy 26.webp', title: '刀剑神域', genre: 'Slice of Life', rating: '9.0' },
    { image: '/images/optimized/animate/image copy 27.webp', title: '烙印战士', genre: 'Fantasy', rating: '8.8' },
    { image: '/images/optimized/animate/image copy 28.webp', title: 'Lycoris Recoil', genre: 'Action', rating: '9.3' },
    { image: '/images/optimized/animate/image copy 29.webp', title: '胆大党', genre: 'Drama', rating: '8.7' },
    { image: '/images/optimized/animate/image copy 30.webp', title: '轻音少女', genre: 'Romance', rating: '9.2' },
];

let currentIndex = 0;
let currentFilter = 'All';
let filteredData = [...animeData];
const itemsPerPage = 8;
const gallery = document.getElementById('animeGallery');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const showingCount = document.getElementById('showingCount');
const filterButtons = document.querySelectorAll('.filter-btn');
const animeGenreLabels = {
    zh: { 'Action': '动作', 'Romance': '恋爱', 'Slice of Life': '日常', 'Fantasy': '奇幻', 'Drama': '剧情', 'Music': '音乐' },
    en: { 'Action': 'Action', 'Romance': 'Romance', 'Slice of Life': 'Slice of Life', 'Fantasy': 'Fantasy', 'Drama': 'Drama', 'Music': 'Music' },
    ja: { 'Action': 'アクション', 'Romance': '恋愛', 'Slice of Life': '日常', 'Fantasy': 'ファンタジー', 'Drama': 'ドラマ', 'Music': '音楽' }
};

function currentLang() {
    return window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
}

function localizedAnimeTitle(item) {
    return item.title;
}

function localizedAnimeGenre(genre) {
    const lang = currentLang();
    return (animeGenreLabels[lang] && animeGenreLabels[lang][genre]) || genre;
}

function createCard(item) {
    const title = localizedAnimeTitle(item);
    const genre = localizedAnimeGenre(item.genre);
    return `
                <div class="anime-item group flex flex-col gap-4 cursor-pointer">
                    <div class="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-dark-card">
                        <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="${title}" src="${item.image}" width="528" height="760" loading="lazy" decoding="async"/>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between items-start">
                            <h3 class="text-primary dark:text-dark-text text-lg font-bold leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">${title}</h3>
                            <span class="flex items-center gap-1 text-xs font-bold text-primary dark:text-dark-text bg-secondary dark:bg-dark-card px-1.5 py-0.5 rounded">${item.rating}</span>
                        </div>
                        <p class="text-sm text-text-muted dark:text-dark-text-muted">${genre}</p>
                    </div>
                </div>
            `;
}

function updateFilterButtons(activeFilter) {
    filterButtons.forEach(btn => {
        const btnFilter = btn.dataset.filter;
        if (btnFilter === activeFilter) {
            btn.classList.remove('bg-secondary', 'dark:bg-dark-card', 'text-text-main', 'dark:text-dark-text');
            btn.classList.add('bg-primary', 'dark:bg-dark-text', 'text-white', 'dark:text-dark-bg');
        } else {
            btn.classList.remove('bg-primary', 'dark:bg-dark-text', 'text-white', 'dark:text-dark-bg');
            btn.classList.add('bg-secondary', 'dark:bg-dark-card', 'text-text-main', 'dark:text-dark-text');
        }
    });
}

function updateShowingCount() {
    const showing = Math.min(currentIndex, filteredData.length);
    const showingText = getPageText('showing', 'Showing');
    showingCount.textContent = `${showingText} ${showing} / ${filteredData.length}`;
}

function filterGallery(filter) {
    currentFilter = filter;
    currentIndex = 0;

    if (filter === 'All') {
        filteredData = [...animeData];
    } else {
        filteredData = animeData.filter(item => item.genre === filter);
    }

    gallery.innerHTML = '';

    const loadMoreText = getPageText('loadMore', 'Load More Titles');
    loadMoreContainer.innerHTML = `
                <button id="loadMoreBtn" class="flex items-center gap-2 rounded-md border border-border-subtle bg-white px-8 py-3 text-sm font-medium text-text-main hover:bg-gray-50 transition-colors">
                    ${loadMoreText}
                    <span class="material-symbols-outlined text-lg">expand_more</span>
                </button>
            `;
    document.getElementById('loadMoreBtn').addEventListener('click', loadMore);

    updateFilterButtons(filter);
    loadMore();
}

function loadMore() {
    const endIndex = Math.min(currentIndex + itemsPerPage, filteredData.length);
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');

    for (let i = currentIndex; i < endIndex; i++) {
        tempDiv.innerHTML = createCard(filteredData[i]);
        const card = tempDiv.firstElementChild;
        fragment.appendChild(card);
    }

    gallery.appendChild(fragment);

    setTimeout(() => {
        const items = gallery.querySelectorAll('.anime-item:not(.visible)');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 100);
        });
    }, 50);

    currentIndex = endIndex;
    updateShowingCount();

    if (currentIndex >= filteredData.length) {
        const endTitle = getPageText('endTitle', 'That\'s the collection!');
        const endDesc = getPageText('endDesc', 'Always watching new anime. Check back for updates.');
        const suggestText = getPageText('suggestAnime', 'Suggest an Anime');
        loadMoreContainer.innerHTML = `
                    <div class="group flex flex-col h-full bg-background-soft border border-accent-soft p-8 items-center justify-center text-center transition-all hover:bg-gray-100 rounded-lg">
                        <div class="w-12 h-12 flex items-center justify-center mb-6 text-primary">
                            <span class="material-symbols-outlined text-4xl font-light">theaters</span>
                        </div>
                        <h3 class="text-2xl font-display font-medium text-primary mb-3">${endTitle}</h3>
                        <p class="text-text-muted text-sm mb-8 leading-relaxed max-w-[200px]">${endDesc}</p>
                        <button class="bg-white border border-border-subtle text-primary px-6 py-2.5 rounded text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-all duration-300 shadow-sm">
                            ${suggestText}
                        </button>
                    </div>
                `;
    }
}

filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterGallery(btn.dataset.filter);
    });
});

function getPageText(key, fallback) {
    const pageText = window.YuiLang ? window.YuiLang.getPageTranslations() : null;
    return pageText && pageText[key] ? pageText[key] : fallback;
}

// Bind the initial load-more button
document.getElementById('loadMoreBtn').addEventListener('click', loadMore);
loadMore();

window.addEventListener('languageChanged', (event) => {
    if (event.detail.page === 'anime') {
        filterGallery(currentFilter);
    }
});
