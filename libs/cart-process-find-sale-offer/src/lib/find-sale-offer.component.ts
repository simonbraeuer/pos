import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { 
  SaleOfferSearchResultHandler,
  SALE_OFFER_SEARCH_RESULT_HANDLERS 
} from "@pos/cart-core";
import { ProcessContentLayoutComponent } from "@pos/core-ui";
import {
  SaleOfferSearchResult,
  Tmf663ApiService,
} from "@pos/tmf663";

@Component({
  selector: "pos-find-sale-offer",
  standalone: true,
  imports: [CommonModule, ProcessContentLayoutComponent, FormsModule, DecimalPipe],
  template: `
    <lib-process-content-layout
      icon="🔎"
      title="Find Sale Offer"
    >
      <div slot="filter">
        <p class="intro">Search by product name, product number, or serial number.</p>

        <div class="search-box">
          <input
            type="text"
            placeholder="Search offers (leave empty to list all)"
            [(ngModel)]="searchTerm"
            (keyup.enter)="searchOffers()"
          />
          <button (click)="searchOffers()" [disabled]="loading()">
            @if (loading()) { Searching... } @else { Search }
          </button>
        </div>
      </div>

      <div slot="content">
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        @if (searched() && !loading()) {
          @if (results().length === 0) {
            <p class="empty">No matching offers found.</p>
          } @else {
            <div class="results">
              <div class="results__header">Search Results</div>
              @for (offer of results(); track offer.id) {
                <button
                  class="result-row"
                  (click)="selectOffer(offer)"
                >
                  <div>
                    <div class="result-name">{{ offer.name }}</div>
                    <div class="result-meta">
                      <span class="badge" [class.bundle]="offer.kind === 'bundle'">
                        {{ offer.kind }}
                      </span>
                      | {{ offer.productNumber }}
                    </div>
                  </div>
                  <div class="result-price">
                    From {{ offer.cheapestPrice | number : "1.2-2" }} {{ offer.currency }}
                  </div>
                </button>
              }
            </div>
          }
        }
      </div>
    </lib-process-content-layout>
  `,
  styleUrl: "./find-sale-offer.component.scss",
})
export class FindSaleOfferComponent implements OnInit {
  private api = inject(Tmf663ApiService);
  private route = inject(ActivatedRoute);
  private handlers = inject(SALE_OFFER_SEARCH_RESULT_HANDLERS, { optional: true }) || [];

  searchTerm = "";
  loading = signal(false);
  searched = signal(false);
  results = signal<SaleOfferSearchResult[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    // Load available offers immediately for quick selection.
    this.searchOffers();
  }

  searchOffers(): void {
    this.error.set(null);
    this.loading.set(true);
    this.searched.set(true);

    this.api.searchSaleOffers(this.searchTerm).subscribe({
      next: offers => {
        this.results.set(offers);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? "Failed to load search results.");
        this.loading.set(false);
      },
    });
  }

  selectOffer(offer: SaleOfferSearchResult): void {
    this.error.set(null);

    // Find the first handler that can process this offer
    const handler = this.handlers.find(h => h.isForOffer(offer));

    if (handler) {
      handler.handleSearchResult(offer);
    } else {
      this.error.set(`No handler registered for ${offer.kind} offers.`);
      console.error(`No handler found for offer kind: ${offer.kind}`, offer);
    }
  }
}
