const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');

    let currentTabStatus = 'PENDING';
    let currentTabType = 'INVITATION';
    let currentIsHistoryTab = false;
    let appSearchDebounceTimer = null;

    function getAppSearchKeyword() {
        const input = document.getElementById('appSearchInput');
        return input ? input.value.trim() : '';
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        if (currentMode !== 'WORKER') {
            alert("Trang quản lý đơn ứng tuyển chỉ dành cho Người tìm việc / Ứng viên! Vui lòng chuyển vai trò trong trang Cá nhân.");
            window.location.href = "/interface/managejob";
            return;
        }

        // Xử lý tìm kiếm debounce
        const appSearchInput = document.getElementById('appSearchInput');
        const clearAppSearchBtn = document.getElementById('clearAppSearchBtn');

        if (appSearchInput) {
            appSearchInput.addEventListener('input', function() {
                const val = this.value;
                if (clearAppSearchBtn) clearAppSearchBtn.style.display = val.length > 0 ? 'flex' : 'none';
                clearTimeout(appSearchDebounceTimer);
                appSearchDebounceTimer = setTimeout(() => {
                    loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab, val.trim());
                }, 350);
            });

            appSearchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    clearTimeout(appSearchDebounceTimer);
                    loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab, this.value.trim());
                }
            });
        }

        if (clearAppSearchBtn) {
            clearAppSearchBtn.addEventListener('click', function() {
                if (appSearchInput) {
                    appSearchInput.value = '';
                    appSearchInput.focus();
                }
                clearAppSearchBtn.style.display = 'none';
                clearTimeout(appSearchDebounceTimer);
                loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab, '');
            });
        }

        const urlParams = new URLSearchParams(window.location.search);
        const targetTab = urlParams.get('tab') || 'INVITATION';
        const tabBtns = document.querySelectorAll('.tab-btn');
        let matchedBtn = null;
        tabBtns.forEach(btn => {
            if (btn.getAttribute('onclick')?.includes(`'${targetTab}'`)) {
                matchedBtn = btn;
            }
        });

        if (matchedBtn) {
            switchTab(targetTab, matchedBtn);
        } else {
            loadJobs('PENDING', 'INVITATION', false);
        }
    });

    // CHUYỂN TAB VÀ GỌI API
    function switchTab(tabType, btnElement) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');

        if (tabType === 'INVITATION') {
            currentTabStatus = 'PENDING';
            currentTabType = 'INVITATION';
            currentIsHistoryTab = false;
        } else if (tabType === 'APPLICATION') {
            currentTabStatus = 'PENDING';
            currentTabType = 'APPLICATION';
            currentIsHistoryTab = false;
        } else if (tabType === 'BOOKED') {
            currentTabStatus = 'BOOKED';
            currentTabType = '';
            currentIsHistoryTab = false;
        } else if (tabType === 'IN_PROGRESS') {
            // TAB MỚI: Load công việc đang thực hiện
            currentTabStatus = 'IN_PROGRESS';
            currentTabType = '';
            currentIsHistoryTab = false;
        } else if (tabType === 'HISTORY') {
            currentTabStatus = '';
            currentTabType = '';
            currentIsHistoryTab = true;
        }

        loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab);
    }

    function loadJobs(status, type, isHistoryTab, keyword) {
        const container = document.getElementById('job-list-container');
        container.innerHTML = `<div class="empty-state"><i class="ti ti-loader ti-spin"></i><p>Đang tải dữ liệu...</p></div>`;

        const kw = (keyword !== undefined && keyword !== null) ? keyword : getAppSearchKeyword();

        const urlParams = new URLSearchParams();
        if (status) urlParams.append('status', status);
        if (type) urlParams.append('type', type);
        if (kw) urlParams.append('keyword', kw);

        const apiUrl = `/api/v1/application?${urlParams.toString()}`;

        fetch(apiUrl, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => {
                if (res.status === 401) {
                    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                    window.location.href = "/interface/authentication";
                    throw new Error("401 Unauthorized");
                }
                if (res.status === 403) {
                    alert("Bạn không có quyền truy cập dữ liệu này (Yêu cầu vai trò Ứng viên / Người tìm việc)!");
                    window.location.href = "/interface/managejob";
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(apiResponse => {
                let data = apiResponse.data || [];

                if (isHistoryTab) {
                    data = data.filter(job => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(job.status));
                }

                renderJobs(data, status, type, isHistoryTab, kw);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                container.innerHTML = `<div class="empty-state"><i class="ti ti-alert-circle"></i><p style="color:var(--danger);">Lỗi tải dữ liệu!</p></div>`;
            });
    }

    function renderJobs(jobs, currentStatus, currentType, isHistoryTab, keyword) {
        const container = document.getElementById('job-list-container');

        if (jobs.length === 0) {
            const emptyMsg = keyword
                ? `Không tìm thấy công việc nào khớp với từ khóa "<strong>${keyword}</strong>".`
                : 'Không có công việc nào trong mục này.';
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ti ti-folder-off"></i>
                    <p>${emptyMsg}</p>
                </div>`;
            return;
        }

        let html = '';
        jobs.forEach(job => {
            const startTime = new Date(job.startTime).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'});
            const endTime = new Date(job.endTime).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit'});
            const rate = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.hourlyRate);

            let actionButtons = '';
            let badgeHtml = '';

            // LOGIC RENDER BADGE VÀ BUTTON TÙY THEO TAB
            if (isHistoryTab) {
                if (job.status === 'COMPLETED') {
                    badgeHtml = `<span class="badge completed"><i class="ti ti-check" style="color:var(--primary-orange);"></i> Đã hoàn thành</span>`;
                    let reviewSection = "";
                    if (job.isReviewed === true) {
                        const starsStr = '★'.repeat(job.reviewRating || 5) + '☆'.repeat(5 - (job.reviewRating || 5));
                        reviewSection = `
                            <button class="btn" style="background:var(--black-main); color:#ffffff; border:1px solid var(--black-main); cursor:default; width:100%;" disabled>
                                <span style="color: #f59e0b; font-size:15px; margin-right:3px;">${starsStr}</span> (${job.reviewRating || 5}★) · Đã hoàn tất
                            </button>
                            ${job.reviewComment ? `<div style="font-size:12.5px; color:#475569; background:#f8fafc; border-left:3px solid #f59e0b; padding:6px 12px; border-radius:4px; font-style:italic; width:100%; box-sizing:border-box;">
                                <i class="ti ti-quote" style="color:#f59e0b;"></i> "${escapeQuote(job.reviewComment)}"
                            </div>` : ""}`;
                    } else {
                        reviewSection = `
                            <button class="btn btn-primary" style="width:100%; font-weight:700;" onclick="openReviewModal('${job.applicationId}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerName)}')">
                                <span style="font-size:16px;">★</span> Đánh giá Nhà tuyển dụng
                            </button>`;
                    }
                    actionButtons = `
                        <div class="job-actions">
                            <div class="job-actions-secondary">
                                <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                            </div>
                            <div class="job-actions-primary" style="flex-direction:column;">
                                ${reviewSection}
                            </div>
                        </div>`;
                } else if (job.status === 'CANCELLED') {
                    badgeHtml = `<span class="badge cancelled"><i class="ti ti-x"></i> Đã hủy / Từ chối</span>`;
                    actionButtons = `
                        <div class="job-actions">
                            <div class="job-actions-secondary">
                                <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                            </div>
                        </div>`;
                } else if (job.status === 'NO_SHOW') {
                    badgeHtml = `<span class="badge noshow"><i class="ti ti-alert-triangle" style="color:var(--primary-orange);"></i> Bỏ ca</span>`;
                    actionButtons = `
                        <div class="job-actions">
                            <div class="job-actions-secondary">
                                <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                            </div>
                        </div>`;
                }

            } else if (currentStatus === 'PENDING' && currentType === 'INVITATION') {
                badgeHtml = `<span class="badge invitation"><i class="ti ti-mail-opened"></i> Thư mời</span>`;
                actionButtons = `
                    <div class="job-actions">
                        <div class="job-actions-secondary">
                            ${job.employerPhone ? `<a href="tel:${job.employerPhone}" class="btn btn-secondary" title="Gọi điện trao đổi"><i class="ti ti-phone"></i> Gọi hỏi việc</a>` : ""}
                            <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                            <button class="btn btn-secondary" onclick="openJobMap(${job.latitude}, ${job.longitude}, '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerName)}')"><i class="ti ti-map"></i> Xem bản đồ</button>
                        </div>
                        <div class="job-actions-primary">
                            <button class="btn btn-reject" onclick="respond('${job.applicationId}', false)"><i class="ti ti-x"></i> Từ chối</button>
                            <button class="btn btn-accept" onclick="respond('${job.applicationId}', true)"><i class="ti ti-check"></i> Nhận việc</button>
                        </div>
                    </div>`;

            } else if (currentStatus === 'PENDING' && currentType === 'APPLICATION') {
                badgeHtml = `<span class="badge application"><i class="ti ti-hourglass-empty"></i> Chờ duyệt</span>`;
                actionButtons = `
                    <div class="job-actions">
                        <div class="job-actions-secondary">
                            <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin cho nhà tuyển dụng</button>
                        </div>
                        <div class="job-actions-primary">
                            <button class="btn btn-reject" style="flex: none; width: 100%; cursor:default;" disabled>Đang đợi phản hồi từ nhà tuyển dụng...</button>
                        </div>
                    </div>`;

            } else if (currentStatus === 'BOOKED') {
                // ĐÃ CHỐT: CHỜ ĐẾN GIỜ CHECK-IN
                badgeHtml = `<span class="badge booked"><i class="ti ti-check"></i> Đã chốt</span>`;
                actionButtons = `
                    <div class="job-actions">
                        <div class="job-actions-secondary">
                            ${job.employerPhone ? `<a href="tel:${job.employerPhone}" class="btn btn-secondary" title="Gọi trực tiếp cho nhà tuyển dụng"><i class="ti ti-phone"></i> Gọi Nhà tuyển dụng</a>` : ""}
                            <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                            <button class="btn btn-secondary" onclick="openJobMap(${job.latitude}, ${job.longitude}, '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerName)}')"><i class="ti ti-map"></i> Xem bản đồ</button>
                        </div>
                        <div class="job-actions-primary">
                            <button class="btn btn-primary" style="width:100%; padding:11px 16px; font-weight:700;" onclick="openScanner()"><i class="ti ti-qrcode"></i> Check-in QR</button>
                        </div>
                    </div>`;

            } else if (currentStatus === 'IN_PROGRESS') {
                if (job.checkOutAt) {
                    // ĐÃ QUÉT RA CA (CHECK-OUT) -> GIAI ĐOẠN XÁC NHẬN THANH TOÁN
                    if (!job.workerConfirmed) {
                        badgeHtml = `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a;"><i class="ti ti-coin"></i> Đã chốt ca · Chờ nhận tiền</span>`;
                        actionButtons = `
                            <div class="job-actions">
                                <div class="job-actions-secondary">
                                    ${job.employerPhone ? `<a href="tel:${job.employerPhone}" class="btn btn-secondary" title="Gọi trực tiếp cho nhà tuyển dụng"><i class="ti ti-phone"></i> Gọi Nhà tuyển dụng</a>` : ""}
                                    <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                                </div>
                                <div class="job-actions-primary">
                                    <button class="btn btn-accept" style="width:100%; padding:11px 16px; font-weight:700;" onclick="confirmPaymentWorker('${job.applicationId}')">
                                        <i class="ti ti-circle-check"></i> Xác nhận đã nhận tiền
                                    </button>
                                </div>
                            </div>`;
                    } else {
                        badgeHtml = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd;"><i class="ti ti-clock"></i> Đã nhận tiền · Đợi chủ hài lòng</span>`;
                        actionButtons = `
                            <div class="job-actions">
                                <div class="job-actions-secondary">
                                    ${job.employerPhone ? `<a href="tel:${job.employerPhone}" class="btn btn-secondary" title="Gọi trực tiếp cho nhà tuyển dụng"><i class="ti ti-phone"></i> Gọi Nhà tuyển dụng</a>` : ""}
                                    <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                                </div>
                                <div class="job-actions-primary">
                                    <button class="btn" style="background:#f4f4f5; color:#71717a; border:1px solid #e4e4e7; cursor:default; width:100%;" disabled>
                                        <i class="ti ti-hourglass-empty"></i> Chờ nhà tuyển dụng xác nhận hài lòng
                                    </button>
                                </div>
                            </div>`;
                    }
                } else {
                    // ĐANG LÀM: ĐÃ CHECK-IN XONG, CHỜ CHỐT CA (CHECK-OUT)
                    badgeHtml = `<span class="badge inprogress"><i class="ti ti-loader ti-spin"></i> Đang làm</span>`;
                    actionButtons = `
                        <div class="job-actions">
                            <div class="job-actions-secondary">
                                ${job.employerPhone ? `<a href="tel:${job.employerPhone}" class="btn btn-secondary" title="Gọi trực tiếp cho nhà tuyển dụng"><i class="ti ti-phone"></i> Gọi Nhà tuyển dụng</a>` : ""}
                                <button class="btn btn-secondary" onclick="openChatWithEmployer('${job.applicationId}', '${escapeQuote(job.employerName)}', '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerAvatar || '')}')"><i class="ti ti-message-circle"></i> Nhắn tin</button>
                                <button class="btn btn-secondary" onclick="openJobMap(${job.latitude}, ${job.longitude}, '${escapeQuote(job.jobTitle)}', '${escapeQuote(job.employerName)}')"><i class="ti ti-map"></i> Xem bản đồ</button>
                        </div>
                        <div class="job-actions-primary">
                            <button class="btn btn-warning" style="width:100%; padding:11px 16px; font-weight:700;" onclick="openScanner()"><i class="ti ti-scan"></i> Quét chốt ca</button>
                        </div>
                    </div>`;
                }
            }
            let earnedRow = '';
            if (job.earnedAmount != null) {
                const earnedStr = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.earnedAmount);
                earnedRow = `
                    <div class="detail-row">
                        <i class="ti ti-coin"></i>
                        <span>Tiền công thực nhận: <strong style="color: var(--primary-orange); font-size: 15px; font-weight: 800;">${earnedStr}</strong></span>
                    </div>`;
            }

            // NÚT FLAG KHIẾU NẠI Ở HEADER (PHƯƠNG ÁN 1)
            let reportFlagBtn = '';
            if (job.hasReported) {
                reportFlagBtn = `<span class="badge dispute" title="Bạn đã gửi khiếu nại cho ca làm này"><i class="ti ti-check"></i> Đã khiếu nại</span>`;
            } else if (['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(job.status)) {
                let disputeNote = job.isDisputed ? `<span class="badge dispute" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; margin-right:4px;" title="Nhà tuyển dụng đã gửi khiếu nại"><i class="ti ti-alert-triangle"></i> Đang tranh chấp</span>` : '';
                reportFlagBtn = `${disputeNote}<button class="btn-report-flag" onclick="openReportModal('${job.applicationId}', '${escapeQuote(job.jobTitle)}')" title="Báo cáo / Khiếu nại sự cố"><i class="ti ti-flag"></i></button>`;
            }

            const employerPhoneRow = job.employerPhone ? `
                <div class="detail-row">
                    <i class="ti ti-phone" style="color:var(--primary);"></i>
                    <span>Liên hệ nhà tuyển dụng: <a href="tel:${job.employerPhone}" style="color:var(--primary); font-weight:600; text-decoration:none;"><i class="ti ti-phone-call"></i> ${job.employerPhone} (Bấm để gọi)</a></span>
                </div>` : '';

            const empAvatar = (typeof resolveAvatarUrl === 'function') 
                ? resolveAvatarUrl(job.employerAvatar, job.employerName) 
                : (job.employerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.employerName || 'NTD')}&background=18181b&color=ff6600&size=128&bold=true`);

            html += `
                <div class="job-card" id="app-${job.applicationId}">
                    <div class="job-header">
                        <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                            <img src="${empAvatar}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1.5px solid var(--border); flex-shrink:0;" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(job.employerName)}');">
                            <div style="min-width:0;">
                                <h3 class="job-title">${job.jobTitle}</h3>
                                <p class="employer-name">
                                    <i class="ti ti-user"></i> ${job.employerName}
                                    ${job.employerPhone ? ` · <a href="tel:${job.employerPhone}" style="color:var(--primary); text-decoration:none; font-weight:600;"><i class="ti ti-phone"></i> ${job.employerPhone}</a>` : ''}
                                </p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink:0;">
                            ${badgeHtml}
                            ${reportFlagBtn}
                        </div>
                    </div>

                    <div class="job-details">
                        <div class="detail-row">
                            <i class="ti ti-clock"></i>
                            <span>${startTime} - ${endTime}</span>
                        </div>
                        <div class="detail-row">
                            <i class="ti ti-cash"></i>
                            <span>Mức lương: <span class="price-highlight">${rate}/giờ</span></span>
                        </div>
                        ${earnedRow}
                        ${employerPhoneRow}
                    </div>

                    ${actionButtons}
                </div>
            `;
        });

        container.innerHTML = html;
    }

    function openChatWithEmployer(appId, empName, jobTitle, empAvatar) {
        if (window.openChatByAppId) {
            const avatarUrl = (typeof resolveAvatarUrl === 'function')
                ? resolveAvatarUrl(empAvatar, empName)
                : (empAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(empName || 'NTD')}&background=18181b&color=ff6600&size=128&bold=true`);
            window.openChatByAppId(appId, empName, jobTitle, avatarUrl, null, 'EMPLOYER');
        } else {
            alert('Tính năng nhắn tin đang tải...');
        }
    }

    function escapeQuote(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    let modalMap = null;
    let mapUserMarker = null;
    let mapDestMarker = null;
    let mapRouteLayer = null;
    let mapRouteShadow = null;
    let currentMapTargetLat = null;
    let currentMapTargetLng = null;
    let currentMapJobTitle = '';
    let currentMapEmployerName = '';

    function setRecalculatingState(isCalculating) {
        const iconHeader = document.getElementById('iconRecalculateHeader');
        const iconFooter = document.getElementById('iconRecalculateFooter');
        const btnHeader = document.getElementById('btnRecalculateHeader');
        const btnFooter = document.getElementById('btnRecalculateFooter');

        if (isCalculating) {
            if (iconHeader) iconHeader.classList.add('ti-spin');
            if (iconFooter) iconFooter.classList.add('ti-spin');
            if (btnHeader) {
                btnHeader.disabled = true;
                btnHeader.style.opacity = '0.7';
            }
            if (btnFooter) {
                btnFooter.disabled = true;
                btnFooter.style.opacity = '0.7';
            }
        } else {
            if (iconHeader) iconHeader.classList.remove('ti-spin');
            if (iconFooter) iconFooter.classList.remove('ti-spin');
            if (btnHeader) {
                btnHeader.disabled = false;
                btnHeader.style.opacity = '1';
            }
            if (btnFooter) {
                btnFooter.disabled = false;
                btnFooter.style.opacity = '1';
            }
        }
    }

    let liveRoutingWatchId = null;
    let hasCalculatedRoute = false;

    function recalculateRoute() {
        if (!currentMapTargetLat || !currentMapTargetLng) return;
        fetchGPSAndCalculateRoute(true);
    }

    function fetchGPSAndCalculateRoute(isManualRetry = false) {
        if (isManualRetry) {
            hasCalculatedRoute = false;
        }

        const routeStats = document.getElementById('routeStatsText');
        const mapLoading = document.getElementById('mapRouteLoading');
        const alertBox = document.getElementById('mapAccuracyAlert');
        const alertText = document.getElementById('mapAccuracyAlertText');
        const btnGg = document.getElementById('btnOpenGoogleMaps');

        if (!hasCalculatedRoute) {
            if (mapLoading) mapLoading.style.display = 'flex';
            setRecalculatingState(true);

            if (routeStats) {
                routeStats.innerHTML = `<span style="color:#0f172a;"><i class="ti ti-satellite" style="color:var(--primary);"></i> ${isManualRetry ? 'Đang định vị lại GPS chính xác và tính lại tuyến đường...' : 'Đang lấy vị trí GPS và tính lộ trình ngắn nhất...'}</span>`;
            }

            // Xóa route cũ nếu đang tính lại
            if (mapRouteLayer) { modalMap.removeLayer(mapRouteLayer); mapRouteLayer = null; }
            if (mapRouteShadow) { modalMap.removeLayer(mapRouteShadow); mapRouteShadow = null; }
        }

        if (!navigator.geolocation) {
            setRecalculatingState(false);
            if (mapLoading) mapLoading.style.display = 'none';
            if (alertBox) alertBox.style.display = 'none';
            if (routeStats) {
                routeStats.innerHTML = `<span style="color:#e11d48;"><i class="ti ti-alert-circle"></i> Trình duyệt không hỗ trợ định vị GPS.</span>`;
            }
            modalMap.setView([currentMapTargetLat, currentMapTargetLng], 15);
            return;
        }

        if (liveRoutingWatchId) {
            navigator.geolocation.clearWatch(liveRoutingWatchId);
            liveRoutingWatchId = null;
        }

        liveRoutingWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                setRecalculatingState(false);
                const userLat = pos.coords.latitude;
                const userLng = pos.coords.longitude;
                const accuracy = pos.coords.accuracy || 0; // mét

                const isInaccurate = accuracy > 800;
                const accFormatted = accuracy >= 1000 
                    ? (accuracy / 1000).toFixed(1) + ' km' 
                    : Math.round(accuracy) + ' m';

                if (isInaccurate) {
                    if (alertBox) alertBox.style.display = 'flex';
                    if (alertText) {
                        alertText.innerHTML = `Vị trí hiện tại chưa chuẩn (sai số khoảng <b>~${accFormatted}</b> do định vị ước tính qua mạng IP). Tuyến đường có thể sai lệch. Vui lòng bấm <b>"Tính lại ngay"</b> hoặc kiểm tra GPS.`;
                    }
                } else {
                    if (alertBox) alertBox.style.display = 'none';
                }

                // Cập nhật vị trí Marker
                const pinBg = isInaccurate ? '#f59e0b' : '#0d6efd';
                const userIcon = L.divIcon({
                    className: 'custom-user-pin',
                    html: `
                        <div style="position:relative; display:flex; flex-direction:column; align-items:center; transition: all 0.3s ease;">
                            <div style="background:${pinBg}; color:#fff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px ${isInaccurate ? 'rgba(245,158,11,0.5)' : 'rgba(13,110,253,0.5)'}; border:3px solid #fff;">
                                <i class="ti ti-walk" style="font-size:19px;"></i>
                            </div>
                            <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid = ${pinBg};"></div>
                        </div>
                    `,
                    iconSize: [36, 44],
                    iconAnchor: [18, 44]
                });

                const popupHtml = isInaccurate 
                    ? `<b>Vị trí của bạn (Ước tính IP)</b><br><span style="color:#d97706; font-size:12px;"><i class="ti ti-alert-triangle"></i> Sai số ~${accFormatted} (chưa chuẩn)</span><br><button onclick="recalculateRoute()" style="margin-top:6px; background:#d97706; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;"><i class="ti ti-refresh"></i> Tính lại vị trí</button>`
                    : `<b>Vị trí hiện tại của bạn</b><br><span style="color:var(--primary-orange); font-size:12px; font-weight:600;"><i class="ti ti-circle-check"></i> Độ chính xác cao (~${accFormatted})</span>`;

                if (mapUserMarker) {
                    mapUserMarker.setLatLng([userLat, userLng]);
                    mapUserMarker.setIcon(userIcon);
                    mapUserMarker.setPopupContent(popupHtml);
                } else {
                    mapUserMarker = L.marker([userLat, userLng], { icon: userIcon })
                        .addTo(modalMap)
                        .bindPopup(popupHtml);
                }

                if (btnGg) {
                    btnGg.href = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${currentMapTargetLat},${currentMapTargetLng}`;
                }

                if (!hasCalculatedRoute) {
                    hasCalculatedRoute = true;
                    // Gọi API OSRM
                    const routingUrl = `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${currentMapTargetLng},${currentMapTargetLat}?overview=full&geometries=geojson`;

                    fetch(routingUrl)
                        .then(res => res.json())
                        .then(data => {
                            if (mapLoading) mapLoading.style.display = 'none';

                            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                const route = data.routes[0];
                                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

                                mapRouteShadow = L.polyline(coords, {
                                    color: isInaccurate ? '#d97706' : '#1d4ed8',
                                    weight: 8,
                                    opacity: 0.3,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                }).addTo(modalMap);

                                mapRouteLayer = L.polyline(coords, {
                                    color: isInaccurate ? '#f59e0b' : '#0d6efd',
                                    weight: 5,
                                    opacity: 0.95,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                }).addTo(modalMap);

                                modalMap.fitBounds(mapRouteLayer.getBounds(), { padding: [50, 50] });

                                const distKm = (route.distance / 1000).toFixed(1);
                                const durMin = Math.max(1, Math.round(route.duration / 60));

                                const accuracyBadge = isInaccurate
                                    ? `<span style="font-size:11.5px; color:#b45309; background:#fffbeb; border:1px solid #fde68a; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="ti ti-alert-triangle"></i> Vị trí ước tính (~${accFormatted})</span>`
                                    : `<span style="font-size:11.5px; color:var(--primary-orange); background:var(--primary-light); border:1px solid #fed7aa; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="ti ti-check"></i> Tuyến đường ngắn nhất (~${accFormatted})</span>`;

                                if (routeStats) {
                                    routeStats.innerHTML = `
                                        <span style="color:#0f172a;"><i class="ti ti-route" style="color:var(--primary); font-size:16px;"></i> Quãng đường: <b style="color:var(--primary); font-size:14px;">${distKm} km</b></span>
                                        <span style="color:#cbd5e1;">|</span>
                                        <span style="color:#0f172a;"><i class="ti ti-clock" style="color:var(--warning); font-size:16px;"></i> Đi xe: <b style="color:var(--warning); font-size:14px;">~${durMin} phút</b></span>
                                        ${accuracyBadge}
                                    `;
                                }

                                mapRouteLayer.bindTooltip(`🚗 Tuyến: <b>${distKm} km</b> (~${durMin} phút)`, {
                                    sticky: true,
                                    direction: 'top'
                                });
                            } else {
                                fallbackDirectLine(userLat, userLng, currentMapTargetLat, currentMapTargetLng, isInaccurate, accFormatted);
                            }
                        })
                        .catch(err => {
                            console.error("Lỗi gọi OSRM:", err);
                            if (mapLoading) mapLoading.style.display = 'none';
                            fallbackDirectLine(userLat, userLng, currentMapTargetLat, currentMapTargetLng, isInaccurate, accFormatted);
                        });
                }
            },
            (err) => {
                console.warn("Không lấy được GPS:", err);
                setRecalculatingState(false);
                if (mapLoading) mapLoading.style.display = 'none';
                if (alertBox) alertBox.style.display = 'none';
                if (routeStats) {
                    routeStats.innerHTML = `<span style="color:#e11d48;"><i class="ti ti-alert-circle"></i> Chưa bật hoặc từ chối GPS. Đang hiển thị điểm đến công việc.</span>`;
                }
                modalMap.setView([currentMapTargetLat, currentMapTargetLng], 15);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    }

    function openJobMap(targetLat, targetLng, jobTitle, employerName) {
        if (!targetLat || !targetLng || isNaN(targetLat) || isNaN(targetLng)) {
            alert("Công việc này chưa có thông tin vị trí tọa độ trên bản đồ!");
            return;
        }

        currentMapTargetLat = targetLat;
        currentMapTargetLng = targetLng;
        currentMapJobTitle = jobTitle || 'Địa điểm làm việc';
        currentMapEmployerName = employerName || '';

        const modal = document.getElementById('mapModal');
        modal.style.display = 'flex';

        document.getElementById('mapJobTitle').innerText = currentMapJobTitle;
        document.getElementById('mapEmployerSubtitle').innerText = employerName ? `Nhà tuyển dụng: ${employerName}` : 'Điểm đến công việc';

        // Link dự phòng trực tiếp ra app Google Maps
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`;
        const btnGg = document.getElementById('btnOpenGoogleMaps');
        if (btnGg) btnGg.href = googleMapsUrl;

        // Khởi tạo bản đồ nếu chưa có
        if (!modalMap) {
            modalMap = L.map('modalMapCanvas', { attributionControl: false, zoomControl: true });
            L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(modalMap);

            // Bấm ra ngoài nền xám để đóng modal
            modal.addEventListener('click', function(e) {
                if (e.target === modal) closeMapModal();
            });
        }

        // Cập nhật kích thước bản đồ khi mở modal
        setTimeout(() => {
            if (modalMap) {
                modalMap.invalidateSize();
                modalMap.setView([targetLat, targetLng], 14);
            }
        }, 150);

        // Xóa các layer cũ
        if (mapUserMarker) { modalMap.removeLayer(mapUserMarker); mapUserMarker = null; }
        if (mapDestMarker) { modalMap.removeLayer(mapDestMarker); mapDestMarker = null; }
        if (mapRouteLayer) { modalMap.removeLayer(mapRouteLayer); mapRouteLayer = null; }
        if (mapRouteShadow) { modalMap.removeLayer(mapRouteShadow); mapRouteShadow = null; }

        // Ghim điểm đến (Nơi làm việc)
        const destIcon = L.divIcon({
            className: 'custom-dest-pin',
            html: `
                <div style="position:relative; display:flex; flex-direction:column; align-items:center;">
                    <div style="background:var(--black-main, #18181B); color:#fff; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(24,24,27,0.4); border:3px solid #fff;">
                        <i class="ti ti-briefcase" style="font-size:18px; color:var(--primary-orange, #FF6600);"></i>
                    </div>
                    <div style="width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid var(--black-main, #18181B);"></div>
                </div>
            `,
            iconSize: [36, 44],
            iconAnchor: [18, 44]
        });

        mapDestMarker = L.marker([targetLat, targetLng], { icon: destIcon })
            .addTo(modalMap)
            .bindPopup(`<b>Nơi làm việc</b><br>${jobTitle || ''}`)
            .openPopup();

        // Tiến hành lấy GPS live và vẽ lộ trình
        fetchGPSAndCalculateRoute(false);
    }

    function fallbackDirectLine(userLat, userLng, targetLat, targetLng, isInaccurate = false, accFormatted = '') {
        mapRouteLayer = L.polyline([[userLat, userLng], [targetLat, targetLng]], {
            color: isInaccurate ? '#f59e0b' : '#0d6efd',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.8
        }).addTo(modalMap);

        modalMap.fitBounds(mapRouteLayer.getBounds(), { padding: [50, 50] });
        const distKm = (modalMap.distance([userLat, userLng], [targetLat, targetLng]) / 1000).toFixed(1);
        const routeStats = document.getElementById('routeStatsText');

        const accuracyBadge = isInaccurate
            ? `<span style="font-size:11.5px; color:#b45309; background:#fffbeb; border:1px solid #fde68a; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="ti ti-alert-triangle"></i> GPS ước tính (~${accFormatted})</span>`
            : `<span style="font-size:11.5px; color:var(--primary-orange); background:var(--primary-light); border:1px solid #fed7aa; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="ti ti-check"></i> GPS chuẩn (~${accFormatted})</span>`;

        if (routeStats) {
            routeStats.innerHTML = `
                <span style="color:#0f172a;"><i class="ti ti-arrows-minimize" style="color:var(--primary);"></i> Khoảng cách thẳng: <b>${distKm} km</b></span>
                <span style="font-size:11.5px; color:#b45309; background:#fffbeb; border:1px solid #fde68a; padding:2px 8px; border-radius:12px;">Đường chim bay</span>
                ${accuracyBadge}
            `;
        }
    }

    function closeMapModal() {
        const modal = document.getElementById('mapModal');
        if (modal) modal.style.display = 'none';
        const alertBox = document.getElementById('mapAccuracyAlert');
        if (alertBox) alertBox.style.display = 'none';
        
        setRecalculatingState(false);
        hasCalculatedRoute = false;
        
        if (liveRoutingWatchId) {
            navigator.geolocation.clearWatch(liveRoutingWatchId);
            liveRoutingWatchId = null;
        }
    }



    function confirmPaymentWorker(applicationId) {
        if (!confirm("Bạn xác nhận đã nhận đủ tiền lương cho công việc này?")) return;

        fetch(`/api/v1/application/payment?applicationId=${applicationId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => {
                if (res.status === 403) {
                    alert("Bạn không có quyền xác nhận nhận tiền cho đơn này!");
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(apiRes => {
                if (apiRes.code === 200 || apiRes.success) {
                    alert("Đã xác nhận nhận tiền thành công! Ca làm sẽ chính thức hoàn thành khi Nhà tuyển dụng xác nhận hài lòng.");
                    loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab);
                } else {
                    alert("Lỗi: " + (apiRes.message || "Thao tác thất bại"));
                }
            })
            .catch(err => {
                console.error("Lỗi:", err);
                alert("Lỗi kết nối máy chủ!");
            });
    }

    let currentReportAppId = null;
    let reportSelectedFiles = [];

    function openReportModal(applicationId, jobTitle) {
        currentReportAppId = applicationId;
        document.getElementById('reportJobTitle').innerText = jobTitle || 'Công việc';
        document.getElementById('reportDetailText').value = '';
        reportSelectedFiles = [];
        renderReportPreview();
        const fileInput = document.getElementById('reportFileInput');
        if (fileInput) fileInput.value = '';
        document.getElementById('reportModal').style.display = 'flex';
    }

    function closeReportModal() {
        document.getElementById('reportModal').style.display = 'none';
        currentReportAppId = null;
        reportSelectedFiles = [];
    }

    function handleReportFilesSelected(event) {
        const files = Array.from(event.target.files);
        let imageCount = reportSelectedFiles.filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name)).length;
        let videoCount = reportSelectedFiles.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(f.name)).length;

        for (const file of files) {
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(file.name);
            const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(file.name);

            if (!isImage && !isVideo) {
                alert(`Tệp "${file.name}" không hợp lệ. Chỉ chấp nhận ảnh và video.`);
                continue;
            }

            if (isVideo) {
                if (videoCount >= 1) {
                    alert("Bạn chỉ được tải tối đa 1 video làm bằng chứng.");
                    continue;
                }
                if (file.size > 50 * 1024 * 1024) {
                    alert(`Video "${file.name}" vượt quá dung lượng tối đa cho phép (50MB).`);
                    continue;
                }
                videoCount++;
                reportSelectedFiles.push(file);
            } else if (isImage) {
                if (imageCount >= 5) {
                    alert("Bạn chỉ được tải tối đa 5 hình ảnh làm bằng chứng.");
                    continue;
                }
                if (file.size > 15 * 1024 * 1024) {
                    alert(`Hình ảnh "${file.name}" vượt quá dung lượng cho phép (15MB).`);
                    continue;
                }
                imageCount++;
                reportSelectedFiles.push(file);
            }
        }

        renderReportPreview();
        event.target.value = '';
    }

    function removeReportFile(index) {
        reportSelectedFiles.splice(index, 1);
        renderReportPreview();
    }

    function renderReportPreview() {
        const container = document.getElementById('reportMediaPreview');
        if (!container) return;
        container.innerHTML = '';

        reportSelectedFiles.forEach((file, idx) => {
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(file.name);
            const itemBox = document.createElement('div');
            itemBox.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #0f172a; display: flex; align-items: center; justify-content: center;';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.type = 'button';
            removeBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 13px; line-height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeReportFile(idx);
            };
            itemBox.appendChild(removeBtn);

            if (isVideo) {
                const videoElem = document.createElement('video');
                videoElem.src = URL.createObjectURL(file);
                videoElem.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                itemBox.appendChild(videoElem);

                const badge = document.createElement('div');
                badge.innerText = 'VIDEO';
                badge.style.cssText = 'position: absolute; bottom: 2px; left: 2px; background: rgba(220,38,38,0.9); color: #fff; font-size: 8.5px; font-weight: bold; padding: 1px 4px; border-radius: 3px;';
                itemBox.appendChild(badge);
            } else {
                const imgElem = document.createElement('img');
                imgElem.src = URL.createObjectURL(file);
                imgElem.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                itemBox.appendChild(imgElem);
            }

            container.appendChild(itemBox);
        });
    }

    function submitReport() {
        const details = document.getElementById('reportDetailText').value.trim();

        if (!details) {
            alert("Vui lòng nhập mô tả chi tiết sự việc để hệ thống hỗ trợ can thiệp!");
            return;
        }

        const btn = document.getElementById('btnSubmitReport');
        btn.disabled = true;
        btn.innerText = "Đang gửi báo cáo...";

        const formData = new FormData();
        formData.append('applicationId', currentReportAppId);
        formData.append('reason', details);

        reportSelectedFiles.forEach(file => {
            formData.append('files', file);
        });

        fetch(`/api/v1/report`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            body: formData
        })
            .then(res => res.json())
            .then(apiRes => {
                btn.disabled = false;
                btn.innerText = "Gửi khiếu nại";
                if (apiRes.code === 200 || apiRes.code === 201 || apiRes.success) {
                    alert("Khiếu nại của bạn và bằng chứng đã được gửi thành công! Quản trị viên đã tiếp nhận thông tin.");
                    closeReportModal();
                    if (typeof loadAppliedJobs === 'function') loadAppliedJobs();
                } else {
                    alert("Lỗi: " + (apiRes.message || "Không thể gửi khiếu nại"));
                }
            })
            .catch(err => {
                btn.disabled = false;
                btn.innerText = "Gửi khiếu nại";
                console.error("Lỗi:", err);
                alert("Lỗi kết nối máy chủ khi gửi báo cáo!");
            });
    }

    // XỬ LÝ ĐÁNH GIÁ NHÀ TUYỂN DỤNG
    let currentReviewApplicationId = null;
    let selectedRatingScore = 5;

    const ratingDescriptions = {
        1: "Rất không hài lòng (1 sao)",
        2: "Không hài lòng (2 sao)",
        3: "Bình thường (3 sao)",
        4: "Hài lòng (4 sao)",
        5: "Rất hài lòng & Xuất sắc (5 sao)"
    };

    function openReviewModal(applicationId, jobTitle, employerName) {
        currentReviewApplicationId = applicationId;
        document.getElementById('reviewJobTitle').innerText = jobTitle || 'Công việc';
        document.getElementById('reviewEmployerName').innerText = employerName || 'Nhà tuyển dụng';
        document.getElementById('reviewCommentText').value = '';
        selectRating(5);
        document.getElementById('reviewModal').style.display = 'flex';
    }

    function closeReviewModal() {
        document.getElementById('reviewModal').style.display = 'none';
        currentReviewApplicationId = null;
    }

    function selectRating(rating) {
        selectedRatingScore = rating;
        renderReviewStars(rating);
        const descElem = document.getElementById('ratingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[rating] || `${rating} sao`;
        }
    }

    function hoverRating(rating) {
        renderReviewStars(rating);
        const descElem = document.getElementById('ratingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[rating] || `${rating} sao`;
        }
    }

    function resetHoverRating() {
        renderReviewStars(selectedRatingScore);
        const descElem = document.getElementById('ratingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[selectedRatingScore] || `${selectedRatingScore} sao`;
        }
    }

    function renderReviewStars(rating) {
        const stars = document.querySelectorAll('#reviewStarRating .star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('selected');
            } else {
                star.classList.remove('selected');
            }
        });
    }

    function submitReview() {
        if (!currentReviewApplicationId) return;

        const submitBtn = document.getElementById('btnSubmitReview');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang gửi...`;

        const comment = document.getElementById('reviewCommentText').value.trim();

        fetch('/api/v1/review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                applicationId: currentReviewApplicationId,
                rating: selectedRatingScore,
                comment: comment
            })
        })
        .then(res => res.json())
        .then(apiRes => {
            if (apiRes.code === 200 || apiRes.code === 201) {
                alert("Cảm ơn bạn đã gửi đánh giá cho đối tác!");
                closeReviewModal();
                loadJobs(currentTabStatus, currentTabType, currentIsHistoryTab);
            } else {
                alert("Lỗi: " + (apiRes.message || "Không thể gửi đánh giá"));
            }
        })
        .catch(err => {
            console.error("Review error:", err);
            alert("Lỗi kết nối khi gửi đánh giá!");
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Gửi đánh giá`;
        });
    }

    function respond(applicationId, isAccepted) {
        let confirmMsg = isAccepted ? "Xác nhận NHẬN công việc này?" : "Bạn muốn TỪ CHỐI lời mời này?";
        if (!confirm(confirmMsg)) return;

        const apiUrl = `/api/v1/application/isacceptinvitation`;

        fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                applicationId: applicationId,
                isAccepted: isAccepted
            })
        })
            .then(res => {
                if (res.status === 403) {
                    alert("Bạn không có quyền phản hồi lời mời này!");
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(data => {
                if (data.code === 200 || data.success) {
                    alert(isAccepted ? "Nhận việc thành công! Hãy kiểm tra tab 'Sắp làm'" : "Đã từ chối lời mời.");
                    document.getElementById(`app-${applicationId}`).style.display = 'none';
                } else {
                    alert("Lỗi: " + (data.message || "Thao tác thất bại"));
                }
            })
            .catch(err => {
                console.error("Lỗi:", err);
                alert("Lỗi kết nối máy chủ!");
            });
    }

    function openScanner() {
        window.location.href = '/interface/scanner';
    }

    // Tự động tải lại danh sách khi nhận được thông báo mới
    window.addEventListener('antgo:notification', function(e) {
        if (typeof loadJobs === 'function') {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) activeTab.click();
        }
    });
    window.addEventListener('flashjob:notification', function(e) {
        if (typeof loadJobs === 'function') {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) activeTab.click();
        }
    });

    function logout() {
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            localStorage.clear();
            window.location.href = '/interface/authentication';
        }
    }
