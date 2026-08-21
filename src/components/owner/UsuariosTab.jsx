import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../ui/ConfirmModal';
import ReasonModal from '../ui/ReasonModal';
import { useOwnerUserActions } from '../../hooks/useOwnerUserActions';
import UserFilters from './usuarios/UserFilters';
import UserRow from './usuarios/UserRow';

// Cada filtro é um predicado — assim adicionar um novo não mexe na função de
// busca, que antes era uma escada de ifs com `return false`.
const FILTERS = {
  all:         () => true,
  admin:       u => u.role === 'admin',
  super_admin: u => u.role === 'super_admin',
  banned:      u => !!u.banned,
};

export default function UsuariosTab() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  // A lista do fundador carrega inteira; adiar a busca evita travar a digitação
  // enquanto o filtro roda sobre todos os usuários.
  const deferredSearch = useDeferredValue(search);

  const { data: users = [], isPending: loading, refetch } = useQuery({
    queryKey: ['owner_users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_get_users');
      if (error) { toast.error('Erro ao carregar usuários: ' + error.message); return []; }
      return data || [];
    },
  });

  const {
    confirm, closeConfirm, reason, closeReason,
    handleNominate, handleDemote, handleBan, handleOverride,
  } = useOwnerUserActions(refetch);

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const matchesFilter = FILTERS[filter] ?? FILTERS.all;
    return users.filter(u =>
      matchesFilter(u) && (!term || u.username?.toLowerCase().includes(term)),
    );
  }, [users, deferredSearch, filter]);

  return (
    <div className="space-y-4">
      <UserFilters search={search} setSearch={setSearch} filter={filter} setFilter={setFilter}
        total={users.length} refetch={refetch} />

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-dark-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-xs text-gray-500 font-mono">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <UserRow key={u.id} user={u} onNominate={handleNominate} onDemote={handleDemote}
              onBan={handleBan} onOverride={handleOverride} />
          ))}
        </div>
      )}

      {confirm && <ConfirmModal {...confirm} onClose={closeConfirm} />}
      {reason && <ReasonModal {...reason} onClose={closeReason} />}
    </div>
  );
}
