/* eslint-disable no-await-in-loop */
// ^ again, feel like being lazy here. This is a one-time operation so
// suboptimal impl here doesn't really matter.

import config from 'config';
import {
  GoogleSpreadsheet,
  GoogleSpreadsheetRow,
  ServiceAccountCredentials,
} from 'google-spreadsheet';

import { EntityManager, RequiredEntityData } from '@mikro-orm/core';
import {
  EntityManager as SqliteEntityManager,
  QueryBuilder,
} from '@mikro-orm/sqlite';

import { PersonKind } from '@src/entities/person';
import SurveyResponse from '@src/entities/survey-response';
import { getLoggerFor } from '@src/shared/logging';
import { isIdentifierValid } from '@src/shared/response-identifier-verifier';

const LOG = getLoggerFor({ service: 'response-scraper' });

const googleAccountAuth: ServiceAccountCredentials = config.get('googleAuth');

const responseSheetIds: Record<PersonKind, string> =
  config.get('responseSheetIds');

const POSSIBLE_PERSON_IDENTIFIER_COLUMN_NAMES = [
  'Campo de Controle (não alterar)',
];

export default class ResponseScraper {
  private readonly em: EntityManager;

  private readonly surveyResponseQb: QueryBuilder<SurveyResponse>;

  constructor(em: EntityManager) {
    this.em = em.fork();
    this.surveyResponseQb = (this.em as SqliteEntityManager).createQueryBuilder(
      SurveyResponse,
    );
  }

  static async parseRowIntoResponse(
    row: GoogleSpreadsheetRow,
    sheetId: string,
  ): Promise<RequiredEntityData<SurveyResponse> | undefined> {
    let personIdentifier: string | undefined;

    for (const columnName of POSSIBLE_PERSON_IDENTIFIER_COLUMN_NAMES) {
      if (!row[columnName]) {
        continue;
      }

      personIdentifier = row[columnName];
      break;
    }

    if (personIdentifier === undefined) {
      return undefined;
    }

    const res = new SurveyResponse();

    res.sourceLine = row.rowIndex;
    res.sourceSpreadsheetId = sheetId;
    res.personIdentifier = personIdentifier;
    res.isValid = isIdentifierValid(personIdentifier);

    return res;
  }

  async start() {
    for (const [personKind, sheetId] of Object.entries(responseSheetIds)) {
      LOG.info(
        `Will authenticate and start scraping "${personKind}" responses`,
        {
          personKind,
          sheetId,
        },
      );

      const doc = new GoogleSpreadsheet(sheetId);
      await doc.useServiceAccountAuth(googleAccountAuth);
      await doc.loadInfo();

      const sheet = doc.sheetsByIndex[0];
      const rows = await sheet.getRows();

      for (const row of rows) {
        const response = await ResponseScraper.parseRowIntoResponse(
          row,
          sheetId,
        );
        if (response === undefined) {
          LOG.warn('No identifier found, skipping over response', { row });
          continue;
        }

        LOG.debug('Adding response into database', { response });

        try {
          const insertQuery = this.surveyResponseQb
            .insert(response)
            .onConflict('person_identifier')
            .ignore();
          await insertQuery.execute('get', false);
        } catch (_err: unknown) {
          const errMessage = _err instanceof Error ? _err.message : _err;
          LOG.error(`Failed to persist response: ${errMessage}`, _err);
        }
      }

      LOG.info(`Done scraping "${personKind}" responses`, {
        personKind,
        sheetId,
      });
    }
  }
}
