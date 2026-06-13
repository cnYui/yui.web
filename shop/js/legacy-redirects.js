// Shop 旧购买和支付页面统一跳转到账户页。
(function() {
    function redirectToAccount() {
        window.location.replace('/shop/account/');
    }

    window.YuiShopLegacyRedirects = {
        initOrderPage: redirectToAccount,
        initPayPage: redirectToAccount,
        initResultPage: redirectToAccount,
        initContentPage: redirectToAccount
    };
})();
