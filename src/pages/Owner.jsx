import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeTab } from '../lib/motion';
import { Gem, Activity, Users, FileText, Settings, Bell, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth.jsx';
import PainelTab from '../components/owner/PainelTab';
import UsuariosTab from '../components/owner/UsuariosTab';
import LogsTab from '../components/owner/LogsTab';
import SiteTab from '../components/owner/SiteTab';
import NotificacoesTab from '../components/owner/NotificacoesTab';
import MetricasTab from '../components/owner/MetricasTab';

const OC = '#f97316';
const OG = 'rgba(249,115,22,0.15)';

const TABS = [
  { id: 'painel',       label: 'Painel',       Icon: Activity   },
  { id: 'usuarios',     label: 'Usuários',     Icon: Users      },
  { id: 'logs',         label: 'Audit Logs',   Icon: FileText   },
  { id: 'site',         label: 'Site',         Icon: Settings   },
  { id: 'notificacoes', label: 'Notificações', Icon: Bell       },
  { id: 'metricas',     label: 'Métricas',     Icon: TrendingUp },
];

export default function Owner() {
  const { isOwner }              = useRole();
  const { loading, onlineCount } = useAuth();
  const navigate                 = useNavigate();
  const [tab, setTab]            = useState('painel');

  useEffect(() => {
    if (!loading && !isOwner) navigate('/');
  }, [loading, isOwner, navigate]);

  if (loading || !isOwner) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="card p-5" style={{ borderColor: '#f9731635', boxShadow: `0 0 30px ${OG}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Gem size={15} style={{ color: OC }} />
          <h1 className="font-display text-sm tracking-widest uppercase" style={{ color: OC }}>
            Painel do Fundador
          </h1>
        </div>
        <p className="text-xs font-mono text-gray-500">
          Visão completa · controle total · acesso exclusivo
        </p>
      </div>

      <div className="flex border-b border-dark-500 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === id
                ? 'border-orange-400 text-orange-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} variants={fadeTab} initial="initial" animate="animate" exit="exit">
          {tab === 'painel'       && <PainelTab onlineCount={onlineCount} />}
          {tab === 'usuarios'     && <UsuariosTab />}
          {tab === 'logs'         && <LogsTab />}
          {tab === 'site'         && <SiteTab />}
          {tab === 'notificacoes' && <NotificacoesTab />}
          {tab === 'metricas'     && <MetricasTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
