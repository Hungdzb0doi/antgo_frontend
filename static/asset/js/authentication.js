const API_BASE_URL = (window.location.protocol.startsWith('http')) 
    ? '/api/v1/auth' 
    : 'http://localhost:8083/api/v1/auth';

    // Nếu đã đăng nhập, tự động chuyển vào trang Quản lý tương ứng hoặc trang redirect
    document.addEventListener('DOMContentLoaded', function() {
        const token = localStorage.getItem('accessToken');
        const role = localStorage.getItem('userRole');
        const mode = localStorage.getItem('currentMode') || 'WORKER';
        if (token) {
            const urlParams = new URLSearchParams(window.location.search);
            const redirectParam = urlParams.get('redirect');
            if (role === 'ROLE_ADMIN') {
                window.location.href = '/interface/admin';
            } else if (redirectParam && !redirectParam.includes('/interface/unauthorized') && !redirectParam.includes('401')) {
                window.location.href = redirectParam;
            } else {
                window.location.href = (mode === 'EMPLOYER') ? '/interface/managejob' : '/interface/manageapplication';
            }
        }
    });

    // Hàm chuyển đổi Tab
    function showTab(tab) {
        document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
        document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';

        document.getElementById('tab-login').style.borderBottomColor = tab === 'login' ? 'var(--primary-orange)' : 'transparent';
        document.getElementById('tab-login').style.color = tab === 'login' ? 'var(--primary-orange)' : 'var(--text-secondary)';
        document.getElementById('tab-login').style.fontWeight = tab === 'login' ? '700' : '500';

        document.getElementById('tab-register').style.borderBottomColor = tab === 'register' ? 'var(--primary-orange)' : 'transparent';
        document.getElementById('tab-register').style.color = tab === 'register' ? 'var(--primary-orange)' : 'var(--text-secondary)';
        document.getElementById('tab-register').style.fontWeight = tab === 'register' ? '700' : '500';
    }

    // Hàm xóa lỗi và viền
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


    function submitLogin(ev) {
        ev.preventDefault();
        ['err-login-phone', 'err-login-password'].forEach(clearErr);
        document.getElementById('login-success').style.display = 'none';

        var phone = document.getElementById('login-phone').value.trim();
        var pass = document.getElementById('login-password').value;
        var ok = true;

        var cleanPhone = phone.replace(/[\s\-\.]/g, '');
        if (!/^0\d{9}$/.test(cleanPhone)) { showErr('err-login-phone','Vui lòng nhập số điện thoại hợp lệ (10 số)'); ok=false; }
        if (pass.length < 1) { showErr('err-login-password','Vui lòng nhập mật khẩu'); ok=false; }

        if (ok) {
            var btn = document.getElementById('btn-login');
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang đăng nhập...';

            // GỌI API LOGIN
            fetch(API_BASE_URL + '/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    phone: cleanPhone,
                    password: pass
                })
            })
            .then(res => res.json())
            .then(data => {
                btn.disabled = false;
                btn.innerHTML = 'Đăng nhập';

                // Dựa vào JSON của bạn, cứ code === 200 là thành công
                if (data.code === 200 && data.data) {
                    document.getElementById('login-success').style.display = 'block';

                    // 1. Lưu Token để dùng cho các API sau này
                    localStorage.setItem('accessToken', data.data.token);

                    // 2. LƯU ROLE (Vai trò) và CURRENT MODE để các trang khác nhận diện được vai trò
                    const roles = data.data.roles || [];
                    let isAdmin = false;
                    if (roles.includes('ROLE_ADMIN')) {
                        isAdmin = true;
                        localStorage.setItem('userRole', 'ROLE_ADMIN');
                        localStorage.setItem('isAdmin', 'true');
                    } else if (roles.length > 0) {
                        const rawRole = roles[0];
                        localStorage.setItem('userRole', rawRole);
                        const cleanRole = rawRole.replace('ROLE_', '');
                        localStorage.setItem('currentMode', cleanRole);
                    }

                    // 3. Điều hướng thông minh dựa trên Redirect URL hoặc Role:
                    setTimeout(function() {
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirectParam = urlParams.get('redirect');

                        if (isAdmin) {
                            window.location.href = '/interface/admin';
                            return;
                        }

                        if (redirectParam && !redirectParam.includes('/interface/unauthorized') && !redirectParam.includes('401')) {
                            window.location.href = redirectParam;
                            return;
                        }

                        const rolesStr = roles.join(',');
                        if (rolesStr.includes('WORKER')) {
                            // Ứng viên -> Đẩy sang trang Quản lý đơn ứng tuyển
                            window.location.href = '/interface/manageapplication';
                        } else {
                            // Nhà tuyển dụng -> Đẩy sang trang Quản lý việc làm
                            window.location.href = '/interface/managejob';
                        }
                    }, 1000);

                } else {
                    // Xử lý khi đăng nhập sai (sai pass, không tồn tại user...)
                    showErr('err-login-password', data.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!');
                }
            })
            .catch(error => {
                btn.disabled = false;
                btn.innerHTML = 'Đăng nhập';
                showErr('err-login-password', 'Lỗi kết nối máy chủ. Vui lòng thử lại!');
                console.error('Login Error:', error);
            });
        }
        return false;
    }


    function submitRegister(ev) {
        ev.preventDefault();
        ['err-reg-name','err-reg-phone','err-reg-email','err-reg-password','err-reg-password2','err-reg-terms'].forEach(clearErr);
        document.getElementById('register-success').style.display = 'none';

        var name = document.getElementById('reg-name').value.trim();
        var phone = document.getElementById('reg-phone').value.trim();
        var email = document.getElementById('reg-email').value.trim();
        var pass = document.getElementById('reg-password').value;
        var pass2 = document.getElementById('reg-password2').value;
        var terms = document.getElementById('reg-terms').checked;
        var ok = true;

        if (name.length < 2) { showErr('err-reg-name','Vui lòng nhập họ và tên'); ok=false; }

        var cleanPhone = phone.replace(/[\s\-\.]/g, '');
        if (!/^0\d{9}$/.test(cleanPhone)) { showErr('err-reg-phone','Vui lòng nhập số điện thoại hợp lệ (10 số)'); ok=false; }

        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            showErr('err-reg-email','Vui lòng nhập địa chỉ email'); ok=false;
        } else if (!emailRegex.test(email)) {
            showErr('err-reg-email','Email không đúng định dạng'); ok=false;
        }

        if (pass.length < 8) { showErr('err-reg-password','Mật khẩu phải tối thiểu 8 ký tự'); ok=false; }
        if (pass2 !== pass || pass2.length===0) { showErr('err-reg-password2','Mật khẩu xác nhận không khớp'); ok=false; }
        if (!terms) { showErr('err-reg-terms','Bạn cần đồng ý điều khoản để tiếp tục'); ok=false; }

        if (ok) {
            var btn = document.getElementById('btn-register');
            btn.disabled = true;
            btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Đang đăng ký...';

            // GỌI API REGISTER
            fetch(API_BASE_URL + '/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },

                body: JSON.stringify({
                    fullName: name,
                    phone: cleanPhone,
                    email: email,
                    passwordHash: pass
                })
            })
            .then(response => response.json())
            .then(data => {
                btn.disabled = false;
                btn.innerHTML = 'Đăng ký';

                // Check thành công (200 hoặc 201 Created)
                if (data.code === 200 || data.code === 201 || data.message === 'Success' || data.message === 'Created') {
                    document.getElementById('register-success').style.display = 'block';


                    setTimeout(function() {
                        showTab('login');
                        document.getElementById('login-phone').value = cleanPhone;
                        document.getElementById('register-success').style.display = 'none';
                        // Xóa trắng form đăng ký
                        document.getElementById('form-register').reset();
                    }, 2000);
                } else {

                    showErr('err-reg-phone', data.message || 'Đăng ký thất bại');
                }
            })
            .catch(error => {
                btn.disabled = false;
                btn.innerHTML = 'Đăng ký';
                showErr('err-reg-terms', 'Lỗi kết nối máy chủ. Vui lòng thử lại!');
                console.error('Register Error:', error);
            });
        }
        return false;
    }
