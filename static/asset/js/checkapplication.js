const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');
    const urlParams = new URLSearchParams(window.location.search);
    const urlJobId = urlParams.get('jobId');
    const jobId = urlJobId || localStorage.getItem('currentJobId');
    if (urlJobId) {
        localStorage.setItem('currentJobId', urlJobId);
    }
    let appsDataMap = {};
    let currentTabType = 'APPLICATION';
    let currentJobStatus = 'OPEN';

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập!");
            window.location.href = "/interface/authentication";
            return;
        }
        if (String(currentMode || '').toUpperCase() !== 'EMPLOYER') {
            alert("Trang duyệt ứng viên chỉ dành cho Nhà tuyển dụng! Vui lòng chuyển vai trò trong trang Cá nhân.");
            window.location.href = "/interface/manageapplication";
            return;
        }
        if (!jobId) {
            alert("Không tìm thấy mã công việc cần xem đơn!");
            window.location.href = "/interface/managejob";
            return;
        }
        loadApplications('APPLICATION');
    });

    // CHUYỂN TAB (ĐƠN ỨNG TUYỂN / LỜI MỜI RADAR)
    function switchAppTab(tabType) {
        currentTabType = tabType;
        document.querySelectorAll('.app-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
        if (tabType === 'APPLICATION') {
            const btnApp = document.getElementById('tab-btn-applications');
            if (btnApp) btnApp.classList.add('active');
        } else {
            const btnInv = document.getElementById('tab-btn-invitations');
            if (btnInv) btnInv.classList.add('active');
        }
        loadApplications(tabType);
    }

    // 1. TẢI DANH SÁCH ỨNG TUYỂN (Dùng API GET /job)
    function loadApplications(filterType = currentTabType) {
        let url = `/api/v1/application/job?jobId=${jobId}`;
        if (currentJobStatus === 'OPEN' && filterType) {
            url += `&type=${filterType}`;
        }
        fetch(url, {
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
                    alert("Bạn không có quyền xem đơn ứng tuyển của công việc này (Yêu cầu vai trò Nhà tuyển dụng)!");
                    window.location.href = "/interface/managejob";
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(apiRes => {
                const apps = apiRes.data || [];
                const jobStatus = apps.length > 0 ? (apps[0].jobStatus || 'OPEN') : currentJobStatus;
                currentJobStatus = jobStatus;

                // Cập nhật tiêu đề công việc & cảnh báo trạng thái
                if (apps.length > 0 && apps[0].jobTitle) {
                    document.getElementById('page-job-title').innerText = apps[0].jobTitle;
                } else {
                    document.getElementById('page-job-title').innerText = "Duyệt Đơn Ứng Tuyển";
                }

                const tabsContainer = document.getElementById('app-tabs-container');
                const sectionTitle = document.querySelector('.section-title');
                const appCount = document.getElementById('app-count');

                if (jobStatus === 'COMPLETED') {
                    if (tabsContainer) tabsContainer.style.display = 'none';
                    if (sectionTitle) sectionTitle.innerText = "Đánh giá & Danh sách ứng viên hoàn thành";
                    if (appCount) appCount.innerText = `${apps.length} ứng viên`;
                } else if (jobStatus === 'IN_PROGRESS') {
                    if (tabsContainer) tabsContainer.style.display = 'none';
                    if (sectionTitle) sectionTitle.innerText = "Danh sách ứng viên trong ca làm";
                    if (appCount) appCount.innerText = `${apps.length} ứng viên`;
                } else {
                    // Trạng thái OPEN: Chỉ đưa ứng viên đã ứng tuyển trong tab mặc định
                    if (tabsContainer) tabsContainer.style.display = 'flex';
                    if (filterType === 'INVITATION') {
                        if (sectionTitle) sectionTitle.innerText = "Lời mời gửi qua Radar";
                        if (appCount) appCount.innerText = `${apps.length} lời mời`;
                        const badgeInv = document.getElementById('badge-tab-inv');
                        if (badgeInv) badgeInv.innerText = apps.length;
                    } else {
                        if (sectionTitle) sectionTitle.innerText = "Danh sách ứng viên ứng tuyển";
                        if (appCount) appCount.innerText = `${apps.length} hồ sơ`;
                        const badgeApp = document.getElementById('badge-tab-app');
                        if (badgeApp) badgeApp.innerText = apps.length;
                    }
                }

                const alertBox = document.getElementById('job-status-alert');
                if (alertBox) {
                    if (jobStatus === 'IN_PROGRESS') {
                        alertBox.style.display = 'flex';
                        alertBox.style.background = '#fffbeb';
                        alertBox.style.color = '#b45309';
                        alertBox.style.border = '1px solid #fde68a';
                        alertBox.innerHTML = '<i class="ti ti-player-play" style="font-size:18px;"></i> <span>Công việc đang diễn ra. Đã chốt danh sách ứng viên và các đơn chưa duyệt đã tự động đóng.</span>';
                    } else if (jobStatus === 'COMPLETED') {
                        alertBox.style.display = 'flex';
                        alertBox.style.background = 'var(--primary-light)';
                        alertBox.style.color = '#C2410C';
                        alertBox.style.border = '1px solid #FED7AA';
                        alertBox.innerHTML = '<i class="ti ti-check" style="font-size:18px; color:var(--primary-orange);"></i> <span>Công việc đã hoàn thành. Hãy đánh giá các ứng viên bên dưới để hoàn tất ca làm.</span>';
                    } else if (jobStatus === 'CANCELLED') {
                        alertBox.style.display = 'flex';
                        alertBox.style.background = '#F4F4F5';
                        alertBox.style.color = 'var(--black-main)';
                        alertBox.style.border = '1px solid var(--border-line)';
                        alertBox.innerHTML = '<i class="ti ti-alert-triangle" style="font-size:18px; color:var(--primary-orange);"></i> <span>Công việc đã bị hủy do quá giờ bắt đầu hoặc lý do khác.</span>';
                    } else {
                        alertBox.style.display = 'none';
                    }
                }

                renderAppList(apps, jobStatus);
            })
            .catch(err => {
                console.error("Lỗi:", err);
                document.getElementById('app-list-container').innerHTML = `<p style="color:var(--text-sub); text-align:center;">Lỗi kết nối máy chủ!</p>`;
            });
    }

    // 2. VẼ DANH SÁCH
    function renderAppList(apps, jobStatus) {
        const container = document.getElementById('app-list-container');
        if (apps.length === 0) {
            let emptyMsg = "Chưa có ứng viên nào nộp đơn ứng tuyển cho công việc này.";
            if (currentTabType === 'INVITATION' && jobStatus === 'OPEN') {
                emptyMsg = "Chưa có lời mời nhận việc nào được gửi qua Radar.";
            } else if (jobStatus === 'COMPLETED') {
                emptyMsg = "Không tìm thấy ứng viên nào hoàn thành công việc này để đánh giá.";
            } else if (jobStatus === 'IN_PROGRESS') {
                emptyMsg = "Chưa có ứng viên nào tham gia ca làm việc này.";
            }
            container.innerHTML = `
                <div style="text-align: center; color: #94a3b8; padding: 40px; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                    <p>${emptyMsg}</p>
                </div>`;
            return;
        }

        let html = "";
        appsDataMap = {};

        apps.forEach(app => {
            appsDataMap[app.applicationId] = app;

            // Xử lý avatar với universal utility (Drive ID, external, brand fallback)
            let avatar = (typeof resolveAvatarUrl === 'function') 
                ? resolveAvatarUrl(app.workerAvatar, app.workerName) 
                : (app.workerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.workerName)}&background=18181b&color=ff6600&size=128&bold=true`);
            let displayPhone = app.status === 'PENDING' ? app.phone.substring(0,4) + '***' + app.phone.substring(7) : app.phone;
            let timeStr = app.createdAt ? new Date(app.createdAt).toLocaleString('vi-VN', {hour: '2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : 'Mới đây';
            let scoreStr = app.workerScore != null ? app.workerScore : 'Chưa có';

            // Icon xác thực CCCD
            let verifiedIcon = app.identityVerified ? `<i class="ti ti-discount-check-filled" style="color: var(--primary-orange);" title="Đã xác thực CCCD"></i>` : '';

            // Badge loại đơn (Tự ứng tuyển vs Được mời)
            let typeBadge = '';
            if (app.type === 'INVITATION') {
                typeBadge = `<span class="tag" style="background:var(--primary-light); color:var(--primary-orange); border:1px solid #fed7aa; padding:2px 8px; border-radius:6px; font-weight:600;"><i class="ti ti-mail-check"></i> Được mời</span>`;
            } else {
                typeBadge = `<span class="tag" style="background:#f8fafc; color:#475569; padding:2px 8px; border-radius:6px; font-weight:600;"><i class="ti ti-file-text"></i> Tự ứng tuyển</span>`;
            }

            let actionHtml = '';

            // Nút flag khiếu nại ứng viên
            let reportFlag = '';
            if (app.hasReported) {
                reportFlag = `<span class="badge" style="background:#18181B; color:#ffffff; border:1px solid #18181B; font-size:11px; padding:3px 8px; border-radius:6px;" title="Bạn đã gửi khiếu nại ứng viên này"><i class="ti ti-check" style="color:var(--primary-orange);"></i> Đã báo cáo</span>`;
            } else if (['BOOKED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(app.status)) {
                let disputeNote = app.isDisputed ? `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:11px; padding:2px 6px; margin-right:4px;" title="Ứng viên đã gửi khiếu nại đối ứng"><i class="ti ti-alert-triangle"></i> Đang tranh chấp</span>` : '';
                reportFlag = `${disputeNote}<button class="btn-report-flag" onclick="openEmployerReportModal('${app.applicationId}', '${escapeQuote(app.workerName)}')" title="Báo cáo / Khiếu nại ứng viên"><i class="ti ti-flag"></i></button>`;
            }

            // Với LỜI MỜI khi đang OPEN: Do ứng viên quyết định, nhà tuyển dụng không duyệt thay
            if (app.type === 'INVITATION' && jobStatus === 'OPEN') {
                if (app.status === 'PENDING') {
                    actionHtml = `
                        <div class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;">
                            <i class="ti ti-clock"></i> Đang chờ ứng viên quyết định
                        </div>
                        <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Xem hồ sơ</button>
                    `;
                } else if (app.status === 'BOOKED') {
                    actionHtml = `
                        <div class="badge badge-accepted">
                            <i class="ti ti-check" style="color:var(--primary-orange);"></i> Ứng viên đã nhận lời
                        </div>
                        <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Xem hồ sơ</button>
                    `;
                } else {
                    actionHtml = `
                        <div class="badge badge-rejected">
                            <i class="ti ti-x"></i> Ứng viên đã từ chối
                        </div>
                    `;
                }
            } else if (app.status === 'PENDING') {
                if (jobStatus && jobStatus !== 'OPEN') {
                    actionHtml = `<div class="badge badge-rejected"><i class="ti ti-clock-x"></i> Hết hạn</div>
                                  <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Xem hồ sơ</button>`;
                } else {
                    actionHtml = `
                        <button class="btn btn-primary" onclick="respondApp('${app.applicationId}', true)">Chấp nhận</button>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-outline" style="flex:1;" onclick="viewDetail('${app.applicationId}')">Xem</button>
                            <button class="btn btn-outline" style="flex:1; color: var(--text-sub);" onclick="respondApp('${app.applicationId}', false)">Từ chối</button>
                        </div>
                    `;
                }
            } else if (app.status === 'BOOKED') {
                actionHtml = `<div class="badge badge-accepted"><i class="ti ti-check" style="color:var(--primary-orange);"></i> Đã nhận</div>
                              <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Liên hệ</button>`;
            } else if (app.status === 'IN_PROGRESS') {
                if (app.checkOutAt) {
                    let satisfactionAction = '';
                    if (!app.employerConfirmed) {
                        satisfactionAction = `<button class="btn btn-primary" style="margin-top:4px; background:var(--primary-orange); border:none; display:inline-flex; align-items:center; gap:4px;" onclick="confirmEmployerSatisfaction('${app.applicationId}')"><i class="ti ti-thumb-up"></i> Xác nhận hài lòng</button>`;
                    } else {
                        satisfactionAction = `<span style="font-size:12px; color:var(--black-main); font-weight:600; margin-top:4px; display:inline-flex; align-items:center; gap:3px;"><i class="ti ti-check" style="color:var(--primary-orange);"></i> Đã xác nhận hài lòng</span>`;
                    }
                    actionHtml = `<div class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;"><i class="ti ti-logout"></i> Đã ra ca</div>
                                  ${satisfactionAction}
                                  <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Chi tiết</button>`;
                } else {
                    actionHtml = `<div class="badge" style="background:#fffbeb; color:#b45309; border:1px solid #fde68a;"><i class="ti ti-loader ti-spin"></i> Đang làm</div>
                                  <button class="btn btn-outline" style="margin-top:4px;" onclick="viewDetail('${app.applicationId}')">Liên hệ</button>`;
                }
            } else if (app.status === 'COMPLETED') {
                let reviewBtn = '';
                if (app.isReviewed) {
                    const starsStr = '★'.repeat(app.reviewRating || 5) + '☆'.repeat(5 - (app.reviewRating || 5));
                    reviewBtn = `
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin-top:4px;">
                            <button class="btn btn-outline" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; cursor:default;" disabled>
                                <span style="color:#f59e0b; font-size:14px; margin-right:3px;">${starsStr}</span> (${app.reviewRating || 5}★)
                            </button>
                            ${app.reviewComment ? `<div style="font-size:11.5px; color:#475569; background:#f8fafc; border-left:3px solid #f59e0b; padding:4px 8px; border-radius:4px; font-style:italic; max-width:240px; text-align:left;">
                                <i class="ti ti-quote" style="color:#f59e0b;"></i> "${escapeQuote(app.reviewComment)}"
                            </div>` : ''}
                        </div>`;
                } else {
                    reviewBtn = `<button class="btn btn-primary" style="margin-top:4px; background:var(--primary-orange); border:none; display:inline-flex; align-items:center; gap:4px;" onclick="openEmployerReviewModal('${app.applicationId}', '${escapeQuote(app.workerName)}')"><span style="font-size:15px;">★</span> Đánh giá Ứng viên</button>`;
                }
                actionHtml = `<div class="badge badge-accepted"><i class="ti ti-check" style="color:var(--primary-orange);"></i> Hoàn thành</div>
                              ${reviewBtn}`;
            } else if (app.status === 'NO_SHOW') {
                actionHtml = `<div class="badge badge-rejected"><i class="ti ti-alert-triangle"></i> Bỏ ca</div>`;
            } else {
                const cancelLabel = (jobStatus && jobStatus !== 'OPEN') ? 'Đã đóng / Hết hạn' : 'Đã từ chối';
                actionHtml = `<div class="badge badge-rejected">${cancelLabel}</div>`;
            }

            // Nút nhắn tin
            const chatJobTitle = app.jobTitle || (document.getElementById('page-job-title') ? document.getElementById('page-job-title').innerText : '');
            actionHtml += `
                <button class="btn btn-secondary" style="margin-top:8px; width:100%;" onclick="if(window.openChatByAppId) window.openChatByAppId('${app.applicationId}', '${escapeQuote(app.workerName)}', '${escapeQuote(chatJobTitle)}', '${escapeQuote(avatar)}', null, 'WORKER'); else alert('Tính năng nhắn tin đang tải...');">
                    <i class="ti ti-message-circle"></i> Nhắn tin
                </button>`;

            html += `
                <div class="app-card" id="card-${app.applicationId}">
                    <img src="${avatar}" class="worker-avatar" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(app.workerName)}');">
                    <div class="worker-info">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
                            <h4 style="margin:0;">${app.workerName} ${verifiedIcon}</h4>
                            ${reportFlag}
                        </div>
                        <div class="info-tags">
                            ${typeBadge}
                            <span class="tag"><i class="ti ti-star"></i> ${scoreStr} / 100</span>
                            <span class="tag"><i class="ti ti-phone"></i> ${displayPhone}</span>
                        </div>
                        <span class="time-text">Gửi lúc ${timeStr}</span>
                    </div>
                    <div class="card-actions" id="actions-${app.applicationId}">
                        ${actionHtml}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // 3. XỬ LÝ PHẢN HỒI (Dùng API PUT /isacceptapplication)
    function respondApp(applicationId, isAccepted) {
        if (!confirm(isAccepted ? "Xác nhận giao việc cho ứng viên này?" : "Xác nhận từ chối?")) return;

        const actionsDiv = document.getElementById(`actions-${applicationId}`);
        actionsDiv.innerHTML = `<button class="btn btn-outline" disabled style="width:100%; border:none;"><i class="ti ti-loader ti-spin"></i> Đang xử lý...</button>`;

        const payload = {
            applicationId: applicationId,
            isAccepted: isAccepted
        };

        fetch(`/api/v1/application/isacceptapplication`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (res.status === 403) {
                    alert("Bạn không có quyền duyệt ứng viên cho công việc này!");
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(data => {
                if (data.code === 200 || data.success) {
                    // Cập nhật state local và vẽ lại list
                    appsDataMap[applicationId].status = isAccepted ? 'BOOKED' : 'CANCELLED';
                    renderAppList(Object.values(appsDataMap));
                } else {
                    alert("Lỗi: " + (data.message || "Xử lý thất bại"));
                    renderAppList(Object.values(appsDataMap)); // Khôi phục UI
                }
            })
            .catch(err => {
                alert("Lỗi máy chủ!");
                renderAppList(Object.values(appsDataMap));
            });
    }

    // 4. HIỂN THỊ CHI TIẾT
    function viewDetail(applicationId) {
        const app = appsDataMap[applicationId];
        let avatar = (typeof resolveAvatarUrl === 'function') 
            ? resolveAvatarUrl(app.workerAvatar, app.workerName) 
            : (app.workerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.workerName)}&background=18181b&color=ff6600&size=128&bold=true`);
        let displayPhone = ( app.status === 'BOOKED') ? app.phone : app.phone.substring(0,4) + '***' + app.phone.substring(7);
        let phoneNote = app.status === 'PENDING' ? '<div style="font-size:12px; color:var(--text-sub); margin-top:4px;">Chấp nhận để xem số đầy đủ</div>' : '';
        let verifiedIcon = app.identityVerified ? `<i class="ti ti-discount-check-filled" style="color: var(--primary-orange);" title="Đã xác thực CCCD"></i>` : '';

        let html = `
            <div class="profile-banner">
                <img src="${avatar}" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(app.workerName)}');">
                <div>
                    <h3 style="margin:0 0 4px; font-size:18px; display:flex; align-items:center; gap:6px;">
                        ${app.workerName} ${verifiedIcon}
                    </h3>
                    <div style="font-size:13px; color:var(--text-sub);">Điểm uy tín: ${app.workerScore != null ? app.workerScore : '100'}/100</div>
                </div>
            </div>

            <div>
                <div class="detail-row">
                    <i class="ti ti-phone detail-icon"></i>
                    <div>
                        <div style="font-size:13px; color:var(--text-sub);">Số điện thoại</div>
                        <div style="font-weight:600; font-size:16px;">${displayPhone}</div>
                        ${phoneNote}
                    </div>
                </div>
                <div class="detail-row">
                    <i class="ti ti-shield-check detail-icon"></i>
                    <div>
                        <div style="font-size:13px; color:var(--text-sub);">Xác thực danh tính</div>
                        <div style="font-weight:500; color:${app.identityVerified ? 'var(--primary-orange)' : 'var(--text-main)'};">
                            ${app.identityVerified ? 'Đã xác thực CCCD' : 'Chưa xác thực'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('modal-body-content').innerHTML = html;
        document.getElementById('worker-modal').style.display = 'flex';
    }

    function closeModal() { document.getElementById('worker-modal').style.display = 'none'; }

    function escapeQuote(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // XỬ LÝ ĐÁNH GIÁ ỨNG VIÊN (DÀNH CHO NHÀ TUYỂN DỤNG)
    let currentEmployerReviewAppId = null;
    let selectedEmployerRatingScore = 5;

    const ratingDescriptions = {
        1: "Rất không hài lòng (1 sao)",
        2: "Không hài lòng (2 sao)",
        3: "Bình thường (3 sao)",
        4: "Hài lòng (4 sao)",
        5: "Rất hài lòng & Xuất sắc (5 sao)"
    };

    function openEmployerReviewModal(applicationId, workerName) {
        currentEmployerReviewAppId = applicationId;
        document.getElementById('employerReviewWorkerName').innerText = workerName || 'Ứng viên';
        document.getElementById('employerReviewCommentText').value = '';
        selectEmployerRating(5);
        document.getElementById('employerReviewModal').style.display = 'flex';
    }

    function closeEmployerReviewModal() {
        document.getElementById('employerReviewModal').style.display = 'none';
        currentEmployerReviewAppId = null;
    }

    function selectEmployerRating(rating) {
        selectedEmployerRatingScore = rating;
        renderEmployerStars(rating);
        const descElem = document.getElementById('employerRatingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[rating] || `${rating} sao`;
        }
    }

    function hoverEmployerRating(rating) {
        renderEmployerStars(rating);
        const descElem = document.getElementById('employerRatingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[rating] || `${rating} sao`;
        }
    }

    function resetHoverEmployerRating() {
        renderEmployerStars(selectedEmployerRatingScore);
        const descElem = document.getElementById('employerRatingTextDesc');
        if (descElem) {
            descElem.innerText = ratingDescriptions[selectedEmployerRatingScore] || `${selectedEmployerRatingScore} sao`;
        }
    }

    function renderEmployerStars(rating) {
        const stars = document.querySelectorAll('#employerReviewStarRating .star');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('selected');
            } else {
                star.classList.remove('selected');
            }
        });
    }

    function submitEmployerReview() {
        if (!currentEmployerReviewAppId) return;

        const btn = document.getElementById('btnSubmitEmployerReview');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang gửi...`;

        const comment = document.getElementById('employerReviewCommentText').value.trim();

        fetch('/api/v1/review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                applicationId: currentEmployerReviewAppId,
                rating: selectedEmployerRatingScore,
                comment: comment
            })
        })
        .then(res => res.json())
        .then(apiRes => {
            if (apiRes.code === 200 || apiRes.code === 201) {
                alert("Đã gửi đánh giá ứng viên thành công!");
                closeEmployerReviewModal();
                loadApplications();
            } else {
                alert("Lỗi: " + (apiRes.message || "Không thể gửi đánh giá"));
            }
        })
        .catch(err => {
            console.error("Review error:", err);
            alert("Lỗi kết nối khi gửi đánh giá!");
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = `Gửi đánh giá`;
        });
    }

    function confirmEmployerSatisfaction(applicationId) {
        if (!confirm("Bạn xác nhận hài lòng với ca làm của ứng viên này?")) return;
        fetch(`/api/v1/application/satisfaction?applicationId=${applicationId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => {
            if (res.status === 403) {
                alert("Bạn không có quyền xác nhận cho ca làm này!");
                throw new Error("403 Forbidden");
            }
            return res.json();
        })
        .then(res => {
            if (res.code === 200) {
                alert("Đã xác nhận hài lòng! Ca làm sẽ chính thức hoàn tất khi cả hai bên xác nhận xong.");
                loadApplications();
            } else {
                alert("Lỗi: " + (res.message || "Không thể xác nhận"));
            }
        })
        .catch(err => {
            console.error("Lỗi:", err);
            alert("Lỗi kết nối khi xác nhận!");
        });
    }

    // XỬ LÝ KHIẾU NẠI ỨNG VIÊN (DÀNH CHO NHÀ TUYỂN DỤNG)
    let currentEmployerReportAppId = null;
    let employerReportSelectedFiles = [];

    function openEmployerReportModal(applicationId, workerName) {
        currentEmployerReportAppId = applicationId;
        document.getElementById('employerReportWorkerName').innerText = workerName || 'Ứng viên';
        document.getElementById('employerReportDetailText').value = '';
        employerReportSelectedFiles = [];
        renderEmployerReportPreview();
        const fileInput = document.getElementById('employerReportFileInput');
        if (fileInput) fileInput.value = '';
        document.getElementById('employerReportModal').style.display = 'flex';
    }

    function closeEmployerReportModal() {
        document.getElementById('employerReportModal').style.display = 'none';
        currentEmployerReportAppId = null;
        employerReportSelectedFiles = [];
    }

    function handleEmployerReportFilesSelected(event) {
        const files = Array.from(event.target.files);
        let imageCount = employerReportSelectedFiles.filter(f => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(f.name)).length;
        let videoCount = employerReportSelectedFiles.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(f.name)).length;

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
                employerReportSelectedFiles.push(file);
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
                employerReportSelectedFiles.push(file);
            }
        }

        renderEmployerReportPreview();
        event.target.value = '';
    }

    function removeEmployerReportFile(index) {
        employerReportSelectedFiles.splice(index, 1);
        renderEmployerReportPreview();
    }

    function renderEmployerReportPreview() {
        const container = document.getElementById('employerReportMediaPreview');
        if (!container) return;
        container.innerHTML = '';

        employerReportSelectedFiles.forEach((file, idx) => {
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(file.name);
            const itemBox = document.createElement('div');
            itemBox.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #0f172a; display: flex; align-items: center; justify-content: center;';

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.type = 'button';
            removeBtn.style.cssText = 'position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 13px; line-height: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10;';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeEmployerReportFile(idx);
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

    function submitEmployerReport() {
        const details = document.getElementById('employerReportDetailText').value.trim();

        if (!details) {
            alert("Vui lòng nhập mô tả chi tiết sự việc để hệ thống hỗ trợ can thiệp!");
            return;
        }

        const btn = document.getElementById('btnSubmitEmployerReport');
        btn.disabled = true;
        btn.innerText = "Đang gửi báo cáo...";

        const formData = new FormData();
        formData.append('applicationId', currentEmployerReportAppId);
        formData.append('reason', details);

        employerReportSelectedFiles.forEach(file => {
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
            if (apiRes.code === 200 || apiRes.code === 201 ) {
                alert("Khiếu nại của bạn và bằng chứng đã được gửi thành công! Quản trị viên đã tiếp nhận thông tin.");
                closeEmployerReportModal();
                loadApplications();
            } else {
                alert("Lỗi: " + (apiRes.message || "Không thể gửi khiếu nại"));
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerText = "Gửi khiếu nại";
            console.error("Report error:", err);
            alert("Lỗi kết nối máy chủ khi gửi báo cáo!");
        });
    }

    function logout() {
        localStorage.clear();
        window.location.href = '/interface/authentication';
    }

    // Tự động tải lại khi có ứng viên mới ứng tuyển
    window.addEventListener('antgo:notification', function(e) {
        if (typeof loadApplications === 'function') loadApplications();
    });
    window.addEventListener('flashjob:notification', function(e) {
        if (typeof loadApplications === 'function') loadApplications();
    });
