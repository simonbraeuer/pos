## Outlook & Future Improvements

Planned enhancements for this POS application include:

- **Full POS Feature Set:**
	- Retail cancellation
	- X-report and Z-report generation
	- Discounts and promotions
	- EFT day-end processing
	- Additional retail workflows
- **Backend Flexibility:**
	- Option to configure a real backend endpoint (e.g., via localStorage)
	- Seamless switch between mock (IndexedDB) and real backend for integration and production use

These improvements will further align the application with real-world retail requirements and enable integration with external systems.

# POS Application (Nx Monorepo)

This repository contains a modular, production-ready Point of Sale (POS) application built with Angular and managed using the Nx monorepo toolchain.

## Overview

- **Framework:** Angular 21 (standalone components, modern Angular features)
- **Monorepo:** Nx, with multiple apps and libraries for clear separation of concerns
- **Styling:** SCSS, shared styles
- **Build Tool:** Vite (via @analogjs/vite-plugin-angular)
- **Testing:** Vitest, Angular unit tests
- **Linting:** ESLint

## Main Application: `pos`

The `apps/pos` project is the main POS frontend. It features:

- Modern Angular architecture (standalone bootstrapping, feature modules)
- Modular business logic (cart, checkout, user management, product catalog, etc.)
- Dynamic menu and process registration via dependency injection
- Route guards for authentication and admin features
- Extensible via Nx libraries (see `libs/`)

### Key Features

- **Authentication:** Login, session restore, and user profile
- **Cart Management:** Create, edit, and search carts; add/remove products and bundles
- **Order Processing:** View, create, and manage orders
- **Admin Tools:** Manage users, products, payment methods, and demo configuration
- **Tablet Selection:** Device-specific workflows
- **Customizable Menu:** Dynamic registration of processes and admin-only features

## Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```


## Backend Emulation with IndexedDB


This POS application does not require a traditional backend server for core functionality. Instead, all backend logic and data persistence are fully emulated on the frontend using the browser's IndexedDB API. This is achieved via the reusable `idb-storage` library (`libs/idb-storage`), which provides a generic service for CRUD operations and persistent storage.

## API Design Reference: TMF

The implementation of the API services in this project is based on the TMF (TM Forum Open APIs) standards. These specifications provide a consistent, industry-standard approach for designing APIs in the telecommunications and digital services domain.

- For more information, see the [TM Forum Open APIs documentation](https://www.tmforum.org/open-apis/).

The API modules in `apis/` (such as `tmf663`, `tmf691`, etc.) follow the structure and semantics defined in the TMF documentation, ensuring compatibility and best practices.

- **All business data** (carts, orders, users, products, etc.) is stored locally in the browser.
- **API services** in the `apis/` folder use the `IdbService` to simulate backend endpoints and data flows.
- **No network connection** is required for normal operation; the app works entirely offline.
- This approach enables rapid prototyping, demo deployments, and robust offline-first workflows.

## Deployment

The latest version is deployed at:

- [https://simonbraeuer.github.io/pos/](https://simonbraeuer.github.io/pos/)

Deployment uses GitHub Pages via the `deploy` script, which builds the app and publishes the output from `dist/apps/pos/browser`.

---
For more details, see the source code in `apps/pos` and the various libraries in `libs/`.
