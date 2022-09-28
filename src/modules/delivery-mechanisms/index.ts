import EmailDeliveryMechanism from '@src/modules/delivery-mechanisms/email';
import {
  DeliveryInfo,
  DeliveryMechanism,
} from '@src/modules/delivery-mechanisms/interfaces';
import MockDeliveryMechanism from '@src/modules/delivery-mechanisms/mock';

/** Enumeration of all available delivery mechanisms. */
// ESLint false positive.
// See: https://github.com/typescript-eslint/typescript-eslint/issues/325
// eslint-disable-next-line no-shadow
export enum DeliveryMechanisms {
  EMAIL = 'email',
  MOCK = 'mock',
}

const deliveryMechanismToImplementationMap: Record<
  DeliveryMechanisms,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
  // NOTE(samuel): ^ this `any` should be something like:
  // `Constructor<DeliveryMechanism<DeliveryInfo>>`
  //
  // where:
  // `type Constructor<T> = Function & { prototype: T }`
  //
  // but I CBA to type it up properly ATM, ignoring for now
> = {
  email: EmailDeliveryMechanism,
  mock: MockDeliveryMechanism,
};

/**
 * Gets an instance of the class which can deliver through the given `mechanism`.
 *
 * @param mechanism - Mechanism to get an implementatino for.
 * @returns Concrete implementation.
 */
export const getDeliveryMechanismImplementation = (
  mechanism: DeliveryMechanisms,
): DeliveryMechanism<DeliveryInfo> =>
  new deliveryMechanismToImplementationMap[mechanism]();
