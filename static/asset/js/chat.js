(function () {
    function initChatUI() {
        const token = localStorage.getItem('accessToken');
        if (!token) return;

        // Load dependencies if needed
        function ensureDependencies(callback) {
            if (typeof SockJS !== 'undefined' && typeof Stomp !== 'undefined') {
                callback();
                return;
            }
            const sockScript = document.createElement('script');
            sockScript.src = "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.6.1/sockjs.min.js";
            sockScript.onload = () => {
                const stompScript = document.createElement('script');
                stompScript.src = "https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js";
                stompScript.onload = () => {
                    callback();
                };
                document.head.appendChild(stompScript);
            };
            document.head.appendChild(sockScript);
        }

        const css = `
            .flashjob-chat-btn {
                position: fixed; z-index: 99998;
                width: 44px; height: 44px; border-radius: 50%;
                background: #FF6600; color: white; border: 2px solid white;
                box-shadow: 0 6px 20px rgba(255,102,0,0.35); display: flex;
                align-items: center; justify-content: center;
                cursor: grab; user-select: none; -webkit-user-select: none;
                touch-action: none;
                right: 20px; bottom: 80px; /* Default position */
            }
            .flashjob-chat-btn:hover { background: #E55C00; }
            .flashjob-chat-btn:active { cursor: grabbing; transform: scale(1.06); }
            .flashjob-chat-badge {
                position: absolute; top: -3px; right: -3px;
                background: #FF6600; color: white; font-size: 11px;
                font-weight: 700; padding: 2px 6px; border-radius: 10px;
                border: 2px solid white; display: none; pointer-events: none;
            }

            .flashjob-chat-dropdown {
                position: fixed; z-index: 99999;
                background: white; border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                width: 340px; max-height: 450px;
                display: flex; flex-direction: column;
                opacity: 0; pointer-events: none; transform: translateY(10px);
                transition: opacity 0.2s, transform 0.2s;
            }
            .flashjob-chat-dropdown.show {
                opacity: 1; pointer-events: auto; transform: translateY(0);
            }
            .chat-dropdown-header {
                padding: 16px; border-bottom: 1px solid #e2e8f0;
                display: flex; justify-content: space-between; align-items: center;
                font-weight: 600; font-size: 16px;
            }
            .chat-dropdown-header .close-dropdown {
                background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;
            }
            .chat-list {
                flex: 1; overflow-y: auto; padding: 0; margin: 0; list-style: none;
            }
            .chat-item {
                display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9;
                cursor: pointer; transition: background 0.2s;
            }
            .chat-item:hover { background: #f8fafc; }
            .chat-item-avatar {
                width: 48px; height: 48px; border-radius: 50%; object-fit: cover; background: #e2e8f0; flex-shrink:0;
            }
            .chat-item-info { flex: 1; min-width: 0; }
            .chat-item-name { font-weight: 600; font-size: 14px; color: #0f172a; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .chat-item-job { font-size: 12px; color: #FF6600; margin: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
            .chat-item-msg { font-size: 13px; color: #64748b; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .chat-item-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; font-size:11px; color:#94a3b8; }
            .chat-item-unread { background: #FF6600; color: white; padding: 2px 6px; border-radius: 10px; font-weight: 700; }

            /* Chat Modal */
            .flashjob-chat-modal {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15,23,42,0.6); z-index: 100000;
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.2s;
            }
            .flashjob-chat-modal.show { opacity: 1; pointer-events: auto; }
            .chat-box {
                background: white; width: 100%; max-width: 400px; height: 90vh; max-height: 600px;
                border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
                box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                transform: scale(0.95); transition: transform 0.2s;
            }
            .flashjob-chat-modal.show .chat-box { transform: scale(1); }
            .chat-box-header {
                padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
                display: flex; align-items: center; gap: 12px;
            }
            .chat-box-header-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
            .chat-box-header-info { flex: 1; min-width: 0; }
            .chat-box-header-name { font-weight: 600; font-size: 15px; margin: 0; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .chat-box-header-job { font-size: 12px; color: #FF6600; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .chat-box-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b; padding:4px;}
            
            .chat-box-messages {
                flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;
                background: #ffffff;
            }
            .chat-msg { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
            .chat-msg-mine { 
                align-self: flex-end; 
                background: #FF6600; 
                color: #ffffff; 
                border-bottom-right-radius: 4px;
                box-shadow: 0 1px 3px rgba(255,102,0,0.25);
            }
            .chat-msg-theirs { 
                align-self: flex-start; 
                background: #f1f5f9; 
                color: #0f172a; 
                border-bottom-left-radius: 4px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .chat-msg-mine .chat-msg-time { font-size: 10px; margin-top: 4px; color: rgba(255, 255, 255, 0.85); text-align: right; }
            .chat-msg-theirs .chat-msg-time { font-size: 10px; margin-top: 4px; color: #64748b; text-align: left; }

            .chat-role-badge {
                display: inline-flex;
                align-items: center;
                gap: 3px;
                padding: 2px 7px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: 600;
                line-height: 1.2;
                white-space: nowrap;
                letter-spacing: 0.1px;
            }
            .chat-role-badge.badge-employer {
                background: #18181B;
                color: #ffffff;
                border: 1px solid #18181B;
            }
            .chat-role-badge.badge-worker {
                background: #FFF0E6;
                color: #FF6600;
                border: 1px solid #FED7AA;
            }
            .chat-msg-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 5px;
                font-size: 11px;
            }
            .chat-msg-header-mine {
                justify-content: flex-end;
            }
            .chat-msg-sender-name {
                font-weight: 600;
                color: #475569;
                font-size: 11.5px;
            }
            .chat-msg-mine .chat-msg-sender-name {
                color: rgba(255, 255, 255, 0.95);
            }
            .chat-msg-mine .chat-role-badge.badge-employer,
            .chat-msg-mine .chat-role-badge.badge-worker {
                background: rgba(255, 255, 255, 0.22);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.4);
            }
            
            .chat-box-input {
                padding: 12px 16px; border-top: 1px solid #e2e8f0; background: #f8fafc;
                display: flex; gap: 8px; align-items: center;
            }
            .chat-box-input input {
                flex: 1; padding: 10px 16px; border: 1px solid #cbd5e1; border-radius: 24px;
                outline: none; font-size: 14px;
            }
            .chat-box-input input:focus { border-color: #FF6600; }
            .chat-box-input button {
                width: 40px; height: 40px; border-radius: 50%; background: #FF6600; color: white;
                border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: background 0.15s ease;
            }
            .chat-box-input button:hover:not(:disabled) { background: #E55C00; }
            .chat-box-input button:disabled { background: #cbd5e1; cursor: not-allowed; }
            .chat-safety-banner {
                background: #fffbeb; color: #b45309; border-bottom: 1px solid #fef3c7;
                padding: 6px 14px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;
                line-height: 1.35; flex-shrink: 0;
            }
            .chat-quick-templates {
                display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px; background: #f8fafc;
                border-top: 1px solid #e2e8f0; white-space: nowrap; flex-shrink: 0;
                scrollbar-width: thin;
            }
            .chat-quick-templates::-webkit-scrollbar { height: 3px; }
            .chat-quick-templates::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
            .chat-quick-chip {
                background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px;
                padding: 4px 10px; font-size: 12px; color: #334155; cursor: pointer;
                transition: all 0.15s ease; user-select: none;
            }
            .chat-quick-chip:hover {
                background: #FFF0E6; color: #FF6600; border-color: #FFD8BF;
            }
            .chat-date-divider {
                display: flex; align-items: center; justify-content: center; margin: 10px 0 4px 0;
                position: relative; width: 100%;
            }
            .chat-date-divider::before {
                content: ''; position: absolute; left: 10px; right: 10px; top: 50%;
                height: 1px; background: #e2e8f0; z-index: 1;
            }
            .chat-date-divider span {
                position: relative; z-index: 2; background: #f1f5f9; color: #64748b;
                font-size: 11px; font-weight: 600; padding: 2px 10px; border-radius: 10px;
            }
            .chat-msg-status {
                display: inline-block; margin-left: 3px; font-size: 11px;
            }
            .chat-attach-btn {
                width: 38px; height: 38px; border-radius: 50%;
                background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s ease; flex-shrink: 0;
            }
            .chat-attach-btn:hover { background: #FFF0E6; color: #FF6600; border-color: #FFD8BF; }

            .chat-attachment-preview {
                padding: 8px 14px; background: #f8fafc; border-top: 1px solid #e2e8f0;
                display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0;
            }
            .preview-media-list {
                display: flex; align-items: center; gap: 8px; overflow-x: auto; flex: 1; padding: 2px 0;
                scrollbar-width: thin;
            }
            .preview-media-item {
                position: relative; display: inline-flex; align-items: center;
                background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px;
                padding: 2px; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .preview-media-item img {
                width: 44px; height: 44px; object-fit: cover; border-radius: 6px;
            }
            .preview-media-item .preview-video-thumb {
                width: 44px; height: 44px; background: #FFF0E6; border-radius: 6px;
                display: flex; align-items: center; justify-content: center; color: #FF6600;
            }
            .preview-media-item .item-remove-btn {
                position: absolute; top: -6px; right: -6px; background: #18181B; color: white;
                border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 12px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height: 1;
            }
            .preview-clear-btn {
                background: #64748b; color: white; border: none; border-radius: 50%;
                width: 24px; height: 24px; font-size: 16px; line-height: 1; cursor: pointer;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                transition: background 0.2s;
            }
            .preview-clear-btn:hover { background: #18181B; }

            .chat-msg-media-img {
                max-width: 240px; max-height: 240px; border-radius: 10px;
                cursor: pointer; display: block; object-fit: cover;
                transition: transform 0.2s, opacity 0.2s;
            }
            .chat-msg-media-img:hover { opacity: 0.95; transform: scale(1.02); }
            
            .chat-msg-video-card {
                display: flex; align-items: center; gap: 10px; padding: 10px 14px;
                border-radius: 12px; cursor: pointer; background: rgba(0,0,0,0.06);
                transition: background 0.2s; max-width: 240px;
            }
            .chat-msg-mine .chat-msg-video-card { background: rgba(255,255,255,0.18); color: white; }
            .chat-msg-theirs .chat-msg-video-card { background: #e2e8f0; color: #0f172a; }
            .chat-msg-video-card:hover { filter: brightness(0.95); }
            .chat-msg-video-icon {
                width: 38px; height: 38px; border-radius: 50%; background: #FF6600; color: white;
                display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0;
            }
            .chat-msg-mine .chat-msg-video-icon { background: white; color: #FF6600; }
            .chat-msg-video-title { font-weight: 600; font-size: 13px; margin: 0; }
            .chat-msg-video-sub { font-size: 11px; opacity: 0.8; margin: 0; }
            .chat-msg-caption { margin-top: 6px; font-size: 13.5px; word-break: break-word; }

            /* Media Lightbox */
            .flashjob-media-lightbox {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.85); z-index: 100010;
                display: flex; align-items: center; justify-content: center;
                opacity: 0; pointer-events: none; transition: opacity 0.25s ease;
                padding: 20px;
            }
            .flashjob-media-lightbox.show { opacity: 1; pointer-events: auto; }
            .lightbox-close {
                position: absolute; top: 20px; right: 24px;
                background: rgba(255,255,255,0.2); border: none; color: white;
                font-size: 32px; width: 44px; height: 44px; border-radius: 50%;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: background 0.2s;
            }
            .lightbox-close:hover { background: rgba(255,255,255,0.4); }
            .lightbox-content {
                max-width: 90vw; max-height: 85vh; display: flex; align-items: center; justify-content: center;
            }
            .lightbox-content img {
                max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: 8px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .chat-empty { text-align: center; color: #94a3b8; font-size: 14px; margin: auto; padding: 20px;}

            @media (max-width: 480px) {
                .flashjob-chat-dropdown {
                    width: calc(100vw - 24px) !important;
                    max-width: 360px !important;
                    max-height: 70vh !important;
                }
                .chat-box {
                    max-width: 100% !important;
                    height: 100% !important;
                    max-height: 100% !important;
                    border-radius: 0 !important;
                }
                .chat-msg {
                    max-width: 88%;
                }
                .chat-msg-media-img {
                    max-width: 180px;
                    max-height: 180px;
                }
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.innerHTML = css;
        document.head.appendChild(styleEl);

        const container = document.createElement('div');
        container.innerHTML = `
            <div class="flashjob-chat-btn" id="chat-btn" title="Kéo để di chuyển / Bấm để mở tin nhắn">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="flashjob-chat-badge" id="chat-badge-count">0</span>
            </div>

            <div class="flashjob-chat-dropdown" id="chat-dropdown">
                <div class="chat-dropdown-header">
                    <span>Tin nhắn</span>
                    <button class="close-dropdown" id="chat-dropdown-close">&times;</button>
                </div>
                <ul class="chat-list" id="chat-list-container">
                    <div class="chat-empty">Đang tải...</div>
                </ul>
            </div>

            <div class="flashjob-chat-modal" id="chat-modal">
                <div class="chat-box">
                    <div class="chat-box-header">
                        <img src="/images/default-avatar.png" class="chat-box-header-avatar" id="chat-header-avatar" onerror="this.src='https://ui-avatars.com/api/?name=User&background=random'">
                        <div class="chat-box-header-info">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <h3 class="chat-box-header-name" id="chat-header-name">Tên người dùng</h3>
                                <span id="chat-header-role" class="chat-role-badge" style="display:none;"></span>
                            </div>
                            <p class="chat-box-header-job" id="chat-header-job" style="display:none;"></p>
                        </div>
                        <button class="chat-box-close" id="chat-modal-close">&times;</button>
                    </div>
                    <div class="chat-safety-banner">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        <span>Lưu ý an toàn: Không giao dịch tiền cọc bên ngoài ứng dụng.</span>
                    </div>
                    <div class="chat-box-messages" id="chat-messages-container">
                        <!-- Messages go here -->
                    </div>
                    <div class="chat-quick-templates" id="chat-quick-templates">
                        <!-- Quick reply chips -->
                    </div>
                    <div class="chat-attachment-preview" id="chat-attachment-preview" style="display:none;">
                        <div class="preview-media-list" id="preview-media-list"></div>
                        <button type="button" class="preview-clear-btn" id="preview-clear-btn" title="Hủy tất cả">&times;</button>
                    </div>
                    <form class="chat-box-input" id="chat-form">
                        <button type="button" class="chat-attach-btn" id="chat-attach-btn" title="Gửi ảnh hoặc video">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                            </svg>
                        </button>
                        <input type="file" id="chat-file-input" accept="image/*,video/*" multiple style="display:none;">
                        <input type="text" id="chat-input" placeholder="Nhập tin nhắn..." autocomplete="off">
                        <button type="submit" id="chat-send-btn" title="Gửi">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        </button>
                    </form>
                </div>
            </div>

            <div class="flashjob-media-lightbox" id="chat-media-lightbox">
                <button class="lightbox-close" id="lightbox-close">&times;</button>
                <div class="lightbox-content" id="lightbox-content"></div>
            </div>
        `;
        document.body.appendChild(container);

        const chatBtn = document.getElementById('chat-btn');
        const badge = document.getElementById('chat-badge-count');
        const dropdown = document.getElementById('chat-dropdown');
        const listContainer = document.getElementById('chat-list-container');
        const modal = document.getElementById('chat-modal');
        const messagesContainer = document.getElementById('chat-messages-container');
        const quickTemplates = document.getElementById('chat-quick-templates');
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const chatAttachBtn = document.getElementById('chat-attach-btn');
        const chatFileInput = document.getElementById('chat-file-input');
        const attachPreview = document.getElementById('chat-attachment-preview');
        const previewMediaList = document.getElementById('preview-media-list');
        const previewClearBtn = document.getElementById('preview-clear-btn');
        const mediaLightbox = document.getElementById('chat-media-lightbox');
        const lightboxContent = document.getElementById('lightbox-content');
        const lightboxClose = document.getElementById('lightbox-close');
        let selectedFiles = [];
        
        let stompClient = null;
        let currentApplicationId = null;
        let myUserId = localStorage.getItem('myUserId') || null;
        let currentCounterpartyId = null;
        let currentCounterpartyRole = null;
        let currentMyRole = null;
        const conversationsMap = {};
        const conversationsRoleMap = {};
        const conversationsJobMap = {};
        let isDragging = false;
        let previousTotalUnread = -1;
        let lastRenderedDate = null;

        // Play gentle chime on new message
        function playNotificationTone() {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.36);
            } catch (e) {
                // AudioContext restrictions handled gracefully
            }
        }

        // Format Date divider
        function formatDateDivider(dateStr) {
            if (!dateStr) return 'Hôm nay';
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return 'Hôm nay';
            } else if (date.toDateString() === yesterday.toDateString()) {
                return 'Hôm qua';
            } else {
                return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            }
        }

        // Render Quick Reply Templates based on context
        function renderQuickTemplates() {
            if (!quickTemplates) return;
            quickTemplates.innerHTML = '';
            
            const isWorkerPage = window.location.pathname.includes('manageapplication');
            const isEmployerPage = window.location.pathname.includes('checkapplication');

            let templates = [
                'Xin chào!',
                'OK bạn nhé',
                'Cảm ơn bạn!'
            ];

            if (isWorkerPage) {
                templates = [
                    'Tôi đang trên đường tới',
                    'Khoảng 10 phút nữa tôi có mặt',
                    'Tôi đã tới nơi rồi ạ',
                    'Tôi đã hoàn thành công việc',
                    'Cho tôi xin thêm chi tiết nhé'
                ];
            } else if (isEmployerPage) {
                templates = [
                    'Bạn đi đến đâu rồi?',
                    'Vui lòng gọi khi đến cổng nhé',
                    'Lưu ý mang theo CCCD',
                    'Đã nhận việc, hẹn gặp bạn',
                    'Công việc ổn chứ bạn?'
                ];
            }

            templates.forEach(text => {
                const chip = document.createElement('div');
                chip.className = 'chat-quick-chip';
                chip.innerText = text;
                chip.onclick = () => {
                    chatInput.value = text;
                    chatInput.focus();
                };
                quickTemplates.appendChild(chip);
            });
        }
        
        // Fetch current user ID from /api/v1/messages/me
        fetch('/api/v1/messages/me', { headers: { 'Authorization': 'Bearer ' + token }})
            .then(res => res.json())
            .then(data => {
                if(data && data.data) {
                    myUserId = data.data;
                    localStorage.setItem('myUserId', myUserId);
                }
            })
            .catch(() => {});

        // Load conversations
        function loadConversations() {
            fetch('/api/v1/messages/conversations', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(r => r.json())
            .then(res => {
                if(res.code === 200 && res.data) {
                    renderConversations(res.data);
                }
            });
        }

        function renderConversations(conversations) {
            if(conversations.length === 0) {
                listContainer.innerHTML = '<div class="chat-empty">Bạn chưa có tin nhắn nào.</div>';
                badge.style.display = 'none';
                previousTotalUnread = 0;
                return;
            }
            let totalUnread = 0;
            listContainer.innerHTML = '';
            conversations.forEach(c => {
                totalUnread += c.unreadCount;
                if (c.applicationId && c.counterpartyId) {
                    conversationsMap[c.applicationId] = c.counterpartyId;
                }
                if (c.applicationId && c.counterpartyRole) {
                    conversationsRoleMap[c.applicationId] = c.counterpartyRole;
                }
                if (c.applicationId && c.jobTitle) {
                    conversationsJobMap[c.applicationId] = c.jobTitle;
                }
                const li = document.createElement('li');
                li.className = 'chat-item';
                const timeStr = c.lastMessageTime ? new Date(c.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
                
                let roleBadgeHtml = '';
                if (c.counterpartyRole === 'EMPLOYER') {
                    roleBadgeHtml = '<span class="chat-role-badge badge-employer">Nhà tuyển dụng</span>';
                } else if (c.counterpartyRole === 'WORKER') {
                    roleBadgeHtml = '<span class="chat-role-badge badge-worker">Ứng viên</span>';
                }

                const cpAvatar = (typeof resolveAvatarUrl === 'function')
                    ? resolveAvatarUrl(c.counterpartyAvatar, c.counterpartyName)
                    : (c.counterpartyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.counterpartyName)}&background=18181b&color=ff6600&size=128&bold=true`);

                li.innerHTML = `
                    <img src="${cpAvatar}" class="chat-item-avatar" onerror="if(typeof handleAvatarError === 'function') handleAvatarError(this, '${escapeHtml(c.counterpartyName)}');">
                    <div class="chat-item-info">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                            <p class="chat-item-name">${escapeHtml(c.counterpartyName)}</p>
                            ${roleBadgeHtml}
                        </div>
                        <p class="chat-item-job">${escapeHtml(c.jobTitle)}</p>
                        <p class="chat-item-msg">${escapeHtml(c.lastMessage || '...')}</p>
                    </div>
                    <div class="chat-item-meta">
                        <span>${timeStr}</span>
                        ${c.unreadCount > 0 ? '<span class="chat-item-unread">' + c.unreadCount + '</span>' : ''}
                    </div>
                `;
                li.onclick = () => openChat(c);
                listContainer.appendChild(li);
            });

            if (previousTotalUnread !== -1 && totalUnread > previousTotalUnread) {
                playNotificationTone();
            }
            previousTotalUnread = totalUnread;

            if(totalUnread > 0) {
                badge.innerText = totalUnread > 99 ? '99+' : totalUnread;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        function updateHeaderRoleBadge(role) {
            const roleEl = document.getElementById('chat-header-role');
            if (!roleEl) return;
            if (role === 'EMPLOYER') {
                roleEl.className = 'chat-role-badge badge-employer';
                roleEl.innerText = 'Nhà tuyển dụng';
                roleEl.style.display = 'inline-flex';
            } else if (role === 'WORKER') {
                roleEl.className = 'chat-role-badge badge-worker';
                roleEl.innerText = 'Ứng viên';
                roleEl.style.display = 'inline-flex';
            } else {
                roleEl.style.display = 'none';
            }
        }

        window.openChatByAppId = function(appId, counterpartyName, jobTitle, counterpartyAvatar, counterpartyId, counterpartyRole) {
            dropdown.classList.remove('show');
            currentApplicationId = appId;
            currentCounterpartyId = counterpartyId || conversationsMap[appId] || null;
            currentCounterpartyRole = counterpartyRole || conversationsRoleMap[appId] || null;

            if (!currentCounterpartyRole) {
                if (window.location.pathname.includes('checkapplication')) {
                    currentCounterpartyRole = 'WORKER';
                } else if (window.location.pathname.includes('manageapplication')) {
                    currentCounterpartyRole = 'EMPLOYER';
                }
            }
            if (currentCounterpartyRole) {
                conversationsRoleMap[appId] = currentCounterpartyRole;
                currentMyRole = (currentCounterpartyRole === 'EMPLOYER') ? 'WORKER' : 'EMPLOYER';
            }

            if (jobTitle) {
                conversationsJobMap[appId] = jobTitle;
            }
            const activeJobTitle = jobTitle || conversationsJobMap[appId] || '';

            document.getElementById('chat-header-name').innerText = counterpartyName;
            const headerJobEl = document.getElementById('chat-header-job');
            if (headerJobEl) {
                if (activeJobTitle) {
                    headerJobEl.innerText = activeJobTitle;
                    headerJobEl.title = activeJobTitle;
                    headerJobEl.style.display = 'block';
                } else {
                    headerJobEl.innerText = '';
                    headerJobEl.style.display = 'none';
                }
            }
            const headerAvatarUrl = (typeof resolveAvatarUrl === 'function')
                ? resolveAvatarUrl(counterpartyAvatar, counterpartyName)
                : (counterpartyAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(counterpartyName)}&background=18181b&color=ff6600&size=128&bold=true`);
            const headerAvatarEl = document.getElementById('chat-header-avatar');
            if (headerAvatarEl) {
                headerAvatarEl.src = headerAvatarUrl;
                headerAvatarEl.onerror = function() {
                    if (typeof handleAvatarError === 'function') handleAvatarError(this, counterpartyName);
                };
            }
            updateHeaderRoleBadge(currentCounterpartyRole);
            
            modal.classList.add('show');
            messagesContainer.innerHTML = '<div class="chat-empty">Đang tải tin nhắn...</div>';
            renderQuickTemplates();
            lastRenderedDate = null;
            
            // Mark as read
            fetch('/api/v1/messages?applicationId=' + currentApplicationId, {
                method: 'PATCH',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            // Fetch history
            fetch('/api/v1/messages?applicationId=' + currentApplicationId, {
                headers: { 'Authorization': 'Bearer ' + token }
            })
            .then(r => r.json())
            .then(res => {
                if(res.code === 200) {
                    if (res.data && res.data.length > 0) {
                        for (const m of res.data) {
                            if (m.senderId && myUserId && m.senderId !== myUserId && m.senderRole) {
                                currentCounterpartyRole = m.senderRole;
                                conversationsRoleMap[currentApplicationId] = currentCounterpartyRole;
                                currentMyRole = (currentCounterpartyRole === 'EMPLOYER') ? 'WORKER' : 'EMPLOYER';
                                updateHeaderRoleBadge(currentCounterpartyRole);
                                break;
                            } else if (m.senderId && myUserId && m.senderId === myUserId && m.senderRole) {
                                currentMyRole = m.senderRole;
                                currentCounterpartyRole = (currentMyRole === 'EMPLOYER') ? 'WORKER' : 'EMPLOYER';
                                conversationsRoleMap[currentApplicationId] = currentCounterpartyRole;
                                updateHeaderRoleBadge(currentCounterpartyRole);
                            }
                        }
                    }
                    renderMessages(res.data);
                    connectStomp();
                }
            });
        };

        function openChat(conversation) {
            window.openChatByAppId(conversation.applicationId, conversation.counterpartyName, conversation.jobTitle, conversation.counterpartyAvatar, conversation.counterpartyId, conversation.counterpartyRole);
        }

        function renderMessages(messages) {
            if(messages.length === 0) {
                messagesContainer.innerHTML = '<div class="chat-empty">Hãy gửi tin nhắn đầu tiên!</div>';
                return;
            }
            messagesContainer.innerHTML = '';
            lastRenderedDate = null;
            messages.forEach(msg => appendMessage(msg, true));
            scrollToBottom();
        }

        function extractDriveFileId(url) {
            if (!url) return null;
            const match = url.match(/\/d\/([a-zA-Z0-9_-]{25,})/) || url.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
            return match ? match[1] : null;
        }

        function escapeHtml(text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.innerText = text;
            return div.innerHTML;
        }

        function compressImage(file, maxDimension = 1600, quality = 0.82) {
            return new Promise((resolve) => {
                if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') {
                    resolve(file);
                    return;
                }
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target.result;
                    img.onload = () => {
                        let width = img.width;
                        let height = img.height;
                        if (file.size < 400 * 1024 && width <= maxDimension && height <= maxDimension) {
                            resolve(file);
                            return;
                        }
                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (blob && blob.size < file.size) {
                                const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve(newFile);
                            } else {
                                resolve(file);
                            }
                        }, 'image/jpeg', quality);
                    };
                    img.onerror = () => resolve(file);
                };
                reader.onerror = () => resolve(file);
            });
        }

        function renderAttachmentPreviews() {
            if (!attachPreview || !previewMediaList) return;
            if (selectedFiles.length === 0) {
                attachPreview.style.display = 'none';
                previewMediaList.innerHTML = '';
                return;
            }
            attachPreview.style.display = 'flex';
            previewMediaList.innerHTML = '';

            selectedFiles.forEach((file, index) => {
                const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
                const item = document.createElement('div');
                item.className = 'preview-media-item';

                if (isVideo) {
                    item.innerHTML = `
                        <div class="preview-video-thumb" title="${escapeHtml(file.name)}">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        </div>
                        <button type="button" class="item-remove-btn" title="Xóa">&times;</button>
                    `;
                } else {
                    const imgUrl = URL.createObjectURL(file);
                    item.innerHTML = `
                        <img src="${imgUrl}" title="${escapeHtml(file.name)}" alt="preview">
                        <button type="button" class="item-remove-btn" title="Xóa">&times;</button>
                    `;
                }

                item.querySelector('.item-remove-btn').onclick = (e) => {
                    e.stopPropagation();
                    selectedFiles.splice(index, 1);
                    renderAttachmentPreviews();
                };
                previewMediaList.appendChild(item);
            });
        }

        function clearSelectedFiles() {
            selectedFiles = [];
            if (chatFileInput) chatFileInput.value = '';
            renderAttachmentPreviews();
        }

        if (chatAttachBtn && chatFileInput) {
            chatAttachBtn.onclick = () => chatFileInput.click();
            chatFileInput.onchange = () => {
                const files = Array.from(chatFileInput.files || []);
                if (files.length === 0) return;
                
                for (const file of files) {
                    if (file.size > 50 * 1024 * 1024) {
                        alert('Tệp "' + file.name + '" quá lớn (>50MB). Vui lòng chọn tệp nhỏ hơn!');
                        continue;
                    }
                    if (selectedFiles.length >= 10) {
                        alert('Bạn chỉ có thể gửi tối đa 10 tệp cùng một lúc.');
                        break;
                    }
                    selectedFiles.push(file);
                }
                chatFileInput.value = '';
                renderAttachmentPreviews();
            };
        }
        if (previewClearBtn) {
            previewClearBtn.onclick = clearSelectedFiles;
        }

        window.showChatMediaLightbox = function(url, type) {
            if (!mediaLightbox || !lightboxContent) return;
            lightboxContent.innerHTML = '';
            if (type === 'IMAGE') {
                const img = document.createElement('img');
                img.src = url;
                lightboxContent.appendChild(img);
            } else if (type === 'VIDEO') {
                const iframe = document.createElement('iframe');
                iframe.src = url;
                iframe.allow = 'autoplay; encrypted-media; fullscreen';
                iframe.allowFullscreen = true;
                lightboxContent.appendChild(iframe);
            }
            mediaLightbox.classList.add('show');
        };

        if (lightboxClose) {
            lightboxClose.onclick = () => {
                mediaLightbox.classList.remove('show');
                if (lightboxContent) lightboxContent.innerHTML = '';
            };
        }
        if (mediaLightbox) {
            mediaLightbox.onclick = (e) => {
                if (e.target === mediaLightbox) {
                    mediaLightbox.classList.remove('show');
                    if (lightboxContent) lightboxContent.innerHTML = '';
                }
            };
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mediaLightbox && mediaLightbox.classList.contains('show')) {
                mediaLightbox.classList.remove('show');
                if (lightboxContent) lightboxContent.innerHTML = '';
            }
        });

        function appendMessage(msg, checkDivider = true) {
            const empty = messagesContainer.querySelector('.chat-empty');
            if(empty) empty.remove();

            if (checkDivider) {
                const msgDate = msg.sentAt ? new Date(msg.sentAt).toDateString() : new Date().toDateString();
                if (msgDate !== lastRenderedDate) {
                    lastRenderedDate = msgDate;
                    const divider = document.createElement('div');
                    divider.className = 'chat-date-divider';
                    divider.innerHTML = `<span>${formatDateDivider(msg.sentAt || new Date())}</span>`;
                    messagesContainer.appendChild(divider);
                }
            }

            const isMine = (myUserId && msg.senderId === myUserId) || (currentCounterpartyId && msg.senderId !== currentCounterpartyId);
            if (isMine && !myUserId && msg.senderId) {
                myUserId = msg.senderId;
                localStorage.setItem('myUserId', myUserId);
            }

            if (isMine) {
                const optMsg = messagesContainer.querySelector('.chat-msg-optimistic');
                if (optMsg) {
                    optMsg.remove();
                }
            }

            const div = document.createElement('div');
            div.className = 'chat-msg ' + (isMine ? 'chat-msg-mine' : 'chat-msg-theirs');
            const timeStr = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const statusTick = isMine 
                ? (msg.isRead ? '<span class="chat-msg-status" title="Đã xem" style="color:#93c5fd; font-weight:700;">✓✓</span>' : '<span class="chat-msg-status" title="Đã gửi" style="color:rgba(255,255,255,0.7);">✓</span>')
                : '';

            let bodyHtml = '';
            const isImage = msg.messageType === 'IMAGE' || (msg.mediaUrl && !msg.messageType && !msg.mediaUrl.includes('/preview'));
            const isVideo = msg.messageType === 'VIDEO' || (msg.mediaUrl && msg.mediaUrl.includes('/preview'));

            if (isImage && msg.mediaUrl) {
                const fileId = extractDriveFileId(msg.mediaUrl);
                const streamUrl = fileId ? `/api/v1/messages/media/${fileId}` : msg.mediaUrl;
                const fallbackUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : '';
                const captionText = (msg.content && msg.content !== '[Hình ảnh]') ? msg.content : '';
                bodyHtml = `
                    <div>
                        <img src="${streamUrl}" class="chat-msg-media-img" loading="lazy" alt="Hình ảnh" 
                             onerror="if(!this.dataset.fallback && '${fallbackUrl}'){ this.dataset.fallback=1; this.src='${fallbackUrl}'; }"
                             onclick="window.showChatMediaLightbox('${streamUrl}', 'IMAGE')">
                        ${captionText ? `<div class="chat-msg-caption">${escapeHtml(captionText)}</div>` : ''}
                    </div>
                `;
            } else if (isVideo && msg.mediaUrl) {
                const captionText = (msg.content && msg.content !== '[Video]') ? msg.content : '';
                bodyHtml = `
                    <div>
                        <div class="chat-msg-video-card" onclick="window.showChatMediaLightbox('${msg.mediaUrl}', 'VIDEO')">
                            <div class="chat-msg-video-icon">▶</div>
                            <div>
                                <p class="chat-msg-video-title">Video đính kèm</p>
                                <p class="chat-msg-video-sub">Bấm để phát video</p>
                            </div>
                        </div>
                        ${captionText ? `<div class="chat-msg-caption">${escapeHtml(captionText)}</div>` : ''}
                    </div>
                `;
            } else {
                bodyHtml = `<div>${escapeHtml(msg.content || '')}</div>`;
            }

            // Determine role for message
            let senderRole = msg.senderRole;
            if (!senderRole) {
                if (isMine) {
                    senderRole = currentMyRole || ((currentCounterpartyRole === 'EMPLOYER') ? 'WORKER' : (currentCounterpartyRole === 'WORKER' ? 'EMPLOYER' : null));
                } else {
                    senderRole = currentCounterpartyRole;
                }
            }

            let roleBadgeMarkup = '';
            if (senderRole === 'EMPLOYER') {
                roleBadgeMarkup = '<span class="chat-role-badge badge-employer">Nhà tuyển dụng</span>';
            } else if (senderRole === 'WORKER') {
                roleBadgeMarkup = '<span class="chat-role-badge badge-worker">Ứng viên</span>';
            }

            let senderHeaderHtml = '';
            if (isMine) {
                senderHeaderHtml = `
                    <div class="chat-msg-header chat-msg-header-mine">
                        <span class="chat-msg-sender-name">Bạn</span>
                        ${roleBadgeMarkup}
                    </div>
                `;
            } else {
                const headerDisplayName = msg.senderName || (document.getElementById('chat-header-name') ? document.getElementById('chat-header-name').innerText : '') || 'Người dùng';
                senderHeaderHtml = `
                    <div class="chat-msg-header">
                        ${roleBadgeMarkup}
                        <span class="chat-msg-sender-name">${escapeHtml(headerDisplayName)}</span>
                    </div>
                `;
            }

            div.innerHTML = `
                ${senderHeaderHtml}
                ${bodyHtml}
                <div class="chat-msg-time">${timeStr} ${statusTick}</div>
            `;
            messagesContainer.appendChild(div);
            scrollToBottom();
        }

        function scrollToBottom() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // STOMP WebSockets
        function connectStomp() {
            if(stompClient && stompClient.connected) {
                subscribeChat();
                return;
            }
            ensureDependencies(() => {
                const socket = new SockJS('/ws');
                stompClient = Stomp.over(socket);
                stompClient.debug = null;
                stompClient.connect({'Authorization': 'Bearer ' + token}, function(frame) {
                    subscribeChat();
                });
            });
        }

        let currentSubscription = null;
        function subscribeChat() {
            if(currentSubscription) currentSubscription.unsubscribe();
            if(!currentApplicationId) return;
            currentSubscription = stompClient.subscribe('/topic/chat/' + currentApplicationId, function(messageOutput) {
                const msg = JSON.parse(messageOutput.body);
                // Mark read immediately if we are viewing
                if(msg.senderId !== myUserId) {
                    playNotificationTone();
                    fetch('/api/v1/messages?applicationId=' + currentApplicationId, {
                        method: 'PATCH',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                }
                appendMessage(msg, true);
            });
        }

        chatForm.onsubmit = async (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (!currentApplicationId) return;
            if (!text && selectedFiles.length === 0) return;

            const sendBtn = document.getElementById('chat-send-btn');
            chatInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;

            if (selectedFiles.length > 0) {
                const filesToUpload = [...selectedFiles];
                const nowTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

                // 0ms Optimistic UI: Render images instantly in chat for the sender!
                const empty = messagesContainer.querySelector('.chat-empty');
                if (empty) empty.remove();

                filesToUpload.forEach((f, i) => {
                    const isVideo = f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
                    const localBlobUrl = URL.createObjectURL(f);
                    const div = document.createElement('div');
                    div.className = 'chat-msg chat-msg-mine chat-msg-optimistic';
                    
                    let inner = '';
                    if (isVideo) {
                        inner = `
                            <div class="chat-msg-video-card" onclick="window.showChatMediaLightbox('${localBlobUrl}', 'VIDEO')">
                                <div class="chat-msg-video-icon">▶</div>
                                <div>
                                    <p class="chat-msg-video-title">Video đính kèm</p>
                                    <p class="chat-msg-video-sub">${escapeHtml(f.name)}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        inner = `<img src="${localBlobUrl}" class="chat-msg-media-img" onclick="window.showChatMediaLightbox('${localBlobUrl}', 'IMAGE')" />`;
                    }
                    if (i === 0 && text) {
                        inner += `<div class="chat-msg-caption">${escapeHtml(text)}</div>`;
                    }
                    let myRoleMarkup = '';
                    const myRole = currentMyRole || ((currentCounterpartyRole === 'EMPLOYER') ? 'WORKER' : (currentCounterpartyRole === 'WORKER' ? 'EMPLOYER' : null));
                    if (myRole === 'EMPLOYER') {
                        myRoleMarkup = '<span class="chat-role-badge badge-employer">Nhà tuyển dụng</span>';
                    } else if (myRole === 'WORKER') {
                        myRoleMarkup = '<span class="chat-role-badge badge-worker">Ứng viên</span>';
                    }
                    const myHeader = `
                        <div class="chat-msg-header chat-msg-header-mine">
                            <span class="chat-msg-sender-name">Bạn</span>
                            ${myRoleMarkup}
                        </div>
                    `;
                    div.innerHTML = `
                        ${myHeader}
                        <div>${inner}</div>
                        <div class="chat-msg-time">${nowTime} <span class="chat-msg-status" style="color:rgba(255,255,255,0.75);">Đang gửi...</span></div>
                    `;
                    messagesContainer.appendChild(div);
                });
                scrollToBottom();

                clearSelectedFiles();
                chatInput.value = '';
                chatInput.placeholder = 'Đang tải lên (' + filesToUpload.length + ' tệp)...';

                try {
                    // Fast client-side image compression in parallel
                    const compressedFiles = await Promise.all(
                        filesToUpload.map(f => compressImage(f))
                    );

                    const formData = new FormData();
                    formData.append('applicationId', currentApplicationId);
                    compressedFiles.forEach(f => formData.append('files', f));
                    if (text) {
                        formData.append('content', text);
                    }

                    const res = await fetch('/api/v1/messages/attachment', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + token
                        },
                        body: formData
                    }).then(r => r.json());

                    chatInput.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    chatInput.placeholder = 'Nhập tin nhắn...';
                    chatInput.focus();

                    if (res.data && res.data.length > 0 && res.data[0].senderId) {
                        myUserId = res.data[0].senderId;
                        localStorage.setItem('myUserId', myUserId);
                    }
                    if (res.code !== 200 && res.message) {
                        alert(res.message);
                    }
                } catch (err) {
                    chatInput.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    chatInput.placeholder = 'Nhập tin nhắn...';
                    alert('Lỗi tải tệp lên, vui lòng thử lại!');
                }
            } else {
                fetch('/api/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({ applicationId: currentApplicationId, content: text })
                })
                .then(r => r.json())
                .then(res => {
                    chatInput.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    chatInput.value = '';
                    chatInput.focus();
                    if (res.data && res.data.senderId) {
                        myUserId = res.data.senderId;
                        localStorage.setItem('myUserId', myUserId);
                    }
                })
                .catch(() => { 
                    chatInput.disabled = false; 
                    if (sendBtn) sendBtn.disabled = false; 
                });
            }
        };

        // UI Interactions
        document.getElementById('chat-dropdown-close').onclick = () => dropdown.classList.remove('show');
        document.getElementById('chat-modal-close').onclick = () => {
            modal.classList.remove('show');
            currentApplicationId = null;
            clearSelectedFiles();
            if(currentSubscription) { currentSubscription.unsubscribe(); currentSubscription = null; }
            loadConversations(); // Reload unread counts
        };

        // Floating Button Drag & Drop Logic
        let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
        
        chatBtn.onpointerdown = (e) => {
            isDragging = false;
            startX = e.clientX; startY = e.clientY;
            const rect = chatBtn.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            chatBtn.setPointerCapture(e.pointerId);
            chatBtn.classList.remove('snapping');
        };

        chatBtn.onpointermove = (e) => {
            if (!chatBtn.hasPointerCapture(e.pointerId)) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
            if (isDragging) {
                chatBtn.style.left = (initialLeft + dx) + 'px';
                chatBtn.style.top = (initialTop + dy) + 'px';
                chatBtn.style.right = 'auto'; chatBtn.style.bottom = 'auto';
            }
        };

        chatBtn.onpointerup = (e) => {
            chatBtn.releasePointerCapture(e.pointerId);
            if (!isDragging) {
                // Click
                const rect = chatBtn.getBoundingClientRect();
                dropdown.style.top = (rect.top > window.innerHeight / 2 ? rect.top - 460 : rect.bottom + 10) + 'px';
                dropdown.style.left = (rect.left > window.innerWidth / 2 ? rect.right - 340 : rect.left) + 'px';
                
                // Keep inside screen
                if(parseInt(dropdown.style.top) < 0) dropdown.style.top = '10px';
                
                dropdown.classList.toggle('show');
                if(dropdown.classList.contains('show')) loadConversations();
            } else {
                // Snap to edge
                chatBtn.classList.add('snapping');
                const rect = chatBtn.getBoundingClientRect();
                const snapX = rect.left + rect.width/2 > window.innerWidth/2 ? window.innerWidth - rect.width - 20 : 20;
                let snapY = Math.max(20, Math.min(rect.top, window.innerHeight - rect.height - 20));
                chatBtn.style.left = snapX + 'px';
                chatBtn.style.top = snapY + 'px';
            }
            isDragging = false;
        };

        // Load initially
        loadConversations();
        // Periodically refresh list
        setInterval(loadConversations, 15000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatUI);
    } else {
        initChatUI();
    }
})();
