// Firebase Cloud Messaging Service Worker for AntGo
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDeWl58tbJYLc1jWjaBMkg7bmRlTzmOSuU",
    authDomain: "antgo-bb83e.firebaseapp.com",
    projectId: "antgo-bb83e",
    storageBucket: "antgo-bb83e.firebasestorage.app",
    messagingSenderId: "944639072539",
    appId: "1:944639072539:web:d6ca6d283e7b888ea15bbe",
    measurementId: "G-66Z0ELE9QG"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Lắng nghe khi có thông báo đẩy lúc trình duyệt đang ở chế độ nền (Background) hoặc đã đóng tab
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Đã nhận thông báo nền:', payload);

    const title = payload.notification?.title || payload.data?.title || 'Thông báo AntGo';
    const body = payload.notification?.body || payload.data?.body || payload.data?.content || 'Bạn có thông báo mới trên AntGo';
    
    let targetUrl = payload.data?.url || payload.data?.click_action;
    if (!targetUrl) {
        const id = payload.data?.id || '';
        const jobId = payload.data?.jobId || '';
        const encodedTitle = encodeURIComponent(title);
        targetUrl = `/interface/detailnotification?title=${encodedTitle}&id=${id}&jobId=${jobId}`;
    }

    const notificationOptions = {
        body: body,
        icon: payload.notification?.icon || '/asset/antgo-icon.svg',
        badge: '/asset/antgo-icon.svg',
        data: {
            url: targetUrl,
            ...payload.data
        },
        tag: payload.data?.type || 'antgo-notification',
        renotify: true,
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(title, notificationOptions);
});

// Bắt sự kiện khi người dùng click vào thông báo từ trình duyệt
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Nếu có tab đang mở trang AntGo thì focus vào và chuyển trang
            for (const client of clientList) {
                if (client.url && client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    if ('navigate' in client) {
                        return client.navigate(targetUrl);
                    }
                    return;
                }
            }
            // Nếu chưa có tab nào mở thì mở tab mới
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
