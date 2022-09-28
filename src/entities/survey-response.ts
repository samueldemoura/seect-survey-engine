import { v4 } from 'uuid';

import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity()
export default class SurveyResponse {
  /** Response identifier */
  @PrimaryKey()
  uuid = v4();

  /** Row number of this response in the original spreadsheet. */
  @Property()
  sourceLine!: number;

  /** The spreadsheet this response came from. */
  @Property()
  @Index()
  sourceSpreadsheetId!: string;

  /** A hash or code of some sort which anonymously identifies the recipient. */
  @Property()
  @Index()
  @Unique()
  personIdentifier!: string;

  /** Whether the personIdentifier is valid. */
  @Property()
  @Index()
  isValid!: boolean;
}
