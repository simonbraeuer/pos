import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-action-button-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="action-button-panel" [style.--panel-cols]="columns">
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .action-button-panel {
        --panel-cols: 3;
        display: grid;
        grid-template-columns: repeat(var(--panel-cols), minmax(0, 1fr));
        gap: 0.75rem;
      }

      @media (max-width: 1200px) {
        .action-button-panel {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .action-button-panel {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ActionButtonPanelComponent {
  @Input() columns = 3;
}
