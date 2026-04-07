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

Each env file (`config/env/{env}.json`) holds `baseUrl`, `users` (array with username/password/tenant/role), and `timeouts`.

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
- After login, `resolveTenantIfRequired()` handles the tenant chooser modal (dismiss overlays → click tenant row → click Finish)

### Page Object Model

Navigation is strictly layered — never skip layers:

```
NavigationBar  →  SubNavigation  →  StudyManagementSubMenu  →  StudyManagementPage
(top nav)         (Console items)    (flyout: Study List…)      (page actions)
```

Each page method waits for its own readiness indicator before returning (breadcrumb visible, etc.). Methods are idempotent via a `navigated` guard flag.

**Angular dropdown workaround** (`StudyManagementSubMenu`): Angular's `*ngIf` menus don't reliably open via Playwright hover. Solution: move mouse to tab → wait for DOM attach → force CSS visibility via `page.evaluate()` → click via JS.

**Locator scoping**: always scope to the nearest container before filtering — never use page-level locators for elements that repeat in the DOM.

### TypeScript Path Aliases

```
@auth/*      @config/*      @data/*       @fixtures/*
@helpers/*   @pages/*       @resources/*  @reporters/*
```

### Reporting

The custom `reporters/allure-organizer.ts` runs after each test suite and organizes results into:
```
allure-report/{PROJECT}/{YEAR}/{MM-MonthName}/{TAG}_{ENV}_{datetime}/
```
It also preserves the `history/` folder for Allure trend charts and writes a `run-manifest.json` summary.
