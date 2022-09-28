import config from 'config';
import nodemailer from 'nodemailer';

import Person from '@src/entities/person';
import {
  DeliveryContent,
  DeliveryInfo,
  StatefulDeliveryMechanism,
} from '@src/modules/delivery-mechanisms/interfaces';
import { assertOrThrow } from '@src/shared/utils';

type EmailDeliveryInfo = DeliveryInfo;

export default class EmailDeliveryMechanism
  implements StatefulDeliveryMechanism<EmailDeliveryInfo>
{
  transporter: nodemailer.Transporter | undefined;

  fromEmail: string | undefined = config.get('delivery.email.auth.user');

  async initialize() {
    this.transporter = nodemailer.createTransport(config.get('delivery.email'));
  }

  async deinitialize() {
    if (this.transporter) {
      this.transporter.close();
    }
  }

  async deliverTo(
    person: Person,
    content: DeliveryContent,
  ): Promise<EmailDeliveryInfo> {
    assertOrThrow(person.email !== undefined, 'Person has no email address');
    if (!this.transporter) {
      throw new Error('nodemailer transport was not initialized');
    }

    return this.transporter.sendMail({
      from: this.fromEmail,
      to: person.email,

      subject: content.title,
      html: content.body,
    });
  }
}
