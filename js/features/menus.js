(function initMenusFeature(global) {
    let deps = null;
    let lastMenus = [];

    function requireDeps() {
        if (!deps) throw new Error('GroupStayMenus not initialized');
        return deps;
    }

    function getMenuSaveStatusElement() {
        return document.getElementById('menuSaveStatus');
    }

    function setMenuSaveStatus(state, message = '') {
        const el = getMenuSaveStatusElement();
        if (!el) return;
        el.dataset.state = state;
        el.textContent = message;
    }

    function markMenusDirty() {
        setMenuSaveStatus('dirty', 'Modifiche non salvate');
    }

    function upsertCachedMenu(entry) {
        const key = `${entry.date}_${entry.mealType}`;
        const index = lastMenus.findIndex((menu) => `${menu.date}_${menu.mealType}` === key);
        if (index === -1) {
            lastMenus.push({ ...entry });
        } else {
            lastMenus[index] = { ...lastMenus[index], ...entry };
        }
    }

    async function loadReservationMenus(reservation) {
        const { API, apiGet } = requireDeps();
        const container = document.getElementById('menuContainer');
        if (!container) return;
        try {
            const menus = await apiGet(`${API.menus}?reservationId=${reservation.id}`);
            lastMenus = menus;
            renderMenuSection(reservation, menus);
            setMenuSaveStatus('idle', 'Salvataggio automatico attivo');
        } catch (err) {
            container.innerHTML = '<div class="menu-error">Errore caricamento menu</div>';
            setMenuSaveStatus('error', 'Errore caricamento menu');
        }
    }

    function getMealDays(reservation) {
        const { formatDate } = requireDeps();
        const days = [];
        if (!reservation.checkin || !reservation.checkout) return days;
        const plan = reservation.mealPlan || 'BB';

        if (plan !== 'BB') {
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
        }

        // Merge extra meals (skip duplicates already covered by the base plan)
        (reservation.extraMeals || []).forEach((extra) => {
            if (!days.some((d) => d.date === extra.date && d.mealType === extra.mealType)) {
                days.push({ date: extra.date, mealType: extra.mealType, isExtra: true });
            }
        });

        // Sort chronologically, lunch before dinner within the same day
        days.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.mealType === 'lunch' ? 0 : 1) - (b.mealType === 'lunch' ? 0 : 1);
        });

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
                                oninput="markMenusDirty()" onblur="saveIntolerances('${reservation.id}')" style="width:60px">
                            <input class="form-control intol-note" type="text" value="${escapeHtml(it.note || '')}" placeholder="es. celiaco, no maiale…"
                                oninput="markMenusDirty()" onblur="saveIntolerances('${reservation.id}')">
                            <button class="btn btn-ghost btn-sm intol-del-btn" onclick="removeIntoleranceRow(this,'${reservation.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>`).join('')}
                </div>
            </div>`;
        const sharedMenuNote = '<div class="menu-bb-note">Menu condiviso con tutti i gruppi presenti nello stesso giorno.</div>';

        const days = getMealDays(reservation);
        const menuMap = {};
        menus.forEach((menu) => { menuMap[`${menu.date}_${menu.mealType}`] = menu; });

        let html = intolHtml;
        if (plan === 'BB' && days.length === 0) {
            html += '<div class="menu-bb-note">Solo colazione — nessun menu da inserire</div>';
        } else if (plan !== 'BB') {
            html += sharedMenuNote;
        }

        let lastDate = '';
        days.forEach(({ date, mealType, isExtra }) => {
            if (date !== lastDate) {
                if (lastDate) html += '</div>';
                html += `<div class="menu-day"><div class="menu-day-header">${formatDateDisplay(date)}</div>`;
                lastDate = date;
            }
            const key = `${date}_${mealType}`;
            const menu = menuMap[key] || {};
            const mealLabel = mealType === 'lunch' ? 'Pranzo' : 'Cena';
            const fields = ['primo', 'secondo', 'contorno', 'dessert'];
            const extraControls = isExtra
                ? `<span class="menu-extra-badge">Extra</span>
                   <button class="btn btn-ghost btn-sm menu-extra-del-btn"
                       onclick="removeExtraMeal('${reservation.id}','${date}','${mealType}')"
                       title="Rimuovi pasto extra">
                       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                   </button>`
                : '';
            html += `<div class="menu-meal${isExtra ? ' menu-meal--extra' : ''}">
                <div class="menu-meal-type${isExtra ? ' menu-meal-type--extra' : ''}">${mealLabel}${extraControls}</div>
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
                        oninput="markMenusDirty()" onblur="saveMenuField(this)" placeholder="—">
                </div>`;
            });
            html += '</div></div>';
        });
        if (lastDate) html += '</div>';

        html += `<div class="menu-extra-section">
            <button class="btn btn-sm btn-secondary menu-extra-add-btn"
                    onclick="showAddExtraMealForm('${reservation.id}')">+ Aggiungi pasto extra</button>
            <div id="extraMealForm_${reservation.id}" class="menu-extra-form" style="display:none">
                <div class="menu-extra-form-row">
                    <input type="date" id="extraMealDate_${reservation.id}" class="form-control"
                        min="${reservation.checkin}" max="${reservation.checkout}"
                        value="${reservation.checkin}">
                    <select id="extraMealType_${reservation.id}" class="form-control">
                        <option value="dinner">Cena</option>
                        <option value="lunch">Pranzo</option>
                    </select>
                    <button class="btn btn-primary btn-sm"
                            onclick="confirmAddExtraMeal('${reservation.id}')">Aggiungi</button>
                    <button class="btn btn-ghost btn-sm"
                            onclick="cancelAddExtraMealForm('${reservation.id}')">Annulla</button>
                </div>
            </div>
        </div>`;

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
        markMenusDirty();
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
        markMenusDirty();
    }

    async function saveIntolerances(resId) {
        const { API, apiPut, getReservations } = requireDeps();
        const reservation = getReservations().find((item) => item.id === resId);
        if (!reservation) return false;
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
            setMenuSaveStatus('saved', 'Ultime modifiche salvate');
            return true;
        } catch (err) {
            console.error('Intolerances save error', err);
            setMenuSaveStatus('error', 'Errore nel salvataggio');
            return false;
        }
    }

    function reservationHasMeal(reservation, targetDate, targetMealType) {
        if (!reservation || reservation.resType === 'individual' || reservation.status === 'cancelled') return false;
        return getMealDays(reservation).some(({ date, mealType }) => date === targetDate && mealType === targetMealType);
    }

    function getSharedMealSummary(targetDate, targetMealType) {
        const { getReservations } = requireDeps();
        const participants = getReservations()
            .filter((reservation) => reservationHasMeal(reservation, targetDate, targetMealType))
            .sort((a, b) => (b.guestCount || 0) - (a.guestCount || 0) || (a.groupName || '').localeCompare(b.groupName || ''));

        const totalGuests = participants.reduce((sum, reservation) => sum + (Number(reservation.guestCount) || 0), 0);
        const intoleranceMap = new Map();

        participants.forEach((reservation) => {
            (reservation.intolerances || []).forEach((item) => {
                const label = (item.note || '').trim();
                const count = parseInt(item.count, 10) || 1;
                if (!label) return;

                const key = label.toLowerCase();
                if (!intoleranceMap.has(key)) {
                    intoleranceMap.set(key, { label, count: 0, groups: [] });
                }

                const entry = intoleranceMap.get(key);
                entry.count += count;
                const groupName = reservation.groupName || 'Gruppo senza nome';
                const existingGroup = entry.groups.find((group) => group.groupName === groupName);
                if (existingGroup) {
                    existingGroup.count += count;
                } else {
                    entry.groups.push({ groupName, count });
                }
            });
        });

        return {
            participants,
            totalGuests,
            intolerances: Array.from(intoleranceMap.values())
                .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        };
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
        const periodGroups = new Map();

        const planLabels = {
            BB: 'BB – Solo Colazione',
            HB: 'HB – Colazione & Cena',
            FB: 'FB – Colazione, Pranzo & Cena',
            FBC: 'FBC – Colazione, Pranzo al Sacco & Cena'
        };

        // Group meals by date maintaining order
        const dateOrder = [];
        const mealsByDate = new Map();
        days.forEach(({ date, mealType }) => {
            if (!mealsByDate.has(date)) {
                mealsByDate.set(date, []);
                dateOrder.push(date);
            }
            mealsByDate.get(date).push(mealType);
        });

        // Pre-compute summaries for all meals
        const mealSummaries = new Map();
        days.forEach(({ date, mealType }) => {
            mealSummaries.set(`${date}_${mealType}`, getSharedMealSummary(date, mealType));
        });

        let daysHtml = '';
        dateOrder.forEach((date) => {
            const mealTypes = mealsByDate.get(date);

            // Union of all groups across all meals of the day
            const dayGroupMap = new Map();
            mealTypes.forEach((mealType) => {
                const { participants } = mealSummaries.get(`${date}_${mealType}`);
                participants.forEach((p) => {
                    dayGroupMap.set(p.id, p);
                    periodGroups.set(p.id, p);
                });
            });

            daysHtml += `<div class="print-day"><div class="print-day-header">${formatDateDisplay(date)}</div>`;

            mealTypes.forEach((mealType) => {
                const menu = menuMap[`${date}_${mealType}`] || {};
                const mealLabel = mealType === 'lunch' ? 'Pranzo' : 'Cena';
                const fields = [['Primo', menu.primo], ['Secondo', menu.secondo], ['Contorno', menu.contorno], ['Dessert', menu.dessert]];
                const { participants, totalGuests } = mealSummaries.get(`${date}_${mealType}`);
                const hasVeggieBuffet = participants.some((item) => item.veggieBuffet);
                const veggieRow = hasVeggieBuffet ? '<tr><td class="print-field-label">Antipasto</td><td class="print-field-val print-veggie">Buffet di verdure</td></tr>' : '';

                const groupsHtml = participants.length > 0
                    ? participants.map((item) => `${escapeHtml(item.groupName || 'Gruppo senza nome')} (${item.guestCount || 0})`).join(' · ')
                    : 'Nessun gruppo associato';

                daysHtml += `<div class="print-meal">
                    <div class="print-meal-type">${mealLabel}</div>
                    <div class="print-service-meta">
                        <div class="print-service-total">Ospiti totali: <strong>${totalGuests}</strong></div>
                        <div class="print-service-groups">${groupsHtml}</div>
                    </div>
                    <table class="print-meal-table">
                        ${veggieRow}
                        ${fields.map(([label, val]) => `<tr><td class="print-field-label">${label}</td><td class="print-field-val">${escapeHtml(val || '—')}</td></tr>`).join('')}
                    </table>
                </div>`;
            });

            daysHtml += '</div>';
        });

        const periodGroupsHtml = Array.from(periodGroups.values())
            .sort((a, b) => (b.guestCount || 0) - (a.guestCount || 0) || (a.groupName || '').localeCompare(b.groupName || ''))
            .map((item) => `${escapeHtml(item.groupName || 'Gruppo senza nome')} (${item.guestCount || 0})`)
            .join(' · ');

        // Compute global intolerances once for the whole period
        const periodIntolMap = new Map();
        Array.from(periodGroups.values()).forEach((res) => {
            (res.intolerances || []).forEach((item) => {
                const label = (item.note || '').trim();
                const count = parseInt(item.count, 10) || 1;
                if (!label) return;
                const key = label.toLowerCase();
                if (!periodIntolMap.has(key)) {
                    periodIntolMap.set(key, { label, count: 0, groups: [] });
                }
                const entry = periodIntolMap.get(key);
                const groupName = res.groupName || 'Gruppo senza nome';
                const existing = entry.groups.find((g) => g.groupName === groupName);
                if (!existing) {
                    entry.count += count;
                    entry.groups.push({ groupName, count });
                }
            });
        });
        const periodIntolerances = Array.from(periodIntolMap.values())
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
        const periodIntolHtml = periodIntolerances.length > 0
            ? `<div class="print-period-intol">
                <span class="print-period-intol-title">Intolleranze / Esigenze Alimentari:</span>
                ${periodIntolerances.map((item) => {
                    const groupDetails = item.groups
                        .map((g) => `${escapeHtml(g.groupName)}: ${g.count}`)
                        .join(' · ');
                    return `<span class="print-period-intol-item"><strong>${item.count}</strong> × ${escapeHtml(item.label)} <span class="print-period-intol-groups">(${groupDetails})</span></span>`;
                }).join('')}
            </div>`
            : '';

        const html = `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8">
        <title>Menu condiviso – ${escapeHtml(reservation.groupName)}</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Georgia', serif; color: #1a1a1a; background: #fff; padding: 14px 18px; max-width: 860px; margin: 0 auto; font-size: 14.5px; line-height: 1.35; }
            .print-header { text-align: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a; }
            .print-hotel { font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; margin-bottom: 4px; }
            .print-group { font-size: 24px; font-weight: bold; margin-bottom: 3px; }
            .print-dates { font-size: 15px; color: #555; margin-bottom: 2px; }
            .print-plan { display: inline-block; margin-top: 5px; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; background: #f0f0f0; padding: 3px 10px; border-radius: 12px; color: #333; }
            .print-groups-line { margin-top: 6px; font-size: 13px; color: #333; line-height: 1.3; }
            .print-period-intol { margin-top: 10px; font-size: 13px; color: #7a5000; background: #fff8f0; border-left: 3px solid #e8a020; padding: 6px 10px; border-radius: 3px; line-height: 1.5; text-align: left; }
            .print-period-intol-title { font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #888; margin-right: 6px; }
            .print-period-intol-item { display: inline; margin-right: 12px; }
            .print-period-intol-groups { color: #999; font-size: 12px; }
            .print-day { margin-bottom: 14px; }
            .print-day-header { font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; }
            .print-meal { margin-bottom: 10px; padding-left: 10px; border-left: 3px solid #1a1a1a; break-inside: avoid; page-break-inside: avoid; }
            .print-meal-type { font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #1a1a1a; margin-bottom: 4px; }
            .print-service-meta { margin-bottom: 5px; padding: 5px 10px; background: #f7f7f7; border-radius: 3px; }
            .print-service-total { font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }
            .print-service-groups { font-size: 13px; color: #555; line-height: 1.3; }
            .print-meal-table { width: 100%; border-collapse: collapse; }
            .print-field-label { font-size: 13px; color: #888; width: 82px; padding: 2px 0; vertical-align: top; }
            .print-field-val { font-size: 15px; color: #1a1a1a; padding: 2px 0; }
            .print-veggie { color: #27ae60; font-style: italic; }
            .print-footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #aaa; }
            @page { margin: 6mm 8mm; }
            @media print {
                body { padding: 0; font-size: 14px; }
            }
        </style>
        </head><body>
        <div class="print-header">
            <div class="print-dates">${formatDateDisplay(reservation.checkin)} — ${formatDateDisplay(reservation.checkout)} &nbsp;·&nbsp; ${nightsBetween(reservation.checkin, reservation.checkout)} notti</div>
            <div class="print-plan">${planLabels[plan] || plan}</div>
            <div class="print-groups-line">${periodGroupsHtml || 'Nessun gruppo coinvolto nel periodo'}</div>
            ${periodIntolHtml}
        </div>
        ${daysHtml || '<p style="color:#888;text-align:center">Nessun menu da visualizzare</p>'}
        <div class="print-footer">Stampato il ${new Date().toLocaleDateString('it-IT')}</div>
        </body></html>`;

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 400);
    }

    function buildMenuEntryFromInputs(inputs, reservationId, date, mealType) {
        const { generateId } = requireDeps();
        const entry = { reservationId, date, mealType, primo: '', secondo: '', contorno: '', dessert: '' };
        let menuId = inputs.find((item) => item.dataset.mid)?.dataset.mid || '';
        if (!menuId) {
            menuId = generateId();
            inputs.forEach((item) => { item.dataset.mid = menuId; });
        }
        entry.id = menuId;
        inputs.forEach((item) => { entry[item.dataset.field] = item.value.trim(); });
        return entry;
    }

    function syncMenuInputsId(inputs, menuId) {
        if (!menuId) return;
        inputs.forEach((item) => { item.dataset.mid = menuId; });
    }

    async function saveMenuField(input) {
        const { API, apiPost } = requireDeps();
        const { resid, date, mealtype } = input.dataset;
        const allInputs = Array.from(document.querySelectorAll(
            `.menu-input[data-resid="${resid}"][data-date="${date}"][data-mealtype="${mealtype}"]`
        ));
        const entry = buildMenuEntryFromInputs(allInputs, resid, date, mealtype);
        try {
            const response = await apiPost(API.menus, entry);
            const savedMenu = response?.menu || entry;
            syncMenuInputsId(allInputs, savedMenu.id);
            upsertCachedMenu({ ...entry, ...savedMenu });
            setMenuSaveStatus('saved', 'Ultime modifiche salvate');
            return true;
        } catch (err) {
            console.error('Menu save error', err);
            setMenuSaveStatus('error', 'Errore nel salvataggio');
            return false;
        }
    }

    async function saveAllMenus(resId) {
        const { API, apiPost, showToast } = requireDeps();
        const inputs = Array.from(document.querySelectorAll(`.menu-input[data-resid="${resId}"]`));
        const groupedInputs = new Map();

        inputs.forEach((input) => {
            const key = `${input.dataset.date}_${input.dataset.mealtype}`;
            if (!groupedInputs.has(key)) groupedInputs.set(key, []);
            groupedInputs.get(key).push(input);
        });

        setMenuSaveStatus('saving', 'Salvataggio menu in corso...');
        let savedCount = 0;

        try {
            for (const [key, group] of groupedInputs.entries()) {
                const [date, mealType] = key.split('_');
                const entry = buildMenuEntryFromInputs(group, resId, date, mealType);
                const hasContent = [entry.primo, entry.secondo, entry.contorno, entry.dessert].some(Boolean);
                const hasExistingId = group.some((input) => input.dataset.mid);
                if (!hasContent && !hasExistingId) continue;
                const response = await apiPost(API.menus, entry);
                const savedMenu = response?.menu || entry;
                syncMenuInputsId(group, savedMenu.id);
                upsertCachedMenu({ ...entry, ...savedMenu });
                savedCount += 1;
            }

            const intolerancesSaved = await saveIntolerances(resId);
            if (!intolerancesSaved) throw new Error('intolleranze');

            setMenuSaveStatus('saved', 'Ultime modifiche salvate');
            showToast('Modifiche menu salvate', 'success');
            return true;
        } catch (err) {
            console.error('Save all menus error', err);
            setMenuSaveStatus('error', 'Errore nel salvataggio');
            showToast('Errore nel salvataggio del menu', 'error');
            return false;
        }
    }

    function showAddExtraMealForm(resId) {
        const form = document.getElementById(`extraMealForm_${resId}`);
        if (form) form.style.display = '';
    }

    function cancelAddExtraMealForm(resId) {
        const form = document.getElementById(`extraMealForm_${resId}`);
        if (form) form.style.display = 'none';
    }

    async function confirmAddExtraMeal(resId) {
        const dateInput = document.getElementById(`extraMealDate_${resId}`);
        const typeSelect = document.getElementById(`extraMealType_${resId}`);
        if (!dateInput || !typeSelect) return;
        const date = dateInput.value;
        const mealType = typeSelect.value;
        if (!date) return;
        await addExtraMeal(resId, date, mealType);
    }

    async function addExtraMeal(resId, date, mealType) {
        const { getReservations, setReservations, showToast } = requireDeps();
        const reservations = getReservations();
        const reservation = reservations.find((item) => item.id === resId);
        if (!reservation) return;

        const alreadyPresent = getMealDays(reservation).some(
            (d) => d.date === date && d.mealType === mealType
        );
        if (alreadyPresent) {
            showToast('Questo pasto è già presente nel menu', 'warning');
            return;
        }

        if (!reservation.extraMeals) reservation.extraMeals = [];
        reservation.extraMeals.push({ date, mealType });
        setReservations([...reservations]);
        const saved = await saveExtraMeals(resId);
        if (saved) {
            renderMenuSection(reservation, lastMenus || []);
            markMenusDirty();
        }
    }

    async function removeExtraMeal(resId, date, mealType) {
        const { getReservations, setReservations } = requireDeps();
        const reservations = getReservations();
        const reservation = reservations.find((item) => item.id === resId);
        if (!reservation || !reservation.extraMeals) return;
        reservation.extraMeals = reservation.extraMeals.filter(
            (e) => !(e.date === date && e.mealType === mealType)
        );
        setReservations([...reservations]);
        const saved = await saveExtraMeals(resId);
        if (saved) renderMenuSection(reservation, lastMenus || []);
    }

    async function saveExtraMeals(resId) {
        const { API, apiPut, getReservations } = requireDeps();
        const reservation = getReservations().find((item) => item.id === resId);
        if (!reservation) return false;
        try {
            await apiPut(API.reservations, { ...reservation, id: resId });
            setMenuSaveStatus('saved', 'Ultime modifiche salvate');
            return true;
        } catch (err) {
            console.error('Extra meal save error', err);
            setMenuSaveStatus('error', 'Errore nel salvataggio');
            return false;
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
        markMenusDirty,
        saveAllMenus,
        saveMenuField,
        showAddExtraMealForm,
        cancelAddExtraMealForm,
        confirmAddExtraMeal,
        addExtraMeal,
        removeExtraMeal,
        saveExtraMeals
    };
})(window);
