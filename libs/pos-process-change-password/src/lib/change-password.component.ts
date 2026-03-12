import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthStateService } from "@pos/login";
import { UserApiService } from "@pos/user";

@Component({
  selector: "lib-change-password",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card">
      <h2>🔑 Change Password</h2>

      @if (success()) {
        <div class="success">✓ Password changed successfully.</div>
      }
      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      <form (ngSubmit)="submit()" #f="ngForm">
        <label>
          Current password
          <input 
            type="password" 
            name="current" 
            [(ngModel)]="current" 
            (ngModelChange)="clearMessages()"
            required 
            #currentInput="ngModel"
            [class.invalid]="currentInput.touched && currentInput.invalid"
          />
          @if (currentInput.touched && currentInput.errors?.['required']) {
            <span class="field-error">Current password is required.</span>
          }
        </label>
        
        <label>
          New password
          <input 
            type="password" 
            name="newPw" 
            [(ngModel)]="newPw" 
            (ngModelChange)="clearMessages()"
            required 
            minlength="6"
            #newPwInput="ngModel"
            [class.invalid]="newPwInput.touched && newPwInput.invalid"
          />
          @if (newPwInput.touched && newPwInput.errors?.['required']) {
            <span class="field-error">New password is required.</span>
          }
          @if (newPwInput.touched && newPwInput.errors?.['minlength']) {
            <span class="field-error">Password must be at least 6 characters.</span>
          }
          @if (newPwInput.valid && passwordMatchesUsername()) {
            <span class="field-error">Password cannot be the same as username.</span>
          }
        </label>
        
        <label>
          Confirm new password
          <input 
            type="password" 
            name="confirm" 
            [(ngModel)]="confirm" 
            (ngModelChange)="clearMessages()"
            required
            #confirmInput="ngModel"
            [class.invalid]="confirmInput.touched && confirmInput.invalid"
          />
          @if (confirmInput.touched && confirmInput.errors?.['required']) {
            <span class="field-error">Please confirm your new password.</span>
          }
          @if (confirmInput.valid && mismatch()) {
            <span class="field-error">Passwords do not match.</span>
          }
        </label>

        <button type="submit" [disabled]="loading() || !f.valid || mismatch() || passwordMatchesUsername()">
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

  passwordMatchesUsername(): boolean {
    const username = this.auth.currentUser()?.username;
    return !!this.newPw && !!username && this.newPw.toLowerCase() === username.toLowerCase();
  }

  clearMessages(): void {
    if (this.success()) this.success.set(false);
    if (this.error()) this.error.set(null);
  }

  submit(): void {
    const userId = this.auth.currentUser()?.id;
    if (!userId || this.mismatch() || this.passwordMatchesUsername()) return;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);
    this.userApi.changePassword({ userId, currentPassword: this.current, newPassword: this.newPw }).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.current = this.newPw = this.confirm = "";
      },
      error: (e) => {
        this.loading.set(false);
        const errorMsg = e?.message || e?.error?.message || 'Failed to change password';
        this.error.set(errorMsg);
      },
    });
  }
}
