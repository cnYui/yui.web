document.getElementById('shareBtn').addEventListener('click', async () => {
    const url = 'https://aaccx.pw' + window.location.pathname;
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
    const copiedText = lang === 'zh' ? '复制成功' : lang === 'ja' ? 'リンクをコピーしました' : 'Link copied';
    const failedText = lang === 'zh' ? '复制失败' : lang === 'ja' ? 'コピーに失敗しました' : 'Copy failed';
    try {
        await navigator.clipboard.writeText(url);
        showToast(copiedText);
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast(failedText);
    }
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 dark:bg-white/90 text-white dark:text-black px-6 py-3 rounded-full text-sm font-medium shadow-lg transition-all duration-300 opacity-0 translate-y-2 z-50';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger reflow
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

// Article data
const articles = {
    7: {
        title: { zh: 'Vibe Coding 实战指南', en: 'Vibe Coding Practical Guide', ja: 'Vibe Coding 実践ガイド' },
        category: { zh: 'AI', en: 'AI', ja: 'AI' },
        date: { zh: '2025年12月31日', en: 'Dec 31, 2025', ja: '2025年12月31日' },
        readTime: { zh: '12 分钟阅读', en: '12 min read', ja: '12分で読める' },
        excerpt: {
            zh: '一年多 AI Coding 实战经验总结，从构思设计到纠错技巧，帮助你减少"屎山代码"、提升开发效率。',
            en: 'Lessons from more than a year of AI coding, from design thinking to debugging tricks that reduce messy code.',
            ja: '1年以上の AI コーディング実践から、設計とデバッグのコツを整理し、コード品質を高める方法をまとめました。'
        },
        image: '/images/optimized/blog/vibe-coding-guide.webp',
        tags: {
            zh: ['AI Coding', 'Vibe Coding', 'Trae', '开发效率', '前端'],
            en: ['AI Coding', 'Vibe Coding', 'Trae', 'Productivity', 'Frontend'],
            ja: ['AI Coding', 'Vibe Coding', 'Trae', '開発効率', 'フロントエンド']
        },
        content: {
            zh: `
                    <h2 class="text-primary dark:text-dark-text">前言</h2>
                    <p>本人自去年10月起重度使用 AI Coding，历经毕业设计（深度学习/模型融合）、React + TypeScript、Flutter、微信小程序及安卓开发等多个领域。在一年多的实战中，我总结了一套减少"屎山代码"、提升开发效率的 Vibe Coding 经验，主要侧重于前端与流程控制。</p>
                    <h2 class="text-primary dark:text-dark-text">1. 动笔前的核心：构思与设计闭环</h2>
                    <p>在让 AI 写代码之前，必须先理清整体框架，切忌盲目开工。</p>
                `,
            ja: `
                    <h2 class="text-primary dark:text-dark-text">はじめに</h2>
                    <p>私は昨年10月ごろから本格的に AI Coding を使い続け、さまざまな技術領域で試してきました。その中で、設計からデバッグまで一貫して効率を上げるための Vibe Coding のコツが少しずつ見えてきました。</p>
                    <h2 class="text-primary dark:text-dark-text">1. 書き始める前に設計を閉じる</h2>
                    <p>AI にコードを書かせる前に、まず全体像を整理することが重要です。勢いだけで作り始めると、あとから大きく崩れやすくなります。</p>
                `
        }
    },
    1: {
        title: { zh: '使用 Node.js 构建可扩展 API', en: 'Building Scalable APIs with Node.js', ja: 'Node.js でスケーラブルな API を構築する' },
        category: { zh: '后端', en: 'Backend', ja: 'バックエンド' },
        date: { zh: '2023年10月12日', en: 'Oct 12, 2023', ja: '2023年10月12日' },
        readTime: { zh: '8 分钟阅读', en: '8 min read', ja: '8分で読める' },
        excerpt: {
            zh: '深入探讨如何组织 Express 应用，以支撑企业级规模。',
            en: 'A deep dive into structuring Express applications for enterprise-level scale.',
            ja: '大規模運用に耐える Express アプリケーション構成を解説します。'
        },
        image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=600&fit=crop',
        tags: {
            zh: ['Node.js', 'Express', 'API', '后端'],
            en: ['Node.js', 'Express', 'API', 'Backend'],
            ja: ['Node.js', 'Express', 'API', 'バックエンド']
        },
        content: {
            zh: `
                        <h2 class="text-primary dark:text-dark-text">引言</h2>
                        <p>构建可扩展 API 是现代后端开发中的关键能力。本文会介绍如何组织 Node.js 和 Express 应用，让服务能够在请求量增长时依旧保持稳定和可维护。</p>
                        <h2 class="text-primary dark:text-dark-text">项目结构</h2>
                        <p>清晰的目录结构是可扩展应用的基础。建议将控制器、中间件、模型、路由、服务和工具函数分开管理。</p>
                        <pre class="bg-gray-100 dark:bg-dark-card p-4 rounded-lg overflow-x-auto"><code>src/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
└── app.js</code></pre>
                        <h2 class="text-primary dark:text-dark-text">错误处理</h2>
                        <p>统一的错误处理中间件可以让接口响应保持一致，也更容易定位线上问题。</p>
                        <h2 class="text-primary dark:text-dark-text">数据库优化</h2>
                        <p>接口性能瓶颈常常来自数据库。连接池、索引、分页和缓存都是需要优先考虑的优化点。</p>
                        <h2 class="text-primary dark:text-dark-text">总结</h2>
                        <p>可扩展性不仅是处理更多请求，更是让系统在长期迭代中依旧容易维护、测试和扩展。</p>
                    `,
            en: `
                        <h2 class="text-primary dark:text-dark-text">Introduction</h2>
                        <p>Building scalable APIs is one of the most important skills for modern backend developers. In this article, we'll explore best practices for structuring Node.js applications that can handle millions of requests.</p>
                        <h2 class="text-primary dark:text-dark-text">Project Structure</h2>
                        <p>A well-organized project structure is the foundation of any scalable application. Here's a recommended structure for Express applications:</p>
                        <pre class="bg-gray-100 dark:bg-dark-card p-4 rounded-lg overflow-x-auto"><code>src/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
└── app.js</code></pre>
                        <h2 class="text-primary dark:text-dark-text">Error Handling</h2>
                        <p>Proper error handling is crucial for maintaining application stability. Implement a centralized error handling middleware that catches all errors and returns consistent responses.</p>
                        <h2 class="text-primary dark:text-dark-text">Database Optimization</h2>
                        <p>Database queries are often the bottleneck in API performance. Connection pooling, indexing, pagination, and caching should be considered early.</p>
                        <h2 class="text-primary dark:text-dark-text">Conclusion</h2>
                        <p>Scalability is not only about handling more requests. It is about building systems that remain maintainable, testable, and extensible over time.</p>
                    `,
            ja: `
                        <h2 class="text-primary dark:text-dark-text">はじめに</h2>
                        <p>スケーラブルな API を構築することは、現代のバックエンド開発で重要なスキルです。ここでは、リクエスト数が増えても安定して保守できる Node.js / Express アプリケーションの構成を整理します。</p>
                        <h2 class="text-primary dark:text-dark-text">プロジェクト構成</h2>
                        <p>整理されたディレクトリ構成は、拡張しやすいアプリケーションの土台です。コントローラー、ミドルウェア、モデル、ルート、サービス、ユーティリティを分けて管理すると見通しがよくなります。</p>
                        <pre class="bg-gray-100 dark:bg-dark-card p-4 rounded-lg overflow-x-auto"><code>src/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
└── app.js</code></pre>
                        <h2 class="text-primary dark:text-dark-text">エラーハンドリング</h2>
                        <p>安定した API には、統一されたエラーハンドリングが欠かせません。中央集約型のミドルウェアでエラーを受け止め、レスポンス形式をそろえることで、運用時の調査もしやすくなります。</p>
                        <h2 class="text-primary dark:text-dark-text">データベース最適化</h2>
                        <p>API の性能ボトルネックはデータベースに出やすいです。接続プール、適切なインデックス、ページネーション、キャッシュは早い段階で検討しておくと安心です。</p>
                        <h2 class="text-primary dark:text-dark-text">まとめ</h2>
                        <p>スケーラビリティとは、単に多くのリクエストを処理することではありません。長く運用しても保守しやすく、テストしやすく、拡張しやすい構造を作ることです。</p>
                    `
        }
    }
};

function getLocalizedValue(value, lang) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value[lang] || value.en || value.zh;
    }
    return value;
}

