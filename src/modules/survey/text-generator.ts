import fs from 'fs';
import path from 'path';

import { PersonKind } from '@src/entities/person';
import { DeliveryMechanisms } from '@src/modules/delivery-mechanisms';

const PERSONALIZED_SURVEY_LINK_TOKEN = '{{ PERSONALIZED_SURVEY_LINK }}';

const deliveryMechanismToExtensionMap: Record<DeliveryMechanisms, string> = {
  [DeliveryMechanisms.EMAIL]: 'html',
  [DeliveryMechanisms.MOCK]: 'txt',
};

// Cache to avoid hitting the filesystem.
const cachedTemplates: Map<string, string> = new Map();

/**
 * Gets the path to the file containing the data for `templateName`.
 *
 * @param mechanism - Email, WhatsApp, etc.
 * @param templateName - Name of the template to be used (e.g.: `invitation-1`)
 * @returns Fully qualified path to the template's file.
 */
export const getTemplatePathFor = (
  templateName: string,
  personKind: PersonKind,
  mechanism: DeliveryMechanisms,
): string =>
  path.join(
    __dirname,
    '..',
    '..',
    '..',
    'templates',
    `${templateName}-${personKind}-${mechanism}.${deliveryMechanismToExtensionMap[mechanism]}`,
  );

/**
 * Returns the contents of `templatePath` as text. Attempts to return from a
 * cache, reads from disk on cache miss.
 *
 * @param templatePath - Path to the file to read.
 * @returns The contents of `templatePath` as text.
 */
const getTemplateText = async (templatePath: string): Promise<string> => {
  let templateText = cachedTemplates.get(templatePath);
  if (templateText) {
    return templateText;
  }

  templateText = await fs.promises.readFile(templatePath, 'utf-8');
  cachedTemplates.set(templatePath, templateText);

  return templateText;
};

/**
 * Takes the template from `templateName` and personalizes it so it's ready to
 * be sent.
 *
 * @param templateName - Name of the template to use.
 * @param personKind - The type of person who we want to generate for.
 * @param mechanism - How this text will be delivered.
 * @param personalizedSurveyLink - Personalized survey link to inject in the text.
 * @returns Text to send to the person.
 */
export const generateTextFor = async (
  templateName: string,
  personKind: PersonKind,
  mechanism: DeliveryMechanisms,
  personalizedSurveyLink: string,
): Promise<string> => {
  const templatePath = getTemplatePathFor(templateName, personKind, mechanism);
  const templateText = await getTemplateText(templatePath);

  return templateText.replaceAll(
    PERSONALIZED_SURVEY_LINK_TOKEN,
    personalizedSurveyLink,
  );
};
