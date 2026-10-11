const API_ADMIN_BASE = '/api/v1/admin';
let currentActiveTab = 'dashboard';
let currentEkycFilter = 'PENDING';
let currentReportFilter = 'PENDING';
let reportsDataCache = [];

// ================= AUTH CHECK =================
document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');

    if (!token) {
        alert('Vui lòng đăng nhập với tài khoản Quản trị viên!');
        window.location.href = '/interface/authentication';
        return;
    }

    if (role !== 'ROLE_ADMIN') {
        alert('Bạn không có quyền truy cập trang Quản trị!');
        window.location.href = '/interface/managejob';
        return;
    }

    initSidebarNav();
    loadDashboardStats();
});

// Helper for authenticated requests
function authFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    return fetch(url, options)
        .then(async (response) => {
            if (response.status === 401 || response.status === 403) {
                if (response.status === 403) {
                    showToast('Bạn không có quyền quản trị!', 'error');
                } else {
                    showToast('Phiên đăng nhập hết hạn!', 'error');
                    localStorage.removeItem('accessToken');
                    setTimeout(() => window.location.href = '/interface/authentication', 1000);
                }
                throw new Error('Unauthorized or Forbidden');
            }
            const data = await response.json();
            return data;
        });
}

// ================= HELPERS & MEDIA RESOLVER =================
function extractDriveFileId(str) {
    if (!str) return null;
    str = String(str).trim();
    if (/^[a-zA-Z0-9_-]{25,60}$/.test(str)) return str;
    const match = str.match(/\/d\/([a-zA-Z0-9_-]{25,60})/) 
               || str.match(/[?&]id=([a-zA-Z0-9_-]{25,60})/)
               || str.match(/\/media\/([a-zA-Z0-9_-]{25,60})/);
    return match ? match[1] : null;
}

function resolveMediaUrl(urlOrId) {
    if (!urlOrId || !String(urlOrId).trim()) return '/asset/antgo-icon.svg';
    const trimmed = String(urlOrId).trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return trimmed;
    }
    const driveId = extractDriveFileId(trimmed) || trimmed;
    return `/api/v1/messages/media/${driveId}`;
}

function getDriveDirectViewUrl(urlOrId) {
    if (!urlOrId || !String(urlOrId).trim()) return '';
    const trimmed = String(urlOrId).trim();
    if (trimmed.startsWith('https://drive.google.com/')) return trimmed;
    const driveId = extractDriveFileId(trimmed);
    if (driveId) return `https://drive.google.com/file/d/${driveId}/view`;
    return trimmed.startsWith('http') ? trimmed : '';
}

function formatScoreBadge(score) {
    const val = (score !== null && score !== undefined) ? Number(score) : 100;
    let cls = 'score-good';
    if (val < 50) cls = 'score-danger';
    else if (val < 80) cls = 'score-warn';
    return `<span class="score-num ${cls}">${val}</span>`;
}

function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return '0 đ';
    return Number(val).toLocaleString('vi-VN') + ' đ';
}

function parseEvidenceList(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    const str = String(raw).trim();
    if (!str) return [];

    // Try parsing JSON first
    if (str.startsWith('[') || str.startsWith('{')) {
        try {
            const parsed = JSON.parse(str);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            return list.map((item, idx) => {
                if (typeof item === 'string') {
                    return {
                        type: 'IMAGE',
                        name: `Bằng chứng ${idx + 1}`,
                        url: resolveMediaUrl(item),
                        driveUrl: getDriveDirectViewUrl(item)
                    };
                }
                const fileId = item.fileId || extractDriveFileId(item.url) || '';
                const resolvedUrl = fileId ? `/api/v1/messages/media/${fileId}` : (item.url || '');
                const driveUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : (item.url || '');
                const isVideo = item.type === 'VIDEO' || (item.mimeType && item.mimeType.startsWith('video'));
                return {
                    type: isVideo ? 'VIDEO' : 'IMAGE',
                    name: item.name || `Bằng chứng ${idx + 1}`,
                    url: resolvedUrl,
                    driveUrl: driveUrl
                };
            });
        } catch (e) {
            console.warn('Could not parse evidence as JSON, falling back to split', e);
        }
    }

    // Fallback: split by comma if plain string
    return str.split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.includes('"') && !s.includes('{') && !s.includes('}'))
        .map((u, idx) => ({
            type: 'IMAGE',
            name: `Bằng chứng ${idx + 1}`,
            url: resolveMediaUrl(u),
            driveUrl: getDriveDirectViewUrl(u)
        }));
}

