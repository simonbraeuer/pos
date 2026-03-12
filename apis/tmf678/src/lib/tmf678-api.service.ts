import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import {
  CustomerBill,
  CreateCustomerBillRequest,
  RenderReceiptDocumentRequest,
  UpdateCustomerBillRequest,
  CustomerBillSearchCriteria,
  PaginatedCustomerBillResults,
  Money,
} from './models';

/** Simulates realistic API network latency (150–800 ms). */
function simulateLatency(): number {
  return 150 + Math.random() * 650;
}

type HttpLikeError = Error & { status?: number };

function createHttpLikeError(message: string, status: number): HttpLikeError {
  const err = new Error(message) as HttpLikeError;
  err.status = status;
  return err;
}

/** Randomly reject ~5% of requests to simulate transient failures. */
function maybeNetworkError(): Observable<never> | null {
  if (Math.random() < 0.05) {
    return throwError(() => createHttpLikeError('Customer Bill service temporarily unavailable', 503));
  }
  return null;
}

/** Generate unique bill ID */
function generateBillId(): string {
  return `bill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Generate unique bill number */
function generateBillNo(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV-${year}${month}-${random}`;
}

const RECEIPT_LINE_WIDTH = 48;
const CURRENCY_COLUMN_WIDTH = 8;
const AMOUNT_COLUMN_WIDTH = 12;
const LEFT_COLUMN_WIDTH =
  RECEIPT_LINE_WIDTH - CURRENCY_COLUMN_WIDTH - AMOUNT_COLUMN_WIDTH - 2;
const COMBINED_RIGHT_COLUMN_WIDTH = AMOUNT_COLUMN_WIDTH + 1 + CURRENCY_COLUMN_WIDTH;

