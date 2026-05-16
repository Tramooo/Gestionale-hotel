(function initMailUI(global) {
    var deps = null;
    var currentMailId = null;
    var assignMailId = null;
    var readIds = new Set();

    var AVATAR_COLORS = ['#4e6040','#3a5c60','#604050','#4a4030','#384c6a','#5a4838','#3c5c50','#584060'];

    function avatarColor(name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
        return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
    }

    function initials(name) {
        var parts = (name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function escH(v) {
        return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escA(v) {
        return escH(v).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function messageStatus(message) {
        if (message?.pmsStatus) return message.pmsStatus;
        return message?.reservationId ? 'assigned' : 'unassigned';
    }

    function reservationName(reservationId) {
        if (!reservationId || !deps) return '';
        var res = deps.getReservations().find(function (r) { return r.id === reservationId; });
        return res ? (res.groupName || '') : '';
    }

    function statusChipHtml(status) {
        var labels = { unassigned: 'Non assegnata', assigned: 'Assegnata', handled: 'Gestita', archived: 'Archiviata' };
        var label = labels[status] || status;
        return '<span class="mail-status-chip status-' + escH(status) + '"><span class="mail-status-dot"></span>' + escH(label) + '</span>';
    }

    function openReader(id) {
        if (!deps) return;
        var messages = deps.getMailMessages();
        var message = messages.find(function (m) { return m.id === id; });
        if (!message) return;

        readIds.add(id);
        currentMailId = id;

        // Highlight active row and clear unread state
        document.querySelectorAll('#mailList .mail-row').forEach(function (row) {
            row.classList.toggle('active', row.dataset.id === id);
            if (row.dataset.id === id) row.classList.remove('unread');
        });

        var emptyEl = document.getElementById('mail-reader-empty');
        var contentEl = document.getElementById('mail-reader-content');
        if (emptyEl) emptyEl.hidden = true;
        if (!contentEl) return;
        contentEl.hidden = false;

        var status = messageStatus(message);
        var linked = reservationName(message.reservationId);

        contentEl.innerHTML =
            '<div class="mail-reader-topbar">' +
                '<div class="mail-reader-topbar-left">' +
                    '<h2 class="mail-reader-subject">' + escH(message.subject || '(nessun oggetto)') + '</h2>' +
                    '<div class="mail-reader-meta">' +
                        '<span>Da: ' + escH(message.fromName || message.fromEmail || '') + '</span>' +
                        (message.fromEmail && message.fromName ? '<span class="mail-reader-meta-sep">·</span><span>' + escH(message.fromEmail) + '</span>' : '') +
                        '<span class="mail-reader-meta-sep">·</span>' +
                        '<span>A: ' + escH(message.toText || '') + '</span>' +
                        (message.hasAttachments ? '<span class="mail-reader-meta-sep">·</span><span>📎 allegato</span>' : '') +
                    '</div>' +
                    '<div class="mail-reader-status-row">' +
                        statusChipHtml(status) +
                        (linked ? '<span class="mail-reader-res-link">' + escH(linked) + '</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div class="mail-reader-actions">' +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="MailUI.openAssignModal()">Collega</button>' +
                    '<button class="btn btn-secondary btn-sm" type="button" onclick="MailUI.doGestita()">Gestita</button>' +
                    '<button class="btn btn-ghost btn-sm" type="button" onclick="MailUI.doArchivia()">Archivia</button>' +
                '</div>' +
            '</div>' +
            '<div class="mail-reader-body">' + escH(message.bodyText || message.previewText || '') + '</div>' +
            '<div class="mail-reader-reply">' +
                '<button class="mail-reply-toggle" type="button" onclick="MailUI.toggleReply()">↩ Rispondi</button>' +
                '<div class="mail-reply-area" id="mail-reply-area">' +
                    '<textarea class="mail-reply-textarea" id="mail-reply-text" placeholder="Scrivi la tua risposta..."></textarea>' +
                    '<button class="mail-reply-send" type="button" onclick="MailUI.sendReply()">Invia</button>' +
                '</div>' +
            '</div>';

        var body = contentEl.querySelector('.mail-reader-body');
        if (body) body.scrollTop = 0;
    }

    function refreshReader(id) {
        if (currentMailId === id) openReader(id);
    }

    function openAssignModal() {
        if (!currentMailId || !deps) return;
        var messages = deps.getMailMessages();
        var message = messages.find(function (m) { return m.id === currentMailId; });
        var reservations = deps.getReservations().filter(function (r) { return (r.resType || 'group') === 'group'; });

        assignMailId = currentMailId;

        var overlay = document.getElementById('mail-assign-overlay');
        var searchEl = document.getElementById('mail-assign-search');
        if (!overlay) return;

        if (searchEl) searchEl.value = '';
        renderAssignList(reservations, message ? message.reservationId : null, '');
        overlay.hidden = false;
    }

    function renderAssignList(reservations, currentResId, query) {
        var listEl = document.getElementById('mail-assign-list');
        if (!listEl) return;

        var filtered = query
            ? reservations.filter(function (r) { return (r.groupName || '').toLowerCase().includes(query.toLowerCase()); })
            : reservations;

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="mail-assign-empty">Nessun gruppo trovato</p>';
            return;
        }

        var html = '<button class="mail-assign-item' + (!currentResId ? ' selected' : '') + '" type="button" onclick="MailUI.doAssign(\'\')">' +
            '<span class="mail-assign-item-name" style="color:var(--text-muted,#7a7870)">Nessuna prenotazione</span>' +
            '</button>';

        filtered.forEach(function (res) {
            var color = avatarColor(res.groupName || '');
            var init = initials(res.groupName || '');
            var isSelected = res.id === currentResId;
            html += '<button class="mail-assign-item' + (isSelected ? ' selected' : '') + '" type="button" onclick="MailUI.doAssign(\'' + escA(res.id) + '\')">' +
                '<span class="mail-assign-item-avatar" style="background:' + color + '">' + escH(init) + '</span>' +
                '<span>' +
                    '<div class="mail-assign-item-name">' + escH(res.groupName || '') + '</div>' +
                    '<div class="mail-assign-item-dates">' + escH(res.checkIn || '') + ' → ' + escH(res.checkOut || '') + '</div>' +
                '</span>' +
                '</button>';
        });

        listEl.innerHTML = html;
    }

    function filterAssignModal() {
        if (!deps) return;
        var query = document.getElementById('mail-assign-search')?.value || '';
        var reservations = deps.getReservations().filter(function (r) { return (r.resType || 'group') === 'group'; });
        var messages = deps.getMailMessages();
        var message = messages.find(function (m) { return m.id === assignMailId; });
        renderAssignList(reservations, message ? message.reservationId : null, query);
    }

    function closeAssignModal() {
        var overlay = document.getElementById('mail-assign-overlay');
        if (overlay) overlay.hidden = true;
        assignMailId = null;
    }

    function doAssign(resId) {
        closeAssignModal();
        if (!currentMailId) return;
        window.GroupStayMail?.updateMailMessage?.(currentMailId, { reservationId: resId || '' });
    }

    function doGestita() {
        if (!currentMailId || !deps) return;
        var message = deps.getMailMessages().find(function (m) { return m.id === currentMailId; });
        window.GroupStayMail?.updateMailMessage?.(currentMailId, { reservationId: message?.reservationId || '', pmsStatus: 'handled' });
    }

    function doArchivia() {
        if (!currentMailId || !deps) return;
        var message = deps.getMailMessages().find(function (m) { return m.id === currentMailId; });
        window.GroupStayMail?.updateMailMessage?.(currentMailId, { reservationId: message?.reservationId || '', pmsStatus: 'archived' });
    }

    function toggleReply() {
        var area = document.getElementById('mail-reply-area');
        if (!area) return;
        area.classList.toggle('open');
        if (area.classList.contains('open')) {
            document.getElementById('mail-reply-text')?.focus();
        }
    }

    function sendReply() {
        var textEl = document.getElementById('mail-reply-text');
        var text = textEl?.value.trim();
        if (!text) return;
        // Placeholder — actual send needs API endpoint
        window.showToast?.('Risposta inviata', 'success');
        var area = document.getElementById('mail-reply-area');
        if (area) area.classList.remove('open');
        if (textEl) textEl.value = '';
    }

    function isUnread(id) {
        return !readIds.has(id);
    }

    // Close overlay when clicking the backdrop
    document.addEventListener('click', function (e) {
        var overlay = document.getElementById('mail-assign-overlay');
        if (overlay && !overlay.hidden && e.target === overlay) closeAssignModal();
    });

    global.MailUI = {
        init: function (nextDeps) { deps = nextDeps; },
        openReader: openReader,
        refreshReader: refreshReader,
        openAssignModal: openAssignModal,
        closeAssignModal: closeAssignModal,
        filterAssignModal: filterAssignModal,
        doAssign: doAssign,
        doGestita: doGestita,
        doArchivia: doArchivia,
        toggleReply: toggleReply,
        sendReply: sendReply,
        isUnread: isUnread
    };
})(window);
