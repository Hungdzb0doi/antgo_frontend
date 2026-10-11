const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');
    let qrScanner = null;
    let scanning = false;
    let currentAppId = null;
    let currentFacingMode = "environment"; // Mặc định camera sau
    let isReloading = false;

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

    function setCamOverlayState(state, message) {
        const overlay = document.getElementById('cam-status-overlay');
        const spinner = document.getElementById('cam-spinner');
        const errorIcon = document.getElementById('cam-error-icon');
        const text = document.getElementById('cam-status-text');
        const retryBtn = document.getElementById('btn-overlay-retry');

        if (!overlay) return;

        if (state === 'hidden') {
            overlay.classList.add('hidden');
            return;
        }

        overlay.classList.remove('hidden');
        if (state === 'loading') {
            if (spinner) spinner.style.display = 'block';
            if (errorIcon) errorIcon.style.display = 'none';
            if (retryBtn) retryBtn.style.display = 'none';
            if (text) text.innerText = message || 'Đang kết nối camera...';
        } else if (state === 'error') {
            if (spinner) spinner.style.display = 'none';
            if (errorIcon) errorIcon.style.display = 'block';
            if (retryBtn) retryBtn.style.display = 'inline-flex';
            if (text) text.innerText = message || 'Không mở được camera. Vui lòng bấm thử lại!';
        }
    }

    function startScanner() {
        document.getElementById('result-sheet').classList.remove('active');
        document.getElementById('payment-sheet').classList.remove('active');
        document.getElementById('main-ui').classList.remove('overlay-blur');

        reloadCamera();
    }

    async function reloadCamera() {
        if (isReloading) return;
        isReloading = true;

        const reloadBtn = document.getElementById('btn-reload-cam');
        const reloadIcon = document.getElementById('icon-reload-cam');
        const headerReloadIcon = document.getElementById('icon-header-reload');

        if (reloadBtn) reloadBtn.disabled = true;
        if (reloadIcon) reloadIcon.classList.add('ti-spin');
        if (headerReloadIcon) headerReloadIcon.classList.add('ti-spin');

        setCamOverlayState('loading', 'Đang khởi động lại camera...');

        try {
            if (qrScanner) {
                try {
                    await qrScanner.stop();
                } catch (e) {
                    console.warn("Dừng scanner cũ:", e);
                }
                try {
                    qrScanner.clear();
                } catch (e) {}
            }
        } catch (err) {
            console.warn("Lỗi khi giải phóng camera:", err);
        }

        const readerElem = document.getElementById('reader');
        if (readerElem) readerElem.innerHTML = '';
        scanning = false;

        // Cho trình duyệt 200ms để giải phóng thiết bị phần cứng
        setTimeout(() => {
            initQr(currentFacingMode)
                .finally(() => {
                    isReloading = false;
                    if (reloadBtn) reloadBtn.disabled = false;
                    if (reloadIcon) reloadIcon.classList.remove('ti-spin');
                    if (headerReloadIcon) headerReloadIcon.classList.remove('ti-spin');
                });
        }, 200);
    }

    function switchCamera() {
        currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
        reloadCamera();
    }

    function initQr(facingMode = "environment") {
        setCamOverlayState('loading', 'Đang mở máy ảnh...');

        return new Promise((resolve) => {
            try {
                qrScanner = new Html5Qrcode("reader");

                const config = {
                    fps: 12,
                    qrbox: { width: 220, height: 220 },
                    aspectRatio: 1.0
                };

                // Bước 1: Thử mở camera theo chế độ mong muốn (environment / user)
                qrScanner.start(
                    { facingMode: facingMode },
                    config,
                    onScanSuccess,
                    () => {} // Bỏ qua lỗi từng frame
                ).then(() => {
                    scanning = true;
                    setCamOverlayState('hidden');
                    resolve(true);
                }).catch((err) => {
                    console.warn("Không mở được facingMode " + facingMode + ", thử fallback sang chế độ khác:", err);

                    // Bước 2: Fallback thử chế độ ngược lại
                    const fallbackMode = (facingMode === "environment") ? "user" : "environment";
                    qrScanner.start(
                        { facingMode: fallbackMode },
                        config,
                        onScanSuccess,
                        () => {}
                    ).then(() => {
                        currentFacingMode = fallbackMode;
                        scanning = true;
                        setCamOverlayState('hidden');
                        resolve(true);
                    }).catch(() => {
                        // Bước 3: Lấy danh sách camera thực tế từ getCameras()
                        Html5Qrcode.getCameras().then(devices => {
                            if (devices && devices.length > 0) {
                                qrScanner.start(
                                    devices[0].id,
                                    config,
                                    onScanSuccess,
                                    () => {}
                                ).then(() => {
                                    scanning = true;
                                    setCamOverlayState('hidden');
                                    resolve(true);
                                }).catch(finalErr => {
                                    handleCamError(finalErr);
                                    resolve(false);
                                });
                            } else {
                                handleCamError(err);
                                resolve(false);
                            }
                        }).catch(devErr => {
                            handleCamError(devErr);
                            resolve(false);
                        });
                    });
                });
            } catch (e) {
                handleCamError(e);
                resolve(false);
            }
        });
    }

    function handleCamError(err) {
        scanning = false;
        console.error("Camera Error:", err);
        setCamOverlayState('error', 'Chưa bật được camera hoặc chưa cấp quyền. Vui lòng bấm "Bật lại camera" bên dưới!');
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
        let socket = new SockJS('/ws');
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

        fetch('/api/v1/application/qrscanner', {
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

        const reportBtn = document.getElementById('btn-open-report');
        if (reportBtn) {
            reportBtn.disabled = false;
            reportBtn.style.opacity = '1';
            reportBtn.innerHTML = `<i class="ti ti-alert-triangle"></i> Báo cáo vấn đề ca làm`;
        }

        document.getElementById('main-ui').classList.add('overlay-blur');
        document.getElementById('payment-sheet').classList.add('active');
    }

    function confirmPaymentAction() {
        if (!currentAppId) return;
        const btn = document.getElementById('btn-confirm-payment');
        btn.disabled = true;
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang xác nhận...`;

        fetch(`/api/v1/application/payment?applicationId=${currentAppId}`, {
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

    // XỬ LÝ BÁO CÁO / KHIẾU NẠI CA LÀM (CHUẨN FORM CÓ BẰNG CHỨNG)
    let currentReportAppId = null;
    let reportSelectedFiles = [];

    function openReportModal() {
        if (!currentAppId) {
            alert("Không tìm thấy thông tin ca làm để báo cáo!");
            return;
        }
        currentReportAppId = currentAppId;
        reportSelectedFiles = [];
        document.getElementById('reportDetailText').value = '';
        renderReportPreview();
        const modal = document.getElementById('reportModal');
        if (modal) modal.classList.add('active');
    }

    function closeReportModal() {
        const modal = document.getElementById('reportModal');
        if (modal) modal.classList.remove('active');
    }

    function handleReportFilesSelected(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;

        let imageCount = reportSelectedFiles.filter(f => f.type.startsWith('image/')).length;
        let videoCount = reportSelectedFiles.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(f.name)).length;

        for (let file of files) {
            const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm)$/i.test(file.name);
            if (isVideo) {
                if (videoCount >= 1) {
                    alert("Chỉ được đính kèm tối đa 1 video bằng chứng!");
                    continue;
                }
                if (file.size > 50 * 1024 * 1024) {
                    alert(`Video "${file.name}" vượt quá dung lượng cho phép (50MB).`);
                    continue;
                }
                videoCount++;
                reportSelectedFiles.push(file);
            } else {
                if (imageCount >= 5) {
                    alert("Chỉ được đính kèm tối đa 5 hình ảnh bằng chứng!");
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
            itemBox.style.cssText = 'position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; background: #0f172a; display: flex; align-items: center; justify-content: center;';

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
                badge.style.cssText = 'position: absolute; bottom: 2px; left: 2px; background: rgba(24,24,27,0.85); color: #fff; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 3px;';
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
        btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang gửi báo cáo...`;

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
            btn.innerHTML = `Gửi báo cáo`;
            if (apiRes.code === 200 || apiRes.code === 201 || apiRes.success) {
                alert("Báo cáo của bạn và bằng chứng đã được gửi thành công! Quản trị viên (Admin) sẽ tiếp nhận và liên hệ hỗ trợ bạn sớm nhất.");
                closeReportModal();
                const reportBtn = document.getElementById('btn-open-report');
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
