// =============================================
// GroupStay — Hotel Group Reservation Manager
// =============================================

// ---- DATA STORE (Neon Postgres via API) ----

const API = {
    reservations: '/api/reservations',
    rooms: '/api/rooms',
    guests: '/api/guests',
    init: '/api/init',
    assignments: '/api/assignments',
    plannerConfig: '/api/planner-config',
    alloggiati: '/api/alloggiati'
};

async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function apiPost(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
    }
    return res.json();
}

async function apiPut(url, data) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function apiDelete(url, id) {
    const res = await fetch(`${url}?id=${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function loadAllData() {
    try {
        [reservations, rooms, guests] = await Promise.all([
            apiGet(API.reservations),
            apiGet(API.rooms),
            apiGet(API.guests)
        ]);
        computeRoomStatuses();
    } catch (err) {
        console.error('Failed to load data from database:', err);
        showToast('Failed to connect to database', 'error');
    }
}

function computeRoomStatuses() {
    const today = formatDate(new Date());
    // Build set of room IDs occupied today by active reservations
    const occupiedIds = new Set();
    reservations.forEach(r => {
        if (r.status !== 'confirmed' && r.status !== 'checked-in') return;
        if (r.checkin > today || r.checkout <= today) return;
        const rIds = r.roomIds && r.roomIds.length > 0
            ? r.roomIds
            : guests.filter(g => g.reservationId === r.id && g.roomId).map(g => g.roomId);
        rIds.forEach(id => occupiedIds.add(id));
    });
    rooms.forEach(rm => {
        if (rm.status === 'maintenance') return; // keep maintenance as-is
        rm.status = occupiedIds.has(rm.id) ? 'occupied' : 'available';
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ---- STATE ----

let reservations = [];
let rooms = [];
let guests = [];
let currentFilter = 'all';
let currentRoomFilter = 'all';
let calendarDate = new Date();
let currentAssignmentReservationId = null;
let assignmentData = []; // current working copy of room assignments

// ---- HELPERS ----

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function nightsBetween(checkin, checkout) {
    const d1 = new Date(checkin);
    const d2 = new Date(checkout);
    return Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function getInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

// ---- NAVIGATION ----

function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item, .tab-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) {
        pageEl.classList.remove('active');
        // Force reflow for animation
        void pageEl.offsetWidth;
        pageEl.classList.add('active');
    }

    document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));

    // Refresh page content
    switch (page) {
        case 'dashboard': renderDashboard(); break;
        case 'reservations': renderReservations(); break;
        case 'calendar': renderCalendar(); break;
        case 'rooms': renderRooms(); break;
        case 'guests': renderGuests(); break;
    }
}

// Setup nav listeners
document.querySelectorAll('.nav-item, .tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

// ---- MODAL HELPERS ----

function openModal(id) {
    document.getElementById(id).classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
    document.body.style.overflow = '';
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    });
});

// Close on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAllDatePickers();
        document.querySelectorAll('.modal-overlay.open').forEach(m => {
            m.classList.remove('open');
            document.body.style.overflow = '';
        });
    }
});

// Close date pickers when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.mini-cal-wrapper')) {
        closeAllDatePickers();
    }
});

// ---- TOAST ----

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
// DASHBOARD
// =============================================

function renderDashboard() {
    computeRoomStatuses();
    // Stats
    const activeGroups = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked-in');
    const totalGuests = activeGroups.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const now = new Date();
    const monthRevenue = reservations
        .filter(r => {
            const d = new Date(r.checkin);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, r) => sum + (r.price || 0), 0);
    const yearRevenue = reservations
        .filter(r => (r.status === 'confirmed' || r.status === 'checked-in') && new Date(r.checkin).getFullYear() === now.getFullYear())
        .reduce((sum, r) => sum + (r.price || 0), 0);

    document.getElementById('stat-active-groups').textContent = activeGroups.length;
    document.getElementById('stat-total-guests').textContent = totalGuests;
    document.getElementById('stat-rooms-occupied').textContent = occupiedRooms + '/' + rooms.length;
    document.getElementById('stat-revenue').textContent = '\u20AC' + monthRevenue.toLocaleString();
    document.getElementById('stat-year-revenue').textContent = '\u20AC' + yearRevenue.toLocaleString();

    // Occupancy ring
    const totalRooms = rooms.length;
    const available = rooms.filter(r => r.status === 'available').length;
    const maintenance = rooms.filter(r => r.status === 'maintenance').length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const percent = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (percent / 100) * circumference;

    document.getElementById('occupancy-circle').setAttribute('stroke-dashoffset', offset);
    document.getElementById('occupancy-percent').textContent = percent + '%';
    document.getElementById('legend-occupied').textContent = occupied;
    document.getElementById('legend-available').textContent = available;
    document.getElementById('legend-maintenance').textContent = maintenance;

    // Upcoming check-ins
    const upcoming = reservations
        .filter(r => r.status === 'confirmed' || r.status === 'pending')
        .sort((a, b) => new Date(a.checkin) - new Date(b.checkin))
        .slice(0, 5);

    const checkinEl = document.getElementById('upcoming-checkins');
    if (upcoming.length === 0) {
        checkinEl.innerHTML = '<div class="empty-state small"><p>No upcoming check-ins</p></div>';
    } else {
        checkinEl.innerHTML = upcoming.map(r => `
            <div class="checkin-item" onclick="openReservationDetail('${r.id}')">
                <div class="checkin-dot" style="background: ${r.status === 'confirmed' ? 'var(--green)' : 'var(--orange)'}"></div>
                <div class="checkin-info">
                    <div class="checkin-name">${escapeHtml(r.groupName)}</div>
                    <div class="checkin-detail">${r.guestCount} guests &middot; ${r.roomCount} rooms</div>
                </div>
                <div class="checkin-date">${formatDateDisplay(r.checkin)}</div>
            </div>
        `).join('');
    }

    // Today's activity
    const today = formatDate(new Date());
    const todayCheckins = reservations.filter(r => r.checkin === today);
    const todayCheckouts = reservations.filter(r => r.checkout === today);

    const activityEl = document.getElementById('today-activity');
    const activities = [];

    todayCheckins.forEach(r => {
        activities.push(`
            <div class="activity-item">
                <div class="activity-icon checkin">&#8593;</div>
                <div>
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> checking in</div>
                    <div class="activity-time">${r.guestCount} guests</div>
                </div>
            </div>
        `);
    });

    todayCheckouts.forEach(r => {
        activities.push(`
            <div class="activity-item">
                <div class="activity-icon checkout">&#8595;</div>
                <div>
                    <div class="activity-text"><strong>${escapeHtml(r.groupName)}</strong> checking out</div>
                    <div class="activity-time">${r.guestCount} guests</div>
                </div>
            </div>
        `);
    });

    if (activities.length === 0) {
        activityEl.innerHTML = '<div class="empty-state small"><p>No activity today</p></div>';
    } else {
        activityEl.innerHTML = activities.join('');
    }
}

// =============================================
// RESERVATIONS
// =============================================

function renderReservations() {
    const search = (document.getElementById('searchReservations')?.value || '').toLowerCase();
    let filtered = reservations;

    if (currentFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }

    if (search) {
        filtered = filtered.filter(r =>
            r.groupName.toLowerCase().includes(search) ||
            r.organizer.toLowerCase().includes(search) ||
            (r.email || '').toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => new Date(a.checkin) - new Date(b.checkin));

    const list = document.getElementById('reservationsList');

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No reservations found</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(r => {
        const nights = nightsBetween(r.checkin, r.checkout);
        const statusLabel = r.status.replace('-', ' ');
        return `
            <div class="reservation-card" onclick="openReservationDetail('${r.id}')">
                <div class="res-color-bar ${r.status}"></div>
                <div class="res-info">
                    <div class="res-group-name">${escapeHtml(r.groupName)}</div>
                    <div class="res-organizer">${escapeHtml(r.organizer)}</div>
                </div>
                <div class="res-meta">
                    <div class="res-meta-item">
                        <span class="res-meta-value">${r.guestCount}</span>
                        <span class="res-meta-label">Guests</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${r.roomCount}</span>
                        <span class="res-meta-label">Rooms</span>
                    </div>
                    <div class="res-meta-item">
                        <span class="res-meta-value">${nights}</span>
                        <span class="res-meta-label">Nights</span>
                    </div>
                </div>
                <div class="res-dates">${formatDateDisplay(r.checkin)} &rarr; ${formatDateDisplay(r.checkout)}</div>
                <span class="status-badge ${r.status}">${statusLabel}</span>
            </div>
        `;
    }).join('');
}

function setReservationFilter(filter, el) {
    currentFilter = filter;
    document.querySelectorAll('#page-reservations .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderReservations();
}

function filterReservations() {
    renderReservations();
}

// ---- New / Edit Reservation ----

function populateRoomChecklist(selectedRoomIds) {
    const checklist = document.getElementById('resRoomChecklist');
    const sortedRooms = [...rooms].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
    const selected = new Set(selectedRoomIds || []);

    let html = '';
    let currentFloor = null;
    sortedRooms.forEach(r => {
        if (r.floor !== currentFloor) {
            currentFloor = r.floor;
            const floorRooms = sortedRooms.filter(rm => rm.floor === r.floor);
            const allChecked = floorRooms.every(rm => selected.has(rm.id));
            html += `<label class="room-check-floor-header"><input type="checkbox" data-floor="${r.floor}" ${allChecked ? 'checked' : ''} onchange="toggleFloorCheckboxes(this)"> Floor ${r.floor}</label>`;
        }
        const checked = selected.has(r.id);
        html += `
            <label class="room-check-item${checked ? ' checked' : ''}">
                <input type="checkbox" value="${r.id}" ${checked ? 'checked' : ''} onchange="onRoomCheckChange(this)">
                <div class="room-check-info">
                    <span class="room-check-number">${r.number}</span>
                    <span class="room-check-type">${r.type} &middot; ${r.capacity} pax</span>
                </div>
            </label>`;
    });

    if (sortedRooms.length === 0) {
        html = '<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px">No rooms yet.<br>Add rooms first.</div>';
    }

    checklist.innerHTML = html;
    document.getElementById('resRoomSelectAll').checked = selected.size > 0 && selected.size === rooms.length;
    updateRoomCount();
}

function toggleAllRoomCheckboxes(el) {
    const checklist = document.getElementById('resRoomChecklist');
    checklist.querySelectorAll('input[type="checkbox"]').forEach(c => {
        c.checked = el.checked;
        const item = c.closest('.room-check-item');
        if (item) item.classList.toggle('checked', el.checked);
    });
    updateRoomCount();
}

function onRoomCheckChange(el) {
    el.closest('.room-check-item').classList.toggle('checked', el.checked);
    updateFloorAndSelectAll();
    updateRoomCount();
}

function toggleFloorCheckboxes(el) {
    const floor = el.dataset.floor;
    const checklist = document.getElementById('resRoomChecklist');
    // Find room checkboxes that belong to this floor — they follow the floor header
    const roomItems = checklist.querySelectorAll('.room-check-item');
    roomItems.forEach(item => {
        const cb = item.querySelector('input[type="checkbox"]');
        const roomId = cb.value;
        const room = rooms.find(r => r.id === roomId);
        if (room && String(room.floor) === floor) {
            cb.checked = el.checked;
            item.classList.toggle('checked', el.checked);
        }
    });
    updateFloorAndSelectAll();
    updateRoomCount();
}

function updateFloorAndSelectAll() {
    const checklist = document.getElementById('resRoomChecklist');
    const roomChecks = checklist.querySelectorAll('.room-check-item input[type="checkbox"]');
    const floorChecks = checklist.querySelectorAll('.room-check-floor-header input[type="checkbox"]');

    // Update each floor checkbox
    floorChecks.forEach(fc => {
        const floor = fc.dataset.floor;
        const floorRoomChecks = [...roomChecks].filter(c => {
            const room = rooms.find(r => r.id === c.value);
            return room && String(room.floor) === floor;
        });
        fc.checked = floorRoomChecks.length > 0 && floorRoomChecks.every(c => c.checked);
    });

    // Update select all
    const all = roomChecks.length > 0 && [...roomChecks].every(c => c.checked);
    document.getElementById('resRoomSelectAll').checked = all;
}

function updateRoomCount() {
    const count = document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked').length;
    const el = document.getElementById('resRoomCount');
    if (el) el.textContent = `${count} room${count !== 1 ? 's' : ''} selected`;
}

function getSelectedRoomIds() {
    return [...document.querySelectorAll('#resRoomChecklist .room-check-item input[type="checkbox"]:checked')].map(c => c.value);
}

function getAssignedRoomIds(resId) {
    return [...new Set(guests.filter(g => g.reservationId === resId && g.roomId).map(g => g.roomId))];
}

function toggleExpirationField() {
    const status = document.getElementById('resStatus').value;
    document.getElementById('resExpirationGroup').style.display = status === 'pending' ? '' : 'none';
}

// ---- Reusable Date Picker ----

function getWrapper(el) {
    return el.closest('.mini-cal-wrapper');
}

function toggleDatePicker(inputEl) {
    const wrapper = getWrapper(inputEl);
    const dd = wrapper.querySelector('.mini-cal-dropdown');
    // Close all other open pickers first
    document.querySelectorAll('.mini-cal-dropdown.open').forEach(d => {
        if (d !== dd) d.classList.remove('open');
    });
    if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
    const targetId = wrapper.dataset.target;
    const val = document.getElementById(targetId).value;
    wrapper._viewDate = val ? new Date(val + 'T00:00:00') : new Date();
    renderDatePicker(wrapper);
    dd.classList.add('open');
}

function closeAllDatePickers() {
    document.querySelectorAll('.mini-cal-dropdown.open').forEach(d => d.classList.remove('open'));
}

function datePickerNav(btn, dir) {
    const wrapper = getWrapper(btn);
    wrapper._viewDate.setMonth(wrapper._viewDate.getMonth() + dir);
    renderDatePicker(wrapper);
}

function renderDatePicker(wrapper) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const vd = wrapper._viewDate;
    const y = vd.getFullYear();
    const m = vd.getMonth();
    wrapper.querySelector('.mini-cal-month-label').textContent = monthNames[m] + ' ' + y;

    const targetId = wrapper.dataset.target;
    const selected = document.getElementById(targetId).value;
    const todayStr = formatDate(new Date());

    let startDow = new Date(y, m, 1).getDay();
    if (startDow === 0) startDow = 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    let html = '';
    for (let i = startDow - 1; i > 0; i--) {
        html += `<button type="button" class="mini-cal-day other-month" disabled>${prevDays - i + 1}</button>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let cls = 'mini-cal-day';
        if (dateStr === todayStr) cls += ' today';
        if (dateStr === selected) cls += ' selected';
        html += `<button type="button" class="${cls}" onclick="selectDatePickerDay(this,'${dateStr}')">${d}</button>`;
    }
    const totalCells = startDow - 1 + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        html += `<button type="button" class="mini-cal-day other-month" disabled>${i}</button>`;
    }
    wrapper.querySelector('.mini-cal-grid').innerHTML = html;
}

