const API_BASE_URL = 'http://localhost:8083/api/v1/profile';
    let currentProfileData = null;

    // BIẾN TOÀN CỤC CHO WEBSOCKET
    let stompClient = null;
    let watchId = null;

    function renderTopNav(mode) {
        const nav = document.getElementById('profile-topnav');
        if (!nav) return;
        if (mode === 'EMPLOYER') {
            nav.innerHTML = `
                <a href="/interface/managejob" class="header-brand" title="AntGo - Nhà tuyển dụng">
                    <img src="/asset/antgo-icon.svg" alt="AntGo" class="header-brand-icon-img">
                    <span class="brand-text">Ant<span class="brand-highlight">Go</span></span>
                </a>
                <div class="header-nav">
                    <a href="/interface/managejob" class="nav-btn"><i class="ti ti-briefcase"></i> Quản lý việc làm</a>
                    <a href="/interface/createjob" class="nav-btn"><i class="ti ti-plus"></i> Đăng tin việc</a>
                    <a href="/interface/profile" class="nav-btn active"><i class="ti ti-user"></i> Hồ sơ</a>
                    <button onclick="logout()" class="nav-btn nav-btn-logout"><i class="ti ti-logout"></i> Đăng xuất</button>
                </div>
            `;
        } else {
            nav.innerHTML = `
                <a href="/interface/manageapplication" class="header-brand" title="AntGo - Ứng viên">
                    <img src="/asset/antgo-icon.svg" alt="AntGo" class="header-brand-icon-img">
                    <span class="brand-text">Ant<span class="brand-highlight">Go</span></span>
                </a>
                <div class="header-nav">
                    <a href="/interface/manageapplication" class="nav-btn"><i class="ti ti-file-text"></i> Công việc của tôi</a>
                    <a href="/interface/findjob" class="nav-btn"><i class="ti ti-radar"></i> Bản đồ tìm việc</a>
                    <a href="/interface/scanner" class="nav-btn"><i class="ti ti-qrcode"></i> Quét QR</a>
                    <a href="/interface/profile" class="nav-btn active"><i class="ti ti-user"></i> Hồ sơ</a>
                    <button onclick="logout()" class="nav-btn nav-btn-logout"><i class="ti ti-logout"></i> Đăng xuất</button>
                </div>
            `;
        }
    }

    document.addEventListener('DOMContentLoaded', function() {
        const savedMode = localStorage.getItem('currentMode') || 'WORKER';
        renderTopNav(savedMode);
        loadProfileData();
    });

    // BIẾN TOÀN CỤC CHO AVATAR
    let selectedAvatarFile = null;

    function extractDriveFileId(str) {
        if (!str) return null;
        str = str.trim();
        // TH1: Mã Drive thuần dạng ID (ví dụ: 1yXCS3F3rHTFwit5Eq8XNs4YHc-DxuhRa)
        if (/^[a-zA-Z0-9_-]{25,50}$/.test(str)) {
            return str;
        }
        // TH2: URL Drive chứa /d/ID hoặc id=ID
        const match = str.match(/\/d\/([a-zA-Z0-9_-]{25,50})/) || str.match(/[?&]id=([a-zA-Z0-9_-]{25,50})/);
        return match ? match[1] : null;
    }

    function resolveAvatarUrl(urlOrId) {
        if (!urlOrId || !urlOrId.trim()) return '';
        const trimmed = urlOrId.trim();

        const driveId = extractDriveFileId(trimmed);
        if (driveId) {
            // Sử dụng streaming qua backend (đã permitAll)
            return `http://localhost:8083/api/v1/messages/media/${driveId}`;
        }

        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
            return trimmed;
        }

        return trimmed;
    }

    function renderUserAvatar(avatarUrl, fullName) {
        const img = document.getElementById('user-avatar-img');
        const text = document.getElementById('user-avatar-text');
        const initial = (fullName || 'U').trim().charAt(0).toUpperCase() || 'U';
        if (text) text.textContent = initial;

        if (avatarUrl && avatarUrl.trim()) {
            const resolved = resolveAvatarUrl(avatarUrl);
            if (img) {
                img.src = resolved;
                img.style.display = 'block';
            }
            if (text) text.style.display = 'none';
        } else {
            if (img) img.style.display = 'none';
            if (text) text.style.display = 'flex';
        }
    }

    function onAvatarLoadError() {
        const img = document.getElementById('user-avatar-img');
        const text = document.getElementById('user-avatar-text');
        if (!img) return;

        const currentSrc = img.src || '';
        const driveId = extractDriveFileId(currentSrc);
        if (driveId) {
            if (currentSrc.includes('api/v1/messages/media/')) {
                // Fallback sang Google CDN trực tiếp nếu backend chưa chạy hoặc lỗi
                img.src = `https://lh3.googleusercontent.com/d/${driveId}`;
                return;
            } else if (currentSrc.includes('lh3.googleusercontent.com')) {
                // Fallback sang thumbnail của Google Drive
                img.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
                return;
            }
        }

        img.style.display = 'none';
        if (text) text.style.display = 'flex';
    }

    function showModalAvatarPreview(src) {
        const preview = document.getElementById('modal-avatar-preview');
        const placeholder = document.getElementById('modal-avatar-placeholder');
        if (!preview || !placeholder) return;

        if (src && src.trim()) {
            preview.src = src;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }

    function onModalAvatarError() {
        const preview = document.getElementById('modal-avatar-preview');
        const placeholder = document.getElementById('modal-avatar-placeholder');
        if (!preview) return;

        const currentSrc = preview.src || '';
        const driveId = extractDriveFileId(currentSrc);
        if (driveId) {
            if (currentSrc.includes('api/v1/messages/media/')) {
                preview.src = `https://lh3.googleusercontent.com/d/${driveId}`;
                return;
            } else if (currentSrc.includes('lh3.googleusercontent.com')) {
                preview.src = `https://drive.google.com/thumbnail?id=${driveId}&sz=w400`;
                return;
            }
        }

        preview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }

    function handleAvatarFileSelect(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (!file.type.startsWith('image/')) {
                alert('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, JPEG, WEBP)!');
                input.value = '';
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('Kích thước ảnh không được vượt quá 10MB!');
                input.value = '';
                return;
            }

            selectedAvatarFile = file;
            const fileNameSpan = document.getElementById('avatar-file-name');
            if (fileNameSpan) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
                fileNameSpan.textContent = `✓ Đã chọn: ${file.name} (${sizeMb} MB)`;
                fileNameSpan.style.display = 'inline-block';
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                showModalAvatarPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }

    function applySampleAvatar(driveId) {
        const urlInput = document.getElementById('input-avatar-url');
        if (urlInput) {
            urlInput.value = driveId;
        }
        selectedAvatarFile = null;
        const fileInput = document.getElementById('input-avatar-file');
        if (fileInput) fileInput.value = '';
        const fileNameSpan = document.getElementById('avatar-file-name');
        if (fileNameSpan) fileNameSpan.style.display = 'none';

        previewAvatarFromInput();
    }

    function previewAvatarFromInput() {
        const urlInput = document.getElementById('input-avatar-url');
        if (!urlInput) return;
        const val = urlInput.value.trim();

        if (val) {
            selectedAvatarFile = null;
            const fileInput = document.getElementById('input-avatar-file');
            if (fileInput) fileInput.value = '';
            const fileNameSpan = document.getElementById('avatar-file-name');
            if (fileNameSpan) fileNameSpan.style.display = 'none';

            const resolved = resolveAvatarUrl(val);
            showModalAvatarPreview(resolved);
        } else {
            if (!selectedAvatarFile) {
                showModalAvatarPreview(null);
            }
        }
    }

    // 1. GỌI API LẤY DỮ LIỆU PROFILE
    function loadProfileData() {
        const token = localStorage.getItem('accessToken');
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        fetch(API_BASE_URL, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => {
                if (res.status === 401) {
                    localStorage.clear();
                    window.location.href = "/interface/authentication";
                    throw new Error("Phiên đăng nhập hết hạn");
                }
                return res.json();
            })
            .then(data => {
                if (data.code === 200) {
                    const p = data.data;
                    currentProfileData = p;

                    // Họ tên, Avatar, Liên hệ
                    const fullName = p.fullName || 'Người dùng AntGo';
                    document.getElementById('display-fullname').textContent = fullName;
                    renderUserAvatar(p.avatarUrl, fullName);
                    if (p.avatarUrl) {
                        localStorage.setItem('userAvatar', p.avatarUrl);
                    }

                    document.getElementById('display-phone').innerHTML = `<i class="ti ti-phone"></i> ${p.phone || 'Chưa cập nhật'}`;
                    document.getElementById('display-email').innerHTML = `<i class="ti ti-mail"></i> ${p.email || 'Chưa cập nhật email'}`;

                    // eKYC Banner Status
                    const ekycBanner = document.getElementById('ekyc-banner');
                    const ekycIcon = document.getElementById('ekyc-banner-icon');
                    const ekycText = document.getElementById('ekyc-banner-text');
                    const btnGoEkyc = document.getElementById('btn-go-ekyc');

                    if (p.identityVerified) {
                        ekycBanner.className = 'ekyc-status-banner verified';
                        ekycIcon.className = 'ti ti-shield-check-filled';
                        ekycIcon.style.color = '#059669';
                        ekycText.innerHTML = '<strong>Đã định danh eKYC CCCD thành công.</strong> Hồ sơ của bạn đã được xác thực an toàn trên hệ thống.';
                        btnGoEkyc.style.display = 'none';
                    } else {
                        ekycBanner.className = 'ekyc-status-banner unverified';
                        ekycIcon.className = 'ti ti-shield-alert';
                        ekycIcon.style.color = '#d97706';
                        ekycText.innerHTML = '<strong>Chưa xác thực CCCD.</strong> Hãy xác thực eKYC để tăng độ uy tín và mở khóa toàn bộ quyền lợi.';
                        btnGoEkyc.style.display = 'inline-flex';
                    }

                    // Điểm số & Thanh tiến trình
                    const wScore = p.workerScore != null ? p.workerScore : 100;
                    const eScore = p.employerScore != null ? p.employerScore : 100;
                    document.getElementById('worker-score').textContent = wScore;
                    document.getElementById('employer-score').textContent = eScore;
                    document.getElementById('worker-score-bar').style.width = Math.min(Math.max(wScore, 0), 100) + '%';
                    document.getElementById('employer-score-bar').style.width = Math.min(Math.max(eScore, 0), 100) + '%';

                    // Thông tin Nhà tuyển dụng
                    document.getElementById('employer-name').textContent = p.employerName || 'Chưa cập nhật tên công ty/cửa hàng';
                    document.getElementById('employer-tax').innerHTML = `<i class="ti ti-file-certificate" style="color: var(--text-secondary);"></i> ${p.taxId || 'Chưa cập nhật MST'}`;

                    // Danh sách Kỹ năng Ứng viên
                    const skillsContainer = document.getElementById('display-worker-skills');
                    if (p.skills && p.skills.trim()) {
                        const skillArray = p.skills.split(',').map(s => s.trim()).filter(s => s);
                        skillsContainer.innerHTML = skillArray.map(s => `<span class="skill-tag"><i class="ti ti-check" style="font-size:12px;color:var(--text-success);"></i> ${s}</span>`).join('');
                    } else {
                        skillsContainer.innerHTML = '<span style="font-size:13px;font-style:italic;color:var(--text-secondary)">Chưa cập nhật kỹ năng chuyên môn</span>';
                    }

                    // Trạng thái tìm việc (Availability)
                    const toggle = document.getElementById('toggle-available');
                    const availDesc = document.getElementById('status-availability-desc');
                    if (toggle) {
                        toggle.checked = p.isAvailable;
                        if (availDesc) {
                            availDesc.textContent = p.isAvailable 
                                ? 'Đang bật tìm việc · Hệ thống đang định vị GPS để NTD tìm thấy bạn' 
                                : 'Đang tắt tìm việc · Bạn tạm thời ẩn khỏi bản đồ tìm thợ';
                        }

                        // Nếu lúc tải lại trang mà trạng thái là bật và đang ở WORKER -> Tự động kết nối lại WS
                        const currentUpper = (p.currentMode || 'WORKER').toUpperCase();
                        if (p.isAvailable && currentUpper === 'WORKER') {
                            connectWebSocket();
                        }
                    }

                    const currentModeStr = (p.currentMode || 'WORKER').toLowerCase();
                    localStorage.setItem('currentMode', currentModeStr.toUpperCase());
                    renderTopNav(currentModeStr.toUpperCase());
                    setMode(currentModeStr, true);

                    // Tải điểm đánh giá và nhận xét từ đối tác
                    loadUserReviews();
                }
            })
            .catch(err => console.error('Lỗi tải dữ liệu profile:', err));
    }

    // 2. CHUYỂN CHẾ ĐỘ (UI + GỌI API)
    function setMode(m, isInit = false) {
        var btnWorker = document.getElementById('mode-worker');
        var btnEmployer = document.getElementById('mode-employer');
        var cardWorker = document.getElementById('card-worker');
        var cardEmployer = document.getElementById('card-employer');
        var roleBadge = document.getElementById('display-role-badge');

        if(m === 'worker') {
            btnWorker.style.background = 'var(--fill-primary)'; 
            btnWorker.style.color = 'var(--on-primary)'; 
            btnWorker.style.fontWeight = '600';
            btnEmployer.style.background = 'none'; 
            btnEmployer.style.color = 'var(--text-secondary)'; 
            btnEmployer.style.fontWeight = '500';
            
            cardWorker.className = 'profile-card active'; 
            cardEmployer.className = 'profile-card inactive';

            if (roleBadge) {
                roleBadge.textContent = 'Người lao động';
                roleBadge.style.background = 'var(--bg-accent-muted)';
                roleBadge.style.color = 'var(--text-accent)';
            }
        } else {
            btnEmployer.style.background = 'var(--fill-primary)'; 
            btnEmployer.style.color = 'var(--on-primary)'; 
            btnEmployer.style.fontWeight = '600';
            btnWorker.style.background = 'none'; 
            btnWorker.style.color = 'var(--text-secondary)'; 
            btnWorker.style.fontWeight = '500';

            cardEmployer.className = 'profile-card active'; 
            cardWorker.className = 'profile-card inactive';

            if (roleBadge) {
                roleBadge.textContent = 'Nhà tuyển dụng';
                roleBadge.style.background = '#fef3c7';
                roleBadge.style.color = '#92400e';
            }
            disconnectWebSocket(); // Dừng bắn GPS worker khi sang Nhà tuyển dụng
        }

        localStorage.setItem('currentMode', m.toUpperCase());
        renderTopNav(m.toUpperCase());
        if (typeof renderReviewsForCurrentMode === 'function') {
            renderReviewsForCurrentMode();
        }

        if (!isInit) {
            const token = localStorage.getItem('accessToken');
            fetch(`${API_BASE_URL}/mode?mode=${m.toUpperCase()}`, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            })
                .then(res => {
                    if (res.status === 403) {
                        alert("Bạn không có quyền chuyển sang chế độ này!");
                        throw new Error("403 Forbidden");
                    }
                    return res.json();
                })
                .then(data => {
                    if(data.code !== 200) alert('Lỗi: ' + data.message);
                    else {
                        localStorage.setItem('currentMode', m.toUpperCase());
                        renderTopNav(m.toUpperCase());
                    }
                })
                .catch(err => console.error(err));
        }
    }

    // ==========================================
    // KHỐI LOGIC WEBSOCKET & THEO DÕI GPS
    // ==========================================
    function connectWebSocket() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        // Kết nối đến cổng WebSocket
        let socket = new SockJS('http://localhost:8083/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;

        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function (frame) {
            console.log('Đã kết nối WebSocket thành công');
            startTrackingGPS();
        }, function (error) {
            console.error('Lỗi kết nối WebSocket: ', error);
        });
    }

    function startTrackingGPS() {
        if (!navigator.geolocation) {
            console.warn("Thiết bị hoặc trình duyệt không hỗ trợ Geolocation.");
            const availDesc = document.getElementById('status-availability-desc');
            if (availDesc) {
                availDesc.innerHTML = `<span style="color:#ef4444;"><i class="ti ti-alert-circle"></i> Trình duyệt không hỗ trợ định vị GPS</span>`;
            }
            return;
        }

        const handlePositionSuccess = (position) => {
            let lat = position.coords.latitude;
            let lng = position.coords.longitude;

            let payload = JSON.stringify({ 'longitude': lng, 'latitude': lat });
            if (stompClient && stompClient.connected) {
                stompClient.send("/app/locationworker", {}, payload);
            }

            console.log(`Đã bắn tọa độ lên Redis: [Kinh độ: ${lng}, Vĩ độ: ${lat}]`);
            const availDesc = document.getElementById('status-availability-desc');
            if (availDesc) {
                availDesc.innerHTML = `<span style="color:#10b981;"><i class="ti ti-point-filled"></i> Đang bật tìm việc · Đã đồng bộ vị trí (${lat.toFixed(4)}, ${lng.toFixed(4)})</span>`;
            }
        };

        const handlePositionError = (error) => {
            console.warn("Lỗi định vị GPS:", error.code, error.message);
            const availDesc = document.getElementById('status-availability-desc');
            if (!availDesc) return;

            if (error.code === 1) { // PERMISSION_DENIED
                availDesc.innerHTML = `<span style="color:#ef4444;"><i class="ti ti-alert-triangle"></i> Chưa cấp quyền vị trí. Nhấp vào icon ổ khóa cạnh URL để Cho phép (Allow) vị trí.</span>`;
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                // Thử định vị mạng fallback cho máy tính không có chip GPS phần cứng
                navigator.geolocation.getCurrentPosition(
                    handlePositionSuccess,
                    () => {
                        availDesc.innerHTML = `<span style="color:#f59e0b;"><i class="ti ti-info-circle"></i> Không thể xác định tọa độ GPS chính xác trên thiết bị này.</span>`;
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
                );
            } else if (error.code === 3) { // TIMEOUT
                availDesc.innerHTML = `<span style="color:#f59e0b;"><i class="ti ti-clock"></i> Quá thời gian định vị GPS. Đang tiếp tục thử lại...</span>`;
            }
        };

        watchId = navigator.geolocation.watchPosition(
            handlePositionSuccess,
            handlePositionError,
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
        );
    }

    function disconnectWebSocket() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        if (stompClient !== null) {
            stompClient.disconnect();
            console.log("Đã ngắt kết nối WebSocket, dừng gửi GPS.");
            stompClient = null;
        }
        const availDesc = document.getElementById('status-availability-desc');
        if (availDesc) {
            availDesc.textContent = 'Đang tắt tìm việc · Bạn tạm thời ẩn khỏi bản đồ tìm thợ';
        }
    }

    // 3. BẬT/TẮT TÌM VIỆC
    function toggleAvailability(checkboxEl) {
        const token = localStorage.getItem('accessToken');
        const isReady = checkboxEl.checked;
        const availDesc = document.getElementById('status-availability-desc');

        fetch(`${API_BASE_URL}/availability?availability=${isReady}`, {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => res.json())
            .then(data => {
                if (data.code === 200) {
                    if (availDesc) {
                        availDesc.textContent = isReady 
                            ? 'Đang bật tìm việc · Hệ thống đang định vị GPS để NTD tìm thấy bạn' 
                            : 'Đang tắt tìm việc · Bạn tạm thời ẩn khỏi bản đồ tìm thợ';
                    }
                    if (isReady) {
                        connectWebSocket();
                    } else {
                        disconnectWebSocket();
                    }
                } else {
                    alert('Lỗi cập nhật trạng thái: ' + data.message);
                    checkboxEl.checked = !isReady; // Revert
                }
            })
            .catch(err => {
                console.error(err);
                checkboxEl.checked = !isReady;
            });
    }

    // 4. MỞ/ĐÓNG MODAL SỬA HỒ SƠ
    function openEditModal(targetSection = 'all') {
        if (!currentProfileData) return;
        document.getElementById('input-fullname').value = currentProfileData.fullName || '';
        document.getElementById('input-email').value = currentProfileData.email || '';
        document.getElementById('input-phone').value = currentProfileData.phone || '';
        document.getElementById('input-skills').value = currentProfileData.skills || '';
        document.getElementById('input-employer-name').value = currentProfileData.employerName || '';
        document.getElementById('input-tax-id').value = currentProfileData.taxId || '';
        
        // Đặt lại trạng thái Avatar trong Modal
        selectedAvatarFile = null;
        const fileInput = document.getElementById('input-avatar-file');
        if (fileInput) fileInput.value = '';
        const fileNameSpan = document.getElementById('avatar-file-name');
        if (fileNameSpan) fileNameSpan.style.display = 'none';

        const avatarUrlInput = document.getElementById('input-avatar-url');
        if (avatarUrlInput) avatarUrlInput.value = currentProfileData.avatarUrl || '';

        const modalPlaceholder = document.getElementById('modal-avatar-placeholder');
        if (modalPlaceholder) {
            modalPlaceholder.textContent = (currentProfileData.fullName || 'U').trim().charAt(0).toUpperCase() || 'U';
        }

        if (currentProfileData.avatarUrl) {
            showModalAvatarPreview(resolveAvatarUrl(currentProfileData.avatarUrl));
        } else {
            showModalAvatarPreview(null);
        }

        document.getElementById('edit-modal').style.display = 'flex';

        // Tự động focus vào trường tương ứng nếu bấm từ thẻ cụ thể
        setTimeout(() => {
            if (targetSection === 'avatar') {
                const el = document.getElementById('modal-section-avatar');
                if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                const inputUrl = document.getElementById('input-avatar-url');
                if (inputUrl) inputUrl.focus();
            } else if (targetSection === 'worker') {
                const el = document.getElementById('input-skills');
                if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            } else if (targetSection === 'employer') {
                const el = document.getElementById('input-employer-name');
                if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            } else {
                const el = document.getElementById('input-fullname');
                if (el) el.focus();
            }
        }, 100);
    }

    function closeEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
    }

    // Hàm thêm gợi ý kỹ năng nhanh
    function addSkillSuggestion(skillName) {
        const input = document.getElementById('input-skills');
        if (!input) return;
        let current = input.value.trim();
        if (!current) {
            input.value = skillName;
        } else {
            const parts = current.split(',').map(s => s.trim().toLowerCase());
            if (!parts.includes(skillName.toLowerCase())) {
                input.value = current + ', ' + skillName;
            }
        }
        input.focus();
    }

    async function submitProfileUpdate() {
        const token = localStorage.getItem('accessToken');
        const saveBtn = document.getElementById('btn-save-profile');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang lưu...';
        }

        try {
            let finalAvatarUrl = document.getElementById('input-avatar-url').value.trim();

            // Nếu người dùng chọn file ảnh từ máy -> Tải lên Google Drive qua backend trước
            if (selectedAvatarFile) {
                if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang tải ảnh lên Drive...';
                const formData = new FormData();
                formData.append('file', selectedAvatarFile);

                const uploadRes = await fetch('http://localhost:8083/api/v1/profile/avatar', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    body: formData
                });
                const uploadData = await uploadRes.json();
                if (uploadData.code === 200 && uploadData.data) {
                    finalAvatarUrl = uploadData.data; // mã Drive File ID trả về từ backend
                } else {
                    alert('Lỗi tải ảnh đại diện: ' + (uploadData.message || 'Không thể upload ảnh lên máy chủ'));
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Lưu thay đổi';
                    }
                    return;
                }
            }

            if (saveBtn) saveBtn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang cập nhật hồ sơ...';

            const requestProfileDTO = {
                fullName: document.getElementById('input-fullname').value.trim(),
                email: document.getElementById('input-email').value.trim(),
                skills: document.getElementById('input-skills').value.trim(),
                employerName: document.getElementById('input-employer-name').value.trim(),
                taxId: document.getElementById('input-tax-id').value.trim(),
                avatarUrl: finalAvatarUrl
            };

            const res = await fetch(API_BASE_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestProfileDTO)
            });
            const data = await res.json();
            if (data.code === 200) {
                closeEditModal();
                loadProfileData();
                alert('Cập nhật hồ sơ thành công!');
            } else {
                alert('Lỗi cập nhật: ' + (data.message || 'Không thể lưu thông tin'));
            }
        } catch (err) {
            console.error('Lỗi khi cập nhật hồ sơ:', err);
            alert('Lỗi kết nối khi cập nhật hồ sơ!');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="ti ti-device-floppy"></i> Lưu thay đổi';
            }
        }
    }

    function logout() {
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            disconnectWebSocket();
            localStorage.clear();
            window.location.href = '/interface/authentication';
        }
    }

    // 5. TẢI VÀ HIỂN THỊ ĐIỂM ĐÁNH GIÁ & NHẬN XÉT THEO TỪNG VAI TRÒ
    let allUserReviews = [];

    async function loadUserReviews() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        let userId = localStorage.getItem('myUserId');
        if (!userId) {
            try {
                const resMe = await fetch('http://localhost:8083/api/v1/messages/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const dataMe = await resMe.json();
                if (dataMe && dataMe.data) {
                    userId = dataMe.data;
                    localStorage.setItem('myUserId', userId);
                }
            } catch(e) {
                console.error('Không thể lấy userId để tải review:', e);
            }
        }

        if (!userId) {
            renderReviewsEmpty('Không thể xác định mã người dùng để tải đánh giá.');
            return;
        }

        try {
            const res = await fetch(`http://localhost:8083/api/v1/review/user/${userId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const resData = await res.json();
            allUserReviews = (resData && resData.data) ? resData.data : [];
            
            // Cập nhật điểm và số lượng riêng biệt trên từng Card hồ sơ
            updateRoleCardRatings();

            // Hiển thị danh sách nhận xét tương ứng với chế độ đang chọn
            renderReviewsForCurrentMode();
        } catch (err) {
            console.error('Lỗi khi tải đánh giá người dùng:', err);
            renderReviewsEmpty('Không thể kết nối đến máy chủ để tải danh sách nhận xét.');
        }
    }

    function updateRoleCardRatings() {
        const workerReviews = allUserReviews.filter(r => (r.targetRole || 'WORKER').toUpperCase() === 'WORKER');
        const employerReviews = allUserReviews.filter(r => (r.targetRole || '').toUpperCase() === 'EMPLOYER');

        const totalWorker = workerReviews.length;
        const totalEmployer = employerReviews.length;

        let avgWorkerStr = "5.0";
        if (totalWorker > 0) {
            const sumWorker = workerReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
            avgWorkerStr = (sumWorker / totalWorker).toFixed(1);
        }

        let avgEmployerStr = "5.0";
        if (totalEmployer > 0) {
            const sumEmployer = employerReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
            avgEmployerStr = (sumEmployer / totalEmployer).toFixed(1);
        }

        const wRating = document.getElementById('worker-card-rating');
        const wCount = document.getElementById('worker-card-count');
        const eRating = document.getElementById('employer-card-rating');
        const eCount = document.getElementById('employer-card-count');

        if (wRating) wRating.textContent = totalWorker > 0 ? avgWorkerStr : '--';
        if (wCount) wCount.textContent = totalWorker;
        if (eRating) eRating.textContent = totalEmployer > 0 ? avgEmployerStr : '--';
        if (eCount) eCount.textContent = totalEmployer;
    }

    function renderStarHtml(rating, size = 15) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += `<i class="ti ti-star-filled" style="color: #f59e0b; font-size: ${size}px;"></i>`;
            } else {
                stars += `<i class="ti ti-star" style="color: #cbd5e1; font-size: ${size}px;"></i>`;
            }
        }
        return stars;
    }

    function renderReviewsForCurrentMode() {
        const currentMode = (localStorage.getItem('currentMode') || 'WORKER').toUpperCase();
        const isWorker = (currentMode === 'WORKER');

        const relevantReviews = allUserReviews.filter(r => {
            const role = (r.targetRole || 'WORKER').toUpperCase();
            return isWorker ? (role === 'WORKER') : (role === 'EMPLOYER');
        });

        const total = relevantReviews.length;
        let avgRatingStr = "5.0";
        let avgNum = 5.0;

        if (total > 0) {
            const sum = relevantReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
            avgNum = sum / total;
            avgRatingStr = avgNum.toFixed(1);
        }

        // 1. Cập nhật trên Header Rating Chip (phản ánh vai trò đang chọn)
        const headerVal = document.getElementById('header-rating-val');
        const headerCount = document.getElementById('header-review-count');
        if (headerVal) headerVal.textContent = total > 0 ? avgRatingStr : '--';
        if (headerCount) {
            const roleText = isWorker ? 'NTD đánh giá' : 'Ứng viên đánh giá';
            headerCount.textContent = `(${total} đánh giá · ${roleText})`;
        }

        // 2. Cập nhật Tiêu đề và Mô tả Section đánh giá
        const titleEl = document.getElementById('reviews-section-title');
        const subtitleEl = document.getElementById('reviews-section-subtitle');
        if (titleEl) {
            if (isWorker) {
                titleEl.innerHTML = `<i class="ti ti-user-star" style="color: #f59e0b;"></i> Đánh giá từ Nhà tuyển dụng (Vai trò Ứng viên)`;
            } else {
                titleEl.innerHTML = `<i class="ti ti-building" style="color: #f59e0b;"></i> Đánh giá từ Ứng viên (Vai trò Nhà tuyển dụng)`;
            }
        }
        if (subtitleEl) {
            if (isWorker) {
                subtitleEl.textContent = 'Phản hồi và chấm điểm từ các nhà tuyển dụng sau khi bạn hoàn thành ca làm việc';
            } else {
                subtitleEl.textContent = 'Phản hồi và nhận xét từ các bạn thợ / ứng viên sau khi hoàn thành ca làm tại cơ sở của bạn';
            }
        }

        // 3. Overview Box trong khu vực đánh giá
        const overviewScore = document.getElementById('overview-rating-score');
        const overviewStars = document.getElementById('overview-stars');
        const overviewTotal = document.getElementById('overview-total-reviews');

        if (overviewScore) overviewScore.textContent = total > 0 ? avgRatingStr : '--';
        if (overviewStars) overviewStars.innerHTML = renderStarHtml(total > 0 ? Math.round(avgNum) : 0, 16);
        if (overviewTotal) {
            const partnerName = isWorker ? 'nhà tuyển dụng' : 'ứng viên';
            overviewTotal.textContent = total > 0 ? `Dựa trên ${total} lượt đánh giá từ ${partnerName}` : 'Chưa có lượt đánh giá nào';
        }

        // 4. Thống kê phân bố sao (5★ - 1★)
        const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        relevantReviews.forEach(r => {
            const star = Math.min(Math.max(Number(r.rating) || 5, 1), 5);
            counts[star] = (counts[star] || 0) + 1;
        });

        const statsBox = document.getElementById('rating-stats-box');
        if (statsBox) {
            let statsHtml = '';
            for (let s = 5; s >= 1; s--) {
                const count = counts[s] || 0;
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                statsHtml += `
                    <div class="stat-item">
                        <span class="stat-label">${s} <i class="ti ti-star-filled" style="color:#f59e0b; font-size:12px;"></i></span>
                        <div class="stat-bar-bg">
                            <div class="stat-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                        <span class="stat-count">${count}</span>
                    </div>
                `;
            }
            statsBox.innerHTML = statsHtml;
        }

        // 5. Render danh sách review
        const listContainer = document.getElementById('reviews-list-container');
        if (!listContainer) return;

        if (total === 0) {
            const emptyTitle = isWorker ? 'Chưa có đánh giá nào từ Nhà tuyển dụng' : 'Chưa có đánh giá nào từ Ứng viên';
            const emptyDesc = isWorker
                ? 'Sau khi bạn hoàn thành các ca nhận việc và được xác nhận xong việc, nhà tuyển dụng sẽ gửi đánh giá và nhận xét cho bạn tại đây.'
                : 'Sau khi các ứng viên hoàn thành ca làm việc tại bài đăng tuyển của bạn, họ sẽ gửi đánh giá về trải nghiệm làm việc tại đây.';
            listContainer.innerHTML = `
                <div class="no-reviews-state">
                    <i class="ti ti-star-off no-reviews-icon"></i>
                    <div class="no-reviews-title">${emptyTitle}</div>
                    <div class="no-reviews-desc">${emptyDesc}</div>
                </div>
            `;
            return;
        }

        const sorted = [...relevantReviews].sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
        });

        listContainer.innerHTML = sorted.map(r => {
            const name = r.reviewerName || 'Đối tác ẩn danh';
            const initial = name.trim().charAt(0).toUpperCase() || 'D';
            const rating = Math.min(Math.max(Number(r.rating) || 5, 1), 5);
            let timeStr = 'Vừa xong';
            if (r.createdAt) {
                try {
                    const d = new Date(r.createdAt);
                    timeStr = d.toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } catch(e) {
                    timeStr = r.createdAt;
                }
            }

            const resolvedAvatar = r.reviewerAvatarUrl ? resolveAvatarUrl(r.reviewerAvatarUrl) : null;
            const avatarHtml = resolvedAvatar
                ? `<img src="${resolvedAvatar}" class="reviewer-avatar-img" alt="${name}" onerror="this.outerHTML='<div class=\\'reviewer-avatar\\'>${initial}</div>'">`
                : `<div class="reviewer-avatar">${initial}</div>`;

            const jobBadgeHtml = r.jobTitle 
                ? `<div class="review-job-chip" title="Công việc liên quan"><i class="ti ti-briefcase"></i> Ca làm: <strong>${r.jobTitle}</strong></div>`
                : '';

            const roleBadgeHtml = isWorker
                ? `<span class="review-badge-tag tag-worker"><i class="ti ti-user-check"></i> Đánh giá năng lực làm việc</span>`
                : `<span class="review-badge-tag tag-employer"><i class="ti ti-building-check"></i> Đánh giá môi trường làm việc</span>`;

            const hasComment = r.comment && r.comment.trim();
            const commentHtml = hasComment 
                ? `<p class="review-comment">"${r.comment.trim()}"</p>`
                : `<p class="review-comment empty-comment">Đối tác không để lại nhận xét bằng chữ.</p>`;

            return `
                <div class="review-card">
                    <div class="review-header">
                        <div class="reviewer-info">
                            ${avatarHtml}
                            <div>
                                <div class="reviewer-name-row">
                                    <span class="reviewer-name">${name}</span>
                                    ${roleBadgeHtml}
                                </div>
                                <div class="reviewer-date"><i class="ti ti-calendar-time"></i> ${timeStr}</div>
                            </div>
                        </div>
                        <div class="review-stars">
                            ${renderStarHtml(rating, 16)}
                        </div>
                    </div>
                    ${jobBadgeHtml}
                    ${commentHtml}
                </div>
            `;
        }).join('');
    }

    function renderReviewsEmpty(msg) {
        const listContainer = document.getElementById('reviews-list-container');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="no-reviews-state">
                    <i class="ti ti-alert-circle no-reviews-icon"></i>
                    <div class="no-reviews-title">${msg}</div>
                </div>
            `;
        }
    }
