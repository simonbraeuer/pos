import { Component, Input, input, output } from '@angular/core';

@Component({
  selector: 'lib-process-content-layout',
  standalone: true,
  templateUrl: './process-content-layout.component.html',
  styleUrl: './process-content-layout.component.scss',
})
export class ProcessContentLayoutComponent {
  /** Icon shown in the process bar (emoji or short text) */
  readonly icon = input<string>('');

  /** Title shown in the process bar */
  readonly title = input<string>('');

  /**
   * When true an × button is rendered in the top-right corner of the process bar.
   * The parent listens for the (abort) output to handle the action.
   */
  readonly showAbort = input<boolean>(false);

  /** Emitted when the × abort button is clicked */
  readonly abort = output<void>();

  onAbort(): void {
    this.abort.emit();
  }
}
