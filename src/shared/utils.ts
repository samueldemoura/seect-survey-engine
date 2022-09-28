/**
 * Throws `msg` if `condition` is `false`.
 * @param condition - Condition to check.
 * @param msg - Message to throw.
 */
// eslint-disable-next-line import/prefer-default-export
export const assertOrThrow = (condition: boolean, msg: string) => {
  if (!condition) {
    throw new Error(msg);
  }
};
