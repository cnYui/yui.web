// 行旅（侘寂版）：一图一行，按旅程先后排，最新在前。
// 每张照片写好中 / 日 / 英三种标题和一句说明；有日期的单独写在 date（ISO），按语言排版：
// 中文、日文用汉字数字（二〇二六年九月十八日），英文用 Sep 18, 2026。切换语言时整列重排。
// w / h 是图片的实际像素，给 <img> 占位，避免懒加载时页面跳动；新增照片要一起写上。
const travelData = [
    // Fukui
    { image: '/images/optimized/travel/eiheiji-gate-2026.webp', w: 563, h: 1000, city: 'Fukui', date: '2026-09-18', zh: ['永平寺', '曹洞宗大本山，据说乔布斯与库克都曾造访'], ja: ['永平寺', '曹洞宗の大本山。スティーブ・ジョブズやティム・クックも訪れたと言われる'], en: ['Eiheiji Temple', 'Head temple of Soto Zen, said to have been visited by both Steve Jobs and Tim Cook'] },
    { image: '/images/optimized/travel/eiheiji-bridge-2026.webp', w: 1000, h: 563, city: 'Fukui', zh: ['永平寺境内', '木桥与安静的殿堂'], ja: ['永平寺の境内', '木の橋と静かな堂宇が並ぶ境内'], en: ['Eiheiji Grounds', 'A wooden bridge and quiet halls in the temple precinct'] },
    { image: '/images/optimized/travel/eiheiji-approach-2026.webp', w: 563, h: 1000, city: 'Fukui', zh: ['永平寺参道', '通往永平寺的门前町'], ja: ['永平寺への参道', '永平寺へ続く門前町の通り'], en: ['Road to Eiheiji', 'The temple town along the approach to Eiheiji'] },
    // Okinawa
    { image: '/images/optimized/travel/okinawa-beach-2026.webp', w: 1000, h: 750, city: 'Okinawa', date: '2026-08-15', zh: ['冲绳的海', '为期一周的冲绳之旅'], ja: ['沖縄の海', '2026年8月15日から1週間の沖縄旅行'], en: ['Okinawa Beach', 'A week-long trip to Okinawa'] },
    { image: '/images/optimized/travel/okinawa-night-2026.webp', w: 1000, h: 750, city: 'Okinawa', zh: ['冲绳的夜', '椰子树与节日灯饰'], ja: ['沖縄の夜', 'ヤシの木とイルミネーションが彩る夜の街'], en: ['Okinawa Night Lights', 'Palm trees and festive lights at night'] },
    { image: '/images/optimized/travel/okinawa-yonabaru-tsunahiki-2026.webp', w: 750, h: 1000, city: 'Okinawa', zh: ['与那原大绳曳', '延续四百五十余年的地方祭典'], ja: ['与那原大綱曳', '450年以上の伝統を受け継ぐ地域の祭り'], en: ['Yonabaru Great Tug-of-War', 'A local festival carrying on over 450 years of tradition'] },
    // Nara
    { image: '/images/optimized/travel/nara-deer-2026.webp', w: 1000, h: 800, city: 'Nara', date: '2026-06-30', zh: ['奈良的鹿', '一只好奇的鹿凑到眼前'], ja: ['奈良の鹿', 'すぐ近くまで来てくれた鹿'], en: ['Nara Deer', 'A curious deer up close'] },
    { image: '/images/optimized/travel/nara-kasuga-lanterns-2026.webp', w: 1000, h: 800, city: 'Nara', zh: ['春日大社吊灯笼', '朱红回廊下悬挂的灯笼'], ja: ['春日大社の釣灯籠', '朱塗りの回廊に並ぶ釣灯籠'], en: ['Kasuga Taisha Lanterns', 'Hanging lanterns along the vermilion corridors'] },
    { image: '/images/optimized/travel/nara-park-2026.webp', w: 1000, h: 800, city: 'Nara', zh: ['奈良公园', '大树下吃草的鹿'], ja: ['奈良公園', '大きな木の下で草を食む鹿たち'], en: ['Nara Park', 'Deer grazing beneath a giant tree'] },
    // Tokyo
    { image: '/images/optimized/travel/晴空塔.webp', w: 750, h: 1000, city: 'Tokyo', zh: ['晴空塔', '六百三十四米的电波塔'], ja: ['東京スカイツリー', '高さ634mの東京を象徴する電波塔'], en: ['Tokyo Skytree', 'The iconic 634m broadcasting tower'] },
    { image: '/images/optimized/travel/晴空塔底.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['晴空塔脚下', '从塔底往上看'], ja: ['スカイツリーの足元', 'スカイツリーの真下から見上げた景色'], en: ['Skytree Base', 'View from the base of Skytree'] },
    { image: '/images/optimized/travel/雷门.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['雷门', '浅草寺的雷门'], ja: ['雷門', '浅草寺の有名な雷門'], en: ['Kaminarimon Gate', 'Thunder Gate at Senso-ji Temple'] },
    { image: '/images/optimized/travel/进入雷门后.webp', w: 750, h: 1000, city: 'Tokyo', zh: ['浅草寺参道', '仲见世商店街'], ja: ['浅草寺の参道', '仲見世通りを歩いた記録'], en: ['Inside Senso-ji', 'Nakamise shopping street'] },
    { image: '/images/optimized/travel/东京夜景.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['东京夜景', '夜里的城市灯光'], ja: ['東京の夜景', '夜に輝く東京の街並み'], en: ['Tokyo Night View', 'Stunning city lights at night'] },
    { image: '/images/optimized/travel/东京阳关水族馆.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['阳光水族馆', '池袋的楼顶水族馆'], ja: ['サンシャイン水族館', '池袋の屋上水族館'], en: ['Sunshine Aquarium', 'Rooftop aquarium in Ikebukuro'] },
    { image: '/images/optimized/travel/涩谷Dify大会.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['涩谷', '东京年轻人文化的中心'], ja: ['渋谷エリア', '東京の若者文化が集まる場所'], en: ['Shibuya District', 'Heart of Tokyo youth culture'] },
    { image: '/images/optimized/travel/水族馆.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['水族馆', '海洋生物展'], ja: ['水族館', '海の生き物を眺める時間'], en: ['Aquarium', 'Marine life exhibition'] },
    { image: '/images/optimized/travel/楼顶的企鹅.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['楼顶的企鹅', '阳光水族馆的企鹅'], ja: ['屋上のペンギン', 'サンシャイン水族館のペンギンたち'], en: ['Rooftop Penguins', 'Penguins at Sunshine Aquarium'] },
    { image: '/images/optimized/travel/绿色的鱼.webp', w: 1000, h: 563, city: 'Tokyo', zh: ['绿色的鱼', '色彩斑斓的海洋生物'], ja: ['緑色の魚', '水槽で見つけた鮮やかな魚'], en: ['Green Fish', 'Colorful marine life'] },
    { image: '/images/optimized/travel/大🐟.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['大鱼', '水族馆里的大鱼'], ja: ['大きな魚', '水族館で見た迫力のある魚'], en: ['Big Fish', 'Giant fish at aquarium'] },
    { image: '/images/optimized/travel/小🐟.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['小鱼', '可爱的小鱼'], ja: ['小さな魚', 'かわいい小魚たち'], en: ['Small Fish', 'Cute little fish'] },
    { image: '/images/optimized/travel/二次元楼.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['二次元大楼', '宅文化地标'], ja: ['アニメビル', 'オタク文化を感じるランドマーク'], en: ['Anime Building', 'Otaku culture landmark'] },
    { image: '/images/optimized/travel/二次元圣地.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['二次元圣地', '秋叶原'], ja: ['二次元の聖地', '秋葉原らしい風景'], en: ['Anime Paradise', 'Akihabara district'] },
    { image: '/images/optimized/travel/宝可梦墙.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['宝可梦墙', '宝可梦中心的装饰'], ja: ['ポケモンウォール', 'ポケモンセンターの装飾'], en: ['Pokemon Wall', 'Pokemon Center decoration'] },
    { image: '/images/optimized/travel/宝可梦专卖.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['宝可梦专卖店', '宝可梦官方周边'], ja: ['ポケモンストア', '公式グッズが並ぶショップ'], en: ['Pokemon Store', 'Official Pokemon merchandise'] },
    { image: '/images/optimized/travel/假面骑士专卖.webp', w: 750, h: 1000, city: 'Tokyo', zh: ['假面骑士专卖店', '特摄周边'], ja: ['仮面ライダーストア', '特撮グッズの専門店'], en: ['Kamen Rider Store', 'Tokusatsu merchandise'] },
    { image: '/images/optimized/travel/怪猎专卖.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['怪物猎人专卖店', '游戏周边'], ja: ['モンハンストア', 'ゲームグッズのショップ'], en: ['Monster Hunter Store', 'Gaming merchandise'] },
    { image: '/images/optimized/travel/某商场的高达专卖.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['高达专卖店', '高达周边'], ja: ['ガンダムストア', 'ガンダムグッズの専門店'], en: ['Gundam Store', 'Gundam merchandise shop'] },
    { image: '/images/optimized/travel/皇城地铁站天花板.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['皇居附近的车站', '好看的车站天花板'], ja: ['皇居近くの駅天井', '美しい駅構内の天井'], en: ['Imperial Palace Station', 'Beautiful station ceiling'] },
    { image: '/images/optimized/travel/皇城外地铁站.webp', w: 1000, h: 750, city: 'Tokyo', zh: ['皇居附近', '地铁站外观'], ja: ['皇居付近', '皇居周辺の地下鉄駅外観'], en: ['Near Imperial Palace', 'Metro station exterior'] },
    // Kyoto
    { image: '/images/optimized/travel/金阁寺.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['金阁寺', '金色的楼阁'], ja: ['金閣寺', '美しく輝く金色の楼閣'], en: ['Kinkaku-ji Temple', 'The stunning Golden Pavilion'] },
    { image: '/images/optimized/travel/金阁寺喝茶.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['金阁寺的茶', '传统的茶体验'], ja: ['金閣寺でのお茶', '伝統的なお茶の体験'], en: ['Tea at Kinkaku-ji', 'Traditional tea experience'] },
    { image: '/images/optimized/travel/二年阪.webp', w: 750, h: 1000, city: 'Kyoto', zh: ['二年坂', '石板铺就的坡道'], ja: ['二年坂', '石畳が続く趣のある坂道'], en: ['Ninenzaka Street', 'Charming stone-paved slope'] },
    { image: '/images/optimized/travel/伏见稻田大社.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['伏见稻荷大社', '千本鸟居'], ja: ['伏見稲荷大社', '朱色の鳥居が連なる神社'], en: ['Fushimi Inari Shrine', 'Thousands of vermillion torii gates'] },
    { image: '/images/optimized/travel/京都塔联动京吹.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['京都塔', '俯瞰古都'], ja: ['京都タワー', '古都を見渡す展望スポット'], en: ['Kyoto Tower', 'Panoramic views of the ancient capital'] },
    { image: '/images/optimized/travel/京都大学.webp', w: 750, h: 1000, city: 'Kyoto', zh: ['京都大学', '好看的校园'], ja: ['京都大学', '落ち着いた美しいキャンパス'], en: ['Kyoto University', 'Beautiful campus and academic excellence'] },
    { image: '/images/optimized/travel/京都百鬼夜行.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['百鬼夜行', '百鬼夜行的游行'], ja: ['百鬼夜行', '京都らしい妖怪行列の雰囲気'], en: ['Hyakki Yagyo Festival', 'Night Parade of One Hundred Demons'] },
    { image: '/images/optimized/travel/某家抹茶牛奶.webp', w: 1000, h: 750, city: 'Kyoto', zh: ['抹茶牛奶', '好喝的抹茶饮品'], ja: ['抹茶ミルク', '京都で飲んだ抹茶ドリンク'], en: ['Matcha Milk', 'Delicious matcha drink'] },
    // Osaka
    { image: '/images/optimized/travel/通天阁.webp', w: 1000, h: 750, city: 'Osaka', zh: ['通天阁', '大阪的复古地标塔'], ja: ['通天閣', '大阪を象徴するレトロな塔'], en: ['Tsutenkaku Tower', 'Osaka iconic retro tower'] },
    { image: '/images/optimized/travel/天守阁.webp', w: 750, h: 1000, city: 'Osaka', zh: ['大阪城', '大阪武士历史的象征'], ja: ['大阪城', '大阪の歴史を感じる城'], en: ['Osaka Castle', 'Symbol of Osaka samurai history'] },
    { image: '/images/optimized/travel/大阪日本桥.webp', w: 1000, h: 750, city: 'Osaka', zh: ['日本桥', '大阪的宅文化街区'], ja: ['日本橋', '大阪のオタク文化エリア'], en: ['Nipponbashi', 'Osaka otaku paradise'] },
    { image: '/images/optimized/travel/黑门市场.webp', w: 1000, h: 750, city: 'Osaka', zh: ['黑门市场', '大阪的厨房，新鲜海产'], ja: ['黒門市場', '新鮮な海鮮が集まる大阪の台所'], en: ['Kuromon Market', 'Osaka Kitchen - fresh seafood'] },
    { image: '/images/optimized/travel/大阪LV帆船大楼.webp', w: 1000, h: 750, city: 'Osaka', zh: ['LV 帆船大楼', '水边的建筑'], ja: ['LV帆船ビル', '水辺に立つ印象的な建築'], en: ['LV Sail Building', 'Architectural marvel on the waterfront'] },
    { image: '/images/optimized/travel/俯瞰大阪.webp', w: 1000, h: 750, city: 'Osaka', zh: ['俯瞰大阪', '从高处看城市'], ja: ['大阪の俯瞰', '上から眺めた大阪の街'], en: ['Osaka Skyline', 'City view from above'] },
    { image: '/images/optimized/travel/俯瞰大版.webp', w: 1000, h: 750, city: 'Osaka', zh: ['大阪全景', '城市全景'], ja: ['大阪パノラマ', '広がる大阪の街並み'], en: ['Osaka Panorama', 'Panoramic city view'] },
    { image: '/images/optimized/travel/大阪大学吉祥物.webp', w: 1000, h: 750, city: 'Osaka', zh: ['大阪大学吉祥物', '可爱的大学吉祥物'], ja: ['大阪大学マスコット', 'かわいい大学マスコット'], en: ['Osaka University Mascot', 'Cute university mascot'] },
    { image: '/images/optimized/travel/大版警察府.webp', w: 750, h: 1000, city: 'Osaka', zh: ['大阪府警本部', '有历史的警察建筑'], ja: ['大阪府警本部', '歴史を感じる警察庁舎'], en: ['Osaka Police HQ', 'Historic police building'] },
    { image: '/images/optimized/travel/LoveLIve！.webp', w: 1000, h: 750, city: 'Osaka', zh: ['Love Live!', '动画联动活动'], ja: ['Love Live!', 'アニメコラボイベントの記録'], en: ['Love Live!', 'Anime collaboration event'] },
    { image: '/images/optimized/travel/mygo！！！！！.webp', w: 750, h: 1000, city: 'Osaka', zh: ['MyGO!!!!!', 'BanG Dream 联动'], ja: ['MyGO!!!!!', 'BanG Dream! コラボの記録'], en: ['MyGO!!!!!', 'BanG Dream collaboration'] },
    { image: '/images/optimized/travel/Parco魂系游戏联名店.webp', w: 750, h: 1000, city: 'Osaka', zh: ['魂系游戏专卖店', 'FromSoftware 联动店'], ja: ['ソウル系ゲームショップ', 'FromSoftware コラボショップ'], en: ['Souls Game Store', 'FromSoftware collaboration shop'] },
    // Nagoya
    { image: '/images/optimized/travel/名古屋城.webp', w: 750, h: 1000, city: 'Nagoya', zh: ['名古屋城', '以金鯱闻名'], ja: ['名古屋城', '金のしゃちほこで有名な城'], en: ['Nagoya Castle', 'Famous golden shachihoko ornaments'] },
    { image: '/images/optimized/travel/名古屋城内部.webp', w: 750, h: 1000, city: 'Nagoya', zh: ['名古屋城内部', '城内展览'], ja: ['名古屋城内部', '城内展示を見学した記録'], en: ['Inside Nagoya Castle', 'Castle interior exhibition'] },
    { image: '/images/optimized/travel/名古屋城吉伊.webp', w: 750, h: 1000, city: 'Nagoya', zh: ['名古屋城吉祥物', '可爱的城堡吉祥物'], ja: ['名古屋城マスコット', 'かわいい城のマスコット'], en: ['Nagoya Castle Mascot', 'Cute castle mascot'] },
    { image: '/images/optimized/travel/名古屋蓝调时刻.webp', w: 1000, h: 750, city: 'Nagoya', zh: ['名古屋蓝调时刻', '魔幻的暮色时刻'], ja: ['名古屋のブルーアワー', '夕暮れ時の幻想的な瞬間'], en: ['Nagoya Blue Hour', 'Magical twilight moment'] },
    // Hiroshima
    { image: '/images/optimized/travel/原子弹爆照遗址.webp', w: 1000, h: 750, city: 'Hiroshima', zh: ['原爆圆顶', '世界文化遗产'], ja: ['原爆ドーム', '世界遺産として残る平和の象徴'], en: ['Atomic Bomb Dome', 'UNESCO World Heritage Site'] },
    { image: '/images/optimized/travel/广岛西小岛上.webp', w: 750, h: 1000, city: 'Hiroshima', zh: ['严岛', '著名的海上鸟居'], ja: ['厳島', '海に浮かぶ鳥居で有名な島'], en: ['Itsukushima Island', 'Famous floating torii gate'] },
    { image: '/images/optimized/travel/水中神社.webp', w: 750, h: 1000, city: 'Hiroshima', zh: ['海上神社', '涨潮时的严岛神社'], ja: ['水上の神社', '満潮時の厳島神社'], en: ['Floating Shrine', 'Itsukushima Shrine at high tide'] },
    { image: '/images/optimized/travel/山顶.webp', w: 1000, h: 750, city: 'Hiroshima', zh: ['山顶', '从宫岛的山上眺望'], ja: ['山頂', '宮島の山から見た景色'], en: ['Mountain Top', 'View from Miyajima mountain'] },
    // Yokohama
    { image: '/images/optimized/travel/横国.webp', w: 750, h: 1000, city: 'Yokohama', zh: ['横滨国立大学', '国立大学的校园'], ja: ['横浜国立大学', '落ち着いた国立大学のキャンパス'], en: ['Yokohama National University', 'Prestigious national university'] },
    { image: '/images/optimized/travel/横滨某座桥.webp', w: 1000, h: 750, city: 'Yokohama', zh: ['横滨港', '港区的水岸'], ja: ['横浜ウォーターフロント', '港町らしい橋と水辺の景色'], en: ['Yokohama Waterfront', 'Scenic harbor area'] },
    // Kawasaki
    { image: '/images/optimized/travel/竖起小指吧.webp', w: 1000, h: 750, city: 'Kawasaki', zh: ['川崎仲见世通', '川崎站旁的拱廊商店街'], ja: ['川崎仲見世通り', '川崎駅のそばに続くアーケード商店街'], en: ['Kawasaki Nakamise-dori', 'Covered arcade street beside Kawasaki Station'] },
    // Hangzhou
    { image: '/images/optimized/travel/杭师大食堂.webp', w: 800, h: 600, city: 'Hangzhou', zh: ['杭州师范大学', '有历史的校园'], ja: ['杭州師範大学', '歴史ある大学キャンパス'], en: ['Hangzhou Normal University', 'Historic university campus'] },
    { image: '/images/optimized/travel/杭师大旁酒店.webp', w: 1000, h: 750, city: 'Hangzhou', zh: ['杭师大附近的酒店', '学校附近的住处'], ja: ['杭師大近くのホテル', 'キャンパス近くの宿泊先'], en: ['Hotel near HZNU', 'Accommodation near campus'] },
    { image: '/images/optimized/travel/杭州某家咖啡店.webp', w: 1000, h: 750, city: 'Hangzhou', zh: ['杭州的咖啡店', '舒服的咖啡馆'], ja: ['杭州のカフェ文化', '居心地のよいコーヒーショップ'], en: ['Hangzhou Coffee Culture', 'Cozy coffee shops'] },
    { image: '/images/optimized/travel/杭州半路.webp', w: 750, h: 1000, city: 'Hangzhou', zh: ['杭州街头', '城市风景'], ja: ['杭州の街角', '街を歩きながら見つけた風景'], en: ['Hangzhou Streets', 'City scenery'] },
    // Nanjing
    { image: '/images/optimized/travel/南京玄武鸡鸣寺.webp', w: 750, h: 1000, city: 'Nanjing', zh: ['鸡鸣寺', '古老的佛教寺院'], ja: ['鶏鳴寺', '南京にある古い仏教寺院'], en: ['Jiming Temple', 'Ancient Buddhist temple'] },
    // Beijing
    { image: '/images/optimized/travel/AdventureX24.webp', w: 1000, h: 750, city: 'Beijing', zh: ['AdventureX 活动', '黑客松的回忆'], ja: ['AdventureX イベント', 'ハッカソンの思い出'], en: ['AdventureX Event', 'Hackathon memories'] },
    { image: '/images/optimized/travel/adventure25.webp', w: 1000, h: 750, city: 'Beijing', zh: ['AdventureX 2025', '最近的一场黑客松'], ja: ['AdventureX 2025', '最新のハッカソン記録'], en: ['AdventureX 2025', 'Latest hackathon'] },
    { image: '/images/optimized/travel/云栖大会的whats up.webp', w: 750, h: 1000, city: 'Beijing', zh: ['云栖大会', '阿里云的大会'], ja: ['雲栖大会', 'Alibaba Cloud カンファレンス'], en: ['Yunqi Conference', 'Alibaba Cloud conference'] },
    // Food
    { image: '/images/optimized/travel/第一次吃一兰.webp', w: 1000, h: 750, city: 'Food', zh: ['一兰拉面', '著名的豚骨拉面'], ja: ['一蘭ラーメン', '有名な豚骨ラーメン'], en: ['Ichiran Ramen', 'Famous tonkotsu ramen'] },
    { image: '/images/optimized/travel/拉面店.webp', w: 750, h: 1000, city: 'Food', zh: ['拉面店', '当地的拉面馆'], ja: ['ラーメン店', '地元で見つけたラーメン屋'], en: ['Ramen Shop', 'Local ramen restaurant'] },
    { image: '/images/optimized/travel/唐扬鸡块（.webp', w: 1000, h: 750, city: 'Food', zh: ['唐扬炸鸡', '日式炸鸡块'], ja: ['唐揚げ', '日本のフライドチキン'], en: ['Karaage', 'Japanese fried chicken'] },
    { image: '/images/optimized/travel/必胜客..webp', w: 1000, h: 750, city: 'Food', zh: ['日本的必胜客', '日式披萨'], ja: ['日本のピザハット', '日本風アレンジのピザ'], en: ['Pizza Hut Japan', 'Japanese style pizza'] },
    // Others
    { image: '/images/optimized/travel/猪咪.webp', w: 1000, h: 750, city: 'Others', zh: ['可爱的猫', '街头偶遇的猫'], ja: ['かわいい猫', '街角で出会った猫'], en: ['Cute Cat', 'Street cat encounter'] },
    { image: '/images/optimized/travel/菲尼克斯.webp', w: 750, h: 1000, city: 'Others', zh: ['凤凰', '有趣的发现'], ja: ['フェニックス', '旅先で見つけた面白いもの'], en: ['Phoenix', 'Interesting discovery'] },
    { image: '/images/optimized/travel/异常便宜的吉伊.webp', w: 750, h: 1000, city: 'Others', zh: ['便宜的吉祥物', '捡到的便宜'], ja: ['安すぎるマスコット', '思わず目に留まった掘り出し物'], en: ['Cheap Mascot', 'Bargain find'] },
    { image: '/images/optimized/travel/有趣的项目.webp', w: 750, h: 1000, city: 'Others', zh: ['有趣的项目', '有创意的发现'], ja: ['面白いプロジェクト', 'クリエイティブな発見'], en: ['Interesting Project', 'Creative discovery'] },
    { image: '/images/optimized/travel/看不懂.webp', w: 1000, h: 750, city: 'Others', zh: ['看不懂的招牌', '不知道写的什么'], ja: ['読めない看板', '意味が気になった看板'], en: ['Mysterious Sign', 'Lost in translation'] },
    { image: '/images/optimized/travel/装修美.webp', w: 1000, h: 750, city: 'Others', zh: ['好看的内饰', '不错的室内设计'], ja: ['美しい内装', '雰囲気のよいインテリア'], en: ['Beautiful Decor', 'Nice interior design'] },
    { image: '/images/optimized/travel/雨后的学校.webp', w: 750, h: 1000, city: 'Others', zh: ['雨后的学校', '安静的校园'], ja: ['雨上がりの学校', '静かなキャンパスの風景'], en: ['School After Rain', 'Peaceful campus scene'] },
    { image: '/images/optimized/travel/大巴途中.webp', w: 1000, h: 750, city: 'Others', zh: ['大巴途中', '在路上'], ja: ['バスの途中', '移動中に見た景色'], en: ['Bus Journey', 'On the road'] },
    { image: '/images/optimized/travel/路过富士山.webp', w: 1000, h: 750, city: 'Others', zh: ['路过富士山', '车窗外的富士山'], ja: ['富士山', '車窓から見えた象徴的な山'], en: ['Mt. Fuji', 'Passing by the iconic mountain'] },
    { image: '/images/optimized/travel/第一次见伯青哥.webp', w: 1000, h: 750, city: 'Others', zh: ['第一次见到柏青哥', '第一次看到柏青哥店'], ja: ['初めて見たパチンコ', 'パチンコ店を初めて見た記録'], en: ['Pachinko', 'First time seeing pachinko'] },
    { image: '/images/optimized/travel/地震没水了。.webp', w: 1000, h: 750, city: 'Others', zh: ['地震后的停水', '地震后停了水'], ja: ['地震後の断水', '地震後に水が止まった時の記録'], en: ['Earthquake Aftermath', 'No water after earthquake'] },
    { image: '/images/optimized/travel/all things are connected.webp', w: 1000, h: 750, city: 'Others', zh: ['万物相连', '忽然有点哲学的时刻'], ja: ['すべてはつながっている', 'ふと哲学的になった瞬間'], en: ['All Connected', 'Philosophical moment'] },
];

// 同名图片重新压缩后要改这里，Cloudflare 按完整 URL 缓存图片 7 天。
const travelImageVersion = '20260921-1';

const travelPlaceLabels = {
    zh: { Tokyo: '东京', Kyoto: '京都', Osaka: '大阪', Nagoya: '名古屋', Hiroshima: '广岛', Yokohama: '横滨', Kawasaki: '川崎', Nara: '奈良', Okinawa: '冲绳', Fukui: '福井', Hangzhou: '杭州', Nanjing: '南京', Beijing: '北京', Food: '吃的', Others: '路上' },
    ja: { Tokyo: '東京', Kyoto: '京都', Osaka: '大阪', Nagoya: '名古屋', Hiroshima: '広島', Yokohama: '横浜', Kawasaki: '川崎', Nara: '奈良', Okinawa: '沖縄', Fukui: '福井', Hangzhou: '杭州', Nanjing: '南京', Beijing: '北京', Food: '食べもの', Others: '道すがら' },
    en: { Tokyo: 'Tokyo', Kyoto: 'Kyoto', Osaka: 'Osaka', Nagoya: 'Nagoya', Hiroshima: 'Hiroshima', Yokohama: 'Yokohama', Kawasaki: 'Kawasaki', Nara: 'Nara', Okinawa: 'Okinawa', Fukui: 'Fukui', Hangzhou: 'Hangzhou', Nanjing: 'Nanjing', Beijing: 'Beijing', Food: 'Food', Others: 'On the way' }
};

(function () {
    'use strict';

    const list = document.getElementById('photoList');
    if (!list) return;

    const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DIGITS = '〇一二三四五六七八九';

    function hanziCount(n) {
        if (n < 10) return DIGITS[n];
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return (tens > 1 ? DIGITS[tens] : '') + '十' + (ones ? DIGITS[ones] : '');
    }

    function dateLabel(iso, lang) {
        const [y, m, d] = iso.split('-').map(Number);
        if (lang === 'en') return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
        const year = String(y).split('').map((digit) => DIGITS[digit]).join('');
        return `${year}年${hanziCount(m)}月${hanziCount(d)}日`;
    }

    function currentLang() {
        return window.YuiSite ? window.YuiSite.getLang() : 'zh';
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function render() {
        const lang = currentLang();
        const gap = lang === 'en' ? ' · ' : '　';
        const fragment = document.createDocumentFragment();
        travelData.forEach((item) => {
            const [title, desc] = item[lang] || item.zh;
            const li = el('li', 'photo');
            const figure = el('figure');
            figure.style.margin = '0';
            const img = el('img');
            img.src = `${item.image}?v=${travelImageVersion}`;
            img.width = item.w;
            img.height = item.h;
            img.alt = title;
            img.loading = 'lazy';
            img.decoding = 'async';
            figure.appendChild(img);

            const caption = el('figcaption');
            const head = el('span', 'photo-head');
            head.appendChild(el('span', 'photo-title', title));
            const place = (travelPlaceLabels[lang] || travelPlaceLabels.zh)[item.city] || item.city;
            head.appendChild(el('span', 'photo-place', item.date ? place + gap + dateLabel(item.date, lang) : place));
            caption.appendChild(head);
            if (desc) caption.appendChild(el('span', 'photo-desc', desc));
            figure.appendChild(caption);
            li.appendChild(figure);
            fragment.appendChild(li);
        });
        list.textContent = '';
        list.appendChild(fragment);
    }

    render();
    window.addEventListener('languageChanged', render);
})();
