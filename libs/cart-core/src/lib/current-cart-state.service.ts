import { Injectable, signal } from '@angular/core';

const CURRENT_CART_STORAGE_KEY = 'pos_current_cart_id';

@Injectable({ providedIn: 'root' })
export class CurrentCartStateService {
  private readonly currentCartIdSignal = signal<string | null>(this.readFromStorage());

  readonly currentCartId = this.currentCartIdSignal.asReadonly();

  setCurrentCartId(cartId: string): void {
    const normalized = cartId.trim();
    if (!normalized) {
      this.clearCurrentCart();
      return;
    }

    localStorage.setItem(CURRENT_CART_STORAGE_KEY, normalized);
    this.currentCartIdSignal.set(normalized);
  }

  clearCurrentCart(): void {
    localStorage.removeItem(CURRENT_CART_STORAGE_KEY);
    this.currentCartIdSignal.set(null);
  }

  private readFromStorage(): string | null {
    const raw = localStorage.getItem(CURRENT_CART_STORAGE_KEY)?.trim();
    if (!raw) {
      localStorage.removeItem(CURRENT_CART_STORAGE_KEY);
      return null;
    }

    return raw;
  }
}