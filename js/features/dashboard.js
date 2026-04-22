(function initDashboardFeature(global) {
    let deps = null;
    let selectedAgendaDate = null;
    let agendaControlsBound = false;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayDashboard not initialized');
        return deps;
    }

    function parseDate(dateStr) {
        return new Date(`${dateStr}T00:00:00`);
    }

    function addDays(date, days) {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    function getStatusLabel(status, t) {
        if (status === 'checked-in') return t('dash.checkedIn');
        if (status === 'confirmed') return t('res.confirmed');
        if (status === 'pending') return t('res.pending');
        if (status === 'cancelled') return t('res.cancelled');
        return status;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function createAgendaItemId() {
        return `agenda_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }

    function loadAgendaItems() {
        const { getAgendaItems } = requireDeps();
        const items = getAgendaItems ? getAgendaItems() : [];
        if (!Array.isArray(items)) return [];
        return items.filter((item) => item && item.id && item.date && item.text).map((item) => ({
            done: Boolean(item.done),
            id: item.id,
            text: String(item.text),
            time: item.time ? String(item.time) : '',
            date: String(item.date),
            createdAt: item.createdAt || ''
        }));
    }

    function saveAgendaItems(items) {
        const { setAgendaItems } = requireDeps();
        if (setAgendaItems) setAgendaItems(items);
    }

    function sortAgendaItems(items) {
        return [...items].sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            if (a.done !== b.done) return Number(a.done) - Number(b.done);
            const timeA = a.time || '99:99';
            const timeB = b.time || '99:99';
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return (a.createdAt || '').localeCompare(b.createdAt || '');
        });
    }

    function getSelectedAgendaDate() {
        const { formatDate } = requireDeps();
        return selectedAgendaDate || formatDate(new Date());
    }

    function syncAgendaDateInput() {
        const dateInput = document.getElementById('dashboard-task-date');
        if (dateInput) dateInput.value = getSelectedAgendaDate();
    }

    function focusAgendaDate() {
        const dateInput = document.getElementById('dashboard-task-date');
        if (!dateInput) return;

        dateInput.focus();
        if (typeof dateInput.showPicker === 'function') {
            dateInput.showPicker();
        }
    }

    function getAgendaWindowLabel(dateStr, baseDateStr, locale, t) {
        if (dateStr === baseDateStr) return t('cal.today');

        const tomorrow = requireDeps().formatDate(addDays(parseDate(baseDateStr), 1));
        if (dateStr === tomorrow) return t('dash.tomorrow');

        const inTwoDays = requireDeps().formatDate(addDays(parseDate(baseDateStr), 2));
        if (dateStr === inTwoDays) return t('dash.inTwoDays');

        return parseDate(dateStr).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }

    function renderAgendaList() {
        const { escapeHtml, formatDate, formatDateDisplay, getCurrentLang, t } = requireDeps();
        const listEl = document.getElementById('dashboard-task-list');
        if (!listEl) return;

        const selectedDate = getSelectedAgendaDate();
        const locale = getCurrentLang && getCurrentLang() === 'en' ? 'en-GB' : 'it-IT';
        const agendaWindow = Array.from({ length: 3 }, (_, offset) => formatDate(addDays(parseDate(selectedDate), offset)));
        const items = sortAgendaItems(loadAgendaItems());
        const totalItemsInWindow = items.filter((item) => agendaWindow.includes(item.date)).length;

        if (!totalItemsInWindow) {
            listEl.innerHTML = `
                <div class="empty-state small">
                    <p>${escapeHtml(t('dash.noTasksNextThreeDays'))}</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = agendaWindow.map((dateStr) => {
            const dayItems = items.filter((item) => item.date === dateStr);
            const sectionLabel = getAgendaWindowLabel(dateStr, selectedDate, locale, t);
            const sectionDate = parseDate(dateStr).toLocaleDateString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'long'
            });

            return `
                <section class="agenda-window-day${dayItems.length ? '' : ' is-empty'}">
                    <div class="agenda-window-day-head">
                        <div class="agenda-window-day-label">${escapeHtml(sectionLabel)}</div>
                        <div class="agenda-window-day-date">${escapeHtml(sectionDate)}</div>
                    </div>
                    ${dayItems.length ? dayItems.map((item) => `
                        <div class="todo-item${item.done ? ' is-done' : ''}">
                            <button
                                type="button"
                                class="todo-check"
                                data-task-action="toggle"
                                data-task-id="${item.id}"
                                aria-label="${item.done ? t('dash.markTodoUndone') : t('dash.markTodoDone')}"
                                title="${item.done ? t('dash.markTodoUndone') : t('dash.markTodoDone')}"
                            >${item.done ? '&#10003;' : ''}</button>
                            <div class="todo-content">
                                <div class="todo-text">${escapeHtml(item.text)}</div>
                                <div class="todo-meta">
                                    <span>${escapeHtml(item.time || t('dash.noTime'))}</span>
                                    <span>${escapeHtml(formatDateDisplay(dateStr))}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                class="todo-delete"
                                data-task-action="delete"
                                data-task-id="${item.id}"
                                aria-label="${t('dash.deleteTask')}"
                                title="${t('dash.deleteTask')}"
                            >&times;</button>
                        </div>
                    `).join('') : `
                        <div class="agenda-window-empty">${escapeHtml(t('dash.noTasksForDate', { date: formatDateDisplay(dateStr) }))}</div>
                    `}
                </section>
            `;
        }).join('');
    }

    function setAgendaDate(dateStr) {
        selectedAgendaDate = dateStr;
        syncAgendaDateInput();
        renderAgendaList();
    }

    async function saveAgendaItem(event) {
        event.preventDefault();

        const { API, apiPost, generateId, showToast, t } = requireDeps();
        const textInput = document.getElementById('dashboard-task-text');
        const timeInput = document.getElementById('dashboard-task-time');
        const dateInput = document.getElementById('dashboard-task-date');

        if (!textInput || !timeInput || !dateInput) return;

        const text = textInput.value.trim();
        const date = dateInput.value || getSelectedAgendaDate();
        const time = timeInput.value || '';

        if (!text) {
            showToast(t('dash.todoTextRequired'), 'error');
            textInput.focus();
            return;
        }

        const newItem = {
            createdAt: new Date().toISOString(),
            date,
            done: false,
            id: generateId ? generateId() : createAgendaItemId(),
            text,
            time
        };

        try {
            await apiPost(API.agenda, newItem);
            saveAgendaItems([...loadAgendaItems(), newItem]);
            textInput.value = '';
            timeInput.value = '';
            setAgendaDate(date);
            showToast(t('dash.taskSaved'));
        } catch (error) {
            showToast(t('dash.taskSaveFail'), 'error');
        }
    }

    async function handleAgendaListClick(event) {
        const target = event.target.closest('[data-task-action]');
        if (!target) return;

        const { API, apiDelete, apiPut, showToast, t } = requireDeps();
        const action = target.dataset.taskAction;
        const taskId = target.dataset.taskId;
        const items = loadAgendaItems();
        const taskIndex = items.findIndex((item) => item.id === taskId);

        if (taskIndex === -1) return;

        if (action === 'toggle') {
            const updatedItem = {
                ...items[taskIndex],
                done: !items[taskIndex].done
            };

            try {
                await apiPut(API.agenda, updatedItem);
                items[taskIndex] = updatedItem;
                saveAgendaItems(items);
                renderAgendaList();
                showToast(updatedItem.done ? t('dash.taskCompleted') : t('dash.taskReopened'));
            } catch (error) {
                showToast(t('dash.taskUpdateFail'), 'error');
            }
        }

        if (action === 'delete') {
            try {
                await apiDelete(API.agenda, taskId);
                items.splice(taskIndex, 1);
                saveAgendaItems(items);
                renderAgendaList();
                showToast(t('dash.taskDeleted'));
            } catch (error) {
                showToast(t('dash.taskDeleteFail'), 'error');
            }
        }
    }

    function bindAgendaControls(todayStr) {
        if (agendaControlsBound) return;

        const form = document.getElementById('dashboard-task-form');
        const dateInput = document.getElementById('dashboard-task-date');
        const todayButton = document.getElementById('dashboard-task-today');
        const listEl = document.getElementById('dashboard-task-list');

        if (!form || !dateInput || !todayButton || !listEl) return;

        agendaControlsBound = true;
        selectedAgendaDate = selectedAgendaDate || todayStr;
        syncAgendaDateInput();

        dateInput.addEventListener('change', () => {
            setAgendaDate(dateInput.value || requireDeps().formatDate(new Date()));
        });

        todayButton.addEventListener('click', () => {
            setAgendaDate(requireDeps().formatDate(new Date()));
        });

        form.addEventListener('submit', saveAgendaItem);
        listEl.addEventListener('click', handleAgendaListClick);
    }

    function copy(lang, it, en) {
        return lang === 'en' ? en : it;
    }

    function pluralize(lang, count, itSingular, itPlural, enSingular, enPlural) {
        if (lang === 'en') return `${count} ${count === 1 ? enSingular : enPlural}`;
        return `${count} ${count === 1 ? itSingular : itPlural}`;
    }

    function getRoomAssignmentLabel(reservation, roomsById, lang) {
        const assignedRooms = (reservation.roomIds || [])
            .map((roomId) => roomsById.get(roomId))
            .filter(Boolean)
            .sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));

        if (assignedRooms.length) {
            return copy(
                lang,
                `Camere ${assignedRooms.map((room) => room.number).join(', ')}`,
                `Rooms ${assignedRooms.map((room) => room.number).join(', ')}`
            );
        }

        return copy(
            lang,
            `${reservation.roomCount || 0} da assegnare`,
            `${reservation.roomCount || 0} to assign`
        );
    }

    function renderMovementList(elementId, reservations, options) {
        const {
            emptyMessage,
            escapeHtml,
            formatDateDisplay,
            lang,
            roomsById,
            sideLabel,
            t
        } = options;
        const listEl = document.getElementById(elementId);
        if (!listEl) return;

        if (!reservations.length) {
            listEl.innerHTML = `<div class="empty-state small"><p>${escapeHtml(emptyMessage)}</p></div>`;
            return;
        }

        listEl.innerHTML = reservations.map((reservation) => {
            const guestSummary = pluralize(lang, reservation.guestCount || 0, 'ospite', 'ospiti', 'guest', 'guests');
            const roomSummary = pluralize(lang, reservation.roomCount || 0, 'camera', 'camere', 'room', 'rooms');
            const assignmentSummary = getRoomAssignmentLabel(reservation, roomsById, lang);
            const detailParts = [guestSummary, roomSummary, assignmentSummary];
            const extraLabel = sideLabel ? sideLabel(reservation) : '';

            return `
                <button type="button" class="dashboard-movement-item" onclick="openReservationDetail('${reservation.id}')">
                    <div class="dashboard-movement-main">
                        <div class="dashboard-movement-name">${escapeHtml(reservation.groupName || '-')}</div>
                        <div class="dashboard-movement-details">
                            ${detailParts.map((detail) => `<span class="dashboard-movement-detail">${escapeHtml(detail)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="dashboard-movement-side">
                        <span class="dashboard-pill ${reservation.status}">${escapeHtml(getStatusLabel(reservation.status, t))}</span>
                        <span class="dashboard-movement-date">${escapeHtml(extraLabel || formatDateDisplay(reservation.checkin))}</span>
                        <span class="dashboard-movement-open" aria-hidden="true">></span>
                    </div>
                </button>
            `;
        }).join('');
    }

    function renderMaintenanceList(rooms, options) {
        const { escapeHtml, lang, t } = options;
        const listEl = document.getElementById('dashboard-maintenance-list');
        if (!listEl) return;

        if (!rooms.length) {
            listEl.innerHTML = `<div class="empty-state small"><p>${escapeHtml(copy(lang, 'Nessuna camera in manutenzione', 'No rooms in maintenance'))}</p></div>`;
            return;
        }

        listEl.innerHTML = rooms.map((room) => `
            <button type="button" class="dashboard-room-status-item" onclick="openEditRoom('${room.id}')">
                <div class="dashboard-room-status-head">
                    <span class="dashboard-room-status-number">${escapeHtml(String(room.number || '-'))}</span>
                    <div class="dashboard-room-status-body">
                        <strong>${escapeHtml(room.type || copy(lang, 'Tipologia non definita', 'Type not set'))}</strong>
                        <div class="dashboard-room-status-meta">
                            <span>${escapeHtml(`${t('rooms.floor')} ${room.floor ?? '-'}`)}</span>
                            <span>${escapeHtml(copy(lang, `Capienza ${room.capacity || 0}`, `Capacity ${room.capacity || 0}`))}</span>
                        </div>
                    </div>
                    <span class="dashboard-room-status-state">${escapeHtml(copy(lang, 'Fuori servizio', 'Out of service'))}</span>
                </div>
                ${room.maintenanceNote ? `<div class="dashboard-room-status-note">${escapeHtml(room.maintenanceNote)}</div>` : ''}
            </button>
        `).join('');
    }

    function renderForecastList(days, options) {
        const { escapeHtml, lang, totalRooms } = options;
        const listEl = document.getElementById('dashboard-forecast-list');
        if (!listEl) return;

        if (!days.length) {
            listEl.innerHTML = `<div class="empty-state small"><p>${escapeHtml(copy(lang, 'Nessuna previsione disponibile', 'No forecast available'))}</p></div>`;
            return;
        }

        listEl.innerHTML = days.map((day) => `
            <div class="dashboard-forecast-row">
                <div class="dashboard-forecast-day">
                    <span>${escapeHtml(day.label)}</span>
                    <strong>${escapeHtml(copy(lang, `${day.occupancy}% occupazione`, `${day.occupancy}% occupancy`))}</strong>
                </div>
                <div class="dashboard-forecast-bar" aria-hidden="true">
                    <span style="width: ${Math.max(0, Math.min(day.occupancy, 100))}%"></span>
                </div>
                <div class="dashboard-forecast-summary">
                    <strong>${escapeHtml(copy(lang, `${day.occupiedRooms}/${totalRooms} camere`, `${day.occupiedRooms}/${totalRooms} rooms`))}</strong>
                    <span>${escapeHtml(copy(lang, `${day.arrivals} arrivi - ${day.departures} partenze`, `${day.arrivals} arrivals - ${day.departures} departures`))}</span>
                </div>
            </div>
        `).join('');
    }

    function renderDashboard() {
        const {
            computeRoomStatuses,
            escapeHtml,
            formatDate,
            formatDateDisplay,
            getCurrentLang,
            getReservations,
            getRooms,
            t
        } = requireDeps();

        computeRoomStatuses();

        const reservations = getReservations();
        const rooms = getRooms();
        const liveReservations = reservations.filter((reservation) => reservation.status !== 'cancelled');
        const todayStr = formatDate(new Date());
        const lang = getCurrentLang ? getCurrentLang() : 'it';
        const locale = lang === 'en' ? 'en-GB' : 'it-IT';
        const roomsById = new Map(rooms.map((room) => [room.id, room]));
        const inHouseReservations = liveReservations.filter((reservation) => reservation.checkin <= todayStr && reservation.checkout > todayStr);
        const todayGuests = inHouseReservations.reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
        const todayCheckins = liveReservations.filter((reservation) => reservation.checkin === todayStr);
        const todayCheckouts = liveReservations.filter((reservation) => reservation.checkout === todayStr);

        const totalRooms = rooms.length;
        const available = rooms.filter((room) => room.status === 'available').length;
        const maintenance = rooms.filter((room) => room.status === 'maintenance').length;
        const occupied = rooms.filter((room) => room.status === 'occupied').length;
        const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

        setText('dash-arrivals-value', todayCheckins.length);
        setText('dash-arrivals-meta', todayCheckins.length
            ? copy(lang, `Prime operazioni: ${todayCheckins.slice(0, 2).map((reservation) => reservation.groupName).join(', ')}`, `First arrivals: ${todayCheckins.slice(0, 2).map((reservation) => reservation.groupName).join(', ')}`)
            : copy(lang, 'Nessun arrivo pianificato', 'No arrivals scheduled'));
        setText('dash-departures-value', todayCheckouts.length);
        setText('dash-departures-meta', todayCheckouts.length
            ? copy(lang, `Da liberare ${todayCheckouts.reduce((sum, reservation) => sum + (reservation.roomCount || 0), 0)} camere`, `To free ${todayCheckouts.reduce((sum, reservation) => sum + (reservation.roomCount || 0), 0)} rooms`)
            : copy(lang, 'Nessuna partenza pianificata', 'No departures scheduled'));
        setText('dash-inhouse-value', todayGuests);
        setText('dash-inhouse-meta', inHouseReservations.length
            ? copy(lang, `${inHouseReservations.length} gruppi presenti in struttura`, `${inHouseReservations.length} groups currently in house`)
            : copy(lang, 'Nessuna presenza attiva in struttura', 'No active in-house stays'));
        setText('dash-occupancy-value', `${percent}%`);
        setText('dash-occupancy-meta', copy(lang, `${occupied} occupate su ${totalRooms}`, `${occupied} occupied out of ${totalRooms}`));

        setText('dash-rooms-available', available);
        setText('dash-rooms-occupied', occupied);
        setText('dash-rooms-maintenance', maintenance);
        setText('dash-arrivals-count', todayCheckins.length);
        setText('dash-departures-count', todayCheckouts.length);
        setText('dash-maintenance-count', maintenance);

        bindAgendaControls(todayStr);
        if (!selectedAgendaDate) selectedAgendaDate = todayStr;
        syncAgendaDateInput();
        renderAgendaList();

        const next7Days = Array.from({ length: 7 }, (_, index) => {
            const date = addDays(parseDate(todayStr), index);
            const dayStr = formatDate(date);
            const dayReservations = liveReservations.filter((reservation) => reservation.checkin <= dayStr && reservation.checkout > dayStr);
            const roomsBooked = dayReservations.reduce((sum, reservation) => sum + (reservation.roomCount || 0), 0);
            const arrivals = liveReservations.filter((reservation) => reservation.checkin === dayStr).length;
            const departures = liveReservations.filter((reservation) => reservation.checkout === dayStr).length;
            const occupancy = totalRooms > 0 ? Math.round((roomsBooked / totalRooms) * 100) : 0;

            return {
                label: date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
                occupiedRooms: roomsBooked,
                arrivals,
                departures,
                occupancy
            };
        });

        renderMovementList('dashboard-arrivals-list', todayCheckins
            .slice()
            .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (b.guestCount || 0) - (a.guestCount || 0))
            .slice(0, 4), {
            emptyMessage: copy(lang, 'Nessun arrivo previsto per oggi', 'No arrivals planned for today'),
            escapeHtml,
            formatDateDisplay,
            lang,
            roomsById,
            sideLabel: (reservation) => reservation.status === 'pending' && reservation.expiration
                ? copy(lang, `Scade ${formatDateDisplay(reservation.expiration)}`, `Expires ${formatDateDisplay(reservation.expiration)}`)
                : copy(lang, 'Check-in', 'Check-in'),
            t
        });

        renderMovementList('dashboard-departures-list', todayCheckouts
            .slice()
            .sort((a, b) => (b.roomCount || 0) - (a.roomCount || 0) || (b.guestCount || 0) - (a.guestCount || 0))
            .slice(0, 4), {
            emptyMessage: copy(lang, 'Nessuna partenza prevista per oggi', 'No departures planned for today'),
            escapeHtml,
            formatDateDisplay,
            lang,
            roomsById,
            sideLabel: () => copy(lang, 'Check-out', 'Check-out'),
            t
        });

        renderMaintenanceList(
            rooms
                .filter((room) => room.status === 'maintenance')
                .slice()
                .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true })),
            { escapeHtml, lang, t }
        );

        renderForecastList(next7Days.slice(0, 5), { escapeHtml, lang, totalRooms });
    }

    global.GroupStayDashboard = {
        init(nextDeps) {
            deps = nextDeps;
        },
        focusAgendaDate,
        renderDashboard
    };
})(window);