function selectDatePickerDay(btn, dateStr) {
    const wrapper = getWrapper(btn);
    const targetId = wrapper.dataset.target;
    document.getElementById(targetId).value = dateStr;
    setDatePickerDisplay(wrapper, dateStr);
    wrapper.querySelector('.mini-cal-dropdown').classList.remove('open');
}

function setDatePickerDisplay(wrapper, dateStr) {
    const display = wrapper.querySelector('.mini-cal-display');
    if (!dateStr) { display.textContent = 'Select date...'; return; }
    const d = new Date(dateStr + 'T00:00:00');
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    display.textContent = `${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}`;
}

function setDateFieldValue(targetId, dateStr) {
    document.getElementById(targetId).value = dateStr;
    const wrapper = document.querySelector(`.mini-cal-wrapper[data-target="${targetId}"]`);
    if (wrapper) setDatePickerDisplay(wrapper, dateStr);
}

function openNewReservationModal() {
    document.getElementById('reservationModalTitle').textContent = 'New Group Reservation';
    document.getElementById('reservationForm').reset();
    document.getElementById('resId').value = '';
    setDateFieldValue('resCheckin', formatDate(new Date()));
    setDateFieldValue('resCheckout', formatDate(addDays(new Date(), 3)));
    setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
    populateRoomChecklist([]);
    toggleExpirationField();
    openModal('reservationModal');
}

function openEditReservation(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById('reservationModalTitle').textContent = 'Edit Reservation';
    document.getElementById('resId').value = r.id;
    document.getElementById('resGroupName').value = r.groupName;
    setDateFieldValue('resCheckin', r.checkin);
    setDateFieldValue('resCheckout', r.checkout);
    document.getElementById('resStatus').value = r.status;
    setDateFieldValue('resExpiration', r.expiration || '');
    document.getElementById('resPrice').value = r.price || '';
    document.getElementById('resNotes').value = r.notes || '';
    toggleExpirationField();

    // Get rooms assigned to this reservation
    const assignedIds = r.roomIds || getAssignedRoomIds(r.id);
    populateRoomChecklist(assignedIds);

    closeModal('reservationDetailModal');
    openModal('reservationModal');
}

