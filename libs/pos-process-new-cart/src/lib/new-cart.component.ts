import { Component, OnInit, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { Tmf663ApiService } from "@pos/tmf663";

@Component({
  selector: "pos-new-cart",
  standalone: true,
  template: `
    <div class="new-cart-container">
      @if (creating()) {
        <p class="status">Creating new cart...</p>
      }
      @if (error()) {
        <p class="error">{{ error() }}</p>
        <button (click)="retry()">Retry</button>
      }
    </div>
  `,
  styles: [`
    .new-cart-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      gap: 1rem;
    }

    .status {
      font-size: 1.2rem;
      color: #666;
    }

    .error {
      color: #d32f2f;
      font-size: 1rem;
    }

    button {
      padding: 0.5rem 1rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    button:hover {
      background: #1565c0;
    }
  `],
})
export class NewCartComponent implements OnInit {
  private readonly api = inject(Tmf663ApiService);
  private readonly router = inject(Router);

  creating = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.createAndNavigate();
  }

  retry(): void {
    this.createAndNavigate();
  }

  private createAndNavigate(): void {
    this.creating.set(true);
    this.error.set(null);

    this.api.createCart({}).subscribe({
      next: (cart) => {
        this.creating.set(false);
        this.router.navigate(['/cart', cart.id, 'find-sale-offer']);
      },
      error: (err) => {
        this.creating.set(false);
        this.error.set(
          err?.message || 'Failed to create cart. Please try again.'
        );
      },
    });
  }
}
