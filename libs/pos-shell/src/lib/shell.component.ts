import { Component, inject, signal } from "@angular/core";
import { RouterOutlet, RouterLink, RouterLinkActive } from "@angular/router";
import { MenuRegistryService } from "./menu-registry.service";
import { AuthStateService } from "@pos/login";

@Component({
  selector: "pos-shell",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <div class="topbar__brand">
        <span class="topbar__logo">🏪</span>
        <span class="topbar__title">POS</span>
      </div>

      <nav class="topbar__nav">
        @for (item of visibleItems(); track item.id) {
          <a class="nav-link"
             [routerLink]="item.route"
             routerLinkActive="nav-link--active">
            <span class="nav-link__icon">{{ item.icon }}</span>
            {{ item.label }}
          </a>
        }
      </nav>

      <div class="topbar__user" (click)="toggleMenu()">
        <span class="user-avatar">{{ initials() }}</span>
        <span class="user-info">
          <span class="user-name">{{ auth.currentUser()?.displayName }}</span>
          <span class="user-role">{{ auth.currentUser()?.role }}</span>
        </span>
        <span class="user-caret">{{ menuOpen() ? "▲" : "▼" }}</span>

        @if (menuOpen()) {
          <div class="user-menu" (click)="$event.stopPropagation()">
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
  `,
  styleUrl: "./shell.component.scss",
})
export class ShellComponent {
  auth     = inject(AuthStateService);
  registry = inject(MenuRegistryService);

  menuOpen = signal(false);

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
}
