const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');
    const jobId = localStorage.getItem('currentJobId');

    let qrcode = null;
    let currentAction = 'CHECKIN';
    let timeLeft = 30;
    let isRequesting = false; // Tránh spam API
    let timerInterval = null; // Quản lý vòng lặp đếm giờ

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        if (currentMode !== 'EMPLOYER') {
            alert("Trang tạo mã QR điểm danh chỉ dành cho Nhà tuyển dụng! Vui lòng dùng ứng dụng quét mã nếu bạn là Ứng viên.");
            window.location.href = "/interface/scanner";
            return;
        }

        // Kiểm tra xem có JobId từ trang trước truyền sang không
        if (!jobId) {
            alert("Lỗi: Không tìm thấy phiên làm việc. Vui lòng quay lại màn hình trước!");
            window.location.href = "/interface/managejob";
            return;
        }

        qrcode = new QRCode(document.getElementById("qrcode"), {
            width: 200, height: 200, colorDark : "#0f172a", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
        });

        fetchSecureQrData();
        startTimer();
        connectWebSocket();
    });

    function switchAction(action) {
        if (currentAction === action) return; // Nếu đang ở tab đó rồi thì không làm gì

        currentAction = action;
        const btnCheckin = document.getElementById('btn-checkin');
        const btnCheckout = document.getElementById('btn-checkout');
        const qrTitle = document.getElementById('qr-display-title');

        if (action === 'CHECKIN') {
            btnCheckin.classList.add('active');
            btnCheckout.classList.remove('active');
            qrTitle.innerText = "Quét mã để Bắt đầu làm";
            qrTitle.style.color = "var(--primary-orange)";
        } else {
            btnCheckout.classList.add('active');
            btnCheckin.classList.remove('active');
            qrTitle.innerText = "Quét mã để Chốt giờ nghỉ";
            qrTitle.style.color = "var(--black-main)";
        }

        resetTimer();
        fetchSecureQrData();
    }

    function fetchSecureQrData() {
        if(isRequesting) return;

        isRequesting = true;
        document.getElementById('qr-loading').style.display = 'flex'; // Hiện icon xoay xoay

        fetch(`/api/v1/application/qrdata?jobId=${jobId}&action=${currentAction}`, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        })
            .then(res => {
                if (res.status === 401) {
                    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                    window.location.href = "/interface/authentication";
                    throw new Error("401 Unauthorized");
                }
                if (res.status === 403) {
                    alert("Bạn không có quyền tạo mã QR cho công việc này (Yêu cầu vai trò Nhà tuyển dụng và là chủ việc)!");
                    window.location.href = "/interface/managejob";
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(apiRes => {
                if (apiRes.code === 200) {
                    // Xóa mã cũ trước khi vẽ mã mới
                    qrcode.clear();
                    qrcode.makeCode(apiRes.data);
                } else {
                    console.error("Lỗi từ server:", apiRes.message);
                    alert("Không thể tạo mã lúc này: " + apiRes.message);
                }
            })
            .catch(err => {
                console.error("Lỗi kết nối mạng:", err);
            })
            .finally(() => {
                isRequesting = false;
                document.getElementById('qr-loading').style.display = 'none'; // Ẩn icon xoay xoay
            });
    }

    function startTimer() {
        // Clear interval cũ nếu có để tránh chạy đè 2 vòng lặp
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeLeft--;
            document.getElementById('time-text').innerText = timeLeft;
            document.getElementById('progress-fill').style.width = (timeLeft / 30 * 100) + "%";

            if (timeLeft <= 0) {
                resetTimer();
                fetchSecureQrData();
            }
        }, 1000);
    }

    function resetTimer() {
        timeLeft = 30;
        document.getElementById('time-text').innerText = timeLeft;
        document.getElementById('progress-fill').style.width = "100%";
    }

    function connectWebSocket() {
        let socket = new SockJS('/ws');
        let stompClient = Stomp.over(socket);
        stompClient.debug = null;

        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function () {
            stompClient.subscribe(`/topic/job/${jobId}`, function (message) {
                const data = JSON.parse(message.body);

                // Tự động mở popup thanh toán cho Nhà tuyển dụng khi Ứng viên checkout
                if (data.action === 'CHECKOUT') {
                    openEmployerModal(data);
                }
                if (data.action === 'WORKER_CONFIRMED_PAYMENT') {
                    const badge = document.getElementById('emp-worker-paid-badge');
                    if (badge) badge.style.display = 'inline-flex';
                    if (data.isCompleted) {
                        alert("Ca làm đã hoàn tất do cả hai bên đã xác nhận!");
                        window.location.href = '/interface/managejob';
                    }
                }
                if (data.action === 'EMPLOYER_CONFIRMED_SATISFACTION') {
                    if (data.isCompleted) {
                        alert("Ca làm đã hoàn tất do cả hai bên đã xác nhận!");
                        window.location.href = '/interface/managejob';
                    }
                }
            });
        });
    }

    let activeCheckoutAppId = null;
    let activeCheckoutWorkerName = null;

    function openEmployerModal(data) {
        activeCheckoutAppId = data.applicationId;
        activeCheckoutWorkerName = data.workerName || "Ứng viên";
        document.getElementById('emp-worker-name').innerText = activeCheckoutWorkerName;

        const avatarEl = document.getElementById('emp-worker-avatar');
        if (avatarEl) {
            const workerAvatarUrl = (typeof resolveAvatarUrl === 'function')
                ? resolveAvatarUrl(data.workerAvatar, activeCheckoutWorkerName)
                : (data.workerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCheckoutWorkerName)}&background=18181b&color=ff6600&size=128&bold=true`);
            avatarEl.src = workerAvatarUrl;
            avatarEl.onerror = function() {
                if (typeof handleAvatarError === 'function') handleAvatarError(this, activeCheckoutWorkerName);
            };
        }

        document.getElementById('emp-hours').innerText = (data.hoursWorked || 0) + " giờ";
        const total = data.totalEarned ? new Intl.NumberFormat('vi-VN').format(data.totalEarned) + " VNĐ" : "0 VNĐ";
        document.getElementById('emp-total').innerText = total;

        const paidBadge = document.getElementById('emp-worker-paid-badge');
        if (paidBadge) paidBadge.style.display = 'none';

        const btn = document.getElementById('btn-emp-confirm');
        btn.disabled = false;
        btn.style.background = "var(--primary-orange)";
        btn.style.color = "#ffffff";
        btn.innerHTML = `<i class="ti ti-thumb-up"></i> Xác nhận hài lòng`;

        const btnReport = document.getElementById('btn-open-emp-report');
        if (btnReport) {
            btnReport.disabled = false;
            btnReport.style.opacity = '1';
            btnReport.innerHTML = `<i class="ti ti-alert-triangle"></i> Báo cáo vấn đề ca làm`;
        }

        document.getElementById('employer-payment-modal').style.display = 'flex';
    }

    function closeEmployerModal() {
        document.getElementById('employer-payment-modal').style.display = 'none';
    }

    function confirmSatisfactionAction() {
        if (!activeCheckoutAppId) return;
        const btn = document.getElementById('btn-emp-confirm');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang xác nhận...`;

        fetch(`/api/v1/application/satisfaction?applicationId=${activeCheckoutAppId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(res => {
            if (res.code === 200) {
                btn.style.background = "var(--black-main)";
                btn.innerHTML = `<i class="ti ti-check-double" style="color: var(--primary-orange);"></i> Đã xác nhận hài lòng`;
                // The redirect is now handled by WebSocket event
            } else {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-thumb-up"></i> Xác nhận hài lòng`;
                alert(res.message);
            }
        })
        .catch(() => {
            btn.disabled = false;
            btn.innerHTML = `<i class="ti ti-thumb-up"></i> Xác nhận hài lòng`;
            alert("Lỗi kết nối khi xác nhận!");
        });
    }

    // XỬ LÝ BÁO CÁO / KHIẾU NẠI CA LÀM DÀNH CHO NHÀ TUYỂN DỤNG
    let employerReportSelectedFiles = [];

    function openEmployerReportModal() {
        if (!activeCheckoutAppId) {
            alert("Không tìm thấy thông tin ca làm để báo cáo!");
            return;
        }
        const workerNameElem = document.getElementById('employerReportWorkerName');
        if (workerNameElem) workerNameElem.innerText = activeCheckoutWorkerName || 'Ứng viên';

        const detailElem = document.getElementById('employerReportDetailText');
        if (detailElem) detailElem.value = '';

        employerReportSelectedFiles = [];
        renderEmployerReportPreview();

        const fileInput = document.getElementById('employerReportFileInput');
        if (fileInput) fileInput.value = '';

        const modal = document.getElementById('employerReportModal');
        if (modal) modal.classList.add('active');
    }

    function closeEmployerReportModal() {
        const modal = document.getElementById('employerReportModal');
        if (modal) modal.classList.remove('active');
        employerReportSelectedFiles = [];
    }

    function handleEmployerReportFilesSelected(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        let imageCount = employerReportSelectedFiles.filter(f => f.type.startsWith('image/')).length;
        let videoCount = employerReportSelectedFiles.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(f.name)).length;

        for (let file of files) {
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
            itemBox.style.cssText = 'position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #0f172a; display: flex; align-items: center; justify-content: center;';

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
                badge.style.cssText = 'position: absolute; bottom: 2px; left: 2px; background: var(--black-main); color: #fff; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px;';
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

        if (!activeCheckoutAppId) {
            alert("Không tìm thấy thông tin ca làm để báo cáo!");
            return;
        }

        const btn = document.getElementById('btnSubmitEmployerReport');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang gửi báo cáo...`;

        const formData = new FormData();
        formData.append('applicationId', activeCheckoutAppId);
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
            btn.innerHTML = `Gửi báo cáo`;
            if (apiRes.code === 200 || apiRes.code === 201 || apiRes.success) {
                alert("Báo cáo của bạn và bằng chứng đã được gửi thành công! Quản trị viên (Admin) sẽ tiếp nhận và liên hệ hỗ trợ bạn sớm nhất.");
                closeEmployerReportModal();
                const reportBtn = document.getElementById('btn-open-emp-report');
                if (reportBtn) {
                    reportBtn.innerHTML = `<i class="ti ti-check" style="color:var(--primary-orange);"></i> Đã gửi báo cáo vấn đề`;
                    reportBtn.disabled = true;
                    reportBtn.style.opacity = '0.7';
                }
            } else {
                alert("Lỗi: " + (apiRes.message || "Không thể gửi báo cáo"));
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerHTML = `Gửi báo cáo`;
            console.error("Lỗi:", err);
            alert("Lỗi kết nối máy chủ khi gửi báo cáo!");
        });
    }

    function logout() {
        localStorage.clear();
        window.location.href = '/interface/authentication';
    }
