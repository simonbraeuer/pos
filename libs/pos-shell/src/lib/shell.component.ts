import { Component, OnInit, inject, signal } from "@angular/core";
import { RouterOutlet, RouterLink } from "@angular/router";
import { MenuRegistryService } from "./menu-registry.service";
import { BurgerMenuService } from "./burger-menu.service";
import { AuthStateService } from "@pos/login";
import { TabletSelectionStateService } from "@pos/tablet-selection";

@Component({
  selector: "lib-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <button class="burger-menu-button" (click)="burgerMenu.toggle()" aria-label="Menu">
        <span class="burger-icon">☰</span>
      </button>

      <div class="topbar__brand">
        <span class="topbar__logo">🏪</span>
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
  tabletSelection = inject(TabletSelectionStateService);

  menuOpen = signal(false);

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

  toggleMenu(): void { this.menuOpen.update(v => !v); }

  logout(): void {
    this.menuOpen.set(false);
    this.auth.logout();
  }

  handleBurgerItemClick(item: { id: string; name: string; onClick: () => void }): void {
    this.burgerMenu.close();
    item.onClick();
  }
}
