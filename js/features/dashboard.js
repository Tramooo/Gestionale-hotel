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

    function renderTrendChart(days, totalRooms, t) {
        const trendEl = document.getElementById('occupancy-trend-chart');
        if (!trendEl) return;

        const hasData = totalRooms > 0 && days.some((day) => day.rooms > 0 || day.guests > 0);
        if (!days.length || !hasData) {
            trendEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noTrendData')}</p></div>`;
            return;
        }

        trendEl.innerHTML = days.map((day) => {
            const height = totalRooms > 0 ? Math.max(8, Math.round((day.rooms / totalRooms) * 100)) : 8;
            return `
                <div class="trend-day">
                    <div class="trend-bar-stack">
                        <div class="trend-bar-track">
                            <div class="trend-bar-fill" style="height:${height}%"></div>
                        </div>
                    </div>
                    <div class="trend-day-meta">
                        <strong>${day.rooms}</strong>
                        <span>${day.guests} ${t('dash.guests')}</span>
                    </div>
                    <div class="trend-day-label">${day.label}</div>
                </div>
            `;
        }).join('');
    }

    function renderReservationMix(statusData, totalReservations, t) {
        const mixEl = document.getElementById('reservation-mix');
        if (!mixEl) return;

        if (totalReservations === 0) {
            mixEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noReservationMix')}</p></div>`;
            return;
        }

        mixEl.innerHTML = statusData.map((item) => {
            const width = totalReservations > 0 ? Math.round((item.count / totalReservations) * 100) : 0;
            return `
                <div class="status-row">
                    <div class="status-row-head">
                        <div class="status-row-title">
                            <span class="status-dot ${item.status}"></span>
                            <span class="status-label">${item.label}</span>
                        </div>
                        <span class="status-count">${item.count} &middot; ${t('dash.percentOfTotal', { percent: width })}</span>
                    </div>
                    <div class="status-track">
                        <div class="status-fill ${item.status}" style="width:${width}%"></div>
                    </div>
                </div>
            `;
        }).join('');
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
            nightsBetween,
            openReservationDetail,
            t
        } = requireDeps();

        computeRoomStatuses();

        const reservations = getReservations();
        const rooms = getRooms();
        const liveReservations = reservations.filter((reservation) => reservation.status !== 'cancelled');
        const todayStr = formatDate(new Date());
        const inHouseReservations = liveReservations.filter((reservation) => reservation.checkin <= todayStr && reservation.checkout > todayStr);
        const todayGuests = inHouseReservations.reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
        const occupiedRooms = rooms.filter((room) => room.status === 'occupied').length;
        const todayCheckins = liveReservations.filter((reservation) => reservation.checkin === todayStr);
        const todayCheckouts = liveReservations.filter((reservation) => reservation.checkout === todayStr);

        setText('stat-arrivals-departures', `${todayCheckins.length} / ${todayCheckouts.length}`);
        setText('stat-arrivals-departures-meta', t('dash.arrivalsDeparturesMeta', {
            arrivals: todayCheckins.length,
            departures: todayCheckouts.length
        }));
        setText('stat-total-guests', todayGuests);
        setText('stat-rooms-occupied', `${occupiedRooms}/${rooms.length}`);
        setText('stat-rooms-occupied-meta', t('dash.roomsAvailableMeta', {
            available: rooms.filter((room) => room.status === 'available').length
        }));

        const totalRooms = rooms.length;
        const available = rooms.filter((room) => room.status === 'available').length;
        const maintenance = rooms.filter((room) => room.status === 'maintenance').length;
        const occupied = rooms.filter((room) => room.status === 'occupied').length;
        const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
        const circumference = 2 * Math.PI * 52;
        const offset = circumference - (percent / 100) * circumference;

        const occupancyCircle = document.getElementById('occupancy-circle');
        if (occupancyCircle) occupancyCircle.setAttribute('stroke-dashoffset', offset);
        setText('occupancy-percent', percent + '%');
        setText('legend-occupied', occupied);
        setText('legend-available', available);
        setText('legend-maintenance', maintenance);

        const upcoming = liveReservations
            .filter((reservation) => (reservation.status === 'confirmed' || reservation.status === 'pending') && reservation.checkin >= todayStr)
            .sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
            .slice(0, 5);

        const checkinEl = document.getElementById('upcoming-checkins');
        if (upcoming.length === 0) {
            checkinEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noUpcoming')}</p></div>`;
        } else {
            checkinEl.innerHTML = upcoming.map((reservation) => `
                <div class="checkin-item" onclick="openReservationDetail('${reservation.id}')">
                    <div class="checkin-dot" style="background: ${reservation.status === 'confirmed' ? 'var(--green)' : 'var(--orange)'}"></div>
                    <div class="checkin-info">
                        <div class="checkin-name">${escapeHtml(reservation.groupName)}</div>
                        <div class="checkin-detail">${reservation.guestCount} ${t('dash.guests')} &middot; ${reservation.roomCount} ${t('res.rooms')}</div>
                    </div>
                    <div class="checkin-date">${formatDateDisplay(reservation.checkin)}</div>
                </div>
            `).join('');
        }

        const activityEl = document.getElementById('today-activity');
        const activities = [];

        todayCheckins.forEach((reservation) => {
            activities.push(`
                <div class="activity-item">
                    <div class="activity-icon checkin">&#8593;</div>
                    <div>
                        <div class="activity-text"><strong>${escapeHtml(reservation.groupName)}</strong> ${t('dash.checkingIn')}</div>
                        <div class="activity-time">${reservation.guestCount} ${t('dash.guests')}</div>
                    </div>
                </div>
            `);
        });

        todayCheckouts.forEach((reservation) => {
            activities.push(`
                <div class="activity-item">
                    <div class="activity-icon checkout">&#8595;</div>
                    <div>
                        <div class="activity-text"><strong>${escapeHtml(reservation.groupName)}</strong> ${t('dash.checkingOut')}</div>
                        <div class="activity-time">${reservation.guestCount} ${t('dash.guests')}</div>
                    </div>
                </div>
            `);
        });

        if (activities.length === 0) {
            activityEl.innerHTML = `<div class="empty-state small"><p>${t('dash.noActivity')}</p></div>`;
        } else {
            activityEl.innerHTML = activities.join('');
        }

        bindAgendaControls(todayStr);
        if (!selectedAgendaDate) selectedAgendaDate = todayStr;
        syncAgendaDateInput();
        renderAgendaList();

        const lang = getCurrentLang ? getCurrentLang() : 'it';
        const locale = lang === 'en' ? 'en-GB' : 'it-IT';
        const next7Days = Array.from({ length: 7 }, (_, index) => {
            const date = addDays(parseDate(todayStr), index);
            const dayStr = formatDate(date);
            const dayReservations = liveReservations.filter((reservation) => reservation.checkin <= dayStr && reservation.checkout > dayStr);
            const roomsBooked = dayReservations.reduce((sum, reservation) => sum + (reservation.roomCount || 0), 0);
            const guestsBooked = dayReservations.reduce((sum, reservation) => sum + (reservation.guestCount || 0), 0);
            const dayMovements = liveReservations.filter((reservation) => reservation.checkin === dayStr || reservation.checkout === dayStr).length;

            return {
                date,
                label: date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' }),
                dayStr,
                guests: guestsBooked,
                movements: dayMovements,
                rooms: roomsBooked
            };
        });

        renderTrendChart(next7Days, totalRooms, t);

        const peakDay = next7Days.reduce((best, entry) => {
            if (!best) return entry;
            if (entry.rooms > best.rooms) return entry;
            if (entry.rooms === best.rooms && entry.movements > best.movements) return entry;
            return best;
        }, null);

        const peakOccupancy = peakDay && totalRooms > 0 ? Math.round((peakDay.rooms / totalRooms) * 100) : 0;
        const peakGuests = next7Days.reduce((max, entry) => Math.max(max, entry.guests), 0);
        setText('stat-peak-occupancy', `${peakOccupancy}%`);
        setText('stat-peak-guests', peakGuests);
        setText('stat-busiest-day', peakDay ? peakDay.label : '-');

        const statusOrder = ['checked-in', 'confirmed', 'pending', 'cancelled'];
        const statusData = statusOrder.map((status) => ({
            count: reservations.filter((reservation) => reservation.status === status).length,
            label: getStatusLabel(status, t),
            status
        }));
        renderReservationMix(statusData, reservations.length, t);

        const avgStay = liveReservations.length > 0
            ? (liveReservations.reduce((sum, reservation) => sum + nightsBetween(reservation.checkin, reservation.checkout), 0) / liveReservations.length)
            : 0;
        const arrivalsNextWeek = liveReservations.filter((reservation) => reservation.checkin >= todayStr && reservation.checkin <= next7Days[next7Days.length - 1].dayStr).length;
        const departuresNextWeek = liveReservations.filter((reservation) => reservation.checkout >= todayStr && reservation.checkout <= next7Days[next7Days.length - 1].dayStr).length;

        setText('stat-average-stay', t('dash.nightsShort', { count: avgStay > 0 ? avgStay.toFixed(1) : '0' }));
        setText('stat-arrivals-next-week', arrivalsNextWeek);
        setText('stat-departures-next-week', departuresNextWeek);
    }

    global.GroupStayDashboard = {
        init(nextDeps) {
            deps = nextDeps;
        },
        renderDashboard
    };
})(window);
