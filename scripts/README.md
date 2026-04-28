# Utility and legacy scripts

## Production app (unchanged)

- **Entry:** `server.js` (`npm start` → `node server.js`)
- **Backend:** `routes/`, `models/`, `services/`
- **Frontend:** `index.html` loads `public/sessionManager.js`, `public/userManager.js`
- **CSS build:** `tailwind.config.js` (for `npm run build:css`)

## Cleanup (one-time)

The following were **removed** from the repo as non-runtime utilities, old campaign DB tools, or duplicates. They were never `require()`’d by `server.js`. Recover any file from **git history** if you need it again.

**Node scripts (repo root, deleted):**

- `testLoginDirect.js`, `testLoginDebug.js`, `testExistingAuth.js`
- `setKnownPasswords.js`, `createTagCounters.js`, `viewMongoData.js`
- `create_admin_user.js`, `create_employees.js`
- `update_roles_with_employees_permission.js`, `update_admin_role.js` (previously contained a hardcoded connection string — if this was ever pushed publicly, **rotate the Atlas database user password**)
- `roleTemplates.js` (reference-only; not imported)

**Other (deleted):**

- `index.html.new` (backup)
- `test_user_manager.html`
- `TrichyGold_Job_Management_App_Presentation.html`
- `checkCampaignData.js` (local check script; was under `check*.js` gitignore pattern)

## Gitignored script names (see root `.gitignore`)

If you add new ad-hoc scripts, avoid names matching: `test_*.js`, `check*.js`, `debug*.js`, `fix*.js`, `seed*.js`, `create_test*.js` — or they will not be committed unless you rename them or change `.gitignore`.