function renderEvidenceHtml(evidenceList, reporterName) {
    if (!evidenceList || evidenceList.length === 0) return '';

    const itemsHtml = evidenceList.map((item, idx) => {
        const isVideo = item.type === 'VIDEO';
        const label = escapeHtml(item.name || `Tệp ${idx + 1}`);

        if (isVideo) {
            return `
                <a href="${item.driveUrl || item.url}" target="_blank" class="video-chip" title="Xem video bằng chứng">
                    <i class="ti ti-video"></i>
                    <span>${label}</span>
                    <i class="ti ti-external-link icon-ext"></i>
                </a>
            `;
        }

        const imgTitle = `Bằng chứng: ${label} (Báo cáo bởi ${escapeHtml(reporterName || 'Người dùng')})`;
        return `
            <div class="evidence-chip-group">
                <button type="button" class="evidence-chip" onclick="zoomImage('${item.url}', '${imgTitle}', '${item.driveUrl}')" title="Bấm để xem ảnh phóng to">
                    <i class="ti ti-photo"></i>
                    <span>${label}</span>
                </button>
                ${item.driveUrl ? `
                    <a href="${item.driveUrl}" target="_blank" class="evidence-ext-link" title="Mở trực tiếp trên Google Drive">
                        <i class="ti ti-external-link"></i>
                    </a>
                ` : ''}
            </div>
        `;
    }).join('');

    return `
        <div class="evidence-block">
            <div class="evidence-header">
                <i class="ti ti-paperclip"></i>
                <span>Bằng chứng đính kèm (${evidenceList.length}):</span>
            </div>
            <div class="evidence-items">
                ${itemsHtml}
            </div>
        </div>
    `;
}

// ================= SIDEBAR & TABS =================
function initSidebarNav() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function () {
            const tabName = this.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebar = document.querySelector('.admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    window.closeAdminSidebar = function() {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    window.openAdminSidebar = function() {
        if (sidebar) sidebar.classList.add('open');
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
        if (window.innerWidth <= 992) {
            document.body.style.overflow = 'hidden';
        }
    };

    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            if (sidebar.classList.contains('open')) {
                window.closeAdminSidebar();
            } else {
                window.openAdminSidebar();
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', function (e) {
            e.stopPropagation();
            window.closeAdminSidebar();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function () {
            window.closeAdminSidebar();
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
            window.closeAdminSidebar();
        }
    });

    // Enter key for search
    const userSearchInput = document.getElementById('user-search-input');
    if (userSearchInput) {
        userSearchInput.addEventListener('keyup', function (e) {
            if (e.key === 'Enter') searchUsers();
        });
    }
}

function switchTab(tabName) {
    currentActiveTab = tabName;

    // Auto close sidebar on mobile screen when a tab is selected
    if (window.innerWidth <= 992 && typeof window.closeAdminSidebar === 'function') {
        window.closeAdminSidebar();
    }

    // Update active nav button
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    const targetPane = document.getElementById('tab-' + tabName);
    if (targetPane) targetPane.classList.add('active');

    // Update title
    const titles = {
        'dashboard': 'Tổng quan hệ thống',
        'users': 'Quản lý tài khoản người dùng',
        'ekyc': 'Xét duyệt hồ sơ định danh (eKYC)',
        'reports': 'Xử lý báo cáo & khiếu nại vi phạm',
        'categories': 'Quản lý danh mục ngành nghề'
    };
    document.getElementById('page-title').textContent = titles[tabName] || 'Hệ thống Quản trị';

    // Load data for the selected tab
    if (tabName === 'dashboard') loadDashboardStats();
    else if (tabName === 'users') loadUsers();
    else if (tabName === 'ekyc') loadEkycRecords(currentEkycFilter);
    else if (tabName === 'reports') loadReports(currentReportFilter);
    else if (tabName === 'categories') loadCategories();
}

function refreshCurrentTab() {
    switchTab(currentActiveTab);
    showToast('Đã làm mới dữ liệu!', 'info');
}

