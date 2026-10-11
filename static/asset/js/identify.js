const token = localStorage.getItem('accessToken');
    if (!token) {
        alert("Vui lòng đăng nhập để tiếp tục!");
        window.location.href = "/interface/authentication";
    }

    let currentStream = null;
    let cameraStates = { 1: 'IDLE', 2: 'IDLE', 3: 'IDLE' }; // IDLE -> RECORDING -> CAPTURED
    let capturedFiles = { 1: null, 2: null, 3: null }; // Chứa Blob ảnh thực tế để gửi API

    // HÀM XỬ LÝ CLICK VÀO KHUNG CAMERA
    function handleCameraAction(step, facingMode) {
        const state = cameraStates[step];
        if (state === 'IDLE' || state === 'CAPTURED') {
            startCamera(step, facingMode);
        } else if (state === 'RECORDING') {
            takePhoto(step);
        }
    }

    // 1. MỞ CAMERA
    function startCamera(step, facingMode) {
        if (currentStream) stopCamera(); // Tắt cam cũ nếu đang bật

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingMode } },
            audio: false
        })
            .then(stream => {
                currentStream = stream;
                const videoEl = document.getElementById('vid-' + step);
                videoEl.srcObject = stream;
                videoEl.style.display = 'block';

                document.getElementById('img-' + step).style.display = 'none';

                // Đổi UI sang trạng thái chuẩn bị chụp
                updateBoxUI(step, 'RECORDING', 'Chạm vào đây để Chụp');
                cameraStates[step] = 'RECORDING';
                document.getElementById('btn-' + step).disabled = true;
            })
            .catch(err => {
                console.warn("Không thể truy cập Camera:", err);
                const kycHeader = document.getElementById('kyc-header');
                if (kycHeader) {
                    kycHeader.style.background = '#f4f4f5';
                    kycHeader.style.borderColor = '#e4e4e7';
                    kycHeader.style.color = 'var(--black-main)';
                    kycHeader.innerHTML = `<i class="ti ti-alert-circle" style="color:var(--primary-orange);"></i> <strong>Chưa cấp quyền Camera:</strong> Vui lòng cho phép quyền Camera trên thanh địa chỉ trình duyệt rồi bấm vào khung để chụp lại.`;
                }
                updateBoxUI(step, 'IDLE', 'Chưa cấp quyền Camera · Bấm thử lại');
            });
    }

    // 2. CHỤP ẢNH
    function takePhoto(step) {
        const video = document.getElementById('vid-' + step);
        const canvas = document.getElementById('canvas');
        const img = document.getElementById('img-' + step);

        // Thiết lập kích thước canvas bằng kích thước video thực tế
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Vẽ frame video lên canvas
        const ctx = canvas.getContext('2d');
        if(step === 3) {
            // Lật ảnh lại cho cam trước (hiệu ứng gương)
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Chuyển Canvas thành Blob (File) để chuẩn bị gửi lên Server
        canvas.toBlob(function(blob) {
            capturedFiles[step] = blob;
            const imageUrl = URL.createObjectURL(blob);

            // Hiển thị ảnh, tắt video
            img.src = imageUrl;
            img.style.display = 'block';
            video.style.display = 'none';
            stopCamera();

            // Đổi UI sang trạng thái Đã chụp
            updateBoxUI(step, 'CAPTURED', 'Ảnh hợp lệ. Chạm để chụp lại');
            cameraStates[step] = 'CAPTURED';
            document.getElementById('btn-' + step).disabled = false;

        }, 'image/jpeg', 0.9);
    }

    // 3. TẮT CAMERA
    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    // 4. CẬP NHẬT GIAO DIỆN KHUNG CHỤP
    function updateBoxUI(step, state, text) {
        const box = document.getElementById('box-' + step);
        const content = document.getElementById('content-' + step);
        const icon = document.getElementById('icon-' + step);
        const textEl = document.getElementById('text-' + step);

        textEl.innerText = text;

        if (state === 'RECORDING') {
            box.style.borderColor = 'var(--text-accent)';
            content.className = 'cap-content cap-content-bg';
            icon.className = 'ti ti-click';
        } else if (state === 'CAPTURED') {
            box.style.borderColor = 'var(--border-success)';
            content.className = 'cap-content cap-content-bg';
            content.style.background = 'rgba(25, 135, 84, 0.8)'; // Màu xanh success
            icon.className = 'ti ti-circle-check-filled';
        }
    }

    // 5. CHUYỂN BƯỚC
    function nextStep(n) {
        stopCamera(); // Đảm bảo tắt camera khi chuyển tab

        for(let i=1; i<=5; i++) {
            let stepEl = document.getElementById('kstep-' + i);
            if(stepEl) stepEl.style.display = 'none';
        }
        document.getElementById('kstep-' + n).style.display = 'block';

        let header = document.getElementById('kyc-header');
        if(header) header.style.display = (n >= 4) ? 'none' : 'block';

        for(let i=1; i<=4; i++) {
            let dot = document.getElementById('kd-' + i);
            if(dot) dot.style.background = (i <= n) ? 'var(--fill-primary)' : 'var(--border)';
        }
    }

    // 6. GỬI ẢNH LÊN BACKEND (API thực tế)
    function finish() {
        if (!capturedFiles[1] || !capturedFiles[2] || !capturedFiles[3]) {
            alert("Thiếu ảnh! Vui lòng thực hiện lại.");
            return;
        }

        const btn = document.getElementById('btn-submit');
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang tải ảnh lên hệ thống...';

        const token = localStorage.getItem('accessToken');
        const formData = new FormData();
        // Đặt tên file ngẫu nhiên để Spring Boot nhận diện là MultipartFile
        formData.append('front', capturedFiles[1], 'front.jpg');
        formData.append('back', capturedFiles[2], 'back.jpg');
        formData.append('face', capturedFiles[3], 'face.jpg');

        fetch('/api/v1/identify', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        })
            .then(async response => {
                if (response.status === 401) {
                    alert('Phiên làm việc hết hạn. Vui lòng đăng nhập lại.');
                    localStorage.clear();
                    window.location.href = '/interface/authentication';
                    return;
                }
                if (response.status === 403) {
                    alert('Bạn không có quyền thực hiện định danh hoặc vai trò không hợp lệ.');
                    btn.disabled = false;
                    btn.innerText = 'Tải ảnh lên hệ thống';
                    return;
                }
                const data = await response.json();
                if (data.code === 201 || response.ok) {
                    nextStep(5);
                } else {
                    alert('Lỗi máy chủ: ' + (data.message || 'Không thể định danh'));
                    btn.disabled = false;
                    btn.innerText = 'Tải ảnh lên hệ thống';
                }
            })
            .catch(err => {
                console.error('Lỗi API:', err);
                alert('Lỗi mạng. Vui lòng thử lại sau.');
                btn.disabled = false;
                btn.innerText = 'Tải ảnh lên hệ thống';
            });
    }
