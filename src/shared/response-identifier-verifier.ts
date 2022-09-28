import { createHash } from 'crypto';
import { adler32 } from 'hash-wasm';

const crockfordMap: Record<string, number> = {
  '0': 0,
  i: 1,
  l: 1,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
  g: 16,
  h: 17,
  j: 18,
  k: 19,
  m: 20,
  n: 21,
  p: 22,
  q: 23,
  r: 24,
  s: 25,
  t: 26,
  v: 27,
  w: 28,
  x: 29,
  y: 30,
  z: 31,
};

const verifierDigitMap: Record<number, string> = {
  0: '0',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'a',
  11: 'b',
  12: 'c',
  13: 'd',
  14: 'e',
  15: 'f',
  16: 'g',
  17: 'h',
  18: 'j',
  19: 'k',
  20: 'm',
  21: 'n',
  22: 'p',
  23: 'q',
  24: 'r',
  25: 's',
  26: 't',
  27: 'v',
  28: 'w',
  29: 'x',
  30: 'y',
  31: 'z',
};

// NOTE(joao): CAFIR code only handles 7 chars but ADLER32 returns 8, so an
// extra factor was added here even though not described in the spec.
const cafirFactors = [4, 3, 9, 5, 7, 1, 8, 0];

/**
 * For a given ADLER32 input, calculate the verifier digit for it.
 *
 * @param adler32FromIdentifier - Original input, hashed with MD5 when converted
 *   using ADLER32.
 * @returns The verifier digit.
 */
export const calculateVerifierDigit = (
  adler32FromIdentifier: string,
): string => {
  const charsFromAdler32 = adler32FromIdentifier.toLowerCase().split('');
  const crockfordEncodedStr = charsFromAdler32.map((chr) => crockfordMap[chr]);
  const products = crockfordEncodedStr.map((x, idx) => x * cafirFactors[idx]);
  const sum = products.reduce((a, b) => a + b, 0);
  const remainder = sum % 31;

  return verifierDigitMap[remainder]?.toUpperCase();
};

/**
 * Calculates an anonymized identifier for a given input, with a verifier
 * character at the end for later out-of-band validation.
 *
 * @param input - Original input.
 * @param isAlreadyMd5 - Whether to skip hashing the input with MD5.
 * @returns The anonymized identifier. Always the same for a given `input`.
 */
export const calculateAnonymizedIdentifier = async (
  input: string,
  isAlreadyMd5 = false,
) => {
  const identifierMd5 = createHash('md5').update(input).digest('hex');
  const identifierAdler32FromMd5 = await adler32(
    isAlreadyMd5 ? input : identifierMd5,
  );
  const verifierDigit = calculateVerifierDigit(identifierAdler32FromMd5);

  return `${identifierAdler32FromMd5}-${verifierDigit}`.toUpperCase();
};

/**
 * Returns whether the given identifier is valid or not, based upon its verifier
 * digit.
 *
 * @param identifier - An anonymized identifier to test.
 * @returns Whether it is valid.
 */
export const isIdentifierValid = (identifier: string): boolean => {
  const parts = identifier.split('-');
  if (parts.length !== 2) {
    return false;
  }

  const [adler32FromIdentifier, verifierDigit] = parts;
  const expectedVerifierDigit = calculateVerifierDigit(adler32FromIdentifier);

  return verifierDigit === expectedVerifierDigit;
};
