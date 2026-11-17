# App.js Refactoring Plan

## Goal

Clarify the application's ownership boundaries without changing existing behavior.

The ideal structure is:

- `app.js` owns application-wide coordination.
- Page controllers coordinate page actions.
- Page services own page calculations and state changes.
- Page views create and update page markup.
- Shared components own reusable UI behavior.
- Persistence owns browser storage and legacy state normalization.

This refactoring should be incremental. It should not rewrite the application or change how financial calculations work.

## Existing Structure

[src/js/app.js](src/js/app.js) currently performs several distinct roles:

- Application bootstrap
- State loading and saving
- Theme management
- Derived-calculation caching
- Shared helper creation
- Page registration
- Navigation rendering
- Main-area rendering
- JSON import
- Legacy-data handling
- Reusable UI helper creation

The existing [dashboard](src/js/pages/dashboard), [plan](src/js/pages/plan), [accounts](src/js/pages/accounts), [transactions](src/js/pages/transactions), and [data](src/js/pages/data) pages already follow a controller/service/view split. The refactoring should make `app.js` consistent with that split rather than introduce a new architecture.

## Recommended Ownership

### Keep in app.js

These responsibilities are application-wide:

| Responsibility | Reason |
|---|---|
| Load and replace state | State belongs to the whole application |
| Save state | Every page uses the shared save operation |
| Apply and change themes | The theme affects the complete app shell |
| Cache derived calculations | The shared model output is used across pages |
| Run `commit()` | A change should mark data dirty and refresh shared UI |
| Run `refresh()` | Calculated and dynamic elements are app-wide |
| Create `pageContext` | Pages receive one consistent shared interface |
| Register pages | Navigation needs a central page registry |
| Render navigation | The shell owns navigation |
| Render the selected page | The shell owns page selection |
| Refresh exchange rates | Exchange-rate updates affect several pages |

The [commit()](src/js/app.js) function should remain centralized because all pages depend on the same save-and-refresh behavior.

### Move to the Data page

Move JSON import behavior into [src/js/pages/data/data-controller.js](src/js/pages/data/data-controller.js) and [src/js/pages/data/data-service.js](src/js/pages/data/data-service.js).

Affected behavior includes:

- Creating the hidden file input
- Selecting a JSON file
- Reading the file
- Parsing and validating JSON
- Asking before replacing existing data
- Importing normalized state
- Switching to the Dashboard after import
- Rendering after import

The controller should handle confirmation dialogs and browser events. The service should handle state replacement or normalization where appropriate.

The page context may expose a shared import action that the Dashboard and Data page can use.

### Move legacy handling to the Data page

Move legacy-data handling out of [app.js](src/js/app.js):

- Clear legacy data action
- Keep legacy data action
- Clear-data confirmation
- Legacy warning banner

The Data page is the correct owner because legacy data is a data-management concern.

### Move reusable UI helpers to shared components

Move or delegate these app-level helpers to existing shared modules:

| Current helper | Target |
|---|---|
| `createLiveValueElement()` | [src/js/shared/components/ui.js](src/js/shared/components/ui.js) |
| `createItemList()` | [src/js/shared/components/ui.js](src/js/shared/components/ui.js) |
| `expandable()` | [src/js/shared/components/ui.js](src/js/shared/components/ui.js) |
| `createCalculationRow()` | [src/js/shared/components/ui.js](src/js/shared/components/ui.js) |
| `createTotalsElement()` | [src/js/shared/components/ui.js](src/js/shared/components/ui.js) |
| Shared table behavior | [src/js/shared/components/table-editor.js](src/js/shared/components/table-editor.js) |

These functions are reusable UI infrastructure, not application or page state coordination.

They may remain temporary wrappers in `app.js` during the first refactoring phase, but new pages should use them through the shared UI module.

### Keep shared option helpers in app.js initially

The following option helpers can remain in `appContext.js` for now:

- `getUserOptions()`
- `getAccountOptions()`
- `getTargetOptions()`
- `getCurrencyOptions()`

Move them later when an actual duplicate or domain boundary makes a more specific location necessary:

| Helper | Possible future owner |
|---|---|
| User options | Accounts or a shared users service |
| Account options | Transactions or Accounts service |
| Debt and goal target options | Plan service |
| Currency options | Data service |

