import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeTab } from '../lib/motion';
import { Gem, Activity, Users, FileText, Settings, Bell, TrendingUp, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth.jsx';
import PainelTab from '../components/owner/PainelTab';
import UsuariosTab from '../components/owner/UsuariosTab';
import LogsTab from '../components/owner/LogsTab';
import SiteTab from '../components/owner/SiteTab';
import NotificacoesTab from '../components/owner/NotificacoesTab';
import MetricasTab from '../components/owner/MetricasTab';
import CofreDoFundador from '../components/owner/CofreDoFundador';
import { cofreAberto, fecharCofre } from '../lib/cofre';

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
  // `[05/09]` O cofre. Estado inicial lido de uma vez — `sessionStorage` não
  // muda sozinho, e reler a cada render seria trabalho por nada.
  const [aberto, setAberto]      = useState(cofreAberto);

  useEffect(() => {
    if (!loading && !isOwner) navigate('/');
  }, [loading, isOwner, navigate]);

  if (loading || !isOwner) return null;

  // O cofre vem DEPOIS da checagem de cargo, nunca antes: quem não é fundador
  // já foi mandado para a home acima, e não tem nem o que destrancar. Ele é uma
  // tranca de tela para o próprio dono — a proteção real está no banco, e não
  // depende dele. Ver `lib/cofre.js`.
  if (!aberto) return <CofreDoFundador aoAbrir={() => setAberto(true)} />;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="card p-5" style={{ borderColor: '#f9731635', boxShadow: `0 0 30px ${OG}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Gem size={15} style={{ color: OC }} />
          <h1 className="font-display text-sm tracking-widest uppercase" style={{ color: OC }}>
            Painel do Fundador
          </h1>

          {/* `[05/09]` TRANCAR AGORA — a inversa que faltava (§5).
              O cofre abre uma vez por aba e não fecha por tempo (tempo fixo
              trancaria no meio de uma moderação). Sem este botão, a única forma
              de trancar de novo era FECHAR A ABA — e quem levanta do computador
              deixa o painel aberto atrás de si, que é exatamente a situação
              para a qual o cofre existe. */}
          <button
            type="button"
            onClick={() => { fecharCofre(); setAberto(false); }}
            aria-label="Trancar o cofre agora"
            title="Trancar o cofre agora"
            className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-gray-500 hover:text-orange-400 transition-colors"
          >
            <Lock size={13} /> Trancar
          </button>
        </div>
        <p className="text-xs font-mono text-gray-500">
          Visão completa · controle total · acesso exclusivo
        </p>
      </div>

      <div className="flex border-b border-dark-500 overflow-x-auto overflow-y-hidden">
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
