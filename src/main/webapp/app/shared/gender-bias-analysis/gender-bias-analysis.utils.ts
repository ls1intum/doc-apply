import { BiasedIssueDTO as BiasedIssue, BiasedIssueDTOTypeEnum as BiasedIssueTypeEnum } from 'app/generated/model/biased-issue-dto';

export function computeCodingStatus(result: BiasedIssue[] | undefined): BiasedIssueTypeEnum | 'NEUTRAL' | undefined {
  if (result === undefined) {
    return undefined;
  }

  if (result.length === 0) return 'NEUTRAL';

  const score = result.reduce(
    (acc, { type }) => acc + (type === 'INCLUSIVE' ? 1 : type === 'NON_INCLUSIVE' ? -1 : 0),
    0,
  );

  return score > 0 ? 'INCLUSIVE' : score < 0 ? 'NON_INCLUSIVE' : 'NEUTRAL';
}
