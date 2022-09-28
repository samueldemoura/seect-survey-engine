import { MikroORM, Options } from '@mikro-orm/core';
import { TsMorphMetadataProvider } from '@mikro-orm/reflection';

import { getLoggerFor } from '@src/shared/logging';

const LOG = getLoggerFor({ service: 'mikro-orm' });

const config: Options = {
  metadataProvider: TsMorphMetadataProvider,

  entities: ['./dist/entities/*.js'],
  entitiesTs: ['./src/entities/*.ts'],

  dbName: 'survey-engine.db',
  type: 'sqlite',

  forceUtcTimezone: true,
  strict: true,

  debug: true,
  logger: (msg) => LOG.debug(msg),
};

export const initMikroORM = async () => MikroORM.init(config);

// For the CLI tool.
export default config;
