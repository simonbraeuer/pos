import { Component, HostListener, OnInit, inject, signal } from "@angular/core";
import { RouterOutlet, RouterLink } from "@angular/router";
import { MenuRegistryService } from "./menu-registry.service";
import { BurgerMenuService } from "./burger-menu.service";
import { DialogService } from "@pos/core-ui";
import { AuthStateService } from "@pos/login";
import { TabletSelectionStateService } from "@pos/tablet-selection";
import { CurrentCartStateService } from "@pos/cart-core";
import { IdbService } from "@pos/idb-storage";

const SHOP_DB_NAMES = [
  "pos-tmf620-product-catalog",
  "pos-tmf622-product-orders",
  "pos-tmf663-shopping-carts",
  "pos-tmf670-payment-methods",
  "pos-tmf676-payments",
  "pos-tmf678-customer-bills",
  "pos-tmf720-digital-identity",
  "pos-devices",
  "pos-hardware-stations",
  "pos-locations",
  "pos-registers",
  "pos-shifts",
  "pos-db",
];

const SHOP_LOCAL_STORAGE_KEYS = [
  "pos_current_cart_id",
  "pos_receipt_options",
  "pos_session_token",
  "pos_shift_context",
  "pos_tablet_selection",
  "pos_tmf691_sessions",
];

