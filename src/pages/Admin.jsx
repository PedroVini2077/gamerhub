import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, FileText, Key, Crown, Bell, Activity, ShieldAlert, UserPlus, Siren } from 'lucide-react';
import { fadeTab, gridContainer } from '../lib/motion';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth.jsx';
import { useAdminLogs } from '../hooks/useAdminLogs';
import { useLiveModeration } from '../hooks/useLiveModeration';
import { useAdminNotifications } from '../hooks/useAdminNotifications';
import { useBlockedLogins } from '../hooks/useBlockedLogins';
import { useUnbanRequests } from '../hooks/useUnbanRequests';
import { useAdminData } from '../hooks/useAdminData';
import { useAdminRealtime } from '../hooks/useAdminRealtime';
import { useVisiblePoll } from '../hooks/useVisiblePoll';
import { useAdminContentActions } from '../hooks/useAdminContentActions';
import { useAdminLiveActions } from '../hooks/useAdminLiveActions';
import { useAdminStaffActions } from '../hooks/useAdminStaffActions';
import StatCard from '../components/admin/StatCard';
import AdminTabs from '../components/admin/AdminTabs';
import AdminModals from '../components/admin/AdminModals';
import AdminTabContent from '../components/admin/AdminTabContent';

// Poll da aba de logs, no lugar da assinatura de realtime. 30s é folgado o
// bastante para não pesar e curto o bastante para o admin não sentir atraso.
const LOGS_POLL_MS = 30000;

