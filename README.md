# FinancePlanner

A standalone household finance planner that runs directly in a browser without a build step.

## Run

Open [`index.html`](index.html) directly in a browser. The legacy [`household-planner.html`](household-planner.html) entry point redirects to it.

## Project layout

- `data/` contains the sample household datasets, including the worst-case scenario. Import either JSON file from the app.
- `src/css/` contains the application stylesheet.
- `src/js/pages/<page>/` contains one page renderer, with optional page-specific models or services alongside it.
- `src/js/shared/models/`, `src/js/shared/services/`, `src/js/shared/components/`, and `src/js/shared/utils/` contain code reused across pages.
- `src/js/app.js` coordinates the application state and page renderers.
- `index.html` is the application shell.

Use kebab-case for filenames. Name page renderers `<page>.js`, and page-specific models and services `<page>-model.js` and `<page>-service.js`. Only add page-specific model or service files when needed; shared files should use domain-based names.
