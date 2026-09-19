const zhArticleBody = document.getElementById('articleBody').innerHTML;
const articleLocales = {
    zh: {
        title: 'AI生图生视频使用经历和经验',
        date: '2026年1月4日',
        readTime: '8 分钟阅读',
        excerpt: 'AI只是工具，人之所以为人是因为会使用工具。',
        tags: ['AI生图', 'AI视频', 'Sora2', 'Nano Banana', 'Chiikawa'],
        shareTitle: '复制链接',
        copied: '复制成功',
        copyFailed: '复制失败',
        body: zhArticleBody
    },
    en: {
        title: 'My Experience with AI Image and Video Generation',
        date: 'Jan 4, 2026',
        readTime: '8 min read',
        excerpt: 'AI is a tool, and what makes us human is knowing how to use it.',
        tags: ['AI Images', 'AI Video', 'Sora2', 'Nano Banana', 'Chiikawa'],
        shareTitle: 'Copy link',
        copied: 'Link copied',
        copyFailed: 'Copy failed',
        body: zhArticleBody
    },
    ja: {
        title: 'AI画像・動画生成の体験と実践メモ',
        date: '2026年1月4日',
        readTime: '8分で読める',
        excerpt: 'AI はあくまで道具であり、人が人であるのは、その道具を使いこなせるからだと思っています。',
        tags: ['AI画像生成', 'AI動画', 'Sora2', 'Nano Banana', 'Chiikawa'],
        shareTitle: 'リンクをコピー',
        copied: 'リンクをコピーしました',
        copyFailed: 'コピーに失敗しました',
        body: `
                    <h2 class="text-primary dark:text-dark-text">「スパゲッティ動画」から「本物のような映像」へ</h2>
                    <p>この2年で、AIによる画像生成と動画生成は一気に現実味を帯びてきました。最初はスパゲッティを食べるようなコミカル動画が話題でしたが、いまでは <strong>Veo3、Sora2、Nano Banana</strong> の登場によって、現実には存在しないのに驚くほど本物らしいビジュアルを作れるようになっています。</p>
                    <p>Sora2 が出た直後には、高齢の家族の姿を使って作った動画を見せても「これは本物だ」と信じてしまった、という話も耳にしました。大学生がアフリカのオープンカーで自撮りしているような映像を家族に送って、大騒ぎになった例まであり、生成映像の説得力はすでに冗談では済まないレベルです。</p>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">Sora2: 私の AI 動画の出発点</h2>
                    <p>Sora2 は 2025 年 9 月末に公開され、ちょうど仕事終わりに招待コード配布を見かけて試し始めました。10 月 1 日の夜に自分の顔をアップロードしてからは完全にのめり込み、国慶節の連休が終わるまでずっと遊び続けていました。</p>
                    <p>当時の Sora にはすでにウルトラマン系のネタ動画が大量にあり、その後は中国国内の短編動画プラットフォームでも、誇張された AI 動画が一気に広がっていきました。</p>
                    <ul class="list-disc">
                        <li>玄関の監視カメラ視点で、子猫がマシンガンや火炎放射器を持って暴れる映像</li>
                        <li>巨大なカバが家の中に突進して家具も壁も壊していく映像</li>
                        <li>現実ではあり得ないのに、つい信じてしまうようなネタ動画</li>
                    </ul>
                    <p>今では Sora2 は有料化され、生成回数も当初の 1 日 100 本から 50、本、そして 30 本へと減っていきました。それでも、私にとっては「AI 動画を発信する」という流れをつくってくれた大きなきっかけでした。</p>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">Nano Banana: 静止画から漫画へ</h2>
                    <p>Sora2 が扱いづらくなってからは、Gemini 系の <strong>Nano Banana</strong> に興味が移りました。このモデルが注目された理由は、Sora2 と同じく <strong>人物の一貫性</strong> が高かったからです。</p>
                    <p>特に印象的だったのは、自分の顔写真とネット上の服の参考画像を組み合わせるだけで、まるで試着写真のようなビジュアルを作れたことでした。あの頃は AI 試着という使い方もかなり流行っていました。</p>
                    <p>初期の Nano Banana は中国語テキストの扱いが苦手で、文字化けも多く、文字入れは別のモデルに頼ることがよくありました。それでも構図や人物表現の強さはかなり魅力的でした。</p>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">Nano Banana Pro: 創作の幅が一気に広がった</h2>
                    <p><strong>Nano Banana Pro</strong> が Gemini 3 とともに登場してからは、中国語の安定性が大きく改善され、作りたい絵をそのまま形にできるようになりました。</p>
                    <p>料理の分解図、Chiikawa の世界観を使った観光ガイド、写真作品のような一枚まで、理工系でありながらアートに憧れがあった私にとって、試したい表現が一気に増えました。</p>
                    <p>もともと写真が好きで、多少の美意識と Vibe Coding 的な試行錯誤にも慣れていたので、画像生成用のプロンプトを書く楽しさをかなり感じています。</p>
                    <p><strong>実際に作った作品の一部はこちらです。</strong></p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/chiikawa-1.webp" alt="AI作品1" loading="lazy" decoding="async"/></div>
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/chiikawa-2.webp" alt="AI作品2" loading="lazy" decoding="async"/></div>
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-gallery-3.webp" alt="AI作品3" loading="lazy" decoding="async"/></div>
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-gallery-4.webp" alt="AI作品4" loading="lazy" decoding="async"/></div>
                    </div>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">Chiikawa 漫画を一人で作ってみた</h2>
                    <p>私は絵の専門教育も小説執筆経験もありませんが、最近は <strong>オリジナルの Chiikawa 中編漫画</strong> を一人で作ってみました。ストーリーの骨子、コマ割り、四コマ、漫画ページまで、Nano Banana Pro の力を借りて完結できたのはかなり印象的でした。</p>
                    <p>ざっくりした制作フローは次の通りです。</p>
                    <ol class="list-decimal">
                        <li><strong>物語の骨格を作る</strong> - 先に全体の流れを決める</li>
                        <li><strong>ラフを素早く生成する</strong> - まずは初版の絵を出す</li>
                        <li><strong>参考画像を入れる</strong> - キャラクターの基準を揃える</li>
                        <li><strong>人物の一貫性を微調整する</strong> - 世界観を崩さないように整える</li>
                    </ol>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-8">
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-gallery-1.webp" alt="Chiikawa作品1" loading="lazy" decoding="async"/></div>
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card"><img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-gallery-2.webp" alt="Chiikawa作品2" loading="lazy" decoding="async"/></div>
                    </div>
                    <h2 class="text-primary dark:text-dark-text">審美眼とプロンプト設計が差になる</h2>
                    <p>私は <strong>幻想的で夢のような雰囲気</strong> を特に好みます。この空気感こそ、プロンプトで最も言語化しづらい部分です。AI で生成した写真を見て、裏側の Prompt をすぐ想像できないなら、その一枚は半分成功していると思っています。</p>
                    <p>こうした「言葉にしにくい創造性」は、いまも人間の強い武器です。参考事例や審美の蓄積を増やすために、私は <strong><a href="https://super-i.cn/" target="_blank" class="text-primary dark:text-dark-text hover:underline font-medium">刺猬星球</a></strong> のようなサイトもよく見ています。</p>
                    <div class="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card my-8 shadow-md">
                        <img class="w-full h-auto object-cover" src="/images/optimized/blog/hedgehog-homepage.webp" alt="刺猬星球" loading="lazy" decoding="async"/>
                        <p class="text-sm text-center text-text-muted dark:text-dark-text-muted py-3 bg-gray-50 dark:bg-dark-surface border-t border-border-subtle dark:border-dark-border">刺猬星球: プロンプト事例と審美の蓄積に役立つサイト</p>
                    </div>
                    <p>フィルムシミュレーションや写真家のスタイル参照など、複数のテクニックを組み合わせることで、自分だけの絵作りに近づけます。</p>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">娯楽から業務へ: 画像生成の実務価値</h2>
                    <p>AI 画像生成はエンタメだけでなく、実際の制作フローも変えています。私の仕事でも、工場の 2D 設計図を疑似 3D の可視化画面へ落とし込むニーズがありました。</p>
                    <p><strong>従来フローの課題</strong></p>
                    <ul class="list-disc">
                        <li>複雑な 2D 図面を読み解く負担が大きい</li>
                        <li>3D の手作業モデリングに時間がかかる</li>
                        <li>修正コストが高く、反応速度が遅い</li>
                    </ul>
                    <p><strong>AI を使った解決策</strong></p>
                    <p>原図を図例と局所構造に分けて参照画像と一緒に渡し、適切な Prompt で工程の意味を理解させることで、高品質な疑似 3D 表現を直接生成できるようにしました。</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card shadow-sm group">
                            <div class="relative overflow-hidden"><img class="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105" src="/images/optimized/blog/factory-2d-drawing.webp" alt="2D図面" loading="lazy" decoding="async"/></div>
                            <p class="text-sm text-center font-medium text-text-muted dark:text-dark-text-muted py-3 bg-gray-50 dark:bg-dark-surface">入力: 元の 2D 工業図面</p>
                        </div>
                        <div class="rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card shadow-sm group">
                            <div class="relative overflow-hidden"><img class="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105" src="/images/optimized/blog/factory-3d-render.webp" alt="3D表示" loading="lazy" decoding="async"/></div>
                            <p class="text-sm text-center font-medium text-text-muted dark:text-dark-text-muted py-3 bg-gray-50 dark:bg-dark-surface">出力: AI が生成した疑似 3D モニタリング図</p>
                        </div>
                    </div>
                    <p>この方法によって効率は大きく上がり、最終的な画面も監視システムのインタラクションに直接つなげられるようになりました。</p>
                    <hr/>
                    <blockquote>
                        <p>AI 画像・動画生成を使っていて感じるのは、道具は進化し、創作の敷居は下がっているということです。ただし、創造性そのものは依然として人間のものだと思います。</p>
                    </blockquote>
                `
    }
};

function renderArticleLocale(lang) {
    const locale = articleLocales[lang] || articleLocales.zh;
    document.getElementById('articleTitle').textContent = locale.title;
    document.getElementById('articleMetaDate').textContent = locale.date;
    document.getElementById('articleMetaReadTime').textContent = locale.readTime;
    document.getElementById('articleExcerpt').textContent = locale.excerpt;
    document.title = `${locale.title} - Tech Blog`;
    document.getElementById('articleBody').innerHTML = locale.body;
    document.getElementById('shareBtn').title = locale.shareTitle;
    document.getElementById('articleTags').innerHTML =
        `<span class="text-sm text-text-muted dark:text-dark-text-muted mr-2">${window.YuiLang ? window.YuiLang.getText('blog', 'tags', lang) : '标签:'}</span>` +
        locale.tags.map(tag => `<span class="px-3 py-1 rounded-full bg-secondary dark:bg-dark-card text-sm text-text-main dark:text-dark-text">${tag}</span>`).join('');
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

window.addEventListener('languageChanged', (event) => {
    renderArticleLocale(event.detail.lang);
});

renderArticleLocale(window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh');
