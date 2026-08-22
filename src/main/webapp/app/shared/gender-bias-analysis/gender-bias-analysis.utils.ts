import { BiasedIssueDTO as BiasedIssue, BiasedIssueDTOTypeEnum as BiasedIssueTypeEnum } from 'app/generated/model/biased-issue-dto';
import { ComplianceIssueCategoryEnum } from 'app/generated/model/compliance-issue';

export const GENDER_BIAS_FILTER_CATEGORY = 'GENDER_BIAS' as const;

export type FilterCategory = ComplianceIssueCategoryEnum | typeof GENDER_BIAS_FILTER_CATEGORY;

export function computeCodingStatus(result: BiasedIssue[] | undefined): BiasedIssueTypeEnum | 'NEUTRAL' | undefined {
  if (result === undefined) {
    return undefined;
  }

  if (result.length === 0) return 'NEUTRAL';

  const score = result.reduce((acc, { type }) => acc + (type === 'INCLUSIVE' ? 1 : type === 'NON_INCLUSIVE' ? -1 : 0), 0);

  return score > 0 ? 'INCLUSIVE' : score < 0 ? 'NON_INCLUSIVE' : 'NEUTRAL';

/**
 * Extracts the unique, non-empty words marked as non-inclusive.
 * @param biasedWords Gender-bias findings returned by the analysis.
 * @returns The unique non-inclusive words in their original order.
 */
export function getUniqueNonInclusiveWords(biasedWords: BiasedWordDTO[] | undefined): string[] {
  const words = biasedWords?.filter(word => word.type === 'non-inclusive').map(word => word.word?.trim()) ?? [];
  return words.filter((word): word is string => Boolean(word)).filter((word, index, values) => values.indexOf(word) === index);
}
}
