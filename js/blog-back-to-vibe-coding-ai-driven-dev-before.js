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
