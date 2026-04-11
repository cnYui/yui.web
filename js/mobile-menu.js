// Mobile navigation menu shared by static pages.
(function() {
    function initMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const menu = document.getElementById('mobileMenu');
        if (!toggle || !menu) return;

        const icon = toggle.querySelector('.material-symbols-outlined');

        function setMenuOpen(isOpen) {
            menu.classList.toggle('hidden', !isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
            toggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
            if (icon) icon.textContent = isOpen ? 'close' : 'menu';
        }

        toggle.addEventListener('click', () => {
            setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
        });

        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => setMenuOpen(false));
        });

        window.addEventListener('resize', () => {
            if (window.matchMedia('(min-width: 768px)').matches) {
                setMenuOpen(false);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileMenu);
    } else {
        initMobileMenu();
    }
})();
