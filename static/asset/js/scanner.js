const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');
    let qrScanner = null;
    let scanning = false;
    let currentAppId = null;

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        if (currentMode !== 'WORKER') {
            alert("Trang quét mã QR chỉ dành cho Người tìm việc / Ứng viên! Vui lòng dùng trang Tạo mã QR nếu bạn là Nhà tuyển dụng.");
            window.location.href = "/interface/generateqr";
            return;
        }

        startScanner();
    });

    function startScanner() {
        document.getElementById('result-sheet').classList.remove('active');
        document.getElementById('payment-sheet').classList.remove('active');
        document.getElementById('main-ui').classList.remove('overlay-blur');

        // Xóa instance cũ nếu có
        if (qrScanner) {
            qrScanner.stop().catch(() => {}).finally(() => {
                document.getElementById('reader').innerHTML = '';
                initQr();
            });
        } else {
            initQr();
        }
    }

    function initQr() {
        qrScanner = new Html5Qrcode("reader");
        qrScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1.0 },
            onScanSuccess,
            () => {} // bỏ qua lỗi frame không tìm thấy QR
        ).then(() => {
            scanning = true;
        }).catch(() => {
            showResult('error', "Không mở được camera", "Vui lòng cấp quyền camera cho trình duyệt và thử lại.");
        });
    }

    function onScanSuccess(decodedText) {
        if (!scanning) return;
        scanning = false;

        qrScanner.stop().catch(() => {}).finally(() => {
            try {
                const payload = JSON.parse(decodedText);
                if (!payload.jobId || !payload.action || !payload.timestamp) throw new Error();
                
                // Connect to websocket to listen for employer's satisfaction confirmation
                connectWS(payload.jobId);
                
                sendToBackend(payload);
            } catch {
                showResult('error', "Mã không hợp lệ", "Mã QR này không thuộc hệ thống AntGo hoặc đã bị hỏng.");
            }
        });
    }

    let stompClient = null;
    function connectWS(jobId) {
        if (stompClient) return;
        let socket = new SockJS('http://localhost:8083/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function () {
            stompClient.subscribe(`/topic/job/${jobId}`, function (message) {
                const data = JSON.parse(message.body);
                if (data.action === 'EMPLOYER_CONFIRMED_SATISFACTION' && data.isCompleted) {
                    alert("Nhà tuyển dụng đã xác nhận hài lòng. Ca làm đã hoàn tất!");
                    window.location.href = '/interface/manageapplication';
                }
                if (data.action === 'WORKER_CONFIRMED_PAYMENT' && data.isCompleted) {
                    alert("Cả hai bên đã xác nhận. Ca làm hoàn tất!");
                    window.location.href = '/interface/manageapplication';
                }
            });
        });
    }

    function sendToBackend(payload) {
        showResult('loading', "Đang kiểm tra...", "Hệ thống đang xác thực, vui lòng đợi.");

        fetch('http://localhost:8083/api/v1/application/qrscanner', {
            method: 'PUT',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (res.status === 401) {
                showResult('error', "Phiên đăng nhập hết hạn", "Vui lòng đăng nhập lại để tiếp tục.");
                throw new Error("401 Unauthorized");
            }
            if (res.status === 403) {
                showResult('error', "Không có quyền", "Chỉ Ứng viên mới có thể quét mã điểm danh ca làm!");
                throw new Error("403 Forbidden");
            }
            return res.json();
        })
        .then(data => {
            if (data.code === 200) {
                if (payload.action === 'CHECKOUT' && data.data) {
                    showPaymentSheet(data.data);
                } else {
                    showResult('success', "Thành công!", "Vào ca thành công. Nhà tuyển dụng đã nhận được thông báo.");
                }
            } else {
                showResult('error', "Không thành công", data.message || "Không thể điểm danh lúc này.");
            }
        })
        .catch(err => {
            if (err.message !== "401 Unauthorized" && err.message !== "403 Forbidden") {
                showResult('error', "Lỗi kết nối", "Vui lòng kiểm tra lại mạng và thử lại.");
            }
        });
    }

    function showPaymentSheet(data) {
        currentAppId = data.applicationId;
        document.getElementById('result-sheet').classList.remove('active');
        document.getElementById('pay-hours').innerText = (data.hoursWorked || 0) + " giờ";
        document.getElementById('pay-rate').innerText = data.hourlyRate ? new Intl.NumberFormat('vi-VN').format(data.hourlyRate) + " đ/h" : "0 đ/h";
        document.getElementById('pay-total').innerText = data.totalEarned ? new Intl.NumberFormat('vi-VN').format(data.totalEarned) + " VNĐ" : "0 VNĐ";

        const btn = document.getElementById('btn-confirm-payment');
        btn.disabled = false;
        btn.style.background = "var(--primary)";
        btn.innerHTML = `<i class="ti ti-check"></i> Xác nhận đã nhận tiền`;

        document.getElementById('main-ui').classList.add('overlay-blur');
        document.getElementById('payment-sheet').classList.add('active');
    }

    function confirmPaymentAction() {
        if (!currentAppId) return;
        const btn = document.getElementById('btn-confirm-payment');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang xác nhận...`;

        fetch(`http://localhost:8083/api/v1/application/payment?applicationId=${currentAppId}`, {
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
        .then(res => {
            if (res.code === 200) {
                btn.style.background = "var(--success)";
                btn.innerHTML = `<i class="ti ti-check-double"></i> Đã xác nhận nhận tiền`;
                alert("Bạn đã xác nhận nhận tiền thành công! Ca làm sẽ chính thức hoàn tất khi Nhà tuyển dụng xác nhận hài lòng.");
            } else {
                btn.disabled = false;
                btn.innerHTML = `<i class="ti ti-check"></i> Xác nhận đã nhận tiền`;
                alert(res.message);
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerHTML = `<i class="ti ti-check"></i> Xác nhận đã nhận tiền`;
            if (err.message !== "403 Forbidden") {
                alert("Lỗi kết nối khi xác nhận!");
            }
        });
    }

    function promptReport() {
        const reason = prompt("Vui lòng nhập vấn đề bạn gặp phải (ví dụ: sai số tiền, chủ nhà không trả tiền...):");
        if (reason && reason.trim() !== '') {
            alert("Đã gửi báo cáo thành công! Chúng tôi sẽ xem xét và phản hồi sớm nhất.");
        }
    }

    function showResult(type, title, message) {
        const sheet = document.getElementById('result-sheet');
        const iconBox = document.getElementById('result-icon-box');
        const icon = document.getElementById('result-icon');

        document.getElementById('payment-sheet').classList.remove('active');
        document.getElementById('main-ui').classList.add('overlay-blur');
        sheet.classList.remove('status-success', 'status-error');
        document.getElementById('btn-done').style.display = 'none';
        document.getElementById('btn-retry').style.display = 'flex';

        if (type === 'loading') {
            icon.className = "ti ti-loader ti-spin result-icon";
            iconBox.style.color = "var(--primary)";
            document.getElementById('btn-retry').style.display = 'none';
        } else if (type === 'success') {
            sheet.classList.add('status-success');
            icon.className = "ti ti-circle-check-filled result-icon";
            document.getElementById('btn-done').style.display = 'flex';
            document.getElementById('btn-retry').style.display = 'none';
        } else if (type === 'error') {
            sheet.classList.add('status-error');
            icon.className = "ti ti-alert-triangle-filled result-icon";
        }

        document.getElementById('result-title').innerText = title;
        document.getElementById('result-msg').innerText = message;
        sheet.classList.add('active');
    }

    function restartScanner() {
        scanning = false;
        startScanner();
    }

    function goHome() {
        window.location.href = '/interface/manageapplication';
    }