async function saveReservation(e) {
    e.preventDefault();

    const id = document.getElementById('resId').value;
    const selectedRooms = getSelectedRoomIds();
    const data = {
        groupName: document.getElementById('resGroupName').value.trim(),
        checkin: document.getElementById('resCheckin').value,
        checkout: document.getElementById('resCheckout').value,
        roomCount: selectedRooms.length,
        roomIds: selectedRooms,
        status: document.getElementById('resStatus').value,
        expiration: document.getElementById('resStatus').value === 'pending' ? document.getElementById('resExpiration').value : '',
        price: parseFloat(document.getElementById('resPrice').value) || 0,
        notes: document.getElementById('resNotes').value.trim()
    };

    if (new Date(data.checkout) <= new Date(data.checkin)) {
        showToast('Check-out must be after check-in', 'error');
        return;
    }

    if (selectedRooms.length === 0) {
        showToast('Please select at least one room', 'error');
        return;
    }

    try {
        if (id) {
            const idx = reservations.findIndex(r => r.id === id);
            if (idx !== -1) {
                reservations[idx] = { ...reservations[idx], ...data };
            }
            await apiPut(API.reservations, { ...data, id });
            showToast('Reservation updated');
        } else {
            const newRes = { id: generateId(), ...data, createdAt: new Date().toISOString() };
            reservations.push(newRes);
            await apiPost(API.reservations, newRes);
            showToast('Group reservation created');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to save reservation', 'error');
        return;
    }

    closeModal('reservationModal');
    renderDashboard();
    refreshCalendar();
}

async function deleteReservation(id) {
    if (!confirm('Delete this group reservation and all associated guests?')) return;
    reservations = reservations.filter(r => r.id !== id);
    guests = guests.filter(g => g.reservationId !== id);
    try {
        await apiDelete(API.reservations, id);
    } catch (err) {
        console.error(err);
        showToast('Failed to delete reservation', 'error');
        return;
    }
    closeModal('reservationDetailModal');
    showToast('Reservation deleted');
    renderDashboard();
    refreshCalendar();
}

// ---- Reservation Detail ----

function openReservationDetail(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;

    document.getElementById('detailGroupName').textContent = r.groupName;
    const statusLabel = r.status.replace('-', ' ');
    const badge = document.getElementById('detailStatusBadge');
    badge.textContent = statusLabel;
    badge.className = 'status-badge ' + r.status;

    const nights = nightsBetween(r.checkin, r.checkout);

    const body = document.getElementById('reservationDetailBody');
    body.innerHTML = `
        <div class="detail-toolbar">
            <button class="btn btn-secondary btn-sm" onclick="openEditReservation('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openRoomAssignment('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Room Planner
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openGuestsList('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Manage Guests
            </button>
            <button class="btn btn-ghost btn-sm detail-delete-btn" onclick="deleteReservation('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
            </button>
        </div>

        <div class="detail-info-card">
            <div class="detail-info-grid">
                <div class="detail-info-item">
                    <span class="detail-info-label">Check-in</span>
                    <span class="detail-info-value">${formatDateDisplay(r.checkin)}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">Check-out</span>
                    <span class="detail-info-value">${formatDateDisplay(r.checkout)}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">Rooms</span>
                    <span class="detail-info-value">${r.roomCount}</span>
                </div>
                <div class="detail-info-item">
                    <span class="detail-info-label">Nights</span>
                    <span class="detail-info-value">${nights}</span>
                </div>
                <div class="detail-info-item detail-info-price">
                    <span class="detail-info-label">Total Price</span>
                    <span class="detail-info-value">&euro;${(r.price || 0).toLocaleString()}</span>
                </div>
                ${r.status === 'pending' && r.expiration ? `<div class="detail-info-item">
                    <span class="detail-info-label">Expires</span>
                    <span class="detail-info-value">${formatDateDisplay(r.expiration)}</span>
                </div>` : ''}
            </div>
        </div>

        <div class="detail-notes-section">
            <span class="detail-info-label">Notes</span>
            <textarea id="detailNotesField" class="form-control" rows="4" placeholder="Add notes about this reservation...">${escapeHtml(r.notes || '')}</textarea>
            <button class="btn btn-sm btn-primary" onclick="saveDetailNotes('${r.id}')">Save Notes</button>
        </div>
    `;

    openModal('reservationDetailModal');
}

async function saveDetailNotes(id) {
    const r = reservations.find(x => x.id === id);
    if (!r) return;
    const notes = document.getElementById('detailNotesField').value.trim();
    r.notes = notes;
    try {
        await apiPut(API.reservations, { ...r });
        showToast('Notes saved');
    } catch (err) {
        console.error(err);
        showToast('Failed to save notes', 'error');
    }
}

// ---- Guests List Modal ----

function openGuestsList(reservationId) {
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    const resGuests = guests.filter(g => g.reservationId === reservationId);

    document.getElementById('guestsListTitle').textContent = `Guests — ${r.groupName}`;
    const body = document.getElementById('guestsListBody');
    body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
            <span style="color:var(--text-secondary)">${resGuests.length} guest(s)</span>
            <div style="display:flex;gap:8px">
                <button class="btn btn-sm btn-secondary" onclick="openFileImportModal('${reservationId}')">Import from File</button>
                <button class="btn btn-sm btn-primary" onclick="openAddGuestModal('${reservationId}')">Add Guest</button>
            </div>
        </div>
        <div class="detail-guests-list">
            ${resGuests.length === 0 ? '<div class="empty-state small"><p>No guests added yet</p></div>' :
            resGuests.map(g => {
                const room = g.roomId ? rooms.find(rm => rm.id === g.roomId) : null;
                return `
                    <div class="detail-guest-item">
                        <div class="guest-avatar">${getInitials(g.firstName + ' ' + g.lastName)}</div>
                        <div class="guest-info">
                            <strong>${escapeHtml(g.firstName + ' ' + g.lastName)}</strong><br>
                            <span>${room ? 'Room ' + room.number : 'No room assigned'}${g.docNumber ? ' &middot; ' + g.docType + ': ' + g.docNumber : ''}</span>
                        </div>
                        <button class="btn btn-ghost btn-sm" onclick="openEditGuestModal('${g.id}')">Edit</button>
                        <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${reservationId}')">Remove</button>
                    </div>
                `;
            }).join('')}
        </div>

        <div class="detail-section" style="margin-top:24px">
            <h3>Schedine Alloggiati</h3>
            <div id="alloggiatiPanel">
                <p style="color:var(--text-secondary);margin-bottom:12px">
                    Send guest registration forms to the Italian police (Alloggiati Web).
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-sm btn-secondary" onclick="alloggiatiPreview('${reservationId}')">Preview Records</button>
                    <button class="btn btn-sm btn-secondary" onclick="alloggiatiTest('${reservationId}')">Test</button>
                    <button class="btn btn-sm btn-primary" onclick="alloggiatiSend('${reservationId}')">Send to Police</button>
                </div>
                <div id="alloggiatiResults" style="margin-top:12px"></div>
            </div>
        </div>
    `;

    openModal('guestsListModal');
}

// ---- Alloggiati Web ----

let alloggiatiToken = null;
let alloggiatiTokenExpires = null;
let alloggiatiLuoghi = null; // cached: [{code, name}]
let alloggiatiStati = null;  // cached: [{code, name}]

async function loadAlloggiatiTables() {
    if (alloggiatiLuoghi && alloggiatiStati) return;
    try {
        const token = await getAlloggiatiToken();
        const data = await apiGet(API.alloggiati + '?action=tabella&token=' + encodeURIComponent(token) + '&tipo=Luoghi');
        if (!data.csv) return;

        const lines = data.csv.split('\n').filter(l => l.trim());
        const luoghi = [];
        const stati = [];

        for (const line of lines) {
            const parts = line.split(';');
            if (parts.length < 2) continue;
            const code = parts[0].trim();
            const name = parts[1].trim();
            if (!code || !name) continue;

            // Try to get province from CSV (usually 3rd or 4th column)
            const prov = (parts.length >= 3 ? parts[2].trim() : '') || (parts.length >= 4 ? parts[3].trim() : '');

            // Build a display label: "San Leo (RN)" for comuni, just "ITALIA" for states
            const isState = code.length === 9 && code.startsWith('1') && code.charAt(1) === '0';
            const label = prov && !isState ? `${name} (${prov})` : name;

            const entry = { code, name, prov, label };
            if (isState) {
                stati.push(entry);
            }
            luoghi.push(entry);
        }

        alloggiatiLuoghi = luoghi;
        alloggiatiStati = stati.length > 0 ? stati : luoghi;

        // Populate countries datalist — just show country name
        const countriesList = document.getElementById('countriesList');
        countriesList.innerHTML = alloggiatiStati.map(s =>
            `<option value="${s.label}">`
        ).join('');

        // Don't pre-populate comuni/luoghi — they're filtered on input (too large)

    } catch (err) {
        console.error('Failed to load Alloggiati tables:', err);
    }
}

function findCodeFromLabel(list, label) {
    if (!list || !label) return '';
    const lower = label.toLowerCase().trim();
    // First try exact match on display label
    const match = list.find(l => l.label.toLowerCase() === lower);
    if (match) return match.code;
    // Fallback: match by name only
    const nameMatch = list.find(l => l.name.toLowerCase() === lower);
    return nameMatch ? nameMatch.code : '';
}

function findLabelFromCode(list, code) {
    if (!list || !code) return '';
    const match = list.find(l => l.code === code);
    return match ? match.label : '';
}

function setupAlloggiatiSearchField(searchId, hiddenId, listSource) {
    const searchEl = document.getElementById(searchId);
    if (!searchEl) return;

    const resolveCode = () => {
        const list = listSource === 'stati' ? alloggiatiStati : alloggiatiLuoghi;
        const code = findCodeFromLabel(list, searchEl.value);
        // If no match found, treat the typed value as a raw code (fallback)
        document.getElementById(hiddenId).value = code || searchEl.value.trim();
    };

    searchEl.addEventListener('change', resolveCode);
    searchEl.addEventListener('blur', resolveCode);

    // Filter datalist for comuni (large list) on input
    if (searchId === 'guestBirthComuneSearch' || searchId === 'guestDocIssuedPlaceSearch') {
        searchEl.addEventListener('input', () => {
            const query = searchEl.value.toLowerCase().trim();
            if (query.length < 2 || !alloggiatiLuoghi) return;
            const listId = searchId === 'guestBirthComuneSearch' ? 'comuniList' : 'luoghiList';
            const dlEl = document.getElementById(listId);
            const source = searchId === 'guestBirthComuneSearch'
                ? alloggiatiLuoghi.filter(l => !alloggiatiStati.includes(l))
                : alloggiatiLuoghi;
            const filtered = source.filter(l => l.label.toLowerCase().includes(query)).slice(0, 200);
            dlEl.innerHTML = filtered.map(l =>
                `<option value="${l.label}">`
            ).join('');
        });
    }
}

// Initialize search fields once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAlloggiatiSearchField('guestCitizenshipSearch', 'guestCitizenship', 'stati');
    setupAlloggiatiSearchField('guestBirthCountrySearch', 'guestBirthCountry', 'stati');
    setupAlloggiatiSearchField('guestBirthComuneSearch', 'guestBirthComune', 'luoghi');
    setupAlloggiatiSearchField('guestDocIssuedPlaceSearch', 'guestDocIssuedPlace', 'luoghi');
});

async function getAlloggiatiToken() {
    // Reuse token if still valid (with 5 min buffer)
    if (alloggiatiToken && alloggiatiTokenExpires && new Date(alloggiatiTokenExpires) > new Date(Date.now() + 5 * 60000)) {
        return alloggiatiToken;
    }
    const data = await apiGet(API.alloggiati + '?action=token');
    alloggiatiToken = data.token;
    alloggiatiTokenExpires = data.expires;
    return alloggiatiToken;
}

function renderAlloggiatiResults(container, data, mode) {
    if (!data) return;

    let html = '';
    if (mode === 'preview') {
        html += `<div class="alloggiati-preview">
            <p><strong>${data.guests.length} record(s) built</strong></p>
            <div class="alloggiati-records">`;
        data.guests.forEach((g, i) => {
            html += `<div class="alloggiati-record-item">
                <span>${g.name}</span>
                <span class="badge">${g.guestType === '17' ? 'Leader' : g.guestType === '18' ? 'Member' : g.guestType === '19' ? 'Family Head' : g.guestType === '20' ? 'Family' : 'Single'}</span>
                <span style="color:${g.recordLength === 168 ? 'var(--green)' : 'var(--red)'}">${g.recordLength} chars</span>
            </div>`;
        });
        if (data.debug) {
            html += `<div style="margin-top:8px;padding:8px;background:var(--bg-tertiary);border-radius:6px;font-size:11px;font-family:monospace;word-break:break-all">
                <div>checkin raw: ${data.debug.checkinRaw} (${data.debug.checkinType})</div>
                <div>checkout raw: ${data.debug.checkoutRaw}</div>
                <div>record[0]: ${data.debug.record0}</div>
                <div>length: ${data.debug.recordLength}</div>
            </div>`;
        }
        html += `</div></div>`;
    } else {
        const icon = data.success ? '&#10003;' : '&#10007;';
        const color = data.success ? 'var(--green)' : 'var(--red)';
        html += `<div style="margin-bottom:8px">
            <span style="color:${color};font-weight:bold">${icon} ${mode === 'test' ? 'Test' : 'Send'}: ${data.validCount}/${data.totalCount} valid</span>
        </div>`;
        if (data.details && data.details.length > 0) {
            html += '<div class="alloggiati-records">';
            data.details.forEach(d => {
                const ok = d.esito;
                html += `<div class="alloggiati-record-item ${ok ? 'success' : 'error'}">
                    <span>${d.guestName}</span>
                    <span style="color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? 'OK' : d.errorDesc + (d.errorDetail ? ': ' + d.errorDetail : '')}</span>
                </div>`;
            });
            html += '</div>';
        }
    }
    container.innerHTML = html;
}

async function alloggiatiPreview(reservationId) {
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Building records...</p>';
    try {
        const data = await apiGet(API.alloggiati + '?action=build&reservationId=' + reservationId);
        renderAlloggiatiResults(container, data, 'preview');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

async function alloggiatiTest(reservationId) {
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Getting token & testing...</p>';
    try {
        const token = await getAlloggiatiToken();
        const data = await apiPost(API.alloggiati + '?action=test', { reservationId, token });
        renderAlloggiatiResults(container, data, 'test');
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

async function alloggiatiSend(reservationId) {
    if (!confirm('Send schedine to the police? Make sure you tested first.')) return;
    const container = document.getElementById('alloggiatiResults');
    container.innerHTML = '<p>Sending to Alloggiati Web...</p>';
    try {
        const token = await getAlloggiatiToken();
        const data = await apiPost(API.alloggiati + '?action=send', { reservationId, token });
        renderAlloggiatiResults(container, data, 'send');
        if (data.success && data.validCount === data.totalCount) {
            showToast('All schedine sent successfully!');
        } else {
            showToast(`${data.validCount}/${data.totalCount} schedine accepted`, 'error');
        }
    } catch (err) {
        container.innerHTML = `<p style="color:var(--red)">Error: ${err.message}</p>`;
    }
}

// ---- Assign Rooms ----

function openAssignRooms(reservationId) {
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    const resGuests = guests.filter(g => g.reservationId === reservationId);
    const assignedRoomIds = resGuests.map(g => g.roomId).filter(Boolean);

    const availableRooms = rooms.filter(rm => rm.status === 'available' || assignedRoomIds.includes(rm.id));

    const body = document.getElementById('assignRoomsBody');
    body.innerHTML = `
        <p style="margin-bottom:16px;color:var(--text-secondary);font-size:14px">
            Select rooms for <strong>${escapeHtml(r.groupName)}</strong> (${r.roomCount} needed)
        </p>
        <div id="assignRoomsList">
            ${availableRooms.map(rm => {
                const isSelected = assignedRoomIds.includes(rm.id);
                return `
                    <div class="assign-room-item">
                        <div class="assign-room-info">
                            <span class="assign-room-number">Room ${rm.number}</span>
                            <span class="assign-room-type">${rm.type} &middot; ${rm.capacity} pax &middot; &euro;${rm.price}/night</span>
                        </div>
                        <button class="assign-room-check ${isSelected ? 'selected' : ''}"
                                onclick="toggleRoomAssignment(this, '${rm.id}', '${reservationId}')"
                                data-room-id="${rm.id}">
                            ${isSelected ? '&#10003;' : ''}
                        </button>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="modal-actions">
            <button class="btn btn-ghost" onclick="closeModal('assignRoomsModal')">Done</button>
        </div>
    `;

    closeModal('reservationDetailModal');
    openModal('assignRoomsModal');
}

async function toggleRoomAssignment(btn, roomId, reservationId) {
    const isSelected = btn.classList.contains('selected');

    if (isSelected) {
        btn.classList.remove('selected');
        btn.innerHTML = '';
        // Free room
        const roomIdx = rooms.findIndex(r => r.id === roomId);
        if (roomIdx !== -1) rooms[roomIdx].status = 'available';
        // Unassign from guests
        guests.forEach(g => {
            if (g.reservationId === reservationId && g.roomId === roomId) {
                g.roomId = '';
            }
        });
    } else {
        btn.classList.add('selected');
        btn.innerHTML = '&#10003;';
        // Mark room occupied
        const roomIdx = rooms.findIndex(r => r.id === roomId);
        if (roomIdx !== -1) rooms[roomIdx].status = 'occupied';
    }

    try {
        // Save all modified rooms and guests
        const modifiedRoom = rooms.find(r => r.id === roomId);
        if (modifiedRoom) await apiPut(API.rooms, modifiedRoom);
        for (const g of guests.filter(g => g.reservationId === reservationId)) {
            await apiPut(API.guests, g);
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to save room assignment', 'error');
    }
}

// =============================================
// ROOM ASSIGNMENT SPREADSHEET (Dynamic Columns)
// =============================================

const DEFAULT_PLANNER_COLUMNS = [
    { id: 'usage', name: 'Usage' },
    { id: 'group', name: 'Group' },
    { id: 'occ', name: 'Occ.' },
    { id: 'notes', name: 'Notes' }
];

let plannerColumns = [];

async function openRoomAssignment(reservationId) {
    currentAssignmentReservationId = reservationId;
    const r = reservations.find(x => x.id === reservationId);
    if (!r) return;

    document.getElementById('assignmentModalTitle').textContent = 'Room Planner — ' + r.groupName;

    // Load column config
    try {
        const config = await apiGet(API.plannerConfig + '?reservation_id=' + reservationId);
        plannerColumns = (config && config.columns && config.columns.length > 0)
            ? config.columns
            : DEFAULT_PLANNER_COLUMNS.map(c => ({ ...c }));
    } catch {
        plannerColumns = DEFAULT_PLANNER_COLUMNS.map(c => ({ ...c }));
    }

    // Load existing assignments
    try {
        assignmentData = await apiGet(API.assignments + '?reservation_id=' + reservationId);
    } catch {
        assignmentData = [];
    }

    renderAssignmentSpreadsheet();
    closeModal('reservationDetailModal');
    openModal('roomAssignmentModal');
}

function renderAssignmentSpreadsheet() {
    const body = document.getElementById('roomAssignmentBody');
    const sortedRooms = [...rooms].sort((a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }));

    // Group by floor
    const floors = {};
    sortedRooms.forEach(rm => {
        if (!floors[rm.floor]) floors[rm.floor] = [];
        floors[rm.floor].push(rm);
    });

    // Build assignment lookup
    const assignMap = {};
    assignmentData.forEach(a => { assignMap[a.roomId] = a; });

    const totalCols = 2 + plannerColumns.length + 1; // room + type + dynamic cols + add btn

    let html = `
        <div class="assignment-toolbar">
            <div class="assignment-stats" id="assignmentStats">
                ${getAssignmentStatsHTML()}
            </div>
        </div>
        <table class="assignment-table">
            <thead>
                <tr>
                    <th class="col-room">Room</th>
                    <th class="col-type">Type</th>
                    ${plannerColumns.map((col, i) => `
                        <th class="col-dynamic">
                            <div class="col-header-wrap">
                                <input type="text" class="col-header-input" value="${escapeHtml(col.name)}"
                                    data-col-idx="${i}" onchange="renamePlannerColumn(this)" onkeydown="if(event.key==='Enter')this.blur()">
                                <button class="col-remove-btn" onclick="removePlannerColumn(${i})" title="Remove column">&times;</button>
                            </div>
                        </th>
                    `).join('')}
                    <th class="col-add">
                        <button class="col-add-btn" onclick="addPlannerColumn()" title="Add column">+</button>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    for (const [floor, floorRooms] of Object.entries(floors)) {
        html += `<tr class="floor-header-row"><td colspan="${totalCols}">Floor ${floor}</td></tr>`;

        for (const rm of floorRooms) {
            const a = assignMap[rm.id] || {};
            const vals = a.cellValues || {};
            const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);

            html += `
                <tr class="assignment-row ${hasData ? 'assigned' : ''}" data-room-id="${rm.id}">
                    <td class="col-room"><strong>${escapeHtml(rm.number)}</strong></td>
                    <td class="col-type">${escapeHtml(rm.type)} (${rm.capacity})</td>
                    ${plannerColumns.map(col => {
                        const val = vals[col.id] != null ? vals[col.id] : '';
                        return `
                            <td class="col-dynamic">
                                <input type="text" class="cell-input" data-col="${col.id}" data-room="${rm.id}"
                                    value="${escapeHtml(String(val))}" placeholder="..." onchange="onAssignmentChange(this)">
                            </td>
                        `;
                    }).join('')}
                    <td class="col-add"></td>
                </tr>
            `;
        }
    }

    html += `</tbody></table>`;
    body.innerHTML = html;
}

function getAssignmentStatsHTML() {
    let filled = 0;
    assignmentData.forEach(a => {
        const vals = a.cellValues || {};
        if (Object.values(vals).some(v => v !== '' && v !== 0 && v != null)) filled++;
    });
    return `
        <span>Rooms assigned: <strong>${filled}</strong> / ${rooms.length}</span>
        <span>Columns: <strong>${plannerColumns.length}</strong></span>
    `;
}

function onAssignmentChange(el) {
    const roomId = el.dataset.room;
    const colId = el.dataset.col;
    const value = el.value;

    let existing = assignmentData.find(a => a.roomId === roomId);
    if (!existing) {
        existing = {
            id: generateId(),
            reservationId: currentAssignmentReservationId,
            roomId: roomId,
            cellValues: {},
            _isNew: true
        };
        assignmentData.push(existing);
    }
    if (!existing.cellValues) existing.cellValues = {};
    existing.cellValues[colId] = value;
    existing._dirty = true;

    // Update row styling
    const row = el.closest('tr');
    const vals = existing.cellValues;
    const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);
    row.classList.toggle('assigned', hasData);

    // Update stats
    const stats = document.getElementById('assignmentStats');
    if (stats) stats.innerHTML = getAssignmentStatsHTML();
}

function addPlannerColumn() {
    const id = 'col_' + Date.now().toString(36);
    const name = 'Column ' + (plannerColumns.length + 1);
    plannerColumns.push({ id, name });
    renderAssignmentSpreadsheet();
}

function removePlannerColumn(idx) {
    const col = plannerColumns[idx];
    if (!confirm(`Remove column "${col.name}"? Data in this column will be lost on save.`)) return;

    plannerColumns.splice(idx, 1);

    // Remove this column's data from assignments
    assignmentData.forEach(a => {
        if (a.cellValues && a.cellValues[col.id] !== undefined) {
            delete a.cellValues[col.id];
            a._dirty = true;
        }
    });

    renderAssignmentSpreadsheet();
}

function renamePlannerColumn(el) {
    const idx = parseInt(el.dataset.colIdx);
    const newName = el.value.trim();
    if (!newName) {
        el.value = plannerColumns[idx].name;
        return;
    }
    plannerColumns[idx].name = newName;
}

async function saveAllAssignments() {
    const btn = document.getElementById('saveAssignmentsBtn');
    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
        // Save column config
        await apiPut(API.plannerConfig, {
            reservationId: currentAssignmentReservationId,
            columns: plannerColumns
        });

        // Save cell data
        for (const a of assignmentData) {
            if (!a._dirty) continue;

            const vals = a.cellValues || {};
            const hasData = Object.values(vals).some(v => v !== '' && v !== 0 && v != null);

            if (!hasData) {
                if (!a._isNew) {
                    await apiDelete(API.assignments, a.id);
                }
                continue;
            }

            const payload = {
                id: a.id,
                reservationId: a.reservationId,
                roomId: a.roomId,
                cellValues: vals
            };

            if (a._isNew) {
                await apiPost(API.assignments, payload);
                a._isNew = false;
            } else {
                await apiPut(API.assignments, payload);
            }
            a._dirty = false;
        }

        showToast('Room assignments saved');
    } catch (err) {
        console.error(err);
        showToast('Failed to save assignments', 'error');
    }

    btn.textContent = 'Save';
    btn.disabled = false;
}

// =============================================
// ROOMS
// =============================================

function renderRooms() {
    computeRoomStatuses();
    const search = (document.getElementById('searchRooms')?.value || '').toLowerCase();
    let filtered = rooms;

    if (currentRoomFilter !== 'all') {
        filtered = filtered.filter(r => r.status === currentRoomFilter);
    }

    if (search) {
        filtered = filtered.filter(r =>
            r.number.toLowerCase().includes(search) ||
            r.type.toLowerCase().includes(search)
        );
    }

    filtered.sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const grid = document.getElementById('roomsGrid');

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No rooms found</p></div>';
        return;
    }

    grid.innerHTML = filtered.map(r => `
        <div class="room-card ${r.status}" onclick="openEditRoom('${r.id}')">
            <div class="room-number">${r.number}</div>
            <div class="room-type">
                <span class="room-status-dot ${r.status}"></span>${r.type}
            </div>
            <div class="room-details">
                <span class="room-capacity">${r.capacity} pax &middot; Floor ${r.floor}</span>
            </div>
        </div>
    `).join('');
}

function setRoomFilter(filter, el) {
    currentRoomFilter = filter;
    document.querySelectorAll('#page-rooms .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    renderRooms();
}

function filterRooms() {
    renderRooms();
}

function openNewRoomModal() {
    document.getElementById('roomModalTitle').textContent = 'Add Room';
    document.getElementById('roomForm').reset();
    document.getElementById('roomId').value = '';
    document.getElementById('deleteRoomBtn').style.display = 'none';
    openModal('roomModal');
}

function openEditRoom(id) {
    const r = rooms.find(x => x.id === id);
    if (!r) return;

    document.getElementById('roomModalTitle').textContent = 'Edit Room';
    document.getElementById('roomId').value = r.id;
    document.getElementById('roomNumber').value = r.number;
    document.getElementById('roomFloor').value = r.floor;
    document.getElementById('roomType').value = r.type;
    document.getElementById('roomCapacity').value = r.capacity;
    document.getElementById('deleteRoomBtn').style.display = '';

    openModal('roomModal');
}

async function saveRoom(e) {
    e.preventDefault();

    const id = document.getElementById('roomId').value;
    const data = {
        number: document.getElementById('roomNumber').value.trim(),
        floor: parseInt(document.getElementById('roomFloor').value) || 1,
        type: document.getElementById('roomType').value,
        capacity: parseInt(document.getElementById('roomCapacity').value) || 1,
        status: 'available'
    };

    try {
        if (id) {
            const idx = rooms.findIndex(r => r.id === id);
            if (idx !== -1) rooms[idx] = { ...rooms[idx], ...data };
            await apiPut(API.rooms, { ...data, id });
            showToast('Room updated');
        } else {
            if (rooms.some(r => r.number === data.number)) {
                showToast('Room number already exists', 'error');
                return;
            }
            const newRoom = { id: generateId(), ...data };
            rooms.push(newRoom);
            await apiPost(API.rooms, newRoom);
            showToast('Room added');
        }
    } catch (err) {
        console.error(err);
        showToast('Failed to save room', 'error');
        return;
    }

    closeModal('roomModal');
    renderRooms();
    renderDashboard();
    refreshCalendar();
}

async function deleteRoom() {
    const id = document.getElementById('roomId').value;
    if (!id) return;
    if (!confirm('Delete this room?')) return;
    rooms = rooms.filter(r => r.id !== id);
    guests = guests.filter(g => g.roomId !== id);
    try {
        await apiDelete(API.rooms, id);
    } catch (err) {
        console.error(err);
        showToast('Failed to delete room', 'error');
        return;
    }
    closeModal('roomModal');
    showToast('Room deleted');
    renderRooms();
    renderDashboard();
    refreshCalendar();
}

// =============================================
// GUESTS
// =============================================

function renderGuests() {
    const search = (document.getElementById('searchGuests')?.value || '').toLowerCase();
    let allGuests = guests.map(g => {
        const res = reservations.find(r => r.id === g.reservationId);
        const room = g.roomId ? rooms.find(r => r.id === g.roomId) : null;
        return { ...g, reservation: res, room };
    });

    if (search) {
        allGuests = allGuests.filter(g =>
            (g.firstName + ' ' + g.lastName).toLowerCase().includes(search) ||
            (g.reservation?.groupName || '').toLowerCase().includes(search) ||
            (g.room?.number || '').toLowerCase().includes(search)
        );
    }

    const tbody = document.getElementById('guestsTableBody');

    if (allGuests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state small">No guests found</td></tr>';
        return;
    }

    tbody.innerHTML = allGuests.map(g => {
        const statusLabel = g.reservation ? g.reservation.status.replace('-', ' ') : 'unknown';
        return `
            <tr>
                <td>
                    <div class="guest-name-cell">
                        <div class="guest-avatar">${getInitials(g.firstName + ' ' + g.lastName)}</div>
                        ${escapeHtml(g.firstName + ' ' + g.lastName)}
                    </div>
                </td>
                <td>${escapeHtml(g.reservation?.groupName || '—')}</td>
                <td>${g.room ? g.room.number : '—'}</td>
                <td>${g.reservation ? formatDateDisplay(g.reservation.checkin) : '—'}</td>
                <td>${g.reservation ? formatDateDisplay(g.reservation.checkout) : '—'}</td>
                <td><span class="status-badge ${g.reservation?.status || ''}">${statusLabel}</span></td>
                <td>
                    <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${g.reservationId}')">Remove</button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterGuests() {
    renderGuests();
}

function openAddGuestModal(reservationId) {
    document.getElementById('guestForm').reset();
    document.getElementById('guestId').value = '';
    document.getElementById('guestReservationId').value = reservationId;

    // Clear search fields and hidden code fields
    ['guestCitizenshipSearch', 'guestBirthCountrySearch', 'guestBirthComuneSearch', 'guestDocIssuedPlaceSearch',
     'guestCitizenship', 'guestBirthCountry', 'guestBirthComune', 'guestDocIssuedPlace'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Populate room dropdown
    const select = document.getElementById('guestRoom');
    select.innerHTML = '<option value="">Unassigned</option>';
    rooms.filter(r => r.status === 'available' || r.status === 'occupied').forEach(r => {
        select.innerHTML += `<option value="${r.id}">Room ${r.number} (${r.type})</option>`;
    });

    closeModal('guestsListModal');
    openModal('guestModal');
    loadAlloggiatiTables(); // load in background
}

function openEditGuestModal(guestId) {
    const g = guests.find(x => x.id === guestId);
    if (!g) return;

    document.getElementById('guestForm').reset();
    document.getElementById('guestId').value = g.id;
    document.getElementById('guestReservationId').value = g.reservationId;
    document.getElementById('guestFirstName').value = g.firstName || '';
    document.getElementById('guestLastName').value = g.lastName || '';
    document.getElementById('guestEmail').value = g.email || '';
    document.getElementById('guestPhone').value = g.phone || '';
    document.getElementById('guestDocType').value = g.docType || '';
    document.getElementById('guestDocNumber').value = g.docNumber || '';
    document.getElementById('guestNotes').value = g.notes || '';
    document.getElementById('guestSex').value = g.sex || '';
    document.getElementById('guestBirthDate').value = g.birthDate || '';
    document.getElementById('guestBirthComune').value = g.birthComune || '';
    document.getElementById('guestBirthProvince').value = g.birthProvince || '';
    document.getElementById('guestBirthCountry').value = g.birthCountry || '';
    document.getElementById('guestCitizenship').value = g.citizenship || '';
    document.getElementById('guestDocIssuedPlace').value = g.docIssuedPlace || '';
    document.getElementById('guestType').value = g.guestType || '16';

    // Populate search fields with resolved names
    const setSearch = (searchId, code, list) => {
        const el = document.getElementById(searchId);
        if (!el) return;
        const name = findLabelFromCode(list, code);
        el.value = name || code || '';
    };
    // Do this after tables load
    loadAlloggiatiTables().then(() => {
        setSearch('guestCitizenshipSearch', g.citizenship, alloggiatiStati);
        setSearch('guestBirthCountrySearch', g.birthCountry, alloggiatiStati);
        setSearch('guestBirthComuneSearch', g.birthComune, alloggiatiLuoghi);
        setSearch('guestDocIssuedPlaceSearch', g.docIssuedPlace, alloggiatiLuoghi);
    }).catch(() => {
        // If tables fail to load, show raw codes
        document.getElementById('guestCitizenshipSearch').value = g.citizenship || '';
        document.getElementById('guestBirthCountrySearch').value = g.birthCountry || '';
        document.getElementById('guestBirthComuneSearch').value = g.birthComune || '';
        document.getElementById('guestDocIssuedPlaceSearch').value = g.docIssuedPlace || '';
    });

    // Populate room dropdown
    const select = document.getElementById('guestRoom');
    select.innerHTML = '<option value="">Unassigned</option>';
    rooms.filter(r => r.status === 'available' || r.status === 'occupied').forEach(r => {
        select.innerHTML += `<option value="${r.id}" ${r.id === g.roomId ? 'selected' : ''}>Room ${r.number} (${r.type})</option>`;
    });

    closeModal('guestsListModal');
    openModal('guestModal');
}

async function saveGuest(e) {
    e.preventDefault();

    const id = document.getElementById('guestId').value;
    const data = {
        reservationId: document.getElementById('guestReservationId').value,
        firstName: document.getElementById('guestFirstName').value.trim(),
        lastName: document.getElementById('guestLastName').value.trim(),
        email: document.getElementById('guestEmail').value.trim(),
        phone: document.getElementById('guestPhone').value.trim(),
        docType: document.getElementById('guestDocType').value,
        docNumber: document.getElementById('guestDocNumber').value.trim(),
        roomId: document.getElementById('guestRoom').value,
        notes: document.getElementById('guestNotes').value.trim(),
        sex: document.getElementById('guestSex').value,
        birthDate: document.getElementById('guestBirthDate').value,
        birthComune: document.getElementById('guestBirthComune').value.trim(),
        birthProvince: document.getElementById('guestBirthProvince').value.trim().toUpperCase(),
        birthCountry: document.getElementById('guestBirthCountry').value.trim(),
        citizenship: document.getElementById('guestCitizenship').value.trim(),
        docIssuedPlace: document.getElementById('guestDocIssuedPlace').value.trim(),
        guestType: document.getElementById('guestType').value
    };

    try {
        if (id) {
            const idx = guests.findIndex(g => g.id === id);
            if (idx !== -1) guests[idx] = { ...guests[idx], ...data };
            await apiPut(API.guests, { ...data, id });
            showToast('Guest updated');
        } else {
            const newGuest = { id: generateId(), ...data };
            guests.push(newGuest);
            await apiPost(API.guests, newGuest);
            showToast('Guest added to group');
        }
    } catch (err) {
        console.error('Save guest error:', err);
        showToast('Failed to save guest: ' + err.message, 'error');
        return;
    }

    closeModal('guestModal');

    // Reopen guests list and refresh reservation detail
    openGuestsList(data.reservationId);
    openReservationDetail(data.reservationId);
    renderGuests();
}

async function deleteGuest(guestId, reservationId) {
    if (!confirm('Remove this guest?')) return;
    guests = guests.filter(g => g.id !== guestId);
    try {
        await apiDelete(API.guests, guestId);
    } catch (err) {
        console.error(err);
        showToast('Failed to delete guest', 'error');
        return;
    }
    showToast('Guest removed');

    // Refresh guests list and reservation detail
    openGuestsList(reservationId);
    openReservationDetail(reservationId);
    renderGuests();
}

// =============================================
// PLANNING BOARD CALENDAR (4-panel grid layout)
// =============================================
//
// Layout:  CORNER  | HEADER  (horizontal scroll synced)
//          --------+---------
//          ROOMS   | GRID    (master scroll, both axes)
//
// Only .p-grid-panel scrolls. JS syncs header (h) and rooms (v).

let PLANNER_DAY_WIDTH = 38;
const PLANNER_INITIAL_PAST = 180;
const PLANNER_INITIAL_FUTURE = 365;
const PLANNER_EXTEND_CHUNK = 90;
const PLANNER_EXTEND_THRESHOLD = 400;

let plannerStartDate = null;
let plannerTotalDays = 0;
let plannerGridEl = null;   // .p-grid-panel (master scroller)
let plannerHeaderEl = null; // .p-header-panel
let plannerRoomsEl = null;  // .p-rooms-panel
let plannerIsExtending = false;

function dateToDayIndex(d) {
    return Math.round((d - plannerStartDate) / 86400000);
}
function dayIndexToDate(i) {
    return new Date(plannerStartDate.getFullYear(), plannerStartDate.getMonth(), plannerStartDate.getDate() + i);
}

function getPlannerSortedRooms() {
    return [...rooms].sort((a, b) => a.floor !== b.floor ? a.floor - b.floor : parseInt(a.number) - parseInt(b.number));
}
function getPlannerFloors(sortedRooms) {
    const floors = {};
    sortedRooms.forEach(r => { (floors[r.floor] = floors[r.floor] || []).push(r); });
    return floors;
}
function getPlannerRoomBookings(sortedRooms) {
    const rb = {};
    sortedRooms.forEach(rm => { rb[rm.id] = []; });
    reservations.forEach(res => {
        if (res.status === 'cancelled') return;
        const si = dateToDayIndex(new Date(res.checkin + 'T00:00:00'));
        const ei = dateToDayIndex(new Date(res.checkout + 'T00:00:00'));
        if (ei <= 0 || si >= plannerTotalDays) return;
        const booking = { res, startIdx: Math.max(0, si), endIdx: Math.min(plannerTotalDays, ei) };

        // Use roomIds if available, fall back to guest assignments
        const assignedIds = res.roomIds && res.roomIds.length > 0
            ? res.roomIds
            : [...new Set(guests.filter(g => g.reservationId === res.id && g.roomId).map(g => g.roomId))];
        if (assignedIds.length > 0) {
            assignedIds.forEach(rid => { if (rb[rid]) rb[rid].push(booking); });
        } else {
            // No rooms assigned — place on first available room
            for (let i = 0; i < sortedRooms.length; i++) {
                const rm = sortedRooms[i];
                const conflict = rb[rm.id].some(b =>
                    b.startIdx < booking.endIdx && b.endIdx > booking.startIdx
                );
                if (!conflict) {
                    rb[rm.id].push(booking);
                    break;
                }
            }
        }
    });
    return rb;
}

function renderCalendar() {
    computeRoomStatuses();
    const board = document.getElementById('plannerBoard');
    const anchor = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
    plannerStartDate = new Date(anchor);
    plannerStartDate.setHours(0, 0, 0, 0);
    plannerStartDate.setDate(plannerStartDate.getDate() - PLANNER_INITIAL_PAST);
    plannerTotalDays = PLANNER_INITIAL_PAST + PLANNER_INITIAL_FUTURE;

    board.innerHTML = buildBoardHTML();

    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');

    plannerGridEl.addEventListener('scroll', onPlannerScroll);

    // Scroll to anchor date
    const anchorIdx = dateToDayIndex(anchor);
    plannerGridEl.scrollLeft = Math.max(0, anchorIdx * PLANNER_DAY_WIDTH - plannerGridEl.clientWidth / 3);

    initGridDrag();
    renderPlannerMonthBar();
}

// Rebuild board without resetting scroll position
function refreshCalendar() {
    if (!plannerGridEl) { renderCalendar(); return; }
    const slBefore = plannerGridEl.scrollLeft;
    const stBefore = plannerGridEl.scrollTop;

    const board = document.getElementById('plannerBoard');
    plannerGridEl.removeEventListener('scroll', onPlannerScroll);
    board.innerHTML = buildBoardHTML();
    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');
    plannerGridEl.addEventListener('scroll', onPlannerScroll);
    initGridDrag();

    plannerGridEl.scrollLeft = slBefore;
    plannerGridEl.scrollTop = stBefore;
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-slBefore}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-stBefore}px)`;
}

function buildBoardHTML() {
    const DW = PLANNER_DAY_WIDTH;
    const today = formatDate(new Date());
    const dayAbbr = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const monthFull = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    const sortedRooms = getPlannerSortedRooms();
    const floors = getPlannerFloors(sortedRooms);
    const rb = getPlannerRoomBookings(sortedRooms);
    const floorKeys = Object.keys(floors).sort((a, b) => a - b);
    const totalR = sortedRooms.length;

    // Month spans
    const monthSpans = [];
    let curMK = null;
    for (let i = 0; i < plannerTotalDays; i++) {
        const d = dayIndexToDate(i);
        const mk = d.getFullYear() + '-' + d.getMonth();
        if (mk !== curMK) { monthSpans.push({ label: monthFull[d.getMonth()] + ' ' + d.getFullYear(), count: 1 }); curMK = mk; }
        else monthSpans[monthSpans.length - 1].count++;
    }

    // Per-day occupancy
    const dayOcc = new Uint16Array(plannerTotalDays);
    sortedRooms.forEach(rm => {
        rb[rm.id].forEach(b => { for (let i = b.startIdx; i < b.endIdx; i++) dayOcc[i]++; });
    });

    // === 1. CORNER (top-left, fixed) ===
    let corner = '<div class="p-corner">';
    corner += '<div class="p-corner-cell months">&nbsp;</div>';
    corner += '<div class="p-corner-cell days">Room</div>';
    corner += '<div class="p-corner-cell stats">Available</div>';
    corner += '<div class="p-corner-cell stats">Occupied</div>';
    corner += '</div>';

    // === 2. HEADER (top-right, h-scroll synced) ===
    let header = '<div class="p-header-panel"><div class="p-header-inner">';

    // Months row
    header += '<div class="p-header-row months">';
    monthSpans.forEach(ms => {
        header += `<div class="p-month-label" style="width:${ms.count * DW}px">${ms.label}</div>`;
    });
    header += '</div>';

    // Days row
    header += '<div class="p-header-row days">';
    for (let i = 0; i < plannerTotalDays; i++) {
        const d = dayIndexToDate(i);
        const dow = d.getDay();
        let c = 'p-day-cell';
        if (formatDate(d) === today) c += ' today';
        else if (dow === 0 || dow === 6) c += ' weekend';
        header += `<div class="${c}" style="width:${DW}px"><span class="day-num">${d.getDate()}</span><span class="day-name">${dayAbbr[dow]}</span></div>`;
    }
    header += '</div>';

    // Available row
    header += '<div class="p-header-row stats">';
    for (let i = 0; i < plannerTotalDays; i++) {
        header += `<div class="p-stats-cell" style="width:${DW}px">${totalR - dayOcc[i]}</div>`;
    }
    header += '</div>';

    // Occupied row
    header += '<div class="p-header-row stats">';
    for (let i = 0; i < plannerTotalDays; i++) {
        const o = dayOcc[i];
        header += `<div class="p-stats-cell${o > 0 ? ' highlight' : ''}" style="width:${DW}px">${o}</div>`;
    }
    header += '</div>';

    header += '</div></div>';

    // === 3. ROOMS (bottom-left, v-scroll synced) ===
    let roomsPanel = '<div class="p-rooms-panel"><div class="p-rooms-inner">';
    floorKeys.forEach(floor => {
        const RH = PLANNER_ROW_HEIGHT;
        roomsPanel += `<div class="p-floor-left">Floor ${floor}</div>`;
        floors[floor].forEach(room => {
            roomsPanel += `<div class="p-room-left" style="height:${RH}px" onclick="openEditRoom('${room.id}')">
                <span class="planner-room-status ${room.status}"></span>
                <span class="planner-room-label">${room.number}</span>
                <span class="planner-room-type">${room.type.substring(0, 3)}</span>
            </div>`;
        });
    });
    roomsPanel += '</div></div>';

    // === 4. GRID BODY (bottom-right, master scroller) ===
    let grid = '<div class="p-grid-panel"><div class="p-grid-inner">';

    // Today line — use midnight to avoid timezone drift
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayIdx = dateToDayIndex(todayMidnight);
    if (todayIdx >= 0 && todayIdx < plannerTotalDays) {
        grid += `<div class="planner-today-line" style="left:${todayIdx * DW + DW / 2}px"></div>`;
    }

    floorKeys.forEach(floor => {
        // Floor header row
        grid += '<div class="p-grid-floor-row">';
        for (let i = 0; i < plannerTotalDays; i++) {
            grid += `<div class="p-floor-cell" style="width:${DW}px"></div>`;
        }
        grid += '</div>';

        // Room rows
        floors[floor].forEach(room => {
            grid += `<div class="p-grid-room-row" style="height:${PLANNER_ROW_HEIGHT}px" data-room-id="${room.id}">`;
            for (let i = 0; i < plannerTotalDays; i++) {
                const d = dayIndexToDate(i);
                const dow = d.getDay();
                let c = 'p-grid-cell';
                if (formatDate(d) === today) c += ' today-col';
                else if (dow === 0 || dow === 6) c += ' weekend';
                grid += `<div class="${c}" style="width:${DW}px" data-day="${i}"></div>`;
            }
            // Reservation bars — sort by start
            const bookings = (rb[room.id] || []).slice().sort((a, b) => a.startIdx - b.startIdx);
            bookings.forEach((b, bi) => {
                const ARROW = 10;
                const hasNext = bi < bookings.length - 1 && bookings[bi + 1].startIdx <= b.endIdx;
                const hasPrev = bi > 0 && bookings[bi - 1].endIdx >= b.startIdx;
                const left = b.startIdx * DW;
                // Extend arrow tip into next bar's notch
                const width = (b.endIdx - b.startIdx) * DW + (hasNext ? ARROW : 0);
                const label = escapeHtml(b.res.groupName);
                const cls = `planner-res-bar ${b.res.status}${hasPrev ? ' bar-has-prev' : ''}`;
                const nights = Math.max(1, b.endIdx - b.startIdx);
                const resGuests = guests.filter(g => g.reservationId === b.res.id).length;
                const statusLabel = b.res.status.charAt(0).toUpperCase() + b.res.status.slice(1);
                const expirationInfo = b.res.status === 'pending' && b.res.expiration ? ` · Expires ${formatDateDisplay(b.res.expiration)}` : '';
                const tipData = `${label}||${formatDateDisplay(b.res.checkin)} → ${formatDateDisplay(b.res.checkout)}||${nights} night${nights > 1 ? 's' : ''} · ${b.res.roomCount} room${b.res.roomCount !== 1 ? 's' : ''} · ${resGuests} guest${resGuests !== 1 ? 's' : ''}||${statusLabel}${expirationInfo}${b.res.price ? ' · €' + Number(b.res.price).toLocaleString() : ''}`;
                grid += `<div class="${cls}" style="left:${left}px;width:${width}px;z-index:${2 + bi}" onclick="openReservationDetail('${b.res.id}')" data-tip="${tipData}" onmouseenter="showBarTooltip(event)" onmouseleave="hideBarTooltip()"><span class="bar-label">${label}</span></div>`;
            });
            grid += '</div>';
        });
    });

    grid += '</div></div>';

    return corner + header + roomsPanel + grid;
}

// ---- Scroll sync + infinite extend ----

function onPlannerScroll() {
    // Sync header horizontal scroll via transform (more reliable than scrollLeft on overflow:hidden)
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;

    if (plannerIsExtending) return;

    const sl = plannerGridEl.scrollLeft;
    const maxScroll = plannerGridEl.scrollWidth - plannerGridEl.clientWidth;

    if (sl >= maxScroll - PLANNER_EXTEND_THRESHOLD) {
        plannerIsExtending = true;
        extendPlanner('right');
        plannerIsExtending = false;
    }
    if (sl <= PLANNER_EXTEND_THRESHOLD) {
        plannerIsExtending = true;
        extendPlanner('left');
        plannerIsExtending = false;
    }

    updateMonthBarFromScroll();
}

function extendPlanner(dir) {
    const chunk = PLANNER_EXTEND_CHUNK;
    const slBefore = plannerGridEl.scrollLeft;
    const stBefore = plannerGridEl.scrollTop;

    if (dir === 'left') {
        plannerStartDate = new Date(plannerStartDate);
        plannerStartDate.setDate(plannerStartDate.getDate() - chunk);
    }
    plannerTotalDays += chunk;

    const board = document.getElementById('plannerBoard');
    plannerGridEl.removeEventListener('scroll', onPlannerScroll);
    board.innerHTML = buildBoardHTML();
    plannerGridEl = board.querySelector('.p-grid-panel');
    plannerHeaderEl = board.querySelector('.p-header-panel');
    plannerRoomsEl = board.querySelector('.p-rooms-panel');
    plannerGridEl.addEventListener('scroll', onPlannerScroll);
    initGridDrag();

    plannerGridEl.scrollLeft = dir === 'left' ? slBefore + chunk * PLANNER_DAY_WIDTH : slBefore;
    plannerGridEl.scrollTop = stBefore;
    // Sync immediately via transform
    const headerInner = plannerHeaderEl.querySelector('.p-header-inner');
    const roomsInner = plannerRoomsEl.querySelector('.p-rooms-inner');
    if (headerInner) headerInner.style.transform = `translateX(${-plannerGridEl.scrollLeft}px)`;
    if (roomsInner) roomsInner.style.transform = `translateY(${-plannerGridEl.scrollTop}px)`;
}

// ---- Month bar ----

function updateMonthBarFromScroll() {
    if (!plannerGridEl) return;
    const centerX = plannerGridEl.scrollLeft + plannerGridEl.clientWidth / 2;
    const centerIdx = Math.floor(centerX / PLANNER_DAY_WIDTH);
    if (centerIdx < 0 || centerIdx >= plannerTotalDays) return;
    const centerDate = dayIndexToDate(centerIdx);
    const y = centerDate.getFullYear(), m = centerDate.getMonth();
    document.querySelectorAll('.planner-month-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.year === String(y) && btn.dataset.month === String(m));
    });
}

function renderPlannerMonthBar() {
    const bar = document.getElementById('plannerMonthBar');
    const mn = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    let html = '';
    for (let off = -12; off <= 12; off++) {
        const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
        const y = d.getFullYear(), m = d.getMonth();
        html += `<button class="planner-month-btn" data-year="${y}" data-month="${m}" onclick="jumpToMonth(${y},${m})">${mn[m]} ${String(y).substring(2)}</button>`;
    }
    bar.innerHTML = html;
    updateMonthBarFromScroll();
}

function jumpToMonth(year, month) {
    if (!plannerGridEl) return;
    const targetDate = new Date(year, month, 1);
    let idx = dateToDayIndex(targetDate);
    if (idx < 0 || idx >= plannerTotalDays) { calendarDate = targetDate; renderCalendar(); return; }
    plannerGridEl.scrollTo({ left: Math.max(0, idx * PLANNER_DAY_WIDTH - 100), behavior: 'smooth' });
}

function calendarPrev() {
    if (!plannerGridEl) return;
    plannerGridEl.scrollBy({ left: -30 * PLANNER_DAY_WIDTH, behavior: 'smooth' });
}
function calendarNext() {
    if (!plannerGridEl) return;
    plannerGridEl.scrollBy({ left: 30 * PLANNER_DAY_WIDTH, behavior: 'smooth' });
}
function calendarToday() {
    if (!plannerGridEl) { calendarDate = new Date(); renderCalendar(); return; }
    const idx = dateToDayIndex(new Date());
    if (idx < 0 || idx >= plannerTotalDays) { calendarDate = new Date(); renderCalendar(); return; }
    plannerGridEl.scrollTo({ left: Math.max(0, idx * PLANNER_DAY_WIDTH - plannerGridEl.clientWidth / 3), behavior: 'smooth' });
}

// =============================================
// DRAG-TO-SELECT ON GRID
// =============================================

let dragState = null; // { startDayIdx, currentDayIdx, overlay, rowTop, rowHeight }

function initGridDrag() {
    if (!plannerGridEl) return;
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    if (!gridInner) return;

    gridInner.addEventListener('mousedown', onGridDragStart);
    gridInner.addEventListener('touchstart', onGridDragStart, { passive: false });
}

function getDayIdxFromEvent(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = plannerGridEl.getBoundingClientRect();
    const x = clientX - rect.left + plannerGridEl.scrollLeft;
    return Math.floor(x / PLANNER_DAY_WIDTH);
}

function onGridDragStart(e) {
    // Ignore if clicking on a reservation bar
    const target = e.target.closest('.planner-res-bar');
    if (target) return;

    // Only left mouse button or touch
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.type === 'touchstart') e.preventDefault();

    const dayIdx = getDayIdxFromEvent(e);
    if (dayIdx < 0 || dayIdx >= plannerTotalDays) return;

    // Find which room row was clicked
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    const rowEl = (e.touches ? document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY) : e.target).closest('.p-grid-room-row');
    let rowTop = 0;
    let rowHeight = gridInner.offsetHeight;
    if (rowEl) {
        rowTop = rowEl.offsetTop;
        rowHeight = rowEl.offsetHeight;
    }

    // Create selection overlay
    const overlay = document.createElement('div');
    overlay.className = 'grid-drag-overlay';
    gridInner.appendChild(overlay);

    dragState = { startDayIdx: dayIdx, currentDayIdx: dayIdx, overlay, rowTop, rowHeight };
    updateDragOverlay();

    document.addEventListener('mousemove', onGridDragMove);
    document.addEventListener('mouseup', onGridDragEnd);
    document.addEventListener('touchmove', onGridDragMove, { passive: false });
    document.addEventListener('touchend', onGridDragEnd);
}

function onGridDragMove(e) {
    if (!dragState) return;
    if (e.type === 'touchmove') e.preventDefault();

    const dayIdx = getDayIdxFromEvent(e);
    if (dayIdx < 0 || dayIdx >= plannerTotalDays) return;

    dragState.currentDayIdx = dayIdx;
    updateDragOverlay();
}

function updateDragOverlay() {
    if (!dragState || !dragState.overlay) return;
    const DW = PLANNER_DAY_WIDTH;
    const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
    const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);
    const left = startIdx * DW;
    const width = (endIdx - startIdx + 1) * DW;

    const ov = dragState.overlay;
    ov.style.left = left + 'px';
    ov.style.top = dragState.rowTop + 'px';
    ov.style.width = width + 'px';
    ov.style.height = dragState.rowHeight + 'px';

    // Show date label
    const startDate = dayIndexToDate(startIdx);
    const endDate = dayIndexToDate(endIdx + 1); // checkout = day after last selected
    const nights = endIdx - startIdx + 1;
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fmt = d => `${d.getDate()} ${monthNames[d.getMonth()]}`;
    ov.setAttribute('data-label', `${fmt(startDate)} → ${fmt(endDate)} (${nights}n)`);
}

function onGridDragEnd() {
    document.removeEventListener('mousemove', onGridDragMove);
    document.removeEventListener('mouseup', onGridDragEnd);
    document.removeEventListener('touchmove', onGridDragMove);
    document.removeEventListener('touchend', onGridDragEnd);

    if (!dragState) return;

    const startIdx = Math.min(dragState.startDayIdx, dragState.currentDayIdx);
    const endIdx = Math.max(dragState.startDayIdx, dragState.currentDayIdx);

    // Remove overlay
    if (dragState.overlay && dragState.overlay.parentNode) {
        dragState.overlay.parentNode.removeChild(dragState.overlay);
    }
    dragState = null;

    // Allow single click (1 night) or drag

    const checkinDate = dayIndexToDate(startIdx);
    const checkoutDate = dayIndexToDate(endIdx + 1);

    // Open new reservation modal with dates pre-filled
    document.getElementById('reservationModalTitle').textContent = 'New Group Reservation';
    document.getElementById('reservationForm').reset();
    document.getElementById('resId').value = '';
    setDateFieldValue('resCheckin', formatDate(checkinDate));
    setDateFieldValue('resCheckout', formatDate(checkoutDate));
    setDateFieldValue('resExpiration', formatDate(addDays(new Date(), 7)));
    populateRoomChecklist([]);
    toggleExpirationField();
    openModal('reservationModal');
}

// =============================================
// SECURITY
// =============================================

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// =============================================
// THEME
// =============================================

function getTheme() {
    return localStorage.getItem('gs_theme') || 'auto';
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeToggle(theme);
}

function updateThemeToggle(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    btn.classList.toggle('is-dark', isDark);
}

function setTheme(theme) {
    localStorage.setItem('gs_theme', theme);
    applyTheme(theme);
    updateThemeButtons();
}

function updateThemeButtons() {
    const current = getTheme();
    document.querySelectorAll('.settings-toggle-btn[data-theme-val]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeVal === current);
    });
}

// Calendar size settings
let PLANNER_ROW_HEIGHT = parseInt(localStorage.getItem('gs_row_height')) || 34;

function updateCalendarSize() {
    const colW = document.getElementById('settingColWidth');
    const rowH = document.getElementById('settingRowHeight');
    if (!colW || !rowH) return;

    const cw = parseInt(colW.value);
    const rh = parseInt(rowH.value);

    document.getElementById('settingColWidthVal').textContent = cw + 'px';
    document.getElementById('settingRowHeightVal').textContent = rh + 'px';

    PLANNER_DAY_WIDTH = cw;
    PLANNER_ROW_HEIGHT = rh;

    localStorage.setItem('gs_col_width', cw);
    localStorage.setItem('gs_row_height', rh);

    renderCalendar();
}

function initSettingsModal() {
    const savedCW = parseInt(localStorage.getItem('gs_col_width')) || 38;
    const savedRH = parseInt(localStorage.getItem('gs_row_height')) || 34;

    PLANNER_DAY_WIDTH = savedCW;
    PLANNER_ROW_HEIGHT = savedRH;

    const colW = document.getElementById('settingColWidth');
    const rowH = document.getElementById('settingRowHeight');
    if (colW) { colW.value = savedCW; document.getElementById('settingColWidthVal').textContent = savedCW + 'px'; }
    if (rowH) { rowH.value = savedRH; document.getElementById('settingRowHeightVal').textContent = savedRH + 'px'; }

    updateThemeButtons();
}

// ---- CSV Import (Scidoo) ----

let csvParsedRows = [];
let csvHeaders = [];

const CSV_FIELDS = [
    { key: 'groupName', label: 'Group Name', required: true },
    { key: 'checkin', label: 'Check-in Date', required: true },
    { key: 'checkout', label: 'Check-out Date', required: true },
    { key: 'roomCount', label: 'Room Count', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'price', label: 'Price', required: false },
    { key: 'notes', label: 'Notes', required: false },
    { key: 'guestCount', label: 'Guest Count', required: false }
];

// Common Scidoo column name auto-mapping
const SCIDOO_MAP = {
    groupName: ['nome gruppo', 'group name', 'gruppo', 'nome', 'name', 'cliente', 'customer', 'ospite', 'guest', 'cognome', 'intestatario', 'prenotante', 'denominazione'],
    checkin: ['check-in', 'checkin', 'check in', 'data arrivo', 'arrivo', 'arrival', 'data_arrivo', 'dal', 'from', 'data inizio', 'ingresso'],
    checkout: ['check-out', 'checkout', 'check out', 'data partenza', 'partenza', 'departure', 'data_partenza', 'al', 'to', 'data fine', 'uscita'],
    roomCount: ['camere', 'rooms', 'room count', 'n. camere', 'num camere', 'numero camere', 'n camere', 'qty'],
    status: ['stato', 'status', 'state'],
    price: ['prezzo', 'price', 'totale', 'total', 'importo', 'amount', 'tariffa', 'rate'],
    notes: ['note', 'notes', 'commenti', 'comments', 'annotazioni', 'osservazioni'],
    guestCount: ['ospiti', 'guests', 'guest count', 'pax', 'persone', 'n. ospiti', 'num ospiti', 'adulti']
};

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect delimiter
    const firstLine = lines[0];
    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    let delim = ',';
    if (semicolons > commas && semicolons > tabs) delim = ';';
    else if (tabs > commas && tabs > semicolons) delim = '\t';

    function splitRow(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === delim && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = splitRow(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = splitRow(lines[i]);
        if (vals.every(v => !v)) continue; // skip empty rows
        const row = {};
        headers.forEach((h, j) => { row[h] = vals[j] || ''; });
        rows.push(row);
    }
    return { headers, rows };
}

function handleCsvFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    document.getElementById('csvFileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(ev) {
        const { headers, rows } = parseCsv(ev.target.result);
        if (headers.length === 0) {
            showToast('Could not parse CSV file', 'error');
            return;
        }
        csvHeaders = headers;
        csvParsedRows = rows;
        buildCsvMappingUI();
        closeModal('settingsModal');
        openModal('csvImportModal');
    };
    reader.readAsText(file);
}

function autoMapColumn(fieldKey) {
    const candidates = SCIDOO_MAP[fieldKey] || [];
    for (const candidate of candidates) {
        const match = csvHeaders.find(h => h.toLowerCase().trim() === candidate);
        if (match) return match;
    }
    // Partial match
    for (const candidate of candidates) {
        const match = csvHeaders.find(h => h.toLowerCase().trim().includes(candidate));
        if (match) return match;
    }
    return '';
}

function buildCsvMappingUI() {
    const grid = document.getElementById('csvMappingGrid');
    const options = csvHeaders.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');

    grid.innerHTML = CSV_FIELDS.map(f => {
        const autoVal = autoMapColumn(f.key);
        return `
            <label>${f.label}${f.required ? ' *' : ''}</label>
            <select id="csvMap_${f.key}" onchange="updateCsvPreview()">
                <option value="">— skip —</option>
                ${options}
            </select>`;
    }).join('');

    // Set auto-mapped values
    CSV_FIELDS.forEach(f => {
        const mapped = autoMapColumn(f.key);
        if (mapped) document.getElementById('csvMap_' + f.key).value = mapped;
    });

    updateCsvPreview();
}

function getCsvMapping() {
    const mapping = {};
    CSV_FIELDS.forEach(f => {
        const sel = document.getElementById('csvMap_' + f.key);
        if (sel && sel.value) mapping[f.key] = sel.value;
    });
    return mapping;
}

function parseImportDate(raw) {
    if (!raw) return null;
    raw = raw.trim();
    // Try ISO: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.substring(0, 10);
    // Try DD/MM/YYYY or DD-MM-YYYY
    let m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    // Try MM/DD/YYYY (if first number > 12, assume DD/MM)
    m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
        if (parseInt(m[1]) > 12) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
        return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    }
    // Fallback: try native Date parse
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return formatDate(d);
    return null;
}

function mapCsvRow(row, mapping) {
    const get = (key) => mapping[key] ? (row[mapping[key]] || '') : '';
    const checkin = parseImportDate(get('checkin'));
    const checkout = parseImportDate(get('checkout'));
    if (!checkin || !checkout) return null;

    const groupName = get('groupName') || 'Imported';
    const roomCount = parseInt(get('roomCount')) || 1;
    const price = parseFloat(get('price')) || 0;
    const notes = get('notes');
    const guestCount = parseInt(get('guestCount')) || 0;

    let status = (get('status') || 'confirmed').toLowerCase().trim();
    // Normalize Italian status terms
    if (['confermata', 'confermato', 'confirmed'].includes(status)) status = 'confirmed';
    else if (['in attesa', 'pending', 'opzione', 'tentativo'].includes(status)) status = 'pending';
    else if (['cancellata', 'cancellato', 'cancelled', 'canceled', 'annullata'].includes(status)) status = 'cancelled';
    else if (['checked-in', 'check-in', 'in casa', 'in house'].includes(status)) status = 'checked-in';
    else status = 'confirmed';

    return { groupName, checkin, checkout, roomCount, roomIds: [], status, price, notes, guestCount };
}

function updateCsvPreview() {
    const mapping = getCsvMapping();
    const preview = csvParsedRows.slice(0, 10).map(r => mapCsvRow(r, mapping)).filter(Boolean);

    document.getElementById('csvPreviewCount').textContent = `(${csvParsedRows.length} rows found, showing first ${Math.min(10, preview.length)})`;

    if (preview.length === 0) {
        document.getElementById('csvPreviewTable').innerHTML = '<p style="padding:12px;color:var(--text-secondary);font-size:13px">No valid rows. Check your column mapping.</p>';
        return;
    }

    let html = '<table><thead><tr><th>Group</th><th>Check-in</th><th>Check-out</th><th>Rooms</th><th>Status</th><th>Price</th></tr></thead><tbody>';
    preview.forEach(r => {
        html += `<tr>
            <td>${escapeHtml(r.groupName)}</td>
            <td>${r.checkin}</td>
            <td>${r.checkout}</td>
            <td>${r.roomCount}</td>
            <td>${r.status}</td>
            <td>${r.price ? '€' + r.price.toLocaleString() : '—'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    document.getElementById('csvPreviewTable').innerHTML = html;
}

async function executeCsvImport() {
    const mapping = getCsvMapping();
    if (!mapping.groupName || !mapping.checkin || !mapping.checkout) {
        showToast('Group Name, Check-in and Check-out mappings are required', 'error');
        return;
    }

    const toImport = csvParsedRows.map(r => mapCsvRow(r, mapping)).filter(Boolean);
    if (toImport.length === 0) {
        showToast('No valid rows to import', 'error');
        return;
    }

    if (!confirm(`Import ${toImport.length} reservations?`)) return;

    let success = 0;
    let errors = 0;

    for (const data of toImport) {
        const newRes = { id: generateId(), ...data, createdAt: new Date().toISOString() };
        try {
            await apiPost(API.reservations, newRes);
            reservations.push(newRes);
            success++;
        } catch (err) {
            console.error('Import error:', err);
            errors++;
        }
    }

    closeModal('csvImportModal');
    showToast(`Imported ${success} reservations${errors ? ', ' + errors + ' failed' : ''}`);
    renderDashboard();
    refreshCalendar();

    // Reset file input
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvFileName').textContent = '';
    csvParsedRows = [];
    csvHeaders = [];
}

// ---- Smart Guest File Import ----

const GUEST_IMPORT_FIELDS = [
    { key: 'lastName',       label: 'Last Name',       required: true },
    { key: 'firstName',      label: 'First Name',      required: true },
    { key: 'sex',            label: 'Sex' },
    { key: 'birthDate',      label: 'Date of Birth' },
    { key: 'birthComune',    label: 'Birth City' },
    { key: 'birthProvince',  label: 'Birth Province' },
    { key: 'birthCountry',   label: 'Birth Country' },
    { key: 'citizenship',    label: 'Citizenship' },
    { key: 'docType',        label: 'Document Type' },
    { key: 'docNumber',      label: 'Document Number' },
    { key: 'docIssuedPlace', label: 'Doc Issued Place' },
    { key: 'email',          label: 'Email' },
    { key: 'phone',          label: 'Phone' },
    { key: 'guestType',      label: 'Guest Type' },
];

const GUEST_COL_ALIASES = {
    lastName:       ['cognome', 'last name', 'surname', 'family name', 'last_name'],
    firstName:      ['nome', 'first name', 'given name', 'first_name'],
    sex:            ['sesso', 'sex', 'gender', 'genere'],
    birthDate:      ['data nascita', 'data di nascita', 'birth date', 'date of birth', 'nato il', 'dob', 'data_nascita', 'birth_date'],
    birthComune:    ['comune nascita', 'comune di nascita', 'birth city', 'birth place', 'luogo nascita', 'luogo di nascita', 'citta nascita'],
    birthProvince:  ['provincia nascita', 'prov nascita', 'birth province', 'provincia', 'sigla', 'prov'],
    birthCountry:   ['stato nascita', 'country of birth', 'birth country', 'nazione nascita', 'stato'],
    citizenship:    ['cittadinanza', 'citizenship', 'nazionalita', 'nationality'],
    docType:        ['tipo documento', 'document type', 'doc type', 'tipo doc', 'tipo_documento'],
    docNumber:      ['numero documento', 'document number', 'doc number', 'n. documento', 'num documento', 'numero_documento'],
    docIssuedPlace: ['luogo rilascio', 'issued place', 'rilasciato da', 'autorita', 'luogo_rilascio'],
    email:          ['email', 'e-mail', 'mail', 'posta elettronica'],
    phone:          ['telefono', 'phone', 'cellulare', 'mobile', 'tel'],
    guestType:      ['tipo alloggiato', 'guest type', 'tipo ospite', 'tipo'],
};

let guestFileParsedRows = [];
let guestFileXlsxHeaders = [];
let guestFileMode = ''; // 'xlsx' or 'text'

function openFileImportModal(reservationId) {
    document.getElementById('fileImportReservationId').value = reservationId;
    // Reset state
    guestFileParsedRows = [];
    guestFileXlsxHeaders = [];
    guestFileMode = '';
    document.getElementById('guestFileInput').value = '';
    const nameEl = document.getElementById('guestFileName');
    nameEl.style.display = 'none';
    nameEl.textContent = '';
    document.getElementById('textParseSection').style.display = 'none';
    document.getElementById('fileImportPreviewSection').style.display = 'none';
    document.getElementById('fileImportActions').style.display = 'none';
    document.getElementById('fileImportLoading').style.display = 'none';
    closeModal('guestsListModal');
    openModal('fileImportModal');

    // Setup drag & drop
    const drop = document.getElementById('fileImportDrop');
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('dragover'); };
    drop.ondragleave = () => drop.classList.remove('dragover');
    drop.ondrop = e => {
        e.preventDefault();
        drop.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) processGuestFile(file);
    };
}

function handleGuestFileImport(e) {
    const file = e.target.files[0];
    if (file) processGuestFile(file);
}

async function processGuestFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'xlsx', 'xls'].includes(ext)) {
        showToast('Unsupported file type. Use PDF, DOCX, or XLSX.', 'error');
        return;
    }

    // Show file name
    const nameEl = document.getElementById('guestFileName');
    nameEl.textContent = file.name;
    nameEl.style.display = 'inline';

    // Show loading
    document.getElementById('fileImportLoading').style.display = 'block';
    document.getElementById('textParseSection').style.display = 'none';
    document.getElementById('fileImportPreviewSection').style.display = 'none';
    document.getElementById('fileImportActions').style.display = 'none';

    try {
        if (ext === 'xlsx' || ext === 'xls') {
            await processXlsxFile(file);
        } else if (ext === 'docx') {
            await processDocxFile(file);
        } else if (ext === 'pdf') {
            await processPdfFile(file);
        }
    } catch (err) {
        console.error('File import error:', err);
        showToast('Failed to process file: ' + err.message, 'error');
    } finally {
        document.getElementById('fileImportLoading').style.display = 'none';
    }
}

