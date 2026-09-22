const travelData = [
    // Fukui · Eiheiji (Sep 18, 2026)
    { image: '/images/optimized/travel/eiheiji-gate-2026.webp', title: 'Eiheiji Temple', city: 'Fukui', desc: 'Sep 18, 2026 · Head temple of Soto Zen, said to have been visited by both Steve Jobs and Tim Cook' },
    { image: '/images/optimized/travel/eiheiji-bridge-2026.webp', title: 'Eiheiji Grounds', city: 'Fukui', desc: 'A wooden bridge and quiet halls in the temple precinct' },
    { image: '/images/optimized/travel/eiheiji-approach-2026.webp', title: 'Road to Eiheiji', city: 'Fukui', desc: 'The temple town along the approach to Eiheiji' },
    // Okinawa (Aug 15, 2026 · one week)
    { image: '/images/optimized/travel/okinawa-beach-2026.webp', title: 'Okinawa Beach', city: 'Okinawa', desc: 'Aug 15, 2026 · A week-long trip to Okinawa' },
    { image: '/images/optimized/travel/okinawa-night-2026.webp', title: 'Okinawa Night Lights', city: 'Okinawa', desc: 'Palm trees and festive lights at night' },
    { image: '/images/optimized/travel/okinawa-yonabaru-tsunahiki-2026.webp', title: 'Yonabaru Great Tug-of-War', city: 'Okinawa', desc: 'A local festival carrying on over 450 years of tradition' },
    // Nara (Jun 30, 2026)
    { image: '/images/optimized/travel/nara-deer-2026.webp', title: 'Nara Deer', city: 'Nara', desc: 'Jun 30, 2026 · A curious deer up close' },
    { image: '/images/optimized/travel/nara-kasuga-lanterns-2026.webp', title: 'Kasuga Taisha Lanterns', city: 'Nara', desc: 'Hanging lanterns along the vermilion corridors' },
    { image: '/images/optimized/travel/nara-park-2026.webp', title: 'Nara Park', city: 'Nara', desc: 'Deer grazing beneath a giant tree' },
    // Tokyo
    { image: '/images/optimized/travel/晴空塔.webp', title: 'Tokyo Skytree', city: 'Tokyo', desc: 'The iconic 634m broadcasting tower' },
    { image: '/images/optimized/travel/晴空塔底.webp', title: 'Skytree Base', city: 'Tokyo', desc: 'View from the base of Skytree' },
    { image: '/images/optimized/travel/雷门.webp', title: 'Kaminarimon Gate', city: 'Tokyo', desc: 'Thunder Gate at Senso-ji Temple' },
    { image: '/images/optimized/travel/进入雷门后.webp', title: 'Inside Senso-ji', city: 'Tokyo', desc: 'Nakamise shopping street' },
    { image: '/images/optimized/travel/东京夜景.webp', title: 'Tokyo Night View', city: 'Tokyo', desc: 'Stunning city lights at night' },
    { image: '/images/optimized/travel/东京阳关水族馆.webp', title: 'Sunshine Aquarium', city: 'Tokyo', desc: 'Rooftop aquarium in Ikebukuro' },
    { image: '/images/optimized/travel/涩谷Dify大会.webp', title: 'Shibuya District', city: 'Tokyo', desc: 'Heart of Tokyo youth culture' },
    { image: '/images/optimized/travel/水族馆.webp', title: 'Aquarium', city: 'Tokyo', desc: 'Marine life exhibition' },
    { image: '/images/optimized/travel/楼顶的企鹅.webp', title: 'Rooftop Penguins', city: 'Tokyo', desc: 'Penguins at Sunshine Aquarium' },
    { image: '/images/optimized/travel/绿色的鱼.webp', title: 'Green Fish', city: 'Tokyo', desc: 'Colorful marine life' },
    { image: '/images/optimized/travel/大🐟.webp', title: 'Big Fish', city: 'Tokyo', desc: 'Giant fish at aquarium' },
    { image: '/images/optimized/travel/小🐟.webp', title: 'Small Fish', city: 'Tokyo', desc: 'Cute little fish' },
    { image: '/images/optimized/travel/二次元楼.webp', title: 'Anime Building', city: 'Tokyo', desc: 'Otaku culture landmark' },
    { image: '/images/optimized/travel/二次元圣地.webp', title: 'Anime Paradise', city: 'Tokyo', desc: 'Akihabara district' },
    { image: '/images/optimized/travel/宝可梦墙.webp', title: 'Pokemon Wall', city: 'Tokyo', desc: 'Pokemon Center decoration' },
    { image: '/images/optimized/travel/宝可梦专卖.webp', title: 'Pokemon Store', city: 'Tokyo', desc: 'Official Pokemon merchandise' },
    { image: '/images/optimized/travel/假面骑士专卖.webp', title: 'Kamen Rider Store', city: 'Tokyo', desc: 'Tokusatsu merchandise' },
    { image: '/images/optimized/travel/怪猎专卖.webp', title: 'Monster Hunter Store', city: 'Tokyo', desc: 'Gaming merchandise' },
    { image: '/images/optimized/travel/某商场的高达专卖.webp', title: 'Gundam Store', city: 'Tokyo', desc: 'Gundam merchandise shop' },
    { image: '/images/optimized/travel/皇城地铁站天花板.webp', title: 'Imperial Palace Station', city: 'Tokyo', desc: 'Beautiful station ceiling' },
    { image: '/images/optimized/travel/皇城外地铁站.webp', title: 'Near Imperial Palace', city: 'Tokyo', desc: 'Metro station exterior' },

    // Kyoto
    { image: '/images/optimized/travel/金阁寺.webp', title: 'Kinkaku-ji Temple', city: 'Kyoto', desc: 'The stunning Golden Pavilion' },
    { image: '/images/optimized/travel/金阁寺喝茶.webp', title: 'Tea at Kinkaku-ji', city: 'Kyoto', desc: 'Traditional tea experience' },
    { image: '/images/optimized/travel/二年阪.webp', title: 'Ninenzaka Street', city: 'Kyoto', desc: 'Charming stone-paved slope' },
    { image: '/images/optimized/travel/伏见稻田大社.webp', title: 'Fushimi Inari Shrine', city: 'Kyoto', desc: 'Thousands of vermillion torii gates' },
    { image: '/images/optimized/travel/京都塔联动京吹.webp', title: 'Kyoto Tower', city: 'Kyoto', desc: 'Panoramic views of the ancient capital' },
    { image: '/images/optimized/travel/京都大学.webp', title: 'Kyoto University', city: 'Kyoto', desc: 'Beautiful campus and academic excellence' },
    { image: '/images/optimized/travel/京都百鬼夜行.webp', title: 'Hyakki Yagyo Festival', city: 'Kyoto', desc: 'Night Parade of One Hundred Demons' },
    { image: '/images/optimized/travel/某家抹茶牛奶.webp', title: 'Matcha Milk', city: 'Kyoto', desc: 'Delicious matcha drink' },

    // Osaka
    { image: '/images/optimized/travel/通天阁.webp', title: 'Tsutenkaku Tower', city: 'Osaka', desc: 'Osaka iconic retro tower' },
    { image: '/images/optimized/travel/天守阁.webp', title: 'Osaka Castle', city: 'Osaka', desc: 'Symbol of Osaka samurai history' },
    { image: '/images/optimized/travel/大阪日本桥.webp', title: 'Nipponbashi', city: 'Osaka', desc: 'Osaka otaku paradise' },
    { image: '/images/optimized/travel/黑门市场.webp', title: 'Kuromon Market', city: 'Osaka', desc: 'Osaka Kitchen - fresh seafood' },
    { image: '/images/optimized/travel/大阪LV帆船大楼.webp', title: 'LV Sail Building', city: 'Osaka', desc: 'Architectural marvel on the waterfront' },
    { image: '/images/optimized/travel/俯瞰大阪.webp', title: 'Osaka Skyline', city: 'Osaka', desc: 'City view from above' },
    { image: '/images/optimized/travel/俯瞰大版.webp', title: 'Osaka Panorama', city: 'Osaka', desc: 'Panoramic city view' },
    { image: '/images/optimized/travel/大阪大学吉祥物.webp', title: 'Osaka University Mascot', city: 'Osaka', desc: 'Cute university mascot' },
    { image: '/images/optimized/travel/大版警察府.webp', title: 'Osaka Police HQ', city: 'Osaka', desc: 'Historic police building' },
    { image: '/images/optimized/travel/LoveLIve！.webp', title: 'Love Live!', city: 'Osaka', desc: 'Anime collaboration event' },
    { image: '/images/optimized/travel/mygo！！！！！.webp', title: 'MyGO!!!!!', city: 'Osaka', desc: 'BanG Dream collaboration' },
    { image: '/images/optimized/travel/Parco魂系游戏联名店.webp', title: 'Souls Game Store', city: 'Osaka', desc: 'FromSoftware collaboration shop' },

    // Nagoya
    { image: '/images/optimized/travel/名古屋城.webp', title: 'Nagoya Castle', city: 'Nagoya', desc: 'Famous golden shachihoko ornaments' },
    { image: '/images/optimized/travel/名古屋城内部.webp', title: 'Inside Nagoya Castle', city: 'Nagoya', desc: 'Castle interior exhibition' },
    { image: '/images/optimized/travel/名古屋城吉伊.webp', title: 'Nagoya Castle Mascot', city: 'Nagoya', desc: 'Cute castle mascot' },
    { image: '/images/optimized/travel/名古屋蓝调时刻.webp', title: 'Nagoya Blue Hour', city: 'Nagoya', desc: 'Magical twilight moment' },

    // Hiroshima
    { image: '/images/optimized/travel/原子弹爆照遗址.webp', title: 'Atomic Bomb Dome', city: 'Hiroshima', desc: 'UNESCO World Heritage Site' },
    { image: '/images/optimized/travel/广岛西小岛上.webp', title: 'Itsukushima Island', city: 'Hiroshima', desc: 'Famous floating torii gate' },
    { image: '/images/optimized/travel/水中神社.webp', title: 'Floating Shrine', city: 'Hiroshima', desc: 'Itsukushima Shrine at high tide' },
    { image: '/images/optimized/travel/山顶.webp', title: 'Mountain Top', city: 'Hiroshima', desc: 'View from Miyajima mountain' },

    // Yokohama
    { image: '/images/optimized/travel/横国.webp', title: 'Yokohama National University', city: 'Yokohama', desc: 'Prestigious national university' },
    { image: '/images/optimized/travel/横滨某座桥.webp', title: 'Yokohama Waterfront', city: 'Yokohama', desc: 'Scenic harbor area' },

    // Kawasaki
    { image: '/images/optimized/travel/竖起小指吧.webp', title: 'Kawasaki Nakamise-dori', city: 'Kawasaki', desc: 'Covered arcade street beside Kawasaki Station' },

    // Hangzhou
    { image: '/images/optimized/travel/杭师大食堂.webp', title: 'Hangzhou Normal University', city: 'Hangzhou', desc: 'Historic university campus' },
    { image: '/images/optimized/travel/杭师大旁酒店.webp', title: 'Hotel near HZNU', city: 'Hangzhou', desc: 'Accommodation near campus' },
    { image: '/images/optimized/travel/杭州某家咖啡店.webp', title: 'Hangzhou Coffee Culture', city: 'Hangzhou', desc: 'Cozy coffee shops' },
    { image: '/images/optimized/travel/杭州半路.webp', title: 'Hangzhou Streets', city: 'Hangzhou', desc: 'City scenery' },

    // Nanjing
    { image: '/images/optimized/travel/南京玄武鸡鸣寺.webp', title: 'Jiming Temple', city: 'Nanjing', desc: 'Ancient Buddhist temple' },

    // Beijing
    { image: '/images/optimized/travel/AdventureX24.webp', title: 'AdventureX Event', city: 'Beijing', desc: 'Hackathon memories' },
    { image: '/images/optimized/travel/adventure25.webp', title: 'AdventureX 2025', city: 'Beijing', desc: 'Latest hackathon' },
    { image: '/images/optimized/travel/云栖大会的whats up.webp', title: 'Yunqi Conference', city: 'Beijing', desc: 'Alibaba Cloud conference' },

    // Food & Others
    { image: '/images/optimized/travel/第一次吃一兰.webp', title: 'Ichiran Ramen', city: 'Food', desc: 'Famous tonkotsu ramen' },
    { image: '/images/optimized/travel/拉面店.webp', title: 'Ramen Shop', city: 'Food', desc: 'Local ramen restaurant' },
    { image: '/images/optimized/travel/唐扬鸡块（.webp', title: 'Karaage', city: 'Food', desc: 'Japanese fried chicken' },
    { image: '/images/optimized/travel/必胜客..webp', title: 'Pizza Hut Japan', city: 'Food', desc: 'Japanese style pizza' },
    { image: '/images/optimized/travel/猪咪.webp', title: 'Cute Cat', city: 'Others', desc: 'Street cat encounter' },
    { image: '/images/optimized/travel/菲尼克斯.webp', title: 'Phoenix', city: 'Others', desc: 'Interesting discovery' },
    { image: '/images/optimized/travel/异常便宜的吉伊.webp', title: 'Cheap Mascot', city: 'Others', desc: 'Bargain find' },
    { image: '/images/optimized/travel/有趣的项目.webp', title: 'Interesting Project', city: 'Others', desc: 'Creative discovery' },
    { image: '/images/optimized/travel/看不懂.webp', title: 'Mysterious Sign', city: 'Others', desc: 'Lost in translation' },
    { image: '/images/optimized/travel/装修美.webp', title: 'Beautiful Decor', city: 'Others', desc: 'Nice interior design' },
    { image: '/images/optimized/travel/雨后的学校.webp', title: 'School After Rain', city: 'Others', desc: 'Peaceful campus scene' },
    { image: '/images/optimized/travel/大巴途中.webp', title: 'Bus Journey', city: 'Others', desc: 'On the road' },
    { image: '/images/optimized/travel/路过富士山.webp', title: 'Mt. Fuji', city: 'Others', desc: 'Passing by the iconic mountain' },
    { image: '/images/optimized/travel/第一次见伯青哥.webp', title: 'Pachinko', city: 'Others', desc: 'First time seeing pachinko' },
    { image: '/images/optimized/travel/地震没水了。.webp', title: 'Earthquake Aftermath', city: 'Others', desc: 'No water after earthquake' },
    { image: '/images/optimized/travel/all things are connected.webp', title: 'All Connected', city: 'Others', desc: 'Philosophical moment' },
];

