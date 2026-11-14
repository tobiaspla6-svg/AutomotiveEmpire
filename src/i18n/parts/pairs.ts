// Screen catalogues are written as [English, Spanish] pairs, so a string cannot exist in one language only.
export type Pairs = Record<string, readonly [string, string]>;
/** One language out of a table of pairs (0 = English, 1 = Spanish), keeping the keys as literal types. */
export const pick = <T extends Pairs>(m: T, i: 0 | 1) => Object.fromEntries(Object.entries(m).map(([key, v]) => [key, v[i]])) as { [K in keyof T]: string };
