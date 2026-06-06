// Theme Toggle Script
(function() {
    const THEME_KEY = 'yui-portfolio-theme';
    
    // Get saved theme or detect system preference
    function getPreferredTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
        return 'light';
    }
    
    // Apply theme to document
    function applyTheme(theme) {
        const html = document.documentElement;
        if (theme === 'dark') {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        html.style.colorScheme = theme;
    }
    
    // Update toggle button icon
    function updateToggleIcon(theme) {
        const toggleBtn = document.getElementById('themeToggle');
        if (!toggleBtn) return;
        const icon = toggleBtn.querySelector('.material-symbols-outlined');
        if (icon) {
            icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
        }
    }
    
    // Toggle theme
    function toggleTheme() {
        const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
        updateToggleIcon(next);
    }
    
    function bindThemeToggle() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
            updateToggleIcon(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        }
    }

    // Initialize on page load
    function init() {
        bindThemeToggle();

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? 'dark' : 'light');
                updateToggleIcon(e.matches ? 'dark' : 'light');
            }
        });
    }

    // Apply the theme before the DOM finishes loading to avoid a light flash.
    applyTheme(getPreferredTheme());
    
    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
