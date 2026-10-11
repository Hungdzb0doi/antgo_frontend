const API_BASE_URL = (window.location.protocol.startsWith('http')) 
    ? '/api/v1/auth' 
    : 'http://localhost:8083/api/v1/auth';


    let currentEmail = "";
    let currentOtp = "";

    // Hàm ẩn lỗi và xóa viền đỏ
    function clearErr(id) {
        var e = document.getElementById(id);
        if(e) { e.style.display = 'none'; e.textContent = ''; }
        var inputId = id.replace('err-', '');
        var inputEl = document.getElementById(inputId);
        if(inputEl) inputEl.classList.remove('input-error');
    }

    // Hàm hiện lỗi và thêm viền đỏ
    function showErr(id, msg) {
        var e = document.getElementById(id);
        if(e) { e.textContent = msg; e.style.display = 'block'; }
        var inputId = id.replace('err-', '');
        var inputEl = document.getElementById(inputId);
        if(inputEl) {
            inputEl.classList.add('input-error');
            inputEl.addEventListener('input', function() { clearErr(id); }, { once: true });
        }
    }

    // Hàm bật/tắt hiển thị mật khẩu
    function togglePassword(inputId, iconId) {
        var input = document.getElementById(inputId);
        var icon = document.getElementById(iconId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("ti-eye");
            icon.classList.add("ti-eye-off");
        } else {
            input.type = "password";
            icon.classList.remove("ti-eye-off");
            icon.classList.add("ti-eye");
        }
    }

    // Hàm điều hướng các bước
    function goStep(n) {
        for(var i=1; i<=4; i++) {
            document.getElementById('step-'+i).style.display = (i === n) ? 'block' : 'none';
        }
        for(var i=1; i<=3; i++) {
            document.getElementById('dot-'+i).style.background = (i <= n) ? 'var(--fill-primary)' : 'var(--border)';
        }
        if(n === 2) {
            setTimeout(function() { document.getElementById('fp-code').focus(); }, 100);
        }
    }


    function fpStep1() {
        clearErr('err-fp-email');
        var email = document.getElementById('fp-email').value.trim();

        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showErr('err-fp-email', 'Vui lòng nhập định dạng email hợp lệ');
            return;
        }

        var btn = document.getElementById('btn-step1');
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang gửi mã...';


        fetch(`${API_BASE_URL}/otp?email=${encodeURIComponent(email)}`, {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.innerHTML = 'Gửi mã xác nhận';

            if (data.code === 201 ) {
                currentEmail = email; // Lưu email lại cho bước 3
                document.getElementById('fp-email-echo').innerHTML = 'Mã xác nhận đã được gửi tới email <b>' + email + '</b>';
                goStep(2);
            } else {
                showErr('err-fp-email', data.message || 'Email không tồn tại trong hệ thống');
            }
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = 'Gửi mã xác nhận';
            showErr('err-fp-email', 'Lỗi kết nối máy chủ!');
        });
    }


    function fpStep2() {
        clearErr('err-fp-code');
        var code = document.getElementById('fp-code').value.trim();

        // Kiểm tra độ dài mã (Form của bạn đang để maxlength là 6)
        if(code.length < 4) {
            showErr('err-fp-code', 'Vui lòng nhập đầy đủ mã xác nhận');
            return;
        }

        var btn = document.getElementById('btn-step2');
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang kiểm tra...';

        // GỌI API KIỂM TRA OTP
        fetch(`${API_BASE_URL}/ckotp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Gửi email và otp lên để kiểm tra
            body: JSON.stringify({
                email: currentEmail,
                otp: code
            })
        })
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.innerHTML = 'Xác nhận mã';


            if (data.code === 200) {
                currentOtp = code;
                goStep(3);
            } else {
                showErr('err-fp-code', data.message || 'Mã xác nhận không đúng hoặc đã hết hạn');
            }
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = 'Xác nhận mã';
            showErr('err-fp-code', 'Lỗi kết nối máy chủ!');
        });
    }


    function fpStep3() {
        clearErr('err-fp-pass1');
        clearErr('err-fp-pass2');

        var p1 = document.getElementById('fp-pass1').value;
        var p2 = document.getElementById('fp-pass2').value;
        var ok = true;

        if(p1.length < 8) { showErr('err-fp-pass1', 'Mật khẩu phải có tối thiểu 8 ký tự'); ok = false; }
        if(p2 !== p1 || p2.length === 0) { showErr('err-fp-pass2', 'Mật khẩu xác nhận không khớp'); ok = false; }

        if(!ok) return;

        var btn = document.getElementById('btn-step3');
        btn.disabled = true;
        btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang lưu...';


        fetch(`${API_BASE_URL}/newpassword`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                email: currentEmail,
                otp: currentOtp,
                newPassword: p1
            })
        })
        .then(response => response.json())
        .then(data => {
            btn.disabled = false;
            btn.innerHTML = 'Lưu mật khẩu mới';

            if ( data.code === 201 ) {
                goStep(4);
            } else {

                showErr('err-fp-pass2', data.message || 'Mã xác nhận sai hoặc đã hết hạn');
            }
        })
        .catch(error => {
            btn.disabled = false;
            btn.innerHTML = 'Lưu mật khẩu mới';
            showErr('err-fp-pass2', 'Lỗi kết nối máy chủ!');
        });
    }
