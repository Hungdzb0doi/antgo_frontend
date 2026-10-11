// ==========================================================================
// ANTGO LANDING PAGE - INTERACTIVE LOGIC & AUTH SYNC
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initHeaderScroll();
    initAuthStatus();
    initRadarSimulator();
    initHowItWorksTabs();
    initFaqAccordion();
    initMobileMenu();
});

// 1. HEADER SCROLL EFFECT
function initHeaderScroll() {
    const header = document.querySelector('.landing-header');
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}

// 2. AUTHENTICATION AWARENESS & ADAPTIVE CTA
function initAuthStatus() {
    const token = localStorage.getItem('accessToken');
    const authActions = document.getElementById('header-auth-actions');
    const heroCtaPrimary = document.getElementById('hero-cta-worker');
    const heroCtaSecondary = document.getElementById('hero-cta-employer');

    if (token) {
        const mode = (localStorage.getItem('currentMode') || 'WORKER').toUpperCase();
        const userName = localStorage.getItem('userFullName') || 'Tài khoản';
        const userAvatar = localStorage.getItem('userAvatar');
        const targetDashboard = mode === 'EMPLOYER' ? '/interface/managejob' : '/interface/findjob';
        const targetLabel = mode === 'EMPLOYER' ? 'Quản lý tuyển dụng' : 'Khám phá việc làm';

        // Cập nhật Header: Hiện nút vào Dashboard trực tiếp
        if (authActions) {
            let avatarHtml = `<i class="ti ti-layout-dashboard" style="font-size: 16px;"></i>`;
            if (userAvatar && typeof resolveAvatarUrl === 'function') {
                avatarHtml = `<img src="${resolveAvatarUrl(userAvatar, userName)}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; border: 1px solid #FF6600;">`;
            }

            authActions.innerHTML = `
                <a href="/interface/profile" class="btn btn-glass btn-sm" style="padding: 7px 14px;" title="Trang cá nhân">
                    ${avatarHtml}
                    <span>${userName.split(' ').pop()}</span>
                </a>
                <a href="${targetDashboard}" class="btn btn-primary btn-sm">
                    <span>${targetLabel}</span>
                    <i class="ti ti-arrow-right btn-icon-right"></i>
                </a>
            `;
        }

        // Cập nhật nút CTA ở Hero
        if (heroCtaPrimary) {
            heroCtaPrimary.href = '/interface/findjob';
            heroCtaPrimary.innerHTML = `<span>Mở bản đồ tìm việc</span> <i class="ti ti-compass btn-icon-right"></i>`;
        }
        if (heroCtaSecondary) {
            heroCtaSecondary.href = '/interface/managejob';
            heroCtaSecondary.innerHTML = `<span>Bảng điều khiển tuyển dụng</span> <i class="ti ti-briefcase btn-icon-right"></i>`;
        }
    } else {
        // Chưa đăng nhập: liên kết đến trang đăng nhập / đăng ký
        if (heroCtaPrimary) {
            heroCtaPrimary.href = '/interface/authentication?mode=register';
        }
        if (heroCtaSecondary) {
            heroCtaSecondary.href = '/interface/authentication?role=employer';
        }
    }
}