// 照片重新压缩或转正方向后更新版本号，避开浏览器与 Cloudflare 对同名旧图的 7 天缓存。
const travelImageVersion = '20260921-1';

// Randomize aspect ratios for masonry effect
const aspectRatios = ['aspect-[3/4]', 'aspect-[4/5]', 'aspect-square', 'aspect-[4/3]'];

let currentIndex = 0;
let currentFilter = 'All';
let filteredData = [...travelData];
const itemsPerPage = 9;
const gallery = document.getElementById('gallery');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const filterButtons = document.querySelectorAll('.filter-btn');
const cityLabels = {
    zh: { Tokyo: '东京', Kyoto: '京都', Osaka: '大阪', Nagoya: '名古屋', Hiroshima: '广岛', Yokohama: '横滨', Kawasaki: '川崎', Nara: '奈良', Okinawa: '冲绳', Fukui: '福井', Hangzhou: '杭州', Nanjing: '南京', Beijing: '北京', Food: '美食', Others: '其他' },
    en: { Tokyo: 'Tokyo', Kyoto: 'Kyoto', Osaka: 'Osaka', Nagoya: 'Nagoya', Hiroshima: 'Hiroshima', Yokohama: 'Yokohama', Kawasaki: 'Kawasaki', Nara: 'Nara', Okinawa: 'Okinawa', Fukui: 'Fukui', Hangzhou: 'Hangzhou', Nanjing: 'Nanjing', Beijing: 'Beijing', Food: 'Food', Others: 'Others' },
    ja: { Tokyo: '東京', Kyoto: '京都', Osaka: '大阪', Nagoya: '名古屋', Hiroshima: '広島', Yokohama: '横浜', Kawasaki: '川崎', Nara: '奈良', Okinawa: '沖縄', Fukui: '福井', Hangzhou: '杭州', Nanjing: '南京', Beijing: '北京', Food: 'グルメ', Others: 'その他' }
};
const travelJaContent = {
    'Eiheiji Temple': ['永平寺', '2026年9月18日・曹洞宗の大本山。スティーブ・ジョブズやティム・クックも訪れたと言われる'],
    'Eiheiji Grounds': ['永平寺の境内', '木の橋と静かな堂宇が並ぶ境内'],
    'Road to Eiheiji': ['永平寺への参道', '永平寺へ続く門前町の通り'],
    'Okinawa Beach': ['沖縄の海', '2026年8月15日から1週間の沖縄旅行'],
    'Okinawa Night Lights': ['沖縄の夜', 'ヤシの木とイルミネーションが彩る夜の街'],
    'Yonabaru Great Tug-of-War': ['与那原大綱曳', '450年以上の伝統を受け継ぐ地域の祭り'],
    'Nara Deer': ['奈良の鹿', '2026年6月30日・すぐ近くまで来てくれた鹿'],
    'Kasuga Taisha Lanterns': ['春日大社の釣灯籠', '朱塗りの回廊に並ぶ釣灯籠'],
    'Nara Park': ['奈良公園', '大きな木の下で草を食む鹿たち'],
    'Tokyo Skytree': ['東京スカイツリー', '高さ634mの東京を象徴する電波塔'],
    'Skytree Base': ['スカイツリーの足元', 'スカイツリーの真下から見上げた景色'],
    'Kaminarimon Gate': ['雷門', '浅草寺の有名な雷門'],
    'Inside Senso-ji': ['浅草寺の参道', '仲見世通りを歩いた記録'],
    'Tokyo Night View': ['東京の夜景', '夜に輝く東京の街並み'],
    'Sunshine Aquarium': ['サンシャイン水族館', '池袋の屋上水族館'],
    'Shibuya District': ['渋谷エリア', '東京の若者文化が集まる場所'],
    'Aquarium': ['水族館', '海の生き物を眺める時間'],
    'Rooftop Penguins': ['屋上のペンギン', 'サンシャイン水族館のペンギンたち'],
    'Green Fish': ['緑色の魚', '水槽で見つけた鮮やかな魚'],
    'Big Fish': ['大きな魚', '水族館で見た迫力のある魚'],
    'Small Fish': ['小さな魚', 'かわいい小魚たち'],
    'Anime Building': ['アニメビル', 'オタク文化を感じるランドマーク'],
    'Anime Paradise': ['二次元の聖地', '秋葉原らしい風景'],
    'Pokemon Wall': ['ポケモンウォール', 'ポケモンセンターの装飾'],
    'Pokemon Store': ['ポケモンストア', '公式グッズが並ぶショップ'],
    'Kamen Rider Store': ['仮面ライダーストア', '特撮グッズの専門店'],
    'Monster Hunter Store': ['モンハンストア', 'ゲームグッズのショップ'],
    'Gundam Store': ['ガンダムストア', 'ガンダムグッズの専門店'],
    'Imperial Palace Station': ['皇居近くの駅天井', '美しい駅構内の天井'],
    'Near Imperial Palace': ['皇居付近', '皇居周辺の地下鉄駅外観'],
    'Kinkaku-ji Temple': ['金閣寺', '美しく輝く金色の楼閣'],
    'Tea at Kinkaku-ji': ['金閣寺でのお茶', '伝統的なお茶の体験'],
    'Ninenzaka Street': ['二年坂', '石畳が続く趣のある坂道'],
    'Fushimi Inari Shrine': ['伏見稲荷大社', '朱色の鳥居が連なる神社'],
    'Kyoto Tower': ['京都タワー', '古都を見渡す展望スポット'],
    'Kyoto University': ['京都大学', '落ち着いた美しいキャンパス'],
    'Hyakki Yagyo Festival': ['百鬼夜行', '京都らしい妖怪行列の雰囲気'],
    'Matcha Milk': ['抹茶ミルク', '京都で飲んだ抹茶ドリンク'],
    'Tsutenkaku Tower': ['通天閣', '大阪を象徴するレトロな塔'],
    'Osaka Castle': ['大阪城', '大阪の歴史を感じる城'],
    'Nipponbashi': ['日本橋', '大阪のオタク文化エリア'],
    'Kuromon Market': ['黒門市場', '新鮮な海鮮が集まる大阪の台所'],
    'LV Sail Building': ['LV帆船ビル', '水辺に立つ印象的な建築'],
    'Osaka Skyline': ['大阪の俯瞰', '上から眺めた大阪の街'],
    'Osaka Panorama': ['大阪パノラマ', '広がる大阪の街並み'],
    'Osaka University Mascot': ['大阪大学マスコット', 'かわいい大学マスコット'],
    'Osaka Police HQ': ['大阪府警本部', '歴史を感じる警察庁舎'],
    'Love Live!': ['Love Live!', 'アニメコラボイベントの記録'],
    'MyGO!!!!!': ['MyGO!!!!!', 'BanG Dream! コラボの記録'],
    'Souls Game Store': ['ソウル系ゲームショップ', 'FromSoftware コラボショップ'],
    'Nagoya Castle': ['名古屋城', '金のしゃちほこで有名な城'],
    'Inside Nagoya Castle': ['名古屋城内部', '城内展示を見学した記録'],
    'Nagoya Castle Mascot': ['名古屋城マスコット', 'かわいい城のマスコット'],
    'Nagoya Blue Hour': ['名古屋のブルーアワー', '夕暮れ時の幻想的な瞬間'],
    'Atomic Bomb Dome': ['原爆ドーム', '世界遺産として残る平和の象徴'],
    'Itsukushima Island': ['厳島', '海に浮かぶ鳥居で有名な島'],
    'Floating Shrine': ['水上の神社', '満潮時の厳島神社'],
    'Mountain Top': ['山頂', '宮島の山から見た景色'],
    'Yokohama National University': ['横浜国立大学', '落ち着いた国立大学のキャンパス'],
    'Yokohama Waterfront': ['横浜ウォーターフロント', '港町らしい橋と水辺の景色'],
    'Kawasaki Nakamise-dori': ['川崎仲見世通り', '川崎駅のそばに続くアーケード商店街'],
    'Hangzhou Normal University': ['杭州師範大学', '歴史ある大学キャンパス'],
    'Hotel near HZNU': ['杭師大近くのホテル', 'キャンパス近くの宿泊先'],
    'Hangzhou Coffee Culture': ['杭州のカフェ文化', '居心地のよいコーヒーショップ'],
    'Hangzhou Streets': ['杭州の街角', '街を歩きながら見つけた風景'],
    'Jiming Temple': ['鶏鳴寺', '南京にある古い仏教寺院'],
    'AdventureX 2026': ['AdventureX 2026', 'テック系ハッカソンイベント'],
    'AdventureX Event': ['AdventureX イベント', 'ハッカソンの思い出'],
    'AdventureX 2025': ['AdventureX 2025', '最新のハッカソン記録'],
    'Yunqi Conference': ['雲栖大会', 'Alibaba Cloud カンファレンス'],
    'Ichiran Ramen': ['一蘭ラーメン', '有名な豚骨ラーメン'],
    'Ramen Shop': ['ラーメン店', '地元で見つけたラーメン屋'],
    'Karaage': ['唐揚げ', '日本のフライドチキン'],
    'Pizza Hut Japan': ['日本のピザハット', '日本風アレンジのピザ'],
    'Cute Cat': ['かわいい猫', '街角で出会った猫'],
    'Phoenix': ['フェニックス', '旅先で見つけた面白いもの'],
    'Cheap Mascot': ['安すぎるマスコット', '思わず目に留まった掘り出し物'],
    'Interesting Project': ['面白いプロジェクト', 'クリエイティブな発見'],
    'Mysterious Sign': ['読めない看板', '意味が気になった看板'],
    'Beautiful Decor': ['美しい内装', '雰囲気のよいインテリア'],
    'School After Rain': ['雨上がりの学校', '静かなキャンパスの風景'],
    'Bus Journey': ['バスの途中', '移動中に見た景色'],
    'Mt. Fuji': ['富士山', '車窓から見えた象徴的な山'],
    'Pachinko': ['初めて見たパチンコ', 'パチンコ店を初めて見た記録'],
    'Earthquake Aftermath': ['地震後の断水', '地震後に水が止まった時の記録'],
    'All Connected': ['すべてはつながっている', 'ふと哲学的になった瞬間']
};

