const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');

    let map, myMarker, radarCircle;
    let jobMarkers = {};
    let jobDataMap = {};
    let stompClient = null;
    let currentLat = 21.0285;
    let currentLng = 105.8542;
    let radiusKm = 5.0;
    let selectedJobId = null;

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }
        if (currentMode !== 'WORKER') {
            alert("Trang tìm việc làm chỉ dành cho Người tìm việc / Ứng viên! Vui lòng chuyển vai trò trong trang Cá nhân.");
            window.location.href = "/interface/managejob";
            return;
        }
        initMap();
    });

    function initMap() {
        map = L.map('map', { zoomControl: false, attributionControl: false }).setView([currentLat, currentLng], 13);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
        L.control.zoom({ position: 'bottomleft' }).addTo(map);
        connectWebSocket();
    }

    function connectWebSocket() {
        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function () {
            startRadar();
        }, function() {
            document.getElementById('gps-status').innerHTML = `<i class="ti ti-wifi-off" style="color:red"></i> Mất kết nối`;
        });
    }

    function startRadar() {
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                (position) => {
                    currentLat = position.coords.latitude;
                    currentLng = position.coords.longitude;
                    updateMyPosition(currentLat, currentLng);
                    if (stompClient && stompClient.connected) {
                        stompClient.send("/app/locationworker", {}, JSON.stringify({ latitude: currentLat, longitude: currentLng }));
                    }
                    if (Object.keys(jobDataMap).length === 0) { scanNearbyJobs(); }
                },
                (error) => console.error("Lỗi GPS:", error),
                { enableHighAccuracy: true }
            );
        }
    }

    function updateMyPosition(lat, lng) {
        let latlng = [lat, lng];
        if (!myMarker) {
            const myIcon = L.divIcon({
                className: 'my-location-icon',
                html: `<div style="width:20px;height:20px;background:#FF6600;border-radius:50%;border:3px solid #18181B;box-shadow:0 0 16px rgba(255,102,0,0.9);"></div>`,
                iconSize: [26, 26], iconAnchor: [13, 13]
            });
            myMarker = L.marker(latlng, { icon: myIcon, zIndexOffset: 1000 }).addTo(map);
            radarCircle = L.circle(latlng, { color: '#FF6600', fillColor: '#FF6600', fillOpacity: 0.12, radius: radiusKm * 1000 }).addTo(map);
            map.setView(latlng, 13);
        } else {
            myMarker.setLatLng(latlng);
            radarCircle.setLatLng(latlng);
        }
    }

    function recenterMap() { if (myMarker) map.setView(myMarker.getLatLng(), 14, { animate: true }); }

    function updateRadius() {
        let val = parseFloat(document.getElementById('input-radius').value);
        if (val > 0) {
            radiusKm = val;
            if (radarCircle) { radarCircle.setRadius(radiusKm * 1000); map.fitBounds(radarCircle.getBounds()); }
            scanNearbyJobs();
        }
    }

    function scanNearbyJobs() {
        document.getElementById('scan-effect').style.display = 'block';
        document.getElementById('job-list-container').innerHTML = `<div style="text-align:center;color:#94a3b8;margin-top:20px;"><i class="ti ti-loader ti-spin" style="font-size:24px;"></i><p>Đang quét việc làm...</p></div>`;

        fetch(`/api/v1/job/nearbyjob?lat=${currentLat}&lng=${currentLng}&radiusInKm=${radiusKm}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => {
            if (res.status === 401) {
                alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                window.location.href = "/interface/authentication";
                throw new Error("401 Unauthorized");
            }
            if (res.status === 403) {
                alert("Bạn không có quyền tìm việc ở vai trò hiện tại (Yêu cầu vai trò Ứng viên / Người tìm việc)!");
                window.location.href = "/interface/managejob";
                throw new Error("403 Forbidden");
            }
            return res.json();
        })
        .then(apiRes => {
            let jobs = apiRes.data || [];
            document.getElementById('job-count').innerText = jobs.length;
            for (let id in jobMarkers) { map.removeLayer(jobMarkers[id]); }
            jobMarkers = {};
            jobDataMap = {};
            renderJobList(jobs);
            jobs.forEach(job => { jobDataMap[job.id] = job; drawJobMarker(job); });
            setTimeout(() => document.getElementById('scan-effect').style.display = 'none', 1000);
        })
        .catch(() => {
            document.getElementById('job-list-container').innerHTML = `<p style="color:red;text-align:center">Lỗi tải dữ liệu!</p>`;
            setTimeout(() => document.getElementById('scan-effect').style.display = 'none', 1000);
        });
    }

    function drawJobMarker(job) {
        if (!job.latitude || !job.longitude) return;
        const jobIcon = L.divIcon({
            className: 'job-icon',
            html: `<div style="width:26px;height:26px;background:#18181B;border-radius:50%;border:2px solid #FF6600;display:flex;align-items:center;justify-content:center;color:#FF6600;font-size:14px;box-shadow:0 3px 10px rgba(0,0,0,0.3);"><i class="ti ti-briefcase"></i></div>`,
            iconSize: [28, 28], iconAnchor: [14, 14]
        });
        const marker = L.marker([job.latitude, job.longitude], { icon: jobIcon }).addTo(map);
        marker.on('click', () => { focusJob(job.id); viewDetail(job.id); });
        jobMarkers[job.id] = marker;
    }

    function renderJobList(jobs) {
        const container = document.getElementById('job-list-container');
        if (jobs.length === 0) {
            container.innerHTML = `<div style="text-align:center;color:#94a3b8;margin-top:20px;">Không có việc làm nào trong bán kính ${radiusKm}km!</div>`;
            return;
        }
        let html = "";
        jobs.forEach(job => {
            const rate = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.hourlyRate);
            const distKm = (map.distance(L.latLng(currentLat, currentLng), L.latLng(job.latitude, job.longitude)) / 1000).toFixed(2);
            const empRatingText = job.employerRating ? `${job.employerRating}★ (${job.employerReviewCount || 0})` : 'Mới (4.5★)';
            const empRepText = (job.employerScore != null ? job.employerScore : 100) + 'đ';
            const topJobBadge = (job.priorityScore && job.priorityScore >= 94)
                ? `<span style="background: var(--primary-light); color: var(--primary-orange); font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #fed7aa;"><i class="ti ti-rosette-discount-check"></i> NTD Uy tín</span>`
                : '';

            const empAvatar = (typeof resolveAvatarUrl === 'function') 
                ? resolveAvatarUrl(job.employerAvatar, job.employerName) 
                : (job.employerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.employerName || 'NTD')}&background=18181b&color=ff6600&size=128&bold=true`);

            html += `
                <div class="job-card" id="card-${job.id}" onclick="focusJob('${job.id}')">
                    <div class="job-card-icon" style="overflow:hidden; border-radius:50%; border:1.5px solid var(--primary-orange); width:44px; height:44px; flex-shrink:0;">
                        <img src="${empAvatar}" style="width:100%; height:100%; object-fit:cover;" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(job.employerName)}');">
                    </div>
                    <div class="job-info">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
                            <h4 style="margin: 0;">${job.title}</h4>
                            ${topJobBadge}
                        </div>
                        <p style="margin: 2px 0 3px; font-size: 12px; color: #475569;">
                            <i class="ti ti-user"></i> <b>${job.employerName || 'Nhà tuyển dụng'}</b>
                            &nbsp;·&nbsp;
                            <span style="color: #f59e0b; font-weight: 600;"><span style="color: #f59e0b; margin-right: 2px;">★</span> ${empRatingText}</span>
                            &nbsp;·&nbsp;
                            <span style="color: #0284c7; font-weight: 600;"><i class="ti ti-shield-check"></i> ${empRepText}</span>
                        </p>
                        <p><i class="ti ti-route"></i> Cách ${distKm} km</p>
                        <p class="job-rate"><i class="ti ti-cash"></i> ${rate}/h</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action" style="background:#64748b;font-size:11px;" onclick="event.stopPropagation(); viewDetail('${job.id}')">Chi tiết</button>
                        <button class="btn-action" style="background:var(--primary-orange); color:#ffffff;" id="btn-list-${job.id}" onclick="event.stopPropagation(); applyJob('${job.id}')">Ứng tuyển</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function focusJob(id) {
        if (jobMarkers[id]) map.setView(jobMarkers[id].getLatLng(), 15, { animate: true });
    }

    function viewDetail(jobId) {
        selectedJobId = jobId;
        let job = jobDataMap[jobId];
        const empAvatar = (typeof resolveAvatarUrl === 'function') 
            ? resolveAvatarUrl(job.employerAvatar, job.employerName) 
            : (job.employerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(job.employerName || 'NTD')}&background=18181b&color=ff6600&size=128&bold=true`);
        const rate = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(job.hourlyRate);
        const start = new Date(job.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const end = new Date(job.endTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        const distKm = (map.distance(L.latLng(currentLat, currentLng), L.latLng(job.latitude, job.longitude)) / 1000).toFixed(2);
        const empRatingText = job.employerRating ? `${job.employerRating} / 5.0 ⭐ (${job.employerReviewCount || 0} đánh giá)` : 'Chưa có đánh giá (Mới)';
        const empRepText = (job.employerScore != null ? job.employerScore : 100) + ' / 100 điểm';

        document.getElementById('modal-body-content').innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <img src="${empAvatar}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--primary-orange);flex-shrink:0;box-shadow:0 3px 10px rgba(255,102,0,0.15);" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(job.employerName)}');">
                <div>
                    <h3 style="margin:0 0 4px;font-size:17px;color:var(--text-main);">${job.title}</h3>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size:12.5px;color:var(--text-sub);"><i class="ti ti-user"></i> <b>${job.employerName || 'Nhà tuyển dụng'}</b></span>
                        <span style="font-size: 11.5px; color: #f59e0b; font-weight: 600;"><span style="color: #f59e0b; margin-right: 2px;">★</span> ${empRatingText}</span>
                        <span style="font-size: 11.5px; color: #0284c7; font-weight: 600;"><i class="ti ti-shield-check"></i> ${empRepText}</span>
                    </div>
                </div>
            </div>
            <div style="border-top:1px dashed #e2e8f0;margin-bottom:16px;"></div>
            <div class="detail-row">
                <i class="ti ti-cash detail-icon" style="color:var(--warning);"></i>
                <div><b>Thu nhập:</b><br>${rate}/giờ</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-users detail-icon"></i>
                <div><b>Số lượng cần:</b><br>${job.requiredWorkers} người</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-calendar detail-icon"></i>
                <div><b>Thời gian:</b><br>${start} → ${end}</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-route detail-icon"></i>
                <div><b>Khoảng cách:</b><br>Cách bạn ${distKm} km</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-phone detail-icon" style="color:var(--primary);"></i>
                <div><b>Số điện thoại liên hệ:</b><br>${job.employerPhone ? `<a href="tel:${job.employerPhone}" style="color:var(--primary); font-weight:600; text-decoration:none;"><i class="ti ti-phone-call"></i> ${job.employerPhone} (Bấm để gọi trao đổi)</a>` : '<span style="color:var(--text-sub);">Chưa cập nhật</span>'}</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-shield-check detail-icon" style="color:#0284c7;"></i>
                <div><b>Uy tín Nhà tuyển dụng:</b><br><span style="font-weight: 600; color: #0284c7;">${empRepText}</span> · <span style="color:#f59e0b; font-weight:600;">${empRatingText}</span></div>
            </div>
        `;
        document.getElementById('job-modal').style.display = 'flex';
        const btnModal = document.getElementById('btn-apply-modal');
        btnModal.disabled = false;
        btnModal.innerHTML = `<i class="ti ti-send"></i> Ứng tuyển ngay`;
        btnModal.style.background = "var(--primary-orange)";
    }

    function closeModal() { document.getElementById('job-modal').style.display = 'none'; }
    function applyJobFromModal() { applyJob(selectedJobId); }

    function applyJob(jobId) {
        if (!confirm("Xác nhận gửi đơn ứng tuyển cho công việc này?")) return;
        let btnList = document.getElementById(`btn-list-${jobId}`);
        let btnModal = document.getElementById('btn-apply-modal');
        if (btnList) { btnList.disabled = true; btnList.innerText = "Đang gửi..."; }
        if (btnModal && selectedJobId === jobId) { btnModal.disabled = true; btnModal.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang gửi...`; }

        fetch(`/api/v1/job/application?jobId=${jobId}`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token }
        })
        .then(res => {
            if (res.status === 403) {
                alert("Bạn không thể ứng tuyển với vai trò hiện tại (Chỉ Ứng viên mới có thể ứng tuyển và không được ứng tuyển việc của chính mình)!");
                throw new Error("403 Forbidden");
            }
            return res.text().then(text => text ? JSON.parse(text) : { success: res.ok, code: res.status });
        })
        .then(data => {
            if (data.code === 201 || data.code === 200 || data.success) {
                alert("Ứng tuyển thành công! Vui lòng chờ phản hồi.");
                if (btnList) { btnList.innerText = "Đã ứng tuyển"; btnList.style.background = "#94a3b8"; }
                if (btnModal && selectedJobId === jobId) { btnModal.innerHTML = "Đã ứng tuyển"; btnModal.style.background = "#94a3b8"; }
                setTimeout(closeModal, 1000);
            } else {
                alert("Lỗi: " + (data.message || "Không thể ứng tuyển. Bạn đã ứng tuyển hoặc trùng lịch!"));
                if (btnList) { btnList.disabled = false; btnList.innerText = "Ứng tuyển"; }
                if (btnModal && selectedJobId === jobId) { btnModal.disabled = false; btnModal.innerHTML = `<i class="ti ti-send"></i> Ứng tuyển ngay`; }
            }
        })
        .catch(err => {
            if (err.message !== "403 Forbidden") {
                alert("Lỗi máy chủ!");
            }
            if (btnList) { btnList.disabled = false; btnList.innerText = "Ứng tuyển"; }
            if (btnModal && selectedJobId === jobId) { btnModal.disabled = false; btnModal.innerHTML = `<i class="ti ti-send"></i> Ứng tuyển ngay`; }
        });
    }

    function logout() {
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            localStorage.clear();
            window.location.href = '/interface/authentication';
        }
    }
