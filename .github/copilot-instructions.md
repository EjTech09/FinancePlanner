# Copilot instructions for FinancePlanner

## Project shape

This repository is a standalone household finance planner that runs entirely in the browser with no build step or package-based app runtime. The main entry point is `index.html`, and the legacy `household-planner.html` file redirects to it.

## Build, test, and lint commands

No build, test, or lint tooling was found in this repository. There is no `package.json`, no test runner config, and no lint command to run.

For validation, use the browser directly:

- Open `index.html` in a browser
- Check the browser console for JavaScript errors
- Smoke-test the affected flow in the UI (accounts, goals, debts, transactions, data import/export, or exchange-rate updates)

If a change affects calculations, validate the numbers in the app rather than relying on a generated build or test suite.

## High-level architecture

- `index.html` is the app shell and loads the scripts in a fixed order: model and DOM utilities, persistence, FX service, shared UI/table components, page scripts, then `src/js/app.js`.
- `src/js/app.js` is the bootstrap and state coordinator. It creates the persisted state, exposes shared context to page controllers, coordinates theme and navigation, and calls the shared model for calculated values.
- `src/js/shared/models/household-planner-model.js` is the source of truth for financial logic. `compute(state, asOf)` handles conversions, account summaries, debt/goal progress, and budget totals.
- `src/js/shared/services/persistence.js` owns save/load, default values, legacy normalization, theme storage, and the availability checks for browser storage.
- `src/js/shared/services/exchange-rates.js` fetches provider FX rates and updates the app status text without rewriting finance logic in the pages.
- `src/js/shared/components/` contains reusable rendering/editor helpers that pages compose, including table editing and UI blocks.
- `src/js/pages/<page>/` contains page renderers registered in `window.HouseholdPlannerPages`; each page receives the app context created in `app.js` rather than owning its own duplicate state logic.
- `data/` contains the imported sample household datasets used for validation and import/export smoke testing.
- The primary state shape is a single object with `users`, `accounts`, `commitments`, `debts`, `goals`, `transactions`, `income`, `expenses`, `alloc`, `fx`, and `ui`; most business rules depend on that shared state object rather than per-page local state.

## Key conventions

- Keep page-specific behavior in the page renderer and reusable UI logic in shared components; do not duplicate calculations in page files.
- Route UI updates through `commit()`, which marks the state dirty, saves it, and refreshes the derived values. Most field editors call `commit()` after changing a model value.
- Preserve the app’s currency model: account, debt, income, and transaction values are normalized to NZD when computing summaries. `state.fx.rates` maps each configured three-letter currency code to NZD per one unit; NZD is the base at `1`. PHP and USD rates can be refreshed from the provider when configured.
- Respect relationship cleanup: `detach()` is the central place for clearing references when deleting users, accounts, goals, or debts. This includes commitments, transaction account references, and owner references.
- Prefer existing helpers rather than reimplementing logic: `field()`, `uid()`, `markDirty()`, `esc()`, `money()`, `moneyCur()`, `calcEl()`, `tableView`, and the shared `HouseholdPlannerModel` functions.
- Follow repository naming conventions:
  - kebab-case filenames
  - page renderers named `<page>.js`
  - page-specific models/services named `<page>-model.js` and `<page>-service.js`
  - shared domain files use descriptive, domain-based names
- Data compatibility matters: persistence normalizes old or partial records and the app stores a `build` marker in state. If a change affects the data shape, keep import compatibility and validate both existing and legacy data shapes.
- Prefer tracing the state flow from page renderer → app context → model/persistence before introducing a second implementation.
- Treat imported/exported JSON as sensitive household financial data; it is a backup of the user’s records and should be handled carefully.

## Validation expectations

- There is no automated build, lint, or test runner in this repository. For a code change, validate it by opening `index.html` in a browser and checking the browser console for errors.
- Smoke-test the impacted flow in the UI after editing: account summaries, commitments, debt/goal status, transaction data handling, exchange-rate refresh, and JSON import/export.
- When a fix affects conversions or summary logic, verify both the rendered totals and the underlying state values against the app’s NZD-based calculations.

## Working expectations

- Update the relevant user-facing docs when behavior or workflows change.
- Prefer browser-driven checks over code-only reasoning when validating a fix.
- Keep README and onboarding guidance aligned with user-facing workflows when the app behavior changes.
