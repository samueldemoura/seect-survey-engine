import { Entity, Enum, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * The type of the person in question. Important because every one will respond
 * different surveys.
 */
// ESLint rule is buggy when exporting TypeScript enums, so disable here.
// See: https://github.com/typescript-eslint/typescript-eslint/issues/325
// eslint-disable-next-line no-shadow
export enum PersonKind {
  Student = 'student',
  Teacher = 'teacher',
  FamilyMember = 'familyMember',
}

/** Data about a person who should participate in the survey(s). */
@Entity()
export default class Person {
  /** A hash or code of some sort which anonymously identifies this person. */
  @PrimaryKey()
  @Unique()
  identifier!: string;

  /** The person's type/kind. */
  @Property()
  @Enum(() => PersonKind)
  kind!: PersonKind;

  /** The person's email, might not exist in the databases. */
  @Property()
  @PrimaryKey()
  @Unique()
  email?: string;

  /**
   * The person's phone number, might not exist in the databases or might not be
   * a WhatsApp phone number.
   */
  @Property()
  phone?: string;
}
