import { Component, inject } from '@angular/core';
import { SnackbarService } from './snackbar.service';

@Component({
  selector: 'lib-snackbar-outlet',
  standalone: true,
  templateUrl: './snackbar-outlet.component.html',
  styleUrl: './snackbar-outlet.component.scss',
})
export class SnackbarOutletComponent {
  readonly snackbar = inject(SnackbarService);

  dismiss(id: string): void {
    this.snackbar.dismiss(id);
  }
}
