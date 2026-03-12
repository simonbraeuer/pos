import { Component, Input, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProductOrder } from '@pos/tmf622';
import {
  CustomerBill,
  ReceiptRenderContext,
  ReceiptRenderFormat,
  Tmf678ApiService,
} from '@pos/tmf678';
import { Payment } from '@pos/tmf676';
import { Location, LocationApiService } from '@pos/location';
import { AuthStateService } from '@pos/login';

@Component({
  selector: 'pos-order-complete',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="order-complete">
      @if (loadingReceipt()) {
        <div class="order-complete__loading">
          <div class="spinner"></div>
          <p>Rendering receipt document on server...</p>
        </div>
      } @else if (receiptError()) {
        <div class="order-complete__error">
          <p>{{ receiptError() }}</p>
          <button class="btn btn--secondary" (click)="retryReceipt()" type="button">
            Retry
          </button>
        </div>
      } @else if (receipt()) {
        <div class="receipt-viewer">
          <div class="receipt-viewer__header">
            <div>
              <h3>Server-side Receipt</h3>
              <p>{{ receipt()!.billNo }}</p>
            </div>
            <div class="receipt-viewer__header-actions">
              <span class="receipt-viewer__format">
                {{ renderFormat() === 'pdfA4' ? 'PDF (A4)' : 'Thermal Receipt' }}
              </span>

              @if (renderFormat() === 'pdfA4' && pdfPreviewUrl()) {
                <button
                  class="btn btn--secondary receipt-viewer__expand"
                  (click)="openPdfFullscreen()"
                  type="button"
                >
                  Expand preview
                </button>
              }
            </div>
          </div>

          @if (renderFormat() === 'pdfA4' && pdfPreviewUrl()) {
            <div class="receipt-viewer__document">
              <iframe
                class="receipt-viewer__pdf"
                [src]="pdfPreviewUrl()"
                title="Receipt PDF preview"
              ></iframe>
            </div>
          } @else if (renderFormat() === 'epsonTmt88') {
            <div class="receipt-viewer__text receipt-viewer__document">
              <h4>Receipt Preview</h4>
              <pre>{{ printerDecodedText() }}</pre>
            </div>
          } @else {
            <div class="order-complete__error">
              <p>No server-side document payload available for selected format.</p>
            </div>
          }
        </div>
      }

      @if (isPdfFullscreen() && pdfPreviewUrl()) {
        <div class="receipt-modal-overlay" role="dialog" aria-modal="true" aria-label="Receipt preview">
          <div class="receipt-modal">
            <button
              class="receipt-modal__close"
              type="button"
              aria-label="Close fullscreen preview"
              (click)="closePdfFullscreen()"
            >
              x
            </button>
            <iframe
              class="receipt-modal__pdf"
              [src]="pdfPreviewUrl()"
              title="Receipt PDF fullscreen preview"
            ></iframe>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .order-complete {
        padding: 1rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        background: #f5f5f5;
        min-height: 28rem;
      }

      .order-complete__loading,
      .order-complete__error {
        text-align: center;
        padding: 2rem;
      }

      .spinner {
        width: 40px;
        height: 40px;
        margin: 0 auto 1rem;
        border: 4px solid #e0e0e0;
        border-top-color: #1a237e;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      .order-complete__error {
        color: #d32f2f;
        background: #fff;
        border-radius: 4px;
        max-width: 460px;
      }

      .receipt-viewer {
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        width: 100%;
        max-width: 920px;
        overflow: hidden;
        border-radius: 8px;
      }

      .receipt-viewer__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.2rem;
        border-bottom: 1px solid #ececec;

        h3 {
          margin: 0;
          font-size: 1rem;
          color: #1a237e;
        }

        p {
          margin: 0.2rem 0 0;
          color: #555;
          font-size: 0.82rem;
        }
      }

      .receipt-viewer__header-actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .receipt-viewer__format {
        border: 1px solid #cfd8dc;
        border-radius: 14px;
        padding: 0.25rem 0.65rem;
        font-size: 0.75rem;
        font-weight: bold;
        color: #37474f;
        background: #f7fbff;
      }

      .receipt-viewer__pdf {
        width: 100%;
        height: min(78vh, 980px);
        border: none;
        display: block;
      }

      .receipt-viewer__document {
        position: relative;
      }

      .receipt-viewer__expand {
        margin-top: 0;
        padding: 0.35rem 0.8rem;
        font-size: 0.78rem;
      }

      .receipt-viewer__text {
        padding: 1rem 1.2rem;

        h4 {
          margin: 0 0 0.6rem;
          font-size: 0.84rem;
          color: #37474f;
        }

        pre {
          margin: 0 0 1rem;
          padding: 0.75rem;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: #fafafa;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 0.76rem;
          line-height: 1.35;
        }
      }


      .btn {
        border: none;
        border-radius: 8px;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 1rem;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      .btn--secondary {
        background: #f5f5f5;
        border: 1px solid #ddd;
        color: #333;

        &:hover:not(:disabled) {
          background: #efefef;
        }
      }

      .receipt-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 1200;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }

      .receipt-modal {
        position: relative;
        width: min(98vw, 1600px);
        height: calc(100vh - 2rem);
        background: #fff;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 12px 44px rgba(0, 0, 0, 0.35);
      }

      .receipt-modal__close {
        position: absolute;
        top: 0.7rem;
        right: 0.7rem;
        z-index: 2;
        width: 2.1rem;
        height: 2.1rem;
        border: none;
        border-radius: 50%;
        background: rgba(33, 33, 33, 0.88);
        color: #fff;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
      }

      .receipt-modal__close:hover {
        background: #000;
      }

      .receipt-modal__pdf {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class OrderCompleteComponent {
  private readonly billApi = inject(Tmf678ApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly authState = inject(AuthStateService);
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) order!: ProductOrder;
  @Input({ required: true }) payments!: Payment[];

  loadingReceipt = signal(true);
  receiptError = signal<string | null>(null);
  receipt = signal<CustomerBill | null>(null);
  renderFormat = signal<ReceiptRenderFormat>('pdfA4');
  pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  isPdfFullscreen = signal(false);
  printerDecodedText = signal<string>('');

  shopName = signal<string | null>(null);
  shopAddress = signal<string | null>(null);
  cashierName = signal<string | null>(null);
  cashierCode = signal<string | null>(null);

  constructor() {
    this.loadReceiptLocation();
    this.loadCashierInfo();

    effect(() => {
      const orderData = this.order;
      if (orderData?.id) {
        this.fetchOrCreateReceipt(orderData);
      }
    });
  }

  private fetchOrCreateReceipt(order: ProductOrder): void {
    this.loadingReceipt.set(true);
    this.receiptError.set(null);
    this.isPdfFullscreen.set(false);
    this.pdfPreviewUrl.set(null);
    this.printerDecodedText.set('');

    const format = this.resolveReceiptRenderFormat();
    this.renderFormat.set(format);

    this.billApi.searchCustomerBills({ billingAccountId: order.id }, 0, 1).subscribe({
      next: (result) => {
        if (result.items.length > 0) {
          this.renderServerDocument(result.items[0], order, format);
        } else {
          this.createReceipt(order, format);
        }
      },
      error: () => {
        this.createReceipt(order, format);
      },
    });
  }

  private renderServerDocument(
    bill: CustomerBill,
    order: ProductOrder,
    format: ReceiptRenderFormat
  ): void {
    this.billApi
      .renderReceiptDocument(bill.id, {
        format,
        context: this.buildRenderContext(order),
      })
      .subscribe({
        next: (updated) => {
          this.receipt.set(updated);
          this.applyDocumentPayload(updated, format);
          this.loadingReceipt.set(false);
        },
        error: (err) => {
          this.loadingReceipt.set(false);
          this.receiptError.set(err?.message || 'Failed to render server-side receipt document');
        },
      });
  }

  private createReceipt(order: ProductOrder, format: ReceiptRenderFormat): void {
    const totalAmount = order.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value || 0;
    const taxExcludedAmount =
      order.orderTotalPrice?.[0]?.price?.dutyFreeAmount?.value || totalAmount / 1.2;
    const taxRate = order.orderTotalPrice?.[0]?.price?.taxRate || 20;
    const taxAmount = totalAmount - taxExcludedAmount;

    this.billApi
      .createCustomerBill({
        category: 'receipt',
        state: 'settled',
        billDate: new Date().toISOString(),
        billingAccount: {
          id: order.id,
          name: `Order ${order.id}`,
        },
        amountDue: { unit: 'EUR', value: 0 },
        taxIncludedAmount: { unit: 'EUR', value: totalAmount },
        taxExcludedAmount: { unit: 'EUR', value: taxExcludedAmount },
        relatedParty: order.relatedParty,
        appliedPayment: this.payments.map((p) => ({
          payment: {
            id: p.id,
            name: p.paymentMethod?.name || 'Payment',
          },
          appliedAmount: p.amount || { unit: 'EUR', value: 0 },
        })),
        taxItem: [
          {
            taxCategory: 'VAT',
            taxRate,
            taxAmount: { unit: 'EUR', value: taxAmount },
          },
        ],
        renderReceipt: {
          format,
          context: this.buildRenderContext(order),
        },
      })
      .subscribe({
        next: (bill) => {
          this.receipt.set(bill);
          this.applyDocumentPayload(bill, format);
          this.loadingReceipt.set(false);
        },
        error: (err) => {
          this.loadingReceipt.set(false);
          this.receiptError.set(err?.message || 'Failed to generate receipt');
        },
      });
  }

  retryReceipt(): void {
    this.fetchOrCreateReceipt(this.order);
  }

  openPdfFullscreen(): void {
    if (!this.pdfPreviewUrl()) {
      return;
    }
    this.isPdfFullscreen.set(true);
  }

  closePdfFullscreen(): void {
    this.isPdfFullscreen.set(false);
  }

  private buildRenderContext(order: ProductOrder): ReceiptRenderContext {
    return {
      companyName: 'TMF Telco GmbH',
      shopName: this.shopName() || undefined,
      shopAddress: this.shopAddress() || undefined,
      cashierName: this.cashierName() || undefined,
      cashierCode: this.cashierCode() || undefined,
      customerName: order.relatedParty?.find((p) => p.role === 'customer')?.name,
      items: order.productOrderItem.map((item) => {
        const unitPrice =
          item.itemPrice?.[0]?.price?.taxIncludedAmount ||
          item.itemTotalPrice?.[0]?.price?.taxIncludedAmount ||
          { unit: 'EUR', value: 0 };
        const total = item.itemTotalPrice?.[0]?.price?.taxIncludedAmount || {
          unit: unitPrice.unit,
          value: unitPrice.value * item.quantity,
        };

        return {
          name: item.productOffering?.name || item.product?.name || 'Item',
          quantity: item.quantity,
          unitPrice,
          lineTotal: total,
        };
      }),
    };
  }

  private applyDocumentPayload(bill: CustomerBill, format: ReceiptRenderFormat): void {
    const doc =
      bill.billDocument?.find((d) => d.renderFormat === format) ||
      bill.billDocument?.find((d) =>
        format === 'pdfA4' ? d.mimeType === 'application/pdf' : d.mimeType === 'text/plain'
      );

    if (!doc) {
      this.receiptError.set('Server-side document metadata is missing.');
      return;
    }

    if (format === 'pdfA4') {
      const dataUrl = this.resolveDataUrl(
        doc.mimeType || 'application/pdf',
        doc.contentBase64,
        doc.url
      );
      if (!dataUrl) {
        this.receiptError.set('PDF payload is missing.');
        return;
      }
      this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(dataUrl));
      this.printerDecodedText.set('');
      return;
    }

    const raw = this.resolvePlainTextPayload(doc.contentBase64, doc.url);
    if (!raw) {
      this.receiptError.set('Receipt text payload is missing.');
      return;
    }

    this.isPdfFullscreen.set(false);
    this.printerDecodedText.set(this.decodeEpsonCommands(raw));
    this.pdfPreviewUrl.set(null);
  }

  private resolveDataUrl(mimeType: string, base64?: string, url?: string): string | null {
    if (url?.startsWith('data:')) {
      return url;
    }
    if (base64) {
      return `data:${mimeType};base64,${base64}`;
    }
    return null;
  }

  private resolvePlainTextPayload(base64?: string, url?: string): string | null {
    if (base64) {
      return atob(base64);
    }

    if (!url) {
      return null;
    }

    const base64Match = url.match(/^data:text\/plain;base64,(.+)$/i);
    if (base64Match?.[1]) {
      return atob(base64Match[1]);
    }

    const textMatch = url.match(/^data:text\/plain,(.+)$/i);
    if (textMatch?.[1]) {
      return decodeURIComponent(textMatch[1]);
    }

    return null;
  }

  private decodeEpsonCommands(raw: string): string {
    let text = '';

    for (let i = 0; i < raw.length; i++) {
      const code = raw.charCodeAt(i);
      const char = raw[i];

      // Skip common ESC/POS command prefixes and following command bytes.
      if (code === 0x1b) {
        i += 2;
        continue;
      }

      // Skip paper cut command sequence (GS V m n).
      if (code === 0x1d && (raw[i + 1] === 'V' || raw[i + 1] === 'v')) {
        i += 3;
        continue;
      }

      // Keep printable chars and newlines, drop other control bytes.
      if (code < 32 && char !== '\n' && char !== '\r' && char !== '\t') {
        continue;
      }

      if (code !== 0x7f) {
        text += char;
      }
    }

    return text
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0))
      .join('\n');
  }

  private resolveReceiptRenderFormat(): ReceiptRenderFormat {
    try {
      const raw = localStorage.getItem('pos_receipt_options');
      if (!raw) return 'pdfA4';
      const parsed = JSON.parse(raw) as { outputType?: 'pdf' | 'printer' };
      return parsed.outputType === 'printer' ? 'epsonTmt88' : 'pdfA4';
    } catch {
      return 'pdfA4';
    }
  }

  private loadReceiptLocation(): void {
    const locationId = this.resolveSelectedLocationId();
    if (locationId === null) {
      return;
    }

    this.locationApi.getLocation(locationId).subscribe({
      next: (location) => {
        this.shopName.set(location.fullName || location.name || null);
        this.shopAddress.set(this.formatShopAddress(location));
      },
      error: () => {
        this.shopName.set(null);
        this.shopAddress.set(null);
      },
    });
  }

  private resolveSelectedLocationId(): number | null {
    const fallbackLocationId = 1;

    try {
      const raw = localStorage.getItem('pos_tablet_selection');
      if (!raw) return fallbackLocationId;

      const parsed = JSON.parse(raw) as { locationId?: number };
      return typeof parsed.locationId === 'number' ? parsed.locationId : fallbackLocationId;
    } catch {
      return fallbackLocationId;
    }
  }

  private formatShopAddress(location: Location): string | null {
    const address = location.address;
    if (!address) {
      return null;
    }

    return `${address.street}, ${address.postalCode} ${address.city}, ${address.country}`;
  }

  private loadCashierInfo(): void {
    const user = this.authState.currentUser();
    if (!user) {
      this.cashierName.set(null);
      this.cashierCode.set(null);
      return;
    }

    this.cashierName.set(user.displayName || user.username || null);
    this.cashierCode.set(user.username || user.id || null);
  }
}