// ================= 1. DASHBOARD =================
function loadDashboardStats() {
    authFetch(`${API_ADMIN_BASE}/dashboard`)
        .then(res => {
            if (res.code === 200 && res.data) {
                const d = res.data;
                document.getElementById('kpi-total-users').textContent = Number(d.totalUsers).toLocaleString();
                document.getElementById('kpi-user-distribution').textContent =
                    `${d.totalWorkers} Ứng viên · ${d.totalEmployers} Nhà tuyển dụng`;
                document.getElementById('kpi-verified-users').textContent = Number(d.verifiedUsers).toLocaleString();
                document.getElementById('kpi-total-jobs').textContent = Number(d.totalJobs).toLocaleString();
                document.getElementById('kpi-active-jobs').textContent = `${d.activeJobs} công việc đang tuyển/chạy`;
                document.getElementById('kpi-pending-ekyc').textContent = d.pendingEkycCount;
                document.getElementById('kpi-pending-reports').textContent = d.pendingReportsCount;

                // Update badge numbers
                const ekycBadge = document.getElementById('badge-pending-ekyc');
                if (d.pendingEkycCount > 0) {
                    ekycBadge.textContent = d.pendingEkycCount;
                    ekycBadge.style.display = 'inline-block';
                } else {
                    ekycBadge.style.display = 'none';
                }

                const reportsBadge = document.getElementById('badge-pending-reports');
                if (d.pendingReportsCount > 0) {
                    reportsBadge.textContent = d.pendingReportsCount;
                    reportsBadge.style.display = 'inline-block';
                } else {
                    reportsBadge.style.display = 'none';
                }
            }
        })
        .catch(err => console.error('Error loading dashboard stats:', err));
}

// ================= 2. USERS =================
function loadUsers(search = '') {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Đang tải dữ liệu...</td></tr>';

    const url = search ? `${API_ADMIN_BASE}/users?search=${encodeURIComponent(search)}` : `${API_ADMIN_BASE}/users`;

    authFetch(url)
        .then(res => {
            if (res.code === 200 && res.data) {
                renderUsersTable(res.data);
            }
        })
        .catch(err => {
            console.error('Error loading users:', err);
            tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Lỗi khi tải danh sách người dùng!</td></tr>';
        });
}

function searchUsers() {
    const val = document.getElementById('user-search-input').value.trim();
    loadUsers(val);
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4">Không tìm thấy người dùng phù hợp.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => {
        const isBanned = u.status === 'BANNED';
        const isAdmin = u.role === 'ADMIN';

        let ekycBadge = u.identityVerified
            ? '<span class="badge badge-success"><i class="ti ti-check"></i> Đã định danh</span>'
            : '<span class="badge badge-secondary">Chưa định danh</span>';

        let statusBadge = isBanned
            ? '<span class="badge badge-danger">ĐÃ KHÓA</span>'
            : '<span class="badge badge-success">HOẠT ĐỘNG</span>';

        let roleBadge = isAdmin
            ? '<span class="badge badge-danger" style="background:#FEE2E2; color:#DC2626;">ADMIN</span>'
            : '<span class="badge badge-secondary">USER</span>';

        const workerVal = (u.workerScore !== null && u.workerScore !== undefined) ? u.workerScore : 100;
        const employerVal = (u.employerScore !== null && u.employerScore !== undefined) ? u.employerScore : 100;

        const scoreDisplay = `
            <div class="score-box">
                <div class="score-line">
                    <span class="score-role-label">Ứng viên:</span>
                    ${formatScoreBadge(workerVal)}
                </div>
                <div class="score-line">
                    <span class="score-role-label">Tuyển dụng:</span>
                    ${formatScoreBadge(employerVal)}
                </div>
            </div>
        `;

        let actionBtn = '';
        if (!isAdmin) {
            if (isBanned) {
                actionBtn = `<button class="btn btn-action-approve btn-sm" onclick="toggleUserStatus('${u.id}', '${escapeHtml(u.fullName || '')}', true)" title="Mở khóa tài khoản">
                    <i class="ti ti-lock-open"></i> Mở khóa
                </button>`;
            } else {
                actionBtn = `<button class="btn btn-action-delete btn-sm" onclick="toggleUserStatus('${u.id}', '${escapeHtml(u.fullName || '')}', false)" title="Khóa tài khoản">
                    <i class="ti ti-lock"></i> Khóa TK
                </button>`;
            }
        } else {
            actionBtn = `<span class="text-muted" style="font-size:12px;">Mặc định</span>`;
        }

        return `
            <tr>
                <td>
                    <div style="font-weight: 600;">${escapeHtml(u.fullName || 'Chưa cập nhật')}</div>
                    <small class="text-muted">ID: ${u.id.substring(0, 8)}...</small>
                </td>
                <td>
                    <div><strong>${escapeHtml(u.phone)}</strong></div>
                    <small class="text-muted">${escapeHtml(u.email || 'Chưa có email')}</small>
                </td>
                <td>${roleBadge}</td>
                <td>${u.currentMode === 'EMPLOYER' ? 'Nhà tuyển dụng' : 'Ứng viên'}</td>
                <td>${scoreDisplay}</td>
                <td>${ekycBadge}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    }).join('');
}

function toggleUserStatus(userId, userName, isUnban) {
    const actionText = isUnban ? 'MỞ KHÓA' : 'TẠM KHÓA';
    if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản của "${userName}"?`)) return;

    authFetch(`${API_ADMIN_BASE}/users/${userId}/toggle-status`, { method: 'PUT' })
        .then(res => {
            if (res.code === 200) {
                showToast(`Đã ${actionText.toLowerCase()} tài khoản thành công!`, 'success');
                const val = document.getElementById('user-search-input').value.trim();
                loadUsers(val);
                loadDashboardStats();
            } else {
                showToast(res.message || 'Lỗi khi cập nhật trạng thái', 'error');
            }
        })
        .catch(err => {
            console.error('Error toggling user status:', err);
            showToast('Lỗi khi thao tác với tài khoản', 'error');
        });
}

