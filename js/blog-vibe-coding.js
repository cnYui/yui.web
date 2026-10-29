const zhArticleBody = document.getElementById('articleBody').innerHTML;
const articleLocales = {
    zh: {
        title: 'Vibe Coding 实战指南',
        date: '二〇二五年十二月三十一日',
        readTime: '十二分钟',
        excerpt: '一年多 AI Coding 实战经验总结，从构思设计到纠错技巧，帮助你减少"屎山代码"、提升开发效率。',
        tags: ['AI Coding', 'Vibe Coding', 'Trae', '开发效率', '前端'],
        shareTitle: '复制链接',
        copied: '复制成功',
        copyFailed: '复制失败',
        body: zhArticleBody
    },
    en: {
        title: 'Vibe Coding Practical Guide',
        date: 'Dec 31, 2025',
        readTime: '12 min read',
        excerpt: 'Lessons from more than a year of AI coding, from design thinking to debugging tricks that improve code quality and development speed.',
        tags: ['AI Coding', 'Vibe Coding', 'Trae', 'Productivity', 'Frontend'],
        shareTitle: 'Copy link',
        copied: 'Link copied',
        copyFailed: 'Copy failed',
        body: zhArticleBody
    },
    ja: {
        title: 'Vibe Coding 実践ガイド',
        date: '二〇二五年十二月三十一日',
        readTime: '十二分',
        excerpt: '1年以上の AI コーディング実践から、設計とデバッグのコツを整理し、コードの品質と開発効率を高める方法をまとめました。',
        tags: ['AI Coding', 'Vibe Coding', 'Trae', '開発効率', 'フロントエンド'],
        shareTitle: 'リンクをコピー',
        copied: 'リンクをコピーしました',
        copyFailed: 'コピーに失敗しました',
        body: `
                    <h2>はじめに</h2>
                    <p>私は昨年10月ごろから本格的に AI Coding を使い続け、卒業制作、React + TypeScript、Flutter、WeChat ミニアプリ、Android 開発などさまざまな場面で試してきました。その中で、コードを散らかしすぎず、効率よく前進するための自分なりの Vibe Coding のコツが見えてきました。</p>
                    <h2>1. 書き始める前に設計を閉じる</h2>
                    <p>AI にコードを書かせる前に、まず全体の枠組みを整理することが重要です。勢いだけで作り始めると、あとで大きく手戻りしやすくなります。</p>
                    <h3>ロジックを先に固める</h3>
                    <p>見た目だけでなく、ユーザーがどの順番で操作し、どこにデータが流れ、どこで状態が変わるかまで先に考えておくと、あとから発生する矛盾をかなり減らせます。</p>
                    <h3>視覚化する</h3>
                    <p>まずは紙にラフを描き、そのラフと補足テキストを UI 生成ツールに渡すのがおすすめです。抽象的な依頼よりも、具体的な形がある方が AI の精度は上がります。</p>
                    <h3>指示は具体的に</h3>
                    <p>色コード、余白、ナビゲーションの形など、できるだけ具体的に伝えると、生成された UI のズレが大きく減ります。</p>
                    <h2>2. コンテキストを与える: デザインから Trae へ</h2>
                    <p>AI デザインツールで納得のいく UI ができたら、それをどうやって実装フェーズへ移すかが次のポイントです。</p>
                    <ul>
                        <li><strong>素材を整える:</strong> HTML を保存して展開する</li>
                        <li><strong>正確に渡す:</strong> 各画面の HTML をそのまま作業ディレクトリへ入れる</li>
                        <li><strong>役割を説明する:</strong> どのボタンが何をし、どこへ遷移するかを明示する</li>
                        <li><strong>再現後に微調整する:</strong> React や Flutter でも、参照 HTML を 1:1 の基準として使う</li>
                    </ul>
                    <h2>3. 要件文書は細かく、そして人が責任を持つ</h2>
                    <p>要件文書の質は、そのまま出力されるコードの質に直結します。詳細であるほど、AI との齟齬は減ります。</p>
                    <h3>Human-in-the-loop</h3>
                    <p>AI に草案を広げてもらうのは便利ですが、最終的な方向性の確認は必ず人がやるべきです。判断を丸ごと預けると、思った以上に遠回りします。</p>
                    <h3>原子化する</h3>
                    <p>要件を細かい単位に分けて、「今は何を作るのか」を一つずつ明確にすると、AI の出力も安定しやすくなります。</p>
                    <h3>段階的に実装する</h3>
                    <p>一気に全部作らせるより、フェーズごとに積み上げた方が失敗時に戻りやすく、品質管理もしやすくなります。</p>
                    <h2>4. 直らない時は「禁止条件」を追加する</h2>
                    <p>ある機能で AI が何度も同じミスを繰り返す時は、単に「続けて」と言うより、避けてほしい実装方法を明示した方が効果的です。</p>
                    <ul>
                        <li><strong>一度引き戻す:</strong> 誤ったコードの上にさらに会話を積まない</li>
                        <li><strong>禁止事項を書く:</strong> 「XXX を使わない」「この方法は避ける」と明記する</li>
                        <li><strong>ネガティブ制約を増やす:</strong> 似た落とし穴を再び踏みにくくする</li>
                    </ul>
                    <h2>5. ループに入ったら、いったん止めて考える</h2>
                    <p>同じエラーに対して何度試しても改善しない時は、AI も文脈を見失っていることがあります。そんな時は勢いで続けるより、今の状況を整理させる方が近道です。</p>
                    <ul>
                        <li><strong>強制的に止める:</strong> 無限に試行錯誤させない</li>
                        <li><strong>質問で整理する:</strong> 「今の具体的なエラーは何か」「どのファイルに原因があるか」「解決案は何か」を聞く</li>
                        <li><strong>文脈を再構築する:</strong> これだけで解決策が見つかることは多い</li>
                    </ul>
                    <h2>6. 特定フレームワークは文書を先に読む</h2>
                    <p>WeChat ミニアプリ、Android、HarmonyOS、LangGraph など、特有の構文や前提がある技術では、公式ドキュメントを先に渡すのがかなり重要です。</p>
                    <ul>
                        <li><strong>幻覚を避ける:</strong> AI は知らない構文をそれらしく捏造しがちです</li>
                        <li><strong>ドキュメントを食べさせる:</strong> 実装前に関連する仕様を読ませる</li>
                        <li><strong>正しい参照軸を作る:</strong> 公式 Docs を基準にすることで、壊れたコードの確率を下げられます</li>
                    </ul>
                    <h2>まとめ</h2>
                    <p>Vibe Coding の本質は、先に考え、正しい文脈を渡し、要件を小さく分け、詰まった時には制約と整理を入れることです。これができると、AI は単なる補助ではなく、かなり頼れる共同開発者になります。</p>
                `
    }
};

