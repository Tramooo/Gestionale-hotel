(function initEmployeesFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayEmployees not initialized');
        return deps;
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getEmployeeMonthStats(empId, year, month) {
        const { getWorkEntries } = requireDeps();
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const entries = getWorkEntries().filter((entry) => entry.employeeId === empId && entry.workDate && entry.workDate.startsWith(monthStr));
        const daysWorked = entries.length;
        const totalHours = entries.reduce((sum, entry) => sum + (entry.hours || 0), 0);
        return { daysWorked, totalHours, entries };
    }

    function getEmpMonthPay(emp, yearMonth) {
        const { getMonthPayOverrides } = requireDeps();
        const override = getMonthPayOverrides().find((entry) => entry.employeeId === emp.id && entry.yearMonth === yearMonth);
        if (override) return { payType: override.payType, payRate: override.payRate };
        return { payType: emp.payType, payRate: emp.payRate };
    }

    function calcEstimatedPay(emp, daysWorked, totalHours, yearMonth) {
        const { payType, payRate } = yearMonth ? getEmpMonthPay(emp, yearMonth) : emp;
        if (payType === 'hourly') return totalHours * payRate;
        return (payRate / 30) * daysWorked;
    }

    function empMonthNav(delta) {
        const { getEmpViewMonth, setEmpViewMonth } = requireDeps();
        const next = new Date(getEmpViewMonth());
        next.setMonth(next.getMonth() + delta);
        setEmpViewMonth(next);
        renderEmployees();
    }

    function renderEmployees() {
        const {
            escapeHtml,
            formatDate,
            getEmpViewMonth,
            getEmployees,
            getMonthPayOverrides,
            t
        } = requireDeps();
        const grid = document.getElementById('employeesGrid');
        const search = (document.getElementById('searchEmployees')?.value || '').toLowerCase();
        const year = getEmpViewMonth().getFullYear();
        const month = getEmpViewMonth().getMonth();
        const monthNames = t('months.full');
        document.getElementById('empMonthLabel').textContent = `${monthNames[month]} ${year}`;

        let filtered = getEmployees();
        if (search) {
            filtered = filtered.filter((employee) =>
                (employee.firstName + ' ' + employee.lastName + ' ' + (employee.role || '')).toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state"><p>${t('emp.noEmployees')}</p></div>`;
            return;
        }

        const dim = getDaysInMonth(year, month);
        const dayHeaders = t('months.dayHeaders') || ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];
        const todayStr = formatDate(new Date());
        const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

        let headerCells = `<th class="emp-tbl-sticky">${t('emp.employee')}</th><th class="emp-tbl-type">${t('emp.type')}</th>`;
        for (let d = 1; d <= dim; d++) {
            const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
            const dow = (new Date(year, month, d).getDay() + 6) % 7;
            const isWeekend = dow >= 5;
            const isToday = dateStr === todayStr;
            let cls = 'emp-tbl-day';
            if (isWeekend) cls += ' emp-tbl-weekend';
            if (isToday) cls += ' emp-tbl-today';
            headerCells += `<th class="${cls}"><span class="emp-tbl-dow">${dayHeaders[dow]}</span><span class="emp-tbl-dnum">${d}</span></th>`;
        }
        headerCells += `<th class="emp-tbl-total">${t('emp.totalCol')}</th><th class="emp-tbl-pay">${t('emp.estimatedPay')}</th>`;

        let bodyRows = '';
        filtered.forEach((employee) => {
            const stats = getEmployeeMonthStats(employee.id, year, month);
            const effPay = getEmpMonthPay(employee, monthStr);
            const estimated = calcEstimatedPay(employee, stats.daysWorked, stats.totalHours, monthStr);
            const entryMap = {};
            stats.entries.forEach((entry) => { entryMap[entry.workDate] = entry; });

            const isOverridden = getMonthPayOverrides().some((override) => override.employeeId === employee.id && override.yearMonth === monthStr);
            const typeLabel = effPay.payType === 'hourly' ? '€/h' : '€/m';
            const typeCls = 'emp-tbl-type emp-tbl-type-btn' + (isOverridden ? ' emp-tbl-type-override' : '');
            const typeTitle = isOverridden ? 'Override attivo — clicca per modificare' : 'Clicca per cambiare tipo paga questo mese';
            const roleStr = employee.role ? `<span class="emp-tbl-role">${escapeHtml(employee.role)}</span>` : '';
            let row = `<td class="emp-tbl-sticky emp-tbl-name" onclick="openEditEmployee('${employee.id}')"><span class="emp-tbl-empname">${escapeHtml(employee.lastName)} ${escapeHtml(employee.firstName)}</span>${roleStr}</td>`;
            row += `<td class="${typeCls}" title="${typeTitle}" onclick="openPayTypePopover('${employee.id}','${monthStr}',this)">${typeLabel}</td>`;

            for (let d = 1; d <= dim; d++) {
                const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`;
                const entry = entryMap[dateStr];
                const dow = (new Date(year, month, d).getDay() + 6) % 7;
                const isWeekend = dow >= 5;
                const isToday = dateStr === todayStr;
                let cls = 'emp-tbl-cell';
                if (isWeekend) cls += ' emp-tbl-weekend';
                if (isToday) cls += ' emp-tbl-today';
                if (entry) cls += ' emp-tbl-worked';

                if (effPay.payType === 'hourly') {
                    let display = '';
                    if (entry) {
                        const hStr = entry.hours % 1 === 0 ? entry.hours.toString() : entry.hours.toFixed(1);
                        display = entry.startTime2 ? `<span class="emp-tbl-2shifts">${hStr}</span>` : hStr;
                    }
                    row += `<td class="${cls}" data-emp="${employee.id}" data-date="${dateStr}" onclick="openTimePopover('${employee.id}','${dateStr}',this)">${display}</td>`;
                } else {
                    const display = entry ? '&#10003;' : '';
                    row += `<td class="${cls}" data-emp="${employee.id}" data-date="${dateStr}" onclick="empTableToggle('${employee.id}','${dateStr}')">${display}</td>`;
                }
            }

            const totalDisplay = effPay.payType === 'hourly'
                ? (stats.totalHours % 1 === 0 ? stats.totalHours + 'h' : stats.totalHours.toFixed(1) + 'h')
                : stats.daysWorked + 'g';
            row += `<td class="emp-tbl-total">${totalDisplay}</td>`;
            row += `<td class="emp-tbl-pay">€${estimated.toFixed(0)}</td>`;
            bodyRows += `<tr>${row}</tr>`;
        });

        let colgroup = '<colgroup><col style="width:140px"><col style="width:40px">';
        for (let d = 1; d <= dim; d++) colgroup += '<col>';
        colgroup += '<col style="width:56px"><col style="width:64px"></colgroup>';

        grid.innerHTML = `
            <div class="emp-table-wrap">
                <table class="emp-table">
                    ${colgroup}
                    <thead><tr>${headerCells}</tr></thead>
                    <tbody>${bodyRows}</tbody>
                </table>
            </div>
        `;
    }

    async function empTableToggle(empId, dateStr) {
        const { API, apiPost, getWorkEntries, setWorkEntries } = requireDeps();
        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        if (existing) {
            try {
                await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
                setWorkEntries(getWorkEntries().filter((entry) => entry.id !== existing.id));
            } catch (error) { console.error(error); }
        } else {
            const data = { id: requireDeps().generateId(), employeeId: empId, workDate: dateStr, hours: 8, notes: '' };
            try {
                await apiPost(API.employees + '?type=work', data);
                setWorkEntries([...getWorkEntries(), data]);
            } catch (error) { console.error(error); }
        }
        renderEmployees();
    }

    function calcHoursFromTimes(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins < 0) mins += 24 * 60;
        return mins / 60;
    }

    function toggleShift2Popover() {
        const section = document.getElementById('empPopShift2');
        const addBtn = document.getElementById('empPopAddShift2');
        const remBtn = document.getElementById('empPopRemoveShift2');
        const visible = section.style.display !== 'none';
        section.style.display = visible ? 'none' : '';
        addBtn.style.display = visible ? '' : 'none';
        remBtn.style.display = visible ? 'none' : '';
        if (visible) {
            const s2 = document.getElementById('empPopStart2');
            const e2 = document.getElementById('empPopEnd2');
            if (s2) s2.value = '';
            if (e2) e2.value = '';
        }
        let totalH = 0;
        const s1 = document.getElementById('empPopStart').value;
        const e1 = document.getElementById('empPopEnd').value;
        if (s1 && e1) totalH += calcHoursFromTimes(s1, e1);
        document.getElementById('empPopCalc').textContent = totalH > 0 ? totalH.toFixed(1) + 'h' : '';
    }

    function timePopoverOutsideClick(event) {
        const pop = document.getElementById('empTimePopover');
        if (pop && !pop.contains(event.target)) closeTimePopover();
    }

    function closeTimePopover() {
        const pop = document.getElementById('empTimePopover');
        if (pop) pop.remove();
        document.removeEventListener('mousedown', timePopoverOutsideClick);
    }

    function openTimePopover(empId, dateStr, cellEl) {
        const { getWorkEntries, t } = requireDeps();
        closeTimePopover();
        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        const startVal = (existing && existing.startTime) || '08:00';
        const endVal = (existing && existing.endTime) || '16:00';
        const start2Val = (existing && existing.startTime2) || '';
        const end2Val = (existing && existing.endTime2) || '';
        const hasShift2 = !!(existing && existing.startTime2);

        const pop = document.createElement('div');
        pop.id = 'empTimePopover';
        pop.className = 'emp-time-popover';
        pop.innerHTML = `
            <div class="emp-time-popover-inner">
                <div class="emp-time-shift-label">Turno 1</div>
                <div class="emp-time-row">
                    <label>${t('emp.startTime')}</label>
                    <input type="time" id="empPopStart" value="${startVal}">
                </div>
                <div class="emp-time-row">
                    <label>${t('emp.endTime')}</label>
                    <input type="time" id="empPopEnd" value="${endVal}">
                </div>
                <div id="empPopShift2" style="${hasShift2 ? '' : 'display:none'}">
                    <div class="emp-time-shift-label" style="margin-top:8px">Turno 2</div>
                    <div class="emp-time-row">
                        <label>${t('emp.startTime')}</label>
                        <input type="time" id="empPopStart2" value="${start2Val}">
                    </div>
                    <div class="emp-time-row">
                        <label>${t('emp.endTime')}</label>
                        <input type="time" id="empPopEnd2" value="${end2Val}">
                    </div>
                </div>
                <div class="emp-time-secondary-actions" style="margin:8px 0 2px">
                    <button id="empPopAddShift2" class="btn btn-ghost btn-sm" onclick="toggleShift2Popover()" style="${hasShift2 ? 'display:none' : ''}">+ Turno 2</button>
                    <button id="empPopRemoveShift2" class="btn btn-ghost btn-sm" onclick="toggleShift2Popover()" style="${hasShift2 ? '' : 'display:none'};color:var(--red)">Rimuovi Turno 2</button>
                </div>
                <div class="emp-time-calc" id="empPopCalc">${existing ? existing.hours.toFixed(1) + 'h' : ''}</div>
                <div class="emp-time-actions">
                    <button class="btn btn-primary btn-sm" onclick="saveTimePopover('${empId}','${dateStr}')">${t('common.save')}</button>
                    ${existing ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deleteTimePopover('${empId}','${dateStr}')">${t('common.delete')}</button>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(pop);

        ['empPopStart', 'empPopEnd', 'empPopStart2', 'empPopEnd2'].forEach((id) => {
            const input = document.getElementById(id);
            if (!input) return;
            input.addEventListener('input', () => {
                let total = 0;
                const s1 = document.getElementById('empPopStart').value;
                const e1 = document.getElementById('empPopEnd').value;
                if (s1 && e1) total += calcHoursFromTimes(s1, e1);
                const s2 = document.getElementById('empPopStart2')?.value;
                const e2 = document.getElementById('empPopEnd2')?.value;
                if (s2 && e2) total += calcHoursFromTimes(s2, e2);
                document.getElementById('empPopCalc').textContent = total > 0 ? total.toFixed(1) + 'h' : '';
            });
        });

        const rect = cellEl.getBoundingClientRect();
        const popW = 260;
        const popH = 300;
        let left = rect.left + rect.width / 2 - popW / 2;
        let top = rect.bottom + 6;
        if (left < 8) left = 8;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';

        setTimeout(() => {
            document.addEventListener('mousedown', timePopoverOutsideClick);
        }, 10);
    }

    function payTypePopoverOutsideClick(event) {
        const pop = document.getElementById('empPayTypePopover');
        if (pop && !pop.contains(event.target)) closePayTypePopover();
    }

    function closePayTypePopover() {
        const pop = document.getElementById('empPayTypePopover');
        if (pop) pop.remove();
        document.removeEventListener('mousedown', payTypePopoverOutsideClick);
    }

    function openPayTypePopover(empId, yearMonth, cellEl) {
        const { getEmployees, getMonthPayOverrides } = requireDeps();
        closePayTypePopover();
        closeTimePopover();
        const emp = getEmployees().find((employee) => employee.id === empId);
        if (!emp) return;
        const override = getMonthPayOverrides().find((entry) => entry.employeeId === empId && entry.yearMonth === yearMonth);
        const effPay = getEmpMonthPay(emp, yearMonth);

        const pop = document.createElement('div');
        pop.id = 'empPayTypePopover';
        pop.className = 'emp-time-popover';
        pop.innerHTML = `
            <div class="emp-time-popover-inner">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Tipo paga — ${yearMonth}</div>
                <div class="emp-time-row">
                    <label>Tipo</label>
                    <select id="payTypePopSelect" style="font-size:13px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-secondary);color:var(--text-primary)">
                        <option value="monthly" ${effPay.payType === 'monthly' ? 'selected' : ''}>Mensile (€/mese)</option>
                        <option value="hourly" ${effPay.payType === 'hourly' ? 'selected' : ''}>Oraria (€/ora)</option>
                    </select>
                </div>
                <div class="emp-time-row">
                    <label id="payTypePopRateLabel">${effPay.payType === 'hourly' ? 'Tariffa (€/h)' : 'Stipendio (€)'}</label>
                    <input type="number" id="payTypePopRate" value="${effPay.payRate}" min="0" step="0.01" style="width:80px">
                </div>
                ${override ? `<div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">Default: ${emp.payType === 'hourly' ? '€/h' : '€/mese'} · €${emp.payRate.toFixed(2)}</div>` : ''}
                <div class="emp-time-actions">
                    <button class="btn btn-primary btn-sm" onclick="savePayTypeOverride('${empId}','${yearMonth}')">Salva</button>
                    ${override ? `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="deletePayTypeOverride('${override.id}','${empId}','${yearMonth}')">Ripristina default</button>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(pop);

        document.getElementById('payTypePopSelect').addEventListener('change', function () {
            document.getElementById('payTypePopRateLabel').textContent = this.value === 'hourly' ? 'Tariffa (€/h)' : 'Stipendio (€)';
        });

        const rect = cellEl.getBoundingClientRect();
        const popW = 220;
        const popH = 200;
        let left = rect.left + rect.width / 2 - popW / 2;
        let top = rect.bottom + 6;
        if (left < 8) left = 8;
        if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
        if (top + popH > window.innerHeight - 8) top = rect.top - popH - 6;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';

        setTimeout(() => {
            document.addEventListener('mousedown', payTypePopoverOutsideClick);
        }, 10);
    }

    async function savePayTypeOverride(empId, yearMonth) {
        const { API, apiPost, generateId, getMonthPayOverrides, renderManagement, setMonthPayOverrides } = requireDeps();
        const payType = document.getElementById('payTypePopSelect').value;
        const payRate = parseFloat(document.getElementById('payTypePopRate').value) || 0;
        closePayTypePopover();
        const existing = getMonthPayOverrides().find((entry) => entry.employeeId === empId && entry.yearMonth === yearMonth);
        const data = { id: existing ? existing.id : generateId(), employeeId: empId, yearMonth, payType, payRate };
        try {
            await apiPost(API.employees + '?type=monthOverride', data);
            if (existing) {
                const next = getMonthPayOverrides().map((entry) => entry.id === existing.id ? { ...entry, payType, payRate } : entry);
                setMonthPayOverrides(next);
            } else {
                setMonthPayOverrides([...getMonthPayOverrides(), data]);
            }
        } catch (error) { console.error(error); }
        renderEmployees();
        renderManagement();
    }

    async function deletePayTypeOverride(overrideId, empId, yearMonth) {
        const { API, getMonthPayOverrides, renderManagement, setMonthPayOverrides } = requireDeps();
        closePayTypePopover();
        try {
            await fetch(`${API.employees}?id=${overrideId}&type=monthOverride`, { method: 'DELETE' });
            setMonthPayOverrides(getMonthPayOverrides().filter((entry) => !(entry.employeeId === empId && entry.yearMonth === yearMonth)));
        } catch (error) { console.error(error); }
        renderEmployees();
        renderManagement();
    }

    async function saveTimePopover(empId, dateStr) {
        const { API, apiPost, apiPut, generateId, getWorkEntries, setWorkEntries } = requireDeps();
        const startTime = document.getElementById('empPopStart').value;
        const endTime = document.getElementById('empPopEnd').value;
        if (!startTime || !endTime) return;
        const startTime2 = document.getElementById('empPopStart2')?.value || null;
        const endTime2 = document.getElementById('empPopEnd2')?.value || null;

        let hours = calcHoursFromTimes(startTime, endTime);
        if (startTime2 && endTime2) hours += calcHoursFromTimes(startTime2, endTime2);

        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        if (existing) {
            const updated = { ...existing, hours, startTime, endTime, startTime2: startTime2 || null, endTime2: endTime2 || null };
            try { await apiPut(API.employees + '?type=work', updated); } catch (error) { console.error(error); }
            setWorkEntries(getWorkEntries().map((entry) => entry.id === existing.id ? updated : entry));
        } else {
            const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours, notes: '', startTime, endTime, startTime2: startTime2 || null, endTime2: endTime2 || null };
            try {
                await apiPost(API.employees + '?type=work', data);
                setWorkEntries([...getWorkEntries(), data]);
            } catch (error) { console.error(error); }
        }
        closeTimePopover();
        renderEmployees();
    }

    async function deleteTimePopover(empId, dateStr) {
        const { API, getWorkEntries, setWorkEntries } = requireDeps();
        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        if (existing) {
            try {
                await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
                setWorkEntries(getWorkEntries().filter((entry) => entry.id !== existing.id));
            } catch (error) { console.error(error); }
        }
        closeTimePopover();
        renderEmployees();
    }

    function openNewEmployeeModal() {
        const { openModal, t } = requireDeps();
        document.getElementById('employeeForm').reset();
        document.getElementById('empId').value = '';
        document.getElementById('employeeModalTitle').textContent = t('emp.addEmployee');
        document.getElementById('deleteEmpBtn').style.display = 'none';
        togglePayRateLabel();
        openModal('employeeModal');
    }

    function openEditEmployee(id) {
        const { getEmployees, openModal, t } = requireDeps();
        const emp = getEmployees().find((employee) => employee.id === id);
        if (!emp) return;
        document.getElementById('empId').value = emp.id;
        document.getElementById('empFirstName').value = emp.firstName;
        document.getElementById('empLastName').value = emp.lastName;
        document.getElementById('empRole').value = emp.role || '';
        document.getElementById('empPayType').value = emp.payType;
        document.getElementById('empPayRate').value = emp.payRate || '';
        document.getElementById('empNotes').value = emp.notes || '';
        document.getElementById('employeeModalTitle').textContent = t('emp.editEmployee');
        document.getElementById('deleteEmpBtn').style.display = 'inline-flex';
        togglePayRateLabel();
        openModal('employeeModal');
    }

    function togglePayRateLabel() {
        const { t } = requireDeps();
        const payType = document.getElementById('empPayType').value;
        const label = document.getElementById('empPayRateLabel');
        label.textContent = (payType === 'hourly' ? t('emp.hourlyPay') : t('emp.monthlyPay')) + ' (€)';
    }

    async function saveEmployee(event) {
        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getEmployees,
            setEmployees,
            showToast,
            t
        } = requireDeps();
        event.preventDefault();
        const id = document.getElementById('empId').value;
        const data = {
            id: id || generateId(),
            firstName: document.getElementById('empFirstName').value.trim(),
            lastName: document.getElementById('empLastName').value.trim(),
            role: document.getElementById('empRole').value.trim(),
            payType: document.getElementById('empPayType').value,
            payRate: parseFloat(document.getElementById('empPayRate').value) || 0,
            phone: '',
            email: '',
            notes: document.getElementById('empNotes').value.trim()
        };
        try {
            if (id) {
                await apiPut(API.employees, data);
                setEmployees(getEmployees().map((employee) => employee.id === id ? data : employee));
            } else {
                await apiPost(API.employees, data);
                setEmployees([...getEmployees(), data]);
            }
            showToast(t('toast.empSaved'));
            closeModal('employeeModal');
            renderEmployees();
        } catch (error) {
            console.error('Employee save error:', error);
            showToast(t('toast.empSaveFail') + ': ' + error.message, 'error');
        }
    }

    async function deleteEmployee() {
        const {
            API,
            apiDelete,
            closeModal,
            getEmployees,
            getWorkEntries,
            setEmployees,
            setWorkEntries,
            showToast,
            t
        } = requireDeps();
        const id = document.getElementById('empId').value;
        if (!id || !confirm(t('confirm.deleteEmployee'))) return;
        try {
            await apiDelete(API.employees, id);
            setEmployees(getEmployees().filter((employee) => employee.id !== id));
            setWorkEntries(getWorkEntries().filter((entry) => entry.employeeId !== id));
            showToast(t('toast.empDeleted'));
            closeModal('employeeModal');
            renderEmployees();
        } catch (error) {
            showToast(t('toast.empDeleteFail'), 'error');
        }
    }

    function openEmployeeDetail(empId) {
        const {
            closeModal,
            escapeHtml,
            formatDate,
            getEmpViewMonth,
            getEmployees,
            getMonthPayOverrides,
            openModal,
            t
        } = requireDeps();
        const emp = getEmployees().find((employee) => employee.id === empId);
        if (!emp) return;

        const year = getEmpViewMonth().getFullYear();
        const month = getEmpViewMonth().getMonth();
        const monthNames = t('months.full');
        const dim = getDaysInMonth(year, month);
        const detailMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
        const stats = getEmployeeMonthStats(empId, year, month);
        const effPay = getEmpMonthPay(emp, detailMonthStr);
        const estimated = calcEstimatedPay(emp, stats.daysWorked, stats.totalHours, detailMonthStr);

        document.getElementById('empDetailName').textContent = `${emp.lastName} ${emp.firstName}`;
        const isOverridden = getMonthPayOverrides().some((entry) => entry.employeeId === empId && entry.yearMonth === detailMonthStr);
        const payInfo = effPay.payType === 'hourly'
            ? `${t('emp.hourlyPay')}: €${effPay.payRate.toFixed(2)}/h${isOverridden ? ' ⚠️' : ''}`
            : `${t('emp.monthlyPay')}: €${effPay.payRate.toFixed(2)}${isOverridden ? ' ⚠️' : ''}`;

        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7;
        const dayHeaders = t('months.dayHeaders') || ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];
        const entryMap = {};
        stats.entries.forEach((entry) => { entryMap[entry.workDate] = entry; });
        const todayStr = formatDate(new Date());

        let calCells = '';
        calCells += dayHeaders.map((day) => `<div class="emp-cal-header">${day}</div>`).join('');
        for (let i = 0; i < startOffset; i++) calCells += '<div class="emp-cal-cell empty"></div>';
        for (let d = 1; d <= dim; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const entry = entryMap[dateStr];
            const isToday = dateStr === todayStr;
            const dayOfWeek = (startOffset + d - 1) % 7;
            const isWeekend = dayOfWeek >= 5;
            let cls = 'emp-cal-cell';
            if (isToday) cls += ' today';
            if (isWeekend) cls += ' weekend';
            if (entry) cls += ' worked';

            if (effPay.payType === 'hourly') {
                calCells += `<div class="${cls}" onclick="empCalDayClick('${empId}','${dateStr}')">
                    <span class="emp-cal-day">${d}</span>
                    ${entry ? `<span class="emp-cal-hours">${entry.hours}h</span>` : ''}
                </div>`;
            } else {
                calCells += `<div class="${cls}" onclick="empCalDayToggle('${empId}','${dateStr}')">
                    <span class="emp-cal-day">${d}</span>
                    ${entry ? `<svg class="emp-cal-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>`;
            }
        }

        const body = document.getElementById('employeeDetailBody');
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
                <div>
                    <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(emp.role || '—')} · ${payInfo}</span>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="closeModal('employeeDetailModal');openEditEmployee('${empId}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    ${t('common.edit')}
                </button>
            </div>

            <div class="emp-detail-section">
                <div class="emp-summary-grid">
                    <div class="emp-summary-card">
                        <div class="value">${stats.daysWorked}</div>
                        <div class="label">${t('emp.workDays')}</div>
                    </div>
                    <div class="emp-summary-card">
                        <div class="value">${stats.totalHours.toFixed(1)}</div>
                        <div class="label">${t('emp.totalHours')}</div>
                    </div>
                    <div class="emp-summary-card">
                        <div class="value" style="color:var(--green)">&euro;${estimated.toFixed(2)}</div>
                        <div class="label">${t('emp.estimatedPay')}</div>
                    </div>
                </div>
            </div>

            <div class="emp-detail-section">
                <h4>${monthNames[month]} ${year}</h4>
                <div class="emp-cal-grid">
                    ${calCells}
                </div>
                ${effPay.payType === 'hourly' ? `<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">${t('emp.calHintHourly')}</p>` : `<p style="font-size:11px;color:var(--text-secondary);margin-top:8px">${t('emp.calHintMonthly')}</p>`}
            </div>
        `;

        openModal('employeeDetailModal');
    }

    async function empCalDayClick(empId, dateStr) {
        const { API, apiPost, apiPut, generateId, getWorkEntries, setWorkEntries, t } = requireDeps();
        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        if (existing) {
            const input = prompt(t('emp.enterHours'), existing.hours);
            if (input === null) return;
            const hours = parseFloat(input);
            if (isNaN(hours) || hours < 0) return;
            if (hours === 0) {
                try {
                    await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
                    setWorkEntries(getWorkEntries().filter((entry) => entry.id !== existing.id));
                } catch (error) { console.error(error); }
            } else {
                const updated = { ...existing, hours };
                try { await apiPut(API.employees + '?type=work', updated); } catch (error) { console.error(error); }
                setWorkEntries(getWorkEntries().map((entry) => entry.id === existing.id ? updated : entry));
            }
        } else {
            const input = prompt(t('emp.enterHours'), '8');
            if (input === null) return;
            const hours = parseFloat(input);
            if (isNaN(hours) || hours <= 0) return;
            const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours, notes: '' };
            try {
                await apiPost(API.employees + '?type=work', data);
                setWorkEntries([...getWorkEntries(), data]);
            } catch (error) { console.error(error); }
        }
        renderEmployees();
        openEmployeeDetail(empId);
    }

    async function empCalDayToggle(empId, dateStr) {
        const { API, apiPost, generateId, getWorkEntries, setWorkEntries } = requireDeps();
        const existing = getWorkEntries().find((entry) => entry.employeeId === empId && entry.workDate === dateStr);
        if (existing) {
            try {
                await fetch(`${API.employees}?id=${existing.id}&type=work`, { method: 'DELETE' });
                setWorkEntries(getWorkEntries().filter((entry) => entry.id !== existing.id));
            } catch (error) { console.error(error); }
        } else {
            const data = { id: generateId(), employeeId: empId, workDate: dateStr, hours: 8, notes: '' };
            try {
                await apiPost(API.employees + '?type=work', data);
                setWorkEntries([...getWorkEntries(), data]);
            } catch (error) { console.error(error); }
        }
        renderEmployees();
        openEmployeeDetail(empId);
    }

    function closeWorkEntryModal() {
        const { closeModal } = requireDeps();
        const empId = document.getElementById('workEntryEmployeeId').value;
        closeModal('workEntryModal');
        if (empId) openEmployeeDetail(empId);
    }

    function openNewWorkEntry(empId) {
        const { closeModal, formatDate, openModal, t } = requireDeps();
        closeModal('employeeDetailModal');
        document.getElementById('workEntryForm').reset();
        document.getElementById('workEntryId').value = '';
        document.getElementById('workEntryEmployeeId').value = empId;
        document.getElementById('workEntryDate').value = formatDate(new Date());
        document.getElementById('workEntryHours').value = '8';
        document.getElementById('workEntryModalTitle').textContent = t('emp.addWorkDay');
        openModal('workEntryModal');
    }

    function openEditWorkEntry(workId) {
        const { closeModal, getWorkEntries, openModal, t } = requireDeps();
        const entry = getWorkEntries().find((work) => work.id === workId);
        if (!entry) return;
        closeModal('employeeDetailModal');
        document.getElementById('workEntryId').value = entry.id;
        document.getElementById('workEntryEmployeeId').value = entry.employeeId;
        document.getElementById('workEntryDate').value = entry.workDate;
        document.getElementById('workEntryHours').value = entry.hours || '';
        document.getElementById('workEntryNotes').value = entry.notes || '';
        document.getElementById('workEntryModalTitle').textContent = t('emp.editWorkDay');
        openModal('workEntryModal');
    }

    async function saveWorkEntry(event) {
        const {
            API,
            apiPost,
            apiPut,
            closeModal,
            generateId,
            getWorkEntries,
            setWorkEntries,
            showToast,
            t
        } = requireDeps();
        event.preventDefault();
        const id = document.getElementById('workEntryId').value;
        const empId = document.getElementById('workEntryEmployeeId').value;
        const data = {
            id: id || generateId(),
            employeeId: empId,
            workDate: document.getElementById('workEntryDate').value,
            hours: parseFloat(document.getElementById('workEntryHours').value) || 0,
            notes: document.getElementById('workEntryNotes').value.trim()
        };
        try {
            if (id) {
                await apiPut(API.employees + '?type=work', data);
                setWorkEntries(getWorkEntries().map((entry) => entry.id === id ? data : entry));
            } else {
                await apiPost(API.employees + '?type=work', data);
                setWorkEntries([...getWorkEntries(), data]);
            }
            showToast(t('toast.workSaved'));
            closeModal('workEntryModal');
            renderEmployees();
            openEmployeeDetail(empId);
        } catch (error) {
            showToast(t('toast.workSaveFail'), 'error');
        }
    }

    async function deleteWorkEntry(workId, empId) {
        const { API, getWorkEntries, setWorkEntries, showToast, t } = requireDeps();
        if (!confirm(t('confirm.deleteWorkEntry'))) return;
        try {
            await fetch(`${API.employees}?id=${workId}&type=work`, { method: 'DELETE' });
            setWorkEntries(getWorkEntries().filter((entry) => entry.id !== workId));
            showToast(t('toast.workDeleted'));
            renderEmployees();
            openEmployeeDetail(empId);
        } catch (error) {
            showToast(t('toast.workDeleteFail'), 'error');
        }
    }

    global.GroupStayEmployees = {
        calcEstimatedPay,
        closePayTypePopover,
        closeTimePopover,
        closeWorkEntryModal,
        deleteEmployee,
        deletePayTypeOverride,
        deleteTimePopover,
        deleteWorkEntry,
        empCalDayClick,
        empCalDayToggle,
        empMonthNav,
        empTableToggle,
        getDaysInMonth,
        getEmployeeMonthStats,
        getEmpMonthPay,
        init(nextDeps) {
            deps = nextDeps;
        },
        openEditEmployee,
        openEditWorkEntry,
        openEmployeeDetail,
        openNewEmployeeModal,
        openNewWorkEntry,
        openPayTypePopover,
        openTimePopover,
        renderEmployees,
        saveEmployee,
        savePayTypeOverride,
        saveTimePopover,
        saveWorkEntry,
        togglePayRateLabel,
        toggleShift2Popover
    };
})(window);
