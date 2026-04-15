(function initReservationFilesFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayReservationFiles not initialized');
        return deps;
    }

    async function loadReservationFiles(reservationId) {
        const { API, apiGet } = requireDeps();
        try {
            const files = await apiGet(`${API.files}?reservationId=${reservationId}`);
            renderReservationFiles(reservationId, files);
        } catch (err) {
            console.error('Failed to load files:', err);
        }
    }

    function renderReservationFiles(reservationId, files) {
        const { escapeHtml, t } = requireDeps();
        const container = document.getElementById('reservationFilesContainer');
        if (!container) return;

        if (files.length === 0) {
            container.innerHTML = `<div class="files-empty">${t('detail.noFiles')}</div>`;
            return;
        }

        container.innerHTML = files.map((file) => {
            const icon = getFileIcon(file.fileName);
            const size = formatFileSize(file.fileSize);
            return `
                <div class="file-item">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <span class="file-name">${escapeHtml(file.fileName)}</span>
                        <span class="file-meta">${size}</span>
                    </div>
                    <div class="file-actions">
                        <button class="btn btn-ghost btn-sm" onclick="downloadReservationFile('${file.id}')" title="Download">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteReservationFile('${file.id}', '${reservationId}')" title="${t('detail.delete')}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    function getFileIcon(fileName) {
        const ext = (fileName || '').split('.').pop().toLowerCase();
        if (['xls', 'xlsx'].includes(ext)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#217346" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>';
        if (['csv'].includes(ext)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d6efd" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>';
        if (['doc', 'docx'].includes(ext)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b579a" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="10" y2="9"/></svg>';
        if (['pdf'].includes(ext)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d63384" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }

    function formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function uploadReservationFile(reservationId) {
        const { API, apiPost, generateId, showToast, t } = requireDeps();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xls,.xlsx,.csv,.doc,.docx,.pdf,.txt,.jpg,.jpeg,.png';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 3 * 1024 * 1024) {
                showToast(t('toast.fileTooLarge'), 'error');
                return;
            }
            try {
                const base64 = await fileToBase64(file);
                await apiPost(API.files, {
                    id: generateId(),
                    reservationId,
                    fileName: file.name,
                    fileType: file.type,
                    fileSize: file.size,
                    fileData: base64
                });
                showToast(t('toast.fileUploaded'));
                loadReservationFiles(reservationId);
            } catch (err) {
                console.error(err);
                showToast(t('toast.fileUploadFail'), 'error');
            }
        };
        input.click();
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function downloadReservationFile(fileId) {
        const { API, showToast } = requireDeps();
        try {
            const res = await fetch(`${API.files}?id=${fileId}`, { method: 'PUT', credentials: 'include' });
            if (!res.ok) throw new Error('Download failed');
            const data = await res.json();
            const a = document.createElement('a');
            a.href = data.fileData;
            a.download = data.fileName;
            a.click();
        } catch (err) {
            console.error(err);
            showToast('Download failed', 'error');
        }
    }

    async function deleteReservationFile(fileId, reservationId) {
        const { API, apiDelete, showToast, t } = requireDeps();
        if (!confirm(t('rooms.confirmDelete') || 'Delete this file?')) return;
        try {
            await apiDelete(API.files, fileId);
            showToast(t('toast.fileDeleted'));
            loadReservationFiles(reservationId);
        } catch (err) {
            console.error(err);
            showToast(t('toast.fileDeleteFail'), 'error');
        }
    }

    global.GroupStayReservationFiles = {
        init(nextDeps) {
            deps = nextDeps;
        },
        deleteReservationFile,
        downloadReservationFile,
        fileToBase64,
        formatFileSize,
        getFileIcon,
        loadReservationFiles,
        renderReservationFiles,
        uploadReservationFile
    };
})(window);
