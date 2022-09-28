/* eslint-disable import/first */
// Must come before anything else, because it sets up absolute imports.
import './shared/module-aliases';

// Enables strict mode before parsing any configuration, to avoid possible nasty
// surprises. For more details, see:
// https://github.com/node-config/node-config/wiki/Strict-Mode
process.env.NODE_CONFIG_STRICT_MODE = 'true';

import importPeople, {
  readEmailsFromCsv,
} from '@src/entrypoints/import-people';
import { DeliveryMechanisms } from '@src/modules/delivery-mechanisms';
import DeliveryScheduler from '@src/modules/delivery-scheduler';
import ResponseScraper from '@src/modules/survey/response-scraper';
import { initMikroORM } from '@src/shared/database';
import { getLoggerFor } from '@src/shared/logging';
import { promptForContinue } from '@src/shared/prompt';

const LOG = getLoggerFor({ service: 'survey-engine' });

const SOURCE_PEOPLE_CSVS = [
  './data/professores-query_result_2022-06-21T21_19_55.420699Z.csv',
  './data/familiares-query_result_2022-06-07T14_28_10.714824Z.csv',
  './data/alunos-query_result_2022-06-07T13_11_34.838248Z.csv',
];

const main = async () => {
  LOG.info('Booting up');
  const orm = await initMikroORM();

  LOG.info('Importing people from CSVs');
  const invalidEmailSet = await readEmailsFromCsv('./data/delivery-errors.csv');
  await Promise.all(
    SOURCE_PEOPLE_CSVS.map((csv) => importPeople(orm.em, csv, invalidEmailSet)),
  );

  await promptForContinue();

  LOG.info('Scraping survey responses');
  const scraper = new ResponseScraper(orm.em);
  await scraper.start();

  await promptForContinue();

  LOG.info('Starting delivery scheduler');
  const scheduler = new DeliveryScheduler(
    orm.em,
    DeliveryMechanisms.MOCK, // Swap this out when you want to run for reals.
    'invitation-1',
  );

  await scheduler.start();

  LOG.info('Done!');
  process.exit(0);
};

main().catch((err) => {
  LOG.error(err);
  process.exit(1);
});