function renderArticleLocale(lang) {
    const locale = articleLocales[lang] || articleLocales.zh;
    document.getElementById('articleTitle').textContent = locale.title;
    document.getElementById('articleMetaDate').textContent = locale.date;
    document.getElementById('articleMetaReadTime').textContent = locale.readTime;
    document.getElementById('articleExcerpt').textContent = locale.excerpt;
    document.title = `${locale.title} · ${lang === 'en' ? 'Yui' : '悠一'}`;
    document.getElementById('articleBody').innerHTML = locale.body;
    // 英文没有译文，沿用中文正文；标上 lang，排版和读屏才按中文处理。
    if (locale.body === zhArticleBody) {
        document.getElementById('articleBody').setAttribute('lang', 'zh-CN');
    } else {
        document.getElementById('articleBody').removeAttribute('lang');
    }
    const tagLabel = window.YuiLang ? window.YuiLang.getText('blog', 'tags', lang) : '标签';
    document.getElementById('articleTags').innerHTML =
        `<span>${tagLabel}</span>` + locale.tags.map(tag => `<span>${tag}</span>`).join('');
}

document.getElementById('shareBtn').addEventListener('click', async () => {
    const url = 'https://aaccx.pw' + window.location.pathname;
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
    const locale = articleLocales[lang] || articleLocales.zh;
    try {
        await navigator.clipboard.writeText(url);
        showToast(locale.copied);
    } catch (err) {
        console.error('Failed to copy: ', err);
        showToast(locale.copyFailed);
    }
});

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    // 下一帧再加 is-visible，让 wabi.css 里的淡入过渡生效。
    requestAnimationFrame(() => {
        void toast.offsetWidth;
        toast.classList.add('is-visible');
    });
    setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // 过渡事件没触发（后台标签页等）时兜底移除。
        setTimeout(() => toast.remove(), 600);
    }, 2000);
}

window.addEventListener('languageChanged', (event) => {
    renderArticleLocale(event.detail.lang);
});

renderArticleLocale(window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh');
