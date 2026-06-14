(function initRoomStatusPrint(global) {
    'use strict';

    function fallbackEscape(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getEscape(escapeHtml) {
        return typeof escapeHtml === 'function' ? escapeHtml : fallbackEscape;
    }

    function sortRooms(roomList) {
        return [...(roomList || [])].sort((a, b) => {
            const floorA = Number.parseInt(a.floor, 10) || 0;
            const floorB = Number.parseInt(b.floor, 10) || 0;
            if (floorA !== floorB) return floorA - floorB;
            return String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true });
        });
    }

    function groupRoomsByFloor(roomList) {
        const floors = {};
        sortRooms(roomList).forEach((room) => {
            const floor = room.floor == null ? '' : String(room.floor);
            if (!floors[floor]) floors[floor] = [];
            floors[floor].push(room);
        });
        return floors;
    }

    function getFloorKeys(floors) {
        return Object.keys(floors).sort((a, b) => {
            const floorA = Number.parseInt(a, 10) || 0;
            const floorB = Number.parseInt(b, 10) || 0;
            return floorA - floorB;
        });
    }

    // Build a roomId -> { departures[], stays[], arrivals[] } map for the given date.
    function buildOccupancyMap(reservations, guests, dateStr) {
        const map = {};
        const ensure = (id) => (map[id] || (map[id] = { departures: [], stays: [], arrivals: [] }));
        (reservations || []).forEach((reservation) => {
            if (reservation.status !== 'confirmed' && reservation.status !== 'checked-in') return;
            const assignedIds = reservation.roomIds && reservation.roomIds.length > 0
                ? reservation.roomIds
                : [...new Set((guests || [])
                    .filter((guest) => guest.reservationId === reservation.id && guest.roomId)
                    .map((guest) => guest.roomId))];
            const item = { name: reservation.groupName || '', resId: reservation.id };
            assignedIds.forEach((roomId) => {
                const entry = ensure(roomId);
                if (reservation.checkout === dateStr) entry.departures.push(item);
                // "stays" = guests already in house continuing tonight (arrived before today)
                if (reservation.checkin < dateStr && reservation.checkout > dateStr) entry.stays.push(item);
                if (reservation.checkin === dateStr) entry.arrivals.push(item);
            });
        });
        return map;
    }

    // Returns { status: 'deep'|'touchup'|'empty'|'maintenance', label, detail }
    function resolveRoomStatus(room, occupancy, labels) {
        if (room.status === 'maintenance') {
            return { status: 'maintenance', label: labels.maintenance, detail: '' };
        }
        const occ = occupancy || { departures: [], stays: [], arrivals: [] };
        const names = (list) => list.map((it) => it.name).join(', ');
        const details = [];
        let status;
        if (occ.departures.length > 0) {
            // Departure today -> full clean. Note any same-day arrival for the turnover.
            status = 'deep';
            details.push(`${labels.departure}: ${names(occ.departures)}`);
            if (occ.arrivals.length > 0) details.push(`${labels.arrival}: ${names(occ.arrivals)}`);
        } else if (occ.arrivals.length > 0) {
            // New arrival into an otherwise free room -> prepare for arrival.
            status = 'arrival';
            details.push(`${labels.arrival}: ${names(occ.arrivals)}`);
        } else if (occ.stays.length > 0) {
            status = 'touchup';
            details.push(`${labels.inHouse}: ${names(occ.stays)}`);
        } else {
            status = 'empty';
        }
        const labelByStatus = {
            deep: labels.deep,
            arrival: labels.arrivalStatus,
            touchup: labels.touchup,
            empty: labels.empty
        };
        return { status, label: labelByStatus[status] || labels.empty, detail: details.join(' · ') };
    }

    function renderHead(labels) {
        return `<thead><tr>
            <th class="rs-room-head">${labels.room}</th>
            <th class="rs-type-head">${labels.type}</th>
            <th class="rs-status-head">${labels.status}</th>
            <th class="rs-detail-head">${labels.detail}</th>
            <th class="rs-notes-head">${labels.notes}</th>
        </tr></thead>`;
    }

    // Pick the reservation whose recorded usage best describes how the room must be
    // prepared today: an incoming guest first, then a staying guest, then a departure.
    function pickUsageResId(occ) {
        if (occ.arrivals.length > 0) return occ.arrivals[0].resId;
        if (occ.stays.length > 0) return occ.stays[0].resId;
        if (occ.departures.length > 0) return occ.departures[0].resId;
        return null;
    }

    function resolveTypeLabel(room, occ, context) {
        const { assignmentMap, usageColumnId, roomTypeLabels } = context;
        const usageResId = pickUsageResId(occ);
        if (usageResId) {
            const cellValues = assignmentMap[`${usageResId}|${room.id}`];
            const usage = cellValues ? cellValues[usageColumnId] : '';
            if (usage != null && String(usage).trim() !== '') return String(usage);
        }
        return (roomTypeLabels && roomTypeLabels[room.type]) || room.type || '';
    }

    function renderFloor(floor, floorRooms, context) {
        const { escape, labels, occupancyMap, statusLabels } = context;
        let rows = `<tr class="rs-floor-row"><td class="rs-floor-label" colspan="5">${labels.floor} ${escape(floor)}</td></tr>`;
        floorRooms.forEach((room) => {
            const occ = occupancyMap[room.id] || { departures: [], stays: [], arrivals: [] };
            const resolved = resolveRoomStatus(room, occ, statusLabels);
            const typeLabel = resolveTypeLabel(room, occ, context);
            rows += `<tr class="rs-room-row">
                <td class="rs-room-cell">${escape(room.number)}</td>
                <td class="rs-type-cell">${escape(typeLabel)}</td>
                <td class="rs-status-cell rs-status-${resolved.status}">${escape(resolved.label)}</td>
                <td class="rs-detail-cell">${escape(resolved.detail)}</td>
                <td class="rs-notes-cell"></td>
            </tr>`;
        });
        return rows;
    }

    function buildLegend(statusLabels) {
        return `<div class="rs-legend">
            <span class="rs-legend-item"><span class="rs-legend-swatch rs-status-deep"></span>${statusLabels.deep}</span>
            <span class="rs-legend-item"><span class="rs-legend-swatch rs-status-arrival"></span>${statusLabels.arrivalStatus}</span>
            <span class="rs-legend-item"><span class="rs-legend-swatch rs-status-touchup"></span>${statusLabels.touchup}</span>
            <span class="rs-legend-item"><span class="rs-legend-swatch rs-status-empty"></span>${statusLabels.empty}</span>
        </div>`;
    }

    function buildStyles() {
        return `
            @page { margin: 0; }
            * { box-sizing: border-box; }
            body { font-family: "Helvetica Neue", Helvetica, sans-serif; margin: 0; padding: 7mm 9mm; color: #111; background: #fff; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            th, td { vertical-align: middle; overflow-wrap: anywhere; }
            tr { page-break-inside: avoid; break-inside: avoid; }

            .rs-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
            .rs-title { font-size: 22px; font-weight: 800; }
            .rs-date { font-size: 16px; font-weight: 600; }
            .rs-legend { display: flex; gap: 18px; margin-bottom: 10px; font-size: 13px; font-weight: 600; }
            .rs-legend-item { display: inline-flex; align-items: center; gap: 6px; }
            .rs-legend-swatch { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #111; }

            .rs-table { border: 1.5px solid #111; }
            .rs-table th { padding: 6px 10px; font-size: 13px; line-height: 1.1; text-align: left; font-weight: 750; border: 1.5px solid #111; }
            .rs-room-head, .rs-room-cell { width: 10%; }
            .rs-type-head, .rs-type-cell { width: 16%; }
            .rs-status-head, .rs-status-cell { width: 18%; }
            .rs-detail-head, .rs-detail-cell { width: 30%; }
            .rs-notes-head, .rs-notes-cell { width: 26%; }

            .rs-floor-label { padding: 7px 10px; font-size: 22px; line-height: 1; font-weight: 800; border: 1.5px solid #111; background: #f0f0f0; }
            .rs-room-cell { padding: 6px 10px; font-size: 18px; line-height: 1.05; font-weight: 850; border: 1.5px solid #111; }
            .rs-type-cell { padding: 6px 10px; font-size: 15px; line-height: 1.05; font-weight: 600; border: 1.5px solid #111; }
            .rs-status-cell { padding: 6px 10px; font-size: 16px; line-height: 1.05; font-weight: 750; border: 1.5px solid #111; }
            .rs-detail-cell { padding: 6px 10px; font-size: 13px; line-height: 1.15; font-weight: 500; border: 1.5px solid #111; }
            .rs-notes-cell { border: 1.5px solid #111; }

            .rs-status-deep { background: #d8d8d8; }
            .rs-status-arrival { background: #c4c4c4; }
            .rs-status-touchup { background: #eeeeee; }
            .rs-status-empty { background: #ffffff; color: #555; }
            .rs-status-maintenance { background: #ffffff; color: #555; font-style: italic; }
            .rs-legend-swatch.rs-status-empty { background: #fff; }
        `;
    }

    function buildRoomStatusPrintDocument(options) {
        const {
            date = new Date(),
            dateLabel = '',
            rooms = [],
            reservations = [],
            guests = [],
            assignments = [],
            usageColumnId = 'usage',
            labels = {},
            roomTypeLabels = {},
            escapeHtml
        } = options || {};
        const escape = getEscape(escapeHtml);

        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

        const headLabels = {
            room: escape(labels.room || 'Room'),
            type: escape(labels.type || 'Type'),
            status: escape(labels.status || 'Status'),
            detail: escape(labels.detail || 'Detail'),
            notes: escape(labels.notes || 'Notes'),
            floor: escape(labels.floor || 'Floor')
        };
        const statusLabels = {
            deep: escape(labels.deep || 'Deep clean'),
            arrivalStatus: escape(labels.arrivalStatus || 'Arrival'),
            touchup: escape(labels.touchup || 'Touch-up'),
            empty: escape(labels.empty || 'Empty'),
            maintenance: escape(labels.maintenance || 'Maintenance'),
            departure: escape(labels.departure || 'Departure'),
            arrival: escape(labels.arrival || 'Arrival'),
            inHouse: escape(labels.inHouse || 'In house')
        };
        const assignmentMap = {};
        (assignments || []).forEach((a) => {
            if (a && a.reservationId != null && a.roomId != null) {
                assignmentMap[`${a.reservationId}|${a.roomId}`] = a.cellValues || {};
            }
        });

        const floors = groupRoomsByFloor(rooms);
        const floorKeys = getFloorKeys(floors);
        const occupancyMap = buildOccupancyMap(reservations, guests, dateStr);
        const context = {
            escape,
            labels: headLabels,
            occupancyMap,
            statusLabels,
            roomTypeLabels: roomTypeLabels || {},
            assignmentMap,
            usageColumnId
        };

        const body = floorKeys.map((floor) => renderFloor(floor, floors[floor], context)).join('');
        const title = `${escape(labels.title || 'Daily room status')} — ${escape(dateLabel || dateStr)}`;

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>${buildStyles()}</style></head><body>
        <div class="rs-header">
            <span class="rs-title">${escape(labels.title || 'Daily room status')}</span>
            <span class="rs-date">${escape(dateLabel || dateStr)}</span>
        </div>
        ${buildLegend(statusLabels)}
        <table class="rs-table">${renderHead(headLabels)}<tbody>${body}</tbody></table>
        <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
    }

    global.GroupStayRoomStatusPrint = {
        buildRoomStatusPrintDocument
    };
})(window);
