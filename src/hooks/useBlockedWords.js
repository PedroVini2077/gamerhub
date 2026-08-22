import { useQuery } from '@tanstack/react-query';
import { fetchBlockedWords } from '../services/moderationService';
import { checkText } from '../lib/wordlist';

export function useBlockedWords() {
  const { data: words = [] } = useQuery({
    queryKey: ['blocked_words'],
    queryFn: fetchBlockedWords,
    staleTime: 5 * 60 * 1000,
  });

  // `blocked` só é true em severidade `high` — ver o porquê em lib/wordlist.js.
  // `word`/`severity` vêm junto para quem quiser avisar sem barrar.
  function checkContent(text) {
    return checkText(text, words);
  }

  return { words, checkContent };
}
