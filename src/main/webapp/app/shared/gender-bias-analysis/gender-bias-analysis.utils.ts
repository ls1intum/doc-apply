import { BiasedIssue, BiasedIssueTypeEnum } from 'app/generated/model/biased-issue';

export function computeCodingStatus(result: BiasedIssue[] | undefined): BiasedIssueTypeEnum | 'NEUTRAL' | undefined {
  if (result === undefined) {
    return undefined;
  }

  if (result.length === 0) {
    return undefined;
  }

  const inclusiveCount = result.filter(issue => issue.type === 'INCLUSIVE').length;
  const nonInclusiveCount = result.filter(issue => issue.type === 'NON_INCLUSIVE').length;

  if (nonInclusiveCount > inclusiveCount) {
    return 'NON_INCLUSIVE';
  }
  if (inclusiveCount > nonInclusiveCount) {
    return 'INCLUSIVE';
  }
  return 'NEUTRAL';
}