// ================= 3. EKYC =================
function filterEkyc(status) {
    currentEkycFilter = status;
    document.querySelectorAll('#tab-ekyc .subnav-btn').forEach(btn => {
        if (btn.getAttribute('data-ekyc-status') === status) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    loadEkycRecords(status);
}

function loadEkycRecords(status) {
    const container = document.getElementById('ekyc-cards-container');
    container.innerHTML = '<div class="empty-state">Đang tải hồ sơ eKYC...</div>';

    authFetch(`${API_ADMIN_BASE}/ekyc?status=${status}`)
        .then(res => {
            if (res.code === 200 && res.data) {
                renderEkycCards(res.data);
            }
        })
        .catch(err => {
            console.error('Error loading ekyc records:', err);
            container.innerHTML = '<div class="empty-state text-danger">Lỗi khi tải hồ sơ eKYC!</div>';
        });
}

function renderEkycCards(records) {
    const container = document.getElementById('ekyc-cards-container');
    if (!records || records.length === 0) {
        container.innerHTML = '<div class="empty-state">Không có hồ sơ eKYC nào trong mục này.</div>';
        return;
    }

    container.innerHTML = records.map(r => {
        const isPending = r.status === 'PENDING';
        let statusBadge = '';
        if (r.status === 'APPROVED') statusBadge = '<span class="badge badge-success">ĐÃ DUYỆT</span>';
        else if (r.status === 'REJECTED') statusBadge = '<span class="badge badge-danger">TỪ CHỐI</span>';
        else statusBadge = '<span class="badge badge-warning">CHỜ DUYỆT</span>';

        const frontResolved = resolveMediaUrl(r.idCardFrontUrl);
        const backResolved = resolveMediaUrl(r.idCardBackUrl);
        const faceResolved = resolveMediaUrl(r.faceImageUrl);

        const frontDrive = getDriveDirectViewUrl(r.idCardFrontUrl);
        const backDrive = getDriveDirectViewUrl(r.idCardBackUrl);
        const faceDrive = getDriveDirectViewUrl(r.faceImageUrl);

        let actionHtml = '';
        if (isPending) {
            actionHtml = `
                <div class="card-actions">
                    <button class="btn btn-reject" onclick="openRejectEkycModal('${r.id}')">
                        <i class="ti ti-x"></i> Từ chối
                    </button>
                    <button class="btn btn-approve" onclick="approveEkyc('${r.id}')">
                        <i class="ti ti-check"></i> Duyệt hồ sơ
                    </button>
                </div>
            `;
        }

        return `
            <div class="ekyc-card">
                <div class="card-top">
                    <div class="user-snippet">
                        <div class="user-avatar-sm">
                            <i class="ti ti-user"></i>
                        </div>
                        <div class="user-details">
                            <h4>${escapeHtml(r.userName)}</h4>
                            <p>${escapeHtml(r.userPhone)}</p>
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div class="ekyc-images-row">
                    <div class="thumb-box" onclick="zoomImage('${frontResolved}', 'Mặt trước CCCD - ${escapeHtml(r.userName)}', '${frontDrive}')" title="Bấm để xem ảnh phóng to">
                        <img src="${frontResolved}" alt="Mặt trước CCCD" onerror="this.onerror=null;this.src='/asset/antgo-icon.svg'">
                        <span class="thumb-label">CCCD Trước</span>
                        ${frontDrive ? `
                            <div class="thumb-actions" onclick="event.stopPropagation()">
                                <a href="${frontDrive}" target="_blank" class="thumb-action-icon" title="Mở trực tiếp trên Google Drive">
                                    <i class="ti ti-external-link"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    <div class="thumb-box" onclick="zoomImage('${backResolved}', 'Mặt sau CCCD - ${escapeHtml(r.userName)}', '${backDrive}')" title="Bấm để xem ảnh phóng to">
                        <img src="${backResolved}" alt="Mặt sau CCCD" onerror="this.onerror=null;this.src='/asset/antgo-icon.svg'">
                        <span class="thumb-label">CCCD Sau</span>
                        ${backDrive ? `
                            <div class="thumb-actions" onclick="event.stopPropagation()">
                                <a href="${backDrive}" target="_blank" class="thumb-action-icon" title="Mở trực tiếp trên Google Drive">
                                    <i class="ti ti-external-link"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    <div class="thumb-box" onclick="zoomImage('${faceResolved}', 'Chân dung - ${escapeHtml(r.userName)}', '${faceDrive}')" title="Bấm để xem ảnh phóng to">
                        <img src="${faceResolved}" alt="Chân dung" onerror="this.onerror=null;this.src='/asset/antgo-icon.svg'">
                        <span class="thumb-label">Chân dung</span>
                        ${faceDrive ? `
                            <div class="thumb-actions" onclick="event.stopPropagation()">
                                <a href="${faceDrive}" target="_blank" class="thumb-action-icon" title="Mở trực tiếp trên Google Drive">
                                    <i class="ti ti-external-link"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div style="font-size: 12px; color: var(--text-muted);">
                    Ngày gửi: ${formatDate(r.createdAt)}
                </div>

                ${actionHtml}
            </div>
        `;
    }).join('');
}

function zoomImage(url, title = 'Chi tiết hình ảnh', directUrl = '') {
    if (!url) return;
    const imgEl = document.getElementById('preview-image-element');
    const titleEl = document.getElementById('preview-image-title');
    const driveLink = document.getElementById('preview-image-drive-link');

    if (imgEl) imgEl.src = url;
    if (titleEl) {
        titleEl.innerHTML = `<i class="ti ti-photo"></i> ${escapeHtml(title)}`;
    }
    if (driveLink) {
        if (directUrl) {
            driveLink.href = directUrl;
            driveLink.style.display = 'inline-flex';
        } else {
            driveLink.style.display = 'none';
        }
    }
    openModal('modal-image-preview');
}

function approveEkyc(ekycId) {
    if (!confirm('Xác nhận phê duyệt hồ sơ eKYC này và cấp tích xanh cho người dùng?')) return;

    authFetch(`${API_ADMIN_BASE}/ekyc/${ekycId}/process`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'APPROVED' })
    })
    .then(res => {
        if (res.code === 200) {
            showToast('Đã duyệt eKYC thành công!', 'success');
            loadEkycRecords(currentEkycFilter);
            loadDashboardStats();
        } else {
            showToast(res.message || 'Lỗi khi duyệt eKYC', 'error');
        }
    })
    .catch(err => {
        console.error('Error approving eKYC:', err);
        showToast('Lỗi hệ thống khi duyệt eKYC', 'error');
    });
}

function openRejectEkycModal(ekycId) {
    document.getElementById('reject-ekyc-id').value = ekycId;
    document.getElementById('reject-ekyc-reason').value = '';
    openModal('modal-reject-ekyc');
}

function submitRejectEkyc() {
    const ekycId = document.getElementById('reject-ekyc-id').value;
    const reason = document.getElementById('reject-ekyc-reason').value.trim();

    authFetch(`${API_ADMIN_BASE}/ekyc/${ekycId}/process`, {
        method: 'POST',
        body: JSON.stringify({ decision: 'REJECTED', note: reason })
    })
    .then(res => {
        if (res.code === 200) {
            closeModal('modal-reject-ekyc');
            showToast('Đã từ chối duyệt hồ sơ eKYC!', 'info');
            loadEkycRecords(currentEkycFilter);
            loadDashboardStats();
        } else {
            showToast(res.message || 'Lỗi xử lý', 'error');
        }
    })
    .catch(err => {
        console.error('Error rejecting eKYC:', err);
        showToast('Lỗi khi từ chối eKYC', 'error');
    });
}

// ================= 4. REPORTS =================
function filterReports(status) {
    currentReportFilter = status;
    document.querySelectorAll('#tab-reports .subnav-btn').forEach(btn => {
        if (btn.getAttribute('data-report-status') === status) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    loadReports(status);
}

function loadReports(status) {
    const container = document.getElementById('reports-cards-container');
    container.innerHTML = '<div class="empty-state">Đang tải danh sách khiếu nại...</div>';

    authFetch(`${API_ADMIN_BASE}/reports?status=${status}`)
        .then(res => {
            if (res.code === 200 && res.data) {
                reportsDataCache = res.data;
                renderReportCards(res.data);
            }
        })
        .catch(err => {
            console.error('Error loading reports:', err);
            container.innerHTML = '<div class="empty-state text-danger">Lỗi khi tải báo cáo vi phạm!</div>';
        });
}

function renderReportCards(reports) {
    const container = document.getElementById('reports-cards-container');
    if (!reports || reports.length === 0) {
        container.innerHTML = '<div class="empty-state">Không có khiếu nại hoặc báo cáo vi phạm nào.</div>';
        return;
    }

    container.innerHTML = reports.map(r => {
        const isPending = (r.status === 'PENDING');
        let statusBadge = '';
        if (r.status === 'RESOLVED') statusBadge = '<span class="badge badge-success">ĐÃ XỬ PHẠT</span>';
        else if (r.status === 'DISMISSED' || r.status === 'REJECTED') statusBadge = '<span class="badge badge-secondary">ĐÃ BÁC BỎ</span>';
        else statusBadge = '<span class="badge badge-warning">CHỜ XỬ LÝ</span>';

        const evidenceList = parseEvidenceList(r.evidenceUrls);
        const evidenceHtml = renderEvidenceHtml(evidenceList, r.reporterName);
        const timeText = r.createdAt ? formatDate(r.createdAt) : 'Ghi nhận trong hệ thống';

        // Khối hiển thị chi tiết ca làm & số tiền cần thanh toán
        let shiftInfoHtml = '';
        if (r.startTime || r.endTime || r.hourlyRate || r.paymentAmount) {
            const timeRangeStr = (r.startTime && r.endTime)
                ? `${formatDate(r.startTime)} &rarr; ${formatDate(r.endTime)}`
                : (r.startTime ? formatDate(r.startTime) : 'Chưa xác định');

            let actualCheckHtml = '';
            if (r.checkInAt || r.checkOutAt) {
                actualCheckHtml = `
                    <div style="font-size: 11.5px; color: #475569; margin-top: 4px; padding: 4px 8px; background: #E2E8F0; border-radius: 4px;">
                        <i class="ti ti-map-pin"></i> <strong>Thực tế:</strong>
                        ${r.checkInAt ? `Vào: ${formatDate(r.checkInAt)}` : 'Chưa check-in'} &bull; 
                        ${r.checkOutAt ? `Ra: ${formatDate(r.checkOutAt)}` : 'Chưa check-out'}
                    </div>
                `;
            }

            shiftInfoHtml = `
                <div style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: var(--radius-sm); padding: 10px 12px; margin-top: 8px; font-size: 12.5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                        <div>
                            <span style="color: var(--text-muted);"><i class="ti ti-calendar-time"></i> <strong>Lịch ca làm:</strong></span>
                            <span style="font-weight: 600; color: #1e293b;">${timeRangeStr}</span>
                        </div>
                        ${r.hourlyRate ? `
                        <div>
                            <span style="color: var(--text-muted);"><i class="ti ti-coin"></i> Lương:</span>
                            <strong style="color: var(--primary-orange);">${formatCurrency(r.hourlyRate)}/h</strong>
                        </div>` : ''}
                    </div>
                    ${actualCheckHtml}
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #CBD5E1; padding-top: 6px; margin-top: 6px;">
                        <span style="font-weight: 600; color: var(--text-main);"><i class="ti ti-cash"></i> Số tiền cần thanh toán:</span>
                        <strong style="font-size: 15px; color: #dc2626;">${formatCurrency(r.paymentAmount)}</strong>
                    </div>
                </div>
            `;
        }

        let actionHtml = '';
        if (isPending) {
            actionHtml = `
                <div class="card-actions">
                    <button class="btn btn-action-edit" style="width: 100%; justify-content: center; padding: 9px 14px; font-size: 13px;" onclick="openResolveReportModal('${r.id}')">
                        <i class="ti ti-gavel"></i> Xem xét & Phán quyết
                    </button>
                </div>
            `;
        }

        return `
            <div class="report-card">
                <div class="card-top">
                    <div>
                        <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Công việc liên quan:</div>
                        <h4 style="font-size: 15px; margin-top: 2px;">${escapeHtml(r.jobTitle || 'N/A')}</h4>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div style="background: #FAFAFA; border: 1px solid var(--border-line); border-radius: var(--radius-sm); padding: 12px; font-size: 13px;">
                    <div><strong>Người khiếu nại:</strong> ${escapeHtml(r.reporterName)} (${escapeHtml(r.reporterPhone)})</div>
                    <div style="margin-top: 4px; color: var(--color-danger);"><strong>Đối tượng bị báo cáo:</strong> ${escapeHtml(r.reportedName)} (${escapeHtml(r.reportedPhone)})</div>
                </div>

                ${shiftInfoHtml}

                <div>
                    <strong style="font-size: 13px; color: var(--black-main);">Nội dung phản ánh:</strong>
                    <p style="margin-top: 4px; color: var(--text-secondary); background: #FFF7ED; padding: 10px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary-orange);">
                        ${escapeHtml(r.reason)}
                    </p>
                    ${evidenceHtml}
                </div>

                <div style="font-size: 12px; color: var(--text-muted);">
                    Thời gian: ${timeText}
                </div>

                ${actionHtml}
            </div>
        `;
    }).join('');
}

function openResolveReportModal(reportId) {
    const report = reportsDataCache.find(r => r.id === reportId);
    if (!report) return;

    const timeRangeStr = (report.startTime && report.endTime)
        ? `${formatDate(report.startTime)} &rarr; ${formatDate(report.endTime)}`
        : (report.startTime ? formatDate(report.startTime) : 'Chưa xác định');

    document.getElementById('resolve-report-id').value = reportId;
    document.getElementById('resolve-report-summary').innerHTML = `
        <div style="margin-bottom: 4px;"><strong>Người báo cáo:</strong> ${escapeHtml(report.reporterName)} (${escapeHtml(report.reporterPhone)})</div>
        <div style="margin-bottom: 4px;"><strong>Người bị báo cáo:</strong> <span class="text-danger font-bold">${escapeHtml(report.reportedName)} (${escapeHtml(report.reportedPhone)})</span></div>
        <div style="margin-bottom: 6px;"><strong>Công việc:</strong> ${escapeHtml(report.jobTitle)}</div>
        <div style="background: #F1F5F9; border: 1px solid #CBD5E1; padding: 8px 12px; border-radius: 6px; font-size: 12.5px; margin-bottom: 8px;">
            <div><i class="ti ti-calendar-time"></i> <strong>Lịch ca làm:</strong> ${timeRangeStr}</div>
            ${(report.checkInAt || report.checkOutAt) ? `
                <div style="margin-top: 3px; color: #475569;"><i class="ti ti-map-pin"></i> <strong>Thực tế:</strong> ${report.checkInAt ? `Vào: ${formatDate(report.checkInAt)}` : 'Chưa check-in'} &bull; ${report.checkOutAt ? `Ra: ${formatDate(report.checkOutAt)}` : 'Chưa check-out'}</div>
            ` : ''}
            <div style="margin-top: 5px; display: flex; justify-content: space-between; border-top: 1px dashed #CBD5E1; padding-top: 5px;">
                <span><i class="ti ti-coin"></i> <strong>Đơn giá:</strong> ${formatCurrency(report.hourlyRate)}/h</span>
                <span><i class="ti ti-cash"></i> <strong>Cần thanh toán:</strong> <strong style="color: #dc2626;">${formatCurrency(report.paymentAmount)}</strong></span>
            </div>
        </div>
        <div style="margin-top: 6px; font-style: italic; color: var(--text-secondary); background: #FFF7ED; padding: 8px 10px; border-radius: 4px; border-left: 3px solid var(--primary-orange);">
            "${escapeHtml(report.reason)}"
        </div>
    `;
    document.getElementById('penalty-points').value = 10;
    document.getElementById('resolve-report-note').value = '';
    togglePenaltyInput(true);
    openModal('modal-resolve-report');
}

function togglePenaltyInput(isResolved) {
    const group = document.getElementById('penalty-group');
    if (group) {
        group.style.display = isResolved ? 'block' : 'none';
    }
}

function submitResolveReport() {
    const reportId = document.getElementById('resolve-report-id').value;
    if (!reportId) {
        showToast('Không tìm thấy mã khiếu nại!', 'error');
        return;
    }
    const decisionEl = document.querySelector('input[name="report-decision"]:checked');
    if (!decisionEl) {
        showToast('Vui lòng chọn hình thức xử lý!', 'warning');
        return;
    }
    const decision = decisionEl.value;
    const penaltyPoints = parseInt(document.getElementById('penalty-points').value) || 0;
    const note = document.getElementById('resolve-report-note').value.trim();

    const submitBtn = document.getElementById('btn-confirm-resolve-report');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ti ti-loader"></i> Đang thực thi...';
    }

    authFetch(`${API_ADMIN_BASE}/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
            decision: decision,
            penaltyPoints: decision === 'RESOLVED' ? penaltyPoints : 0,
            note: note
        })
    })
    .then(res => {
        if (res.code === 200) {
            closeModal('modal-resolve-report');
            showToast('Đã xử lý khiếu nại thành công!', 'success');
            loadReports(currentReportFilter);
            loadDashboardStats();
        } else {
            showToast(res.message || 'Lỗi khi xử lý khiếu nại', 'error');
        }
    })
    .catch(err => {
        console.error('Error resolving report:', err);
        showToast('Lỗi xử lý khiếu nại: ' + (err.message || 'Lỗi kết nối'), 'error');
    })
    .finally(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Thực thi phán quyết';
        }
    });
}

