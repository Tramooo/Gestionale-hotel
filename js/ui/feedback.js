(function initUiFeedback(global) {
    let deps = null;
    let listenersBound = false;
    let pendingDialog = null;

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
        if (id === 'customDialogModal' && pendingDialog) {
            const { resolve, type } = pendingDialog;
            pendingDialog = null;
            resolve(type === 'confirm' ? false : null);
        }
        syncModalState();
    }

    function ensureDialogModal() {
        let modal = document.getElementById('customDialogModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'customDialogModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal modal-sm dialog-modal" role="dialog" aria-modal="true" aria-labelledby="customDialogTitle">
                <div class="modal-body dialog-modal-body">
                    <div id="customDialogIcon" class="dialog-modal-icon" aria-hidden="true">!</div>
                    <div class="dialog-modal-content">
                        <h2 id="customDialogTitle" class="dialog-modal-title">Conferma</h2>
                        <p id="customDialogMessage" class="dialog-modal-message"></p>
                        <label id="customDialogInputWrap" class="dialog-modal-input-wrap" hidden>
                            <input id="customDialogInput" class="input dialog-modal-input" type="text" />
                        </label>
                    </div>
                    <div class="modal-actions dialog-modal-actions">
                        <button id="customDialogCancel" type="button" class="btn btn-ghost">Annulla</button>
                        <button id="customDialogOk" type="button" class="btn btn-primary">Conferma</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal('customDialogModal');
        });
        modal.querySelector('#customDialogCancel').addEventListener('click', () => closeModal('customDialogModal'));
        modal.querySelector('#customDialogOk').addEventListener('click', () => {
            if (!pendingDialog) return;
            const { resolve, type } = pendingDialog;
            const input = modal.querySelector('#customDialogInput');
            pendingDialog = null;
            modal.classList.remove('open');
            syncModalState();
            resolve(type === 'prompt' ? input.value : true);
        });
        modal.querySelector('#customDialogInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('#customDialogOk').click();
            }
        });
        return modal;
    }

    function getDialogText(options = {}) {
        const translate = deps && typeof deps.t === 'function' ? deps.t : null;
        return {
            title: options.title || (translate ? translate('common.confirmation') : 'Conferma'),
            confirmLabel: options.confirmLabel || (translate ? translate('common.confirm') : 'Conferma'),
            cancelLabel: options.cancelLabel || (translate ? translate('common.cancel') : 'Annulla')
        };
    }

    function showConfirmDialog(message, options = {}) {
        const modal = ensureDialogModal();
        const labels = getDialogText(options);
        const titleEl = modal.querySelector('#customDialogTitle');
        const messageEl = modal.querySelector('#customDialogMessage');
        const iconEl = modal.querySelector('#customDialogIcon');
        const inputWrap = modal.querySelector('#customDialogInputWrap');
        const cancelBtn = modal.querySelector('#customDialogCancel');
        const okBtn = modal.querySelector('#customDialogOk');

        if (pendingDialog) {
            pendingDialog.resolve(pendingDialog.type === 'confirm' ? false : null);
            pendingDialog = null;
        }

        modal.querySelector('.dialog-modal').dataset.mode = 'confirm';
        modal.querySelector('.dialog-modal').dataset.intent = options.intent || 'default';
        titleEl.textContent = labels.title;
        messageEl.textContent = message;
        iconEl.textContent = options.icon || '!';
        inputWrap.hidden = true;
        cancelBtn.hidden = false;
        cancelBtn.textContent = labels.cancelLabel;
        okBtn.textContent = labels.confirmLabel;

        modal.classList.add('open');
        syncModalState();
        setTimeout(() => okBtn.focus(), 0);

        return new Promise((resolve) => {
            pendingDialog = { resolve, type: 'confirm' };
        });
    }

    function showPromptDialog(message, options = {}) {
        const modal = ensureDialogModal();
        const labels = getDialogText({
            ...options,
            title: options.title || (deps?.t ? deps.t('common.inputRequired') : 'Inserimento richiesto'),
            confirmLabel: options.confirmLabel || (deps?.t ? deps.t('common.save') : 'Salva')
        });
        const titleEl = modal.querySelector('#customDialogTitle');
        const messageEl = modal.querySelector('#customDialogMessage');
        const iconEl = modal.querySelector('#customDialogIcon');
        const inputWrap = modal.querySelector('#customDialogInputWrap');
        const input = modal.querySelector('#customDialogInput');
        const cancelBtn = modal.querySelector('#customDialogCancel');
        const okBtn = modal.querySelector('#customDialogOk');

        if (pendingDialog) {
            pendingDialog.resolve(pendingDialog.type === 'confirm' ? false : null);
            pendingDialog = null;
        }

        modal.querySelector('.dialog-modal').dataset.mode = 'prompt';
        modal.querySelector('.dialog-modal').dataset.intent = options.intent || 'default';
        titleEl.textContent = labels.title;
        messageEl.textContent = message;
        iconEl.textContent = options.icon || 'i';
        inputWrap.hidden = false;
        input.value = options.defaultValue ?? '';
        input.placeholder = options.placeholder || '';
        input.type = options.inputType || 'text';
        input.inputMode = options.inputMode || '';
        cancelBtn.hidden = false;
        cancelBtn.textContent = labels.cancelLabel;
        okBtn.textContent = labels.confirmLabel;

        modal.classList.add('open');
        syncModalState();
        setTimeout(() => {
            input.focus();
            input.select();
        }, 0);

        return new Promise((resolve) => {
            pendingDialog = { resolve, type: 'prompt' };
        });
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
                    closeModal(overlay.id);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                requireDeps().closeAllDatePickers();
                const openModals = Array.from(document.querySelectorAll('.modal-overlay.open'));
                const topModal = openModals[openModals.length - 1];
                if (topModal?.id) closeModal(topModal.id);
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
        showConfirmDialog,
        showPromptDialog,
        showLoading,
        hideLoading,
        showToast,
        syncModalState
    };
})(window);
