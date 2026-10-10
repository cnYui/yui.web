// 简历 PDF 不再是公开静态文件，必须先向 /resume/download 提交口令才能取回。
// 首页线索墙和 /resume/ 页面共用这一份逻辑：任何带 data-resume-download 的按钮都会接管。
(function () {
    'use strict';

    // 路径见 server.js 里的说明：/api/ 不会被 cloudflared 转发到本服务。
    var ENDPOINT = '/resume/download';
    var FILE_NAME = 'WU_JIANXIANG_resume.pdf';
    var PASSCODE_LENGTH = 6;
    var STYLE_ID = 'rdl-style';

    var overlay = null;
    var input = null;
    var errorBox = null;
    var submitBtn = null;
    var lastFocused = null;
    var busy = false;

    // 对话框文案按页面语言（<html lang>）取：首页线索墙由 js/clue-i18n.js 维护 lang，/resume/ 页由 js/lang.js 维护。
    // 这个脚本两个页面共用，所以词典放在这里，不依赖任何一边的词典。
    var TEXT = {
        zh: {
            stamp: '机密 · CONFIDENTIAL', title: '输入密码 · PASSCODE', hint: '下载简历 PDF 需要 {n} 位数字密码。',
            aria: '密码 PASSCODE', cancel: '取消 · CANCEL', submit: '下载 · DOWNLOAD', checking: '校验中 · CHECKING',
            needDigits: '请输入 {n} 位数字密码。', wrong: '密码不正确，请重试。', tooMany: '尝试次数过多，请稍后再试。',
            failed: '下载失败（{status}），请稍后再试。', network: '网络异常，请稍后再试。'
        },
        en: {
            stamp: 'CONFIDENTIAL', title: 'ENTER PASSCODE', hint: 'Downloading the resume PDF requires a {n}-digit passcode.',
            aria: 'Passcode', cancel: 'CANCEL', submit: 'DOWNLOAD', checking: 'CHECKING…',
            needDigits: 'Please enter the {n}-digit passcode.', wrong: 'Incorrect passcode. Please try again.', tooMany: 'Too many attempts. Please try again later.',
            failed: 'Download failed ({status}). Please try again later.', network: 'Network error. Please try again later.'
        },
        ja: {
            stamp: '機密 · CONFIDENTIAL', title: 'パスコード入力 · PASSCODE', hint: '履歴書 PDF のダウンロードには {n} 桁の数字のパスコードが必要です。',
            aria: 'パスコード', cancel: 'キャンセル · CANCEL', submit: 'ダウンロード · DOWNLOAD', checking: '確認中 · CHECKING',
            needDigits: '{n} 桁の数字のパスコードを入力してください。', wrong: 'パスコードが正しくありません。もう一度お試しください。', tooMany: '試行回数が多すぎます。しばらくしてからお試しください。',
            failed: 'ダウンロードに失敗しました（{status}）。しばらくしてからお試しください。', network: 'ネットワークエラーです。しばらくしてからお試しください。'
        }
    };

    function pageLang() {
        var lang = String(document.documentElement.lang || '').toLowerCase();
        if (lang.indexOf('ja') === 0) return 'ja';
        if (lang.indexOf('en') === 0) return 'en';
        return 'zh';
    }

    function t(key, params) {
        var value = TEXT[pageLang()][key];
        var all = { n: PASSCODE_LENGTH };
        if (params) for (var name in params) all[name] = params[name];
        return String(value).replace(/\{(\w+)\}/g, function (match, name) { return name in all ? all[name] : match; });
    }

    // 对话框只建一次，但每次打开时按当时的页面语言重写一遍文案（打开前访客可能切过语言）。
    function applyText() {
        if (!overlay) return;
        var nodes = overlay.querySelectorAll('[data-rdl]');
        for (var i = 0; i < nodes.length; i += 1) nodes[i].textContent = t(nodes[i].getAttribute('data-rdl'));
        input.setAttribute('aria-label', t('aria'));
        if (!busy) submitBtn.textContent = t('submit');
    }

    // 站点 CSP 是 style-src 'self' 'unsafe-inline'，注入 <style> 是允许的；
    // 放在脚本里而不是两份 CSS 里，首页和简历页才不会各写一套。
    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '.rdl-mask{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;',
            'background:rgba(20,14,8,.62);backdrop-filter:blur(3px);padding:20px;box-sizing:border-box}',
            '.rdl-mask[hidden]{display:none}',
            '.rdl-card{position:relative;width:100%;max-width:380px;box-sizing:border-box;background:#f5eeda;',
            'border:1px solid rgba(90,60,30,.45);box-shadow:0 18px 40px rgba(0,0,0,.45);padding:26px 24px 22px;',
            'font-family:"Special Elite","Noto Serif SC",serif;color:#2a1d12;transform:rotate(-.4deg)}',
            '.rdl-stamp{position:absolute;top:10px;right:12px;font-size:10px;letter-spacing:.2em;color:#8a2a22;',
            'border:1.5px solid #8a2a22;padding:2px 7px;transform:rotate(6deg);opacity:.75}',
            '.rdl-title{margin:0 0 6px;font-size:18px;letter-spacing:.06em;font-weight:600}',
            '.rdl-hint{margin:0 0 16px;font-size:12px;letter-spacing:.04em;color:#6a5238;line-height:1.6}',
            '.rdl-input{width:100%;box-sizing:border-box;padding:11px 12px;font:inherit;font-size:22px;',
            'letter-spacing:.42em;text-align:center;color:#2a1d12;background:#fffdf6;border:1px solid rgba(90,60,30,.5);',
            'border-radius:0;outline:none}',
            '.rdl-input:focus{border-color:#8a6a3a;box-shadow:0 0 0 2px rgba(138,106,58,.25)}',
            '.rdl-error{margin:10px 0 0;font-size:12px;letter-spacing:.04em;color:#8a2a22;line-height:1.5}',
            '.rdl-error[hidden]{display:none}',
            '.rdl-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}',
            '.rdl-btn{font:inherit;font-size:12px;letter-spacing:.14em;padding:9px 15px;border:0;cursor:pointer;',
            'background:#2a1d12;color:#f2e8d0;box-shadow:0 3px 6px rgba(0,0,0,.3)}',
            '.rdl-btn--ghost{background:transparent;color:#6a5238;border:1px solid rgba(90,60,30,.45);box-shadow:none}',
            '.rdl-btn[disabled]{opacity:.55;cursor:default}',
            '.rdl-card:lang(ja){font-family:"Special Elite","Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif CJK JP",serif}',
            '@media (prefers-reduced-motion:reduce){.rdl-card{transform:none}}'
        ].join('');
        document.head.appendChild(style);
    }

    function build() {
        ensureStyle();
        overlay = document.createElement('div');
        overlay.className = 'rdl-mask';
        overlay.hidden = true;
        overlay.innerHTML = [
            '<div class="rdl-card" role="dialog" aria-modal="true" aria-labelledby="rdlTitle">',
            '<span class="rdl-stamp" data-rdl="stamp"></span>',
            '<h2 class="rdl-title" id="rdlTitle" data-rdl="title"></h2>',
            '<p class="rdl-hint" data-rdl="hint"></p>',
            '<form class="rdl-form" novalidate>',
            '<input class="rdl-input" type="password" inputmode="numeric" autocomplete="off" ',
            'maxlength="' + PASSCODE_LENGTH + '">',
            '<p class="rdl-error" role="alert" hidden></p>',
            '<div class="rdl-actions">',
            '<button type="button" class="rdl-btn rdl-btn--ghost" data-rdl-cancel data-rdl="cancel"></button>',
            '<button type="submit" class="rdl-btn" data-rdl-submit></button>',
            '</div>',
            '</form>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        input = overlay.querySelector('.rdl-input');
        errorBox = overlay.querySelector('.rdl-error');
        submitBtn = overlay.querySelector('[data-rdl-submit]');

        overlay.querySelector('[data-rdl-cancel]').addEventListener('click', close);
        overlay.addEventListener('mousedown', function (event) {
            if (event.target === overlay) close();
        });
        overlay.querySelector('.rdl-form').addEventListener('submit', function (event) {
            event.preventDefault();
            submit();
        });
        // 只允许数字，粘贴进来的其他字符也一并过滤掉。
        input.addEventListener('input', function () {
            var digits = input.value.replace(/\D/g, '').slice(0, PASSCODE_LENGTH);
            if (digits !== input.value) input.value = digits;
            showError('');
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && overlay && !overlay.hidden) close();
        });
    }

    function showError(message) {
        if (!errorBox) return;
        errorBox.textContent = message || '';
        errorBox.hidden = !message;
    }

    function setBusy(value) {
        busy = value;
        if (submitBtn) {
            submitBtn.disabled = value;
            submitBtn.textContent = value ? t('checking') : t('submit');
        }
        if (input) input.disabled = value;
    }

    function open() {
        if (!overlay) build();
        lastFocused = document.activeElement;
        overlay.hidden = false;
        input.value = '';
        showError('');
        setBusy(false);
        applyText();
        input.focus();
    }

    function close() {
        if (!overlay || busy) return;
        overlay.hidden = true;
        showError('');
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function saveBlob(blob) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = FILE_NAME;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // 立刻 revoke 在部分浏览器会打断下载，留一点时间。
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function submit() {
        if (busy) return;
        var password = (input.value || '').trim();
        if (password.length !== PASSCODE_LENGTH) {
            showError(t('needDigits'));
            input.focus();
            return;
        }

        setBusy(true);
        fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        }).then(function (response) {
            if (response.ok) {
                return response.blob().then(function (blob) {
                    saveBlob(blob);
                    setBusy(false);
                    close();
                });
            }
            if (response.status === 401) {
                setBusy(false);
                showError(t('wrong'));
                input.value = '';
                input.focus();
                return null;
            }
            if (response.status === 429) {
                setBusy(false);
                showError(t('tooMany'));
                return null;
            }
            setBusy(false);
            showError(t('failed', { status: response.status }));
            return null;
        }).catch(function () {
            setBusy(false);
            showError(t('network'));
        });
    }

    function bind() {
        var buttons = document.querySelectorAll('[data-resume-download]');
        for (var i = 0; i < buttons.length; i += 1) {
            buttons[i].addEventListener('click', function (event) {
                event.preventDefault();
                open();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
