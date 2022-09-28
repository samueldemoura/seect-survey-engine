import { v4 } from 'uuid';

import { Entity, Enum, Index, PrimaryKey, Property } from '@mikro-orm/core';

import { DeliveryMechanisms } from '@src/modules/delivery-mechanisms';

@Entity()
export default class DeliveryAttempt {
  /** Attempt identifier. */
  @PrimaryKey()
  uuid = v4();

  /** When the receipt was created. */
  @Property()
  timestamp = new Date();

  /** What mechanism was used for this delivery attempt. */
  @Property()
  @Enum(() => DeliveryMechanisms)
  deliveryMechanism!: DeliveryMechanisms;

  /** A hash or code of some sort which anonymously identifies the recipient. */
  @Property()
  @Index()
  personIdentifier!: string;

  /** Whether the delivery attempt was successful. */
  @Property()
  @Index()
  wasSuccessful!: boolean;

  /** Any other notes about the attempt (e.g.: error stack on failure) */
  @Property()
  notes?: string;
}
