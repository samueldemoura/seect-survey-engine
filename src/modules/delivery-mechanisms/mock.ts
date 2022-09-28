import Person from '@src/entities/person';
import {
  DeliveryContent,
  DeliveryInfo,
  DeliveryMechanism,
} from '@src/modules/delivery-mechanisms/interfaces';
import { getLoggerFor } from '@src/shared/logging';

const LOG = getLoggerFor({ service: 'mock-delivery' });

interface MockDeliveryInfo extends DeliveryInfo {
  mockResponseData: string;
}

export default class MockDeliveryMechanism
  implements DeliveryMechanism<MockDeliveryInfo>
{
  private counter = 0;

  async deliverTo(
    person: Person,
    content: DeliveryContent,
  ): Promise<MockDeliveryInfo> {
    const shouldFail = this.counter % 2;
    this.counter += 1;

    LOG.info(`Mocking delivery ${shouldFail ? 'failure' : 'success'}`, {
      person,
      content,
    });

    if (shouldFail) {
      throw new Error('Mocked delivery failure');
    }

    return {
      mockResponseData: `Mocked delivery success for #${person.identifier}`,
    };
  }
}
