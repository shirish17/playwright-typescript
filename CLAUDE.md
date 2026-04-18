# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm ci

# Install Playwright browsers
npx playwright install --with-deps

# Run all tests
npx playwright test

# Run a single test file
npx playwright test tests/regression/study-management/study-management-left-actions.spec.ts

# Run tests matching a title pattern
npx playwright test --grep "TC001"

# Run tests with a specific tag (via .env TEST_TAG)
TEST_TAG=regression npx playwright test

# Run tests against a specific environment
TEST_ENV=uat npx playwright test

# Run tests headed (browser visible)
npx playwright test --headed

# Open Playwright HTML report
npx playwright show-report

# Generate and open Allure report
npx allure generate allure-results --clean -o allure-report && npx allure open allure-report
```

## Environment Setup

Copy `config/env/val.json` as a reference. The active environment is controlled by `.env`:

```
PROJECT_NAME=CRO
TEST_ENV=val        # val | uat | dev
TEST_TAG=regression
```

Each env file (`config/env/{env}.json`) holds `baseUrl`, `users` (array with username/password/tenant/role/enabled), and `timeout` (navigation/adfs/default ms values). `config/envLoader.ts` is a singleton — it reads the JSON once and caches it for the process lifetime.

Credentials and env files are gitignored — never commit them.

## Architecture

### Fixture System (entry point for all tests)

Three fixtures in `fixtures/`, each serving a different need:

| Fixture | File | Use when |
|---|---|---|
| `testFixture` | `testFixture.ts` | Need CSV data, no auth |
| `authFixture` | `authFixture.ts` | Need auth, no data |
| `ctmsExecutionContext` | `ctmsExecutionContext.ts` | Standard CTMS test (data + auth) |

`ctmsExecutionContext` is the standard fixture — it loads CSV scenario data AND authenticates users with session caching.

### Data-Driven Flow

1. Test title **must** start with `TC\d+` (e.g. `"TC001 – description"`) — the fixture uses this to find the matching CSV row.
2. Scenario CSV lives in `data/scenarios/{module}.csv`. Columns: `testId`, `testName`, `users` (comma-separated), plus module-specific data fields.
3. Fields ending in `*Ref` (e.g. `sponsorRef`) are automatically resolved against master data in `data/reference/*.csv`.
4. Multi-user tests iterate `testData.users`, calling `authPage(username)` per user, then closing each context.

### Authentication

`auth/authManager.ts` handles ADFS login with 24-hour session caching:
- Storage states saved to `auth/storageStates/{env}/{username}-{tenant}.json`
- On each test: checks file age → smoke-tests session validity → reuses or re-authenticates
- Uses file-based locking (120 s timeout) so parallel workers don't race on the same user's state file
- After login, `resolveTenantIfRequired()` handles the tenant chooser modal (dismiss overlays → click tenant row → click Finish)
- ADFS form is submitted via `document.getElementById("loginForm").submit()`, not a button click

### Page Object Model

Navigation is strictly layered — never skip layers:

```
NavigationBar  →  SubNavigation  →  StudyManagementSubMenu  →  StudyManagementPage
(top nav)         (Console items)    (flyout: Study List…)      (page actions)
```

All pages extend `BasePage` (`pages/core/BasePage.ts`). Every subclass **must** implement:
- `pageName: string` — used in logs
- `waitForPageReady(): Promise<void>` — page-specific readiness signal (e.g. breadcrumb visible)
- `goto(): Promise<void>` — must open with `if (this.isNavigated) return;` and close with `await this.completeNavigation()`

`BasePage` provides `waitForOverlayToClear()`, timeout config, and the `isNavigated` idempotency guard.

**Angular dropdown workaround** (`StudyManagementSubMenu`): Angular's `*ngIf` menus don't reliably open via Playwright hover. Solution: move mouse to tab → wait for DOM attach → force CSS visibility via `page.evaluate()` → click via JS.

**Angular overlay pattern**: Angular hides overlays via CSS transitions (display/visibility), not DOM removal. Never use `waitFor({ state: "detached" })` for overlays. Always use `waitForFunction()` with computed style checks, as `waitForOverlayToClear()` does.

**Locator scoping**: always scope to the nearest container before filtering — never use page-level locators for elements that repeat in the DOM.

### TypeScript Path Aliases

```
@auth/*      @config/*      @data/*       @fixtures/*
@helpers/*   @pages/*       @core/*       @resources/*  @reporters/*
```

`@core/*` maps to `pages/core/*`. All imports must use the `.js` extension (Node16 module resolution), e.g. `import { Foo } from "@pages/foo/Foo.js"`.

### Playwright Config Notes

- `workers: 1` — tests run sequentially despite `fullyParallel: true`
- `headless: false` — browser is visible by default (change for CI)
- `retries: 0` — no automatic retries
- Only Chromium is enabled

### Reporting

The custom `reporters/allure-organizer.ts` runs after each test suite and organizes results into:
```
allure-report/{PROJECT}/{YEAR}/{MM-MonthName}/{TAG}_{ENV}_{datetime}/
```
It also preserves the `history/` folder for Allure trend charts and writes a `run-manifest.json` summary.
