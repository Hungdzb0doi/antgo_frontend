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
            qrTitle.style.color = "var(--success)";
        } else {
            btnCheckout.classList.add('active');
            btnCheckin.classList.remove('active');
            qrTitle.innerText = "Quét mã để Chốt giờ nghỉ";
            qrTitle.style.color = "var(--danger)";
        }

        resetTimer();
        fetchSecureQrData();
    }

    function fetchSecureQrData() {
        if(isRequesting) return;

        isRequesting = true;
        document.getElementById('qr-loading').style.display = 'flex'; // Hiện icon xoay xoay

        fetch(`http://localhost:8083/api/v1/application/qrdata?jobId=${jobId}&action=${currentAction}`, {
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
                // Có thể thêm 1 thông báo nhỏ trên UI nếu rớt mạng
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
        let socket = new SockJS('http://localhost:8083/ws');
        let stompClient = Stomp.over(socket);
        stompClient.debug = null;

        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function () {
            stompClient.subscribe(`/topic/job/${jobId}`, function (message) {
                const data = JSON.parse(message.body);

                // Tự động mở popup thanh toán cho Chủ khi Thợ checkout
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

    function openEmployerModal(data) {
        activeCheckoutAppId = data.applicationId;
        document.getElementById('emp-worker-name').innerText = data.workerName || "Thợ";
        document.getElementById('emp-hours').innerText = (data.hoursWorked || 0) + " giờ";
        const total = data.totalEarned ? new Intl.NumberFormat('vi-VN').format(data.totalEarned) + " VNĐ" : "0 VNĐ";
        document.getElementById('emp-total').innerText = total;

        const paidBadge = document.getElementById('emp-worker-paid-badge');
        if (paidBadge) paidBadge.style.display = 'none';

        const btn = document.getElementById('btn-emp-confirm');
        btn.disabled = false;
        btn.style.background = "var(--success)";
        btn.innerHTML = `<i class="ti ti-thumb-up"></i> Xác nhận hài lòng`;

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

        fetch(`http://localhost:8083/api/v1/application/satisfaction?applicationId=${activeCheckoutAppId}`, {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => res.json())
        .then(res => {
            if (res.code === 200) {
                btn.style.background = "var(--text-sub)";
                btn.innerHTML = `<i class="ti ti-check-double"></i> Đã xác nhận`;
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

    function promptReport() {
        const reason = prompt("Vui lòng nhập vấn đề bạn gặp phải (ví dụ: thái độ thợ, thợ không đến...):");
        if (reason && reason.trim() !== '') {
            alert("Đã gửi báo cáo thành công! Chúng tôi sẽ xem xét và phản hồi sớm nhất.");
        }
    }

    function logout() {
        localStorage.clear();
        window.location.href = '/interface/authentication';
    }
