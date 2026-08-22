import { useEffect, useState } from 'react';
import { fetchProfileStats } from '../services/profileService';

/** Posts, curtidas recebidas e XP do próprio usuário. */
export function useProfileStats(userId) {
  const [stats, setStats] = useState({ posts: 0, likes: 0 });
  const [xpData, setXpData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    // Guarda de cancelamento: `fetchProfileStats` faz várias idas ao banco
    // (posts + XP + likes fatiados). Sem isto, trocar de usuário no meio da
    // busca deixaria a resposta antiga sobrescrever a nova.
    let cancelled = false;
    (async () => {
      const { data: { posts, likes, xp } = {} } = await fetchProfileStats(userId);
      if (cancelled) return;
      setStats({ posts, likes });
      if (xp) setXpData(xp);
    })();
    return () => { cancelled = true; };
    // Depende do ID, não do objeto `user`: o poll de sessão devolve um objeto
    // novo a cada 20s e antes isso refazia a busca inteira à toa.
  }, [userId]);

  return { stats, xpData };
}
