import { Injectable, signal } from "@angular/core";

export interface MenuItem {
  /** Unique identifier used for deduplication. */
  id: string;
  label: string;
  icon: string;
  route: string;
  /** When true the item is only shown to admin users. */
  adminOnly?: boolean;
}

/**
 * Inversion-of-control registry for top-bar menu items.
 *
 * Process libraries call `register()` during app initialisation
 * (via APP_INITIALIZER) to declaratively add themselves to the shell
 * without creating a hard compile-time dependency on the shell.
 */
@Injectable({ providedIn: "root" })
export class MenuRegistryService {
  private _items = signal<MenuItem[]>([]);

  /** Read-only signal consumed by the shell component. */
  readonly items = this._items.asReadonly();

  register(item: MenuItem): void {
    this._items.update(current => {
      // Prevent duplicate registrations (e.g. hot-reload scenarios)
      if (current.some(i => i.id === item.id)) return current;
      return [...current, item];
    });
  }
}
