# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run login test in headed mode
npm run login

# Run login test with Allure report generation
npm run login:with-report

# Run a specific test file
npx playwright test tests/regression/study-management/study-management-left-actions.spec.ts

# Run tests matching a specific title pattern
npx playwright test --grep "TC001"

# Run with a specific project/browser
npx playwright test --project=chromium

# Run in headed mode
npx playwright test --headed

# Generate and open Allure report manually
npx allure generate allure-results --clean -o allure-report && npx allure open allure-report

# View Playwright HTML report
npx playwright show-report
```

## Environment Setup

Environment configs live in `config/env/{env}.json` (gitignored). The active environment is controlled by the `ENV` env var (defaults to `val`). Each env file follows the structure in `config/envLoader.ts` and contains `baseUrl`, `users[]`, and `timeout` settings.

A `.env` file (gitignored) is loaded via dotenv and can hold credentials as fallback. See `.env.example` for the expected shape.

## Architecture

### Fixture Layers

There are three fixture levels — use the right one for each test type:

- **`testFixture`** ([fixtures/testFixture.ts](fixtures/testFixture.ts)) — data only. Parses CSV scenario matching the `TC###` ID in the test title. Exposes `testData.raw`, `testData.resolved`, `testData.users`.
- **`authFixture`** ([fixtures/authFixture.ts](fixtures/authFixture.ts)) — auth only. Provides `authPage(username)` which creates a browser context with a cached storage state (no navigation).
- **`ctmsExecutionContext`** ([fixtures/ctmsExecutionContext.ts](fixtures/ctmsExecutionContext.ts)) — combined, production fixture. Provides both `testData` and `authPage`. The `authPage` here navigates to `/` with `waitUntil: "networkidle"` (required for Angular SPA hydration) and calls `AuthManager.resolveTenantIfRequired()` after navigation. **Always use this for CTMS tests.**

### Authentication & Session Caching

`auth/authManager.ts` implements a 3-step ADFS login flow (provider selection → credentials → tenant chooser). Storage states are cached at `auth/storageStates/{env}/{username}-{tenant}.json` with a 24-hour TTL. Session validity is verified with a headless browser before reuse. File-based locks prevent parallel login race conditions.

**Critical**: `resolveTenantIfRequired()` must be called _after_ navigation — the tenant chooser appears post-login and also on session restoration to a fresh page.

### Data-Driven Testing

Test data is stored as CSV files:

- `data/scenarios/*.csv` — test cases (rows keyed by `testId`)
- `data/reference/*.csv` — master reference data

Reference resolution: any field ending in `Ref` (e.g., `sponsorRef`) is automatically resolved by loading `data/reference/{field}s.csv` (e.g., `sponsors.csv`) and replacing the key with the full reference object. This happens transparently via `dataLoader.ts`.

The test ID (`TC001`, etc.) is extracted from the test title string — the format `"TC### – description"` is required for fixture-based data loading.

### Page Object Model

Navigation follows a strict hierarchy managed by separate classes:

```
NavigationBar → SubNavigation → StudyManagementSubMenu → StudyManagementPage → StudyManagementActions
```

- **NavigationBar** ([pages/components/NavigationBar.ts](pages/components/NavigationBar.ts)) — top-level menu
- **SubNavigation** ([pages/components/SubNavigation.ts](pages/components/SubNavigation.ts)) — Console submenu; requires `hoverConsole()` before clicking
- **StudyManagementSubMenu** ([pages/components/StudyManagementSubMenu.ts](pages/components/StudyManagementSubMenu.ts)) — Angular flyout; uses JS mouse movement + `evaluate()` to force visibility and click (Playwright's visibility check fails here due to Angular inline style overwrites)
- **StudyManagementPage** ([pages/console/study-management/StudyManagementPage.ts](pages/console/study-management/StudyManagementPage.ts)) — owns full navigation + page readiness, delegates action panel clicks to `StudyManagementActions`
- Page objects guard against repeat navigation with an `isNavigated` flag.

### Reporting

`reporters/allure-organizer.ts` is a custom Playwright reporter. It organizes Allure results into date/tag/env-based subdirectories under `allure-results/` and copies trend history from the previous run for Allure trend charts to work. Report path pattern: `allure-results/{PROJECT}/{YEAR}/{MM-Month}/{TAG}_{ENV}_{TIMESTAMP}/`.

### Path Aliases

TypeScript path aliases (configured in `tsconfig.json`) are used throughout. Use these instead of relative paths:

| Alias | Maps to |
|-------|---------|
| `@auth/*` | `auth/` |
| `@config/*` | `config/` |
| `@data/*` | `data/` |
| `@fixtures/*` | `fixtures/` |
| `@helpers/*` | `tests/_support/` |
| `@pages/*` | `pages/` |
| `@reporters/*` | `reporters/` |

### Key Constraints

- `workers: 1` — all tests run serially (by design; parallel auth caused lock contention)
- `headless: false` — intentionally headed during design/development phase
- `retries: 0` — no automatic retries; failures should be investigated
- Browsers: Chromium only (Firefox and WebKit are commented out in config)
