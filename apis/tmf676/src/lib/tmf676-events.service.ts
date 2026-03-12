import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Tmf688Event, Tmf688EventBusService } from '@pos/tmf688';
import { Payment } from './models';

export enum PaymentEventType {
  PaymentCreated = 'PaymentCreationEvent',
  PaymentUpdated = 'PaymentAttributeValueChangeEvent',
  PaymentCancelled = 'PaymentStateChangeEvent',
}

export interface PaymentEvent {
  eventType: PaymentEventType;
  eventId: string;
  timestamp: Date;
  paymentId: string;
  payment: Payment;
  orderId?: string;
  reason?: string;
}

interface PaymentEventPayload {
  payment: Payment;
}

@Injectable({ providedIn: 'root' })
export class Tmf676EventsService {
  private readonly resourceType = 'Payment';

  readonly paymentEvents$: Observable<PaymentEvent>;

  constructor(private readonly eventBus: Tmf688EventBusService) {
    this.paymentEvents$ = this.eventBus.getEventsForResourceType(this.resourceType).pipe(
      map((event) => this.toPaymentEvent(event)),
      filter((event): event is PaymentEvent => event !== null)
    );
  }

  getOrderPaymentEvents(orderId: string): Observable<PaymentEvent> {
    return this.paymentEvents$.pipe(filter((event) => event.orderId === orderId));
  }

  emitPaymentCreated(payment: Payment): void {
    this.publishPaymentEvent({
      eventType: PaymentEventType.PaymentCreated,
      payment,
      reason: 'Payment created',
    });
  }

  emitPaymentUpdated(payment: Payment, reason = 'Payment updated'): void {
    this.publishPaymentEvent({
      eventType: PaymentEventType.PaymentUpdated,
      payment,
      reason,
    });
  }

  emitPaymentCancelled(payment: Payment, reason = 'Payment cancelled'): void {
    this.publishPaymentEvent({
      eventType: PaymentEventType.PaymentCancelled,
      payment,
      reason,
    });
  }

  private publishPaymentEvent(event: {
    eventType: PaymentEventType;
    payment: Payment;
    reason?: string;
  }): void {
    this.eventBus.publish<PaymentEventPayload>({
      eventType: event.eventType,
      resourceType: this.resourceType,
      resourceId: event.payment.id,
      payload: {
        payment: event.payment,
      },
      reason: event.reason,
    });
  }

  private toPaymentEvent(event: Tmf688Event): PaymentEvent | null {
    if (!this.isPaymentEventType(event.eventType)) {
      return null;
    }

    const payload = event.payload as PaymentEventPayload | undefined;
    if (!event.resourceId || !payload?.payment) {
      return null;
    }

    return {
      eventType: event.eventType,
      eventId: event.eventId,
      timestamp: event.timestamp,
      paymentId: event.resourceId,
      payment: payload.payment,
      orderId: payload.payment.externalId,
      reason: event.reason,
    };
  }

  private isPaymentEventType(eventType: string): eventType is PaymentEventType {
    return Object.values(PaymentEventType).includes(eventType as PaymentEventType);
  }
}
