/**
 * Function checks for deep equality
 *
 * @param obj1 Object 1
 * @param obj2 Object 2 which will be compared to Object 1
 * @returns whether both Object are deeply equal
 */

export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
    return false;
  }

  // Use type assertion to tell TypeScript we're working with records (i.e., objects with string keys)
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    const val1 = (obj1 as Record<string, unknown>)[key];
    const val2 = (obj2 as Record<string, unknown>)[key];
    if (!keys2.includes(key) || !deepEqual(val1, val2)) return false;
  }

  return true;
}