// 3. LIVE INTERACTIVE RADAR SIMULATOR
function initRadarSimulator() {
    const slider = document.getElementById('sim-slider');
    const radiusDisplay = document.getElementById('sim-radius-val');
    const workerCountDisplay = document.getElementById('sim-worker-count');
    const jobCountDisplay = document.getElementById('sim-job-count');
    const cardsGrid = document.getElementById('sim-cards-grid');

    if (!slider) return;

    const sampleJobs = [
        { title: "Phục vụ ca tối Cafe The Rust", employer: "The Rust Coffee & Tea", cat: "F&B", dist: 0.8, salary: "35.000đ/h", time: "18:00 - 23:00", applicants: 4 },
        { title: "Phụ bếp & Sơ chế nhà hàng Hải Sản", employer: "Nhà Hàng Biển Đông", cat: "Bếp", dist: 1.5, salary: "42.000đ/h", time: "09:00 - 14:00", applicants: 2 },
        { title: "Nhân viên đóng gói hàng ca sáng", employer: "Kho Vận Logistics Express", cat: "Kho bãi", dist: 2.3, salary: "38.000đ/h", time: "07:30 - 12:30", applicants: 6 },
        { title: "Bán hàng & Thu ngân siêu thị mini", employer: "Circle Mart 24/7", cat: "Bán lẻ", dist: 3.8, salary: "32.000đ/h", time: "14:00 - 19:00", applicants: 3 },
        { title: "Bốc xếp chuyển phát nhanh ca đêm", employer: "J&T Bưu Cục Trung Tâm", cat: "Bốc xếp", dist: 5.2, salary: "55.000đ/h", time: "22:00 - 04:00", applicants: 8 },
        { title: "Lễ tân khánh tiết sự kiện triển lãm", employer: "Eventify Media", cat: "Sự kiện", dist: 7.1, salary: "50.000đ/h", time: "08:00 - 16:00", applicants: 5 }
    ];

    function updateSimulation(radius) {
        if (radiusDisplay) radiusDisplay.innerText = `${radius} km`;

        // Tính toán số liệu giả lập mượt mà theo bán kính
        const workerCount = Math.round(Math.pow(radius, 1.35) * 2.8 + 6);
        const jobCount = Math.round(Math.pow(radius, 1.25) * 1.5 + 3);

        if (workerCountDisplay) workerCountDisplay.innerText = workerCount.toLocaleString();
        if (jobCountDisplay) jobCountDisplay.innerText = jobCount.toLocaleString();

        // Lọc danh sách công việc mẫu theo bán kính
        if (cardsGrid) {
            const filteredJobs = sampleJobs.filter(j => j.dist <= radius + 1.2).slice(0, 3);
            const jobsToRender = filteredJobs.length >= 2 ? filteredJobs : sampleJobs.slice(0, 3);

            cardsGrid.innerHTML = jobsToRender.map(job => `
                <div class="sim-job-card">
                    <div>
                        <span class="job-tag">${job.cat}</span>
                        <h4>${job.title}</h4>
                        <div class="job-meta-row">
                            <span><i class="ti ti-building" style="color:var(--primary);"></i> ${job.employer}</span>
                        </div>
                        <div class="job-meta-row" style="margin-bottom: 8px;">
                            <span><i class="ti ti-map-pin" style="color:#ef4444;"></i> Cách ${job.dist} km</span>
                            <span><i class="ti ti-clock" style="color:#3b82f6;"></i> ${job.time}</span>
                        </div>
                    </div>
                    <div class="job-foot">
                        <div class="job-salary">${job.salary}</div>
                        <a href="/interface/findjob" class="btn btn-glass btn-sm" style="padding: 5px 12px; font-size: 11.5px;">Ứng tuyển ngay</a>
                    </div>
                </div>
            `).join('');
        }
    }

    slider.addEventListener('input', (e) => {
        updateSimulation(parseFloat(e.target.value));
    });

    // Chạy mặc định ban đầu
    updateSimulation(parseFloat(slider.value || 5));
}