function currentLang() {
    return window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
}

function getRandomAspect(index) {
    return aspectRatios[index % aspectRatios.length];
}

function createCard(item, index) {
    const aspect = getRandomAspect(index);
    const jaContent = currentLang() === 'ja' ? travelJaContent[item.title] : null;
    const title = jaContent ? jaContent[0] : item.title;
    const desc = jaContent ? jaContent[1] : item.desc;
    return `
                <div class="masonry-item gallery-item">
                    <div class="group relative ${aspect} overflow-hidden rounded-lg cursor-pointer bg-gray-100 dark:bg-dark-card">
                        <img class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="${item.image}?v=${travelImageVersion}" alt="${title}" loading="lazy" decoding="async"/>
                        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div class="absolute bottom-0 left-0 right-0 p-5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                            <p class="text-white/60 text-xs uppercase tracking-widest mb-1">${(cityLabels[currentLang()] && cityLabels[currentLang()][item.city]) || item.city}</p>
                            <h3 class="text-white text-lg font-display font-medium">${title}</h3>
                            <p class="text-white/70 text-sm mt-1">${desc}</p>
                        </div>
                    </div>
                </div>
            `;
}

function updateFilterButtons(activeFilter) {
    filterButtons.forEach(btn => {
        const btnFilter = btn.dataset.filter;
        if (btnFilter === activeFilter) {
            btn.classList.remove('bg-white', 'dark:bg-dark-card', 'border', 'border-border-subtle', 'dark:border-dark-border', 'text-text-main', 'dark:text-dark-text');
            btn.classList.add('bg-primary', 'dark:bg-dark-text', 'text-white', 'dark:text-dark-bg');
        } else {
            btn.classList.remove('bg-primary', 'dark:bg-dark-text', 'text-white', 'dark:text-dark-bg');
            btn.classList.add('bg-white', 'dark:bg-dark-card', 'border', 'border-border-subtle', 'dark:border-dark-border', 'text-text-main', 'dark:text-dark-text');
        }
    });
}

