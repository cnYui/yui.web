const musicData = [
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.26.27.webp', title: 'Mai Enli', artist: 'Khalil Fong', genre: 'C-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.32.33.webp', title: '400 metres', artist: 'Chinese Football', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.33.50.webp', title: 'Feather', artist: 'Nujabes', genre: 'Jazz' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.34.24.webp', title: 'Sonny Boy', artist: 'Toe', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.34.50.webp', title: 'Time', artist: 'Pink Floyd', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.35.19.webp', title: 'Give Me The Gun', artist: 'American Football', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.37.41.webp', title: '4', artist: 'aesthetics across the color line', genre: 'Electronic' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.38.46.webp', title: 'more than words', artist: 'Hitsujibungaku', genre: 'J-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.39.09.webp', title: 'Simple Love', artist: 'Jay Chou', genre: 'C-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.39.42.webp', title: 'Odoriko', artist: 'Vaundy', genre: 'J-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.40.14.webp', title: 'The Other Side Of Paradise', artist: 'Glass Animals', genre: 'Electronic' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.40.37.webp', title: 'Maybe the Wind', artist: 'Sakanaction', genre: 'J-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.41.05.webp', title: 'Otonoke', artist: 'Creepy Nuts', genre: 'Hip-Hop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.41.39.webp', title: 'Graduation song', artist: 'Murphy Radio', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.42.02.webp', title: 'Just the Two of Us', artist: 'Grover Washington Jr.', genre: 'Jazz' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.42.38.webp', title: 'All My Life', artist: 'Lil Durk, J. Cole', genre: 'Hip-Hop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.43.11.webp', title: 'ANTENNA', artist: 'Supercar', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.43.41.webp', title: 'hong kong milk tea', artist: 'core wave', genre: 'Electronic' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.44.28.webp', title: 'Hakujitsu', artist: 'King Gnu', genre: 'J-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.45.29.webp', title: 'Vanilla', artist: 'Sunset Rollercoaster', genre: 'C-Pop' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.46.02.webp', title: 'You\'re Beautiful', artist: 'James Blunt', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.46.32.webp', title: 'Talking Box', artist: 'Wurs', genre: 'Electronic' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.47.15.webp', title: 'Yellow', artist: 'Coldplay', genre: 'Rock' },
    { image: '/images/optimized/music_pic/截屏2025-08-23 14.47.41.webp', title: 'Matasaburo', artist: 'Yorushika', genre: 'J-Pop' },
];

let currentIndex = 0;
let currentFilter = 'All';
let filteredData = [...musicData];
const itemsPerPage = 8;
const gallery = document.getElementById('musicGallery');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const showingCount = document.getElementById('showingCount');
const filterButtons = document.querySelectorAll('.filter-btn');
const musicGenreLabels = {
    zh: { 'C-Pop': '华语流行', 'Rock': '摇滚', 'Jazz': '爵士', 'Electronic': '电子', 'J-Pop': '日本流行', 'Hip-Hop': '嘻哈' },
    en: { 'C-Pop': 'C-Pop', 'Rock': 'Rock', 'Jazz': 'Jazz', 'Electronic': 'Electronic', 'J-Pop': 'J-Pop', 'Hip-Hop': 'Hip-Hop' },
    ja: { 'C-Pop': 'C-Pop', 'Rock': 'ロック', 'Jazz': 'ジャズ', 'Electronic': 'エレクトロニック', 'J-Pop': 'J-Pop', 'Hip-Hop': 'ヒップホップ' }
};

function currentLang() {
    return window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
}

function localizedMusicGenre(genre) {
    const lang = currentLang();
    return (musicGenreLabels[lang] && musicGenreLabels[lang][genre]) || genre;
}

function createCard(item) {
    return `
                <div class="music-item group flex flex-col gap-4 cursor-pointer">
                    <div class="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-dark-card">
                        <img class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" alt="${item.title}" src="${item.image}" width="800" height="705" loading="lazy" decoding="async"/>
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
                        <div class="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                            <button class="size-10 rounded-full bg-white dark:bg-dark-text text-primary dark:text-dark-bg flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                <span class="material-symbols-outlined text-[20px]">play_arrow</span>
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between items-start">
                            <h3 class="text-primary dark:text-dark-text text-lg font-bold leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">${item.title}</h3>
                        </div>
                        <p class="text-sm text-text-muted dark:text-dark-text-muted">${item.artist}</p>
                        <span class="text-xs text-text-tertiary dark:text-dark-text-muted">${localizedMusicGenre(item.genre)}</span>
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
        filteredData = [...musicData];
    } else {
        filteredData = musicData.filter(item => item.genre === filter);
    }

    gallery.innerHTML = '';

    const loadMoreText = getPageText('loadMore', 'Load More Tracks');
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
        const items = gallery.querySelectorAll('.music-item:not(.visible)');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 100);
        });
    }, 50);

    currentIndex = endIndex;
    updateShowingCount();

    if (currentIndex >= filteredData.length) {
        const endTitle = getPageText('endTitle', 'End of playlist!');
        const endDesc = getPageText('endDesc', 'Always discovering new music. Stay tuned for updates.');
        const suggestText = getPageText('suggestTrack', 'Suggest a Track');
        loadMoreContainer.innerHTML = `
                    <div class="group flex flex-col h-full bg-background-soft border border-accent-soft p-8 items-center justify-center text-center transition-all hover:bg-gray-100 rounded-lg">
                        <div class="w-12 h-12 flex items-center justify-center mb-6 text-primary">
                            <span class="material-symbols-outlined text-4xl font-light">headphones</span>
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
    if (event.detail.page === 'music') {
        filterGallery(currentFilter);
    }
});
