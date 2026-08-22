import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, Clock, ShieldAlert, RefreshCw } from 'lucide-react';
import ReasonModal from '../ui/ReasonModal';
import { fetchRoleNominations, fetchDemotionRequests } from '../../services/roleNominationService';
import { unwrap } from '../../services/result';
import { useCargoDecisions } from '../../hooks/useCargoDecisions';
import CargoSection from './cargos/CargoSection';
import NominationCard from './cargos/NominationCard';
import TrialCard from './cargos/TrialCard';
import DemotionCard from './cargos/DemotionCard';

const REFRESH_MIN_MS = 500;

export default function CargosTab() {
  const [open, setOpen] = useState(null); // id da indicação expandida
  const [refreshing, setRefreshing] = useState(false);

  const { data: nominations = [], isPending: loadingNom, refetch: refetchNom } = useQuery({
    queryKey: ['role_nominations', 'pending_trial'],
    queryFn: () => unwrap(fetchRoleNominations(['pending', 'trial_active'])),
  });

  const { data: demotions = [], isPending: loadingDem, refetch: refetchDem } = useQuery({
    queryKey: ['role_change_requests', 'pending'],
    queryFn: () => unwrap(fetchDemotionRequests(['pending'])),
  });

  function refetchAll() { refetchNom(); refetchDem(); }

  const {
    modal, closeModal,
    openNominationDecision, openTrialDecision, openDemotionDecision,
  } = useCargoDecisions(refetchAll);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchNom(), refetchDem(), new Promise(r => setTimeout(r, REFRESH_MIN_MS))]);
    setRefreshing(false);
  }

  const pending = nominations.filter(n => n.status === 'pending');
  const trials  = nominations.filter(n => n.status === 'trial_active');
  const loading = loadingNom || loadingDem;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          Indicações, avaliações e rebaixamentos de cargo
        </p>
        <button aria-label="Atualizar" onClick={handleRefresh} disabled={refreshing}
          className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-dark-700 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <CargoSection icon={UserPlus} title="Indicações pendentes" count={pending.length}
            emptyText="Nenhuma indicação aguardando análise.">
            {pending.map(nom => (
              <NominationCard key={nom.id} nomination={nom}
                isOpen={open === nom.id}
                onToggle={() => setOpen(open === nom.id ? null : nom.id)}
                onDecide={openNominationDecision} />
            ))}
          </CargoSection>

          <CargoSection icon={Clock} title="Em avaliação" count={trials.length}
            emptyText="Nenhuma avaliação em andamento.">
            {trials.map(nom => (
              <TrialCard key={nom.id} nomination={nom} onDecide={openTrialDecision} />
            ))}
          </CargoSection>

          <CargoSection icon={ShieldAlert} title="Solicitações de rebaixamento" count={demotions.length}
            emptyText="Nenhuma solicitação pendente.">
            {demotions.map(req => (
              <DemotionCard key={req.id} request={req} onDecide={openDemotionDecision} />
            ))}
          </CargoSection>
        </>
      )}

      {modal && <ReasonModal {...modal} onClose={closeModal} />}
    </div>
  );
}
