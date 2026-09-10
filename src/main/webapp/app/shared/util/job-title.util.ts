/** Adds the localized gender suffix without changing the stored job title. */
export function formatJobTitle(title: string, suffix: string): string {
  if (!title) return title;
  const baseTitle = title.replace(/\s*\(m\/[wf]\/d\)\s*$/iu, '');
  return `${baseTitle} ${suffix}`;
}
