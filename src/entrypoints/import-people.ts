import { parse } from 'csv-parse';
import { createReadStream } from 'fs';

import { EntityManager } from '@mikro-orm/core';
import { EntityManager as SqliteEntityManager } from '@mikro-orm/sqlite';

import Person, { PersonKind } from '@src/entities/person';
import {
  calculateAnonymizedIdentifier,
  isIdentifierValid,
} from '@src/shared/response-identifier-verifier';
import { getLoggerFor } from '@src/shared/logging';

const strToPersonKindMap: Record<string, PersonKind> = {
  A: PersonKind.Student,
  P: PersonKind.Teacher,
  F: PersonKind.FamilyMember,
};

// https://github.com/mikro-orm/mikro-orm/discussions/3229
const FLUSH_EVERY_X_RECORDS = 300;

const LOG = getLoggerFor({ service: 'person-importer' });

const seenIdentifiersToEmailMap: Map<string, string> = new Map();
const seenEmails: Set<string> = new Set();

const WHITELISTED_EMAIL_DOMAINS = new Set([
  // Curated by Denio from our database.
  'gmail.com',
  // 'aluno.pb.gov.br', - Rostand asked to take these out for now.
  'hotmail.com',
  'outlook.com',
  // 'professor.pb.gov.br', - Rostand asked to take these out for now.
  'yahoo.com.br',
  'icloud.com',
  'yahoo.com',
  'bol.com.br',
  'live.com',
  'academico.ifpb.edu.br',

  // Manually inserted for testing.
  'lavid.ufpb.br',
  'ifpb.edu.br',
]);

/**
 * Returns whether the given email is valid. More specifically, whether
 * its domain is a part of the whitelist.
 *
 * @param email - The email to check.
 * @returns Whether the email is valid.
 */
const isValidEmail = (email: string): boolean => {
  const emailParts = email.split('@');
  if (emailParts.length !== 2) {
    return false;
  }

  const [_, domain] = emailParts;
  return WHITELISTED_EMAIL_DOMAINS.has(domain);
};

/**
 * Reads a list of emails from a CSV file.
 *
 * @param path - Path to a CSV where the first column is an email.
 * @returns Set of emails read from the given CSV.
 */
export const readEmailsFromCsv = async (path: string): Promise<Set<string>> => {
  const parser = createReadStream(path, { flags: 'r' }).pipe(parse());
  const set = new Set<string>();

  let headerAlreadySkipped = false;
  for await (const row of parser) {
    if (headerAlreadySkipped === false) {
      headerAlreadySkipped = true;
      continue;
    }

    const [invalidEmail] = row;
    set.add(invalidEmail);
  }

  LOG.debug('Finished reading CSV', { path, count: set.size });
  return set;
};

/**
 * Imports people into the database.
 *
 * @param em - ORM entity manager.
 * @param path - Path to a `.csv` file containing everyone to import.
 */
const importPeople = async (
  em: EntityManager,
  path: string,
  setOfEmailsToSkip?: Set<string>,
) => {
  LOG.info('Starting CSV import', { path });

  const forkedEm: SqliteEntityManager = em.fork() as SqliteEntityManager;
  const peopleQb = forkedEm.createQueryBuilder(Person);

  const parser = createReadStream(path, { flags: 'r' }).pipe(parse());

  let headerAlreadySkipped = false;
  let unflushedRecords: Person[] = [];

  for await (const row of parser) {
    if (headerAlreadySkipped === false) {
      headerAlreadySkipped = true;
      continue;
    }

    const [md5, rawPersonKind, email, phone] = row;
    const kind = strToPersonKindMap[rawPersonKind];
    const identifier = await calculateAnonymizedIdentifier(md5, true);

    const personData: Person = { identifier, kind, email, phone };

    // Sanity check.
    if (!isIdentifierValid(identifier)) {
      LOG.warn(
        'Generated an invalid identifier, something in the' +
          ' implementation is messed up.',
        { personData, identifier },
      );
    }

    // Email validation.
    if (!isValidEmail(email)) {
      LOG.debug('Dropping email from non-whitelisted domain', { email });
      continue;
    }
    if (setOfEmailsToSkip && setOfEmailsToSkip.has(email)) {
      LOG.debug('Dropping email from list of invalid emails', { email });
      continue;
    }

    const duplicateEmail = seenIdentifiersToEmailMap.get(identifier);
    if (duplicateEmail !== undefined) {
      LOG.warn('Collision found', { email, duplicateEmail, identifier });
      continue;
    } else {
      seenIdentifiersToEmailMap.set(identifier, email);
    }

    if (seenEmails.has(email)) {
      LOG.warn('Collision found', { email, identifier });
      continue;
    } else {
      seenEmails.add(email);
    }

    unflushedRecords.push(personData);
    if (unflushedRecords.length >= FLUSH_EVERY_X_RECORDS) {
      const insertQuery = peopleQb
        .insert(unflushedRecords)
        .onConflict(['identifier'])
        .ignore();
      await insertQuery.execute('get', false);
      unflushedRecords = [];
    }
  }

  if (unflushedRecords.length > 0) {
    const insertQuery = peopleQb
      .insert(unflushedRecords)
      .onConflict(['identifier'])
      .ignore();
    await insertQuery.execute('get', false);
  }

  LOG.info('Finished CSV import, flushing...', { path });
  await forkedEm.flush();
};

export default importPeople;