const relatedArticleLocales = {
    zh: [
        { meta: '前端 • 5 分钟阅读', title: 'CSS 的未来：容器查询' },
        { meta: '运维 • 10 分钟阅读', title: '面向前端开发者的 Docker 入门' }
    ],
    en: [
        { meta: 'Frontend • 5 min read', title: 'The Future of CSS: Container Queries' },
        { meta: 'DevOps • 10 min read', title: 'Docker for Frontend Developers' }
    ],
    ja: [
        { meta: 'フロントエンド • 5分で読める', title: 'CSS の未来：コンテナクエリ' },
        { meta: 'DevOps • 10分で読める', title: 'フロントエンド開発者のための Docker 入門' }
    ]
};

function renderRelatedArticles(lang) {
    const items = relatedArticleLocales[lang] || relatedArticleLocales.zh;
    document.querySelectorAll('.related-card').forEach((card, index) => {
        const item = items[index];
        if (!item) return;
        const meta = card.querySelector('.related-meta');
        const title = card.querySelector('.related-title');
        const image = card.querySelector('img');
        if (meta) meta.textContent = item.meta;
        if (title) title.textContent = item.title;
        if (image) image.alt = item.title;
    });
}

function renderArticle() {
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
    const activeArticle = articles[articleId];
    if (!activeArticle) return;

    document.getElementById('articleTitle').textContent = getLocalizedValue(activeArticle.title, lang);
    document.getElementById('articleCategory').textContent = getLocalizedValue(activeArticle.category, lang);
    document.getElementById('articleDate').textContent = getLocalizedValue(activeArticle.date, lang);
    document.getElementById('articleReadTime').textContent = getLocalizedValue(activeArticle.readTime, lang);
    document.getElementById('articleExcerpt').textContent = getLocalizedValue(activeArticle.excerpt, lang);
    document.getElementById('articleImage').src = activeArticle.image;
    document.title = getLocalizedValue(activeArticle.title, lang) + ' - Tech Blog';

    const content = getLocalizedValue(activeArticle.content, lang);
    if (content) {
        document.getElementById('articleContent').innerHTML = content;
    }

    const tags = getLocalizedValue(activeArticle.tags, lang);
    if (tags) {
        const tagsContainer = document.querySelector('.flex.flex-wrap.gap-2.mt-12');
        if (tagsContainer) {
            const tagLabel = lang === 'zh' ? '标签:' : lang === 'ja' ? 'タグ:' : 'Tags:';
            tagsContainer.innerHTML = '<span class="text-sm text-text-muted dark:text-dark-text-muted mr-2">' + tagLabel + '</span>' +
                tags.map(tag => `<span class="px-3 py-1 rounded-full bg-secondary dark:bg-dark-card text-sm text-text-main dark:text-dark-text">${tag}</span>`).join('');
        }
    }

    renderRelatedArticles(lang);
}

// Get article ID from URL
const urlParams = new URLSearchParams(window.location.search);
const articleId = urlParams.get('id') || 1;
const article = articles[articleId];

if (article) {
    renderArticle();
}

window.addEventListener('languageChanged', () => {
    renderArticle();
});
