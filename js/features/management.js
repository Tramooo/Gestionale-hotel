(function initManagementFeature(global) {
    let deps = null;

    function requireDeps() {
        if (!deps) throw new Error('GroupStayManagement not initialized');
        return deps;
    }

    function calcReservationRevenue(reservation) {
        const { nightsBetween } = requireDeps();
        const guestCount = reservation.guestCount || 0;
        const pricePerPerson = reservation.pricePerPerson || 0;
        const gratuity = reservation.gratuity || 0;
        const nights = (reservation.checkin && reservation.checkout) ? nightsBetween(reservation.checkin, reservation.checkout) : 0;
        if (pricePerPerson > 0 && guestCount > 0 && nights > 0) {
            const free = gratuity > 0 ? Math.floor(guestCount / gratuity) : 0;
            return Math.max(0, guestCount - free) * nights * pricePerPerson;
        }
        return reservation.price || 0;
    }

    function renderManagement() {
        const {
            escapeHtml,
            getEmpViewMonth,
            getEmployees,
            getMonthPayOverrides,
            getReservations,
            getWorkEntries,
            getDaysInMonth,
            getEmployeeMonthStats,
            getEmpMonthPay,
            calcEstimatedPay,
            getEmployeeAdvances,
            nightsBetween,
            renderEmployees,
            t
        } = requireDeps();
        const reservations = getReservations();
        const employees = getEmployees();
        const workEntries = getWorkEntries();
        const monthPayOverrides = getMonthPayOverrides();

        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();

        const monthRevenue = reservations
            .filter((reservation) => {
                const date = new Date(reservation.checkin);
                return (reservation.status === 'confirmed' || reservation.status === 'checked-in') &&
                    date.getMonth() === thisMonth &&
                    date.getFullYear() === thisYear;
            })
            .reduce((sum, reservation) => sum + calcReservationRevenue(reservation), 0);

        const yearRevenue = reservations
            .filter((reservation) => (reservation.status === 'confirmed' || reservation.status === 'checked-in') && new Date(reservation.checkin).getFullYear() === thisYear)
            .reduce((sum, reservation) => sum + calcReservationRevenue(reservation), 0);

        const pendingRevenue = reservations
            .filter((reservation) => reservation.status === 'pending')
            .reduce((sum, reservation) => sum + calcReservationRevenue(reservation), 0);

        const revEl = document.getElementById('stat-revenue');
        const yearEl = document.getElementById('stat-year-revenue');
        const pendingEl = document.getElementById('stat-pending-revenue');
        if (revEl) revEl.textContent = '€' + monthRevenue.toLocaleString();
        if (yearEl) yearEl.textContent = '€' + yearRevenue.toLocaleString();
        if (pendingEl) pendingEl.textContent = '€' + pendingRevenue.toLocaleString();

        const totalPresenze = reservations
            .filter((reservation) => reservation.status === 'confirmed' || reservation.status === 'checked-in')
            .reduce((sum, reservation) => {
                const nights = (reservation.checkin && reservation.checkout) ? nightsBetween(reservation.checkin, reservation.checkout) : 0;
                return sum + (reservation.guestCount || 0) * nights;
            }, 0);
        const presenzeEl = document.getElementById('stat-total-presenze');
        if (presenzeEl) presenzeEl.textContent = totalPresenze.toLocaleString();

        let totalEmpCostAll = 0;
        employees.forEach((employee) => {
            const empEntries = workEntries.filter((entry) => entry.employeeId === employee.id);
            const byMonth = {};
            empEntries.forEach((entry) => {
                const month = entry.workDate ? entry.workDate.substring(0, 7) : null;
                if (!month) return;
                if (!byMonth[month]) byMonth[month] = { days: 0, hours: 0 };
                byMonth[month].days++;
                byMonth[month].hours += entry.hours || 0;
            });
            Object.entries(byMonth).forEach(([month, { days, hours }]) => {
                const { payType, payRate } = getEmpMonthPay(employee, month);
                if (payType === 'hourly') totalEmpCostAll += hours * payRate;
                else totalEmpCostAll += (days / 30) * payRate;
            });
        });

        const empCostEl = document.getElementById('stat-emp-cost');
        if (empCostEl) empCostEl.textContent = '€' + Math.round(totalEmpCostAll).toLocaleString();

        const empYear = getEmpViewMonth().getFullYear();
        const empMonth = getEmpViewMonth().getMonth();
        const breakdownEl = document.getElementById('empCostBreakdown');
        if (breakdownEl) {
            const empCosts = [];
            let totalMonthCost = 0;
            let totalAdvances = 0;
            const breakdownMonthStr = `${empYear}-${String(empMonth + 1).padStart(2, '0')}`;
            employees.forEach((employee) => {
                const stats = getEmployeeMonthStats(employee.id, empYear, empMonth);
                const cost = calcEstimatedPay(employee, stats.daysWorked, stats.totalHours, breakdownMonthStr);
                const advances = getEmployeeAdvances()
                    .filter((advance) => advance.employeeId === employee.id && advance.yearMonth === breakdownMonthStr)
                    .reduce((sum, advance) => sum + (parseFloat(advance.amount) || 0), 0);
                totalMonthCost += cost;
                totalAdvances += advances;
                if (cost > 0 || advances > 0 || stats.daysWorked > 0) empCosts.push({ employee, cost, advances, stats });
            });

            if (empCosts.length > 0) {
                breakdownEl.style.display = '';
                const monthNames = t('months.full');
                const monthLabel = `${monthNames[empMonth]} ${empYear}`;
                const rows = empCosts.map(({ employee, cost, advances, stats }) => {
                    const effPay = getEmpMonthPay(employee, breakdownMonthStr);
                    const detail = effPay.payType === 'hourly'
                        ? `${stats.totalHours % 1 === 0 ? stats.totalHours : stats.totalHours.toFixed(1)}h × €${effPay.payRate.toFixed(2)}/h`
                        : `${stats.daysWorked}g / 30 × €${effPay.payRate.toFixed(0)}`;
                    const net = Math.max(0, cost - advances);
                    return `<tr>
                        <td style="padding:8px 12px;font-weight:500">${escapeHtml(employee.lastName)} ${escapeHtml(employee.firstName)}</td>
                        <td style="padding:8px 12px;color:var(--text-secondary);font-size:13px">${detail}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">€${Math.round(cost).toLocaleString()}</td>
                        <td style="padding:8px 12px;text-align:right;color:var(--orange);font-weight:600;font-variant-numeric:tabular-nums">€${Math.round(advances).toLocaleString()}</td>
                        <td style="padding:8px 12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">€${Math.round(net).toLocaleString()}</td>
                    </tr>`;
                }).join('');
                const totalNet = Math.max(0, totalMonthCost - totalAdvances);
                breakdownEl.innerHTML = `
                    <div style="padding:12px 12px 4px;font-weight:600;font-size:14px">Costo dipendenti — ${monthLabel}</div>
                    <table style="width:100%;border-collapse:collapse">
                        <thead><tr>
                            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Dipendente</th>
                            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Dettaglio</th>
                            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Lordo</th>
                            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Acconti</th>
                            <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:var(--text-secondary);border-bottom:1px solid var(--border-light)">Netto</th>
                        </tr></thead>
                        <tbody>${rows}
                            <tr style="border-top:2px solid var(--border-light)">
                                <td colspan="2" style="padding:10px 12px;font-weight:700">Totale mese</td>
                                <td style="padding:10px 12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">€${Math.round(totalMonthCost).toLocaleString()}</td>
                                <td style="padding:10px 12px;text-align:right;color:var(--orange);font-weight:700;font-variant-numeric:tabular-nums">€${Math.round(totalAdvances).toLocaleString()}</td>
                                <td style="padding:10px 12px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">€${Math.round(totalNet).toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>`;
            } else {
                breakdownEl.style.display = 'none';
            }
        }

        renderEmployees();
    }

    global.GroupStayManagement = {
        calcReservationRevenue,
        init(nextDeps) {
            deps = nextDeps;
        },
        renderManagement
    };
})(window);
