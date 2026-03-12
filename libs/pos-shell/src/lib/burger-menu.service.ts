import { Injectable, signal } from "@angular/core";

export interface BurgerMenuItem {
  /** Unique identifier used for deduplication. */
  id: string;
  /** Display name in the burger menu. */
  name: string;
  /** Optional icon (emoji or symbol) displayed before the name. */
  icon?: string;
  /** Click handler executed when menu item is clicked. */
  onClick: () => void;
}

/**
 * Registry for burger menu items.
 *
 * Process libraries can register menu items that appear in the burger menu.
 */
@Injectable({ providedIn: "root" })
export class BurgerMenuService {
  private _items = signal<BurgerMenuItem[]>([]);
  private _isOpen = signal(false);

  /** Read-only signal consumed by the shell component. */
  readonly items = this._items.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();

  register(item: BurgerMenuItem): void {
    this._items.update(current => {
      // Prevent duplicate registrations
      if (current.some(i => i.id === item.id)) return current;
      return [...current, item];
    });
  }

  toggle(): void {
    this._isOpen.update(v => !v);
  }

  close(): void {
    this._isOpen.set(false);
  }
}
