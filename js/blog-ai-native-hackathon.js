const zhArticleBody = document.getElementById('articleBody').innerHTML;
const articleLocales = {
    zh: {
        title: 'AI Native Developer：黑客松赛场上的开发者生存范式',
        date: '2026年4月13日',
        readTime: '15 分钟阅读',
        excerpt: '从黑客松实战、Vibe Coding 到 AI Native Developer，记录 AI 时代作品如何更容易拿奖，以及普通开发者如何重构自己的能力边界。',
        tags: ['AI Native', 'Hackathon', 'Vibe Coding', 'Reviewing'],
        shareTitle: '复制链接',
        copied: '复制成功',
        copyFailed: '复制失败',
        body: zhArticleBody
    },
    en: {
        title: 'AI Native Developer: A Survival Paradigm from the Hackathon Field',
        date: 'Apr 13, 2026',
        readTime: '15 min read',
        excerpt: 'From hackathon field notes to Vibe Coding, this essay explores how AI is reshaping what makes projects stand out and how developers must adapt.',
        tags: ['AI Native', 'Hackathon', 'Vibe Coding', 'Reviewing'],
        shareTitle: 'Copy link',
        copied: 'Link copied',
        copyFailed: 'Copy failed',
        body: `
                    <p>Since April last year, as a developer born in 2003, I have moved through hackathons of many sizes, from local community events to larger themed competitions. Over that stretch, I started to feel that my identity as a developer was being rewritten.</p>
                    <p>My background was originally pure software development. But after a year of intense competitions and day-to-day building, the question is no longer simply “what can you do?” In the age of AI, the more relevant question is closer to “how fast can you learn, and how much range can you cover?”</p>
                    <p>This article is a field note from that shift: <strong>what kind of projects are more likely to win at hackathons now</strong>, and <strong>how the survival paradigm for ordinary developers is changing in the AI era</strong>.</p>
                    <h2 class="text-primary dark:text-dark-text">01 From Coding to Reviewing</h2>
                    <p>I used to believe that true technical understanding only came from writing every line by hand. Bugs meant digging through CSDN, GitHub, and documentation for scattered fixes.</p>
                    <p>That belief was deeply challenged once tools like ChatGPT, Dify, and Windsurf matured. Development stopped feeling like pure implementation and started feeling more like orchestration, debugging, and product judgment.</p>
                    <p>When code can be generated in bulk from natural language, the shift is not only technical. It is cognitive. <strong>We are moving from hand-crafted coding toward product-centered reviewing.</strong></p>
                    <blockquote><p>Once implementation gets cheaper, the scarce skill is no longer writing faster, but deciding more clearly what deserves to be written.</p></blockquote>
                    <p>In that world, every developer has to become a product manager for their own project. If you cannot control requirements, AI will only help you generate low-value code more quickly.</p>
                    <p>To me, the end state of this shift is the <strong>AI Native Developer</strong>: someone building products that would not meaningfully exist without AI as a core part of the experience.</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                        <div class="article-card-block"><strong>Magnifier</strong><p>AI expands our personal output ceiling and capability boundaries.</p></div>
                        <div class="article-card-block"><strong>Conductor</strong><p>It lets us coordinate many agents through natural language.</p></div>
                        <div class="article-card-block"><strong>Swiss army knife</strong><p>It gives us confidence to move across disciplines with less friction.</p></div>
                    </div>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">02 Vibe Coding and the SDLC</h2>
                    <blockquote><p>With that kind of leverage, the software lifecycle itself starts to compress.</p></blockquote>
                    <p>What used to take a team two weeks to grind through in a sprint can sometimes be compressed into a single afternoon when one person works with the right AI toolchain.</p>
                    <p>My mental model for <strong>Vibe Coding</strong> is a fast lane that moves from <strong>Vibe</strong> to <strong>Spec</strong> to <strong>Harness</strong>. You ideate, clarify, plan, test, and review at a much higher cadence than before.</p>
                    <ol class="list-decimal">
                        <li><strong>Vibe:</strong> feed the AI enough context so it can ask back and co-define the requirements.</li>
                        <li><strong>Spec:</strong> let the AI draft a structured specification, then review it carefully.</li>
                        <li><strong>Plan:</strong> narrow that into concrete implementation steps and interface-level detail.</li>
                        <li><strong>TDD and validation:</strong> let AI help generate code, but keep human verification over the whole flow.</li>
                        <li><strong>Review and merge:</strong> treat review as a first-class step rather than a formality.</li>
                    </ol>
                    <p>The biggest feeling after using this loop is that <strong>coding time shrinks while debugging and judgment expand</strong>.</p>
                    <blockquote><p>AI can produce a version very quickly, but only humans can decide whether it is a version worth continuing.</p></blockquote>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">03 Hackathons Become a Sprint of Judgment</h2>
                    <p>Because of this rebuilt development loop, I became willing to enter hackathons much more frequently. And the reality on the ground is clear: with AI support, hackathons are no longer an endurance marathon of late-night coding. They are a sprint that heavily tests rhythm and decision-making.</p>
                    <div class="article-card-block"><strong>Think like a technical product manager.</strong><p>In a 30-hour real work window, requirement decomposition matters more than blind implementation volume.</p></div>
                    <div class="article-card-block"><strong>Taste and interaction now create outsized leverage.</strong><p>When implementation becomes easier, the first impression created by interface quality matters even more.</p></div>
                    <div class="article-card-block"><strong>Escape homogenization.</strong><p>Pure software ideas are increasingly crowded, while AIoT and hardware-linked experiences feel more distinctive and memorable.</p></div>
                    <blockquote><p>Hackathons are not contests about piling on features. They are contests about compressing judgment into a few dozen hours.</p></blockquote>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">04 Stop Panicking, Build Real Products</h2>
                    <p>The pace of change in AI can easily trigger FOMO. New frameworks, new protocols, new skills, new toolchains, and new workflows seem to appear every week.</p>
                    <blockquote><p>Most people do not need to obsess over every specific AI technique. It is often enough to keep turning around and checking what AI can now solve in the real world.</p></blockquote>
                    <p>But for developers inside the wave, just watching is not enough. My answer to anxiety is simple: <strong>join competitions and build things</strong>.</p>
                    <p>In the AI era, action itself is the most effective antidote to anxiety. Build, test, discard, rebuild, and finish your first truly AI Native product.</p>
                    <div class="article-card-block text-center"><p class="text-xl font-semibold text-primary dark:text-dark-text">Build, experiment, and finish your first AI Native product.</p></div>
                    <div class="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card my-8 shadow-md">
                        <img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-native-hackathon/finale.webp" alt="Closing image" loading="lazy" decoding="async"/>
                    </div>
                `
    },
    ja: {
        title: 'AI Native Developer: ハッカソン時代の開発者の生存戦略',
        date: '2026年4月13日',
        readTime: '15分で読める',
        excerpt: 'ハッカソンの実戦、Vibe Coding、そして AI Native Developer への変化を通して、AI 時代に開発者がどう戦うべきかを整理します。',
        tags: ['AI Native', 'ハッカソン', 'Vibe Coding', 'レビュー'],
        shareTitle: 'リンクをコピー',
        copied: 'リンクをコピーしました',
        copyFailed: 'コピーに失敗しました',
        body: `
                    <p>昨年4月から今に至るまで、私は大小さまざまなハッカソンを渡り歩いてきました。その中で強く感じたのは、開発者という自分の役割そのものが変わり始めていることです。</p>
                    <p>もともと私の背景は純粋なソフトウェア開発でした。しかし AI が実装コストを大きく下げたことで、競争の軸は「何が書けるか」だけではなく、「どれだけ素早く学び、どれだけ広く動けるか」へ移っています。</p>
                    <p>この文章では、<strong>今のハッカソンで評価されやすい作品の条件</strong>と、<strong>AI 時代に普通の開発者の生存様式がどう変わっているか</strong>を、自分の実感ベースで整理します。</p>
                    <h2 class="text-primary dark:text-dark-text">01 Coding から Reviewing へ</h2>
                    <p>以前の私は、1行ずつ自分の手で書いてこそ技術理解が深まると信じていました。バグが出れば CSDN や GitHub を掘り続ける、そんなやり方が当たり前でした。</p>
                    <p>ところが ChatGPT、Dify、Windsurf のようなツールが広がるにつれて、その前提が大きく揺らぎました。開発は実装そのものよりも、要求整理、判断、デバッグ、そしてレビューの比重が高くなっていったからです。</p>
                    <p><strong>自然言語から大量にコードが生まれる時代では、私たちは手作業の Coding から、製品中心の Reviewing へ移行している</strong>のだと思います。</p>
                    <blockquote><p>実装が安くなるほど、希少になるのは「速く書く力」ではなく、「何を書く価値があるかを定義する力」です。</p></blockquote>
                    <p>だからこそ、いまの開発者は自分のプロジェクトのプロダクトマネージャーでもなければなりません。要件を制御できなければ、AI は価値の低いコードをより速く増やすだけです。</p>
                    <p>その先にあるのが、私の考える <strong>AI Native Developer</strong> です。AI がなければ成立しない体験を、製品の中心に据えて作れる人です。</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                        <div class="article-card-block"><strong>拡大鏡</strong><p>個人の能力境界とアウトプット上限を大きく押し広げます。</p></div>
                        <div class="article-card-block"><strong>指揮棒</strong><p>自然言語で複数のエージェントを動かせるようになります。</p></div>
                        <div class="article-card-block"><strong>スイスアーミーナイフ</strong><p>分野横断の挑戦に踏み出す心理的コストを下げます。</p></div>
                    </div>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">02 Vibe Coding が SDLC を圧縮する</h2>
                    <blockquote><p>このレバレッジがあるからこそ、開発ライフサイクル自体が短く圧縮されます。</p></blockquote>
                    <p>以前ならチームで2週間かけていたスプリント相当の作業を、今は AI ツールチェーンと一緒に動くことで、個人でも非常に短いサイクルで回せる場面があります。</p>
                    <p>私の中での <strong>Vibe Coding</strong> は、<strong>Vibe</strong> から <strong>Spec</strong>、そして <strong>Harness</strong> へ進む高速道路です。発想、仕様化、計画、テスト、レビューを高密度に回していきます。</p>
                    <ol class="list-decimal">
                        <li><strong>Vibe:</strong> 十分な文脈を渡し、AI に問い返させながら要件を固める。</li>
                        <li><strong>Spec:</strong> AI に仕様を書かせ、人間がレビューする。</li>
                        <li><strong>Plan:</strong> それをさらに実装単位へ落とし込む。</li>
                        <li><strong>TDD と検証:</strong> AI にコード生成を手伝わせつつ、人間が全体の整合性を確認する。</li>
                        <li><strong>レビューと統合:</strong> レビューを形式ではなく中核工程として扱う。</li>
                    </ol>
                    <p>この流れで最も強く感じるのは、<strong>コーディング時間が縮み、判断とデバッグの比重が一気に増える</strong>ことです。</p>
                    <blockquote><p>AI はすばやく1つの版を作れますが、その版を育てる価値があるかどうかを決めるのは人間です。</p></blockquote>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">03 ハッカソンは判断力の短距離走になる</h2>
                    <p>この再構成された開発フローがあったからこそ、私はより高い頻度でハッカソンに参加できるようになりました。そして現場で見えたのは、AI の支援によってハッカソンが徹夜耐久戦ではなく、リズムと判断を競う短距離走に変わっているということです。</p>
                    <div class="article-card-block"><strong>技術型 PM の視点で要件を切る。</strong><p>30時間前後の実作業時間では、実装量よりも要求分解の精度が重要です。</p></div>
                    <div class="article-card-block"><strong>審美眼と操作体験が差になる。</strong><p>実装の壁が下がるほど、UI と体験の第一印象がより大きく効きます。</p></div>
                    <div class="article-card-block"><strong>同質化から逃げる。</strong><p>純ソフトウェア案は飽和しやすく、AIoT やハード連携の方が記憶に残りやすいです。</p></div>
                    <blockquote><p>ハッカソンは機能を積み上げる競技ではなく、数十時間の中に判断力を圧縮する競技です。</p></blockquote>
                    <hr/>
                    <h2 class="text-primary dark:text-dark-text">04 焦らず、実物の製品を作る</h2>
                    <p>AI 分野の変化はとても速く、FOMO を引き起こしやすいです。新しいフレームワーク、プロトコル、スキル、ワークフローが次々に現れます。</p>
                    <blockquote><p>すべての AI 技術を細かく追い続ける必要はありません。大事なのは、AI が現実の問題を今どこまで解けるのかを定期的に見返すことです。</p></blockquote>
                    <p>ただ、波の中にいる開発者にとって、眺めるだけでは足りません。私にとって不安への最も直接的な処方箋は、<strong>競技に出て、実際に作ること</strong>でした。</p>
                    <p>AI 時代において、行動力そのものが不安への最良の解毒剤です。作って、試して、壊して、作り直して、自分の最初の AI Native 製品を完成させることです。</p>
                    <div class="article-card-block text-center"><p class="text-xl font-semibold text-primary dark:text-dark-text">作って、試して、自分の最初の AI Native 製品を完成させよう。</p></div>
                    <div class="w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-card my-8 shadow-md">
                        <img class="w-full h-auto object-cover" src="/images/optimized/blog/ai-native-hackathon/finale.webp" alt="締めの画像" loading="lazy" decoding="async"/>
                    </div>
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
    const url = window.location.origin + window.location.pathname;
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
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

window.addEventListener('languageChanged', (event) => {
    renderArticleLocale(event.detail.lang);
});

renderArticleLocale(window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh');
