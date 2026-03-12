# @pos/tablet-selection

Tablet selection flow for POS runtime context.

## Includes

- `TabletSelectionComponent` and route constant
- `tabletSelectionGuard`
- `TabletSelectionStateService`

## Features

- Shows locations and tablets (TABLET devices)
- Persists chosen tablet to local storage
- Verifies local selection once per app reload
- Attempts shift auto-pick when tablet -> hardware station -> register mapping exists