// ================= 5. CATEGORIES =================
function loadCategories() {
    const tbody = document.getElementById('categories-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Đang tải danh mục...</td></tr>';

    authFetch(`${API_ADMIN_BASE}/categories`)
        .then(res => {
            if (res.code === 200 && res.data) {
                renderCategoriesTable(res.data);
            }
        })
        .catch(err => {
            console.error('Error loading categories:', err);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Lỗi khi tải danh mục!</td></tr>';
        });
}

function renderCategoriesTable(categories) {
    const tbody = document.getElementById('categories-table-body');
    if (!categories || categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Chưa có danh mục nào. Hãy thêm danh mục mới!</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map((cat, idx) => `
        <tr>
            <td style="width: 60px; font-weight: 600;">#${idx + 1}</td>
            <td>
                <div style="font-weight: 700; font-size: 15px;">${escapeHtml(cat.name)}</div>
            </td>
            <td>
                <span class="badge badge-info">${cat.jobCount || 0} bài đăng</span>
            </td>
            <td style="width: 170px;">
                <div class="table-actions">
                    <button class="btn btn-action-edit btn-sm" onclick="openEditCategoryModal('${cat.id}', '${escapeHtml(cat.name)}')" title="Sửa tên danh mục">
                        <i class="ti ti-edit"></i> Sửa
                    </button>
                    <button class="btn btn-action-delete btn-sm" onclick="deleteCategory('${cat.id}', '${escapeHtml(cat.name)}', ${cat.jobCount || 0})" title="Xóa danh mục">
                        <i class="ti ti-trash"></i> Xóa
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openAddCategoryModal() {
    document.getElementById('modal-category-title').innerHTML = '<i class="ti ti-plus"></i> Thêm danh mục nghề mới';
    document.getElementById('category-id').value = '';
    document.getElementById('category-name-input').value = '';
    document.getElementById('err-category-name').style.display = 'none';
    openModal('modal-category');
}

function openEditCategoryModal(id, name) {
    document.getElementById('modal-category-title').innerHTML = '<i class="ti ti-edit"></i> Chỉnh sửa danh mục nghề';
    document.getElementById('category-id').value = id;
    document.getElementById('category-name-input').value = name;
    document.getElementById('err-category-name').style.display = 'none';
    openModal('modal-category');
}

function submitSaveCategory() {
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name-input').value.trim();
    const errEl = document.getElementById('err-category-name');

    if (!name) {
        errEl.textContent = 'Vui lòng nhập tên danh mục!';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';

    const url = id ? `${API_ADMIN_BASE}/categories/${id}` : `${API_ADMIN_BASE}/categories`;
    const method = id ? 'PUT' : 'POST';

    authFetch(url, {
        method: method,
        body: JSON.stringify({ name: name })
    })
    .then(res => {
        if (res.code === 200 || res.code === 201) {
            closeModal('modal-category');
            showToast('Lưu danh mục thành công!', 'success');
            loadCategories();
        } else {
            errEl.textContent = res.message || 'Lỗi khi lưu danh mục';
            errEl.style.display = 'block';
        }
    })
    .catch(err => {
        console.error('Error saving category:', err);
        errEl.textContent = 'Lỗi kết nối khi lưu danh mục';
        errEl.style.display = 'block';
    });
}

function deleteCategory(id, name, jobCount) {
    if (jobCount > 0) {
        alert(`Không thể xóa danh mục "${name}" vì đang có ${jobCount} công việc liên kết!`);
        return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}"?`)) return;

    authFetch(`${API_ADMIN_BASE}/categories/${id}`, { method: 'DELETE' })
        .then(res => {
            if (res.code === 200) {
                showToast('Đã xóa danh mục thành công!', 'success');
                loadCategories();
            } else {
                showToast(res.message || 'Không thể xóa danh mục', 'error');
            }
        })
        .catch(err => {
            console.error('Error deleting category:', err);
            showToast('Lỗi khi xóa danh mục', 'error');
        });
}

// ================= UTILITIES =================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

function logoutAdmin() {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi trang Quản trị?')) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('isAdmin');
        window.location.href = '/interface/authentication';
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'ti-check';
    if (type === 'error') icon = 'ti-alert-circle';
    else if (type === 'warning') icon = 'ti-alert-triangle';
    else if (type === 'info') icon = 'ti-info-circle';

    toast.innerHTML = `<i class="ti ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return isoStr;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
