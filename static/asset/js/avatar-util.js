/**
 * AntGo Avatar Utility
 * Chuyển đổi và hiển thị chính xác toàn bộ avatar của người dùng trên toàn hệ thống.
 * Hỗ trợ Google Drive File ID, Drive URLs, external URLs, và fallback màu chuẩn AntGo (Đen - Cam).
 */
(function() {
    function extractDriveFileId(str) {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();
        if (/^[a-zA-Z0-9_-]{25,50}$/.test(str)) {
            return str;
        }
        const match = str.match(/\/d\/([a-zA-Z0-9_-]{25,50})/) || str.match(/[?&]id=([a-zA-Z0-9_-]{25,50})/);
        return match ? match[1] : null;
    }

    function escapeQuote(str) {
        if (!str) return '';
        return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    function resolveAvatarUrl(urlOrId, fallbackName) {
        const safeName = fallbackName || 'U';
        const defaultPlaceholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(safeName)}&background=18181b&color=ff6600&size=128&bold=true`;
        
        if (!urlOrId || typeof urlOrId !== 'string' || !urlOrId.trim()) {
            return defaultPlaceholder;
        }
        const trimmed = urlOrId.trim();

        const driveId = extractDriveFileId(trimmed);
        if (driveId) {
            // Stream qua backend AntGo (đã cấu hình permitAll)
            return `/api/v1/messages/media/${driveId}`;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
            return trimmed;
        }

        if (trimmed.startsWith('/')) {
            return trimmed;
        }

        // Nếu chuỗi không hợp lệ, không để trình duyệt hiểu lầm thành relative URL
        return defaultPlaceholder;
    }

    function handleAvatarError(img, fallbackName) {
        if (!img) return;
        const currentSrc = img.src || '';
        const driveId = extractDriveFileId(currentSrc);

        if (driveId && currentSrc.includes('/api/v1/messages/media/')) {
            img.src = `https://lh3.googleusercontent.com/d/${driveId}`;
            return;
        }
        if (driveId && currentSrc.includes('lh3.googleusercontent.com')) {
            img.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
            return;
        }

        img.onerror = null;
        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName || 'U')}&background=18181b&color=ff6600&size=128&bold=true`;
    }

    // Tự động đồng bộ Avatar của User hiện tại lên thanh Header (Top Navigation)
    function syncHeaderUserAvatar() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        function updateProfileNav(avatarUrl, fullName) {
            if (!avatarUrl) return;
            const profileLinks = document.querySelectorAll('.header-nav a[href*="profile"], .nav-btn[href*="profile"], a.nav-btn[href*="profile"]');
            profileLinks.forEach(link => {
                if (link.dataset.avatarUpdated) return;
                const userIcon = link.querySelector('i.ti-user');
                if (userIcon) {
                    const resolved = resolveAvatarUrl(avatarUrl, fullName);
                    const img = document.createElement('img');
                    img.className = 'nav-user-avatar';
                    img.src = resolved;
                    img.alt = fullName || 'Hồ sơ';
                    img.style.cssText = 'width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--primary-orange, #FF6600); vertical-align: middle; margin-right: 4px; display: inline-block;';
                    img.onerror = function() {
                        this.outerHTML = '<i class="ti ti-user"></i>';
                    };
                    userIcon.replaceWith(img);
                    link.dataset.avatarUpdated = 'true';
                }
            });
        }

        const cachedAvatar = localStorage.getItem('userAvatar');
        const cachedName = localStorage.getItem('userFullName');
        if (cachedAvatar) {
            updateProfileNav(cachedAvatar, cachedName);
        } else {
            // Lấy từ API profile nếu chưa lưu trong localStorage
            fetch('/api/v1/profile', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(res => res.json())
            .then(res => {
                if (res.code === 200 && res.data) {
                    const p = res.data;
                    const fullName = p.fullName || (p.firstName ? `${p.lastName || ''} ${p.firstName}`.trim() : '');
                    if (p.avatarUrl) {
                        localStorage.setItem('userAvatar', p.avatarUrl);
                    }
                    if (fullName) {
                        localStorage.setItem('userFullName', fullName);
                    }
                    updateProfileNav(p.avatarUrl, fullName);
                }
            })
            .catch(() => {});
        }
    }

    // Đưa vào window để toàn hệ thống truy cập
    window.extractDriveFileId = extractDriveFileId;
    window.escapeQuote = escapeQuote;
    window.resolveAvatarUrl = resolveAvatarUrl;
    window.handleAvatarError = handleAvatarError;
    window.syncHeaderUserAvatar = syncHeaderUserAvatar;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncHeaderUserAvatar);
    } else {
        syncHeaderUserAvatar();
    }
})();
