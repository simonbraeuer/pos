import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { UserApiService, CreateUserRequest } from "@pos/user";
import type { PublicUser } from "@pos/auth";
import { DialogService } from "@pos/core-ui";

@Component({
  selector: "lib-edit-users",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="card wide">
      <h2>👥 User Management</h2>

      @if (error()) { <div class="error">{{ error() }}</div> }

      <!-- User table -->
      @if (loading()) {
        <div class="loading">Loading users…</div>
      } @else {
        <table class="user-table">
          <thead>
            <tr>
              <th>Name</th><th>Username</th><th>E-mail</th><th>Role</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                @if (editingId() === u.id) {
                  <td><input [(ngModel)]="editForm.displayName" name="dn{{u.id}}" /></td>
                  <td>{{ u.username }}</td>
                  <td><input [(ngModel)]="editForm.email" name="em{{u.id}}" /></td>
                  <td>
                    <select [(ngModel)]="editForm.role" name="ro{{u.id}}">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td class="actions">
                    <button class="btn btn--save" (click)="saveEdit(u.id)">Save</button>
                    <button class="btn btn--cancel" (click)="cancelEdit()">Cancel</button>
                  </td>
                } @else {
                  <td>{{ u.displayName }}</td>
                  <td>{{ u.username }}</td>
                  <td>{{ u.email }}</td>
                  <td>
                    <span class="badge" [class.badge--admin]="u.role === 'admin'">{{ u.role }}</span>
                  </td>
                  <td class="actions">
                    <button class="btn btn--edit" (click)="startEdit(u)">Edit</button>
                    <button class="btn btn--delete" (click)="deleteUser(u.id)">Delete</button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      }

      <!-- Add user form -->
      <details class="add-form">
        <summary>➕ Add new user</summary>
        <form (ngSubmit)="addUser()" #af="ngForm">
          <div class="form-row">
            <label>Display name <input name="dn"   [(ngModel)]="newUser.displayName" required /></label>
            <label>Username     <input name="un"   [(ngModel)]="newUser.username"    required /></label>
            <label>E-mail       <input name="em"   [(ngModel)]="newUser.email"       required type="email" /></label>
            <label>Password     <input name="pw"   [(ngModel)]="newUser.password"    required type="password" minlength="6" /></label>
            <label>Role
              <select name="ro" [(ngModel)]="newUser.role">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
          <button type="submit" [disabled]="saving() || !af.valid">
            @if (saving()) { Saving… } @else { Add user }
          </button>
        </form>
      </details>
    </div>
  `,
  styleUrl: "./edit-users.component.scss",
})
export class EditUsersComponent implements OnInit {
  private userApi = inject(UserApiService);
  private dialog = inject(DialogService);

  users     = signal<PublicUser[]>([]);
  loading   = signal(false);
  saving    = signal(false);
  error     = signal<string | null>(null);
  editingId = signal<string | null>(null);
  editForm  = { displayName: "", email: "", role: "user" as "user" | "admin" };

  newUser: CreateUserRequest = {
    username: "", password: "", email: "", displayName: "", role: "user",
  };

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.userApi.getUsers().subscribe({
      next:  us => { this.users.set(us);          this.loading.set(false); },
      error: e  => { this.error.set(e?.message);  this.loading.set(false); },
    });
  }

  startEdit(u: PublicUser): void {
    this.editingId.set(u.id);
    this.editForm = { displayName: u.displayName, email: u.email, role: u.role };
  }

  cancelEdit(): void { this.editingId.set(null); }

  saveEdit(id: string): void {
    this.saving.set(true);
    this.error.set(null);
    this.userApi.updateUser(id, this.editForm).subscribe({
      next: updated => {
        this.users.update(list => list.map(u => u.id === id ? updated : u));
        this.editingId.set(null);
        this.saving.set(false);
      },
      error: e => { this.error.set(e?.message); this.saving.set(false); },
    });
  }

  async deleteUser(id: string): Promise<void> {
    const confirmed = await this.dialog.show({
      title: "Delete User",
      message: "Delete this user?",
      confirmText: "Delete",
      cancelText: "Cancel",
      dismissible: true,
    });
    if (!confirmed) return;

    this.userApi.deleteUser(id).subscribe({
      next:  () => this.users.update(list => list.filter(u => u.id !== id)),
      error: e  => this.error.set(e?.message),
    });
  }

  addUser(): void {
    this.saving.set(true);
    this.error.set(null);
    this.userApi.createUser({ ...this.newUser }).subscribe({
      next: u => {
        this.users.update(list => [...list, u]);
        this.newUser = { username: "", password: "", email: "", displayName: "", role: "user" };
        this.saving.set(false);
      },
      error: e => { this.error.set(e?.message); this.saving.set(false); },
    });
  }
}
