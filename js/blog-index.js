(function () {
    const blogData = [...(window.YuiBlogData || [])].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    let currentIndex = 0;
    let currentFilter = 'All';
    let filteredData = [...blogData];
    const itemsPerPage = 4;
    const blogList = document.getElementById('blogList');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const filterButtons = document.querySelectorAll('.filter-btn');

    if (!blogList || !loadMoreContainer) return;

    function createCard(item) {
        const articleLink = item.link || `/blog/article?id=${item.id}`;
        const translations = window.YuiLang ? window.YuiLang.getPageTranslations() : null;
        const readText = translations?.readArticle || 'Read Article';
        const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
        const title = item.title[lang] || item.title.zh;
        const date = item.date[lang] || item.date.zh;
        const readTime = item.readTime[lang] || item.readTime.zh;
        const excerpt = item.excerpt[lang] || item.excerpt.zh;
        return `
            <a href="${articleLink}" class="blog-item group flex flex-col md:flex-row gap-6 p-6 border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card hover:border-primary/30 dark:hover:border-dark-text/30 hover:shadow-sm transition-all">
                <div class="w-full md:w-48 h-32 shrink-0 overflow-hidden rounded-md bg-gray-100 dark:bg-dark-surface">
                    <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${item.image}" alt="${title}" loading="lazy" decoding="async"/>
                </div>
                <div class="flex-1 flex flex-col gap-3">
                    <div class="flex items-center gap-3 text-xs">
                        <span class="px-2 py-1 rounded bg-primary dark:bg-dark-text text-white dark:text-dark-bg font-semibold uppercase tracking-wider">${item.category}</span>
                        <span class="text-text-muted dark:text-dark-text-muted">${date}</span>
                        <span class="text-text-muted dark:text-dark-text-muted">•</span>
                        <span class="text-text-muted dark:text-dark-text-muted">${readTime}</span>
                    </div>
                    <h2 class="text-xl font-bold text-primary dark:text-dark-text group-hover:text-text-muted dark:group-hover:text-dark-text-muted transition-colors">${title}</h2>
                    <p class="text-sm text-text-muted dark:text-dark-text-muted leading-relaxed line-clamp-2">${excerpt}</p>
                    <div class="flex items-center justify-between mt-auto pt-2">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                <img src="/images/profile/avatar-small.jpg" alt="${item.author}" class="w-full h-full object-cover" loading="lazy" decoding="async"/>
                            </div>
                            <span class="text-sm text-text-muted dark:text-dark-text-muted">${item.author}</span>
                        </div>
                        <span class="text-sm font-medium text-primary dark:text-dark-text flex items-center gap-1 group-hover:gap-2 transition-all">
                            ${readText} <span class="material-symbols-outlined text-sm">arrow_forward</span>
                        </span>
                    </div>
                </div>
            </a>
        `;
    }

    function updateFilterButtons(activeFilter) {
        filterButtons.forEach((btn) => {
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

    function loadMore() {
        const endIndex = Math.min(currentIndex + itemsPerPage, filteredData.length);
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');

        for (let i = currentIndex; i < endIndex; i++) {
            tempDiv.innerHTML = createCard(filteredData[i]);
            const card = tempDiv.firstElementChild;
            fragment.appendChild(card);
        }

        blogList.appendChild(fragment);

        setTimeout(() => {
            const items = blogList.querySelectorAll('.blog-item:not(.visible)');
            items.forEach((item, index) => {
                setTimeout(() => {
                    item.classList.add('visible');
                }, index * 100);
            });
        }, 50);

        currentIndex = endIndex;

        if (currentIndex >= filteredData.length) {
            const translations = window.YuiLang ? window.YuiLang.getPageTranslations() : null;
            const noMoreText = translations?.noMore || 'That\'s all! No more articles.';
            loadMoreContainer.innerHTML = `
                <div class="text-center text-text-muted text-sm py-8">
                    <span class="material-symbols-outlined text-2xl mb-2 block">check_circle</span>
                    ${noMoreText}
                </div>
            `;
        }
    }

    function filterBlog(filter) {
        currentFilter = filter;
        currentIndex = 0;
        filteredData = filter === 'All' ? [...blogData] : blogData.filter((item) => item.category === filter);
        blogList.innerHTML = '';

        const translations = window.YuiLang ? window.YuiLang.getPageTranslations() : null;
        const loadMoreText = translations?.loadMore || 'Load More Articles';
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

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBlog(btn.dataset.filter);
        });
    });

    const initialLoadMoreButton = document.getElementById('loadMoreBtn');
    if (initialLoadMoreButton) initialLoadMoreButton.addEventListener('click', loadMore);
    loadMore();

    window.addEventListener('languageChanged', (event) => {
        if (event.detail.page === 'blog') {
            filterBlog(currentFilter);
        }
    });
})();
