const STATUS_LABEL = {
        OPEN: 'Đang tuyển',
        IN_PROGRESS: 'Đang thực hiện',
        COMPLETED: 'Hoàn thành',
        CANCELLED: 'Đã hủy'
    };

    // 1. LẤY TOKEN VÀ MODE TỪ LOCALSTORAGE
    const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');

    let currentStatus = 'OPEN';
    let searchDebounceTimer = null;

    function getSearchKeyword() {
        const input = document.getElementById('jobSearchInput');
        return input ? input.value.trim() : '';
    }

    // 2. BẢO VỆ TRANG (GUARD CA ĐẦU VÀO)
    document.addEventListener("DOMContentLoaded", function() {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        if (currentMode === 'WORKER') {
            window.location.href = "/interface/manageapplication";
            return;
        }

        if (currentMode !== 'EMPLOYER') {
            alert("Trang này chỉ dành cho Nhà tuyển dụng!");
            window.location.href = "/interface/manageapplication";
            return;
        }

        loadEmployerJobs('OPEN');

        const tabButtons = document.querySelectorAll('.nav-link');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelector('.nav-link.active').classList.remove('active');
                this.classList.add('active');
                const status = this.getAttribute('data-status');
                loadEmployerJobs(status);
            });
        });

        // Xử lý tìm kiếm debounce
        const searchInput = document.getElementById('jobSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const val = this.value;
                if (clearBtn) clearBtn.style.display = val.length > 0 ? 'flex' : 'none';
                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    loadEmployerJobs(currentStatus, val.trim());
                }, 350);
            });

            searchInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    clearTimeout(searchDebounceTimer);
                    loadEmployerJobs(currentStatus, this.value.trim());
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.focus();
                }
                clearBtn.style.display = 'none';
                clearTimeout(searchDebounceTimer);
                loadEmployerJobs(currentStatus, '');
            });
        }
    });

    // 3. HÀM GỌI API KÈM TOKEN HEADER
    function loadEmployerJobs(status, keyword) {
        currentStatus = status || currentStatus;
        const kw = (keyword !== undefined && keyword !== null) ? keyword : getSearchKeyword();

        const container = document.getElementById('job-list-container');
        container.innerHTML = '<div class="state-box"><div class="spinner"></div><p>Đang lấy dữ liệu...</p></div>';

        let url = `http://localhost:8083/api/v1/job?status=${currentStatus}`;
        if (kw) {
            url += `&keyword=${encodeURIComponent(kw)}`;
        }

        fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '+ token
            }
        })
            .then(response => {
                if (response.status === 401) {
                    localStorage.clear();
                    window.location.href = "/interface/authentication";
                    throw new Error("Phiên đăng nhập hết hạn!");
                }
                if (response.status === 403) {
                    throw new Error("Bạn không có quyền xem danh sách việc làm (Yêu cầu vai trò Nhà tuyển dụng)!");
                }
                if (!response.ok) throw new Error("Lỗi kết nối máy chủ HTTP " + response.status);
                return response.json();
            })
            .then(apiResponse => {
                if (apiResponse.code === 200 ) {
                    renderJobs(apiResponse.data, currentStatus, kw);
                } else {
                    throw new Error(apiResponse.message || "Lỗi xử lý từ server");
                }
            })
            .catch(error => {
                container.innerHTML = `<div class="alert-error">Không thể tải dữ liệu: ${error.message}</div>`;
            });
    }

    // 4. HÀM RENDER HTML
    function renderJobs(jobs, currentStatus, keyword) {
        const container = document.getElementById('job-list-container');

        if (!jobs || jobs.length === 0) {
            const emptyMsg = keyword
                ? `Không tìm thấy công việc nào khớp với từ khóa "<strong>${keyword}</strong>".`
                : 'Hệ thống hiện không có công việc nào ở trạng thái này.';
            container.innerHTML = `<div class="state-box">
                                <h5>Không có công việc nào</h5>
                                <p>${emptyMsg}</p>
                              </div>`;
            return;
        }

        let html = "";
        const formatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

        jobs.forEach(job => {
            const start = job.startTime ? job.startTime.replace('T', ' ').substring(0, 16) : 'Chưa cập nhật';
            const rate = job.hourlyRate != null ? formatter.format(job.hourlyRate) : 'Thỏa thuận';
            const statusLabel = STATUS_LABEL[currentStatus] || currentStatus;

            const safeLat = job.latitude != null ? job.latitude : 0;
            const safeLng = job.longitude != null ? job.longitude : 0;

            let actionButtons = "";

            if (currentStatus === 'OPEN') {
                actionButtons = `
                         <button class="btn btn-sm btn-accent" onclick="openRadar('${job.id}', ${safeLat}, ${safeLng})">
                             <i class="ti ti-radar"></i> Tìm thợ xung quanh
                         </button>
                         <button class="btn btn-sm btn-primary" onclick="openManageApplications('${job.id}')">
                             <i class="ti ti-users"></i> Duyệt ứng viên
                         </button>
                         <button class="btn btn-sm btn-danger-outline" onclick="cancelJob('${job.id}')">Hủy việc</button>`;
            } else if (currentStatus === 'IN_PROGRESS') {
                // SỬA: Đã thêm sự kiện onclick gọi hàm openGenerateQR
                actionButtons = `<button class="btn btn-sm btn-warning" onclick="openGenerateQR('${job.id}')">
                                     <i class="ti ti-qrcode"></i> Quản lý Điểm danh
                                 </button>`;
            } else if (currentStatus === 'COMPLETED') {
                actionButtons = `<button class="btn btn-sm btn-primary" onclick="openManageApplications('${job.id}')"><i class="ti ti-star"></i> Đánh giá Thợ</button>
                         <button class="btn btn-sm btn-ghost" onclick="openManageApplications('${job.id}')">Xem danh sách thợ</button>`;
            }

            html += `
            <div class="job-card">
              <div class="job-card-top">
                <div>
                  <h3 class="job-title">${job.title || 'Không có tiêu đề'}</h3>
                  <div class="job-meta">
                    <span><i class="ti ti-calendar"></i>${start}</span>
                    <span><i class="ti ti-map-pin"></i>Vĩ độ ${job.latitude?.toFixed(4) || 'N/A'}, Kinh độ ${job.longitude?.toFixed(4) || 'N/A'}</span>
                  </div>
                  <div class="job-info">
                    <span><i class="ti ti-currency-dong"></i>${rate}/giờ</span>
                    <span><i class="ti ti-users"></i>Cần ${job.requiredWorkers || 0} người</span>
                  </div>
                </div>
                <span class="status-badge status-${currentStatus}">${statusLabel}</span>
              </div>
              <div class="job-actions">
                ${actionButtons}
              </div>
            </div>
            `;
        });

        container.innerHTML = html;
    }

    // 5. CHUYỂN HƯỚNG SANG TRANG RADAR
    function openRadar(jobId, lat, lng) {
        if (!jobId || jobId === 'undefined') {
            alert("Lỗi: Không tìm thấy ID công việc (job.id).");
            return;
        }
        localStorage.setItem('currentRadarJobId', jobId);
        localStorage.setItem('currentRadarJobLat', lat);
        localStorage.setItem('currentRadarJobLng', lng);
        window.location.href = '/interface/findworker';
    }

    // 6. CHUYỂN HƯỚNG SANG TRANG DUYỆT ỨNG VIÊN
    function openManageApplications(jobId) {
        if (!jobId || jobId === 'undefined') {
            alert("Lỗi: Không tìm thấy ID công việc (job.id).");
            return;
        }

        localStorage.setItem('currentJobId', jobId);
        window.location.href = '/interface/checkapplication';
    }


    function openGenerateQR(jobId) {
        if (!jobId || jobId === 'undefined') {
            alert("Lỗi: Không tìm thấy ID công việc (job.id).");
            return;
        }

        localStorage.setItem('currentJobId', jobId);


        window.location.href = '/interface/generateqr';
    }

    // 7. HỦY CÔNG VIỆC
    function cancelJob(jobId) {
        if (!jobId || jobId === 'undefined') {
            alert("Lỗi: Không tìm thấy ID công việc.");
            return;
        }

        if (!confirm("Bạn có chắc chắn muốn hủy công việc này không? Các đơn ứng tuyển liên quan sẽ bị hủy.")) {
            return;
        }

        fetch(`http://localhost:8083/api/v1/job/cancellation?jobId=${jobId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
        .then(res => {
            if (res.status === 403) {
                alert("Bạn không có quyền hủy công việc này!");
                throw new Error("403 Forbidden");
            }
            return res.json();
        })
        .then(data => {
            if (data.code === 200 || data.success) {
                alert("Hủy công việc thành công!");
                loadEmployerJobs(currentStatus, '');
            } else {
                alert("Lỗi: " + (data.message || "Không thể hủy công việc"));
            }
        })
        .catch(err => {
            console.error(err);
            alert("Lỗi kết nối tới máy chủ khi hủy việc!");
        });
    }

    function logout() {
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            localStorage.clear();
            window.location.href = '/interface/authentication';
        }
    }