## Target Responsibilities

### app.js

`app.js` should act as the composition root:

```text
Load persistence
Create shared services
Create shared UI components
Create shared page context
Create page controllers
Register page renderers
Render the app shell
Handle global refresh and exchange rates
```

It should not contain detailed JSON import controls, legacy-banner actions, or reusable list rendering logic.

### Page controller

A page controller should:

- Receive `pageContext`
- Connect the page service and page view
- Coordinate page actions
- Ask for confirmation on destructive actions
- Call `commit()` after state changes
- Call `render()` when the complete page needs rebuilding

### Page service

A page service should:

- Create records
- Delete records
- Update state collections
- Perform page calculations
- Validate page-specific input
- Return calculated values to the view

### Page view

A page view should:

- Read state and calculated values
- Create DOM elements
- Create HTML for page sections
- Render empty states
- Pass action callbacks to controls

## Proposed Page Context

The current `pageContext` should continue to expose stable shared operations:

```javascript
const pageContext = {
  state,
  D,
  commit,
  save,
  render,
  h,
  money,
  esc,
  tableView,
  field,
  detach,
  liv,
  itemList,
  expandable,
  totalsEl
};
```

The Data page may receive an additional import callback from `app.js` while the import implementation is being moved:

```javascript
importJson
```

The final structure should avoid adding new global variables or duplicating state.

## Incremental Refactoring Steps

### Implementation status

- [x] Phase 2: reusable UI helpers extracted to `shared/components/ui.js`
- [x] Phase 3: JSON import moved to the Data page controller and service
- [x] Phase 4: legacy-data banner and actions moved to the Data page
- [x] Phase 5: `hasData()` moved to the persistence service
- [ ] Phase 1: full manual behavioral baseline not yet complete
- [ ] Phase 6: page context remains stable; its remaining entries still need a usage audit

Implemented coverage was verified by JavaScript syntax checks across all app scripts and a browser startup smoke test of `index.html`. The remaining checklist items require direct browser interaction verification.

### Phase 1: Characterize existing behavior

Before changing code:

1. Open `index.html` in a browser.
2. Record browser console state.
3. Export a JSON backup.
4. Test navigation and theme changes.
5. Test each page's add, edit, and delete flows.
6. Test account and transaction calculations.
7. Test JSON import and export.
8. Test exchange-rate refresh behavior.

This creates a manual behavioral baseline because the project has no automated test suite.

### Phase 2: Extract shared UI helpers

Move the reusable UI helpers into [src/js/shared/components/ui.js](src/js/shared/components/ui.js).

Keep their signatures stable at first. Update `app.js` to expose them through the new shared module, and then update page code to use the shared interface.

Rules:

- Do not change DOM structure.
- Do not change CSS classes.
- Do not change accessibility attributes.
- Do not change generated HTML.

Validate with:

- Accounts list expansion
- Plan items
- Transaction rows
- Live calculated values
- Totals

### Phase 3: Extract JSON import

Move the import file input and file reader setup to the Data controller.

Keep the first implementation in this pattern:

```text
Data controller
  handles file selection
  handles confirmation dialogs
  calls Data service
  calls commit/render

Data service
  validates imported data
  normalizes imported state
  returns the replacement state
```

Remove `startImport()` and `importFileInput` from `app.js` after all import entry points use the Data-page action.

Update the Dashboard welcome state to receive an import callback from the Data page context or shared app navigation.

### Phase 4: Extract legacy-data handling

Move the legacy-data banner and its actions to the Data page.

Keep `legacy` state in `app.js` temporarily if the Data page needs the shared state coordinator to decide whether to display the banner.

The Data page may use:

- `setLegacy()`
- `replaceState()`
- `save()`
- `render()`

After extraction, `app.js` should only identify that legacy data exists and ask the Data page to present that state.

### Phase 5: Move data checks

Move or delegate `hasData()` so it belongs next to persistence or the Data page rather than remaining in `app.js`.

If it remains in `appContext`, it should be a stable shared state query rather than an implementation containing page behavior.

### Phase 6: Reevaluate pageContext

Remove helpers that no page uses.

For every entry in `pageContext`, ask:

