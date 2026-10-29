// 这篇只有中文：标题和正文不随语言切换，只有「标签」二字和复制链接的提示跟着语言走。
function renderTagLabel(lang) {
    const label = document.querySelector('#articleTags > span');
    if (label && window.YuiLang) label.textContent = window.YuiLang.getText('blog', 'tags', lang);
}

document.getElementById('shareBtn').addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname;
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
    const copiedText = lang === 'ja' ? 'リンクをコピーしました' : lang === 'en' ? 'Link copied' : '复制成功';
    const failedText = lang === 'ja' ? 'コピーに失敗しました' : lang === 'en' ? 'Copy failed' : '复制失败';
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
    renderTagLabel(event.detail.lang);
});

renderTagLabel(window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh');
