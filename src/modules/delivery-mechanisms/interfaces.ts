import Person from '@src/entities/person';

/** Content to be delivered to a Person. */
export interface DeliveryContent {
  /** Email title, unused for WhatsApp. */
  title: string;

  /** Body of the content. */
  body: string;
}

/** Basic delivery receipt info. */
// Would rather have an empty interface that I can implement in the future,
// rather than leaving this untyped.
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeliveryInfo {}

/** Basic delivery mechanism interface. */
export interface DeliveryMechanism<T> {
  /** Delivers something to a person (e.g.: email to a recipient) */
  deliverTo(person: Person, content: DeliveryContent): Promise<T>;
}

/**
 * Stateful delivery mechanism (e.g.: WhatsApp via Baileys, which requires
 * logging in and maintaining a connection through a WebSocket).
 */
export interface StatefulDeliveryMechanism<T> extends DeliveryMechanism<T> {
  initialize(): Promise<void>;
  deinitialize(): Promise<void>;
}
