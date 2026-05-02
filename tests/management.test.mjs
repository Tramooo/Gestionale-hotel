import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createElement() {
    return {
        innerHTML: '',
        style: {},
        textContent: ''
    };
}

function loadManagementFeature() {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        }
    };
    const context = {
        document,
        window: {}
    };

    vm.runInNewContext(fs.readFileSync('js/features/management.js', 'utf8'), context);
    return { elements, management: context.window.GroupStayManagement };
}

test('employee cost card and breakdown follow the selected employee month', () => {
    const { elements, management } = loadManagementFeature();
    const employees = [{ id: 'emp-1', firstName: 'Ada', lastName: 'Rossi', payType: 'hourly', payRate: 10 }];
    const workEntries = [
        { employeeId: 'emp-1', workDate: '2026-01-03', hours: 2 },
        { employeeId: 'emp-1', workDate: '2026-02-03', hours: 5 }
    ];
    const viewMonth = new Date(2026, 0, 1);

    management.init({
        calcEstimatedPay(employee, daysWorked, totalHours) {
            return employee.payType === 'hourly' ? totalHours * employee.payRate : (employee.payRate / 30) * daysWorked;
        },
        escapeHtml(value) {
            return String(value);
        },
        getDaysInMonth() {
            return 31;
        },
        getEmployeeAdvances() {
            return [];
        },
        getEmployeeMonthStats(empId, year, month) {
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const entries = workEntries.filter((entry) => entry.employeeId === empId && entry.workDate.startsWith(monthStr));
            return {
                daysWorked: entries.length,
                entries,
                totalHours: entries.reduce((sum, entry) => sum + entry.hours, 0)
            };
        },
        getEmployees() {
            return employees;
        },
        getEmpMonthPay(employee) {
            return { payType: employee.payType, payRate: employee.payRate };
        },
        getEmpViewMonth() {
            return viewMonth;
        },
        getMonthPayOverrides() {
            return [];
        },
        getReservations() {
            return [];
        },
        getWorkEntries() {
            return workEntries;
        },
        nightsBetween() {
            return 0;
        },
        renderEmployees() {},
        t(key) {
            if (key === 'months.full') return ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            return key;
        }
    });

    management.renderManagement();

    assert.equal(elements.get('stat-emp-cost').textContent, '€20');
    assert.match(elements.get('empCostBreakdown').innerHTML, /Gennaio 2026/);
    assert.match(elements.get('empCostBreakdown').innerHTML, /empMonthNav\(-1\)/);
    assert.match(elements.get('empCostBreakdown').innerHTML, /empMonthNav\(1\)/);
});
