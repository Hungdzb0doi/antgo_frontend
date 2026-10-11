const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');
    const jobId = localStorage.getItem('currentRadarJobId');
    const storedLat = localStorage.getItem('currentRadarJobLat');
    const storedLng = localStorage.getItem('currentRadarJobLng');

    let radiusKm = 5.0;
    let jobLat = storedLat ? parseFloat(storedLat) : 21.028511;
    let jobLng = storedLng ? parseFloat(storedLng) : 105.804817;

    let map, centerMarker, radarCircle;
    let workerMarkers = {};

    // BIẾN TOÀN CỤC LƯU TRỮ DATA CỦA ỨNG VIÊN ĐỂ HIỂN THỊ MODAL
    let workerDataMap = {};
    let currentSelectedWorkerId = null;

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập!");
            window.location.href = "/interface/authentication";
            return;
        }
        if (currentMode !== 'EMPLOYER') {
            alert("Trang tìm ứng viên chỉ dành cho Nhà tuyển dụng! Vui lòng chuyển vai trò trong trang Cá nhân.");
            window.location.href = "/interface/manageapplication";
            return;
        }
        if (!jobId) {
            alert("Lỗi: Không tìm thấy ID công việc!");
            window.location.href = "/interface/managejob";
            return;
        }

        initMap();
        loadInitialWorkers();
        connectRadarWebSocket();
    });

    function initMap() {
        map = L.map('radar-map', { attributionControl: false }).setView([jobLat, jobLng], 13);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);

        radarCircle = L.circle([jobLat, jobLng], {
            color: '#FF6600', fillColor: '#FF6600', fillOpacity: 0.12, radius: radiusKm * 1000
        }).addTo(map);

        const centerIcon = L.divIcon({
            className: 'job-center-icon',
            html: `<div style="width:28px;height:28px;background:#18181B;border-radius:50%;border:2px solid #FF6600;display:flex;align-items:center;justify-content:center;color:#FF6600;font-size:15px;box-shadow:0 3px 12px rgba(255,102,0,0.4);"><i class="ti ti-building"></i></div>`,
            iconSize: [30, 30], iconAnchor: [15, 15]
        });
        centerMarker = L.marker([jobLat, jobLng], { icon: centerIcon }).addTo(map).bindPopup("<b>Vị trí công việc</b>").openPopup();
    }

    // CẬP NHẬT BÁN KÍNH QUÉT
    function updateRadius() {
        let newRadius = parseFloat(document.getElementById('input-radius').value);
        if (newRadius > 0) {
            radiusKm = newRadius;
            radarCircle.setRadius(radiusKm * 1000);
            map.fitBounds(radarCircle.getBounds());
            loadInitialWorkers();
        }
    }

    function loadInitialWorkers() {
        // Bật hiệu ứng sóng radar ngay khi bắt đầu quét
        document.getElementById('scan-effect').style.display = 'block';
        document.getElementById('worker-list-container').innerHTML = `<div style="text-align: center; color: #94a3b8; margin-top: 20px;"><i class="ti ti-loader ti-spin" style="font-size: 24px;"></i><p>Đang dò tìm tín hiệu...</p></div>`;

        fetch(`/api/v1/job/nearby?jobId=${jobId}&radiusInKm=${radiusKm}`, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => {
                if (res.status === 401) {
                    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                    window.location.href = "/interface/authentication";
                    throw new Error("401 Unauthorized");
                }
                if (res.status === 403) {
                    alert("Bạn không có quyền tìm ứng viên cho công việc này (Yêu cầu vai trò Nhà tuyển dụng)!");
                    window.location.href = "/interface/managejob";
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(apiResponse => {
                let workers = apiResponse.data || [];
                document.getElementById('worker-count').innerText = workers.length;

                for (let id in workerMarkers) { map.removeLayer(workerMarkers[id]); }
                workerMarkers = {};
                workerDataMap = {};

                renderWorkerList(workers);

                workers.forEach(w => {
                    let currentId = w.userId || w.id;
                    if (currentId) {
                        workerDataMap[currentId] = w;
                        if (w.userId) workerDataMap[w.userId] = w;
                        if (w.id) workerDataMap[w.id] = w;
                        drawWorkerOnMap(currentId, w.fullName, w.latitude, w.longitude, w.distance);
                    }
                });

                // Tắt hiệu ứng sóng Radar sau 1 giây
                setTimeout(() => { document.getElementById('scan-effect').style.display = 'none'; }, 1000);
            })
            .catch(err => {
                console.error("Lỗi tải danh sách ứng viên:", err);
                document.getElementById('worker-list-container').innerHTML = `<p style="color:var(--text-sub);text-align:center">Lỗi tải dữ liệu!</p>`;
                setTimeout(() => { document.getElementById('scan-effect').style.display = 'none'; }, 1000);
            });
    }

    function renderWorkerList(workers) {
        const container = document.getElementById('worker-list-container');
        if (workers.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #94a3b8; margin-top: 20px;">Không có ứng viên nào trong bán kính ${radiusKm}km!</div>`;
            return;
        }

        let html = "";
        workers.forEach(worker => {
            let dist = worker.distance ? parseFloat(worker.distance).toFixed(2) : '0.00';
            let currentId = worker.id || worker.userId;
            let avatar = (typeof resolveAvatarUrl === 'function')
                ? resolveAvatarUrl(worker.avatar, worker.fullName)
                : (worker.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.fullName)}&background=18181b&color=ff6600&size=128&bold=true`);
            let ratingText = worker.averageRating ? `${worker.averageRating}★ (${worker.reviewCount || 0})` : 'Mới (4.5★)';
            let repText = (worker.workerScore != null ? worker.workerScore : 100) + '/100đ';
            let topBadge = (worker.priorityScore && worker.priorityScore >= 94)
                ? `<span style="background: #fef3c7; color: #b45309; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;"><i class="ti ti-crown"></i> Top ứng viên</span>`
                : '';

            let appliedBadge = worker.hasApplied
                ? `<span style="background: #e0e7ff; color: #4338ca; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe; margin-right: 4px;"><i class="ti ti-hand-click"></i> Đã ứng tuyển</span>`
                : '';

            html += `
                <div class="worker-card" id="card-${currentId}" onclick="focusMarker('${currentId}')">
                    <img src="${avatar}" class="worker-avatar" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(worker.fullName)}');">
                    <div class="worker-info">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
                            <h4 style="margin: 0;">${worker.fullName}</h4>
                            <div style="display: flex; align-items: center;">
                                ${appliedBadge}
                                ${topBadge}
                            </div>
                        </div>
                        <p style="margin: 2px 0 4px; font-size: 12px; color: #475569;">
                            <span style="color: #f59e0b; font-weight: 600;"><span style="color: #f59e0b; margin-right: 2px;">★</span> ${ratingText}</span>
                            &nbsp;·&nbsp;
                            <span style="color: #0284c7; font-weight: 600;"><i class="ti ti-shield-check"></i> ${repText}</span>
                        </p>
                        <p style="font-size: 11.5px; color: #64748b; margin: 0;"><i class="ti ti-map-pin"></i> Cách ${dist} km</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action" style="background:#64748b; font-size:11px;" onclick="event.stopPropagation(); viewDetail('${currentId}')">Chi tiết</button>
                        <button class="btn-action btn-invite" style="background:var(--primary-orange); color:#ffffff;" onclick="event.stopPropagation(); invite('${currentId}')">Mời</button>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    function connectRadarWebSocket() {
        let socket = new SockJS('/ws');
        let stompClient = Stomp.over(socket);
        stompClient.debug = null; // Tắt log debug cho mượt

        stompClient.connect({ 'Authorization': 'Bearer ' + token }, function (frame) {
            stompClient.subscribe('/topic/locationworker', function (message) {
                let data = JSON.parse(message.body);
                let currentId = data.workerId || data.id || data.userId;
                if (!currentId) return;

                let workerLatLng = L.latLng(data.latitude, data.longitude);
                let jobLatLng = L.latLng(jobLat, jobLng);
                let realTimeDist = (workerLatLng.distanceTo(jobLatLng) / 1000).toFixed(2);

                if (workerDataMap[currentId]) {
                    workerDataMap[currentId].latitude = data.latitude;
                    workerDataMap[currentId].longitude = data.longitude;
                    workerDataMap[currentId].distance = realTimeDist;
                    if (data.fullName) workerDataMap[currentId].fullName = data.fullName;
                } else {
                    workerDataMap[currentId] = {
                        id: currentId,
                        userId: currentId,
                        fullName: data.fullName || 'Ứng viên',
                        latitude: data.latitude,
                        longitude: data.longitude,
                        distance: realTimeDist,
                        avatar: data.avatar || null,
                        skills: data.skills || null,
                        phone: data.phone || null,
                        email: data.email || null,
                        workerScore: 100,
                        identityVerified: false
                    };
                    // Tự động quét lại danh sách để đồng bộ đầy đủ hồ sơ mới xuất hiện
                    if (!window._reloadNearbyTimeout) {
                        window._reloadNearbyTimeout = setTimeout(() => {
                            window._reloadNearbyTimeout = null;
                            loadInitialWorkers();
                        }, 2000);
                    }
                }

                drawWorkerOnMap(currentId, data.fullName, data.latitude, data.longitude, realTimeDist);
            });
        });
    }

    function drawWorkerOnMap(id, name, lat, lng, distance) {
        let distText = distance ? distance + ' km' : 'Đang cập nhật...';
        let avatar = (typeof resolveAvatarUrl === 'function')
            ? resolveAvatarUrl(workerDataMap[id]?.avatar, name)
            : (workerDataMap[id]?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=18181b&color=ff6600&size=128&bold=true`);
        let isApplied = workerDataMap[id]?.hasApplied;

        let appliedTag = isApplied 
            ? `<div style="font-size:10px; color:#4338ca; background:#e0e7ff; border-radius:4px; border:1px solid #c7d2fe; padding:2px 6px; margin-bottom:6px; display:inline-block; font-weight:600;"><i class="ti ti-hand-click"></i> Đã ứng tuyển</div><br>` 
            : '';

        let popupContent = `
            <div style="text-align: center; min-width: 140px; font-family: sans-serif;">
                <img src="${avatar}" style="width:40px; height:40px; border-radius:50%; margin-bottom:6px; object-fit:cover;" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(name)}');"><br>
                ${appliedTag}
                <h4 style="margin: 0 0 4px; font-size: 14px;">${name}</h4>
                <p style="margin: 0 0 10px; font-size: 12px; color: #64748b;"><i class="ti ti-map-pin"></i> Cách ${distText}</p>
                <div style="display:flex; justify-content:center; gap:6px;">
                    <button class="btn-action" style="padding: 4px 8px; font-size: 11px; background:#64748b;" onclick="viewDetail('${id}')">Chi tiết</button>
                    <button class="btn-action btn-invite" style="padding: 4px 8px; font-size: 11px; background:var(--primary-orange); color:#ffffff;" onclick="invite('${id}')">Mời</button>
                </div>
            </div>
        `;
        let iconUrl = isApplied 
            ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png'
            : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';

        let customIcon = L.icon({
            iconUrl: iconUrl,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        if (workerMarkers[id]) {
            workerMarkers[id].setLatLng([lat, lng]);
            workerMarkers[id].getPopup().setContent(popupContent);
            workerMarkers[id].setIcon(customIcon);
        } else {
            let marker = L.marker([lat, lng], {icon: customIcon}).addTo(map);
            marker.bindPopup(popupContent);
            workerMarkers[id] = marker;
        }
    }

    function focusMarker(workerId) {
        if(workerMarkers[workerId]) {
            map.panTo(workerMarkers[workerId].getLatLng());
            workerMarkers[workerId].openPopup();
        }
    }

    function recenterMap() { if (centerMarker) map.setView(centerMarker.getLatLng(), 14, { animate: true }); }

    // HIỂN THỊ MODAL CHI TIẾT
    function viewDetail(workerId) {
        let worker = workerDataMap[workerId];
        if (!worker) {
            for (let k in workerDataMap) {
                if (workerDataMap[k].userId === workerId || workerDataMap[k].id === workerId) {
                    worker = workerDataMap[k];
                    break;
                }
            }
        }
        if(!worker) {
            alert("Đang tải dữ liệu ứng viên, vui lòng thử lại sau!");
            return;
        }

        currentSelectedWorkerId = worker.userId || worker.id || workerId;

        let avatar = (typeof resolveAvatarUrl === 'function')
            ? resolveAvatarUrl(worker.avatar, worker.fullName)
            : (worker.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.fullName)}&background=18181b&color=ff6600&size=128&bold=true`);
        let verifiedBadge = worker.identityVerified
            ? `<span class="badge-verified"><i class="ti ti-discount-check-filled"></i> Đã xác thực CCCD</span>`
            : `<span class="badge-unverified"><i class="ti ti-alert-circle"></i> Chưa xác thực</span>`;

        let skills = worker.skills ? worker.skills : '<span style="color:#94a3b8; font-style:italic;">Chưa cập nhật kỹ năng</span>';
        let score = worker.workerScore != null ? worker.workerScore + ' điểm' : '<span style="color:#94a3b8;">Chưa có đánh giá</span>';
        let phone = worker.phone || '<span style="color:#94a3b8;">Đang ẩn</span>';
        let email = worker.email || '<span style="color:#94a3b8;">Đang ẩn</span>';

        let html = `
            <div class="profile-header">
                <img src="${avatar}" class="profile-avatar" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeQuote(worker.fullName)}');">
                <div>
                    <h3 style="margin: 0 0 6px; font-size: 18px;">${worker.fullName}</h3>
                    ${verifiedBadge}
                </div>
            </div>

            <div style="border-top: 1px dashed #e2e8f0; margin: 16px 0;"></div>

            <div class="detail-row">
                <i class="ti ti-phone detail-icon"></i>
                <div><b>Số điện thoại:</b><br>${phone}</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-mail detail-icon"></i>
                <div><b>Email liên hệ:</b><br>${email}</div>
            </div>
            <div class="detail-row">
                <span class="detail-icon" style="color: #f59e0b; font-size: 22px; line-height: 1;">★</span>
                <div><b>Đánh giá khách hàng:</b><br>${worker.averageRating ? `${worker.averageRating} / 5.0 ⭐ (${worker.reviewCount || 0} lượt đánh giá)` : '<span style="color:#64748b;">Chưa có đánh giá (Ứng viên mới)</span>'}</div>
            </div>
            <div class="detail-row">
                <i class="ti ti-shield-check detail-icon" style="color: #0284c7;"></i>
                <div><b>Điểm uy tín hệ thống:</b><br><span style="font-weight: 600; color: #0284c7;">${worker.workerScore != null ? worker.workerScore : 100} / 100 điểm</span></div>
            </div>
            <div class="detail-row">
                <i class="ti ti-tools detail-icon"></i>
                <div><b>Kỹ năng chuyên môn:</b><br>${skills}</div>
            </div>
        `;

        document.getElementById('modal-body-content').innerHTML = html;
        document.getElementById('worker-modal').style.display = 'flex';
    }

    // ĐÓNG MODAL
    function closeModal() {
        document.getElementById('worker-modal').style.display = 'none';
        currentSelectedWorkerId = null;
    }

    function inviteFromModal() {
        if(currentSelectedWorkerId) {
            invite(currentSelectedWorkerId);
            closeModal();
        }
    }

    // GỌI API MỜI ỨNG VIÊN
    function invite(workerId) {
        if (!confirm("Bạn có chắc chắn muốn mời ứng viên này làm việc?")) return;

        const apiUrl = `/api/v1/job/invitation?workerId=${workerId}&jobId=${jobId}`;

        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(res => {
                if (res.status === 403) {
                    alert("Bạn không có quyền mời ứng viên cho công việc này (Yêu cầu vai trò Nhà tuyển dụng và là chủ công việc)!");
                    throw new Error("403 Forbidden");
                }
                return res.json();
            })
            .then(data => {
                if (data.code === 201 || data.code === 200) {
                    alert("Đã gửi lời mời thành công!");

                    let cardBtn = document.querySelector(`#card-${workerId} button.btn-invite`) || document.querySelector(`#card-${workerId} button.btn-action[style*="background:var(--primary-orange)"]`);
                    if (cardBtn) {
                        cardBtn.innerText = "Đã mời";
                        cardBtn.style.background = "#94a3b8";
                        cardBtn.disabled = true;
                    }
                    closeModal();
                } else {
                    alert("Lỗi: " + (data.message || "Không thể gửi lời mời"));
                }
            })
            .catch(err => {
                console.error("Lỗi gửi lời mời:", err);
                alert("Lỗi kết nối đến máy chủ! Vui lòng kiểm tra lại mạng.");
            });
    }

    function logout() {
        localStorage.clear();
        window.location.href = '/interface/authentication';
    }
