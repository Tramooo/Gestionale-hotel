(function initDatePicker(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayDatePicker not initialized');
        return deps;
    }

    function getWrapper(el) {
        return el.closest('.mini-cal-wrapper');
    }

    function toggleDatePicker(inputEl) {
        const wrapper = getWrapper(inputEl);
        const dropdown = wrapper.querySelector('.mini-cal-dropdown');
        document.querySelectorAll('.mini-cal-dropdown.open').forEach((entry) => {
            if (entry !== dropdown) entry.classList.remove('open');
        });
        if (dropdown.classList.contains('open')) {
            dropdown.classList.remove('open');
            return;
        }
        const targetId = wrapper.dataset.target;
        const val = document.getElementById(targetId).value;
        wrapper._viewDate = val ? new Date(`${val}T00:00:00`) : new Date();
        renderDatePicker(wrapper);
        dropdown.classList.add('open');

        const rect = wrapper.getBoundingClientRect();
        const dropdownH = 320;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < dropdownH && rect.top > dropdownH) {
            dropdown.style.top = `${rect.top - dropdownH - 6}px`;
        } else {
            dropdown.style.top = `${rect.bottom + 6}px`;
        }
        const rightEdge = rect.left + 280;
        dropdown.style.left = `${rightEdge > window.innerWidth ? window.innerWidth - 288 : rect.left}px`;
    }

    function closeAllDatePickers() {
        document.querySelectorAll('.mini-cal-dropdown.open').forEach((entry) => entry.classList.remove('open'));
    }

    function datePickerNav(btn, dir) {
        const wrapper = getWrapper(btn);
        wrapper._viewDate.setMonth(wrapper._viewDate.getMonth() + dir);
        renderDatePicker(wrapper);
    }

    function renderDatePicker(wrapper) {
        const { formatDate, t } = requireDeps();
        const monthNames = t('months.full');
        const vd = wrapper._viewDate;
        const y = vd.getFullYear();
        const m = vd.getMonth();
        wrapper.querySelector('.mini-cal-month-label').textContent = `${monthNames[m]} ${y}`;

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
        const {
            calcIndividualPrice,
            calcReservationPrice,
            getSelectedRoomIds,
            populateIndRoomSelect,
            populateRoomChecklist
        } = requireDeps();

        const wrapper = getWrapper(btn);
        const targetId = wrapper.dataset.target;
        document.getElementById(targetId).value = dateStr;
        setDatePickerDisplay(wrapper, dateStr);
        wrapper.querySelector('.mini-cal-dropdown').classList.remove('open');

        if (targetId === 'resCheckin' || targetId === 'resCheckout') {
            calcReservationPrice();
            const resId = document.getElementById('resId').value || null;
            const selectedRooms = getSelectedRoomIds();
            populateRoomChecklist(selectedRooms, resId);
        }
        if (targetId === 'indCheckin' || targetId === 'indCheckout') {
            calcIndividualPrice();
            populateIndRoomSelect(document.getElementById('indId').value || null);
        }
    }

    function setDatePickerDisplay(wrapper, dateStr) {
        const { t } = requireDeps();
        const display = wrapper.querySelector('.mini-cal-display');
        if (!dateStr) {
            display.textContent = t('res.selectDate');
            return;
        }
        const d = new Date(`${dateStr}T00:00:00`);
        const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        display.textContent = `${d.getDate()} ${mn[d.getMonth()]} ${d.getFullYear()}`;
    }

    function setDateFieldValue(targetId, dateStr) {
        document.getElementById(targetId).value = dateStr;
        const wrapper = document.querySelector(`.mini-cal-wrapper[data-target="${targetId}"]`);
        if (wrapper) setDatePickerDisplay(wrapper, dateStr);
    }

    global.GroupStayDatePicker = {
        init(nextDeps) {
            deps = nextDeps;
        },
        closeAllDatePickers,
        datePickerNav,
        getWrapper,
        renderDatePicker,
        selectDatePickerDay,
        setDateFieldValue,
        setDatePickerDisplay,
        toggleDatePicker
    };
})(window);
