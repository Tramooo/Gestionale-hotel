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
    } catch (err) {
        console.error('Failed to load data from database:', err);
        showToast('Failed to connect to database', 'error');
    }
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
    // Stats
    const activeGroups = reservations.filter(r => r.status === 'confirmed' || r.status === 'checked-in');
    const totalGuests = activeGroups.reduce((sum, r) => sum + (r.guestCount || 0), 0);
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const monthRevenue = reservations
        .filter(r => {
            const d = new Date(r.checkin);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
        .reduce((sum, r) => sum + (r.price || 0), 0);

    document.getElementById('stat-active-groups').textContent = activeGroups.length;
    document.getElementById('stat-total-guests').textContent = totalGuests;
    document.getElementById('stat-rooms-occupied').textContent = occupiedRooms + '/' + rooms.length;
    document.getElementById('stat-revenue').textContent = '\u20AC' + monthRevenue.toLocaleString();

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
    const count = document.querySelectorAll('#resRoomChecklist input[type="checkbox"]:checked').length;
    const el = document.getElementById('resRoomCount');
    if (el) el.textContent = `${count} room${count !== 1 ? 's' : ''} selected`;
}

function getSelectedRoomIds() {
    return [...document.querySelectorAll('#resRoomChecklist input[type="checkbox"]:checked')].map(c => c.value);
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

    const resGuests = guests.filter(g => g.reservationId === id);
    const nights = nightsBetween(r.checkin, r.checkout);
    const statusLabel = r.status.replace('-', ' ');

    const body = document.getElementById('reservationDetailBody');
    body.innerHTML = `
        <div class="detail-header">
            <span class="status-badge ${r.status}">${statusLabel}</span>
            <div class="detail-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditReservation('${r.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="openAssignRooms('${r.id}')">Assign Rooms</button>
                <button class="btn btn-secondary btn-sm" onclick="openRoomAssignment('${r.id}')">Room Planner</button>
                <button class="btn btn-danger btn-sm" onclick="deleteReservation('${r.id}')">Delete</button>
            </div>
        </div>

        <div class="detail-grid">
            <div class="detail-item">
                <span class="label">Check-in</span>
                <span class="value">${formatDateDisplay(r.checkin)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Check-out</span>
                <span class="value">${formatDateDisplay(r.checkout)}</span>
            </div>
            <div class="detail-item">
                <span class="label">Rooms / Nights</span>
                <span class="value">${r.roomCount} rooms &middot; ${nights} nights</span>
            </div>
            <div class="detail-item">
                <span class="label">Total Price</span>
                <span class="value">&euro;${(r.price || 0).toLocaleString()}</span>
            </div>
            ${r.status === 'pending' && r.expiration ? `<div class="detail-item">
                <span class="label">Expires</span>
                <span class="value">${formatDateDisplay(r.expiration)}</span>
            </div>` : ''}
        </div>

        ${r.notes ? `<div class="detail-item" style="margin-bottom:16px"><span class="label">Notes</span><span class="value">${escapeHtml(r.notes)}</span></div>` : ''}

        <div class="detail-section">
            <h3>
                Guests (${resGuests.length})
                <button class="btn btn-sm btn-primary" onclick="openAddGuestModal('${r.id}')">Add Guest</button>
            </h3>
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
                            <button class="btn btn-ghost btn-sm" onclick="deleteGuest('${g.id}', '${r.id}')">Remove</button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <div class="detail-section" style="margin-top:16px">
            <h3>Schedine Alloggiati</h3>
            <div id="alloggiatiPanel">
                <p style="color:var(--text-secondary);margin-bottom:12px">
                    Send guest registration forms to the Italian police (Alloggiati Web).
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-sm btn-secondary" onclick="alloggiatiPreview('${r.id}')">Preview Records</button>
                    <button class="btn btn-sm btn-secondary" onclick="alloggiatiTest('${r.id}')">Test</button>
                    <button class="btn btn-sm btn-primary" onclick="alloggiatiSend('${r.id}')">Send to Police</button>
                </div>
                <div id="alloggiatiResults" style="margin-top:12px"></div>
            </div>
        </div>
    `;

    openModal('reservationDetailModal');
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

    closeModal('reservationDetailModal');
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

    closeModal('reservationDetailModal');
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

    // Reopen reservation detail
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

    // Refresh detail if open
    const detailModal = document.getElementById('reservationDetailModal');
    if (detailModal.classList.contains('open')) {
        openReservationDetail(reservationId);
    }
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

const PLANNER_DAY_WIDTH = 38;
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
    const board = document.getElementById('plannerBoard');
    const anchor = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), calendarDate.getDate());
    plannerStartDate = new Date(anchor);
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
        roomsPanel += `<div class="p-floor-left">Floor ${floor}</div>`;
        floors[floor].forEach(room => {
            roomsPanel += `<div class="p-room-left" onclick="openEditRoom('${room.id}')">
                <span class="planner-room-status ${room.status}"></span>
                <span class="planner-room-label">${room.number}</span>
                <span class="planner-room-type">${room.type.substring(0, 3)}</span>
            </div>`;
        });
    });
    roomsPanel += '</div></div>';

    // === 4. GRID BODY (bottom-right, master scroller) ===
    let grid = '<div class="p-grid-panel"><div class="p-grid-inner">';

    // Today line
    const todayIdx = dateToDayIndex(new Date());
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
            grid += `<div class="p-grid-room-row" data-room-id="${room.id}">`;
            for (let i = 0; i < plannerTotalDays; i++) {
                const d = dayIndexToDate(i);
                const dow = d.getDay();
                let c = 'p-grid-cell';
                if (formatDate(d) === today) c += ' today-col';
                else if (dow === 0 || dow === 6) c += ' weekend';
                grid += `<div class="${c}" style="width:${DW}px" data-day="${i}"></div>`;
            }
            // Reservation bars
            (rb[room.id] || []).forEach(b => {
                const left = b.startIdx * DW;
                const width = (b.endIdx - b.startIdx) * DW - 2;
                const label = escapeHtml(b.res.groupName);
                grid += `<div class="planner-res-bar ${b.res.status}" style="left:${left}px;width:${width}px" onclick="openReservationDetail('${b.res.id}')" title="${label} (${formatDateDisplay(b.res.checkin)} - ${formatDateDisplay(b.res.checkout)})"><span class="bar-label">${label}</span></div>`;
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

let dragState = null; // { startDayIdx, currentDayIdx, overlay }

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

    // Create selection overlay
    const overlay = document.createElement('div');
    overlay.className = 'grid-drag-overlay';
    const gridInner = plannerGridEl.querySelector('.p-grid-inner');
    gridInner.appendChild(overlay);

    dragState = { startDayIdx: dayIdx, currentDayIdx: dayIdx, overlay };
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
    ov.style.top = '0';
    ov.style.width = width + 'px';
    ov.style.height = '100%';

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

    // Only open modal if dragged at least 1 day
    if (endIdx - startIdx < 1) return;

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

function toggleTheme() {
    const current = getTheme();
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    let next;
    if (current === 'auto') {
        next = systemDark ? 'light' : 'dark';
    } else if (current === 'dark') {
        next = 'light';
    } else {
        next = 'dark';
    }

    localStorage.setItem('gs_theme', next);
    applyTheme(next);
}

// Apply saved theme immediately
applyTheme(getTheme());

// =============================================
// INIT
// =============================================

(async function init() {
    await loadAllData();
    renderDashboard();
    renderCalendar();
})();
