import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthStateService } from "./auth-state.service";

@Component({
  selector: "pos-login",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="logo">🏪 POS</div>
        <h1>Sign in</h1>

        @if (auth.error()) {
          <div class="error-banner">{{ auth.error() }}</div>
        }

        <form (ngSubmit)="submit()" #f="ngForm">
          <label>
            Username
            <input type="text" name="username" [(ngModel)]="username" required autocomplete="username" />
          </label>
          <label>
            Password
            <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
          </label>
          <button type="submit" [disabled]="auth.loading() || !f.valid">
            @if (auth.loading()) { Signing in… } @else { Sign in }
          </button>
        </form>

        <p class="hint">Demo&nbsp;accounts: <strong>admin / admin123</strong> &nbsp;or&nbsp; <strong>user / user123</strong></p>
      </div>
    </div>
  `,
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  auth     = inject(AuthStateService);
  username = "";
  password = "";

  submit(): void {
    this.auth.login({ username: this.username, password: this.password });
  }
}
