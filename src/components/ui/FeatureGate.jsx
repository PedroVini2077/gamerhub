import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function FeatureGate({ flag, children }) {
  const [on, setOn] = useState(null);

  useEffect(() => {
    supabase.from('site_config').select('value').eq('key', flag).maybeSingle()
      .then(({ data, error }) => setOn(error || !data ? true : data.value !== 'false'));
  }, [flag]);

  if (on === null) return (
    <div className="flex justify-center py-24">
      <div className="w-6 h-6 border-2 border-neon-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!on) return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card p-10 text-center space-y-3">
        <p className="text-3xl">🚫</p>
        <p className="font-display text-gray-200">Seção temporariamente desativada</p>
        <p className="text-xs font-mono text-gray-500">
          Esta área foi pausada pelo fundador. Volte em breve!
        </p>
      </div>
    </div>
  );

  return children;
}
