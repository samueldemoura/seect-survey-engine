import config from 'config';

import Person, { PersonKind } from '@src/entities/person';

const PERSON_IDENTIFIER_TOKEN = 'PERSON_IDENTIFIER_TOKEN';

/**
 * Generates the personalized survey link for the given `person.`
 *
 * @param person - Person to generate the link for.
 * @returns Personalized survey link.
 */
const generateLinkFor = (person: Person): string =>
  (config.get('surveyLinks') as Record<PersonKind, string>)[
    person.kind
  ].replace(PERSON_IDENTIFIER_TOKEN, person.identifier);

export default generateLinkFor;