- Is it state?
- Is it a shared operation?
- Is it a page-specific helper?
- Is it owned by a service?
- Is it a reusable UI component?

Avoid replacing a long list of variables with another similarly long but unexplained global interface.

## Change Examples

### Before

The application shell owns import behavior:

```javascript
function startImport() {
  importFileInput.click();
}
```

### After

The Data controller owns the import action:

```javascript
const importJson = () => {
  // Open the Data-page file input.
};
```

The app exposes navigation and state coordination, but the Data page owns its data-management behavior.

## Risk Areas

### 1. State replacement

Replacing state must preserve object references used by closures.

The current [replaceState()](src/js/app.js) deletes keys from the existing state and copies the normalized state into it. Keep this behavior unless a complete reference audit confirms that reassignment is safe.

### 2. Import validation

JSON import currently requires `accounts` to exist.

During extraction:

- Keep validation behavior stable.
- Preserve legacy normalization.
- Keep the existing confirmation behavior.
- Do not silently accept malformed household data.

### 3. Page render timing

Some actions call `commit()`, while others call `save()` and `render()`.

Do not introduce different behavior accidentally. Use existing behavior as the baseline:

- `commit()` for field changes
- `save()` plus `render()` for full-page state changes
- `markDirty()` before a batch of UI changes

### 4. Browser storage availability

Import and export should continue to work even when browser storage is unavailable.

Do not move persistence-dependent behavior to code that assumes saving is available.

### 5. Accessibility

Buttons should remain real `<button>` elements.

Preserve:

- Labels
- `aria-current`
- `aria-expanded`
- `aria-controls`
- Visible focus states
- Dialog-like sheet behavior

### 6. URL lifecycle

Object URLs created for JSON export should be revoked after download in the final implementation if browser behavior makes revocation appropriate.

This is not required for the first ownership refactor.

## Validation Checklist

Run all validation directly in the browser.

### Navigation

- [x] Dashboard opens initially
- [ ] Every navigation tab opens
- [ ] `aria-current="page"` matches the selected tab
- [ ] Switching tabs scrolls to the top
- [ ] Theme changes remain after reload

### State and persistence

- [ ] Existing values reload after refresh
- [ ] Invalid browser storage behavior displays a warning
- [ ] Legacy data still asks to keep or clear
- [ ] The build marker remains set

### Accounts

- [ ] Account values update
- [ ] Add and delete account work
- [ ] Commitments update
- [ ] Deleting an account clears stale references
- [ ] Currency and user dropdowns remain correct

### Plan

- [ ] Income and expense updates save
- [ ] Goal and debt updates save
- [ ] Allocation updates save
- [ ] Deleting goals and debts changes commitment targets safely

### Transactions

- [ ] Add transaction opens the sheet
- [ ] Edit transaction updates state
- [ ] Discarding a blank new transaction does not leave stale state
- [ ] Delete transaction closes the sheet safely
- [ ] Closing and reopening the sheet preserves focus

### Data

- [ ] JSON export downloads valid JSON
- [ ] JSON import opens from the Data page
- [ ] Invalid JSON is rejected
- [ ] Replacing existing data requires confirmation
- [ ] Imported legacy state normalizes correctly
- [ ] Exchange-rate add/update/remove behavior remains correct
- [ ] Clear-data behavior remains correct

### Calculations

- [ ] Dashboard totals remain unchanged
- [ ] Goal and debt status remain unchanged
- [ ] Cash by person remains unchanged
- [ ] Currency conversions remain unchanged
- [ ] Derived calculation cache refreshes after state changes

### Browser verification

- [ ] No JavaScript console errors
- [ ] No broken navigation
- [ ] No stale UI values
- [ ] No accidental repeated exchange-rate refreshes
- [ ] Responsive layout remains usable

## Completion Criteria

The refactoring is complete when:

- [x] `app.js` contains application orchestration, not page-specific import or banner behavior.
- [x] Data management lives on the Data page.
- [x] Reusable UI helpers live in shared components.
- [x] Existing controller/service/view responsibilities remain clear.
- JSON data compatibility remains intact.
- Financial calculations produce the same values.
- Browser smoke tests pass.
- [x] No build or package tooling is introduced.