export default function Admin() {
  const { isAdmin, isSuperAdmin, isOwner, role } = useRole();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('users');
  const [filterRole, setFilterRole] = useState('todos');
  const [userSearch, setUserSearch] = useState('');

  const [banModal, setBanModal] = useState(null);
  const [unbanReqModal, setUnbanReqModal] = useState(null);
  const [unbanDirectModal, setUnbanDirectModal] = useState(null);
  const [denyUnbanModal, setDenyUnbanModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [demoteModal, setDemoteModal] = useState(null);
  const [alertOwnerModal, setAlertOwnerModal] = useState(false);
  const [reactivateModal, setReactivateModal] = useState(null);

  const { logs, logCat, setLogCat, logsLoading, fetchLogs } = useAdminLogs();
  const { liveMod, refreshing, fetchLiveMod } = useLiveModeration();
  const {
    notifications, setNotifications, readIds, setReadIds,
    notifLoading, fetchNotifications, refreshUnread,
  } = useAdminNotifications({ userId: user?.id, isSuperAdmin, isOwner });
  const {
    blockedLogins, blockedLoading, fetchBlockedLogins,
    unlockModal, setUnlockModal, confirmUnlock,
  } = useBlockedLogins({ actorUsername: profile?.username });
  const { unbanRequests, unbanReqLoading, fetchUnbanRequests } =
    useUnbanRequests({ userId: user?.id, isSuperAdmin });

  const adminData = useAdminData({
    userId: user?.id, isSuperAdmin, isOwner, setNotifications, setReadIds,
  });
  const { fetchAll } = adminData;

  // `refresh` recarrega a base E as solicitações de desban — as duas coisas
  // mudam juntas depois de banir/desbanir.
  function refresh() { fetchAll(); fetchUnbanRequests(); }

  const contentActions = useAdminContentActions({
    setConfirmModal, username: profile?.username, posts: adminData.posts, refresh,
  });
  const liveActions = useAdminLiveActions({
    setConfirmModal, setReactivateModal, user, username: profile?.username,
    fetchLiveMod, fetchLogs,
  });
  const staffActions = useAdminStaffActions({
    setConfirmModal, setDemoteModal, setUnbanDirectModal, setDenyUnbanModal,
    setAlertOwnerModal, unbanDirectModal, denyUnbanModal, refresh, fetchUnbanRequests,
  });

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    refresh();
    // Só `isAdmin`: `refresh` é recriada a cada render (não é useCallback), então
    // incluí-la aqui recarregaria o painel inteiro em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (tab === 'lives' || tab === 'super') fetchLiveMod();
    if (tab === 'notifs') fetchNotifications();
    if (tab === 'logs') fetchLogs(logCat);
    if (tab === 'users') fetchUnbanRequests();
    if (tab === 'super' && isSuperAdmin) { fetchBlockedLogins(); fetchUnbanRequests(); }
    // Só `tab`: a intenção é buscar QUANDO A ABA MUDA. As funções de fetch vêm
    // dos hooks de domínio e mudam de identidade a cada render deles; incluí-las
    // faria a aba recarregar sozinha em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs(logCat);
    // Só `logCat`: trocar de categoria refaz a busca. `tab` de propósito fora —
    // a troca de aba já é tratada no efeito acima, e incluir aqui buscaria duas
    // vezes ao entrar na aba de logs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCat]);

  useAdminRealtime({
    tab, logCat, isSuperAdmin,
    handlers: { fetchLiveMod, fetchLogs, fetchUnbanRequests, fetchNotifications, refreshUnread },
  });

  // `admin_logs` saiu do realtime (custava uma mensagem por log do site para
  // todo admin conectado). Só a aba de logs aberta e visível faz poll.
  useVisiblePoll(() => fetchLogs(logCat), LOGS_POLL_MS, tab === 'logs');

  if (!isAdmin) return null;

  const pendingUnbanCount = unbanRequests.length;
  const pendingCount = (liveMod.requests?.length || 0) + pendingUnbanCount;
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const tabs = [
    { id: 'users',      label: 'Usuários',      icon: Users       },
    { id: 'posts',      label: 'Posts',         icon: FileText    },
    { id: 'moderation', label: 'Moderação',     icon: ShieldAlert },
    { id: 'lives',      label: 'Mod de Lives',  icon: Shield      },
    { id: 'keys',       label: 'Keys & Promos', icon: Key         },
    { id: 'notifs',     label: 'Notificações',  icon: Bell, badge: unreadCount },
    { id: 'logs',       label: 'Logs',          icon: Activity    },
    ...(isSuperAdmin ? [{ id: 'cargos', label: 'Cargos',      icon: UserPlus }] : []),
    ...(isSuperAdmin ? [{ id: 'super',  label: 'Super Admin', icon: Crown, badge: pendingCount }] : []),
  ];

  const modals = {
    reactivateModal, banModal, unbanReqModal, unbanDirectModal,
    denyUnbanModal, confirmModal, demoteModal, alertOwnerModal, unlockModal,
    setReactivateModal, setBanModal, setUnbanReqModal, setUnbanDirectModal,
    setDenyUnbanModal, setConfirmModal, setDemoteModal, setAlertOwnerModal, setUnlockModal,
  };

  const actions = { ...contentActions, ...liveActions, ...staffActions };

  return (
    <div className="space-y-5">
      <AdminModals
        modals={modals} isSuperAdmin={isSuperAdmin}
        actions={{ ...modals, ...actions, refresh, confirmUnlock }}
      />

      <div className="card p-5 border-neon-purple/20">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className="text-neon-purple" />
              <h1 className="font-display text-sm text-neon-purple tracking-widest uppercase">
                Painel Admin — {role}
              </h1>
            </div>
            <p className="text-xs text-gray-500 font-mono">Área restrita. Acesso controlado por hierarquia.</p>
          </div>
          <button onClick={() => setAlertOwnerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-red-400/80 hover:text-red-400 border border-red-400/30 hover:border-red-400/60 rounded transition-all shrink-0">
            <Siren size={12} />Alertar o Fundador
          </button>
        </div>
      </div>

      <motion.div className="grid grid-cols-3 gap-3"
        variants={gridContainer} initial="initial" animate="animate">
        <StatCard icon={Users} label="Usuários" value={adminData.stats.users} color="bg-neon-cyan/10 text-neon-cyan" />
        <StatCard icon={FileText} label="Posts" value={adminData.stats.posts} color="bg-neon-green/10 text-neon-green" />
        <StatCard icon={Key} label="Keys" value={adminData.stats.keys} color="bg-neon-purple/10 text-neon-purple" />
      </motion.div>

      <AdminTabs tabs={tabs} tab={tab} setTab={setTab} />

      {adminData.loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-dark-700 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} variants={fadeTab} initial="initial" animate="animate" exit="exit">
            <AdminTabContent
              tab={tab} isSuperAdmin={isSuperAdmin}
              filters={{ userSearch, setUserSearch, filterRole, setFilterRole }}
              actions={actions}
              modals={modals}
              data={{
                ...adminData,
                currentUserId: user?.id,
                pendingUnbanIds: new Set(unbanRequests.map(r => r.target_user_id)),
                liveMod, refreshing, fetchLiveMod,
                notifications, readIds, notifLoading, fetchNotifications,
                logs, logCat, setLogCat, logsLoading, fetchLogs,
                blockedLogins, blockedLoading, fetchBlockedLogins,
                unbanRequests, unbanReqLoading, fetchUnbanRequests, pendingUnbanCount,
              }}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
