---
applyTo: "**/*.{html,css,js}"
---

# UI layout and interaction rules

Follow these rules for every UI change. This project uses semantic HTML, vanilla CSS, and vanilla JavaScript; do not introduce a framework or UI library. Reuse the existing CSS tokens, shared UI helpers, and component patterns before adding new ones.

## Layout and spatial hierarchy

- Use a 4px spacing rhythm: prefer 4, 8, 12, 16, 24, 32, 40, or 48px. Use existing component-specific values when changing them would disrupt established layouts.
- Keep page content inside `main`, centered within the existing 1260px maximum width. Preserve its responsive side padding (`clamp(16px, 3.5vw, 44px)`) and use the existing page header and grid patterns.
- Group related content in existing cards, sections, and grid wrappers. Align related edges; distinguish hierarchy with spacing and typography, not arbitrary decoration.
- Preserve the established responsive breakpoints: 1100px for dashboard grid changes, 820px for navigation and mobile layout, and 560px for compact tile spacing. Extend these breakpoints when needed; do not add near-duplicate breakpoints.
- Prevent horizontal overflow. At narrow widths, stack content and actions, allow flexible columns to shrink, and keep controls reachable above the bottom navigation and device safe area.

## Controls and component consistency

- Reuse existing classes and helpers: `.btn` for primary actions, `.btn.plain` for secondary actions, `.btn.danger` for destructive actions, `.actions` for action groups, and shared field/UI helpers where applicable. Do not invent one-off button or input styles.
- Give each action group one visually prominent primary action. Put secondary actions before the primary action; keep destructive actions visually distinct and away from accidental activation. Use consistent labels and ordering wherever the same task appears.
- Keep controls comfortably tappable: target at least 44px high for interactive targets where practical. Preserve the existing form row sizing and input typography.
- Associate every input with a visible label. Keep related fields together, use the correct input type, and place validation feedback next to the affected field.
- Use a consistent placement and dismissal pattern for dialogs. Prefer native semantic dialog behavior where a dialog is needed; provide a clear title, an explicit close or cancel action, and keep keyboard focus within it while open. Do not use a modal for routine inline feedback.
- Use the existing `nav` structure and active-page treatment. Keep navigation labels and placement consistent across screen sizes; do not create a second navigation pattern for individual pages.

## Custom data and disclosure controls

- Build collection tables with the shared `tableView` / table-editor pattern. Preserve semantic `table`, `thead`, `tbody`, and `tfoot` structure, readable column headings, right-aligned numeric values, and totals where applicable. Do not recreate tables as unrelated grids or lists.
- Keep tables usable on narrow screens: use the existing scroll wrapper or responsive table treatment, keep inline fields operable, and do not hide data or actions without providing an accessible alternative. Keep row actions in consistent columns and give icon-only actions a specific accessible name.
- Use the shared segmented-control helper and `.seg` / `.seg-b` styles for compact mutually exclusive filters or view choices. Give the group an accessible label and each option a real button with `aria-pressed` that reflects the selected option. Keep the visual selection and pressed state synchronized; allow horizontal scrolling on small screens rather than shrinking labels until unreadable. These are pressed-state controls, not ARIA tabs. Use tab semantics only for actual tab panels and implement their required keyboard behavior.
- Implement “Show details” / “Hide details” and “Show all details” / “Hide details” actions as real buttons. Keep expanded state, visible details, and accessible names synchronized; use `aria-expanded` and `aria-controls` to identify the controlled content. Do not make an entire editable table row the disclosure control.
- For a slide-up detail sheet, follow the existing `.sheet-back` / `.sheet-panel` pattern. Give the dialog a visible title and close button, move focus into it on open, keep keyboard focus within it, close on Escape, and return focus to the opener on close. A drag handle or backdrop must not be the only way to dismiss it. Preserve scrolling, safe-area padding, reduced-motion preferences, and the same form field patterns used elsewhere.

## Interactive states and feedback

- Define and preserve visible default, hover, active, keyboard-focus, disabled, and validation states for every interactive control. Do not remove the shared `:focus-visible` outline.
- Disable unavailable actions with the native `disabled` attribute and a visible disabled style. Do not rely on color alone to communicate a state.
- For delayed content, use a skeleton matching the content shape. For a brief action such as saving, show a compact spinner or progress indicator in the control and prevent duplicate activation. Keep the control label or an accessible status clear.
- Every data view must handle loading, empty, and error states explicitly. Explain empty states and offer a relevant next step where possible. Show actionable errors near the affected content and never silently replace a failure with empty or success-shaped content.
- Announce asynchronous results and errors through an appropriate live region; do not move focus unexpectedly for routine updates.
- Respect `prefers-reduced-motion`. Keep transitions brief and never make motion the only indication of a state change.

## Accessibility and predictable language

- Use semantic elements (`button`, `a`, `label`, `input`, `nav`, headings) according to their purpose. Do not make clickable `div` or `span` elements.
- Ensure all actions work with a keyboard and follow a logical tab order. Keep a visible focus ring with sufficient contrast; never suppress focus without an equally visible replacement.
- Give icon-only controls an accessible name. Add ARIA only when native HTML does not provide the needed semantics; keep accessible names and state attributes synchronized with the UI.
- Maintain heading order, sufficient text contrast, and meaningful labels. Pair status colors with text or an icon and explanatory text.
- Use stable action terms throughout the app: **Add**, **Save**, **Cancel**, and **Delete** for those actions. Use **Delete** only for permanent removal and confirm consequential destructive actions. Do not alternate with labels such as “Submit,” “Done,” or “Remove” for the same operation.

## Composition examples

Do:

```html
<main>
  <header class="page-head">
    <h1>Accounts</h1>
    <p class="sub">Review household accounts.</p>
  </header>
  <section class="tile" aria-labelledby="accounts-heading">
    <h2 id="accounts-heading">Accounts</h2>
    <div class="actions">
      <button class="btn plain" type="button">Cancel</button>
      <button class="btn" type="button">Save</button>
    </div>
  </section>
</main>
```

For custom controls, keep disclosure state exposed to assistive technology and use pressed-state buttons for segmented choices:

```html
<div class="seg" role="group" aria-label="Transaction type">
  <button class="seg-b" type="button" aria-pressed="true">All</button>
  <button class="seg-b" type="button" aria-pressed="false">Income</button>
</div>
<button type="button" aria-expanded="false" aria-controls="row-details-1">
  Show details
</button>
<div id="row-details-1" hidden>...</div>
```

Don't:

```html
<div style="margin: 37px; display: flex">
  <div onclick="save()">Submit</div>
  <span onclick="showDetails()">More details</span>
</div>
```

The examples use the page wrapper, semantic landmarks, existing component classes, and keyboard-operable controls with programmatic state. The “Don't” example introduces arbitrary layout styles and non-semantic, inaccessible controls.
