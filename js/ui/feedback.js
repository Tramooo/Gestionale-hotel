(function initUiFeedback(global) {
    let deps = null;
    let listenersBound = false;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayUI not initialized');
        return deps;
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
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
                    document.body.style.overflow = '';
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                requireDeps().closeAllDatePickers();
                document.querySelectorAll('.modal-overlay.open').forEach((modal) => {
                    modal.classList.remove('open');
                    document.body.style.overflow = '';
                });
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
        showToast
    };
})(window);
