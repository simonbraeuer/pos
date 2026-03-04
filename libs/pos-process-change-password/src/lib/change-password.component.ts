import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthStateService } from "@pos/login";
import { UserApiService } from "@pos/user";

@Component({
  selector: "pos-change-password",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <h2>🔑 Change Password</h2>

      @if (success()) {
        <div class="success">Password changed successfully.</div>
      }
      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      <form (ngSubmit)="submit()" #f="ngForm">
        <label>
          Current password
          <input type="password" name="current" [(ngModel)]="current" required />
        </label>
        <label>
          New password
          <input type="password" name="newPw" [(ngModel)]="newPw" required minlength="6" />
        </label>
        <label>
          Confirm new password
          <input type="password" name="confirm" [(ngModel)]="confirm" required />
        </label>

        @if (mismatch()) {
          <div class="error">Passwords do not match.</div>
        }

        <button type="submit" [disabled]="loading() || !f.valid || mismatch()">
          @if (loading()) { Saving… } @else { Change password }
        </button>
      </form>
    </div>
  `,
  styleUrl: "./change-password.component.scss",
})
export class ChangePasswordComponent {
  private auth    = inject(AuthStateService);
  private userApi = inject(UserApiService);

  current = "";
  newPw   = "";
  confirm = "";

  loading = signal(false);
  error   = signal<string | null>(null);
  success = signal(false);

  mismatch(): boolean { return !!this.newPw && !!this.confirm && this.newPw !== this.confirm; }

  submit(): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId || this.mismatch()) return;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);
    this.userApi.changePassword({ userId, currentPassword: this.current, newPassword: this.newPw }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.current = this.newPw = this.confirm = "";
      },
      error: (e) => { this.loading.set(false); this.error.set(e?.message); },
    });
  }
}
