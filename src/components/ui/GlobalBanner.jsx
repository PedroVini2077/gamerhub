import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const COLOR_HEX = {
  orange: '#f97316',
  red:    '#ef4444',
  yellow: '#eab308',
  green:  '#39ff14',
  cyan:   '#22d3ee',
  purple: '#a855f7',
};

export default function GlobalBanner() {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('site_config').select('key, value');
      if (data) setCfg(Object.fromEntries(data.map(r => [r.key, r.value])));
    }
    load();

    const ch = supabase.channel('global_banner_cfg')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, load)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  if (!cfg || cfg.banner_enabled !== 'true' || !cfg.banner_text?.trim()) return null;

  const hex = COLOR_HEX[cfg.banner_color] || COLOR_HEX.orange;

  return (
    <div
      className="w-full mb-4 px-4 py-2.5 rounded-lg text-xs font-mono text-center"
      style={{ background: `${hex}18`, border: `1px solid ${hex}35`, color: hex }}
    >
      📢 {cfg.banner_text}
    </div>
  );
}
