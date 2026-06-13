// Shop 登录、注册和密码重置页面逻辑。
(function() {
    const {
        bindPhoneInput,
        isPhone,
        isStrongPassword,
        requestJson
    } = window.YuiShopCore;

function normalizeResetCodeInput(input) {
    if (!input) return;
    input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
    });
}

function initResetPasswordPage() {
    const resetForm = document.getElementById('passwordResetForm');
    const phoneInput = document.getElementById('resetPhone');
    const codeInput = document.getElementById('resetPasswordCode');
    const passwordInput = document.getElementById('resetNewPassword');
    const confirmInput = document.getElementById('resetConfirmPassword');
    const message = document.getElementById('passwordResetMessage');
    if (!resetForm || !phoneInput || !codeInput || !passwordInput || !confirmInput || !message) return;

    bindPhoneInput(phoneInput);
    normalizeResetCodeInput(codeInput);

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        const code = codeInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        if (!code) {
            message.textContent = '请输入重置码。';
            codeInput.focus();
            return;
        }
        if (!isStrongPassword(password)) {
            message.textContent = '密码至少 8 位，并包含英文大写字母、小写字母和数字。';
            passwordInput.focus();
            return;
        }
        if (password !== confirmPassword) {
            message.textContent = '两次输入的密码不一致。';
            confirmInput.focus();
            return;
        }

        message.textContent = '正在重置密码...';
        try {
            const data = await requestJson('/api/auth/password-reset', {
                method: 'POST',
                body: JSON.stringify({ phone, code, password, confirmPassword })
            });
            window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function initLoginPage() {
    const form = document.getElementById('loginForm');
    const phoneInput = document.getElementById('loginPhone');
    const passwordInput = document.getElementById('loginPassword');
    const message = document.getElementById('loginMessage');
    if (!form || !phoneInput || !passwordInput || !message) return;

    bindPhoneInput(phoneInput);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value;
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        if (!password) {
            message.textContent = '请输入密码。';
            passwordInput.focus();
            return;
        }

        message.textContent = '正在登录...';
        try {
            const data = await requestJson('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ phone, password })
            });
            window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function initRegisterPage() {
    const form = document.getElementById('registerForm');
    const phoneInput = document.getElementById('registerPhone');
    const passwordInput = document.getElementById('registerPassword');
    const confirmInput = document.getElementById('registerConfirmPassword');
    const message = document.getElementById('registerMessage');
    if (!form || !phoneInput || !passwordInput || !confirmInput || !message) return;

    bindPhoneInput(phoneInput);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        if (!isStrongPassword(password)) {
            message.textContent = '密码至少 8 位，并包含英文大写字母、小写字母和数字。';
            passwordInput.focus();
            return;
        }
        if (password !== confirmPassword) {
            message.textContent = '两次输入的密码不一致。';
            confirmInput.focus();
            return;
        }

        message.textContent = '正在注册...';
        try {
            const data = await requestJson('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ phone, password, confirmPassword })
            });
            window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

    window.YuiShopAuth = {
        normalizeResetCodeInput,
        initResetPasswordPage,
        initLoginPage,
        initRegisterPage
    };
})();
