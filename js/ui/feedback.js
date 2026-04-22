(function initUiFeedback(global) {
    let deps = null;
    let listenersBound = false;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayUI not initialized');
        return deps;
    }

    function hasOpenFilePreview() {
        const preview = document.getElementById('filePreviewOverlay');
        if (!preview) return false;
        return preview.style.display !== 'none' && !preview.hasAttribute('hidden');
    }

    function applyBodyScrollLock(locked) {
        document.body.classList.toggle('modal-open', locked);
        document.body.style.overflow = locked ? 'hidden' : '';
    }

    function syncModalState() {
        const hasOpenModal = !!document.querySelector('.modal-overlay.open');
        applyBodyScrollLock(hasOpenModal || hasOpenFilePreview());
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('open');
        syncModalState();
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('open');
        syncModalState();
    }

    function showLoading(message = 'Caricamento...') {
        const el = document.getElementById('loadingOverlay');
        if (!el) return;
        document.getElementById('loadingMessage').textContent = message;
        el.style.display = 'flex';
    }

    function hideLoading() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.style.display = 'none';
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function bindGlobalUiEvents() {
        if (listenersBound) return;
        listenersBound = true;

        document.querySelectorAll('.modal-overlay').forEach((overlay) => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('open');
                    syncModalState();
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                requireDeps().closeAllDatePickers();
                document.querySelectorAll('.modal-overlay.open').forEach((modal) => {
                    modal.classList.remove('open');
                });
                syncModalState();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mini-cal-wrapper')) {
                requireDeps().closeAllDatePickers();
            }
        });
    }

    global.GroupStayUI = {
        init(nextDeps) {
            deps = nextDeps;
            bindGlobalUiEvents();
        },
        openModal,
        closeModal,
        showLoading,
        hideLoading,
        showToast,
        syncModalState
    };
})(window);
