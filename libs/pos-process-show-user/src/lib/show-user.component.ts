import { Component, inject, OnInit, signal } from "@angular/core";
import { AuthStateService } from "@pos/login";
import { UserApiService } from "@pos/user";
import type { PublicUser } from "@pos/auth";

@Component({
  selector: "pos-show-user",
  standalone: true,
  imports: [],
  template: `
    <div class="card">
      <h2>👤 My Profile</h2>

      @if (loading()) {
        <div class="loading">Loading profile…</div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (user()) {
        <dl class="profile">
          <dt>Display name</dt><dd>{{ user()!.displayName }}</dd>
          <dt>Username</dt>    <dd>{{ user()!.username }}</dd>
          <dt>E-mail</dt>      <dd>{{ user()!.email }}</dd>
          <dt>Role</dt>
          <dd>
            <span class="badge" [class.badge--admin]="user()!.role === 'admin'">
              {{ user()!.role }}
            </span>
          </dd>
        </dl>
      }
    </div>
  `,
  styleUrl: "./show-user.component.scss",
})
export class ShowUserComponent implements OnInit {
  private auth    = inject(AuthStateService);
  private userApi = inject(UserApiService);

  loading = signal(false);
  error   = signal<string | null>(null);
  user    = signal<PublicUser | null>(null);

  ngOnInit(): void {
    const id = this.auth.currentUser()?.id;
    if (!id) return;
    this.loading.set(true);
    this.userApi.getUser(id).subscribe({
      next:  u  => { this.user.set(u);           this.loading.set(false); },
      error: e  => { this.error.set(e?.message); this.loading.set(false); },
    });
  }
}