// 4. HOW IT WORKS TABS
function initHowItWorksTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const container = document.getElementById('how-steps-container');
    if (!tabs || !container) return;

    const workerSteps = [
        {
            num: "01",
            badge: "Khởi tạo",
            icon: "ti-id-badge-2",
            title: "Đăng ký & Xác thực eKYC",
            desc: "Tạo tài khoản bằng SĐT trong 30 giây. Chụp ảnh căn cước công dân (CCCD) để kích hoạt hồ sơ chuẩn mực và nhận 100 điểm uy tín ban đầu.",
            link: "/interface/identify",
            linkText: "Xác thực eKYC"
        },
        {
            num: "02",
            badge: "Định vị GPS",
            icon: "ti-map-pin-filled",
            title: "Bật vị trí sẵn sàng nhận việc",
            desc: "Vào trang Hồ sơ cá nhân, gạt bật công tắc 'Sẵn sàng nhận việc'. Hệ thống Radar sẽ phát sóng vị trí GPS của bạn đến các nhà tuyển dụng xung quanh.",
            link: "/interface/profile",
            linkText: "Cài đặt vị trí"
        },
        {
            num: "03",
            badge: "Ứng tuyển 1-chạm",
            icon: "ti-compass",
            title: "Dò tìm ca làm & Ứng tuyển",
            desc: "Khám phá các ca làm việc gần bạn nhất trên bản đồ trong bán kính 1 - 20km, so sánh mức lương/giờ (30k - 75k/h) và bấm ứng tuyển tức thì.",
            link: "/interface/findjob",
            linkText: "Khám phá việc làm"
        },
        {
            num: "04",
            badge: "Chấm công QR",
            icon: "ti-qrcode",
            title: "Quét mã QR & Nhận tiền liền tay",
            desc: "Đến nơi làm việc, quét mã QR Check-in vào ca và Check-out khi tan ca. Chấm công theo phút chính xác 100%, nhận tiền công và chấm sao đối tác.",
            link: "/interface/scanner",
            linkText: "Quét mã QR Check-in"
        }
    ];

    const employerSteps = [
        {
            num: "01",
            badge: "Đăng tin 60s",
            icon: "ti-file-plus",
            title: "Đăng ca làm việc tức thì",
            desc: "Chọn ngành nghề (F&B, kho vận, bán lẻ...), điền mức thù lao/giờ, số lượng người cần và ghim chính xác địa chỉ quán / kho xưởng trên bản đồ GPS.",
            link: "/interface/createjob",
            linkText: "Đăng tin tuyển dụng"
        },
        {
            num: "02",
            badge: "Radar vệ tinh",
            icon: "ti-radar-2",
            title: "Quét Radar tìm thợ quanh quán",
            desc: "Mở Radar xem ngay các thợ và ứng viên đang trực tuyến quanh quán từ 500m - 15km. Xem điểm uy tín, lịch sử làm việc và bấm 'Mời ca' tức thì.",
            link: "/interface/findworker",
            linkText: "Quét Radar nhân sự"
        },
        {
            num: "03",
            badge: "Chọn lọc nhanh",
            icon: "ti-user-check",
            title: "Duyệt hồ sơ & Chốt danh sách",
            desc: "Nhận thông báo khi ứng viên nộp đơn. Xem hồ sơ năng lực, bằng cấp/chứng chỉ (nếu có) và bấm 'Duyệt' để xác nhận lịch ca làm việc.",
            link: "/interface/managejob",
            linkText: "Quản lý tuyển dụng"
        },
        {
            num: "04",
            badge: "Minh bạch 100%",
            icon: "ti-qrcode",
            title: "Tạo mã QR & Nghiệm thu",
            desc: "Tạo mã QR điểm danh ca làm cho nhân sự quét lúc vào ca và tan ca. Chấm công chuẩn xác theo từng phút, thanh toán minh bạch và đánh giá đối tác.",
            link: "/interface/generateqr",
            linkText: "Tạo mã QR ca làm"
        }
    ];

    function renderSteps(steps) {
        container.innerHTML = steps.map(step => `
            <div class="step-card">
                <span class="step-number">${step.num}</span>
                <div class="step-badge">${step.badge}</div>
                <div class="step-icon"><i class="ti ${step.icon}"></i></div>
                <h4>${step.title}</h4>
                <p>${step.desc}</p>
                <a href="${step.link}" class="step-action-link">
                    <span>${step.linkText}</span>
                    <i class="ti ti-arrow-right"></i>
                </a>
            </div>
        `).join('');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            renderSteps(target === 'employer' ? employerSteps : workerSteps);
        });
    });

    renderSteps(workerSteps);
}

// 5. FAQ ACCORDION
function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (question) {
            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                faqItems.forEach(i => i.classList.remove('active'));
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        }
    });
}

// 6. MOBILE MENU TOGGLE
function initMobileMenu() {
    const toggle = document.querySelector('.nav-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', () => {
        navLinks.classList.toggle('mobile-open');
    });

    // Đóng menu khi bấm vào link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('mobile-open');
        });
    });
}

// 7. THEME TOGGLE (DARK / LIGHT MODE)
function initThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (!toggleBtn) return;

    function applyTheme(theme, animate = false) {
        if (animate) {
            document.documentElement.classList.add('theme-transitioning');
        }
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('antgo_theme', theme);

        const isLight = theme === 'light';
        const label = isLight ? 'Chuyển sang Chế độ Tối' : 'Chuyển sang Chế độ Sáng';
        toggleBtn.setAttribute('title', label);
        toggleBtn.setAttribute('aria-label', label);

        if (animate) {
            setTimeout(() => {
                document.documentElement.classList.remove('theme-transitioning');
            }, 350);
        }
    }

    // Lắng nghe sự kiện click chuyển theme
    toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme, true);
    });

    // Lắng nghe thay đổi theme từ hệ thống nếu chưa có lưu trữ thủ công
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
            if (!localStorage.getItem('antgo_theme')) {
                applyTheme(e.matches ? 'light' : 'dark', true);
            }
        });
    }

    // Khởi tạo nhãn tooltip ban đầu
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isLight = activeTheme === 'light';
    toggleBtn.setAttribute('title', isLight ? 'Chuyển sang Chế độ Tối' : 'Chuyển sang Chế độ Sáng');
    toggleBtn.setAttribute('aria-label', isLight ? 'Chuyển sang Chế độ Tối' : 'Chuyển sang Chế độ Sáng');
}

