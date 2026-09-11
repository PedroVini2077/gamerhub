import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Ban } from 'lucide-react';

export default function FeatureGate({ flag, children }) {
  const [on, setOn] = useState(null);

  useEffect(() => {
    // Guarda contra resposta velha: se a `flag` mudar durante a ida ao
    // servidor, a resposta da flag ANTIGA chegaria depois e decidiria a tela da
    // nova. Aqui a janela é estreita (a flag costuma ser fixa por montagem),
    // mas o custo da guarda é uma linha e o erro seria mudo (§1.5).
    let valendo = true;
    supabase.from('site_config').select('value').eq('key', flag).maybeSingle()
      .then(({ data, error }) => {
        if (valendo) setOn(error || !data ? true : data.value !== 'false');
      });
    return () => { valendo = false; };
  }, [flag]);

  if (on === null) return (
    <div className="flex justify-center py-24">
      <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!on) return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card p-10 text-center space-y-3">
        <Ban size={34} className="text-gray-500 mx-auto" />
        <p className="font-display text-gray-200">Seção temporariamente desativada</p>
        <p className="text-xs font-mono text-gray-500">
          Esta área foi pausada pelo fundador. Volte em breve!
        </p>
      </div>
    </div>
  );

  return children;
}
