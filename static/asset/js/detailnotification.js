const token = localStorage.getItem('accessToken');
        let allNotifications = [];
        let currentDisplayedId = null;

        function goBack() {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                const mode = localStorage.getItem('currentMode') || 'WORKER';
                window.location.href = (mode === 'EMPLOYER') ? '/interface/managejob' : '/interface/findjob';
            }
        }

        function formatDateTime(dt) {
            if (!dt) return '';
            try {
                const date = new Date(dt);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + date.toLocaleDateString('vi-VN');
            } catch {
                return '';
            }
        }

        function getNotificationBadge(type) {
            if (type === 'INVITATION') {
                return { text: 'Lời mời việc · Quan trọng', isImportant: true };
            } else if (type === 'APPLICATION') {
                return { text: 'Ứng tuyển', isImportant: false };
            } else {
                return { text: 'Hệ thống', isImportant: false };
            }
        }

        function markAsRead(notif) {
            if (!notif || notif.isRead || !token) return;
            notif.isRead = true;
            fetch(`http://localhost:8083/api/v1/notification/${notif.id}`, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            }).catch(() => {});
        }

        function renderDetail(notif) {
            if (!notif) {
                document.getElementById('main-detail-card').style.display = 'none';
                document.getElementById('not-found-state').style.display = 'block';
                return;
            }

            currentDisplayedId = notif.id;
            markAsRead(notif);

            document.getElementById('not-found-state').style.display = 'none';
            document.getElementById('main-detail-card').style.display = 'block';

            // Tag & Meta
            const badge = getNotificationBadge(notif.type);
            const tagEl = document.getElementById('detail-tag');
            tagEl.innerText = badge.text;
            tagEl.className = 'notif-tag ' + (badge.isImportant ? 'important' : '');

            document.getElementById('detail-time').innerText = 'Thời gian: ' + formatDateTime(notif.createdAt);
            document.getElementById('detail-title').innerText = notif.title || 'Thông báo';
            document.getElementById('detail-content').innerText = notif.content || 'Không có nội dung chi tiết.';

            // Action button
            const actionBtn = document.getElementById('btn-action');
            if (notif.type === 'INVITATION') {
                actionBtn.style.display = 'inline-flex';
                actionBtn.innerHTML = `<i class="ti ti-mail-opened"></i> Xem danh sách lời mời làm việc`;
                actionBtn.onclick = () => window.location.href = '/interface/manageapplication?tab=INVITATION';
            } else if (notif.type === 'APPLICATION') {
                actionBtn.style.display = 'inline-flex';
                const role = localStorage.getItem('currentMode');
                if (role === 'WORKER') {
                    actionBtn.innerHTML = `<i class="ti ti-file-text"></i> Xem đơn đã ứng tuyển`;
                    actionBtn.onclick = () => window.location.href = '/interface/manageapplication?tab=APPLICATION';
                } else {
                    actionBtn.innerHTML = `<i class="ti ti-users"></i> Xem duyệt ứng viên công việc này`;
                    actionBtn.onclick = () => {
                        if (notif.jobId) {
                            window.location.href = `/interface/checkapplication?jobId=${notif.jobId}`;
                        } else {
                            window.location.href = '/interface/managejob';
                        }
                    };
                }
            } else {
                actionBtn.style.display = 'none';
            }

            renderOtherList(allNotifications);
        }

        function renderOtherList(items) {
            const listEl = document.getElementById('other-notifications-list');
            if (!items || items.length === 0) {
                listEl.innerHTML = `<li class="empty-state">Không có thông báo nào khác</li>`;
                document.getElementById('total-notif-count').innerText = '(0)';
                return;
            }

            document.getElementById('total-notif-count').innerText = `(${items.length})`;
            listEl.innerHTML = items.map(n => {
                const badge = getNotificationBadge(n.type);
                const isActive = n.id === currentDisplayedId;
                return `
                    <li class="other-item ${isActive ? 'active' : ''} ${n.isRead ? '' : 'unread'}" onclick="selectNotification('${n.id}')">
                        <div class="other-header">
                            <span class="notif-tag ${badge.isImportant ? 'important' : ''}">${badge.text}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">${formatDateTime(n.createdAt)}</span>
                        </div>
                        <div class="other-title">${n.title}</div>
                        <div class="other-snippet">${n.content || ''}</div>
                    </li>
                `;
            }).join('');
        }

        function selectNotification(id) {
            const found = allNotifications.find(n => String(n.id) === String(id));
            if (found) {
                // Update URL params without reloading
                const url = new URL(window.location);
                url.searchParams.set('title', found.title || '');
                url.searchParams.set('id', found.id || '');
                if (found.jobId) {
                    url.searchParams.set('jobId', found.jobId);
                } else {
                    url.searchParams.delete('jobId');
                }
                window.history.replaceState({}, '', url);

                document.getElementById('input-search-title').value = found.title || '';
                renderDetail(found);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function onSearchClick() {
            const query = (document.getElementById('input-search-title').value || '').trim().toLowerCase();
            if (!query) {
                if (allNotifications.length > 0) {
                    selectNotification(allNotifications[0].id);
                }
                return;
            }

            const matched = allNotifications.find(n => (n.title || '').toLowerCase().includes(query));
            if (matched) {
                selectNotification(matched.id);
            } else {
                renderDetail(null);
            }
        }

        // Enter key in search box
        document.getElementById('input-search-title').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                onSearchClick();
            }
        });

        // Initialize Page
        async function initPage() {
            if (!token) {
                alert('Vui lòng đăng nhập để xem thông báo');
                window.location.href = '/interface/authentication';
                return;
            }

            const params = new URLSearchParams(window.location.search);
            const paramTitle = params.get('title');
            const paramId = params.get('id');
            const paramJobId = params.get('jobId');

            if (paramTitle) {
                document.getElementById('input-search-title').value = paramTitle;
            }

            try {
                const res = await fetch('http://localhost:8083/api/v1/notification', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.status === 401) {
                    alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
                    localStorage.clear();
                    window.location.href = '/interface/authentication';
                    return;
                }
                if (res.status === 403) {
                    alert('Bạn không có quyền truy cập thông báo này.');
                    renderDetail(null);
                    renderOtherList([]);
                    return;
                }
                const data = await res.json();

                if (data.code === 200 && data.data && data.data.notifications) {
                    allNotifications = data.data.notifications;

                    let target = null;
                    if (paramId) {
                        target = allNotifications.find(n => String(n.id) === String(paramId));
                    }
                    if (!target && paramTitle) {
                        const cleanQuery = paramTitle.trim().toLowerCase();
                        target = allNotifications.find(n => (n.title || '').toLowerCase().includes(cleanQuery));
                    }
                    if (!target && allNotifications.length > 0) {
                        target = allNotifications[0];
                    }

                    if (target && !target.jobId && paramJobId) {
                        target.jobId = paramJobId;
                    }

                    renderDetail(target);
                } else {
                    renderDetail(null);
                    renderOtherList([]);
                }
            } catch (err) {
                console.error("Error loading notification:", err);
                renderDetail(null);
                renderOtherList([]);
            }
        }

        document.addEventListener('DOMContentLoaded', initPage);
