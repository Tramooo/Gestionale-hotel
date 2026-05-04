(function initMailFeature(global) {
    let deps = null;
    let currentFilter = 'all';
    let currentSearch = '';
    let openDetailId = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayMail not initialized');
        return deps;
    }

    function safeHtml(value) {
        const { escapeHtml } = requireDeps();
        return escapeHtml(String(value ?? ''));
    }

    function safeAttr(value) {
        return safeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function messageStatus(message) {
        if (message?.pmsStatus) return message.pmsStatus;
        return message?.reservationId ? 'assigned' : 'unassigned';
    }

    function reservationName(reservationId) {
        if (!reservationId) return '';
        const { getReservations } = requireDeps();
        const reservation = getReservations().find((entry) => entry.id === reservationId);
        return reservation ? reservation.groupName : '';
    }

    function statusLabel(status) {
        const { t } = requireDeps();
        return t(`mail.status.${status || 'unassigned'}`);
    }

    function filteredMessages() {
        const { getMailMessages } = requireDeps();
        const search = currentSearch.trim().toLowerCase();

        return getMailMessages().filter((message) => {
            const status = messageStatus(message);
            if (currentFilter !== 'all' && status !== currentFilter) return false;
            if (!search) return true;

            return [
                message.fromName,
                message.fromEmail,
                message.subject,
                message.previewText,
                reservationName(message.reservationId)
            ].some((value) => String(value || '').toLowerCase().includes(search));
        });
    }

    function renderLastSync(account) {
        const { formatDateDisplay, t } = requireDeps();
        const lastSync = document.getElementById('mailLastSync');
        if (!lastSync) return;
        lastSync.textContent = account?.lastSyncAt
            ? `${t('mail.lastSync')} ${formatDateDisplay(account.lastSyncAt)}`
            : t('mail.neverSynced');
    }

    function renderMailPage() {
        const { formatDateDisplay, getMailAccount, t } = requireDeps();
        const account = getMailAccount();
        const list = document.getElementById('mailList');
        if (!list) return;

        renderLastSync(account);

        if (!account?.configured) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>${t('mail.configurePrompt')}</p>
                    <button class="btn btn-primary" type="button" onclick="openModal('settingsModal')">${t('mail.openSettings')}</button>
                </div>
            `;
            return;
        }

        const messages = filteredMessages();
        if (messages.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>${t('mail.empty')}</p></div>`;
            return;
        }

        list.innerHTML = messages.map((message) => {
            const linkedName = reservationName(message.reservationId);
            const sender = message.fromName || message.fromEmail || t('mail.unknownSender');
            const status = messageStatus(message);

            return `
                <button class="mail-row" type="button" onclick="openMailDetail('${safeHtml(message.id)}')">
                    <span class="mail-row-main">
                        <span class="mail-row-title">${safeHtml(message.subject || '')}</span>
                        <span class="mail-row-meta">${safeHtml(sender)} &middot; ${safeHtml(formatDateDisplay(message.sentAt))}</span>
                        <span class="mail-row-preview">${safeHtml(message.previewText || '')}</span>
                    </span>
                    <span class="mail-row-side">
                        <span class="mail-status mail-status-${safeHtml(status)}">${safeHtml(statusLabel(status))}</span>
                        ${linkedName ? `<span class="mail-linked-res">${safeHtml(linkedName)}</span>` : ''}
                    </span>
                </button>
            `;
        }).join('');
    }

    function renderLinkedReservationMail(reservationId) {
        const { formatDateDisplay, getMailMessages, t } = requireDeps();
        const messages = getMailMessages().filter((message) => message.reservationId === reservationId);

        if (messages.length === 0) {
            return `<div class="files-empty">${safeHtml(t('mail.noLinkedMail'))}</div>`;
        }

        return messages.map((message) => {
            const sender = message.fromName || message.fromEmail || t('mail.unknownSender');
            const status = messageStatus(message);

            return `
                <button class="mail-linked-row" type="button" onclick="openMailDetail('${safeAttr(message.id)}')">
                    <span>
                        <strong>${safeHtml(message.subject || '')}</strong>
                        <small>${safeHtml(sender)} &middot; ${safeHtml(formatDateDisplay(message.sentAt))}</small>
                    </span>
                    <span class="mail-status mail-status-${safeAttr(status)}">${safeHtml(statusLabel(status))}</span>
                </button>
            `;
        }).join('');
    }

    async function loadMailMessages() {
        const { API, apiGet, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiGet(`${API.reservations}?action=mailList`);
            setMailMessages(response.messages || []);
            renderMailPage();
        } catch (error) {
            showToast(error.message || t('mail.loadFail'), 'error');
        }
    }

    async function syncMail() {
        const { API, apiPost, getMailAccount, setMailAccount, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.reservations}?action=syncMail`, {});
            setMailMessages(response.messages || []);

            const account = getMailAccount();
            if (account?.configured) {
                setMailAccount({ ...account, lastSyncAt: new Date().toISOString() });
            }

            showToast(t('mail.syncDone'), 'success');
            if (Number(response.failedCount) > 0) {
                showToast(`${t('mail.syncFailedCount')} ${response.failedCount}`, 'warning');
            }
            await loadMailMessages();
        } catch (error) {
            showToast(error.message || t('mail.syncFail'), 'error');
        }
    }

    function renderReservationOptions(selectedId) {
        const { getReservations, t } = requireDeps();
        const groupReservations = getReservations().filter((reservation) => (reservation.resType || 'group') === 'group');
        return [
            `<option value="">${safeHtml(t('mail.noReservation'))}</option>`,
            ...groupReservations.map((reservation) => `
                <option value="${safeHtml(reservation.id)}" ${reservation.id === selectedId ? 'selected' : ''}>
                    ${safeHtml(reservation.groupName)}
                </option>
            `)
        ].join('');
    }

    function openMailDetail(id) {
        const { formatDateDisplay, getMailMessages, openModal, t } = requireDeps();
        const message = getMailMessages().find((entry) => entry.id === id);
        if (!message) return;

        openDetailId = id;

        const title = document.getElementById('mailDetailTitle');
        const body = document.getElementById('mailDetailBody');
        if (!title || !body) return;

        title.textContent = message.subject || t('mail.detailTitle');
        body.innerHTML = `
            <div class="mail-detail-meta">
                <div><strong>${safeHtml(t('mail.from'))}</strong> ${safeHtml(message.fromName || message.fromEmail || '')}</div>
                <div><strong>${safeHtml(t('mail.to'))}</strong> ${safeHtml(message.toText || '')}</div>
                <div><strong>${safeHtml(t('mail.date'))}</strong> ${safeHtml(formatDateDisplay(message.sentAt))}</div>
                ${message.hasAttachments ? `<div><strong>${safeHtml(t('mail.attachments'))}</strong> ${safeHtml(t('mail.attachmentsPresent'))}</div>` : ''}
            </div>
            <div class="mail-detail-actions">
                <select id="mailReservationSelect">${renderReservationOptions(message.reservationId || '')}</select>
                <button class="btn btn-primary btn-sm" type="button" onclick="assignMailToReservation('${safeHtml(message.id)}')">${safeHtml(t('mail.assign'))}</button>
                <button class="btn btn-secondary btn-sm" type="button" onclick="markMailHandled('${safeHtml(message.id)}')">${safeHtml(t('mail.markHandled'))}</button>
                <button class="btn btn-secondary btn-sm" type="button" onclick="archiveMail('${safeHtml(message.id)}')">${safeHtml(t('mail.archive'))}</button>
            </div>
            <div class="mail-detail-body-text">${safeHtml(message.bodyText || message.previewText || '')}</div>
        `;
        openModal('mailDetailModal');
    }

    async function updateMailMessage(id, payload) {
        const { API, apiPost, getMailMessages, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.reservations}?action=updateMailMessage`, { id, ...payload });
            const updated = response.message;
            if (!updated?.id) throw new Error(t('mail.updateFail'));

            const messages = getMailMessages();
            const nextMessages = messages.some((message) => message.id === updated.id)
                ? messages.map((message) => message.id === updated.id ? updated : message)
                : [updated, ...messages];
            setMailMessages(nextMessages);
            renderMailPage();
            if (openDetailId === updated.id) openMailDetail(updated.id);
            showToast(t('mail.updated'), 'success');
        } catch (error) {
            showToast(error.message || t('mail.updateFail'), 'error');
        }
    }

    function selectedReservationId() {
        return document.getElementById('mailReservationSelect')?.value || '';
    }

    function assignMailToReservation(id) {
        return updateMailMessage(id, { reservationId: selectedReservationId() });
    }

    function markMailHandled(id) {
        return updateMailMessage(id, { reservationId: selectedReservationId(), pmsStatus: 'handled' });
    }

    function archiveMail(id) {
        return updateMailMessage(id, { reservationId: selectedReservationId(), pmsStatus: 'archived' });
    }

    function setMailFilter(filter) {
        currentFilter = filter || 'all';
        document.querySelectorAll('#page-mail .chip').forEach((chip) => {
            const chipFilter = chip.dataset.mailFilter || chip.dataset.filter || '';
            chip.classList.toggle('active', chipFilter === currentFilter);
        });
        renderMailPage();
    }

    function filterMail() {
        currentSearch = document.getElementById('mailSearchInput')?.value || '';
        renderMailPage();
    }

    function inputValue(id) {
        return document.getElementById(id)?.value || '';
    }

    async function saveMailSettings() {
        const { API, apiPost, setMailAccount, showToast, t } = requireDeps();
        const payload = {
            email: inputValue('mailSettingEmail'),
            username: inputValue('mailSettingUsername'),
            password: inputValue('mailSettingPassword'),
            host: inputValue('mailSettingHost'),
            port: inputValue('mailSettingPort'),
            secure: document.getElementById('mailSettingSecure')?.checked !== false
        };

        try {
            const response = await apiPost(`${API.auth}?action=saveMailSettings`, payload);
            setMailAccount(response.mailAccount || { configured: false });

            const password = document.getElementById('mailSettingPassword');
            if (password) password.value = '';

            syncMailSettingsInputs(response.mailAccount);
            showToast(t('mail.settingsSaved'), 'success');
            renderMailPage();
        } catch (error) {
            showToast(error.message || t('mail.settingsSaveFail'), 'error');
        }
    }

    async function testMailConnection() {
        const { API, apiPost, setMailAccount, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.auth}?action=testMailConnection`, {});
            setMailAccount(response.mailAccount || { configured: false });
            syncMailSettingsInputs(response.mailAccount);
            showToast(t('mail.connectionOk'), 'success');
        } catch (error) {
            showToast(error.message || t('mail.connectionFail'), 'error');
        }
    }

    function syncMailSettingsInputs(account) {
        if (!account?.configured) return;

        const fields = {
            mailSettingEmail: account.email || '',
            mailSettingUsername: account.username || '',
            mailSettingHost: account.host || 'imaps.aruba.it',
            mailSettingPort: account.port || 993
        };

        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.value = value;
        });

        const secure = document.getElementById('mailSettingSecure');
        if (secure) secure.checked = account.secure !== false;
    }

    global.GroupStayMail = {
        init(nextDeps) {
            deps = nextDeps;
        },
        archiveMail,
        assignMailToReservation,
        filterMail,
        loadMailMessages,
        markMailHandled,
        openMailDetail,
        renderLinkedReservationMail,
        renderMailPage,
        saveMailSettings,
        setMailFilter,
        syncMail,
        syncMailSettingsInputs,
        testMailConnection
    };
})(window);
