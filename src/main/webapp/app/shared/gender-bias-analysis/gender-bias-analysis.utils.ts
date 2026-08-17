import { BiasedWordDTO } from 'app/generated/model/biased-word-dto';

export function getUniqueNonInclusiveWords(biasedWords: BiasedWordDTO[] | undefined): string[] {
  const words = biasedWords?.filter(word => word.type === 'non-inclusive').map(word => word.word?.trim()) ?? [];
  return words.filter((word): word is string => Boolean(word)).filter((word, index, values) => values.indexOf(word) === index);
}
