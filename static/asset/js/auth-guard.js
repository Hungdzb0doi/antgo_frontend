/**
 * ANTGO AUTH GUARD - BẢO VỆ ĐIỀU HƯỚNG TRUY CẬP TRANG
 * Tự động kiểm tra phiên đăng nhập ngay khi tải trang trong <head>
 * Nếu chưa đăng nhập, chuyển hướng tức thì sang trang báo lỗi /interface/unauthorized
 */
(function() {
    const publicPaths = [
        '',
        '/',
        '/index',
        '/index.html',
        '/interface/landing',
        '/interface/authentication',
        '/authentication.html',
        '/interface/forgotpassword',
        '/forgot_password.html',
        '/interface/unauthorized',
        '/unauthorized.html',
        '/interface/401'
    ];

    let currentPath = window.location.pathname.toLowerCase();
    if (currentPath.length > 1 && currentPath.endsWith('/')) {
        currentPath = currentPath.slice(0, -1);
    }

    const isPublic = publicPaths.includes(currentPath);

    if (!isPublic) {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            const redirectTarget = window.location.pathname + window.location.search + window.location.hash;
            window.location.replace('/interface/unauthorized?redirect=' + encodeURIComponent(redirectTarget));
        }
    }

    // Tiện ích toàn cục để các hàm fetch API gọi khi gặp HTTP 401
    window.handleUnauthorizedRedirect = function(customRedirectUrl) {
        const returnUrl = customRedirectUrl || (window.location.pathname + window.location.search);
        localStorage.removeItem('accessToken');
        window.location.href = '/interface/unauthorized?redirect=' + encodeURIComponent(returnUrl);
    };
})();