// ---- XLSX Path ----

async function processXlsxFile(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // First try with headers (default behavior)
    let json = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (json.length === 0) { showToast('No data found in spreadsheet', 'error'); return; }

    // Check if the first row actually contains recognizable headers
    const headers = Object.keys(json[0]);
    let hasRecognizedHeaders = false;
    for (const field of GUEST_IMPORT_FIELDS) {
        const aliases = GUEST_COL_ALIASES[field.key] || [];
        for (const alias of aliases) {
            if (headers.some(h => h.toLowerCase().trim() === alias || h.toLowerCase().trim().includes(alias))) {
                hasRecognizedHeaders = true;
                break;
            }
        }
        if (hasRecognizedHeaders) break;
    }

    // If no headers recognized, re-read with generic column names so the first row becomes data
    if (!hasRecognizedHeaders) {
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
        if (rawRows.length === 0) { showToast('No data found in spreadsheet', 'error'); return; }
        const numCols = Math.max(...rawRows.map(r => r.length));
        const genHeaders = [];
        for (let i = 0; i < numCols; i++) genHeaders.push(`Column ${i + 1}`);
        json = rawRows.map(row => {
            const obj = {};
            genHeaders.forEach((h, i) => obj[h] = row[i] !== undefined ? row[i] : '');
            return obj;
        });
    }

    // Auto-detect column mapping (header aliases first, then content-based)
    guestFileXlsxHeaders = Object.keys(json[0]);
    guestFileParsedRows = json;
    const contentDetected = autoDetectColumnsByContent();
    const mapping = {};
    GUEST_IMPORT_FIELDS.forEach(f => {
        const mapped = autoMapGuestColumn(f.key) || contentDetected[f.key] || '';
        if (mapped) mapping[f.key] = mapped;
    });

    // Map all rows using auto-detected mapping and store as guest objects
    guestFileMode = 'text'; // treat as pre-mapped (no manual mapping needed)
    guestFileParsedRows = json.map(r => mapXlsxGuestRow(r, mapping)).filter(Boolean);

    if (guestFileParsedRows.length === 0) {
        showToast('Could not detect guest data in spreadsheet. Check that it contains names.', 'error');
        return;
    }

    document.getElementById('fileImportPreviewSection').style.display = 'block';
    document.getElementById('fileImportActions').style.display = 'flex';
    renderGuestFilePreviewTable(guestFileParsedRows);
}

