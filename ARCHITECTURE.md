# GroupStay Architecture Notes

This repo is still mostly monolithic, but the structure is now split into clearer layers:

- `index.html`: page shell, modal markup, page containers
- `style.css`: shared tokens and visual styling
- `js/core/config.js`: endpoints and domain constants
- `js/core/api-client.js`: shared frontend HTTP helpers
- `script.js`: application state, rendering, feature logic
- `api/*.js`: serverless endpoints

Recommended next steps:

1. Split `script.js` by feature:
   - `js/features/reservations.js`
   - `js/features/rooms.js`
   - `js/features/menus.js`
   - `js/features/employees.js`
   - `js/features/compliance.js`

2. Extract shared frontend services:
   - `js/core/cache.js`
   - `js/core/i18n.js`
   - `js/core/formatters.js`
   - `js/core/dom.js`

3. Standardize backend helpers:
   - `api/_db.js`
   - `api/_validators.js`
   - `api/_serializers.js`

4. Add smoke tests for critical business flows before larger rewrites.

This first step improves maintainability without forcing a risky rewrite.
