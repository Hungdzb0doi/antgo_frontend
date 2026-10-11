/**
 * AntGo - Firebase Cloud Messaging (Web Push Notification) Module
 */
(function () {
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDeWl58tbJYLc1jWjaBMkg7bmRlTzmOSuU",
        authDomain: "antgo-bb83e.firebaseapp.com",
        projectId: "antgo-bb83e",
        storageBucket: "antgo-bb83e.firebasestorage.app",
        messagingSenderId: "944639072539",
        appId: "1:944639072539:web:d6ca6d283e7b888ea15bbe",
        measurementId: "G-66Z0ELE9QG"
    };

    const VAPID_KEY = "BByLskJcL-nwi6uVRZQm2FuB8y_IHwnJvfJgzwM4_T-n0AMXC1wbhT5Zl-mju2opR5_HICP-6-rDcElYNSn77u8";

    // Kiểm tra trình duyệt có hỗ trợ Service Worker và Push Notification không
    function isPushSupported() {
        return ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
    }

    // Tự động tải Firebase SDK nếu chưa được nạp
    function loadFirebaseScripts(callback) {
        if (typeof firebase !== 'undefined' && firebase.messaging) {
            callback();
            return;
        }

        function loadScript(src, cb) {
            const s = document.createElement('script');
            s.src = src;
            s.onload = cb;
            s.onerror = (e) => console.error('[FCM] Không tải được script:', src, e);
            document.head.appendChild(s);
        }

        if (typeof firebase === 'undefined') {
            loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js', () => {
                loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js', callback);
            });
        } else if (!firebase.messaging) {
            loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js', callback);
        } else {
            callback();
        }
    }

    // Đăng ký Service Worker và đồng bộ Device Token với máy chủ
    async function syncFcmToken(registration) {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            console.log('[FCM] Chưa đăng nhập (không có accessToken), tạm bỏ qua lấy token.');
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            const messaging = firebase.messaging();

            // Lấy token thiết bị từ Firebase
            const currentFcmToken = await messaging.getToken({
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (currentFcmToken) {
                // Luôn đồng bộ lên server để đảm bảo tài khoản hiện tại nhận được thông báo
                const res = await fetch('/api/v1/devices/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        token: currentFcmToken,
                        platform: 'WEB'
                    })
                });

                if (res.ok) {
                    localStorage.setItem('fcmDeviceToken', currentFcmToken);
                    localStorage.setItem('fcmUserToken', token);
                    console.log('%c[FCM] Đã kích hoạt & đồng bộ Web Push Token thành công!', 'color: green; font-weight: bold;', currentFcmToken);
                } else {
                    console.warn('[FCM] Server báo lỗi khi lưu token:', res.status);
                }
            } else {
                console.warn('[FCM] Không thể sinh FCM Token.');
            }

            // Lắng nghe khi có thông báo lúc tab đang mở (Foreground)
            messaging.onMessage((payload) => {
                console.log('[FCM Foreground] Nhận thông báo trực tiếp:', payload);
                window.dispatchEvent(new CustomEvent('antgo:fcm_message', { detail: payload }));
            });

        } catch (err) {
            console.warn('[FCM] Lỗi khi lấy hoặc gửi FCM Token:', err);
        }
    }

    // Hiển thị banner gợi ý bật thông báo nếu người dùng chưa cho phép
    function showPermissionPrompt(onAccept) {
        if (document.getElementById('antgo-fcm-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'antgo-fcm-banner';
        banner.style.cssText = `
            position: fixed; top: 16px; right: 16px; z-index: 100001;
            background: #ffffff; border-radius: 12px; padding: 14px 18px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.18); border: 1.5px solid #FF6600;
            display: flex; align-items: center; gap: 14px; max-width: 400px;
            animation: fcmSlideDown 0.3s ease-out; font-family: inherit;
        `;
        banner.innerHTML = `
            <style>
                @keyframes fcmSlideDown {
                    from { opacity: 0; transform: translateY(-16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #fff7ed; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #FF6600;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 3px;">Bật thông báo đẩy AntGo</div>
                <div style="font-size: 12px; color: #64748b; line-height: 1.35;">Nhận thông báo đánh giá, ứng tuyển và ca làm ngay cả khi đã đóng trình duyệt.</div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button id="fcm-btn-enable" style="background: #FF6600; color: white; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">Cho phép ngay</button>
                    <button id="fcm-btn-dismiss" style="background: #f1f5f9; color: #64748b; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">Để sau</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        document.getElementById('fcm-btn-enable').onclick = async () => {
            banner.remove();
            if (onAccept) await onAccept();
        };
        document.getElementById('fcm-btn-dismiss').onclick = () => {
            banner.remove();
        };
    }

    // Khởi tạo toàn diện FCM
    async function initFcm() {
        if (!isPushSupported()) {
            console.warn('[FCM] Trình duyệt không hỗ trợ Web Push Notifications (yêu cầu HTTPS hoặc localhost).');
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        loadFirebaseScripts(async () => {
            try {
                // Đăng ký Service Worker với scope toàn domain
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
                await navigator.serviceWorker.ready;

                console.log('[FCM] Service Worker sẵn sàng. Quyền thông báo hiện tại:', Notification.permission);

                // Nếu người dùng đã cho phép nhận thông báo từ trước
                if (Notification.permission === 'granted') {
                    await syncFcmToken(registration);
                } else if (Notification.permission === 'default') {
                    // Hiển thị banner nhắc người dùng bấm Cho phép
                    showPermissionPrompt(async () => {
                        const permission = await Notification.requestPermission();
                        if (permission === 'granted') {
                            await syncFcmToken(registration);
                        } else {
                            console.warn('[FCM] Người dùng đã từ chối nhận thông báo:', permission);
                        }
                    });
                } else if (Notification.permission === 'denied') {
                    console.warn('[FCM] Thông báo bị CHẶN trên trình duyệt này. Vui lòng bấm vào icon ổ khóa ở thanh địa chỉ để chuyển sang Cho phép (Allow).');
                }
            } catch (err) {
                console.warn('[FCM] Lỗi đăng ký Service Worker FCM:', err);
            }
        });
    }

    // Hàm gọi khi đăng xuất tài khoản
    window.unregisterFcmToken = async function () {
        const token = localStorage.getItem('accessToken');
        const fcmToken = localStorage.getItem('fcmDeviceToken');
        if (fcmToken && token) {
            try {
                await fetch(`/api/v1/devices/token?token=${encodeURIComponent(fcmToken)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
            } catch (e) {}
        }
        localStorage.removeItem('fcmDeviceToken');
        localStorage.removeItem('fcmUserToken');
    };

    // Hàm chủ động yêu cầu cấp quyền
    window.requestFcmPermission = async function () {
        if (!isPushSupported()) return false;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await initFcm();
                return true;
            }
        } catch (e) {
            console.error('[FCM] Lỗi xin quyền thông báo:', e);
        }
        return false;
    };

    // Công cụ chẩn đoán nhanh trên Console trình duyệt
    window.checkFcmStatus = async function () {
        console.group('=== AntGo FCM Push Diagnosis ===');
        console.log('1. Push Supported:', isPushSupported());
        console.log('2. Notification Permission:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A');
        console.log('3. Access Token:', localStorage.getItem('accessToken') ? 'Có (đã đăng nhập)' : 'Chưa đăng nhập');
        console.log('4. Cached FCM Token:', localStorage.getItem('fcmDeviceToken') || 'Chưa lưu');
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            console.log('5. Service Workers active:', regs.map(r => r.scope));
        }
        console.groupEnd();
    };

    // Tự động khởi chạy khi trang sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFcm);
    } else {
        initFcm();
    }
})();