function filterGallery(filter) {
    currentFilter = filter;
    currentIndex = 0;

    if (filter === 'All') {
        filteredData = [...travelData];
    } else {
        filteredData = travelData.filter(item => item.city === filter);
    }

    gallery.innerHTML = '';

    const loadMoreText = getPageText('loadMore', 'Load More Photos');
    loadMoreContainer.innerHTML = `
                <button id="loadMoreBtn" class="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full hover:bg-primary/90 transition-all hover:scale-105">
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
        const cardHtml = createCard(filteredData[i], i);
        gallery.insertAdjacentHTML('beforeend', cardHtml);
    }

    setTimeout(() => {
        const items = gallery.querySelectorAll('.gallery-item:not(.visible)');
        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('visible');
            }, index * 80);
        });
    }, 50);

    currentIndex = endIndex;

    if (currentIndex >= filteredData.length) {
        const whereNext = getPageText('whereNext', 'Where to next?');
        const planning = getPageText('planning', 'Planning the next adventure...');
        loadMoreContainer.innerHTML = `
                    <div class="text-center py-12">
                        <span class="material-symbols-outlined text-4xl text-text-light mb-4 block">flight_takeoff</span>
                        <p class="text-text-muted font-display text-xl italic">${whereNext}</p>
                        <p class="text-text-light text-sm mt-2">${planning}</p>
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
    if (event.detail.page === 'travel') {
        filterGallery(currentFilter);
    }
});
