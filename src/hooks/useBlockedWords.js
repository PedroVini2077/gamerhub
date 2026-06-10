import { useQuery } from '@tanstack/react-query';
import { fetchBlockedWords } from '../services/moderationService';

export function useBlockedWords() {
  const { data: words = [] } = useQuery({
    queryKey: ['blocked_words'],
    queryFn: fetchBlockedWords,
    staleTime: 5 * 60 * 1000,
  });

  function checkContent(text) {
    if (!text) return { blocked: false, word: null };
    const lower = text.toLowerCase();
    const found = words.find(w => lower.includes(w.word.toLowerCase()));
    return { blocked: !!found, word: found?.word || null };
  }

  return { words, checkContent };
}
