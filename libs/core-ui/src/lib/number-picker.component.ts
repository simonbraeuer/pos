import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'pos-number-picker',
  standalone: true,
  template: `
    <div class="pos-number-picker">
      <button type="button" class="pos-number-picker__btn" (click)="decrement()" [disabled]="value <= min">-</button>
      <input
        type="number"
        class="pos-number-picker__input"
        [min]="min"
        [max]="max"
        [step]="step"
        [value]="value"
        (input)="onInput($event)"
      />
      <button type="button" class="pos-number-picker__btn" (click)="increment()" [disabled]="value >= max">+</button>
    </div>
  `,
  styleUrls: ['./number-picker.component.scss']
})
export class NumberPickerComponent {
  @Input() value = 0;
  @Input() min = -Infinity;
  @Input() max = Infinity;
  @Input() step = 1;
  @Output() valueChange = new EventEmitter<number>();

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).valueAsNumber;
    this.valueChange.emit(val);
  }

  decrement() {
    if (this.value > this.min) {
      this.valueChange.emit(this.value - this.step);
    }
  }

  increment() {
    if (this.value < this.max) {
      this.valueChange.emit(this.value + this.step);
    }
  }
}
