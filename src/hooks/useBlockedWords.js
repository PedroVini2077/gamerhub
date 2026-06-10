import { useQuery } from '@tanstack/react-query';
import { fetchBlockedWords } from '../services/moderationService';
import { findBlockedWord } from '../lib/wordlist';

export function useBlockedWords() {
  const { data: words = [] } = useQuery({
    queryKey: ['blocked_words'],
    queryFn: fetchBlockedWords,
    staleTime: 5 * 60 * 1000,
  });

  function checkContent(text) {
    const found = findBlockedWord(text, words);
    return { blocked: !!found, word: found || null };
  }

  return { words, checkContent };
}