@Component({
  selector: "lib-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <button class="burger-menu-button" (click)="burgerMenu.toggle()" aria-label="Menu">
        <span class="burger-icon">☰</span>
      </button>

      <div
        class="topbar__brand"
        role="button"
        tabindex="0"
        (click)="toggleShopMenu()"
        (keydown.enter)="toggleShopMenu()"
        (keydown.space)="toggleShopMenu(); $event.preventDefault()"
      >
        <img class="topbar__logo" src="favicon.svg" alt="" aria-hidden="true" />
        <span class="topbar__title">POS</span>
      </div>

      <div class="topbar__tablet" [class.topbar__tablet--missing]="!tabletSelection.selectedTablet()">
        @if (tabletSelection.selectedTablet(); as tablet) {
          <span class="tablet-label">Tablet</span>
          <span class="tablet-value">{{ tablet.deviceName }}</span>
          <span class="tablet-location">{{ tablet.locationName }}</span>
        } @else {
          <span class="tablet-label">Tablet</span>
          <a class="tablet-link" [routerLink]="'/tablet-selection'">Not selected</a>
        }
      </div>

      <div class="topbar__cart" [class.topbar__cart--empty]="!currentCart.currentCartId()">
        <span class="cart-label">Cart</span>
        @if (currentCart.currentCartId(); as cartId) {
          <a class="cart-link" [routerLink]="['/cart', cartId, 'find-sale-offer']">{{ cartId }}</a>
        } @else {
          <span class="cart-value">None</span>
        }
      </div>

      <div
        class="topbar__user"
        role="button"
        tabindex="0"
        (click)="toggleMenu()"
        (keydown.enter)="toggleMenu()"
        (keydown.space)="toggleMenu(); $event.preventDefault()"
      >
        <span class="user-avatar">{{ initials() }}</span>
        <span class="user-info">
          <span class="user-name">{{ auth.currentUser()?.displayName }}</span>
          <span class="user-role">{{ auth.currentUser()?.role }}</span>
        </span>
        <span class="user-caret">{{ menuOpen() ? "▲" : "▼" }}</span>

        @if (menuOpen()) {
          <div class="user-menu" (mousedown)="$event.stopPropagation()">
            @for (item of visibleItems(); track item.id) {
              <a class="user-menu__item" [routerLink]="item.route" (click)="toggleMenu()">
                {{ item.icon }} {{ item.label }}
              </a>
            }
            <div class="user-menu__divider"></div>
            <button class="user-menu__item user-menu__logout" (click)="logout()">
              🚪 Sign out
            </button>
          </div>
        }
      </div>
    </header>

    <main class="main-content">
      <router-outlet />
    </main>

    @if (shopMenuOpen()) {
      <div
        class="shop-menu-overlay"
        role="button"
        tabindex="0"
        (click)="closeShopMenu()"
        (keydown.enter)="closeShopMenu()"
        (keydown.space)="closeShopMenu(); $event.preventDefault()"
      >
        <section class="shop-menu-panel" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
          <div class="shop-menu-panel__header">
            <div>
              <h2>Shop Maintenance</h2>
              <p>Hidden store controls for resetting persisted demo data and browser-held POS state.</p>
            </div>
            <button type="button" class="shop-menu-panel__close" (click)="closeShopMenu()" aria-label="Close shop menu">
              ✕
            </button>
          </div>

          @if (maintenanceError()) {
            <p class="shop-menu-panel__error">{{ maintenanceError() }}</p>
          }

          <div class="shop-action-card">
            <div class="shop-action-card__text">
              <h3>Reset IndexedDB Databases</h3>
              <p>
                Deletes persisted carts, product orders, payments, catalog data, device/location/register/shift data,
                and mock identity data stored in IndexedDB. The next app use recreates seeded demo databases, so in-progress
                transactional state is lost.
              </p>
            </div>
            <button
              type="button"
              class="shop-action-card__button shop-action-card__button--danger"
              [disabled]="!!maintenanceBusy()"
              (click)="resetIndexedDb()"
            >
              @if (maintenanceBusy() === 'db') { Resetting... } @else { Reset Databases }
            </button>
          </div>

          <div class="shop-action-card">
            <div class="shop-action-card__text">
              <h3>Clear POS Local Storage</h3>
              <p>
                Removes the saved login token, current cart pointer, tablet and shift context, receipt preferences,
                and mock TMF691 session records stored in local storage. After reload, the user must sign in again and
                reselect shop context.
              </p>
            </div>
            <button
              type="button"
              class="shop-action-card__button shop-action-card__button--warning"
              [disabled]="!!maintenanceBusy()"
              (click)="clearLocalStorageRecords()"
            >
              @if (maintenanceBusy() === 'storage') { Clearing... } @else { Clear Local Storage }
            </button>
          </div>
        </section>
      </div>
    }

    @if (burgerMenu.isOpen()) {
      <div
        class="burger-menu-overlay"
        role="button"
        tabindex="0"
        (click)="burgerMenu.close()"
        (keydown.enter)="burgerMenu.close()"
        (keydown.space)="burgerMenu.close(); $event.preventDefault()"
      >
        <div class="burger-menu" (mousedown)="$event.stopPropagation()">
          <div class="burger-menu__header">
            <h2>Menu</h2>
            <button class="burger-menu__close" (click)="burgerMenu.close()" aria-label="Close menu">
              ✕
            </button>
          </div>
          <nav class="burger-menu__items">
            @for (item of burgerMenu.items(); track item.id) {
              <button class="burger-menu__item" (click)="handleBurgerItemClick(item)">
                @if (item.icon) {
                  <span class="burger-menu__item-icon">{{ item.icon }}</span>
                }
                {{ item.name }}
              </button>
            }
          </nav>
        </div>
      </div>
    }
  `,
  styleUrl: "./shell.component.scss",
})
export class ShellComponent implements OnInit {
  auth       = inject(AuthStateService);
  registry   = inject(MenuRegistryService);
  burgerMenu = inject(BurgerMenuService);
  dialog = inject(DialogService);
  idb = inject(IdbService);
  tabletSelection = inject(TabletSelectionStateService);
  currentCart = inject(CurrentCartStateService);

  menuOpen = signal(false);
  shopMenuOpen = signal(false);
  maintenanceBusy = signal<"db" | "storage" | null>(null);
  maintenanceError = signal<string | null>(null);

  ngOnInit(): void {
    // Ensures topbar badge reflects persisted tablet selection after a reload.
    this.tabletSelection.ensureVerifiedOnce().subscribe();
  }

  visibleItems() {
    const role  = this.auth.currentUser()?.role;
    return this.registry.items().filter(
      item => !item.adminOnly || role === "admin"
    );
  }

  initials(): string {
    const name = this.auth.currentUser()?.displayName ?? "?";
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  }

  @HostListener("document:mousedown", ["$event"])
  handleDocumentMouseDown(event: MouseEvent): void {
    if (!this.menuOpen() && !this.shopMenuOpen()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    if (this.menuOpen() && !target.closest(".topbar__user")) {
      this.menuOpen.set(false);
    }

    if (this.shopMenuOpen() && (target.closest(".topbar__brand") || target.closest(".shop-menu-panel"))) {
      return;
    }

    if (this.shopMenuOpen()) {
      this.shopMenuOpen.set(false);
      this.maintenanceError.set(null);
    }
  }

  toggleMenu(): void { this.menuOpen.update(v => !v); }

  toggleShopMenu(): void {
    this.shopMenuOpen.update((value) => !value);
    this.maintenanceError.set(null);
  }

  closeShopMenu(): void {
    this.shopMenuOpen.set(false);
    this.maintenanceError.set(null);
  }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  async resetIndexedDb(): Promise<void> {
    const confirmed = await this.dialog.show({
      title: 'Reset IndexedDB Databases',
      message:
        'This removes persisted carts, orders, payments, catalog data, operational master data, and mock identity data. The app will reload afterwards and any in-progress POS work will be lost.',
      confirmText: 'Reset Databases',
      cancelText: 'Cancel',
      dismissible: true,
    });

    if (!confirmed) {
      return;
    }

    this.maintenanceBusy.set('db');
    this.maintenanceError.set(null);

    try {
      await this.idb.deleteDatabases(SHOP_DB_NAMES);
      window.location.reload();
    } catch (error) {
      this.maintenanceBusy.set(null);
      this.maintenanceError.set(error instanceof Error ? error.message : 'Failed to reset IndexedDB databases.');
    }
  }

  async clearLocalStorageRecords(): Promise<void> {
    const confirmed = await this.dialog.show({
      title: 'Clear POS Local Storage',
      message:
        'This removes the saved login token, current cart reference, tablet and shift context, receipt preferences, and mock TMF691 session records. The app will reload afterwards and require a fresh sign-in.',
      confirmText: 'Clear Local Storage',
      cancelText: 'Cancel',
      dismissible: true,
    });

    if (!confirmed) {
      return;
    }

    this.maintenanceBusy.set('storage');
    this.maintenanceError.set(null);

    try {
      for (const key of SHOP_LOCAL_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      window.location.reload();
    } catch (error) {
      this.maintenanceBusy.set(null);
      this.maintenanceError.set(error instanceof Error ? error.message : 'Failed to clear local storage records.');
    }
  }

  handleBurgerItemClick(item: { id: string; name: string; onClick: () => void }): void {
    this.burgerMenu.close();
    item.onClick();
  }
}
