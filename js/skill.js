// 给 AI 读的悠一：取 /SKILL.md 渲染成文档。
// 站点 CSP 只允许同源脚本，原来从 jsDelivr 引的 marked 会被拦，所以这里自带一个只认
// SKILL.md 用到的写法的小渲染器：标题、段落、无序 / 有序列表、引用、代码块、行内代码、粗体、链接。
// 手机号不上页面：渲染时去掉含手机号的行（/SKILL.md 原文不受影响）。
(function () {
    'use strict';

    var statusEl = document.getElementById('skillStatus');
    var contentEl = document.getElementById('skillContent');
    var copyBtn = document.getElementById('skillCopy');
    var source = '';

    var TEXT = {
        error: { zh: '读取 /SKILL.md 失败：', ja: '/SKILL.md を読み込めませんでした：', en: 'Could not load /SKILL.md: ' },
        copied: { zh: '已复制', ja: 'コピーしました', en: 'Copied' },
        copyFailed: { zh: '复制失败', ja: 'コピーできませんでした', en: 'Copy failed' }
    };

    function lang() {
        return window.YuiSite ? window.YuiSite.getLang() : 'zh';
    }

    function escapeHtml(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function inline(text) {
        var codes = [];
        var html = escapeHtml(text).replace(/`([^`]+)`/g, function (match, code) {
            codes.push(code);
            return '\u0000' + (codes.length - 1) + '\u0000';
        });
        html = html
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
        return html.replace(/\u0000(\d+)\u0000/g, function (match, i) {
            return '<code>' + codes[Number(i)] + '</code>';
        });
    }

    function render(markdown) {
        var lines = markdown.replace(/^---[\s\S]*?---\s*/, '').split(/\r?\n/)
            .filter(function (line) { return !/1[3-9]\d{9}/.test(line); });
        var out = [];
        var paragraph = [];
        var listTag = null;
        var inCode = false;
        var code = [];

        function flushParagraph() {
            if (paragraph.length) out.push('<p>' + inline(paragraph.join(' ')) + '</p>');
            paragraph = [];
        }
        function closeList() {
            if (listTag) out.push('</' + listTag + '>');
            listTag = null;
        }

        lines.forEach(function (line) {
            if (/^```/.test(line)) {
                if (inCode) {
                    out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
                    code = [];
                    inCode = false;
                } else {
                    flushParagraph();
                    closeList();
                    inCode = true;
                }
                return;
            }
            if (inCode) { code.push(line); return; }

            var heading = line.match(/^(#{1,4})\s+(.*)$/);
            var bullet = line.match(/^\s*[-*]\s+(.*)$/);
            var numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
            var quote = line.match(/^>\s?(.*)$/);

            if (heading) {
                flushParagraph();
                closeList();
                var level = heading[1].length;
                out.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>');
            } else if (bullet || numbered) {
                flushParagraph();
                var tag = bullet ? 'ul' : 'ol';
                if (listTag !== tag) { closeList(); out.push('<' + tag + '>'); listTag = tag; }
                out.push('<li>' + inline((bullet || numbered)[1]) + '</li>');
            } else if (quote) {
                flushParagraph();
                closeList();
                out.push('<blockquote><p>' + inline(quote[1]) + '</p></blockquote>');
            } else if (!line.trim()) {
                flushParagraph();
                closeList();
            } else {
                closeList();
                paragraph.push(line.trim());
            }
        });
        flushParagraph();
        closeList();
        if (inCode) out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
        return out.join('\n');
    }

    function toast(message) {
        var node = document.createElement('div');
        node.className = 'toast';
        node.setAttribute('role', 'status');
        node.textContent = message;
        document.body.appendChild(node);
        requestAnimationFrame(function () { node.classList.add('is-visible'); });
        setTimeout(function () {
            node.classList.remove('is-visible');
            setTimeout(function () { node.remove(); }, 300);
        }, 2000);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', function () {
            if (!source || !navigator.clipboard) { toast(TEXT.copyFailed[lang()]); return; }
            navigator.clipboard.writeText(source)
                .then(function () { toast(TEXT.copied[lang()]); })
                .catch(function () { toast(TEXT.copyFailed[lang()]); });
        });
    }

    fetch('/SKILL.md', { cache: 'no-store' })
        .then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.text();
        })
        .then(function (markdown) {
            source = markdown;
            if (statusEl) statusEl.remove();
            contentEl.innerHTML = render(markdown);
        })
        .catch(function (error) {
            if (!statusEl) return;
            statusEl.textContent = TEXT.error[lang()] + error.message;
        });

    window.YuiSkill = { render: render };
})();
