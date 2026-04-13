# GroupStay Architecture Notes

The frontend has moved from a single-file setup toward a layered structure without a full rewrite.

## Current frontend structure

- `index.html`
  App shell, static page markup, modal markup, page containers, script loading order.

- `style.css`
  Shared design tokens, layout rules, component styles, print styles.

- `script.js`
  Remaining application glue:
  - shared state
  - translations
  - dashboard
  - guests
  - files
  - compliance
  - employee management
  - calendar/planner
  - wiring between modules

- `js/core/config.js`
  Domain constants and API endpoint map.

- `js/core/api-client.js`
  Shared frontend HTTP helpers.

- `js/core/utils.js`
  Reusable pure utilities such as dates, ids, nights calculation, and HTML escaping.

- `js/ui/feedback.js`
  Shared modal, loading, toast, and overlay behavior.

- `js/ui/datepicker.js`
  Reusable mini calendar / date picker behavior.

- `js/features/rooms.js`
  Rooms page rendering and room CRUD modal behavior.

- `js/features/menus.js`
  Reservation menu rendering, intolerance editing, menu persistence, and menu printing.

- `js/features/reservations-list.js`
  Reservation list rendering and list filtering.

- `js/features/reservation-rooms.js`
  Group reservation room occupancy map and room checklist behavior.

- `js/features/individual-reservation.js`
  Individual reservation form workflow.

- `js/features/group-reservation.js`
  Group reservation form workflow and reservation deletion.

## Current backend structure

- `api/*.js`
  Serverless route handlers for reservations, rooms, guests, files, menus, employees, compliance, assignments, and initialization.

- `api/_db.js`
  Shared database connection helper.

## Refactor outcome so far

The project is still not fully modular, but the highest-churn frontend areas are no longer all embedded directly in `script.js`.
This reduces risk when changing:

- rooms
- reservation menus
- reservation list filtering
- reservation room selection
- individual reservations
- group reservation forms
- shared UI behaviors

## Recommended next steps

1. Extract the next high-value blocks from `script.js`:
   - reservation files
   - reservation detail view
   - guests list / guest form
   - dashboard

2. Create more core services:
   - `js/core/cache.js`
   - `js/core/i18n.js`
   - `js/core/dom.js`

3. Standardize backend helpers:
   - `api/_validators.js`
   - `api/_serializers.js`
   - optional repository/service split for larger routes

4. Add a real dev/test workflow:
   - local env file
   - preview/staging deploy
   - smoke test checklist
   - a first set of business-logic tests

This refactor path keeps the site working while steadily replacing the monolith with maintainable modules.
