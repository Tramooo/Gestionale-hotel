import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const employees = await sql`SELECT * FROM employees ORDER BY last_name, first_name`;
      const workEntries = await sql`SELECT * FROM work_entries ORDER BY work_date DESC`;
      const monthOverrides = await sql`SELECT * FROM employee_month_overrides ORDER BY year_month DESC`;
      return res.status(200).json({
        employees: employees.map(e => ({
          id: e.id,
          firstName: e.first_name,
          lastName: e.last_name,
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
          INSERT INTO work_entries (id, employee_id, work_date, hours, notes, start_time, end_time)
          VALUES (${w.id}, ${w.employeeId}, ${w.workDate}, ${w.hours || 0}, ${w.notes || null}, ${w.startTime || null}, ${w.endTime || null})
        `;
        return res.status(201).json({ success: true });
      }

      if (type === 'monthOverride') {
        const o = req.body;
        await sql`
          INSERT INTO employee_month_overrides (id, employee_id, year_month, pay_type, pay_rate)
          VALUES (${o.id}, ${o.employeeId}, ${o.yearMonth}, ${o.payType}, ${o.payRate || 0})
          ON CONFLICT (employee_id, year_month) DO UPDATE SET pay_type=${o.payType}, pay_rate=${o.payRate || 0}, id=${o.id}
        `;
        return res.status(201).json({ success: true });
      }

      const e = req.body;
      await sql`
        INSERT INTO employees (id, first_name, last_name, role, pay_type, pay_rate, phone, email, notes)
        VALUES (${e.id}, ${e.firstName}, ${e.lastName}, ${e.role || null}, ${e.payType}, ${e.payRate || 0}, ${e.phone || null}, ${e.email || null}, ${e.notes || null})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { type } = req.query;

      if (type === 'work') {
        const w = req.body;
        await sql`
          UPDATE work_entries SET employee_id=${w.employeeId}, work_date=${w.workDate},
          hours=${w.hours || 0}, notes=${w.notes || null}, start_time=${w.startTime || null}, end_time=${w.endTime || null}
          WHERE id=${w.id}
        `;
        return res.status(200).json({ success: true });
      }

      const e = req.body;
      await sql`
        UPDATE employees SET first_name=${e.firstName}, last_name=${e.lastName},
        role=${e.role || null}, pay_type=${e.payType}, pay_rate=${e.payRate || 0},
        phone=${e.phone || null}, email=${e.email || null}, notes=${e.notes || null}
        WHERE id=${e.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id, type } = req.query;
      if (type === 'work') {
        await sql`DELETE FROM work_entries WHERE id = ${id}`;
      } else if (type === 'monthOverride') {
        await sql`DELETE FROM employee_month_overrides WHERE id = ${id}`;
      } else {
        await sql`DELETE FROM employees WHERE id = ${id}`;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Employees API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