function fitLeftText(text: string, maxLength: number): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 1)}~`;
}

function formatAmountValue(value?: number): string {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return safeValue.toFixed(2);
}

function formatMoneyColumnLine(label: string, money?: Money): string {
  const currency = (money?.unit || 'EUR').slice(0, CURRENCY_COLUMN_WIDTH);
  const amount = formatAmountValue(money?.value);
  const left = fitLeftText(label, LEFT_COLUMN_WIDTH).padEnd(LEFT_COLUMN_WIDTH, ' ');
  const combined = `${amount} ${currency}`;
  const combinedCol = combined.padStart(COMBINED_RIGHT_COLUMN_WIDTH, ' ');
  return `${left} ${combinedCol}`;
}

function formatItemPriceLine(unitPrice: Money, quantity: number, lineTotal: Money): string {
  const left = `Unit ${formatAmountValue(unitPrice?.value)} x ${quantity}`;
  return formatMoneyColumnLine(left, lineTotal);
}

function sanitizeToLatin1(text: string): string {
  // Map common extended characters to ASCII equivalents for PDF compatibility
  const charMap: Record<string, string> = {
    'ä': 'ae', 'Ä': 'AE',
    'ö': 'oe', 'Ö': 'OE',
    'ü': 'ue', 'Ü': 'UE',
    'ß': 'ss',
    'é': 'e', 'è': 'e', 'ê': 'e',
    'á': 'a', 'à': 'a', 'â': 'a',
    'í': 'i', 'ì': 'i', 'î': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o',
    'ç': 'c', 'Ç': 'C',
  };
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    result += code < 128 ? char : (charMap[char] || '?');
  }
  return result;
}

function escapePdfText(text: string): string {
  const sanitized = sanitizeToLatin1(text);
  return sanitized.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfBase64(lines: string[]): string {
  const normalizedLines = lines.length > 0 ? lines : ['Receipt'];
  const content = [
    'BT',
    '/F1 11 Tf',
    '14 TL',
    '42 800 Td',
    ...normalizedLines.map((line, idx) => `${idx === 0 ? '' : 'T* '}(` + escapePdfText(line) + ') Tj'),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return btoa(pdf);
}

function buildReceiptTextLines(
  bill: CustomerBill,
  render: RenderReceiptDocumentRequest,
  withCopyWatermark = false
): string[] {
  const lines: string[] = [];
  const ctx = render.context;
  const separator = '-'.repeat(RECEIPT_LINE_WIDTH);

  if (withCopyWatermark) {
    lines.push('******************** COPY ********************');
    lines.push('');
  }

  lines.push(ctx.companyName);
  if (ctx.shopName) lines.push(ctx.shopName);
  if (ctx.shopAddress) lines.push(ctx.shopAddress);
  lines.push('');
  lines.push(`Receipt: ${bill.billNo || bill.id}`);
  lines.push(`Date: ${bill.billDate || new Date().toISOString()}`);
  if (ctx.cashierName) lines.push(`Cashier: ${ctx.cashierName}`);
  if (ctx.cashierCode) lines.push(`Cashier code: ${ctx.cashierCode}`);
  if (ctx.customerName) lines.push(`Customer: ${ctx.customerName}`);
  lines.push('');
  lines.push('Items');
  lines.push(separator);

  for (const item of ctx.items) {
    lines.push(`${item.quantity} x ${item.name}`);
    lines.push(formatItemPriceLine(item.unitPrice, item.quantity, item.lineTotal));
  }

  lines.push(separator);
  lines.push(formatMoneyColumnLine('Subtotal', bill.taxExcludedAmount));

  if (bill.taxItem?.length) {
    for (const tax of bill.taxItem) {
      lines.push(formatMoneyColumnLine(`${tax.taxCategory} ${tax.taxRate}%`, tax.taxAmount));
    }
  }

  lines.push(formatMoneyColumnLine('TOTAL', bill.taxIncludedAmount));

  if (bill.appliedPayment?.length) {
    lines.push('');
    lines.push('Payments');
    for (const payment of bill.appliedPayment) {
      lines.push(formatMoneyColumnLine(payment.payment.name || payment.payment.id, payment.appliedAmount));
    }
  }

  lines.push('');
  lines.push('Thank you for your purchase.');
  return lines;
}

function buildEpsonCommandText(lines: string[]): string {
  const ESC = '\x1B';
  const GS = '\x1D';
  return [
    `${ESC}@`,
    `${ESC}a\x01`,
    `${ESC}E\x01`,
    lines[0] || '',
    `${ESC}E\x00`,
    `${ESC}a\x00`,
    ...lines.slice(1),
    '',
    `${GS}V\x41\x00`,
  ].join('\n');
}

function buildRenderedDocument(
  bill: CustomerBill,
  render: RenderReceiptDocumentRequest,
  withCopyWatermark = false
) {
  const lines = buildReceiptTextLines(bill, render, withCopyWatermark);

  if (render.format === 'pdfA4') {
    const contentBase64 = buildPdfBase64(lines);
    return {
      id: withCopyWatermark ? `doc-${bill.id}-pdf-a4-copy` : `doc-${bill.id}-pdf-a4`,
      name: `Receipt ${bill.billNo || bill.id} (A4${withCopyWatermark ? ' - COPY' : ''})`,
      description: `${withCopyWatermark ? 'Copy of ' : ''}A4 PDF receipt for ${bill.billNo || bill.id}`,
      mimeType: 'application/pdf',
      renderFormat: 'pdfA4' as const,
      contentEncoding: 'base64' as const,
      contentBase64,
      url: `data:application/pdf;base64,${contentBase64}`,
    };
  }

  const commandText = buildEpsonCommandText(lines);
  const contentBase64 = btoa(commandText);
  return {
    id: withCopyWatermark ? `doc-${bill.id}-epson-tmt88-copy` : `doc-${bill.id}-epson-tmt88`,
    name: `Receipt ${bill.billNo || bill.id} (EPSON TM-T88${withCopyWatermark ? ' - COPY' : ''})`,
    description: `${withCopyWatermark ? 'Copy of ' : ''}EPSON TM-T88 command stream for ${bill.billNo || bill.id}`,
    mimeType: 'text/plain',
    renderFormat: 'epsonTmt88' as const,
    contentEncoding: 'base64' as const,
    contentBase64,
    url: `data:text/plain;base64,${contentBase64}`,
  };
}

/** Initial customer bills seed data */
const INITIAL_CUSTOMER_BILLS: CustomerBill[] = Array.from(new Map<string, CustomerBill>([
  [
    'bill-2024-001',
    {
      id: 'bill-2024-001',
      href: '/customerBillManagement/v4/customerBill/bill-2024-001',
      billNo: 'INV-202402-0001',
      runType: 'onCycle',
      category: 'normal',
      state: 'settled',
      lastUpdate: '2024-02-15T10:30:00Z',
      billDate: '2024-02-01T00:00:00Z',
      nextBillDate: '2024-03-01T00:00:00Z',
      paymentDueDate: '2024-02-15T00:00:00Z',
      billingPeriod: {
        startDateTime: '2024-01-01T00:00:00Z',
        endDateTime: '2024-01-31T23:59:59Z',
      },
      amountDue: { unit: 'EUR', value: 0 },
      taxIncludedAmount: { unit: 'EUR', value: 119.99 },
      taxExcludedAmount: { unit: 'EUR', value: 99.99 },
      remainingAmount: { unit: 'EUR', value: 0 },
      billingAccount: {
        id: 'ba-001',
        name: 'Main Billing Account',
      },
      appliedPayment: [
        {
          payment: {
            id: 'pay-001',
            name: 'Credit Card Payment',
          },
          appliedAmount: { unit: 'EUR', value: 119.99 },
        },
      ],
      paymentMethod: [
        {
          id: 'pm-001',
          name: 'Visa **** 1234',
          '@referredType': 'CreditCard',
        },
      ],
      relatedParty: [
        {
          id: 'cust-001',
          name: 'Johannes Müller',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      taxItem: [
        {
          taxCategory: 'VAT',
          taxRate: 20,
          taxAmount: { unit: 'EUR', value: 20.0 },
        },
      ],
      billDocument: [
        {
          id: 'doc-001',
          name: 'Invoice February 2024',
          description: 'Monthly invoice for billing period Jan 2024',
          mimeType: 'application/pdf',
          url: '/documents/INV-202402-0001.pdf',
        },
      ],
    },
  ],
  [
    'bill-2024-002',
    {
      id: 'bill-2024-002',
      href: '/customerBillManagement/v4/customerBill/bill-2024-002',
      billNo: 'INV-202403-0001',
      runType: 'onCycle',
      category: 'normal',
      state: 'partiallyPaid',
      lastUpdate: '2024-03-08T14:20:00Z',
      billDate: '2024-03-01T00:00:00Z',
      nextBillDate: '2024-04-01T00:00:00Z',
      paymentDueDate: '2024-03-15T00:00:00Z',
      billingPeriod: {
        startDateTime: '2024-02-01T00:00:00Z',
        endDateTime: '2024-02-29T23:59:59Z',
      },
      amountDue: { unit: 'EUR', value: 314.98 },
      taxIncludedAmount: { unit: 'EUR', value: 429.99 },
      taxExcludedAmount: { unit: 'EUR', value: 358.33 },
      remainingAmount: { unit: 'EUR', value: 314.98 },
      billingAccount: {
        id: 'ba-001',
        name: 'Main Billing Account',
      },
      appliedPayment: [
        {
          payment: {
            id: 'pay-002',
            name: 'Partial Payment',
          },
          appliedAmount: { unit: 'EUR', value: 115.01 },
        },
      ],
      paymentMethod: [
        {
          id: 'pm-001',
          name: 'Visa **** 1234',
          '@referredType': 'CreditCard',
        },
      ],
      relatedParty: [
        {
          id: 'cust-001',
          name: 'Johannes Müller',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      taxItem: [
        {
          taxCategory: 'VAT',
          taxRate: 20,
          taxAmount: { unit: 'EUR', value: 71.66 },
        },
      ],
      billDocument: [
        {
          id: 'doc-002',
          name: 'Invoice March 2024',
          description: 'Monthly invoice for billing period Feb 2024',
          mimeType: 'application/pdf',
          url: '/documents/INV-202403-0001.pdf',
        },
      ],
    },
  ],
  [
    'bill-2024-003',
    {
      id: 'bill-2024-003',
      href: '/customerBillManagement/v4/customerBill/bill-2024-003',
      billNo: 'INV-202403-0002',
      runType: 'onCycle',
      category: 'business',
      state: 'sent',
      lastUpdate: '2024-03-09T09:00:00Z',
      billDate: '2024-03-09T00:00:00Z',
      paymentDueDate: '2024-03-23T00:00:00Z',
      billingPeriod: {
        startDateTime: '2024-03-01T00:00:00Z',
        endDateTime: '2024-03-08T23:59:59Z',
      },
      amountDue: { unit: 'EUR', value: 129.0 },
      taxIncludedAmount: { unit: 'EUR', value: 129.0 },
      taxExcludedAmount: { unit: 'EUR', value: 107.5 },
      remainingAmount: { unit: 'EUR', value: 129.0 },
      billingAccount: {
        id: 'ba-002',
        name: 'Business Account',
      },
      paymentMethod: [
        {
          id: 'pm-002',
          name: 'Bank Transfer',
          '@referredType': 'BankAccount',
        },
      ],
      relatedParty: [
        {
          id: 'cust-002',
          name: 'Tech Solutions Inc',
          role: 'customer',
          '@referredType': 'Organization',
        },
      ],
      taxItem: [
        {
          taxCategory: 'VAT',
          taxRate: 20,
          taxAmount: { unit: 'EUR', value: 21.5 },
        },
      ],
      billDocument: [
        {
          id: 'doc-003',
          name: 'Invoice March 2024',
          description: 'Business invoice for early March 2024',
          mimeType: 'application/pdf',
          url: '/documents/INV-202403-0002.pdf',
        },
      ],
    },
  ],
]).values());

const STORE_NAME = 'customer-bills';
const DB_NAME = 'pos-tmf678-customer-bills';

/**
 * TMF-678 Customer Bill Management API Service
 *
 * Provides access to customer bill management operations
 * following the TMForum TMF-678 standard.
 */
@Injectable({ providedIn: 'root' })
export class Tmf678ApiService implements OnInit {
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf678', '/customerBillManagement/v4/customerBill');
  }

  ngOnInit(): void {
    this.initializeDb();
  }

  private initializeDb(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.idb.initialize(DB_NAME, [{ name: STORE_NAME, keyPath: 'id', autoIncrement: false }]);
      const count = await firstValueFrom(this.idb.count(STORE_NAME));
      if (count === 0) {
        for (const bill of INITIAL_CUSTOMER_BILLS) {
          await firstValueFrom(this.idb.put(STORE_NAME, bill));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  /**
   * Create a new customer bill
   * @param request Bill creation request
   * @returns Observable of created customer bill
   */
  createCustomerBill(request: CreateCustomerBillRequest): Observable<CustomerBill> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const billId = generateBillId();
          const billNo = generateBillNo();
          const now = new Date().toISOString();

          const bill: CustomerBill = {
            id: billId,
            href: `/customerBillManagement/v4/customerBill/${billId}`,
            billNo,
            runType: request.runType || 'onCycle',
            category: request.category || 'normal',
            state: request.state || 'new',
            lastUpdate: now,
            billDate: request.billDate || now,
            paymentDueDate: request.paymentDueDate,
            billingPeriod: request.billingPeriod,
            billingAccount: request.billingAccount,
            amountDue: request.amountDue,
            taxIncludedAmount: request.taxIncludedAmount,
            taxExcludedAmount: request.taxExcludedAmount,
            remainingAmount: request.amountDue,
            appliedPayment: request.appliedPayment,
            taxItem: request.taxItem,
            paymentMethod: request.paymentMethod,
            relatedParty: request.relatedParty,
          };

          if (request.renderReceipt) {
            bill.billDocument = [buildRenderedDocument(bill, request.renderReceipt)];
          }

          await firstValueFrom(this.idb.put(STORE_NAME, bill));
          setTimeout(() => {
            subscriber.next(bill);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Get a customer bill by ID
   * @param billId The bill ID
   * @returns Observable of customer bill
   */
  getCustomerBill(billId: string): Observable<CustomerBill> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const bill = await firstValueFrom(this.idb.get<CustomerBill>(STORE_NAME, billId));
            setTimeout(() => {
              subscriber.next(bill);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            subscriber.error(createHttpLikeError(`Customer bill ${billId} not found`, 404));
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Search/list customer bills with criteria
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated results
   */
  searchCustomerBills(
    criteria: CustomerBillSearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedCustomerBillResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let bills = await firstValueFrom(this.idb.getAll<CustomerBill>(STORE_NAME));

    // Filter by bill number
    if (criteria.billNo) {
      const billNoLower = criteria.billNo.toLowerCase();
      bills = bills.filter((b) => b.billNo?.toLowerCase().includes(billNoLower));
    }

    // Filter by state
    if (criteria.state) {
      bills = bills.filter((b) => b.state === criteria.state);
    }

    // Filter by billing account
    if (criteria.billingAccountId) {
      bills = bills.filter((b) => b.billingAccount?.id === criteria.billingAccountId);
    }

    // Filter by customer ID
    if (criteria.customerId) {
      bills = bills.filter((b) =>
        b.relatedParty?.some(
          (p) => p.role === 'customer' && p.id === criteria.customerId
        )
      );
    }

    // Filter by bill date range
    if (criteria.billDateFrom) {
      const from = criteria.billDateFrom;
      bills = bills.filter((b) => !!b.billDate && b.billDate >= from);
    }
    if (criteria.billDateTo) {
      const to = criteria.billDateTo;
      bills = bills.filter((b) => !!b.billDate && b.billDate <= to);
    }

    // Filter by payment due date range
    if (criteria.paymentDueDateFrom) {
      const dueFrom = criteria.paymentDueDateFrom;
      bills = bills.filter((b) => !!b.paymentDueDate && b.paymentDueDate >= dueFrom);
    }
    if (criteria.paymentDueDateTo) {
      const dueTo = criteria.paymentDueDateTo;
      bills = bills.filter((b) => !!b.paymentDueDate && b.paymentDueDate <= dueTo);
    }

    // Sort by bill date descending (newest first)
    bills.sort((a, b) => {
      const dateA = a.billDate || '';
      const dateB = b.billDate || '';
      return dateB.localeCompare(dateA);
    });

    // Pagination
    const total = bills.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = bills.slice(start, end);
    const hasMore = end < total;

          setTimeout(() => {
            subscriber.next({
              items,
              total,
              page,
              pageSize,
              hasMore,
            });
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Update a customer bill
   * @param billId The bill ID to update
   * @param request Update request
   * @returns Observable of updated bill
   */
  updateCustomerBill(
    billId: string,
    request: UpdateCustomerBillRequest
  ): Observable<CustomerBill> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const bill = await firstValueFrom(this.idb.get<CustomerBill>(STORE_NAME, billId));
            const updated: CustomerBill = {
              ...bill,
              state: request.state ?? bill.state,
              paymentDueDate: request.paymentDueDate ?? bill.paymentDueDate,
              appliedPayment: request.appliedPayment ?? bill.appliedPayment,
              taxItem: request.taxItem ?? bill.taxItem,
              paymentMethod: request.paymentMethod ?? bill.paymentMethod,
              lastUpdate: new Date().toISOString(),
            };

            await firstValueFrom(this.idb.put(STORE_NAME, updated));
            setTimeout(() => {
              subscriber.next(updated);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            subscriber.error(createHttpLikeError(`Customer bill ${billId} not found`, 404));
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  renderReceiptDocument(
    billId: string,
    request: RenderReceiptDocumentRequest
  ): Observable<CustomerBill> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const bill = await firstValueFrom(this.idb.get<CustomerBill>(STORE_NAME, billId));
            const existingDocs = bill.billDocument || [];
            const existingForFormat = existingDocs.find(
              (doc) =>
                doc.renderFormat === request.format ||
                (request.format === 'pdfA4' && doc.mimeType === 'application/pdf') ||
                (request.format === 'epsonTmt88' && doc.mimeType === 'text/plain')
            );

            if (existingForFormat) {
              const copyDoc = buildRenderedDocument(bill, request, true);
              const preserved = existingDocs.filter((doc) => doc !== existingForFormat);
              const copyBill: CustomerBill = {
                ...bill,
                billDocument: [...preserved, copyDoc],
              };

              setTimeout(() => {
                subscriber.next(copyBill);
                subscriber.complete();
              }, simulateLatency());
              return;
            }

            const newDoc = buildRenderedDocument(bill, request);
            const preserved = existingDocs.filter((doc) => doc.renderFormat !== request.format);

            const updated: CustomerBill = {
              ...bill,
              billDocument: [...preserved, newDoc],
              lastUpdate: new Date().toISOString(),
            };

            await firstValueFrom(this.idb.put(STORE_NAME, updated));
            setTimeout(() => {
              subscriber.next(updated);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            subscriber.error(createHttpLikeError(`Customer bill ${billId} not found`, 404));
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Delete a customer bill
   * @param billId The bill ID to delete
   * @returns Observable of void
   */
  deleteCustomerBill(billId: string): Observable<void> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            await firstValueFrom(this.idb.get<CustomerBill>(STORE_NAME, billId));
            await firstValueFrom(this.idb.delete(STORE_NAME, billId));
            setTimeout(() => {
              subscriber.next(void 0);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            subscriber.error(createHttpLikeError(`Customer bill ${billId} not found`, 404));
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
