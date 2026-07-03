const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');

const expectedAnimeTitles = [
    '进击的巨人',
    '来自深渊',
    'Sonny Boy',
    '光が死んだ夏',
    'CITY',
    '葬送的芙莉莲',
    '日常',
    '摇曳露营',
    'GIRLS BAND CRY',
    '不吉波普不笑',
    '攻壳机动队',
    'JOJO 的奇妙冒险',
    '摇滚乃淑女的爱好',
    '孤独摇滚！',
    '银魂',
    '幸运星',
    'Serial Experiments Lain',
    'GIRLS BAND CRY',
    '跃动青春',
    'DARKER THAN BLACK -黑之契约者-',
    '青春猪头少年系列',
    '凉宫春日的忧郁',
    '悠哉日常大王',
    '齐木楠雄的灾难',
    '86 -不存在的战区-',
    '某科学的超电磁炮',
    '刀剑神域',
    '烙印战士',
    'Lycoris Recoil',
    '胆大党',
    '轻音少女'
];

test('Anime 页面使用真实动漫名称替代占位标题', () => {
    const html = fs.readFileSync(path.join(rootDir, 'anime/index.html'), 'utf8');

    for (const title of expectedAnimeTitles) {
        assert.match(html, new RegExp(escapeRegExp(`title: '${title}'`)));
    }

    assert.doesNotMatch(html, /title: 'Anime Collection \d+'/);
    assert.doesNotMatch(html, /番剧收藏 \$\{index\}/);
    assert.doesNotMatch(html, /アニメコレクション \$\{index\}/);
});

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
