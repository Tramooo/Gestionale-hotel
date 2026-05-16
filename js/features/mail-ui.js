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
                '<div class="mail-reply-actions">' +
                    '<button class="mail-reply-toggle" type="button" onclick="MailUI.toggleReply(\'reply\')">↩ Rispondi</button>' +
                    '<button class="mail-reply-toggle" type="button" onclick="MailUI.openForward()">↪ Inoltra</button>' +
                '</div>' +
                '<div class="mail-reply-area" id="mail-reply-area">' +
                    '<div class="mail-reply-to-row">' +
                        '<span class="mail-compose-label">A</span>' +
                        '<input type="email" id="mail-reply-to" class="mail-compose-input" placeholder="destinatario@email.com">' +
                    '</div>' +
                    '<textarea class="mail-reply-textarea" id="mail-reply-text" placeholder="Scrivi la tua risposta..."></textarea>' +
                    '<div class="mail-reply-footer">' +
                        '<button class="btn btn-ghost btn-sm" type="button" onclick="MailUI.toggleReply(null)">Annulla</button>' +
                        '<button class="mail-reply-send" type="button" onclick="MailUI.sendReply()">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                            ' Invia' +
                        '</button>' +
                    '</div>' +
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

    function toggleReply(mode) {
        var area = document.getElementById('mail-reply-area');
        if (!area) return;
        if (mode === null) {
            area.classList.remove('open');
            return;
        }
        var isOpen = area.classList.contains('open');
        area.classList.toggle('open');
        if (!isOpen) {
            var toEl = document.getElementById('mail-reply-to');
            var textEl = document.getElementById('mail-reply-text');
            if (mode === 'reply' && currentMailId && deps) {
                var msg = deps.getMailMessages().find(function (m) { return m.id === currentMailId; });
                if (msg && toEl) toEl.value = msg.fromEmail || '';
            }
            (toEl?.value ? document.getElementById('mail-reply-text') : toEl)?.focus();
        }
    }

    async function sendReply() {
        if (!currentMailId || !deps) return;
        var msg = deps.getMailMessages().find(function (m) { return m.id === currentMailId; });
        var toEl = document.getElementById('mail-reply-to');
        var textEl = document.getElementById('mail-reply-text');
        var to = toEl?.value.trim();
        var text = textEl?.value.trim();
        if (!to || !text) { window.showToast?.('Compila destinatario e testo', 'error'); return; }

        var btn = document.querySelector('#mail-reply-area .mail-reply-send');
        if (btn) { btn.disabled = true; btn.textContent = 'Invio...'; }

        try {
            var payload = {
                to: to,
                subject: 'Re: ' + (msg?.subject || ''),
                body: text,
                inReplyTo: msg?.messageId || '',
                references: msg?.messageId || '',
            };
            var r = await fetch('/api/reservations?action=sendMail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error(e.error || 'Errore invio'); }
            window.showToast?.('Risposta inviata', 'success');
            var area = document.getElementById('mail-reply-area');
            if (area) area.classList.remove('open');
            if (textEl) textEl.value = '';
            if (toEl) toEl.value = '';
        } catch (err) {
            window.showToast?.(err.message || 'Errore invio', 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Invia'; }
        }
    }

    function openCompose(opts) {
        var overlay = document.getElementById('mail-compose-overlay');
        if (!overlay) return;
        var title = document.getElementById('mail-compose-title');
        var toEl = document.getElementById('mail-compose-to');
        var subjectEl = document.getElementById('mail-compose-subject');
        var bodyEl = document.getElementById('mail-compose-body');
        var sendBtn = document.getElementById('mail-compose-send-btn');
        if (opts) {
            if (title) title.textContent = opts.title || 'Nuovo messaggio';
            if (toEl) toEl.value = opts.to || '';
            if (subjectEl) subjectEl.value = opts.subject || '';
            if (bodyEl) bodyEl.value = opts.body || '';
        } else {
            if (title) title.textContent = 'Nuovo messaggio';
            if (toEl) toEl.value = '';
            if (subjectEl) subjectEl.value = '';
            if (bodyEl) bodyEl.value = '';
        }
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Invia'; }
        overlay.hidden = false;
        setTimeout(function () { (toEl?.value ? subjectEl || toEl : toEl)?.focus(); }, 50);
    }

    function closeCompose() {
        var overlay = document.getElementById('mail-compose-overlay');
        if (overlay) overlay.hidden = true;
    }

    function openForward() {
        if (!currentMailId || !deps) return;
        var msg = deps.getMailMessages().find(function (m) { return m.id === currentMailId; });
        if (!msg) return;
        var quoted = '\n\n-------- Messaggio originale --------\n' +
            'Da: ' + (msg.fromName || msg.fromEmail || '') + '\n' +
            'Oggetto: ' + (msg.subject || '') + '\n\n' +
            (msg.bodyText || msg.previewText || '');
        openCompose({ title: 'Inoltra messaggio', subject: 'Fwd: ' + (msg.subject || ''), body: quoted, to: '' });
    }

    async function sendComposed() {
        var toEl = document.getElementById('mail-compose-to');
        var subjectEl = document.getElementById('mail-compose-subject');
        var bodyEl = document.getElementById('mail-compose-body');
        var sendBtn = document.getElementById('mail-compose-send-btn');
        var to = toEl?.value.trim();
        var subject = subjectEl?.value.trim();
        var body = bodyEl?.value.trim();
        if (!to || !subject || !body) { window.showToast?.('Compila tutti i campi', 'error'); return; }

        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Invio...'; }

        try {
            var r = await fetch('/api/reservations?action=sendMail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: to, subject: subject, body: body }),
            });
            if (!r.ok) { var e = await r.json().catch(function () { return {}; }); throw new Error(e.error || 'Errore invio'); }
            window.showToast?.('Messaggio inviato', 'success');
            closeCompose();
        } catch (err) {
            window.showToast?.(err.message || 'Errore invio', 'error');
            if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Invia'; }
        }
    }

    function isUnread(id) {
        return !readIds.has(id);
    }

    document.addEventListener('click', function (e) {
        var assignOverlay = document.getElementById('mail-assign-overlay');
        if (assignOverlay && !assignOverlay.hidden && e.target === assignOverlay) closeAssignModal();
        var composeOverlay = document.getElementById('mail-compose-overlay');
        if (composeOverlay && !composeOverlay.hidden && e.target === composeOverlay) closeCompose();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var composeOverlay = document.getElementById('mail-compose-overlay');
            if (composeOverlay && !composeOverlay.hidden) { closeCompose(); return; }
        }
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
        openCompose: openCompose,
        closeCompose: closeCompose,
        openForward: openForward,
        sendComposed: sendComposed,
        isUnread: isUnread
    };
})(window);
