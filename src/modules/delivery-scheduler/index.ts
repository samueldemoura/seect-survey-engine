/* eslint-disable no-await-in-loop */
// ^ want to be lazy here. Doesn't really matter since we don't want to fire off
// deliveries in parallel anyways.

import config from 'config';

import { EntityManager } from '@mikro-orm/core';

import DeliveryAttempt from '@src/entities/delivery-attempt';
import Person from '@src/entities/person';
import SurveyResponse from '@src/entities/survey-response';
import {
  DeliveryMechanisms,
  getDeliveryMechanismImplementation,
} from '@src/modules/delivery-mechanisms';
import {
  DeliveryInfo,
  DeliveryMechanism,
  StatefulDeliveryMechanism,
} from '@src/modules/delivery-mechanisms/interfaces';
import DeliveryThrottler from '@src/modules/delivery-scheduler/throttler';
import generateLinkFor from '@src/modules/survey/link-generator';
import { generateTextFor } from '@src/modules/survey/text-generator';
import { getLoggerFor } from '@src/shared/logging';
import { promptForContinue } from '@src/shared/prompt';

const LOG = getLoggerFor({ service: 'delivery-scheduler' });

export default class DeliveryScheduler {
  private readonly em: EntityManager;

  private readonly deliveryMechanism: DeliveryMechanisms;

  private readonly templateName: string;

  private transporter: DeliveryMechanism<DeliveryInfo>;

  private readonly throttler = new DeliveryThrottler();

  constructor(
    em: EntityManager,
    deliveryMechanism: DeliveryMechanisms,
    templateName: string,
  ) {
    this.em = em.fork();
    this.deliveryMechanism = deliveryMechanism;
    this.templateName = templateName;

    this.transporter = getDeliveryMechanismImplementation(deliveryMechanism);
  }

  async getRemainingPeople(): Promise<Person[]> {
    const DeliveryAttempts = this.em.getRepository(DeliveryAttempt);
    const SurveyResponses = this.em.getRepository(SurveyResponse);
    const People = this.em.getRepository(Person);

    LOG.info('Fetching identifiers which should be skipped', {
      deliveryMechanism: this.deliveryMechanism,
    });

    const identifiersWithDeliveryReceipts = (
      await DeliveryAttempts.find(
        {
          wasSuccessful: true,
          deliveryMechanism: this.deliveryMechanism,
        },
        { fields: ['personIdentifier'] },
      )
    ).map((x) => x.personIdentifier);

    const identifiersWithResponses = (
      await SurveyResponses.find(
        { isValid: true },
        { fields: ['personIdentifier'] },
      )
    ).map((x) => x.personIdentifier);

    const identifiersToSkip = identifiersWithResponses.concat(
      ...identifiersWithDeliveryReceipts,
    );

    LOG.info(
      'Done fetching identifiers to skip. About to fetch remaining people',
      {
        skippedCount: identifiersToSkip.length,
      },
    );

    return People.find({
      identifier: { $nin: identifiersToSkip },
    });
  }

  async deliverToSinglePerson(person: Person): Promise<DeliveryInfo> {
    const personalizedLink = generateLinkFor(person);
    const personalizedContent = await generateTextFor(
      this.templateName,
      person.kind,
      this.deliveryMechanism,
      personalizedLink,
    );

    return this.transporter.deliverTo(person, {
      title:
        'PESQUISA SOBRE DESAFIOS DO ENSINO REMOTO EMERGENCIAL NA PARAÍBA DURANTE A PANDEMIA', // TODO
      body: personalizedContent,
    });
  }

  async start() {
    //
    // Preparation
    //
    if ('initialize' in this.transporter) {
      await (this.transporter as StatefulDeliveryMechanism<never>).initialize();
    }

    const remainingPeople = await this.getRemainingPeople();

    LOG.info('Succesfully fetched remaining people, starting deliveries', {
      count: remainingPeople.length,
    });

    await promptForContinue();

    //
    // Real work
    //
    const DeliveryAttempts = this.em.getRepository(DeliveryAttempt);

    const getReceiptFor = (
      person: Person,
      wasSuccessful: boolean,
      notes: unknown,
    ) =>
      DeliveryAttempts.create({
        deliveryMechanism: this.deliveryMechanism,
        personIdentifier: person.identifier,
        wasSuccessful,
        notes: JSON.stringify(notes),
        timestamp: new Date(),
      });

    for (const person of remainingPeople) {
      try {
        const res = await this.deliverToSinglePerson(person);
        await DeliveryAttempts.persistAndFlush(
          getReceiptFor(person, true, res),
        );

        LOG.info('Delivery was successful', {
          personIdentifier: person.identifier,
          deliveryMechanism: this.deliveryMechanism,
        });
      } catch (err) {
        LOG.error('Delivery failed:', err);

        // Remember to log failed attempt to database.
        await DeliveryAttempts.persistAndFlush(
          getReceiptFor(person, false, err),
        );
      } finally {
        const calculatedSleepTimeInMs =
          this.throttler.calculateNextThrottleSleepTimeInSeconds() * 1000;

        LOG.debug('Sleeping before next delivery', {
          sleepingForMs: calculatedSleepTimeInMs,
        });
        await new Promise((resolve) => {
          setTimeout(resolve, calculatedSleepTimeInMs);
        });
      }
    }

    //
    // Cleanup
    //
    if ('deinitialize' in this.transporter) {
      await (
        this.transporter as StatefulDeliveryMechanism<never>
      ).deinitialize();
    }
  }
}
