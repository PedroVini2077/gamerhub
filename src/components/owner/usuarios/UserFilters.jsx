import { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

const REFRESH_MIN_MS = 500;

/** Busca, filtro por cargo e botão de atualizar da lista de usuários. */
export default function UserFilters({ search, setSearch, filter, setFilter, total, refetch }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <div className="relative flex-1 min-w-40">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input aria-label="Buscar usuário" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar usuário..."
          className="w-full pl-8 pr-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-300 focus:border-orange-400/50 focus:outline-none" />
      </div>
      <select aria-label="Filtrar por cargo" value={filter} onChange={e => setFilter(e.target.value)}
        className="px-3 py-2 bg-dark-700 border border-dark-400 rounded text-xs font-mono text-gray-400 focus:outline-none">
        <option value="all">Todos ({total})</option>
        <option value="admin">Admins</option>
        <option value="super_admin">Super Admins</option>
        <option value="banned">Banidos</option>
      </select>
      <RefreshButton refetch={refetch} />
    </div>
  );
}

function RefreshButton({ refetch }) {
  const [refreshing, setRefreshing] = useState(false);

  // Mínimo de 500ms para o giro ser visível — sem isso um refetch em cache
  // pisca e parece que o botão não fez nada.
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), new Promise(r => setTimeout(r, REFRESH_MIN_MS))]);
    setRefreshing(false);
  }

  return (
    <button aria-label="Atualizar" onClick={handleRefresh} disabled={refreshing}
      className="p-2 bg-dark-700 border border-dark-400 rounded text-gray-500 hover:text-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
      <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
    </button>
  );
}
