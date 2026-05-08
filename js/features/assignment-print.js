(function initAssignmentPrint(global) {
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

    function buildAssignmentMap(assignmentData) {
        const assignMap = {};
        (assignmentData || []).forEach((assignment) => {
            assignMap[assignment.roomId] = assignment;
        });
        return assignMap;
    }

    function getFloorKeys(floors) {
        return Object.keys(floors).sort((a, b) => {
            const floorA = Number.parseInt(a, 10) || 0;
            const floorB = Number.parseInt(b, 10) || 0;
            return floorA - floorB;
        });
    }

    function getFloorGroups(floorKeys, isCleaning) {
        const floorsPerPage = isCleaning ? 1 : 2;
        const groups = [];
        for (let i = 0; i < floorKeys.length; i += floorsPerPage) {
            groups.push(floorKeys.slice(i, i + floorsPerPage));
        }
        return groups;
    }

    function getCellValue(values, column) {
        const value = values && column ? values[column.id] : '';
        return value == null ? '' : String(value);
    }

    function renderCleaningHead(labels) {
        return `<thead><tr>
            <th class="print-cleaning-room-head">${labels.room}</th>
            <th class="print-cleaning-type-head">${labels.roomType}</th>
            <th class="print-cleaning-notes-head">${labels.notes}</th>
        </tr></thead>`;
    }

    function renderStandardHead(labels, plannerColumns, escape) {
        return `<thead><tr><th>${labels.room}</th>${plannerColumns.map((column) => `<th>${escape(column.name)}</th>`).join('')}</tr></thead>`;
    }

    function renderCleaningFloor(floor, floorRooms, context) {
        const { assignMap, escape, labels, plannerColumns } = context;
        const typeColumn = plannerColumns[0];
        let rows = `<tr class="print-cleaning-floor-row"><td class="print-cleaning-floor-label" colspan="3">${labels.floor} ${escape(floor)}</td></tr>`;

        floorRooms.forEach((room) => {
            const values = (assignMap[room.id] || {}).cellValues || {};
            const typeLabel = getCellValue(values, typeColumn);
            rows += `<tr class="print-cleaning-room-row">
                <td class="print-cleaning-room-cell">${escape(room.number)}</td>
                <td class="print-cleaning-type-cell">${escape(typeLabel)}</td>
                <td class="print-cleaning-notes-cell"></td>
            </tr>`;
        });

        return rows;
    }

    function renderStandardFloor(floor, floorRooms, context) {
        const { assignMap, escape, labels, plannerColumns } = context;
        const colCount = 1 + plannerColumns.length;
        let rows = `<tr class="print-floor-row"><td colspan="${colCount}"><span class="print-floor-badge">${labels.floor} ${escape(floor)}</span></td></tr>`;

        floorRooms.forEach((room) => {
            const values = (assignMap[room.id] || {}).cellValues || {};
            rows += `<tr class="print-room-row">
                <td class="print-room-cell">${escape(room.number)}</td>
                ${plannerColumns.map((column) => `<td class="print-value-cell">${escape(getCellValue(values, column))}</td>`).join('')}
            </tr>`;
        });

        return rows;
    }

    function renderPages({ floors, floorGroups, isCleaning, theadHtml, context }) {
        return floorGroups.map((group) => {
            const rows = group.map((floor) => {
                return isCleaning
                    ? renderCleaningFloor(floor, floors[floor], context)
                    : renderStandardFloor(floor, floors[floor], context);
            }).join('');
            const pageClass = isCleaning ? 'print-cleaning-page' : 'print-standard-page';
            const tableClass = isCleaning ? 'print-cleaning-table' : 'print-assign-table';
            return `<div class="page-block ${pageClass}"><table class="${tableClass}">${theadHtml}<tbody>${rows}</tbody></table></div>`;
        }).join('');
    }

    function buildStyles(isCleaning) {
        const pageRule = isCleaning
            ? '@page { size: A4 landscape; margin: 0; }'
            : '@page { margin: 0; }';

        return `
            ${pageRule}
            * { box-sizing: border-box; }
            body { font-family: "Helvetica Neue", Helvetica, sans-serif; margin: 0; padding: 0; color: #111; background: #fff; }
            table { border-collapse: collapse; width: 100%; table-layout: fixed; }
            th, td { vertical-align: middle; overflow-wrap: anywhere; }
            tr { page-break-inside: avoid; break-inside: avoid; }
            .page-block { page-break-after: always; break-after: page; }
            .page-block:last-child { page-break-after: avoid; break-after: avoid; }

            .print-cleaning-page { padding: 4mm 6mm; }
            .print-cleaning-table { border: 1.5px solid #111; }
            .print-cleaning-table th { padding: 6px 10px; font-size: 18px; line-height: 1.05; text-align: left; font-weight: 750; border: 1.5px solid #111; color: #111; background: #fff; }
            .print-cleaning-room-head, .print-cleaning-room-cell { width: 18%; }
            .print-cleaning-type-head, .print-cleaning-type-cell { width: 25%; }
            .print-cleaning-notes-head, .print-cleaning-notes-cell { width: 57%; }
            .print-cleaning-floor-label { padding: 7px 10px; font-size: 30px; line-height: 1; font-weight: 800; border: 1.5px solid #111; color: #111; background: #fff; }
            .print-cleaning-room-cell { padding: 6px 10px; font-size: 22px; line-height: 1.05; font-weight: 850; border: 1.5px solid #111; color: #111; background: #fff; }
            .print-cleaning-type-cell, .print-cleaning-notes-cell { padding: 6px 10px; font-size: 20px; line-height: 1.05; font-weight: 500; border: 1.5px solid #111; color: #111; background: #fff; }

            .print-standard-page { padding: 7mm 10mm; }
            .print-assign-table { border: 2px solid #111; }
            .print-assign-table th { padding: 7px 10px; text-align: left; font-size: 11.5px; line-height: 1.2; font-weight: 650; text-transform: uppercase; border-bottom: 2px solid #111; color: #111; background: #fff; }
            .print-floor-row td { padding: 8px 10px; border-top: 2px solid #111; border-bottom: 2px solid #111; color: #111; background: #fff; }
            .print-floor-badge { display: block; font-size: 22px; line-height: 1.05; font-weight: 700; color: #111; background: #fff; }
            .print-room-cell, .print-value-cell { padding: 7px 10px; font-size: 12.5px; line-height: 1.25; border-bottom: 1.5px solid #333; color: #111; background: #fff; }
            .print-room-cell { font-weight: 700; width: 72px; }
            .print-value-cell { font-weight: 400; }
            .print-assign-table tbody tr:last-child td { border-bottom: none; }
        `;
    }

    function buildAssignmentPrintDocument(options) {
        const {
            reservation = {},
            rooms = [],
            assignmentData = [],
            plannerColumns = [],
            mode,
            labels = {},
            escapeHtml
        } = options || {};
        const escape = getEscape(escapeHtml);
        const isCleaning = mode === 'cleaning';
        const safeLabels = {
            room: escape(labels.room || 'Room'),
            roomType: escape(labels.roomType || 'Type'),
            notes: escape(labels.notes || 'Notes'),
            floor: escape(labels.floor || 'Floor'),
            printCleaning: escape(labels.printCleaning || 'Cleaning')
        };
        const floors = groupRoomsByFloor(rooms);
        const floorKeys = getFloorKeys(floors);
        const floorGroups = getFloorGroups(floorKeys, isCleaning);
        const assignMap = buildAssignmentMap(assignmentData);
        const context = { assignMap, escape, labels: safeLabels, plannerColumns };
        const theadHtml = isCleaning
            ? renderCleaningHead(safeLabels)
            : renderStandardHead(safeLabels, plannerColumns, escape);
        const pages = renderPages({ floors, floorGroups, isCleaning, theadHtml, context });
        const groupName = escape(reservation.groupName || '');
        const title = isCleaning ? `${groupName} - ${safeLabels.printCleaning}` : groupName;

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
        <style>${buildStyles(isCleaning)}</style></head><body>
        ${pages}
        <script>window.onload=function(){window.print();}<\/script>
    </body></html>`;
    }

    global.GroupStayAssignmentPrint = {
        buildAssignmentPrintDocument
    };
})(window);
