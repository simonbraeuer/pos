import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-action-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="action-button"
      [disabled]="disabled"
      (click)="handleClick()"
    >
      <span class="action-button__icon" aria-hidden="true">{{ icon }}</span>
      <span class="action-button__label" [title]="text">{{ text }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        aspect-ratio: 1 / 1;
        min-width: 0;
      }

      .action-button {
        width: 100%;
        height: 100%;
        border: 1px solid #3f5399;
        border-radius: 10px;
        background: linear-gradient(145deg, #6076d1 0%, #4d61bb 100%);
        color: #fff;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.45rem;
        padding: 0.7rem;
        transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
        box-shadow: 0 4px 12px rgba(45, 58, 112, 0.28);
      }

      .action-button:hover:not(:disabled) {
        background: linear-gradient(145deg, #5268c3 0%, #4153a9 100%);
        transform: translateY(-1px);
      }

      .action-button:active:not(:disabled) {
        transform: translateY(0);
      }

      .action-button:focus-visible {
        outline: 3px solid #c9d3ff;
        outline-offset: 2px;
      }

      .action-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .action-button__icon {
        font-size: clamp(1.1rem, 1.8vw, 1.5rem);
        line-height: 1;
      }

      .action-button__label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        white-space: normal;
        word-break: normal;
        overflow-wrap: normal;
        hyphens: none;
        text-align: center;
        line-height: 1.15;
        font-size: clamp(0.72rem, 1.1vw, 0.86rem);
        font-weight: 700;
      }
    `,
  ],
})
export class ActionButtonComponent {
  @Input() icon = '';
  @Input() text = '';
  @Input() disabled = false;
  @Output() onClick = new EventEmitter<void>();

  handleClick(): void {
    if (this.disabled) {
      return;
    }

    this.onClick.emit();
  }
}
