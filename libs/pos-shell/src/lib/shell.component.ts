import { SHOP_MAINTENANCE_MENU_API, ShopMaintenanceMenuApi } from '@pos/pos-process-configure-demo';
import { Component, HostListener, OnInit, inject, signal } from "@angular/core";
import { FormsModule } from '@angular/forms';
import { inject as ngInject, Provider } from '@angular/core';
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

const API_BEHAVIOUR_KEY = 'pos_api_behaviour';

export interface ApiBehaviourConfig {
  latency: number;
  errorRate: number;
  failureStatus: number;
}

@Component({
  selector: "lib-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: "./shell.component.scss"
})
export class ShellComponent implements OnInit, ShopMaintenanceMenuApi {
    apiBehaviour: ApiBehaviourConfig = this.loadApiBehaviour();

    loadApiBehaviour(): ApiBehaviourConfig {
      try {
        const raw = localStorage.getItem(API_BEHAVIOUR_KEY);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch {}
      return { latency: 300, errorRate: 5, failureStatus: 503 };
    }

    onApiBehaviourChange(newConfig: ApiBehaviourConfig): void {
      this.setApiBehaviour(newConfig);
    }

    // ShopMaintenanceMenuApi implementation
    getApiBehaviour() {
      return this.apiBehaviour;
    }
    setApiBehaviour(config: ApiBehaviourConfig) {
      this.apiBehaviour = { ...config };
      localStorage.setItem(API_BEHAVIOUR_KEY, JSON.stringify(this.apiBehaviour));
    }
    getMaintenanceError() {
      return this.maintenanceError();
    }
    getMaintenanceBusy() {
      return this.maintenanceBusy();
    }
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
