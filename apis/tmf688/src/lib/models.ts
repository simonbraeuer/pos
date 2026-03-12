/** Generic TMF688 event payload. */
export interface Tmf688Event<TPayload = unknown> {
  eventType: string;
  eventId: string;
  timestamp: Date;
  resourceType?: string;
  resourceId?: string;
  payload?: TPayload;
  reason?: string;
}

/** Input for publishing a TMF688 event. */
export type Tmf688PublishEvent<TPayload = unknown> = Omit<Tmf688Event<TPayload>, 'eventId' | 'timestamp'> & {
  eventId?: string;
  timestamp?: Date;
};