function autoMapGuestColumn(fieldKey) {
    const candidates = GUEST_COL_ALIASES[fieldKey] || [];
    for (const c of candidates) {
        const match = guestFileXlsxHeaders.find(h => h.toLowerCase().trim() === c);
        if (match) return match;
    }
    for (const c of candidates) {
        const match = guestFileXlsxHeaders.find(h => h.toLowerCase().trim().includes(c));
        if (match) return match;
    }
    return '';
}

// Content-based column detection: analyze actual cell values to determine field type
function autoDetectColumnsByContent() {
    if (guestFileParsedRows.length === 0) return {};

    const sampleSize = Math.min(guestFileParsedRows.length, 30);
    const samples = guestFileParsedRows.slice(0, sampleSize);
    const headers = guestFileXlsxHeaders;

    // Collect non-empty values per column
    const colValues = {};
    for (const h of headers) {
        colValues[h] = samples.map(r => String(r[h] || '').trim()).filter(Boolean);
    }

    // Score each column for each field type
    const detectors = {
        sex: vals => {
            const sexVals = ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2'];
            const matches = vals.filter(v => sexVals.includes(v.toLowerCase()));
            return matches.length / Math.max(vals.length, 1);
        },
        birthDate: vals => {
            const datePattern = /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/;
            const matches = vals.filter(v => datePattern.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        email: vals => {
            const matches = vals.filter(v => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        phone: vals => {
            const matches = vals.filter(v => /^\+?[\d\s\-().]{7,}$/.test(v) && (v.replace(/\D/g, '').length >= 7));
            return matches.length / Math.max(vals.length, 1);
        },
        birthProvince: vals => {
            // Exactly 2 uppercase letters
            const matches = vals.filter(v => /^[A-Za-z]{2}$/.test(v));
            return vals.length > 0 && matches.length === vals.length ? 0.85 : matches.length / Math.max(vals.length, 1) * 0.7;
        },
        docType: vals => {
            const docCodes = ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'carta identita', "carta d'identita",
                "carta d'identità", 'passaporto', 'passport', 'patente', 'identity card', 'id card', 'ci', 'driving license'];
            const matches = vals.filter(v => docCodes.includes(v.toLowerCase()) || /^[A-Z]{5}$/.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        docNumber: vals => {
            // Mix of letters and digits, typical document number patterns
            const matches = vals.filter(v => /^[A-Za-z]{0,2}\d{5,}$/.test(v) || /^[A-Z]{2}\d+[A-Z]*$/i.test(v));
            return matches.length / Math.max(vals.length, 1);
        },
        guestType: vals => {
            const types = ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia',
                'membro gruppo', 'membro famiglia', 'single guest', 'group leader', 'family head'];
            const matches = vals.filter(v => types.includes(v.toLowerCase()));
            return matches.length / Math.max(vals.length, 1);
        },
        citizenship: vals => {
            // Country names or ISO codes (3 letters), heuristic: most values are the same (nationality tends to repeat)
            const unique = new Set(vals.map(v => v.toLowerCase()));
            const isCountryLike = vals.every(v => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v) && v.length <= 30);
            return isCountryLike && unique.size <= Math.ceil(vals.length * 0.5) ? 0.4 : 0;
        },
    };

    // Name detection: columns where values look like proper names (capitalized words, no numbers/special chars)
    function looksLikeName(vals) {
        const namePattern = /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/;
        const upperNamePattern = /^[A-ZÀ-ÿ'\s]+$/; // ALL CAPS names
        const matches = vals.filter(v => namePattern.test(v) || (upperNamePattern.test(v) && v.length >= 2 && v.length <= 40));
        return matches.length / Math.max(vals.length, 1);
    }

    // Score every column for every field
    const scores = {}; // { fieldKey: { header: score, ... } }
    const assigned = new Set(); // headers already assigned

    // First pass: detect clear-signal fields (email, phone, sex, dates, docType, etc.)
    for (const [field, detector] of Object.entries(detectors)) {
        scores[field] = {};
        for (const h of headers) {
            scores[field][h] = detector(colValues[h]);
        }
    }

    // Assign fields by confidence, highest first
    const result = {};
    const fieldOrder = ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince', 'docNumber', 'citizenship'];

    for (const field of fieldOrder) {
        let bestHeader = '';
        let bestScore = 0.5; // minimum threshold
        for (const h of headers) {
            if (assigned.has(h)) continue;
            const s = scores[field]?.[h] || 0;
            if (s > bestScore) { bestScore = s; bestHeader = h; }
        }
        if (bestHeader) {
            result[field] = bestHeader;
            assigned.add(bestHeader);
        }
    }

    // Name columns: find columns that look like person names
    const nameCandidates = [];
    for (const h of headers) {
        if (assigned.has(h)) continue;
        const score = looksLikeName(colValues[h]);
        if (score >= 0.5) nameCandidates.push({ header: h, score });
    }
    nameCandidates.sort((a, b) => b.score - a.score);

    // Heuristic for lastName vs firstName: typically last name comes first in Italian documents,
    // or the header with shorter average values is the last name
    if (nameCandidates.length >= 2 && !result.lastName && !result.firstName) {
        const c1 = nameCandidates[0].header;
        const c2 = nameCandidates[1].header;
        const idx1 = headers.indexOf(c1);
        const idx2 = headers.indexOf(c2);
        // In Italian convention: cognome (lastName) before nome (firstName)
        if (idx1 < idx2) {
            result.lastName = c1; result.firstName = c2;
        } else {
            result.lastName = c2; result.firstName = c1;
        }
        assigned.add(c1); assigned.add(c2);
    } else if (nameCandidates.length === 1) {
        if (!result.lastName) { result.lastName = nameCandidates[0].header; assigned.add(nameCandidates[0].header); }
        else if (!result.firstName) { result.firstName = nameCandidates[0].header; assigned.add(nameCandidates[0].header); }
    }

    // Remaining location-like columns (birthComune, birthCountry, docIssuedPlace)
    const locationFields = ['birthComune', 'birthCountry', 'docIssuedPlace'].filter(f => !result[f]);
    const locationCandidates = [];
    for (const h of headers) {
        if (assigned.has(h)) continue;
        const vals = colValues[h];
        const isTextLike = vals.every(v => /^[A-Za-zÀ-ÿ\s'-]{2,}$/.test(v));
        if (isTextLike && vals.length > 0) locationCandidates.push(h);
    }

    // Assign location columns by position (birthComune typically comes before birthCountry)
    for (let i = 0; i < Math.min(locationFields.length, locationCandidates.length); i++) {
        result[locationFields[i]] = locationCandidates[i];
        assigned.add(locationCandidates[i]);
    }

    return result;
}


function mapXlsxGuestRow(row, mapping) {
    const get = key => mapping[key] ? (String(row[mapping[key]] || '')).trim() : '';
    const firstName = get('firstName');
    const lastName = get('lastName');
    if (!firstName && !lastName) return null;

    return {
        firstName,
        lastName,
        sex: normalizeSex(get('sex')),
        birthDate: parseImportDate(get('birthDate')) || '',
        birthComune: get('birthComune'),
        birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
        birthCountry: get('birthCountry'),
        citizenship: get('citizenship'),
        docType: normalizeDocType(get('docType')),
        docNumber: get('docNumber'),
        docIssuedPlace: get('docIssuedPlace'),
        email: get('email'),
        phone: get('phone'),
        guestType: normalizeGuestType(get('guestType')),
        notes: '',
    };
}

// ---- PDF Path ----

async function processPdfFile(file) {
    if (!window.pdfjsLib) {
        showToast('PDF library not loaded yet. Please try again.', 'error');
        return;
    }
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    if (fullText.trim().length < 5) {
        showToast('Could not extract text from PDF. It may be a scanned image.', 'error');
        return;
    }
    processExtractedText(fullText);
}

// ---- DOCX Path ----

async function processDocxFile(file) {
    if (!window.mammoth) {
        showToast('Word library not loaded yet. Please try again.', 'error');
        return;
    }
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    if (result.value.trim().length < 5) {
        showToast('Could not extract text from document.', 'error');
        return;
    }
    processExtractedText(result.value);
}

// ---- Smart Text Parser (PDF/DOCX) ----

function processExtractedText(text) {
    guestFileMode = 'text';

    // Show the raw text
    document.getElementById('extractedTextPreview').textContent = text;
    document.getElementById('textParseSection').style.display = 'block';

    // Parse into guest records
    guestFileParsedRows = parseGuestText(text);

    if (guestFileParsedRows.length === 0) {
        showToast('Could not detect any guest data. Check the extracted text.', 'error');
    }

    document.getElementById('fileImportPreviewSection').style.display = 'block';
    document.getElementById('fileImportActions').style.display = 'flex';
    renderGuestFilePreview();
}

const KEY_VALUE_PATTERNS = {
    lastName:       /(?:cognome|last\s*name|surname|family\s*name)\s*[:=\-–]\s*(.+)/i,
    firstName:      /(?:nome(?!\s*gruppo)|first\s*name|given\s*name)\s*[:=\-–]\s*(.+)/i,
    sex:            /(?:sesso|sex|gender|genere)\s*[:=\-–]\s*(.+)/i,
    birthDate:      /(?:data\s*(?:di\s*)?nascita|birth\s*date|date\s*of\s*birth|nato\s*(?:il|a)|dob)\s*[:=\-–]\s*(.+)/i,
    birthComune:    /(?:(?:comune|luogo|citta|citt[aà])\s*(?:di\s*)?nascita|birth\s*(?:city|place))\s*[:=\-–]\s*(.+)/i,
    birthProvince:  /(?:provincia\s*(?:di\s*)?nascita|prov(?:incia)?(?:\s*nascita)?)\s*[:=\-–]\s*([A-Z]{2})/i,
    birthCountry:   /(?:stato\s*(?:di\s*)?nascita|(?:birth|country\s*of)\s*(?:country|birth)|nazione\s*(?:di\s*)?nascita)\s*[:=\-–]\s*(.+)/i,
    citizenship:    /(?:cittadinanza|citizenship|nazionalit[aà]|nationality)\s*[:=\-–]\s*(.+)/i,
    docType:        /(?:tipo\s*(?:di\s*)?documento|document\s*type|doc(?:ument)?\s*type)\s*[:=\-–]\s*(.+)/i,
    docNumber:      /(?:n(?:umero)?\.?\s*(?:di\s*)?documento|document\s*(?:number|no)|doc\s*n(?:umber)?)\s*[:=\-–]\s*(.+)/i,
    docIssuedPlace: /(?:luogo\s*(?:di\s*)?rilascio|(?:issued|released)\s*(?:by|place|at)|rilasciato\s*(?:da|a))\s*[:=\-–]\s*(.+)/i,
    email:          /(?:email|e-mail|mail|posta\s*elettronica)\s*[:=\-–]\s*(\S+)/i,
    phone:          /(?:telefono|phone|cellulare|mobile|tel)\s*[:=\-–]\s*([\d\s\+\-\.()]+)/i,
    guestType:      /(?:tipo\s*(?:di\s*)?(?:alloggiato|ospite)|guest\s*type)\s*[:=\-–]\s*(.+)/i,
};

function parseGuestText(text) {
    // First try: detect if text looks like a table (tab or multi-space separated)
    const tableGuests = tryParseAsTable(text);
    if (tableGuests.length > 0) return tableGuests;

    // Second try: key-value pairs, split into guest blocks
    const blocks = splitIntoGuestBlocks(text);
    const guests = [];

    for (const block of blocks) {
        const guest = parseGuestBlock(block);
        if (guest.firstName || guest.lastName) {
            guests.push(guest);
        }
    }

    // If no key-value matches, try line-by-line name detection
    if (guests.length === 0) {
        return tryFallbackNameDetection(text);
    }

    return guests;
}

function tryParseAsTable(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    // Detect delimiter
    let delimiter = null;
    const firstLine = lines[0];
    if ((firstLine.match(/\t/g) || []).length >= 2) delimiter = '\t';
    else if ((firstLine.match(/\s{2,}/g) || []).length >= 2) delimiter = /\s{2,}/;
    if (!delimiter) return [];

    const firstCols = firstLine.split(delimiter).map(h => h.trim()).filter(Boolean);
    if (firstCols.length < 2) return [];

    // Try to auto-map using first row as headers
    const mapping = {};
    for (const field of GUEST_IMPORT_FIELDS) {
        const aliases = GUEST_COL_ALIASES[field.key] || [];
        for (const alias of aliases) {
            const idx = firstCols.findIndex(h => h.toLowerCase().includes(alias));
            if (idx !== -1) { mapping[field.key] = idx; break; }
        }
    }

    let dataStartIdx = 1;
    const headersMapped = !!(mapping.firstName || mapping.lastName);

    // If headers didn't match, try content-based detection (first row is data, not headers)
    if (!headersMapped) {
        dataStartIdx = 0; // first row is data too
        const sampleRows = lines.slice(0, Math.min(lines.length, 20)).map(l => l.split(delimiter).map(c => c.trim()));
        const numCols = Math.max(...sampleRows.map(r => r.length));

        // Collect values per column index
        const colVals = [];
        for (let c = 0; c < numCols; c++) {
            colVals[c] = sampleRows.map(r => r[c] || '').filter(Boolean);
        }

        const assigned = new Set();

        // Detect specific fields by content
        const colDetectors = {
            sex: vals => { const sexVals = ['m', 'f', 'male', 'female', 'maschile', 'femminile', 'maschio', 'femmina', '1', '2']; return vals.filter(v => sexVals.includes(v.toLowerCase())).length / Math.max(vals.length, 1); },
            birthDate: vals => { return vals.filter(v => /^(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\d{4}[\/.\\-]\d{1,2}[\/.\\-]\d{1,2})$/.test(v)).length / Math.max(vals.length, 1); },
            email: vals => vals.filter(v => /^[\w.+-]+@[\w.-]+\.\w{2,}$/.test(v)).length / Math.max(vals.length, 1),
            phone: vals => vals.filter(v => /^\+?[\d\s\-().]{7,}$/.test(v) && v.replace(/\D/g, '').length >= 7).length / Math.max(vals.length, 1),
            birthProvince: vals => vals.length > 0 && vals.filter(v => /^[A-Za-z]{2}$/.test(v)).length === vals.length ? 0.85 : 0,
            docType: vals => { const codes = ['ident', 'pasor', 'paten', 'pnauz', 'pordf', 'passaporto', 'passport', 'patente', 'carta identita', "carta d'identita"]; return vals.filter(v => codes.includes(v.toLowerCase()) || /^[A-Z]{5}$/.test(v)).length / Math.max(vals.length, 1); },
            guestType: vals => { const types = ['16', '17', '18', '19', '20', 'ospite singolo', 'capogruppo', 'capofamiglia']; return vals.filter(v => types.includes(v.toLowerCase())).length / Math.max(vals.length, 1); },
        };

        const fieldOrder = ['email', 'phone', 'sex', 'docType', 'guestType', 'birthDate', 'birthProvince'];
        for (const field of fieldOrder) {
            let bestIdx = -1, bestScore = 0.5;
            for (let c = 0; c < numCols; c++) {
                if (assigned.has(c)) continue;
                const s = colDetectors[field]?.(colVals[c]) || 0;
                if (s > bestScore) { bestScore = s; bestIdx = c; }
            }
            if (bestIdx >= 0) { mapping[field] = bestIdx; assigned.add(bestIdx); }
        }

        // Detect name columns
        const nameLike = v => /^[A-ZÀ-ÿ][a-zà-ÿ']+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ']+)*$/.test(v) || /^[A-ZÀ-ÿ'\s]{2,}$/.test(v);
        const nameCandidates = [];
        for (let c = 0; c < numCols; c++) {
            if (assigned.has(c)) continue;
            const score = colVals[c].filter(nameLike).length / Math.max(colVals[c].length, 1);
            if (score >= 0.5) nameCandidates.push({ idx: c, score });
        }
        nameCandidates.sort((a, b) => b.score - a.score);
        if (nameCandidates.length >= 2) {
            const [a, b] = nameCandidates[0].idx < nameCandidates[1].idx
                ? [nameCandidates[0], nameCandidates[1]]
                : [nameCandidates[1], nameCandidates[0]];
            mapping.lastName = a.idx; mapping.firstName = b.idx;
            assigned.add(a.idx); assigned.add(b.idx);
        } else if (nameCandidates.length === 1) {
            mapping.lastName = nameCandidates[0].idx;
            assigned.add(nameCandidates[0].idx);
        }
    }

    if (!mapping.firstName && !mapping.lastName) return [];

    const results = [];
    for (let i = dataStartIdx; i < lines.length; i++) {
        const cols = lines[i].split(delimiter).map(c => c.trim());
        const get = key => mapping[key] !== undefined ? (cols[mapping[key]] || '') : '';
        const firstName = get('firstName');
        const lastName = get('lastName');
        if (!firstName && !lastName) continue;
        results.push({
            firstName, lastName,
            sex: normalizeSex(get('sex')),
            birthDate: parseImportDate(get('birthDate')) || '',
            birthComune: get('birthComune'),
            birthProvince: get('birthProvince').toUpperCase().substring(0, 2),
            birthCountry: get('birthCountry'),
            citizenship: get('citizenship'),
            docType: normalizeDocType(get('docType')),
            docNumber: get('docNumber'),
            docIssuedPlace: get('docIssuedPlace'),
            email: get('email'),
            phone: get('phone'),
            guestType: normalizeGuestType(get('guestType')),
            notes: '',
        });
    }
    return results;
}

function splitIntoGuestBlocks(text) {
    // Split on patterns like "Guest 1", "Ospite 2", "--- Guest ---", numbered lists, or repeated label patterns
    const splitters = /(?:^|\n)\s*(?:(?:guest|ospite|alloggiato|persona)\s*(?:#|n[°.]?)?\s*\d+|(?:---+|===+)\s*|\d+\s*[.)]\s*(?:guest|ospite|nome|cognome))/gi;
    const parts = text.split(splitters).filter(s => s.trim().length > 10);

    if (parts.length > 1) return parts;

    // Try splitting by repeated "Cognome:" or "Last Name:" patterns
    const labelSplit = text.split(/(?=(?:cognome|last\s*name|surname)\s*[:=\-–])/gi).filter(s => s.trim().length > 5);
    if (labelSplit.length > 1) return labelSplit;

    // No clear boundaries — treat the whole text as one block
    return [text];
}

function parseGuestBlock(block) {
    const guest = {
        firstName: '', lastName: '', sex: '', birthDate: '', birthComune: '',
        birthProvince: '', birthCountry: '', citizenship: '', docType: '',
        docNumber: '', docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
    };

    const lines = block.split(/\r?\n/);

    for (const line of lines) {
        for (const [field, regex] of Object.entries(KEY_VALUE_PATTERNS)) {
            if (guest[field]) continue; // already matched
            const m = line.match(regex);
            if (m) {
                let val = m[1].trim().replace(/[;,]$/, '').trim();
                guest[field] = val;
            }
        }
    }

    // Standalone pattern fallbacks
    if (!guest.email) {
        const em = block.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/);
        if (em) guest.email = em[0];
    }
    if (!guest.phone) {
        const ph = block.match(/(?<![@\w])(\+?\d[\d\s\-().]{7,}\d)(?!\w)/);
        if (ph) guest.phone = ph[1].trim();
    }

    // Normalize
    guest.sex = normalizeSex(guest.sex);
    guest.birthDate = parseImportDate(guest.birthDate) || '';
    guest.docType = normalizeDocType(guest.docType);
    guest.guestType = normalizeGuestType(guest.guestType);
    guest.birthProvince = guest.birthProvince.toUpperCase().substring(0, 2);

    return guest;
}

function tryFallbackNameDetection(text) {
    // Last resort: look for lines that look like full names (two+ capitalized words, no special chars)
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const namePattern = /^([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)\s+([A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+(?:\s+[A-ZÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÑÇ][a-zàáâãäåèéêëìíîïòóôõöùúûüñç]+)?)$/;
    const guests = [];
    for (const line of lines) {
        const m = line.match(namePattern);
        if (m) {
            guests.push({
                firstName: m[1], lastName: m[2],
                sex: '', birthDate: '', birthComune: '', birthProvince: '',
                birthCountry: '', citizenship: '', docType: '', docNumber: '',
                docIssuedPlace: '', email: '', phone: '', guestType: '', notes: ''
            });
        }
    }
    return guests;
}

// ---- Normalizers ----

function normalizeSex(val) {
    if (!val) return '';
    const v = val.toLowerCase().trim();
    if (['m', 'male', 'maschile', 'maschio', '1'].includes(v)) return '1';
    if (['f', 'female', 'femminile', 'femmina', '2'].includes(v)) return '2';
    return val;
}

function normalizeDocType(val) {
    if (!val) return '';
    const v = val.toLowerCase().trim();
    if (['ident', 'carta identita', "carta d'identita", "carta d'identità", 'carta identità', 'identity card', 'id card', 'ci'].includes(v)) return 'IDENT';
    if (['pasor', 'passaporto', 'passport'].includes(v)) return 'PASOR';
    if (['paten', 'patente', 'driving license', "driver's license", 'patente guida'].includes(v)) return 'PATEN';
    if (['pnauz', 'patente nautica'].includes(v)) return 'PNAUZ';
    if (['pordf', "porto d'armi", 'porto armi'].includes(v)) return 'PORDF';
    // If it's already a valid code, return as-is
    if (['IDENT', 'PASOR', 'PATEN', 'PNAUZ', 'PORDF'].includes(val.trim().toUpperCase())) return val.trim().toUpperCase();
    return val;
}

function normalizeGuestType(val) {
    if (!val) return '16'; // default: Ospite Singolo
    const v = val.toLowerCase().trim();
    if (['16', 'ospite singolo', 'single guest', 'singolo'].includes(v)) return '16';
    if (['17', 'capogruppo', 'group leader', 'capo gruppo'].includes(v)) return '17';
    if (['18', 'membro gruppo', 'group member', 'membro'].includes(v)) return '18';
    if (['19', 'capofamiglia', 'family head', 'capo famiglia'].includes(v)) return '19';
    if (['20', 'membro famiglia', 'family member'].includes(v)) return '20';
    return '16';
}

// ---- Preview & Import ----

function renderGuestFilePreview() {
    if (guestFileMode === 'text') {
        renderGuestFilePreviewTable(guestFileParsedRows);
    }
}

function renderGuestFilePreviewTable(rows) {
    const count = rows.length;
    document.getElementById('guestFilePreviewCount').textContent = `${count} guest(s) found`;

    if (count === 0) {
        document.getElementById('guestFilePreviewTable').innerHTML = '<p style="padding:16px;color:var(--text-secondary);font-size:13px">No guests detected. Try a different file or check the extracted text above.</p>';
        return;
    }

    const showCols = [
        { key: 'lastName', label: 'Last Name' },
        { key: 'firstName', label: 'First Name' },
        { key: 'sex', label: 'Sex' },
        { key: 'birthDate', label: 'Birth Date' },
        { key: 'docType', label: 'Doc Type' },
        { key: 'docNumber', label: 'Doc No.' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
    ];

    const preview = rows.slice(0, 20);
    let html = '<table><thead><tr>';
    showCols.forEach(c => { html += `<th>${c.label}</th>`; });
    html += '</tr></thead><tbody>';
    preview.forEach(r => {
        html += '<tr>';
        showCols.forEach(c => {
            const val = r[c.key] || '';
            const missing = c.key === 'lastName' || c.key === 'firstName' ? !val : false;
            html += `<td${missing ? ' style="color:var(--red);font-style:italic"' : ''}>${val ? escapeHtml(val) : (missing ? 'missing' : '—')}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    if (count > 20) html += `<p style="padding:8px 12px;font-size:12px;color:var(--text-secondary)">Showing first 20 of ${count}</p>`;
    document.getElementById('guestFilePreviewTable').innerHTML = html;
}

async function executeGuestFileImport() {
    const reservationId = document.getElementById('fileImportReservationId').value;
    let toImport;

    toImport = guestFileParsedRows.filter(g => g.firstName || g.lastName);

    if (toImport.length === 0) {
        showToast('No valid guests to import', 'error');
        return;
    }

    if (!confirm(`Import ${toImport.length} guest(s) into this reservation?`)) return;

    let success = 0, errors = 0;

    for (const data of toImport) {
        const newGuest = {
            id: generateId(),
            reservationId,
            ...data,
            roomId: '',
        };
        try {
            await apiPost(API.guests, newGuest);
            guests.push(newGuest);
            success++;
        } catch (err) {
            console.error('Guest import error:', err);
            errors++;
        }
    }

    closeModal('fileImportModal');
    showToast(`Imported ${success} guest(s)${errors ? ', ' + errors + ' failed' : ''}`);

    // Refresh guests list
    openGuestsList(reservationId);
    renderDashboard();
}

// ---- Bar tooltip (body-appended to avoid overflow clipping) ----

let barTipEl = null;

function showBarTooltip(e) {
    const bar = e.currentTarget;
    const raw = bar.getAttribute('data-tip');
    if (!raw) return;

    if (!barTipEl) {
        barTipEl = document.createElement('div');
        barTipEl.className = 'bar-tooltip';
        document.body.appendChild(barTipEl);
    }

    const lines = raw.split('||');
    barTipEl.innerHTML = `<strong>${lines[0]}</strong>` +
        lines.slice(1).map(l => `<div class="bar-tooltip-row">${l}</div>`).join('');
    barTipEl.style.display = 'block';

    const rect = bar.getBoundingClientRect();
    let tipLeft = rect.left + rect.width / 2;
    let tipTop = rect.top - 8;

    barTipEl.style.left = tipLeft + 'px';
    barTipEl.style.top = tipTop + 'px';
    barTipEl.style.transform = 'translate(-50%, -100%)';

    // Keep within viewport
    requestAnimationFrame(() => {
        const tr = barTipEl.getBoundingClientRect();
        if (tr.left < 8) barTipEl.style.left = (8 + tr.width / 2) + 'px';
        if (tr.right > window.innerWidth - 8) barTipEl.style.left = (window.innerWidth - 8 - tr.width / 2) + 'px';
    });
}

function hideBarTooltip() {
    if (barTipEl) barTipEl.style.display = 'none';
}

// Apply saved theme immediately
applyTheme(getTheme());

// =============================================
// INIT
// =============================================

(async function init() {
    initSettingsModal();
    await loadAllData();
    renderDashboard();
    renderCalendar();
})();
