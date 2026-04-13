(function initMenusFeature(global) {
    let deps = null;
    let lastMenus = [];

    function requireDeps() {
        if (!deps) throw new Error('GroupStayMenus not initialized');
        return deps;
    }

    async function loadReservationMenus(reservation) {
        const { API, apiGet } = requireDeps();
        const container = document.getElementById('menuContainer');
        if (!container) return;
        try {
            const menus = await apiGet(`${API.menus}?reservationId=${reservation.id}`);
            lastMenus = menus;
            renderMenuSection(reservation, menus);
        } catch (err) {
            container.innerHTML = '<div class="menu-error">Errore caricamento menu</div>';
        }
    }

    function getMealDays(reservation) {
        const { formatDate } = requireDeps();
        const days = [];
        if (!reservation.checkin || !reservation.checkout) return days;
        const plan = reservation.mealPlan || 'BB';
        if (plan === 'BB') return days;

        const checkinMs = new Date(reservation.checkin).getTime();
        const checkoutMs = new Date(reservation.checkout).getTime();

        if (plan === 'FB') {
            let current = new Date(reservation.checkin);
            while (current.getTime() <= checkoutMs) {
                const dateStr = formatDate(current);
                const isFirst = current.getTime() === checkinMs;
                const isLast = current.getTime() === checkoutMs;
                if (isFirst) {
                    days.push({ date: dateStr, mealType: 'dinner' });
                } else if (isLast) {
                    days.push({ date: dateStr, mealType: 'lunch' });
                } else {
                    days.push({ date: dateStr, mealType: 'lunch' });
                    days.push({ date: dateStr, mealType: 'dinner' });
                }
                current.setDate(current.getDate() + 1);
            }
        } else {
            let d = new Date(reservation.checkin);
            const end = new Date(reservation.checkout);
            while (d < end) {
                days.push({ date: formatDate(d), mealType: 'dinner' });
                d.setDate(d.getDate() + 1);
            }
        }

        return days;
    }

    function renderMenuSection(reservation, menus) {
        const { escapeHtml, formatDateDisplay } = requireDeps();
        const container = document.getElementById('menuContainer');
        if (!container) return;
        const plan = reservation.mealPlan || 'BB';

        const intolerances = reservation.intolerances || [];
        const intolHtml = `
            <div class="menu-intolerances">
                <div class="menu-intol-header">
                    <span class="menu-intol-title">Intolleranze / Esigenze Alimentari</span>
                    <button class="btn btn-sm btn-secondary" onclick="addIntoleranceRow('${reservation.id}')">+ Aggiungi</button>
                </div>
                <div id="intolList" class="intol-list">
                    ${intolerances.length === 0 ? '<div class="menu-bb-note" style="margin:0">Nessuna intolleranza registrata</div>' :
                        intolerances.map((it, i) => `
                        <div class="intol-row" data-idx="${i}">
                            <input class="form-control intol-count" type="number" min="1" value="${it.count || 1}" placeholder="N"
                                onblur="saveIntolerances('${reservation.id}')" style="width:60px">
                            <input class="form-control intol-note" type="text" value="${escapeHtml(it.note || '')}" placeholder="es. celiaco, no maiale…"
                                onblur="saveIntolerances('${reservation.id}')">
                            <button class="btn btn-ghost btn-sm intol-del-btn" onclick="removeIntoleranceRow(this,'${reservation.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>`).join('')}
                </div>
            </div>`;

        if (plan === 'BB') {
            container.innerHTML = `${intolHtml}<div class="menu-bb-note">Solo colazione — nessun menu da inserire</div>`;
            return;
        }

        const days = getMealDays(reservation);
        const menuMap = {};
        menus.forEach((menu) => { menuMap[`${menu.date}_${menu.mealType}`] = menu; });

        let html = intolHtml;
        let lastDate = '';
        days.forEach(({ date, mealType }) => {
            if (date !== lastDate) {
                if (lastDate) html += '</div>';
                html += `<div class="menu-day"><div class="menu-day-header">${formatDateDisplay(date)}</div>`;
                lastDate = date;
            }
            const key = `${date}_${mealType}`;
            const menu = menuMap[key] || {};
            const mealLabel = mealType === 'lunch' ? 'Pranzo' : 'Cena';
            const fields = ['primo', 'secondo', 'contorno', 'dessert'];
            html += `<div class="menu-meal">
                <div class="menu-meal-type">${mealLabel}</div>
                <div class="menu-meal-fields">`;
            if (reservation.veggieBuffet) {
                html += `<div class="menu-field menu-field-full">
                    <label class="menu-field-label">Antipasto</label>
                    <div class="menu-veggie-badge">Buffet di verdure</div>
                </div>`;
            }
            fields.forEach((field) => {
                html += `<div class="menu-field">
                    <label class="menu-field-label">${field.charAt(0).toUpperCase() + field.slice(1)}</label>
                    <input class="form-control menu-input" type="text" value="${escapeHtml(menu[field] || '')}"
                        data-resid="${reservation.id}" data-date="${date}" data-mealtype="${mealType}" data-field="${field}" data-mid="${menu.id || ''}"
                        onblur="saveMenuField(this)" placeholder="—">
                </div>`;
            });
            html += '</div></div>';
        });
        if (lastDate) html += '</div>';
        container.innerHTML = html;
    }

    function addIntoleranceRow(resId) {
        const { getReservations, setReservations } = requireDeps();
        const reservations = getReservations();
        const reservation = reservations.find((item) => item.id === resId);
        if (!reservation) return;
        if (!reservation.intolerances) reservation.intolerances = [];
        reservation.intolerances.push({ count: 1, note: '' });
        setReservations([...reservations]);
        renderMenuSection(reservation, lastMenus || []);
    }

    function removeIntoleranceRow(btn, resId) {
        const { getReservations, setReservations } = requireDeps();
        const row = btn.closest('.intol-row');
        const idx = parseInt(row.dataset.idx);
        const reservations = getReservations();
        const reservation = reservations.find((item) => item.id === resId);
        if (!reservation || !reservation.intolerances) return;
        reservation.intolerances.splice(idx, 1);
        setReservations([...reservations]);
        saveIntolerances(resId);
        renderMenuSection(reservation, lastMenus || []);
    }

    async function saveIntolerances(resId) {
        const { API, apiPut, getReservations } = requireDeps();
        const reservation = getReservations().find((item) => item.id === resId);
        if (!reservation) return;
        const rows = document.querySelectorAll('#intolList .intol-row');
        const list = [];
        rows.forEach((row) => {
            const count = parseInt(row.querySelector('.intol-count').value) || 1;
            const note = row.querySelector('.intol-note').value.trim();
            if (note) list.push({ count, note });
        });
        reservation.intolerances = list;
        try {
            await apiPut(API.reservations, { ...reservation, id: resId });
        } catch (err) {
            console.error('Intolerances save error', err);
        }
    }

    function printMenu(resId) {
        const {
            escapeHtml,
            formatDateDisplay,
            getReservations,
            nightsBetween
        } = requireDeps();

        const reservation = getReservations().find((item) => item.id === resId);
        if (!reservation) return;
        const menus = lastMenus;
        const plan = reservation.mealPlan || 'BB';
        const days = getMealDays(reservation);
        const menuMap = {};
        menus.forEach((menu) => { menuMap[`${menu.date}_${menu.mealType}`] = menu; });
        const intolerances = reservation.intolerances || [];

        const planLabels = {
            BB: 'BB – Solo Colazione',
            HB: 'HB – Colazione & Cena',
            FB: 'FB – Colazione, Pranzo & Cena',
            FBC: 'FBC – Colazione, Pranzo al Sacco & Cena'
        };

        let daysHtml = '';
        let lastDate = '';
        days.forEach(({ date, mealType }) => {
            if (date !== lastDate) {
                if (lastDate) daysHtml += '</div>';
                daysHtml += `<div class="print-day"><div class="print-day-header">${formatDateDisplay(date)}</div>`;
                lastDate = date;
            }
            const menu = menuMap[`${date}_${mealType}`] || {};
            const mealLabel = mealType === 'lunch' ? 'Pranzo' : 'Cena';
            const fields = [['Primo', menu.primo], ['Secondo', menu.secondo], ['Contorno', menu.contorno], ['Dessert', menu.dessert]];
            const veggieRow = reservation.veggieBuffet ? '<tr><td class="print-field-label">Antipasto</td><td class="print-field-val print-veggie">Buffet di verdure</td></tr>' : '';
            daysHtml += `<div class="print-meal">
                <div class="print-meal-type">${mealLabel}</div>
                <table class="print-meal-table">
                    ${veggieRow}
                    ${fields.map(([label, val]) => `<tr><td class="print-field-label">${label}</td><td class="print-field-val">${escapeHtml(val || '—')}</td></tr>`).join('')}
                </table>
            </div>`;
        });
        if (lastDate) daysHtml += '</div>';

        const intolHtml = intolerances.length > 0 ? `
            <div class="print-intol">
                <div class="print-section-title">Intolleranze / Esigenze Alimentari</div>
                <ul class="print-intol-list">
                    ${intolerances.map((it) => `<li><strong>${it.count}</strong> × ${escapeHtml(it.note)}</li>`).join('')}
                </ul>
            </div>` : '';

        const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
        <title>Menu – ${escapeHtml(reservation.groupName)}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Georgia', serif; color: #1a1a1a; background: #fff; padding: 40px; max-width: 860px; margin: 0 auto; font-size: 16px; line-height: 1.45; }
            .print-header { text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #1a1a1a; }
            .print-hotel { font-size: 15px; letter-spacing: 0.15em; text-transform: uppercase; color: #666; margin-bottom: 8px; }
            .print-group { font-size: 32px; font-weight: bold; margin-bottom: 6px; }
            .print-dates { font-size: 18px; color: #555; margin-bottom: 4px; }
            .print-plan { display: inline-block; margin-top: 10px; font-size: 15px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; background: #f0f0f0; padding: 6px 16px; border-radius: 20px; color: #333; }
            .print-intol { margin-bottom: 32px; padding: 18px 22px; background: #fff8f0; border-left: 4px solid #e8a020; border-radius: 4px; }
            .print-section-title { font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #888; margin-bottom: 10px; }
            .print-intol-list { padding-left: 18px; }
            .print-intol-list li { font-size: 17px; margin-bottom: 6px; }
            .print-day { margin-bottom: 28px; break-inside: avoid; }
            .print-day-header { font-size: 16px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 6px; margin-bottom: 12px; }
            .print-meal { margin-bottom: 18px; padding-left: 14px; border-left: 3px solid #1a1a1a; }
            .print-meal-type { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1a1a1a; margin-bottom: 8px; }
            .print-meal-table { width: 100%; border-collapse: collapse; }
            .print-field-label { font-size: 15px; color: #888; width: 110px; padding: 4px 0; vertical-align: top; }
            .print-field-val { font-size: 18px; color: #1a1a1a; padding: 4px 0; }
            .print-veggie { color: #27ae60; font-style: italic; }
            .print-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; font-size: 13px; color: #aaa; }
            @page { margin: 0; }
            @media print { body { padding: 20px; } }
        </style>
        </head><body>
        <div class="print-header">
            <div class="print-dates">${formatDateDisplay(reservation.checkin)} — ${formatDateDisplay(reservation.checkout)} &nbsp;·&nbsp; ${nightsBetween(reservation.checkin, reservation.checkout)} notti &nbsp;·&nbsp; ${reservation.guestCount || 0} ospiti</div>
            <div class="print-plan">${planLabels[plan] || plan}</div>
        </div>
        ${intolHtml}
        ${daysHtml || '<p style="color:#888;text-align:center">Nessun menu da visualizzare</p>'}
        <div class="print-footer">Stampato il ${new Date().toLocaleDateString('it-IT')}</div>
        </body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
    }

    async function saveMenuField(input) {
        const { API, apiPost, generateId } = requireDeps();
        const { resid, date, mealtype } = input.dataset;
        const allInputs = document.querySelectorAll(
            `.menu-input[data-resid="${resid}"][data-date="${date}"][data-mealtype="${mealtype}"]`
        );
        const entry = { reservationId: resid, date, mealType: mealtype, primo: '', secondo: '', contorno: '', dessert: '' };
        allInputs.forEach((inp) => { entry[inp.dataset.field] = inp.value.trim(); });
        let mid = input.dataset.mid;
        if (!mid) {
            mid = generateId();
            allInputs.forEach((inp) => { inp.dataset.mid = mid; });
        }
        entry.id = mid;
        try {
            await apiPost(API.menus, entry);
        } catch (err) {
            console.error('Menu save error', err);
        }
    }

    global.GroupStayMenus = {
        init(nextDeps) {
            deps = nextDeps;
        },
        loadReservationMenus,
        getMealDays,
        renderMenuSection,
        addIntoleranceRow,
        removeIntoleranceRow,
        saveIntolerances,
        printMenu,
        saveMenuField
    };
})(window);
