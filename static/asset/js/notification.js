(function () {
    function initNotificationUI() {
        const token = localStorage.getItem('accessToken');

        // 1. Tự động tải SockJS và Stomp nếu trang chưa có
        function ensureSockJsAndStomp(callback) {
            if (typeof SockJS !== 'undefined' && typeof Stomp !== 'undefined') {
                callback();
                return;
            }
            const sockScript = document.createElement('script');
            sockScript.src = "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js";
            sockScript.onload = () => {
                const stompScript = document.createElement('script');
                stompScript.src = "https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js";
                stompScript.onload = () => {
                    callback();
                };
                document.head.appendChild(stompScript);
            };
            document.head.appendChild(sockScript);
        }

        // 2. CSS Phím Trợ Năng & Menu Thông Báo
        const css = `
            /* Nút Chuông Thông Báo - Phím Trợ Năng Kéo Thả (AssistiveTouch) */
            .flashjob-notif-btn {
                position: fixed; z-index: 99999;
                width: 44px; height: 44px; border-radius: 50%;
                background: #ffffff; border: 1.5px solid #cbd5e1;
                box-shadow: 0 6px 20px rgba(0,0,0,0.15); display: flex;
                align-items: center; justify-content: center;
                cursor: grab; user-select: none; -webkit-user-select: none;
                touch-action: none; color: #1e293b;
            }
            .flashjob-notif-btn:hover { background: #f8fafc; }
            .flashjob-notif-btn:active { cursor: grabbing; transform: scale(1.06); }
            .flashjob-notif-btn.snapping {
                transition: left 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28), top 0.25s ease;
            }
            .flashjob-notif-badge {
                position: absolute; top: -3px; right: -3px;
                background: #ef4444; color: white; font-size: 11px;
                font-weight: 700; padding: 2px 6px; border-radius: 10px;
                border: 2px solid white; display: none; pointer-events: none;
            }

            /* Menu Thả Xuống (Dropdown) */
            .flashjob-notif-dropdown {
                position: fixed; z-index: 99999;
                width: 360px; max-width: 92vw; max-height: 480px;
                background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: none;
                flex-direction: column; overflow: hidden;
                animation: notifSlideIn 0.2s ease-out;
            }
            @keyframes notifSlideIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .notif-header {
                padding: 14px 18px; border-bottom: 1px solid #f1f5f9;
                display: flex; justify-content: space-between; align-items: center;
                background: #fafafa;
            }
            .notif-header h4 { margin: 0; font-size: 14px; font-weight: 700; color: #1e293b; }
            .notif-btn-readall {
                background: none; border: none; font-size: 12px; color: #FF6600;
                cursor: pointer; font-weight: 600; padding: 0;
            }
            .notif-btn-readall:hover { text-decoration: underline; color: #E55C00; }
            .notif-list { flex: 1; overflow-y: auto; padding: 4px 0; margin: 0; list-style: none; }
            .notif-item {
                padding: 12px 18px; border-bottom: 1px solid #f8fafc; cursor: pointer;
                transition: background 0.15s; display: flex; flex-direction: column;
            }
            .notif-item:hover { background: #f8fafc; }
            .notif-item.unread { background: #FFF5ED; }
            
            /* Tiêu đề thông báo - Rõ ràng, có hiệu ứng bấm */
            .notif-item-title {
                font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 3px;
                cursor: pointer; transition: color 0.15s ease;
            }
            .notif-item-title:hover {
                color: #FF6600;
                text-decoration: underline;
            }

            .notif-item-content { font-size: 12px; color: #64748b; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .notif-item-time { font-size: 11px; color: #94a3b8; }
            .notif-empty { padding: 30px; text-align: center; color: #94a3b8; font-size: 13px; }

            /* Nhãn phân loại tối giản - Tông màu trung tính */
            .notif-tag {
                font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 4px;
                background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;
                display: inline-block;
            }
            .notif-tag.important {
                font-weight: 700; color: #0f172a; background: #e2e8f0; border-color: #cbd5e1;
            }

            /* Toast góc phải màn hình - Tối giản */
            .notif-toast {
                position: fixed; bottom: 24px; right: 24px; z-index: 100000;
                background: #ffffff; border-radius: 12px; padding: 14px 18px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.12); border-left: 4px solid #FF6600;
                max-width: 340px; transform: translateX(130%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                display: flex; flex-direction: column; gap: 4px; cursor: pointer; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
            }
            .notif-toast.show { transform: translateX(0); }
        `;
        const styleEl = document.createElement('style');
        styleEl.innerHTML = css;
        document.head.appendChild(styleEl);

        // 3. Chèn HTML Chuông, Dropdown và Toast vào trang
        const container = document.createElement('div');
        container.innerHTML = `
            <!-- Nút Chuông (Phím Trợ Năng) -->
            <div class="flashjob-notif-btn" id="notif-bell-btn" title="Kéo để di chuyển · Bấm để xem thông báo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>
                <span class="flashjob-notif-badge" id="notif-badge-count">0</span>
            </div>

            <!-- Menu Dropdown -->
            <div class="flashjob-notif-dropdown" id="notif-dropdown">
                <div class="notif-header">
                    <h4>Thông báo</h4>
                    <button class="notif-btn-readall" id="notif-read-all-btn">Đọc tất cả</button>
                </div>
                <ul class="notif-list" id="notif-list-items">
                    <li class="notif-empty">Đang tải...</li>
                </ul>
            </div>

            <!-- Toast góc phải màn hình -->
            <div class="notif-toast" id="notif-live-toast">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="notif-tag" id="toast-tag">Thông báo</span>
                    <span style="font-size:11px; color:#94a3b8;">Vừa xong</span>
                </div>
                <strong id="toast-title" style="font-size:13px; color:#1e293b; margin-top:2px;"></strong>
                <span id="toast-body" style="font-size:12px; color:#64748b; line-height:1.4;"></span>
            </div>
        `;
        document.body.appendChild(container);

        const bellBtn = document.getElementById('notif-bell-btn');
        const dropdown = document.getElementById('notif-dropdown');
        const badge = document.getElementById('notif-badge-count');
        const listEl = document.getElementById('notif-list-items');
        const readAllBtn = document.getElementById('notif-read-all-btn');

        // 4. Khôi phục vị trí phím trợ năng từ localStorage
        const savedPos = JSON.parse(localStorage.getItem('flashjob_notif_pos') || 'null');
        if (savedPos && savedPos.top != null) {
            const clampTop = Math.min(window.innerHeight - 60, Math.max(16, savedPos.top));
            bellBtn.style.top = clampTop + 'px';
            if (savedPos.side === 'left') {
                bellBtn.style.left = '16px';
                bellBtn.style.right = 'auto';
            } else {
                bellBtn.style.left = (window.innerWidth - 60) + 'px';
                bellBtn.style.right = 'auto';
            }
        } else {
            // Mặc định: bên phải, cách đỉnh 80px (dưới header)
            bellBtn.style.top = '80px';
            bellBtn.style.left = (window.innerWidth - 60) + 'px';
            bellBtn.style.right = 'auto';
        }

        // 5. Logic Kéo Thả Phím Trợ Năng (AssistiveTouch)
        let isDragging = false;
        let dragMoved = false;
        let startX = 0, startY = 0, initX = 0, initY = 0;

        function onPointerDown(e) {
            isDragging = true;
            dragMoved = false;
            bellBtn.classList.remove('snapping');

            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;

            const rect = bellBtn.getBoundingClientRect();
            initX = rect.left;
            initY = rect.top;

            document.addEventListener('mousemove', onPointerMove, { passive: false });
            document.addEventListener('mouseup', onPointerUp);
            document.addEventListener('touchmove', onPointerMove, { passive: false });
            document.addEventListener('touchend', onPointerUp);
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - startX;
            const dy = clientY - startY;

            if (Math.hypot(dx, dy) > 5) {
                dragMoved = true;
                if (e.cancelable) e.preventDefault();

                let newX = initX + dx;
                let newY = initY + dy;
                newX = Math.max(10, Math.min(window.innerWidth - 54, newX));
                newY = Math.max(10, Math.min(window.innerHeight - 54, newY));

                bellBtn.style.left = newX + 'px';
                bellBtn.style.top = newY + 'px';
                bellBtn.style.right = 'auto';
                dropdown.style.display = 'none'; // Ẩn dropdown khi đang kéo
            }
        }

        function onPointerUp() {
            if (!isDragging) return;
            isDragging = false;

            document.removeEventListener('mousemove', onPointerMove);
            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('touchmove', onPointerMove);
            document.removeEventListener('touchend', onPointerUp);

            if (dragMoved) {
                // Tự động hít (snap) vào mép màn hình gần nhất
                bellBtn.classList.add('snapping');
                const rect = bellBtn.getBoundingClientRect();
                const snapLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
                const targetX = snapLeft ? 16 : (window.innerWidth - 60);
                const targetY = Math.min(window.innerHeight - 60, Math.max(16, rect.top));

                bellBtn.style.left = targetX + 'px';
                bellBtn.style.top = targetY + 'px';

                // Lưu vị trí vào localStorage
                localStorage.setItem('flashjob_notif_pos', JSON.stringify({
                    side: snapLeft ? 'left' : 'right',
                    top: targetY
                }));
            }
        }

        bellBtn.addEventListener('mousedown', onPointerDown);
        bellBtn.addEventListener('touchstart', onPointerDown, { passive: false });

        // Cập nhật vị trí khi người dùng xoay hoặc thay đổi kích thước màn hình
        window.addEventListener('resize', () => {
            const rect = bellBtn.getBoundingClientRect();
            const snapLeft = rect.left + rect.width / 2 < window.innerWidth / 2;
            const targetX = snapLeft ? 16 : (window.innerWidth - 60);
            const targetY = Math.min(window.innerHeight - 60, Math.max(16, rect.top));
            bellBtn.style.left = targetX + 'px';
            bellBtn.style.top = targetY + 'px';
        });

        // Định vị và mở dropdown theo vị trí phím trợ năng
        bellBtn.addEventListener('click', (e) => {
            if (dragMoved) return; // Nếu vừa kéo thả xong thì không bật menu
            e.stopPropagation();
            if (!token) {
                alert("Vui lòng đăng nhập để xem thông báo!");
                return;
            }

            const isHidden = dropdown.style.display === 'none' || dropdown.style.display === '';
            if (isHidden) {
                const rect = bellBtn.getBoundingClientRect();
                const isLeft = rect.left + rect.width / 2 < window.innerWidth / 2;

                // Chiều ngang
                if (isLeft) {
                    dropdown.style.left = Math.max(10, rect.left) + 'px';
                    dropdown.style.right = 'auto';
                } else {
                    dropdown.style.right = Math.max(10, window.innerWidth - rect.right) + 'px';
                    dropdown.style.left = 'auto';
                }

                // Chiều dọc
                if (rect.bottom + 420 > window.innerHeight) {
                    dropdown.style.bottom = Math.max(10, window.innerHeight - rect.top + 8) + 'px';
                    dropdown.style.top = 'auto';
                } else {
                    dropdown.style.top = (rect.bottom + 8) + 'px';
                    dropdown.style.bottom = 'auto';
                }

                dropdown.style.display = 'flex';
            } else {
                dropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) dropdown.style.display = 'none';
        });

        // Xác định nhãn tối giản cho từng loại thông báo
        function getNotificationLabel(type) {
            if (type === 'INVITATION') {
                return { text: 'Lời mời việc ', isImportant: true };
            } else if (type === 'APPLICATION') {
                return { text: 'Ứng tuyển', isImportant: false };
            } else {
                return { text: 'Hệ thống', isImportant: false };
            }
        }

        // Chuyển hướng sang trang chi tiết thông báo
        window.navigateToNotificationDetail = function(title, id, jobId) {
            dropdown.style.display = 'none';

            // Đánh dấu đã đọc trong nền
            if (id && token) {
                fetch(`http://localhost:8083/api/v1/notification/${id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': 'Bearer ' + token }
                }).catch(() => {});
            }

            const searchParam = encodeURIComponent(title || '');
            const idParam = id || '';
            const jobParam = jobId || '';
            window.location.href = `/interface/detailnotification?title=${searchParam}&id=${idParam}&jobId=${jobParam}`;
        };

        // Bắt sự kiện click vào bất kỳ thông báo nào trong danh sách
        listEl.addEventListener('click', (e) => {
            const item = e.target.closest('.notif-item');
            if (!item) return;

            const notifId = item.getAttribute('data-id');
            const notifTitle = item.getAttribute('data-title') || '';
            const notifJobId = item.getAttribute('data-jobid') || '';

            // Cập nhật giao diện đã đọc
            if (item.classList.contains('unread')) {
                item.classList.remove('unread');
                const currentBadge = parseInt(badge.innerText) || 1;
                updateBadge(currentBadge - 1);
            }

            window.navigateToNotificationDetail(notifTitle, notifId, notifJobId);
        });

        if (!token) {
            listEl.innerHTML = `<li class="notif-empty">Vui lòng đăng nhập để xem thông báo</li>`;
            return;
        }

        // Đánh dấu tất cả đã đọc
        readAllBtn.addEventListener('click', () => {
            fetch('http://localhost:8083/api/v1/notification', {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(() => {
                badge.style.display = 'none';
                document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
            });
        });

        // 6. Tải danh sách thông báo ban đầu
        fetch('http://localhost:8083/api/v1/notification', {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(res => {
            if (res.code === 200 && res.data) {
                updateBadge(res.data.unreadCount);
                renderList(res.data.notifications);
                if (res.data.userId) {
                    ensureSockJsAndStomp(() => {
                        initNotificationSocket(res.data.userId);
                    });
                }
            }
        })
        .catch(() => {});

        function updateBadge(count) {
            if (count > 0) {
                badge.innerText = count > 99 ? '99+' : count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        function renderList(items) {
            if (!items || items.length === 0) {
                listEl.innerHTML = `<li class="notif-empty">Chưa có thông báo nào</li>`;
                return;
            }

            listEl.innerHTML = items.map(n => {
                const lbl = getNotificationLabel(n.type);
                const safeTitle = (n.title || '').replace(/"/g, '&quot;');
                const jobIdAttr = n.jobId || '';
                return `
                    <li class="notif-item ${n.isRead ? '' : 'unread'}" id="notif-item-${n.id}" data-id="${n.id}" data-title="${safeTitle}" data-jobid="${jobIdAttr}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span class="notif-tag ${lbl.isImportant ? 'important' : ''}">${lbl.text}</span>
                            <span class="notif-item-time">${formatTime(n.createdAt)}</span>
                        </div>
                        <div class="notif-item-title" title="Bấm vào tiêu đề để xem chi tiết">${n.title}</div>
                        <div class="notif-item-content">${n.content || ''}</div>
                    </li>
                `;
            }).join('');
        }

        // Âm thanh chuông báo nhẹ
        function playNotificationSound() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.4);
            } catch (e) {}
        }

        // 7. Lắng nghe WebSocket thời gian thực & Kích hoạt Sự kiện
        function initNotificationSocket(userId) {
            if (typeof SockJS === 'undefined' || typeof Stomp === 'undefined') return;
            const socket = new SockJS('http://localhost:8083/ws');
            const stompClient = Stomp.over(socket);
            stompClient.debug = null;
            stompClient.connect({ 'Authorization': 'Bearer ' + token }, () => {
                stompClient.subscribe('/topic/notifications/' + userId, (msg) => {
                    const data = JSON.parse(msg.body);

                    // SỰ KIỆN 1: Phát âm thanh chuông nhẹ
                    playNotificationSound();

                    // SỰ KIỆN 2: Tăng badge số lượng
                    const currentBadge = (parseInt(badge.innerText) || 0) + 1;
                    updateBadge(currentBadge);

                    // SỰ KIỆN 3: Thêm vào danh sách dropdown
                    const emptyEl = listEl.querySelector('.notif-empty');
                    if (emptyEl) emptyEl.remove();

                    const lbl = getNotificationLabel(data.type);
                    const safeTitle = (data.title || '').replace(/"/g, '&quot;');
                    const newLi = document.createElement('li');
                    newLi.className = 'notif-item unread';
                    newLi.id = `notif-item-${data.id}`;
                    newLi.setAttribute('data-id', data.id);
                    newLi.setAttribute('data-title', safeTitle);
                    newLi.setAttribute('data-jobid', data.jobId || '');
                    newLi.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span class="notif-tag ${lbl.isImportant ? 'important' : ''}">${lbl.text}</span>
                            <span class="notif-item-time">Vừa xong</span>
                        </div>
                        <div class="notif-item-title" title="Bấm vào tiêu đề để xem chi tiết">${data.title}</div>
                        <div class="notif-item-content">${data.content || ''}</div>
                    `;
                    listEl.prepend(newLi);

                    // SỰ KIỆN 4: Hiện Toast tối giản ở góc
                    const lblToast = getNotificationLabel(data.type);
                    const toastTag = document.getElementById('toast-tag');
                    toastTag.innerText = lblToast.text;
                    toastTag.className = 'notif-tag ' + (lblToast.isImportant ? 'important' : '');

                    const toast = document.getElementById('notif-live-toast');
                    document.getElementById('toast-title').innerText = data.title;
                    document.getElementById('toast-body').innerText = data.content || '';
                    toast.onclick = () => window.navigateToNotificationDetail(data.title, data.id, data.jobId);
                    toast.classList.add('show');
                    setTimeout(() => toast.classList.remove('show'), 5000);

                    // SỰ KIỆN 5: Bắn CustomEvent cho trang hiện tại
                    window.dispatchEvent(new CustomEvent('antgo:notification', { detail: data }));
                    window.dispatchEvent(new CustomEvent('flashjob:notification', { detail: data }));
                });
            });
        }

        function formatTime(dt) {
            if (!dt) return '';
            try {
                const date = new Date(dt);
                return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + ' ' + date.toLocaleDateString();
            } catch { return ''; }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNotificationUI);
    } else {
        initNotificationUI();
    }
})();
