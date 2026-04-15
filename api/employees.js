import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

  async function getEmployeesWithSafeOrdering() {
    try {
      return await sql`SELECT * FROM employees WHERE owner_user_id = ${user.id} ORDER BY COALESCE(display_order, 0), last_name, first_name`;
    } catch (error) {
      if (!String(error.message || '').toLowerCase().includes('display_order')) throw error;
      return await sql`SELECT * FROM employees WHERE owner_user_id = ${user.id} ORDER BY last_name, first_name`;
    }
  }

  try {
    if (req.method === 'GET') {
      const employees = await getEmployeesWithSafeOrdering();
      const workEntries = await sql`SELECT * FROM work_entries WHERE owner_user_id = ${user.id} ORDER BY work_date DESC`;
      const monthOverrides = await sql`SELECT * FROM employee_month_overrides WHERE owner_user_id = ${user.id} ORDER BY year_month DESC`;
      return res.status(200).json({
        employees: employees.map(e => ({
          id: e.id,
          firstName: e.first_name,
          lastName: e.last_name,
          displayOrder: Number.isFinite(parseInt(e.display_order, 10)) ? parseInt(e.display_order, 10) : 0,
          role: e.role,
          payType: e.pay_type,
          payRate: parseFloat(e.pay_rate) || 0,
          phone: e.phone,
          email: e.email,
          notes: e.notes,
        })),
        workEntries: workEntries.map(w => ({
          id: w.id,
          employeeId: w.employee_id,
          workDate: w.work_date ? new Date(w.work_date).toISOString().split('T')[0] : null,
          hours: parseFloat(w.hours) || 0,
          notes: w.notes,
          startTime: w.start_time || null,
          endTime: w.end_time || null,
          startTime2: w.start_time_2 || null,
          endTime2: w.end_time_2 || null,
        })),
        monthOverrides: monthOverrides.map(o => ({
          id: o.id,
          employeeId: o.employee_id,
          yearMonth: o.year_month,
          payType: o.pay_type,
          payRate: parseFloat(o.pay_rate) || 0,
        }))
      });
    }

    if (req.method === 'POST') {
      const { type } = req.query;

      if (type === 'work') {
        const w = req.body;
        await sql`
          INSERT INTO work_entries (id, owner_user_id, employee_id, work_date, hours, notes, start_time, end_time, start_time_2, end_time_2)
          VALUES (${w.id}, ${user.id}, ${w.employeeId}, ${w.workDate}, ${w.hours || 0}, ${w.notes || null}, ${w.startTime || null}, ${w.endTime || null}, ${w.startTime2 || null}, ${w.endTime2 || null})
        `;
        return res.status(201).json({ success: true });
      }

      if (type === 'monthOverride') {
        const o = req.body;
        await sql`
          INSERT INTO employee_month_overrides (id, owner_user_id, employee_id, year_month, pay_type, pay_rate)
          VALUES (${o.id}, ${user.id}, ${o.employeeId}, ${o.yearMonth}, ${o.payType}, ${o.payRate || 0})
          ON CONFLICT (employee_id, year_month) DO UPDATE SET pay_type=${o.payType}, pay_rate=${o.payRate || 0}, id=${o.id}, owner_user_id=${user.id}
        `;
        return res.status(201).json({ success: true });
      }

      if (type === 'reorder') {
        const employees = Array.isArray(req.body?.employees) ? req.body.employees : [];
        await Promise.all(employees.map((employee, index) => sql`
          UPDATE employees
          SET display_order = ${Number.isFinite(employee.displayOrder) ? employee.displayOrder : index}
          WHERE id = ${employee.id} AND owner_user_id = ${user.id}
        `));
        return res.status(200).json({ success: true });
      }

      const e = req.body;
      const nextOrderRow = await sql`SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM employees WHERE owner_user_id = ${user.id}`;
      const nextOrder = parseInt(nextOrderRow[0]?.next_order, 10) || 0;
      await sql`
        INSERT INTO employees (id, owner_user_id, first_name, last_name, display_order, role, pay_type, pay_rate, phone, email, notes)
        VALUES (${e.id}, ${user.id}, ${e.firstName}, ${e.lastName}, ${e.displayOrder ?? nextOrder}, ${e.role || null}, ${e.payType}, ${e.payRate || 0}, ${e.phone || null}, ${e.email || null}, ${e.notes || null})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { type } = req.query;

      if (type === 'work') {
        const w = req.body;
        await sql`
          UPDATE work_entries SET employee_id=${w.employeeId}, work_date=${w.workDate},
          hours=${w.hours || 0}, notes=${w.notes || null}, start_time=${w.startTime || null}, end_time=${w.endTime || null},
          start_time_2=${w.startTime2 || null}, end_time_2=${w.endTime2 || null}
          WHERE id=${w.id} AND owner_user_id = ${user.id}
        `;
        return res.status(200).json({ success: true });
      }

      if (type === 'reorder') {
        const employees = Array.isArray(req.body?.employees) ? req.body.employees : [];
        await Promise.all(employees.map((employee, index) => sql`
          UPDATE employees
          SET display_order = ${Number.isFinite(employee.displayOrder) ? employee.displayOrder : index}
          WHERE id = ${employee.id} AND owner_user_id = ${user.id}
        `));
        return res.status(200).json({ success: true });
      }

      const e = req.body;
      await sql`
        UPDATE employees SET first_name=${e.firstName}, last_name=${e.lastName},
        display_order=${e.displayOrder ?? 0}, role=${e.role || null}, pay_type=${e.payType}, pay_rate=${e.payRate || 0},
        phone=${e.phone || null}, email=${e.email || null}, notes=${e.notes || null}
        WHERE id=${e.id} AND owner_user_id = ${user.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id, type } = req.query;
      if (type === 'work') {
        await sql`DELETE FROM work_entries WHERE id = ${id} AND owner_user_id = ${user.id}`;
      } else if (type === 'monthOverride') {
        await sql`DELETE FROM employee_month_overrides WHERE id = ${id} AND owner_user_id = ${user.id}`;
      } else {
        await sql`DELETE FROM employees WHERE id = ${id} AND owner_user_id = ${user.id}`;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Employees API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
