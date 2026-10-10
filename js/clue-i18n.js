// 首页线索墙的多语言（中 / 英 / 日）：词典 + 语言引擎。
//
// 约定：
// - index.html 里写的是中文，也是无脚本 / 爬虫看到的版本；要翻译的节点带 data-i18n="键"（innerHTML 用 data-i18n-html，
//   属性用 data-i18n-attrs="aria-label:键;alt:键"）。TEXT 里每个键同时写 zh / en / ja，
//   test/home-i18n.test.js 会校验 zh 和 index.html 一致、三种语言键齐全，不会各改各的。
// - js/clue-data.js 里的档案数据仍然是中文；DATA.en / DATA.ja 按下标覆盖其中要翻译的字段（长度由测试守住）。
// - 博客正文由 scripts/build-blog-articles.js 另生成 js/blog-articles.en.js / .ja.js，点开文章时按需加载。
// - 语言存在 localStorage 的 yui-portfolio-lang，和子页面的 js/lang.js 共用；首屏语言由 js/clue-lang-init.js 先定下。
(function () {
    'use strict';

    const LANGS = ['zh', 'en', 'ja'];
    const init = window.YuiLangInit || { key: 'yui-portfolio-lang', lang: 'zh', htmlLang: { zh: 'zh-CN', en: 'en', ja: 'ja' } };
    let lang = LANGS.indexOf(init.lang) >= 0 ? init.lang : 'zh';

    const TEXT = {
    'wall.license.title': { zh: '私家侦探', en: 'Private Eye', ja: '私立探偵' },
    'wall.about.kicker': { zh: 'FILE 01 · 关于我', en: 'FILE 01 · ABOUT ME', ja: 'FILE 01 · 自己紹介' },
    'wall.about.title': { zh: '谁是悠一？', en: 'Who is Yui?', ja: '悠一とは？' },
    'wall.about.en': { zh: 'WHO IS YUI?', en: 'SUBJECT BRIEFING', ja: 'WHO IS YUI?' },
    'wall.about.desc': { zh: 'AI Native Developer · 福井大学研究生 · 接受远程工作', en: 'AI Native Developer · Grad student, Univ. of Fukui · Open to remote work', ja: 'AI Native Developer · 福井大学大学院生 · リモート可' },
    'wall.portrait.caption': { zh: '主角 · 悠一 Yui', en: 'The Subject · Yui', ja: '主役 · 悠一 Yui' },
    'wall.portrait.sub': { zh: 'SUBJECT · AI NATIVE DEVELOPER', en: 'AI NATIVE DEVELOPER', ja: 'SUBJECT · AI NATIVE DEVELOPER' },
    'wall.tape': { zh: '福井大学 研究生 · 独立开发者 · 设计师 · 创作者', en: 'Univ. of Fukui grad student · Indie developer · Designer · Creator', ja: '福井大学 大学院生 · 個人開発者 · デザイナー · クリエイター' },
    'wall.shop.file': { zh: 'FILE 06 · 商店', en: 'FILE 06', ja: 'FILE 06 · ショップ' },
    'wall.shop.tag': { zh: 'SHOP', en: 'SHOP', ja: 'SHOP' },
    'wall.projects.file': { zh: 'FILE 02 · 项目', en: 'FILE 02 · PROJECTS', ja: 'FILE 02 · プロジェクト' },
    'wall.projects.title': { zh: '项目 · 案件时间线', en: 'Projects · Case Timeline', ja: '案件タイムライン' },
    'wall.projects.sub': { zh: 'CASE TIMELINE · 25 CASES · 6 AWARDS', en: '25 CASES · 6 AWARDS', ja: 'CASE TIMELINE · 25 CASES · 6 AWARDS' },
    'wall.projects.stamp': { zh: '金奖 AWARDED', en: 'AWARDED', ja: '受賞 AWARDED' },
    'wall.ai.title': { zh: 'AI Native Developer：黑客松赛场上的开发者生存范式', en: 'AI Native Developer: A Hackathon Survival Paradigm', ja: 'AI Native Developer: ハッカソン時代の開発者の生存戦略' },
    'wall.blog.file': { zh: 'FILE 03 · 博客', en: 'FILE 03 · BLOG', ja: 'FILE 03 · ブログ' },
    'wall.blog.entries': { zh: '6 ENTRIES', en: '6 ENTRIES', ja: '6 ENTRIES' },
    'wall.blog.title': { zh: '笔记 · Field Notes', en: 'Field Notes', ja: 'ノート · Field Notes' },
    'wall.blog.i1': { zh: '2026.06 — Back to Vibe Coding（上）', en: '2026.06 — Back to Vibe Coding (Part 1)', ja: '2026.06 — Back to Vibe Coding（上）' },
    'wall.blog.i2': { zh: '2026.06 — 低成本使用 Codex Token', en: '2026.06 — Low-Cost Codex Tokens', ja: '2026.06 — Codex Token を低コストで使う方法' },
    'wall.blog.i3': { zh: '2026.06 — SpeakMore 云输入是怎么做的', en: '2026.06 — Building SpeakMore', ja: '2026.06 — SpeakMore クラウド入力のつくり方' },
    'wall.map.title': { zh: '行踪图 · 旅行 2024 → 2026', en: 'Whereabouts · Travel 2024 → 2026', ja: '足取り図 · 旅行 2024 → 2026' },
    'wall.map.sub': { zh: 'FILE 05 · TRAVEL LOG', en: 'FILE 05 · TRAVEL LOG', ja: 'FILE 05 · TRAVEL LOG' },
    'wall.resume.kicker': { zh: 'FILE 04 · 履历 · DOSSIER', en: 'FILE 04 · RESUME · DOSSIER', ja: 'FILE 04 · 履歴 · DOSSIER' },
    'wall.resume.lines': { zh: '福井大学 工学研究科 · 2026–2028<br>AI Mage 东京 实习 · 2026.9 – 至今<br>国家能源研究院 R&amp;D 实习 · 2025–2026<br>JLPT N2 · TOEIC 850 · TOEFL 84', en: 'Univ. of Fukui · 2026–2028<br>AI Mage (Tokyo) · 2026.9 – now<br>Natl. Energy Inst. · 2025–2026<br>JLPT N2 · TOEIC 850 · TOEFL 84', ja: '福井大学 工学研究科 · 2026–2028<br>AI Mage 東京 · 2026.9 – 現在<br>国家エネルギー研究所 · 2025–2026<br>JLPT N2 · TOEIC 850 · TOEFL 84' },
    'wall.resume.stamp': { zh: '机密 CONFIDENTIAL', en: 'CONFIDENTIAL', ja: '機密 CONFIDENTIAL' },
    'wall.desk.cap': { zh: '名古屋 · 蓝调时刻', en: 'Nagoya · Blue Hour', ja: '名古屋 · ブルーアワー' },
    'wall.desk.memo': { zh: 'MEMO · 待办<br>· 整理 2026 案卷<br>· 回复 xiaobianfuai@gmail.com', en: 'MEMO · TO DO<br>· Sort the 2026 case files<br>· Reply to xiaobianfuai@gmail.com', ja: 'MEMO · やること<br>· 2026年の事件簿を整理<br>· xiaobianfuai@gmail.com に返信' },
    'ui.sound.label': { zh: '环境音 · ', en: 'SOUND · ', ja: '環境音 · ' },
    'ui.sound.en': { zh: 'AMBIENT: ', en: '', ja: 'AMBIENT: ' },
    'ui.hint': { zh: '拖动环视 · DRAG TO LOOK AROUND — 点击便签，取下来放到桌上细看 · CLICK A NOTE TO TAKE IT DOWN', en: 'DRAG TO LOOK AROUND — CLICK A NOTE TO TAKE IT DOWN', ja: 'ドラッグで見回す · DRAG TO LOOK AROUND — 付箋をクリックして机の上へ · CLICK A NOTE TO TAKE IT DOWN' },
    'ui.back': { zh: '← 钉回墙上 · PIN IT BACK', en: '← PIN IT BACK', ja: '← 壁に戻す · PIN IT BACK' },
    'about.title': { zh: '关于我 · 谁是悠一？', en: 'About · Who is Yui?', ja: '自己紹介 · 悠一とは何者？' },
    'about.stamp': { zh: '接受远程 · OPEN TO REMOTE', en: 'OPEN TO REMOTE', ja: 'リモート可 · REMOTE OK' },
    'about.photo.cap': { zh: '悠一 Yui · 福井大学', en: 'Yui · University of Fukui', ja: '悠一 Yui · 福井大学' },
    'about.profile.kicker': { zh: 'SUBJECT PROFILE · 基本档案', en: 'SUBJECT PROFILE', ja: 'SUBJECT PROFILE · 基本情報' },
    'about.dt.name': { zh: '姓名 NAME', en: 'NAME', ja: '氏名 NAME' },
    'about.dd.name': { zh: 'Yui / 悠一（WU JIANXIANG）', en: 'Yui / 悠一 (WU JIANXIANG)', ja: 'Yui / 悠一（WU JIANXIANG）' },
    'about.dt.status': { zh: '现状 STATUS', en: 'STATUS', ja: '現状 STATUS' },
    'about.dd.status': { zh: '日本福井大学 研究生 · 2026.4 – 2028.3', en: 'Graduate student, University of Fukui, Japan · 2026.4 – 2028.3', ja: '日本・福井大学 大学院生 · 2026.4 – 2028.3' },
    'about.dt.role': { zh: '定位 ROLE', en: 'ROLE', ja: '役割 ROLE' },
    'about.dd.role': { zh: 'AI Native Developer · 独立开发者 · 设计师 · 创作者', en: 'AI Native Developer · Indie developer · Designer · Creator', ja: 'AI Native Developer · 個人開発者 · デザイナー · クリエイター' },
    'about.dt.avail': { zh: '状态 AVAILABILITY', en: 'AVAILABILITY', ja: '稼働 AVAILABILITY' },
    'about.dd.avail': { zh: '接受远程工作 · open to remote', en: 'Open to remote work', ja: 'リモートワーク歓迎 · open to remote' },
    'about.dt.seen': { zh: '出没 SEEN AT', en: 'SEEN AT', ja: '出没 SEEN AT' },
    'about.dd.seen': { zh: '长三角 &amp; 线上黑客松 · 25 场活动 · 10 座城市', en: 'Yangtze River Delta &amp; online hackathons · 25 events · 10 cities', ja: '長江デルタ &amp; オンラインのハッカソン · 25イベント · 10都市' },
    'about.meta.kicker': { zh: '三个隐喻 · THREE METAPHORS', en: 'THREE METAPHORS', ja: '三つの比喩 · THREE METAPHORS' },
    'about.meta.title': { zh: '放大镜 · 指挥棒 · 瑞士军刀', en: 'Lens · Baton · Swiss Knife', ja: '虫眼鏡 · 指揮棒 · 十徳ナイフ' },
    'about.meta.text': { zh: 'AI 放大个体能力，让开发者可以指挥多个 agent，也更有底气面对陌生挑战。', en: 'AI amplifies the individual: conduct many agents, face the unknown with confidence.', ja: 'AI は個人の力を拡大し、複数の agent を指揮して、未知の課題にも自信を持って向き合えるようにします。' },
    'about.vibe.title': { zh: 'VIBE <span>氛围</span>', en: 'VIBE <span>mood</span>', ja: 'VIBE <span>雰囲気</span>' },
    'about.vibe.text': { zh: '探索想法、用户情绪、产品方向与情感价值。', en: 'Exploring ideas, user emotion, product direction and emotional value.', ja: 'アイデア、ユーザーの感情、プロダクトの方向性、情緒的な価値を探ります。' },
    'about.spec.title': { zh: 'SPEC <span>规范</span>', en: 'SPEC <span>rules</span>', ja: 'SPEC <span>仕様</span>' },
    'about.spec.text': { zh: '需求、用户流程、技术边界、MVP / P0 / P1、可测试的行为。', en: 'Requirements, user flows, technical boundaries, MVP / P0 / P1, testable behavior.', ja: '要件、ユーザーフロー、技術的な境界、MVP / P0 / P1、テスト可能な振る舞い。' },
    'about.harness.title': { zh: 'HARNESS <span>支撑</span>', en: 'HARNESS <span>support</span>', ja: 'HARNESS <span>支え</span>' },
    'about.harness.text': { zh: 'skills、plans、tests、smoke tests、debug loops、review checkpoints。', en: 'Skills, plans, tests, smoke tests, debug loops, review checkpoints.', ja: 'skills、plans、tests、smoke tests、debug loops、review checkpoints。' },
    'about.contact.title': { zh: 'CONTACT · 联系', en: 'CONTACT', ja: 'CONTACT · 連絡先' },
    'about.contact.skill': { zh: 'SKILL.md · 给 AGENT 的档案', en: 'SKILL.md · A file for your AGENT', ja: 'SKILL.md · AGENT 向けファイル' },
    'projects.title': { zh: '项目 · 案件时间线', en: 'Projects · Case Timeline', ja: 'プロジェクト · 案件タイムライン' },
    'projects.stamp': { zh: '已结案 SOLVED · ', en: 'SOLVED · ', ja: '解決 SOLVED · ' },
    'blog.title': { zh: '博客 · 笔记 Field Notes', en: 'Blog · Field Notes', ja: 'ブログ · Field Notes' },
    'blog.sub': { zh: 'FILE 03 · FIELD NOTES — 6 ENTRIES · 2025.12 → 2026.06 · 点击卡片在桌上阅读 · READ ON THE DESK', en: 'FILE 03 · FIELD NOTES — 6 ENTRIES · 2025.12 → 2026.06 · CLICK A CARD TO READ IT ON THE DESK', ja: 'FILE 03 · FIELD NOTES — 6 ENTRIES · 2025.12 → 2026.06 · カードをクリックして机の上で読む · READ ON THE DESK' },
    'reader.kicker': { zh: '案卷 · CASE NOTE', en: 'CASE NOTE', ja: '事件ノート · CASE NOTE' },
    'reader.back': { zh: '← 回到笔记 · ALL NOTES', en: '← ALL NOTES', ja: '← ノート一覧へ · ALL NOTES' },
    'reader.end': { zh: '— END OF REPORT · 完 —', en: '— END OF REPORT —', ja: '— 以上 · END OF REPORT —' },
    'resume.title': { zh: '履历 · 身份档案', en: 'Resume · Identity File', ja: '履歴 · 身分ファイル' },
    'resume.h.edu': { zh: '教育 · EDUCATION', en: 'EDUCATION', ja: '学歴 · EDUCATION' },
    'resume.edu1': { zh: '<span class="cw-strong">福井大学</span> · 工学研究科 知识社会基础工学', en: '<span class="cw-strong">University of Fukui</span> · Graduate School of Engineering, Knowledge Society Basic Engineering', ja: '<span class="cw-strong">福井大学</span> · 工学研究科 知識社会基礎工学専攻' },
    'resume.h.exp': { zh: '经历 · EXPERIENCE', en: 'EXPERIENCE', ja: '職歴 · EXPERIENCE' },
    'resume.job0': { zh: '<span class="cw-strong">AI Mage（东京）</span> · アニメ IP 監修 × AI 实习', en: '<span class="cw-strong">AI Mage (Tokyo)</span> · Anime IP Supervision × AI Intern', ja: '<span class="cw-strong">AI Mage（東京）</span> · アニメ IP 監修 × AI インターン' },
    'resume.job0.date': { zh: '2026.9 – 至今', en: '2026.9 – present', ja: '2026.9 – 現在' },
    'resume.job0.desc': { zh: 'アニメ IP × AI 方向的东京初创公司，在 IP 監修场景下做 AI 应用。', en: 'A Tokyo startup working at the intersection of anime IP and AI, building AI applications for IP supervision.', ja: 'アニメ IP × AI のスタートアップ（東京）。IP 監修の現場で AI を活用したアプリケーションに取り組んでいます。' },
    'resume.job1': { zh: '<span class="cw-strong">国家能源研究院（南京）</span> · R&amp;D / DevOps 实习', en: '<span class="cw-strong">National Energy Research Institute (Nanjing)</span> · R&amp;D / DevOps Intern', ja: '<span class="cw-strong">国家エネルギー研究所（南京）</span> · 研究開発 / DevOps インターン' },
    'resume.job1.desc': { zh: '多模态 RAG 的开发、部署与运维：把原始文档变成可检索的文本、图片、表格与向量资产。', en: 'Multimodal RAG development, deployment and operations: turning raw documents into searchable text, image, table and vector assets.', ja: 'マルチモーダル RAG の開発・デプロイ・運用保守。元ドキュメントを検索可能なテキスト、画像、表、ベクトル資産へ整理しました。' },
    'resume.job1.i1': { zh: '从源文档抽取文本、图片与表格，进入检索工作流', en: 'Extracted text, images and tables from source documents into the retrieval workflow', ja: '元ドキュメントからテキスト、画像、表を抽出し、検索ワークフローへ投入' },
    'resume.job1.i2': { zh: '本地视觉模型打标，embedding 向量化与召回测试', en: 'Tagged images with local vision models; ran embedding vectorization and recall tests', ja: 'ローカルのビジョンモデルで画像にタグ付けし、埋め込みによるベクトル化とリコールテストを実施' },
    'resume.job1.i3': { zh: '设计 Docker 网络，构建多模态 Agentic RAG 对话 WebUI 并完成前后端集成', en: 'Designed the Docker network and built a multimodal Agentic RAG chat WebUI, front end to back end', ja: 'Docker ネットワークを設計し、マルチモーダル Agentic RAG のチャット WebUI を前後端まで含めて構築' },
    'resume.h.cert': { zh: '证书 · CERTIFICATIONS', en: 'CERTIFICATIONS', ja: '資格 · CERTIFICATIONS' },
    'resume.h.skills': { zh: '技能 · SKILLS', en: 'SKILLS', ja: 'スキル · SKILLS' },
    'resume.skill1.t': { zh: 'RAG 系统', en: 'RAG Systems', ja: 'RAGシステム' },
    'resume.skill1.d': { zh: '多模态 RAG、Agentic RAG、GraphRAG、向量数据库、语义检索与召回评估', en: 'Multimodal RAG, Agentic RAG, GraphRAG, vector databases, semantic retrieval and recall evaluation', ja: 'マルチモーダル RAG、Agentic RAG、GraphRAG、ベクトルデータベース、セマンティック検索、リコール評価' },
    'resume.skill2.t': { zh: '工作流自动化', en: 'Workflow Automation', ja: 'ワークフロー自動化' },
    'resume.skill2.d': { zh: 'Dify、n8n、Coze、LangGraph 与 AI 工作流编排', en: 'Dify, n8n, Coze, LangGraph and AI workflow orchestration', ja: 'Dify、n8n、Coze、LangGraph と AI ワークフローのオーケストレーション' },
    'resume.skill3.t': { zh: 'AI Native 开发', en: 'AI Native Development', ja: 'AI Native 開発' },
    'resume.skill3.d': { zh: '从需求、上下文设计、代码审查到上线验证的 Codex 式工作流', en: 'A Codex-style workflow from requirements and context design through code review to production verification', ja: '要件定義、コンテキスト設計、コードレビュー、本番検証までを通す Codex 型ワークフロー' },
    'resume.skill4.t': { zh: '部署 Deployment', en: 'Deployment', ja: 'デプロイ Deployment' },
    'resume.skill4.d': { zh: 'Docker 网络、前后端 WebUI 交付、本地模型集成与运维', en: 'Docker networking, front-end/back-end WebUI delivery, local model integration and operations', ja: 'Docker ネットワーク、前後端 WebUI の納品、ローカルモデル連携、運用保守' },
    'resume.h.awards': { zh: '奖项 · AWARDS', en: 'AWARDS', ja: '受賞 · AWARDS' },
    'resume.download': { zh: '下载 PDF · DOWNLOAD RESUME', en: 'DOWNLOAD RESUME (PDF)', ja: 'ダウンロード · DOWNLOAD RESUME' },
    'resume.stamp': { zh: '机密 CONFIDENTIAL', en: 'CONFIDENTIAL', ja: '機密 CONFIDENTIAL' },
    'travel.title': { zh: '旅行 · 行踪', en: 'Travel · Whereabouts', ja: '旅行 · 足取り' },
    'travel.sub': { zh: 'FILE 05 · TRAVEL LOG — 2 COUNTRIES · 13 CITIES · 80+ PHOTOS · 下一站 NEXT: 大阪 OSAKA', en: 'FILE 05 · TRAVEL LOG — 2 COUNTRIES · 13 CITIES · 80+ PHOTOS · NEXT STOP: OSAKA', ja: 'FILE 05 · TRAVEL LOG — 2 COUNTRIES · 13 CITIES · 80+ PHOTOS · 次の目的地 NEXT: 大阪 OSAKA' },
    'travel.map.row': { zh: '行踪图 · TRAVEL LOG', en: 'WHEREABOUTS · TRAVEL LOG', ja: '足取りマップ · TRAVEL LOG' },
    'travel.recent': { zh: '最近目击 · RECENT SIGHTINGS', en: 'RECENT SIGHTINGS', ja: '最近の目撃情報 · RECENT SIGHTINGS' },
    'travel.r1.a': { zh: '2026.09.18 · 福井 永平寺 Eiheiji', en: '2026.09.18 · Fukui · Eiheiji', ja: '2026.09.18 · 福井 永平寺 Eiheiji' },
    'travel.r1.b': { zh: '曹洞宗大本山', en: 'Head temple of Soto Zen', ja: '曹洞宗大本山' },
    'travel.r2.a': { zh: '2026.08.15 · 冲绳 Okinawa', en: '2026.08.15 · Okinawa', ja: '2026.08.15 · 沖縄 Okinawa' },
    'travel.r2.b': { zh: '一周 · 与那原大绳曳', en: 'One week · Yonabaru Great Tug-of-War', ja: '1週間 · 与那原大綱曳' },
    'travel.r3.a': { zh: '2026.06.30 · 奈良 Nara', en: '2026.06.30 · Nara', ja: '2026.06.30 · 奈良 Nara' },
    'travel.r3.b': { zh: '鹿 · 春日大社', en: 'Deer · Kasuga Taisha', ja: '鹿 · 春日大社' },
    'travel.r4.a': { zh: '2026.07 · 京都 IVS2026', en: '2026.07 · Kyoto · IVS2026', ja: '2026.07 · 京都 IVS2026' },
    'travel.r4.b': { zh: '见 FILE 02', en: 'See FILE 02', ja: 'FILE 02 を参照' },
    'shop.title': { zh: '商店 · 天才程序员中转站', en: 'Shop · Code Transit', ja: 'ショップ · 天才プログラマー中継所' },
    'shop.ticket.kicker': { zh: 'ADMIT ONE · 通行券', en: 'ADMIT ONE', ja: 'ADMIT ONE · 通行券' },
    'shop.ticket.cta': { zh: '进入商店 · ENTER →', en: 'ENTER THE SHOP →', ja: 'ショップへ入る · ENTER →' },
    'shop.clue.kicker': { zh: '线索 · CLUE', en: 'CLUE', ja: '手がかり · CLUE' },
    'shop.clue.title': { zh: '入口藏在店面图片的正中央。', en: 'Look closer.', ja: '入口は店舗画像のど真ん中に隠れています。' },
    'shop.clue.en': { zh: 'THE ENTRANCE IS HIDDEN AT THE CENTER OF THE PICTURE.', en: 'THE ENTRANCE IS HIDDEN AT THE CENTER OF THE PICTURE.', ja: 'THE ENTRANCE IS HIDDEN AT THE CENTER OF THE PICTURE.' },
    'shop.stamp': { zh: '营业中 OPEN', en: 'OPEN', ja: '営業中 OPEN' },
    'wall.about.aria': { zh: '打开档案 01：关于我 · 谁是悠一？', en: 'Open file 01: About · Who is Yui?', ja: 'ファイル01を開く：自己紹介 · 悠一とは何者？' },
    'wall.portrait.aria': { zh: '打开档案 01：主角 · 悠一 Yui', en: 'Open file 01: The subject · Yui', ja: 'ファイル01を開く：主役 · 悠一 Yui' },
    'wall.portrait.alt': { zh: '悠一 Yui', en: 'Portrait of Yui', ja: '悠一 Yui のポートレート' },
    'wall.shop.aria': { zh: '打开档案 06：商店 · CODE TRANSIT', en: 'Open file 06: Shop · CODE TRANSIT', ja: 'ファイル06を開く：ショップ · CODE TRANSIT' },
    'wall.projects.aria': { zh: '打开档案 02：项目 · 案件时间线', en: 'Open file 02: Projects · Case Timeline', ja: 'ファイル02を開く：プロジェクト · 案件タイムライン' },
    'wall.projects.alt': { zh: '环球黑客松 金奖', en: 'Global Hackathon — Gold Award', ja: 'グローバルハッカソン 金賞' },
    'wall.blog.aria': { zh: '打开档案 03：博客 · 笔记 Field Notes', en: 'Open file 03: Blog · Field Notes', ja: 'ファイル03を開く：ブログ · Field Notes' },
    'wall.map.aria': { zh: '打开档案 05：行踪图 · 旅行', en: 'Open file 05: Whereabouts map · Travel', ja: 'ファイル05を開く：足取りマップ · 旅行' },
    'wall.map.alt': { zh: '行踪图 · 悠一的旅行路线', en: 'Whereabouts map · Yui\'s travel routes', ja: '足取りマップ · 悠一の旅のルート' },
    'wall.polaroid.alt': { zh: '东京夜景', en: 'Tokyo at night', ja: '東京の夜景' },
    'wall.resume.aria': { zh: '打开档案 04：履历 · DOSSIER', en: 'Open file 04: Resume · DOSSIER', ja: 'ファイル04を開く：履歴 · DOSSIER' },
    'about.photo.alt': { zh: '悠一 Yui', en: 'Portrait of Yui', ja: '悠一 Yui のポートレート' },
    'travel.map.alt': { zh: '行踪图 · 悠一的旅行路线 2024–2026', en: 'Whereabouts map · Yui\'s travel routes, 2024–2026', ja: '足取りマップ · 悠一の旅のルート 2024–2026' },
    'shop.storefront.alt': { zh: 'CODE TRANSIT · 进入 Sub2API', en: 'CODE TRANSIT · Enter Sub2API', ja: 'CODE TRANSIT · Sub2API に入る' },

    // ---- 不在 index.html 里、由脚本渲染的文案 ----
    'meta.title': { zh: 'Yui · 悠一 | 线索墙 Clue Wall', en: 'Yui · 悠一 | Clue Wall', ja: 'Yui · 悠一 | 手がかりの壁 Clue Wall' },
    'meta.description': { zh: '悠一 Yui 的个人主页：AI Native Developer，福井大学研究生。拖动环视侦探书房里的线索墙，点击便签把档案取到桌上细看——关于我、项目、博客、履历、旅行与商店。', en: 'Yui\'s personal site: AI Native Developer and graduate student at the University of Fukui. Drag to look around a detective\'s study, then click a note to take its file down to the desk: About, Projects, Blog, Resume, Travel and Shop.', ja: '悠一（Yui）の個人サイト。AI Native Developer、福井大学大学院生。探偵の書斎の手がかりの壁をドラッグして見回し、付箋をクリックして机の上でファイルを開けます——自己紹介・プロジェクト・ブログ・履歴・旅行・ショップ。' },
    'cat.award': { zh: '获奖 AWARD', en: 'AWARD', ja: '受賞 AWARD' },
    'cat.hackathon': { zh: '黑客松 HACKATHON', en: 'HACKATHON', ja: 'ハッカソン HACKATHON' },
    'cat.meetup': { zh: '聚会 MEETUP', en: 'MEETUP', ja: '交流会 MEETUP' },
    'cat.project': { zh: '项目 PROJECT', en: 'PROJECT', ja: 'プロジェクト PROJECT' },
    'link.view': { zh: '查看 · VIEW →', en: 'VIEW →', ja: '見る · VIEW →' },
    'link.read': { zh: '阅读 · READ →', en: 'READ →', ja: '読む · READ →' },
    'post.kicker': { zh: 'AI · {date}', en: 'AI · {date}', ja: 'AI · {date}' },
    'reader.paperDate': { zh: 'REPORT · 手稿 · {date}', en: 'REPORT · MANUSCRIPT · {date}', ja: 'REPORT · 手稿 · {date}' },
    'reader.blocks': { zh: '{n} BLOCKS · YUI', en: '{n} BLOCKS · YUI', ja: '{n} BLOCKS · YUI' },
    'reader.note': { zh: '本文只有中文原文。', en: 'This article has no English translation yet — the full text below is the Chinese original.', ja: 'この記事はまだ日本語訳がありません。以下の本文は中国語の原文です。' },
    'cover.about.file': { zh: 'FILE 01 · 关于我', en: 'FILE 01 · ABOUT ME', ja: 'FILE 01 · 自己紹介' },
    'cover.about.title': { zh: '谁是悠一？', en: 'Who is Yui?', ja: '悠一とは？' },
    'cover.about.sub': { zh: 'WHO IS YUI?', en: 'SUBJECT BRIEFING', ja: 'WHO IS YUI?' },
    'cover.aboutPortrait.file': { zh: 'FILE 01 · 关于我', en: 'FILE 01 · ABOUT ME', ja: 'FILE 01 · 自己紹介' },
    'cover.aboutPortrait.title': { zh: '主角 · 悠一 Yui', en: 'The Subject · Yui', ja: '主役 · 悠一 Yui' },
    'cover.aboutPortrait.sub': { zh: 'SUBJECT · AI NATIVE DEVELOPER', en: 'AI NATIVE DEVELOPER', ja: 'SUBJECT · AI NATIVE DEVELOPER' },
    'cover.projects.file': { zh: 'FILE 02 · 项目', en: 'FILE 02 · PROJECTS', ja: 'FILE 02 · プロジェクト' },
    'cover.projects.title': { zh: '案件时间线', en: 'Case Timeline', ja: '案件タイムライン' },
    'cover.projects.sub': { zh: 'CASE TIMELINE', en: '25 CASES · 6 AWARDS', ja: 'CASE TIMELINE' },
    'cover.blog.file': { zh: 'FILE 03 · 博客', en: 'FILE 03 · BLOG', ja: 'FILE 03 · ブログ' },
    'cover.blog.title': { zh: '笔记 · Field Notes', en: 'Field Notes', ja: 'ノート · Field Notes' },
    'cover.blog.sub': { zh: '6 ENTRIES', en: '6 ENTRIES', ja: '6 ENTRIES' },
    'cover.resume.file': { zh: 'FILE 04 · 履历', en: 'FILE 04 · RESUME', ja: 'FILE 04 · 履歴' },
    'cover.resume.title': { zh: '身份档案', en: 'Identity File', ja: '身分ファイル' },
    'cover.resume.sub': { zh: 'DOSSIER · CONFIDENTIAL', en: 'DOSSIER · CONFIDENTIAL', ja: 'DOSSIER · CONFIDENTIAL' },
    'cover.travel.file': { zh: 'FILE 05 · 旅行', en: 'FILE 05 · TRAVEL', ja: 'FILE 05 · 旅行' },
    'cover.travel.title': { zh: '行踪图', en: 'Whereabouts Map', ja: '足取りマップ' },
    'cover.travel.sub': { zh: 'TRAVEL LOG', en: 'TRAVEL LOG', ja: 'TRAVEL LOG' },
    'cover.shop.file': { zh: 'FILE 06 · 商店', en: 'FILE 06 · SHOP', ja: 'FILE 06 · ショップ' },
    'cover.shop.title': { zh: '天才程序员中转站', en: 'Code Transit', ja: '天才プログラマー中継所' },
    'cover.shop.sub': { zh: 'CODE TRANSIT · SUB2API', en: 'CODE TRANSIT · SUB2API', ja: 'CODE TRANSIT · SUB2API' },
    'github.aria': { zh: 'GitHub 贡献图：{login} 在 {year} 年共 {total} 次贡献{synced}', en: 'GitHub contribution graph: {login} made {total} contributions in {year}{synced}', ja: 'GitHub コントリビューショングラフ：{login} の {year} 年の合計は {total} 件{synced}' },
    'github.synced': { zh: '，更新于 {time}', en: ', synced {time}', ja: '、更新 {time}' },
    };

    const DATA = {
        en: {
        projects: [
            { title: 'Osaka Rokid Mini Hackathon', desc: 'Won runner-up (tied for 2nd place) at the Rokid mini hackathon in Osaka with the project "DoubleTraining".', city: 'Osaka' },
            { title: 'IVS2026 Kyoto', desc: 'Attended the IVS2026 startup conference in Kyoto with an Academia pass, visited startup booths such as WaytoAGI and joined a dinner meetup.', city: 'Kyoto' },
            { title: 'Nanjing University Hackathon Finalist', desc: 'Reached the finals at the Nanjing University stop of the 2026 AI Hackathon Tour.', city: 'Nanjing' },
            { title: 'Tangquan Hackathon', desc: 'Participated in Nanjing Tangquan Hackathon, experiencing the unique atmosphere of coding in hot springs.', city: 'Nanjing' },
            { title: 'Global Hackathon', desc: 'Won gold award at Global Hackathon, showcasing innovative ideas.', city: 'Shanghai' },
            { title: 'OpenClaw Feishu Plugin - Crazy Thursday', desc: 'Developed OpenClaw Feishu plugin for Crazy Thursday event, enhancing team collaboration efficiency.', city: 'Online' },
            { title: 'Nanjing OPC Hackathon', desc: 'Participated in Nanjing OPC Hackathon, exploring AI + Gaming.', city: 'Nanjing' },
            { title: 'AI Video/Comic Project', desc: 'Creative AI-generated video and comic content exploring new forms of digital storytelling.', city: 'Online' },
            { title: 'Nanjing MoFa Hackathon', desc: 'Participated in the MoFa (Model Factory) Hackathon in Nanjing.', city: 'Nanjing' },
            { title: 'Shanghai Christmas Hackathon', desc: 'Joined the festive Christmas-themed hackathon in Shanghai.', city: 'Shanghai' },
            { title: 'Volcano Engine Force Conference', desc: 'Attended the Volcano Engine Force Conference in Shanghai.', city: 'Shanghai' },
            { title: 'Yukesong Google GDG Track', desc: 'Achieved 1st place in the Google GDG track at Yukesong hackathon.', city: 'Chongqing' },
            { title: 'Wuxi Rokid AR AI Competition', desc: 'Won 3rd place at the Wuxi Rokid AR AI competition, showcasing innovative AR applications.', city: 'Wuxi' },
            { title: 'Huikesong Hackathon', desc: 'Created "Suikou Chengqu" (Instant Song) project at Anhui hackathon.', city: 'Anhui' },
            { title: 'Alibaba Yunqi Conference', desc: 'Attended the Alibaba Cloud Yunqi Conference at Yunqi Town, Hangzhou.', city: 'Hangzhou' },
            { title: 'Tencent Cloud Online Hackathon', desc: 'Pet health companion mini-program that won recognition at Tencent Cloud hackathon.', city: 'Online' },
            { title: 'n8n + Xiaohongshu MCP Auto-posting', desc: 'Automated Xiaohongshu account management using n8n workflow.', city: 'Online' },
            { title: 'Douyin Creator Competition', desc: 'Legal Theater Assistant built with Coze workflow for Douyin Creator competition.', city: 'Online' },
            { title: 'TRAE SOLO Hackathon Shanghai', desc: 'Won 2nd place at the TRAE SOLO Hackathon Shanghai edition.', city: 'Shanghai' },
            { title: 'Nanckathon S1', desc: 'Participated in the Nanckathon S1 hackathon event in Nanjing.', city: 'Nanjing' },
            { title: 'TRAE Friends Nanjing', desc: 'Technical sharing session at TRAE Friends Nanjing meetup.', city: 'Nanjing' },
            { title: 'TRAE Friends Suzhou', desc: 'Technical sharing session at TRAE Friends Suzhou meetup.', city: 'Suzhou' },
            { title: '2025 AdventureX', desc: 'Attended as a visitor, first close-up observation and learning experience.', city: 'Hangzhou' },
            { title: 'Trae Solo Hackathon Hangzhou', desc: 'Participated as a fresh graduate with WeChat mini-program experience.', city: 'Hangzhou' },
            { title: '2024 AdventureX', desc: 'First time observing a hackathon as a spectator, learning from the community.', city: 'Hangzhou' }
        ],
        projectCats: [
            { label: 'ALL' },
            { label: 'AWARD' },
            { label: 'HACKATHON' },
            { label: 'MEETUP' },
            { label: 'PROJECT' }
        ],
        posts: [
            { title: 'Making Videos with Claude Opus 5.5: It Cannot Generate Video, but It Can Write One Frame at a Time', excerpt: 'Claude is not a diffusion model, yet it can build complete videos with code. How Opus 5.5 makes video, what goes into one episode, and how the cost compares with Veo, Seedance and Kling.', read: '9 min' },
            { title: 'Back to Vibe Coding: What to Know Before AI-Driven Development (Part 1)', excerpt: 'From Prompt to Loop, from chat box to Agent Harness, a practical note on rules, memory, and workflows before AI-driven development.', read: '13 min' },
            { title: 'Several Ways to Use Codex Tokens at Lower Cost', excerpt: 'A practical note on using Codex tokens at lower cost with Codex CLI, CPA/CLIProxyAPI, account pools, public endpoints, and troubleshooting boundaries.', read: '7 min' },
            { title: 'I Open-Sourced a Fast, Accurate Cloud Dictation App: How SpeakMore Was Built', excerpt: 'From SenseVoiceSmall and FunASR to LLM post-processing, audio pipelines, and safe auto-paste, this is how SpeakMore was built.', read: '12 min' },
            { title: 'AI Native Developer: A Hackathon Survival Paradigm', excerpt: 'Field notes from hackathons, Vibe Coding, and the shift toward AI Native Developers in the AI era.', read: '15 min' },
            { title: 'My Experience with AI Image and Video Generation', excerpt: 'AI is a tool, and what makes us human is knowing how to use it. From Sora2 to Nano Banana Pro, this is my creative journey.', read: '8 min' },
            { title: 'Vibe Coding Practical Guide', excerpt: 'Lessons from more than a year of AI coding, from design thinking to debugging tricks that reduce messy code.', read: '12 min' }
        ],
        travel: [
            { title: 'Eiheiji Temple', en: '永平寺 · 福井', desc: '2026.09.18 · Head temple of Soto Zen, said to have been visited by both Steve Jobs and Tim Cook' },
            { title: 'Okinawa Beach', en: '沖縄の海', desc: '2026.08.15 · A week-long trip to Okinawa' },
            { title: 'Yonabaru Great Tug-of-War', en: '与那原大綱曳', desc: 'A local festival carrying on over 450 years of tradition' },
            { title: 'Nara Deer', en: '奈良の鹿', desc: '2026.06.30 · A curious deer came right up close' },
            { title: 'Kasuga Taisha Lanterns', en: '春日大社の釣灯籠', desc: 'Lanterns hanging along the vermilion corridor' },
            { title: 'Tokyo Night View', en: '東京の夜景', desc: 'City lights shining at night' },
            { title: 'Tokyo Skytree', en: '東京スカイツリー', desc: 'The 634 m landmark broadcasting tower' },
            { title: 'Kaminarimon Gate', en: '雷門 · 浅草寺', desc: 'The Thunder Gate of Senso-ji' },
            { title: 'Fushimi Inari Shrine', en: '伏見稲荷大社', desc: 'The Senbon Torii: a thousand vermilion gates' },
            { title: 'Kinkaku-ji', en: '金閣寺', desc: 'The golden pavilion' },
            { title: 'Ninenzaka', en: '二年坂', desc: 'A stone-paved slope' },
            { title: 'Kyoto Tower', en: '京都タワー', desc: 'Overlooking the old capital' },
            { title: 'Osaka Castle', en: '大阪城 天守閣', desc: 'A symbol of Osaka\'s samurai history' },
            { title: 'Kuromon Market', en: '黒門市場', desc: 'Osaka\'s kitchen · fresh seafood' },
            { title: 'Nagoya Castle', en: '名古屋城', desc: 'Famous for its golden shachihoko' },
            { title: 'Nagoya Blue Hour', en: '名古屋のブルーアワー', desc: 'A magical twilight moment' },
            { title: 'Nagoya Castle Mascot', en: '名古屋城マスコット', desc: 'The adorable castle mascot' },
            { title: 'Atomic Bomb Dome', en: '原爆ドーム', desc: 'A UNESCO World Heritage Site' },
            { title: 'Itsukushima Shrine', en: '厳島神社 海中の鳥居', desc: 'The shrine standing in the sea at high tide' },
            { title: 'Yokohama Waterfront', en: '横浜港', desc: 'Bridges and waterfront of the port district' },
            { title: 'Kawasaki Nakamise-dori', en: '川崎仲見世通り', desc: 'An arcade shopping street by Kawasaki Station' },
            { title: 'Hangzhou Coffee', en: '杭州的咖啡店', desc: 'A comfortable coffee shop' },
            { title: 'Jiming Temple', en: '南京 鸡鸣寺', desc: 'An ancient Buddhist temple' },
            { title: 'First Time at Ichiran', en: '一蘭', desc: 'The famous tonkotsu ramen' },
            { title: 'Passing Mt. Fuji', en: '富士山', desc: 'Mt. Fuji outside the window' },
            { title: 'Bus Journey', en: 'バスの途中', desc: 'On the road' }
        ],
        travelCities: [
            { label: 'ALL' },
            { label: 'Tokyo' },
            { label: 'Kyoto' },
            { label: 'Osaka' },
            { label: 'Nara' },
            { label: 'Nagoya' },
            { label: 'Hiroshima' },
            { label: 'Yokohama' },
            { label: 'Kawasaki' },
            { label: 'Okinawa' },
            { label: 'Fukui' },
            { label: 'Hangzhou' },
            { label: 'Nanjing' },
            { label: 'Food' },
            { label: 'Others' }
        ],
        awards: [
            { t: 'Osaka Rokid Mini Hackathon · Runner-up' },
            { t: 'Global Hackathon · Gold Award' },
            { t: 'Nanjing University AI Hackathon Tour · Finalist' },
            { t: 'TRAE Solo Hackathon · 2nd Place' },
            { t: 'Yukesong Google GDG Track · 1st Place' },
            { t: 'Rokid AR AI Smart Glasses Competition · 3rd Place' },
            { t: 'Tencent Cloud Hackathon · Award' }
        ],
        keywords: [
            { t: 'Vibe Coding' },
            { t: 'Agentic RAG' },
            { t: 'GraphRAG' },
            { t: 'LangGraph' },
            { t: 'Coding Agent' },
            { t: 'Hackathon' },
            { t: 'Product Thinking' },
            { t: 'Nano Banana' },
            { t: 'n8n · Coze · Dify' }
        ]
        },
        ja: {
        projects: [
            { title: '大阪 Rokid ミニハッカソン', desc: '大阪で開催された Rokid ミニハッカソンで、「DoubleTraining」が同率第2位（準優勝）を獲得しました。', city: '大阪 Osaka' },
            { title: 'IVS2026 京都', desc: '京都で開催されたスタートアップカンファレンス IVS2026 に Academia 枠で参加し、WaytoAGI などのブースを回り、夜の交流会にも参加しました。', city: '京都 Kyoto' },
            { title: '南京高校ハッカソン 決勝進出', desc: '2026年 AI Hackathon Tour 南京大学站で決勝進出を果たしました。', city: '南京 Nanjing' },
            { title: '湯泉ハッカソン', desc: '南京の湯泉ハッカソンに参加し、温泉地でコードを書く独特の空気を体験しました。', city: '南京 Nanjing' },
            { title: 'グローバルハッカソン', desc: 'グローバルハッカソンで金賞を獲得し、アイデアを形にしました。', city: '上海 Shanghai' },
            { title: 'OpenClaw Feishu プラグイン - Crazy Thursday', desc: 'Crazy Thursday 向けの OpenClaw Feishu プラグインを開発し、チーム協業の効率を高めました。', city: 'オンライン Online' },
            { title: '南京 OPC ハッカソン', desc: '南京 OPC ハッカソンに参加し、AI とゲームの組み合わせを探りました。', city: '南京 Nanjing' },
            { title: 'AI動画・漫画プロジェクト', desc: 'AI生成動画と漫画を通じて、新しいデジタルストーリーテリングを試しました。', city: 'オンライン Online' },
            { title: '南京 MoFa ハッカソン', desc: '南京で開催された MoFa（Model Factory）ハッカソンに参加しました。', city: '南京 Nanjing' },
            { title: '上海クリスマスハッカソン', desc: 'クリスマステーマの上海ハッカソンに参加しました。', city: '上海 Shanghai' },
            { title: 'Volcano Engine Force カンファレンス', desc: '上海で開催された Volcano Engine Force カンファレンスに参加しました。', city: '上海 Shanghai' },
            { title: '渝客松 Google GDG トラック', desc: '渝客松ハッカソンの Google GDG トラックで 1 位を獲得しました。', city: '重慶 Chongqing' },
            { title: '無錫 Rokid AR AI コンテスト', desc: '無錫 Rokid AR AI コンテストで 3 位を獲得し、AR アプリのアイデアを発表しました。', city: '無錫 Wuxi' },
            { title: '徽客松ハッカソン', desc: '安徽のハッカソンで「随口成曲」プロジェクトを制作しました。', city: '安徽 Anhui' },
            { title: 'Alibaba 雲栖大会', desc: '杭州・雲栖小鎮で開催された Alibaba Cloud 雲栖大会に参加しました。', city: '杭州 Hangzhou' },
            { title: 'Tencent Cloud オンラインハッカソン', desc: 'ペット健康コンパニオンのミニアプリで Tencent Cloud ハッカソンの評価を獲得しました。', city: 'オンライン Online' },
            { title: 'n8n + Xiaohongshu MCP 自動投稿', desc: 'n8n ワークフローで小紅書アカウント運用を自動化しました。', city: 'オンライン Online' },
            { title: '抖音クリエイターコンテスト', desc: 'Coze ワークフローを使ったリーガルシアターアシスタントを制作しました。', city: 'オンライン Online' },
            { title: 'TRAE SOLO ハッカソン上海', desc: 'TRAE SOLO ハッカソン上海大会で 2 位を獲得しました。', city: '上海 Shanghai' },
            { title: 'Nanckathon S1', desc: '南京で開催された Nanckathon S1 ハッカソンに参加しました。', city: '南京 Nanjing' },
            { title: 'TRAE Friends 南京', desc: 'TRAE Friends 南京で技術共有を行いました。', city: '南京 Nanjing' },
            { title: 'TRAE Friends 蘇州', desc: 'TRAE Friends 蘇州で技術共有を行いました。', city: '蘇州 Suzhou' },
            { title: '2025 AdventureX', desc: '来場者として参加し、初めて近い距離でハッカソン文化を観察しました。', city: '杭州 Hangzhou' },
            { title: 'Trae Solo ハッカソン杭州', desc: '新卒として WeChat ミニアプリの経験を持って参加しました。', city: '杭州 Hangzhou' },
            { title: '2024 AdventureX', desc: '観客として初めてハッカソンを見学し、コミュニティから多くを学びました。', city: '杭州 Hangzhou' }
        ],
        projectCats: [
            { label: 'すべて ALL' },
            { label: '受賞 AWARD' },
            { label: 'ハッカソン HACKATHON' },
            { label: '交流会 MEETUP' },
            { label: 'プロジェクト PROJECT' }
        ],
        posts: [
            { title: 'Claude Opus 5.5で動画を作る：動画は生成できないが、コードで1フレームずつ描ける', excerpt: 'Claudeは拡散モデルではありませんが、コードで動画を作れます。Opus 5.5が動画を作る仕組み、1本の動画の中身、Veo・Seedance・可灵とのコスト比較をまとめました。', read: '9分' },
            { title: 'Back to Vibe Coding：AI駆動開発の前に知っておきたいこと（上）', excerpt: 'Prompt から Loop へ、チャット欄から Agent Harness へ。AI駆動開発の前に整えるべきルール、記憶、ワークフローを整理します。', read: '13分' },
            { title: 'Codex Tokenを低コストで使うためのいくつかの方法', excerpt: 'Codex CLI、CPA/CLIProxyAPI、アカウントプール、公網入口、トラブルシュートから、Codex Tokenを低コストで使うための考え方を整理します。', read: '7分' },
            { title: '高速・高精度なクラウド音声入力ソフトを開発してオープンソース化した：SpeakMore はどう作ったのか', excerpt: 'SenseVoiceSmall、FunASR、LLM 後処理、音声チェーン、自動貼り付けまで、SpeakMore の実装を整理します。', read: '12分' },
            { title: 'AI Native Developer: ハッカソン時代の開発者の生存戦略', excerpt: 'ハッカソン、Vibe Coding、AI Native Developer への変化から、AI 時代の開発者の能力境界を考えます。', read: '15分' },
            { title: 'AI画像・動画生成の体験と実践メモ', excerpt: 'AI はあくまで道具であり、人間らしさはその使い方にある。Sora2 から Nano Banana Pro までの制作体験をまとめました。', read: '8分' },
            { title: 'Vibe Coding 実践ガイド', excerpt: '1年以上の AI コーディング実践から、設計の考え方とデバッグのコツを整理し、コード品質を高める方法を紹介します。', read: '12分' }
        ],
        travel: [
            { title: '永平寺', en: 'Eiheiji Temple · Fukui', desc: '2026.09.18 · 曹洞宗の大本山。スティーブ・ジョブズやティム・クックも訪れたと言われる' },
            { title: '沖縄の海', en: 'Okinawa Beach', desc: '2026.08.15 · 1週間の沖縄旅行' },
            { title: '与那原大綱曳', en: 'Yonabaru Great Tug-of-War', desc: '450年以上の伝統を受け継ぐ地域の祭り' },
            { title: '奈良の鹿', en: 'Nara Deer', desc: '2026.06.30 · 好奇心いっぱいの鹿がすぐそばまで' },
            { title: '春日大社の釣灯籠', en: 'Kasuga Taisha Lanterns', desc: '朱塗りの回廊に吊るされた灯籠' },
            { title: '東京の夜景', en: 'Tokyo Night View', desc: '夜に輝く街の灯り' },
            { title: '東京スカイツリー', en: 'Tokyo Skytree', desc: '高さ634mのランドマーク電波塔' },
            { title: '雷門', en: 'Kaminarimon · Senso-ji', desc: '浅草寺の雷門' },
            { title: '伏見稲荷大社', en: 'Fushimi Inari Shrine', desc: '千本鳥居' },
            { title: '金閣寺', en: 'Kinkaku-ji', desc: '金色に輝く楼閣' },
            { title: '二年坂', en: 'Ninenzaka', desc: '石畳が続く坂道' },
            { title: '京都タワー', en: 'Kyoto Tower', desc: '古都を見渡す' },
            { title: '大阪城 天守閣', en: 'Osaka Castle', desc: '大阪の武士の歴史を象徴する城' },
            { title: '黒門市場', en: 'Kuromon Market', desc: '大阪の台所 · 新鮮な海鮮' },
            { title: '名古屋城', en: 'Nagoya Castle', desc: '金のしゃちほこで有名な城' },
            { title: '名古屋のブルーアワー', en: 'Nagoya Blue Hour', desc: '夕暮れ時の幻想的な瞬間' },
            { title: '名古屋城マスコット', en: 'Nagoya Castle Mascot', desc: 'かわいい城のマスコット' },
            { title: '原爆ドーム', en: 'Atomic Bomb Dome', desc: '世界遺産として残る平和の象徴' },
            { title: '厳島神社 海中の鳥居', en: 'Itsukushima Shrine', desc: '満潮時に海に浮かぶ神社' },
            { title: '横浜港', en: 'Yokohama Waterfront', desc: '港町らしい橋と水辺の景色' },
            { title: '川崎仲見世通り', en: 'Kawasaki Nakamise-dori', desc: '川崎駅のそばに続くアーケード商店街' },
            { title: '杭州のカフェ', en: 'Hangzhou Coffee', desc: '居心地のよいコーヒーショップ' },
            { title: '南京 鶏鳴寺', en: 'Jiming Temple', desc: '南京にある古い仏教寺院' },
            { title: '初めての一蘭', en: 'Ichiran Ramen', desc: '有名な豚骨ラーメン' },
            { title: '富士山のそばを通って', en: 'Mt. Fuji', desc: '車窓から見えた富士山' },
            { title: 'バスの途中', en: 'Bus Journey', desc: '移動中の景色' }
        ],
        travelCities: [
            { label: 'すべて ALL' },
            { label: '東京' },
            { label: '京都' },
            { label: '大阪' },
            { label: '奈良' },
            { label: '名古屋' },
            { label: '広島' },
            { label: '横浜' },
            { label: '川崎' },
            { label: '沖縄' },
            { label: '福井' },
            { label: '杭州' },
            { label: '南京' },
            { label: 'グルメ' },
            { label: 'その他' }
        ],
        awards: [
            { t: '大阪 Rokid ミニハッカソン 準優勝' },
            { t: 'グローバルハッカソン 金賞 · Global Hackathon Gold' },
            { t: '南京高校 AI ハッカソンツアー 決勝進出' },
            { t: 'TRAE Solo Hackathon 第2位' },
            { t: '渝客松 Google GDG トラック 第1位' },
            { t: 'Rokid AR AI スマートグラス開発コンテスト 第3位' },
            { t: 'Tencent Cloud ハッカソン 入賞' }
        ],
        keywords: [
            { t: 'Vibe Coding' },
            { t: 'Agentic RAG' },
            { t: 'GraphRAG' },
            { t: 'LangGraph' },
            { t: 'Coding Agent' },
            { t: 'ハッカソン Hackathon' },
            { t: 'プロダクト思考' },
            { t: 'Nano Banana' },
            { t: 'n8n · Coze · Dify' }
        ]
        }
    };

    // ---- 取词 ----

    function pick(entry) {
        if (!entry) return undefined;
        const value = entry[lang];
        return value === undefined || value === null ? entry.zh : value;
    }

    // t('post.kicker', { date: '2026.06.16' })：{name} 占位符按 params 替换。
    function t(key, params) {
        const value = pick(TEXT[key]);
        if (value === undefined) return key;
        return params ? value.replace(/\{(\w+)\}/g, (match, name) => (name in params ? params[name] : match)) : value;
    }

    let cache = null;
    // 把中文的 YuiClueData 按当前语言套上覆盖项，返回新对象；中文时原样返回。
    function data() {
        const base = window.YuiClueData;
        if (!base || lang === 'zh') return base;
        if (cache && cache.base === base && cache.lang === lang) return cache.value;
        const pack = DATA[lang] || {};
        const value = Object.assign({}, base);
        Object.keys(pack).forEach((key) => {
            if (!Array.isArray(base[key])) return;
            value[key] = base[key].map((item, i) => Object.assign({}, item, pack[key][i]));
        });
        cache = { base: base, lang: lang, value: value };
        return value;
    }

    // 文章的标题 / 日期 / 阅读时长 / 摘要 / 标签 / 正文：中文用 YuiArticles，其余语言套上 YuiArticlesI18n[lang]。
    // 某篇没有该语言的正文时 blocks 为 null，退回中文原文，translated 为 false，阅读器会提示一句。
    function articlePack() {
        return (window.YuiArticlesI18n && window.YuiArticlesI18n[lang]) || null;
    }

    function article(slug) {
        const base = window.YuiArticles && window.YuiArticles[slug];
        if (!base) return null;
        if (lang === 'zh') return Object.assign({}, base, { translated: true });
        const pack = articlePack();
        const own = pack && pack[slug];
        if (!own) return Object.assign({}, base, { translated: false });
        return Object.assign({}, base, own, { blocks: own.blocks || base.blocks, translated: Boolean(own.blocks) });
    }

    // ---- 把当前语言写进页面 ----

    function applyStatic() {
        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const value = pick(TEXT[el.getAttribute('data-i18n')]);
            if (value === undefined) return;
            if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
            else el.textContent = value;
        });
        document.querySelectorAll('[data-i18n-attrs]').forEach((el) => {
            el.getAttribute('data-i18n-attrs').split(';').forEach((pair) => {
                const at = pair.indexOf(':');
                if (at < 0) return;
                const value = pick(TEXT[pair.slice(at + 1).trim()]);
                if (value !== undefined) el.setAttribute(pair.slice(0, at).trim(), value);
            });
        });
        document.documentElement.lang = init.htmlLang[lang];
        document.title = t('meta.title');
        const description = document.querySelector('meta[name="description"]');
        if (description) description.setAttribute('content', t('meta.description'));
    }

    function syncSwitch() {
        document.querySelectorAll('.cw-lang-btn').forEach((button) => {
            const on = button.getAttribute('data-lang') === lang;
            button.classList.toggle('is-active', on);
            button.setAttribute('aria-pressed', String(on));
        });
    }

    function setLang(next, persist) {
        if (LANGS.indexOf(next) < 0 || next === lang) return;
        lang = next;
        if (persist) {
            try { localStorage.setItem(init.key, lang); } catch (error) { /* 隐私模式等拿不到存储时只在本次会话生效 */ }
        }
        applyStatic();
        syncSwitch();
        window.dispatchEvent(new CustomEvent('yui-clue-lang', { detail: { lang: lang } }));
    }

    document.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest('.cw-lang-btn');
        if (button) setLang(button.getAttribute('data-lang'), true);
    });

    window.YuiClueI18n = {
        LANGS: LANGS,
        get lang() { return lang; },
        t: t,
        data: data,
        article: article,
        articlePackReady: () => lang === 'zh' || Boolean(articlePack()),
        setLang: setLang,
        text: TEXT,
        packs: DATA
    };

    // 中文就是 HTML 里写的样子，不用再套一遍；其余语言在首屏显示前换好，再把 init 脚本埋的隐藏标记摘掉。
    if (lang !== 'zh') applyStatic();
    syncSwitch();
    document.documentElement.removeAttribute('data-i18n-pending');
})();
