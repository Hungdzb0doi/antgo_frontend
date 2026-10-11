let map = null;
    let currentMarker = null;

    const token = localStorage.getItem('accessToken');
    const currentMode = localStorage.getItem('currentMode');

    document.addEventListener("DOMContentLoaded", () => {
        if (!token) {
            alert("Vui lòng đăng nhập để tiếp tục!");
            window.location.href = "/interface/authentication";
            return;
        }

        if (currentMode !== 'EMPLOYER') {
            alert("Trang đăng tin việc làm chỉ dành cho Nhà tuyển dụng! Vui lòng chuyển vai trò trong trang Hồ sơ cá nhân.");
            window.location.href = "/interface/manageapplication";
            return;
        }

        initMap();
        loadCategories();
    });

    function initMap() {
        // Khởi tạo bản đồ với vị trí mặc định (Hà Nội)
        map = L.map('map', { attributionControl: false }).setView([21.028511, 105.804817], 13);

        // Load bản đồ Google cực nhanh giống trang findjob
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);

        // Click để cắm ghim vị trí thủ công
        map.on('click', function(e) {
            setMapLocation(e.latlng.lat, e.latlng.lng, `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
        });

        // Bung đầy đủ kích thước bản đồ trong khung
        setTimeout(function() {
            map.invalidateSize();
            locateQuickly();
        }, 200);
    }

    function setMapLocation(lat, lng, label) {
        if (currentMarker) { map.removeLayer(currentMarker); }
        currentMarker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 15);

        document.getElementById('lat').value = lat;
        document.getElementById('lng').value = lng;
        document.getElementById('loc-text').innerHTML = `<b>Đã ghim:</b> ${label}`;
    }

    function locateQuickly() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                map.setView([pos.coords.latitude, pos.coords.longitude], 14);
            }, () => {});
        }
    }

    // 0. HÀM TẢI DANH MỤC TỪ BACKEND ĐỔ VÀO DROPDOWN
    function loadCategories() {
        const token = localStorage.getItem('accessToken');
        const select = document.getElementById('categoryId');

        fetch('/api/v1/category', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        })
            .then(res => res.json())
            .then(res => {
                const categories = res.data || res;
                select.innerHTML = '';

                if (Array.isArray(categories) && categories.length > 0) {
                    var defaultOpt = document.createElement('option');
                    defaultOpt.value = "";
                    defaultOpt.textContent = "-- Chọn danh mục ngành nghề --";
                    select.appendChild(defaultOpt);

                    categories.forEach(cat => {
                        var option = document.createElement('option');
                        option.value = cat.id;
                        option.textContent = cat.name || cat.categoryName;
                        select.appendChild(option);
                    });
                } else {
                    var option = document.createElement('option');
                    option.value = "";
                    option.textContent = "-- Chưa có danh mục nào (Vui lòng tạo ở Admin) --";
                    select.appendChild(option);
                }
            })
            .catch(err => {
                console.error("Lỗi tải danh mục công việc:", err);
                document.getElementById('categoryId').innerHTML = '<option value="">Lỗi tải danh mục</option>';
            });
    }

    // 1. HÀM LẤY GỢI Ý TỰ ĐỘNG QUA PHOTON (CÓ KỸ THUẬT DEBOUNCE BẢO VỆ)
    var debounceTimer;
    function fetchSuggestions() {
        var keyword = document.getElementById('customSearchInput').value;
        if (keyword.length < 3) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            var url = `https://photon.komoot.io/api/?q=${encodeURIComponent(keyword)}&limit=5`;

            fetch(url)
                .then(res => res.json())
                .then(data => {
                    var dataList = document.getElementById('suggestions');
                    dataList.innerHTML = '';

                    if (data && data.features) {
                        data.features.forEach(feature => {
                            var props = feature.properties;
                            var fullName = [props.name, props.street, props.city, props.state].filter(Boolean).join(", ");

                            var option = document.createElement('option');
                            option.value = fullName;
                            dataList.appendChild(option);
                        });
                    }
                })
                .catch(err => console.error("Lỗi gợi ý Photon:", err));
        }, 500);
    }

    // 2. HÀM TÌM KIẾM VÀ GHIM ĐỊA CHỈ TRỰC TIẾP
    function customSearch() {
        var keyword = document.getElementById('customSearchInput').value;
        if (!keyword) {
            alert("Vui lòng nhập địa chỉ cần tìm!");
            return;
        }

        document.getElementById('loc-text').innerHTML = `<i>Đang tìm kiếm qua Photon...</i>`;

        var url = `https://photon.komoot.io/api/?q=${encodeURIComponent(keyword)}&limit=1`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data && data.features && data.features.length > 0) {
                    var feature = data.features[0];
                    var lon = parseFloat(feature.geometry.coordinates[0]);
                    var lat = parseFloat(feature.geometry.coordinates[1]);

                    var props = feature.properties;
                    var addressName = props.name || props.street || props.city || keyword;

                    map.setView([lat, lon], 17);
                    if (currentMarker) { map.removeLayer(currentMarker); }
                    currentMarker = L.marker([lat, lon]).addTo(map);

                    document.getElementById('lat').value = lat;
                    document.getElementById('lng').value = lon;
                    document.getElementById('loc-text').innerHTML = `<b>Đã ghim:</b> ${addressName}`;
                } else {
                    alert("Không tìm thấy địa điểm này với Photon!");
                    document.getElementById('loc-text').innerHTML = `Chưa chọn tọa độ.`;
                }
            })
            .catch(err => {
                alert("Lỗi kết nối tới Photon!");
                console.error("Chi tiết lỗi:", err);
            });
    }




    // 4. NÚT LẤY VỊ TRÍ HIỆN TẠI (Đảm bảo chính xác ngay từ lần click đầu tiên)
    function goToMyLocation() {
        if (!navigator.geolocation) {
            document.getElementById('loc-text').innerHTML = `<span style="color:var(--black-sub);"><i class="ti ti-alert-circle"></i> Trình duyệt không hỗ trợ định vị GPS. Vui lòng bấm chọn vị trí trên bản đồ.</span>`;
            return;
        }

        document.getElementById('loc-text').innerHTML = `<i>Đang kết nối vệ tinh GPS để lấy vị trí chính xác nhất... Vui lòng đợi.</i>`;

        const geoOptions = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        };

        
        let watchId = navigator.geolocation.watchPosition(function(position) {
            var lat = position.coords.latitude;
            var lng = position.coords.longitude;
            var accuracy = position.coords.accuracy; // Độ sai số (tính bằng mét)

            // CHỈ CHẤP NHẬN tọa độ khi độ sai số (accuracy) nhỏ hơn 100 mét (GPS thực sự)
            if (accuracy <= 200) {
                // Đạt chuẩn rồi thì tắt tính năng theo dõi đi để đỡ tốn pin
                navigator.geolocation.clearWatch(watchId);

                // Bay đến đúng vị trí
                map.setView([lat, lng], 17);
                if (currentMarker) { map.removeLayer(currentMarker); }
                currentMarker = L.marker([lat, lng]).addTo(map);

                document.getElementById('lat').value = lat;
                document.getElementById('lng').value = lng;
                document.getElementById('loc-text').innerHTML = `<b>Vị trí chính xác:</b> ${lat.toFixed(5)}, ${lng.toFixed(5)} <span style="color: var(--primary-orange); font-weight:600;">(Sai số: ${Math.round(accuracy)}m)</span>`;
            } else {
                document.getElementById('loc-text').innerHTML = `<i>Đang tinh chỉnh GPS (Sai số hiện tại: ${Math.round(accuracy)}m)...</i>`;
            }
        }, function(error) {
            console.error("Lỗi GPS: ", error);
            document.getElementById('loc-text').innerHTML = `Vui lòng chọn vị trí thủ công hoặc kiểm tra lại quyền Vị trí.`;
            navigator.geolocation.clearWatch(watchId);
        }, geoOptions);

        // Hẹn giờ tự động tắt quá trình quét sau 10 giây nếu ở trong nhà kín (không có sóng GPS)
        // Khi đó sẽ tạm thời dùng tọa độ tốt nhất bắt được ở thời điểm đó
        setTimeout(() => {
            navigator.geolocation.clearWatch(watchId);
            let textElem = document.getElementById('loc-text');
            if(textElem.innerHTML.includes("Đang tinh chỉnh")) {
                textElem.innerHTML += " <b>(Hoàn tất)</b>";
            }
        }, 10000);
    }

    // 5. GỬI DATA ĐĂNG TIN LÊN BACKEND (CHỐNG BẤM LIÊN TỤC / SPAM CLICK)
    let isSubmittingJob = false;
    let lastSubmitTime = 0;

    function submitJob() {
        const now = Date.now();
        // Chặn bấm liên tục (ít nhất 2 giây giữa các lần bấm) hoặc khi đang gửi request
        if (isSubmittingJob || (now - lastSubmitTime < 2000)) {
            return;
        }

        const title = document.getElementById('title').value;
        const hourlyRate = document.getElementById('hourlyRate').value;
        const requiredWorkers = document.getElementById('requiredWorkers').value;
        const categoryId = document.getElementById('categoryId').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const lat = document.getElementById('lat').value;
        const lng = document.getElementById('lng').value;

        if (!title || !startTime || !endTime || !lat || !categoryId) {
            alert("Vui lòng điền đủ thông tin, chọn danh mục và chọn vị trí trên bản đồ!");
            return;
        }

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);
        const currentDate = new Date();

        if (startDate < currentDate) {
            alert("Thời gian bắt đầu làm việc phải từ thời điểm hiện tại trở đi!");
            return;
        }

        if (endDate <= startDate) {
            alert("Thời gian kết thúc phải sau thời gian bắt đầu làm việc!");
            return;
        }

        const payload = {
            title: title,
            hourlyRate: parseFloat(hourlyRate),
            requiredWorkers: parseInt(requiredWorkers),
            categoryId: categoryId,
            startTime: startTime + ":00",
            endTime: endTime + ":00",
            latitude: parseFloat(lat),
            longitude: parseFloat(lng)
        };

        const token = localStorage.getItem('accessToken');
        const btn = document.getElementById('btn-submit-job');

        // Khóa nút ngay lập tức và hiển thị trạng thái đang xử lý
        isSubmittingJob = true;
        lastSubmitTime = now;
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.style.cursor = 'not-allowed';
            btn.innerHTML = `<i class="ti ti-loader ti-spin"></i> Đang đăng việc...`;
        }

        function unlockSubmitButton() {
            setTimeout(() => {
                isSubmittingJob = false;
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.innerHTML = `<i class="ti ti-plus"></i> Đăng việc làm`;
                }
            }, 1000);
        }

        fetch('/api/v1/job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (res.status === 403) {
                    alert("Bạn không có quyền đăng tin với vai trò hiện tại! Vui lòng chuyển sang vai trò Nhà tuyển dụng.");
                    throw new Error("403 Forbidden");
                }
                if (res.status === 401) {
                    alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
                    window.location.href = "/interface/authentication";
                    throw new Error("401 Unauthorized");
                }
                return res.json();
            })
            .then(data => {
                if (data.code === 201 || data.code === 200 || data.success === true) {
                    alert("Đăng tin việc làm thành công!");
                    window.location.href = "/interface/managejob";
                } else {
                    alert("Lỗi: " + (data.message || "Không thể đăng tin"));
                    unlockSubmitButton();
                }
            })
            .catch(err => {
                console.error(err);
                if (err.message !== "403 Forbidden" && err.message !== "401 Unauthorized") {
                    alert("Lỗi kết nối tới máy chủ khi đăng tin!");
                }
                unlockSubmitButton();
            });
    }

    function logout() {
        if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
            localStorage.clear();
            window.location.href = '/interface/authentication';
        }
    }
