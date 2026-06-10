import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, AlertTriangle, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const OC = '#f97316';
const BANNER_COLORS = [
  { label: 'Laranja', value: 'orange', hex: '#f97316' },
  { label: 'Vermelho', value: 'red',   hex: '#ef4444' },
  { label: 'Amarelo',  value: 'yellow', hex: '#eab308' },
  { label: 'Verde',    value: 'green',  hex: '#39ff14' },
  { label: 'Ciano',    value: 'cyan',   hex: '#22d3ee' },
  { label: 'Roxo',     value: 'purple', hex: '#a855f7' },
];

export default function SiteTab() {
  const [config, setConfig] = useState({
    banner_enabled: 'false', banner_text: '', banner_color: 'orange',
    maintenance_mode: 'false',
    feature_keys: 'true', feature_lives: 'true', feature_community: 'true',
    mod_report_threshold: '3', mod_suspend_threshold: '8', mod_ban_threshold: '15',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('site_config').select('key, value').then(({ data }) => {
      if (data) setConfig(prev => ({ ...prev, ...Object.fromEntries(data.map(r => [r.key, r.value])) }));
      setLoaded(true);
    });
  }, []);

  async function saveKey(key, value) {
    setSaving(true);
    const { error } = await supabase.rpc('owner_set_site_config', { p_key: key, p_value: String(value) });
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
  }

  function toggle(key) {
    const next = config[key] !== 'true' ? 'true' : 'false';
    setConfig(c => ({ ...c, [key]: next }));
    saveKey(key, next);
  }

  const bannerEnabled      = config.banner_enabled   === 'true';
  const maintenanceEnabled = config.maintenance_mode === 'true';
  const currentColor       = BANNER_COLORS.find(c => c.value === config.banner_color) || BANNER_COLORS[0];

  if (!loaded) return (
    <div className="space-y-3">
      <div className="h-52 bg-dark-700 rounded-xl animate-pulse" />
      <div className="h-24 bg-dark-700 rounded-xl animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Banner Global</p>
          <button onClick={() => toggle('banner_enabled')}
            className="flex items-center gap-1.5 text-xs font-mono transition-colors"
            style={{ color: bannerEnabled ? '#39ff14' : '#6b7280' }}>
            {bannerEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {bannerEnabled ? 'Ativo' : 'Inativo'}
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-gray-500">Texto do aviso</label>
          <input
            value={config.banner_text}
            onChange={e => setConfig(c => ({ ...c, banner_text: e.target.value }))}
            onBlur={e  => saveKey('banner_text', e.target.value)}
            placeholder="ex: Manutenção programada às 22h"
            className="w-full px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-300 focus:border-orange-400/50 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-mono text-gray-500">Cor</label>
          <div className="flex gap-2 flex-wrap">
            {BANNER_COLORS.map(c => (
              <button key={c.value}
                onClick={() => { setConfig(prev => ({ ...prev, banner_color: c.value })); saveKey('banner_color', c.value); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-mono transition-all"
                style={{
                  borderColor: config.banner_color === c.value ? c.hex : '#2e2e3e',
                  color:       config.banner_color === c.value ? c.hex : '#6b7280',
                  background:  config.banner_color === c.value ? `${c.hex}15` : 'transparent',
                }}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.hex }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {config.banner_text?.trim() && (
          <div className="rounded-lg px-4 py-2.5 text-xs font-mono text-center"
            style={{
              background: `${currentColor.hex}18`,
              border:     `1px solid ${currentColor.hex}35`,
              color:      currentColor.hex,
            }}>
            📢 {config.banner_text}
          </div>
        )}
      </div>

      {/* Manutenção */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-mono text-gray-200">Modo Manutenção</p>
            <p className="text-xs font-mono text-gray-600 mt-0.5">Bloqueia o site para todos — exceto o fundador</p>
          </div>
          <button onClick={() => toggle('maintenance_mode')}
            className="flex items-center gap-1.5 text-xs font-mono transition-colors"
            style={{ color: maintenanceEnabled ? '#ef4444' : '#6b7280' }}>
            {maintenanceEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {maintenanceEnabled ? 'ATIVO' : 'Desligado'}
          </button>
        </div>
        {maintenanceEnabled && (
          <div className="flex items-center gap-2 mt-2 text-xs font-mono text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            Modo manutenção ativo — apenas o fundador tem acesso.
          </div>
        )}
      </div>

      {/* Feature Flags */}
      <div className="card p-5">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Feature Flags</p>
        <div>
          {[
            { key: 'feature_keys',      label: 'Keys & Promos',      desc: 'Sistema de game keys e promoções' },
            { key: 'feature_lives',     label: 'Lives',              desc: 'Sistema de lives ao vivo' },
            { key: 'feature_community', label: 'Comunidade (Mural)', desc: 'Mural de postagens da comunidade' },
          ].map(f => {
            const enabled = config[f.key] !== 'false';
            return (
              <div key={f.key}
                className="flex items-center justify-between py-2.5 border-b border-dark-600 last:border-0">
                <div>
                  <p className="text-xs font-mono text-gray-300">{f.label}</p>
                  <p className="text-xs font-mono text-gray-600">{f.desc}</p>
                </div>
                <button
                  onClick={() => {
                    const next = enabled ? 'false' : 'true';
                    setConfig(c => ({ ...c, [f.key]: next }));
                    saveKey(f.key, next);
                  }}
                  className="flex items-center gap-1.5 text-xs font-mono transition-colors shrink-0 ml-4"
                  style={{ color: enabled ? '#39ff14' : '#6b7280' }}>
                  {enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  {enabled ? 'Ativo' : 'Desligado'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Moderação */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-orange-400" />
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Limites de Moderação</p>
        </div>
        <p className="text-xs font-mono text-gray-600 -mt-2">
          Ajuste os gatilhos automáticos do sistema de moderação.
        </p>
        {[
          { key: 'mod_report_threshold',  label: 'Denúncias para ocultar',  desc: 'Quantas denúncias ocultam um conteúdo automaticamente' },
          { key: 'mod_suspend_threshold', label: 'Pontos para suspensão',   desc: 'Pontos de infração que sinalizam suspensão' },
          { key: 'mod_ban_threshold',     label: 'Pontos para ban',         desc: 'Pontos de infração que banem o usuário automaticamente' },
        ].map(f => (
          <div key={f.key} className="flex items-center justify-between gap-4 py-2 border-b border-dark-600 last:border-0">
            <div className="min-w-0">
              <p className="text-xs font-mono text-gray-300">{f.label}</p>
              <p className="text-xs font-mono text-gray-600">{f.desc}</p>
            </div>
            <input
              type="number" min="1" max="999"
              value={config[f.key]}
              onChange={e => setConfig(c => ({ ...c, [f.key]: e.target.value }))}
              onBlur={e => {
                const v = Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1));
                setConfig(c => ({ ...c, [f.key]: String(v) }));
                saveKey(f.key, v);
              }}
              className="w-16 px-2 py-1.5 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-center text-gray-200 focus:border-orange-400/50 focus:outline-none shrink-0"
            />
          </div>
        ))}
      </div>

      {saving && (
        <p className="text-xs font-mono text-center animate-pulse" style={{ color: OC }}>Salvando...</p>
      )}
    </div>
  );
}
