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

@Component({
  selector: "lib-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, FormsModule],
  templateUrl: './shell.component.html',
  styleUrl: "./shell.component.scss"
})
export class ShellComponent implements OnInit {
  auth = inject(AuthStateService);
  registry = inject(MenuRegistryService);
  burgerMenu = inject(BurgerMenuService);
  tabletSelection = inject(TabletSelectionStateService);
  currentCart = inject(CurrentCartStateService);
  menuOpen = signal(false);

  ngOnInit(): void {
    // Ensures topbar badge reflects persisted tablet selection after a reload.
    this.tabletSelection.ensureVerifiedOnce().subscribe();
  }

  visibleItems() {
    const role = this.auth.currentUser()?.role;
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
    if (!this.menuOpen()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this.menuOpen() && !target.closest(".topbar__user")) {
      this.menuOpen.set(false);
    }
  }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  handleBurgerItemClick(item: { id: string; name: string; onClick: () => void }): void {
    this.burgerMenu.close();
    item.onClick();
  }
}
