import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Tmf688Event, Tmf688PublishEvent } from './models';
import { instrumentMockHarLogging } from './mock-har-logger';

/**
 * Generic TMF688 event bus service.
 *
 * This service is domain-agnostic and does not depend on cart,
 * catalog, or any other business model.
 */
@Injectable({ providedIn: 'root' })
export class Tmf688EventBusService {
  private readonly eventSubject = new Subject<Tmf688Event>();

  constructor() {
    instrumentMockHarLogging(this, 'tmf688', '/eventManagement/v4/event');
  }

  /** Observable stream of all events. */
  readonly events$: Observable<Tmf688Event> = this.eventSubject.asObservable();

  /** Publish a TMF688 event into the bus. */
  publish<TPayload>(event: Tmf688PublishEvent<TPayload>): void {
    this.eventSubject.next({
      eventId: event.eventId ?? this.generateEventId(),
      timestamp: event.timestamp ?? new Date(),
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      payload: event.payload,
      reason: event.reason,
    });
  }

  /** Get events by TMF688 event type. */
  getEventsByType(eventType: string): Observable<Tmf688Event> {
    return this.events$.pipe(filter(event => event.eventType === eventType));
  }

  /** Get events by resource id (and optional resource type). */
  getEventsForResource(resourceId: string, resourceType?: string): Observable<Tmf688Event> {
    return this.events$.pipe(
      filter(event => event.resourceId === resourceId),
      filter(event => !resourceType || event.resourceType === resourceType)
    );
  }

  /** Get events by resource type. */
  getEventsForResourceType(resourceType: string): Observable<Tmf688Event> {
    return this.events$.pipe(filter(event => event.resourceType === resourceType));
  }

  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random()}`;
  }
}
