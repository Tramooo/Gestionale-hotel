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

    function renderAgendaList() {
        const { escapeHtml, formatDateDisplay, getCurrentLang, t } = requireDeps();
        const listEl = document.getElementById('dashboard-task-list');
        if (!listEl) return;

        const selectedDate = getSelectedAgendaDate();
        const locale = getCurrentLang && getCurrentLang() === 'en' ? 'en-GB' : 'it-IT';
        const heading = parseDate(selectedDate).toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

        const items = sortAgendaItems(loadAgendaItems()).filter((item) => item.date === selectedDate);

        if (!items.length) {
            listEl.innerHTML = `
                <div class="empty-state small">
                    <p>${escapeHtml(t('dash.noTasksForDate', { date: heading }))}</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = `
            <div class="todo-list-header">${escapeHtml(formatDateDisplay(selectedDate))}</div>
            ${items.map((item) => `
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
                            <span>${escapeHtml(heading)}</span>
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
            `).join('')}
        `;
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
                        <div class="dashboard-movement-meta">${escapeHtml(detailParts.join(' · '))}</div>
                    </div>
                    <div class="dashboard-movement-side">
                        <span class="dashboard-pill ${reservation.status}">${escapeHtml(getStatusLabel(reservation.status, t))}</span>
                        <span class="dashboard-movement-date">${escapeHtml(extraLabel || formatDateDisplay(reservation.checkin))}</span>
                    </div>
                </button>
            `;
        }).join('');
    }

    function renderPriorityList(items, options) {
        const { escapeHtml } = options;
        const listEl = document.getElementById('dashboard-priority-list');
        if (!listEl) return;

        if (!items.length) {
            listEl.innerHTML = `
                <div class="empty-state small">
                    <p>${escapeHtml(options.emptyMessage)}</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = items.map((item) => `
            <article class="dashboard-priority-item ${item.tone}">
                <div class="dashboard-priority-head">
                    <span class="dashboard-priority-badge">${escapeHtml(item.badge)}</span>
                    <strong>${escapeHtml(item.value)}</strong>
                </div>
                <div class="dashboard-priority-title">${escapeHtml(item.title)}</div>
                <p class="dashboard-priority-text">${escapeHtml(item.text)}</p>
            </article>
        `).join('');
    }

    function renderRoomWatchList(floorSummaries, options) {
        const { escapeHtml, lang, t } = options;
        const listEl = document.getElementById('dashboard-room-watch-list');
        if (!listEl) return;

        if (!floorSummaries.length) {
            listEl.innerHTML = `<div class="empty-state small"><p>${escapeHtml(copy(lang, 'Nessuna camera configurata', 'No rooms configured'))}</p></div>`;
            return;
        }

        listEl.innerHTML = floorSummaries.map((floor) => `
            <div class="dashboard-room-status-item">
                <div class="dashboard-room-status-head">
                    <strong>${escapeHtml(`${t('rooms.floor')} ${floor.floor}`)}</strong>
                    <span>${escapeHtml(copy(lang, `${floor.available} libere`, `${floor.available} free`))}</span>
                </div>
                <div class="dashboard-room-status-meta">
                    <span>${escapeHtml(copy(lang, `${floor.occupied} occupate`, `${floor.occupied} occupied`))}</span>
                    <span>${escapeHtml(copy(lang, `${floor.maintenance} manutenzione`, `${floor.maintenance} maintenance`))}</span>
                    <span>${escapeHtml(copy(lang, `${floor.total} totali`, `${floor.total} total`))}</span>
                </div>
            </div>
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
                    <strong>${escapeHtml(day.label)}</strong>
                    <span>${escapeHtml(copy(lang, `${day.occupiedRooms}/${totalRooms} camere`, `${day.occupiedRooms}/${totalRooms} rooms`))}</span>
                </div>
                <div class="dashboard-forecast-metrics">
                    <span>${escapeHtml(copy(lang, `${day.occupancy}% occupazione`, `${day.occupancy}% occupancy`))}</span>
                    <span>${escapeHtml(copy(lang, `${day.arrivals} arrivi`, `${day.arrivals} arrivals`))}</span>
                    <span>${escapeHtml(copy(lang, `${day.departures} partenze`, `${day.departures} departures`))}</span>
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
            .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (b.guestCount || 0) - (a.guestCount || 0)), {
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
            .sort((a, b) => (b.roomCount || 0) - (a.roomCount || 0) || (b.guestCount || 0) - (a.guestCount || 0)), {
            emptyMessage: copy(lang, 'Nessuna partenza prevista per oggi', 'No departures planned for today'),
            escapeHtml,
            formatDateDisplay,
            lang,
            roomsById,
            sideLabel: () => copy(lang, 'Check-out', 'Check-out'),
            t
        });

        const expiringToday = liveReservations.filter((reservation) => reservation.status === 'pending' && reservation.expiration === todayStr);
        const arrivalsWithoutRoom = todayCheckins.filter((reservation) => (reservation.roomIds || []).length < (reservation.roomCount || 0));
        const roomPressure = next7Days.reduce((best, day) => {
            if (!best || day.occupancy > best.occupancy) return day;
            return best;
        }, null);

        const priorities = [
            {
                tone: expiringToday.length ? 'urgent' : 'calm',
                badge: copy(lang, 'Opzioni', 'Options'),
                title: copy(lang, 'Prenotazioni in scadenza oggi', 'Reservations expiring today'),
                text: expiringToday.length
                    ? copy(lang, `${expiringToday.length} pratiche pending richiedono una decisione`, `${expiringToday.length} pending bookings need a decision`)
                    : copy(lang, 'Nessuna scadenza urgente nelle opzioni di oggi', 'No urgent option expirations today'),
                value: String(expiringToday.length)
            },
            {
                tone: arrivalsWithoutRoom.length ? 'warning' : 'calm',
                badge: copy(lang, 'Assegnazioni', 'Assignments'),
                title: copy(lang, 'Arrivi senza camera completa', 'Arrivals missing room assignment'),
                text: arrivalsWithoutRoom.length
                    ? copy(lang, `${arrivalsWithoutRoom.length} arrivi di oggi non hanno ancora tutte le camere assegnate`, `${arrivalsWithoutRoom.length} arrivals today still need room assignment`)
                    : copy(lang, 'Tutti gli arrivi di oggi risultano assegnati', 'All today arrivals are assigned'),
                value: String(arrivalsWithoutRoom.length)
            },
            {
                tone: maintenance ? 'warning' : 'calm',
                badge: copy(lang, 'Camere', 'Rooms'),
                title: copy(lang, 'Camere fuori servizio', 'Rooms out of service'),
                text: maintenance
                    ? copy(lang, `${maintenance} camere in manutenzione riducono la disponibilita operativa`, `${maintenance} maintenance rooms are reducing available inventory`)
                    : copy(lang, 'Nessuna camera risulta bloccata per manutenzione', 'No rooms are blocked for maintenance'),
                value: String(maintenance)
            },
            {
                tone: roomPressure && roomPressure.occupancy >= 85 ? 'urgent' : 'calm',
                badge: copy(lang, 'Carico', 'Load'),
                title: copy(lang, 'Giorno piu intenso nei prossimi 7 giorni', 'Busiest day in the next 7 days'),
                text: roomPressure
                    ? copy(lang, `${roomPressure.label} raggiunge ${roomPressure.occupancy}% di occupazione`, `${roomPressure.label} reaches ${roomPressure.occupancy}% occupancy`)
                    : copy(lang, 'Nessun picco rilevato', 'No peak detected'),
                value: roomPressure ? `${roomPressure.occupancy}%` : '0%'
            }
        ];
        renderPriorityList(priorities, {
            emptyMessage: copy(lang, 'Nessuna priorita aperta', 'No open priorities'),
            escapeHtml
        });

        const floors = rooms.reduce((map, room) => {
            const key = String(room.floor ?? '-');
            if (!map.has(key)) {
                map.set(key, { floor: key, total: 0, occupied: 0, available: 0, maintenance: 0 });
            }
            const entry = map.get(key);
            entry.total += 1;
            if (room.status === 'occupied') entry.occupied += 1;
            else if (room.status === 'maintenance') entry.maintenance += 1;
            else entry.available += 1;
            return map;
        }, new Map());

        renderRoomWatchList(
            [...floors.values()].sort((a, b) => Number(a.floor) - Number(b.floor)),
            { escapeHtml, lang, t }
        );

        renderForecastList(next7Days, { escapeHtml, lang, totalRooms });
    }

    global.GroupStayDashboard = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderDashboard
    };
})(window);
