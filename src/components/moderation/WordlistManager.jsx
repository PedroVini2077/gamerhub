import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchBlockedWords, addBlockedWord, removeBlockedWord } from '../../services/moderationService';

const SEV_COLOR = { low: 'tag-cyan', medium: 'tag-purple', high: 'tag-green' };
const SEV_LABEL = { low: 'Baixo', medium: 'Médio', high: 'Alto' };

export default function WordlistManager() {
  const qc = useQueryClient();
  const { data: words = [], isLoading } = useQuery({
    queryKey: ['blocked_words'],
    queryFn: fetchBlockedWords,
  });

  const [newWord, setNewWord]   = useState('');
  const [severity, setSeverity] = useState('medium');
  const [adding, setAdding]     = useState(false);

  async function handleAdd() {
    if (!newWord.trim()) return;
    if (newWord.trim().length < 2) { toast.error('Palavra muito curta'); return; }
    setAdding(true);
    const { error } = await addBlockedWord(newWord.trim(), severity);
    if (error) {
      if (error.code === '23505') toast.error('Palavra já está na lista');
      else toast.error('Erro ao adicionar palavra');
    } else {
      toast.success('Palavra adicionada');
      setNewWord('');
      qc.invalidateQueries({ queryKey: ['blocked_words'] });
    }
    setAdding(false);
  }

  async function handleRemove(id, word) {
    const { error } = await removeBlockedWord(id);
    if (error) toast.error('Erro ao remover');
    else {
      toast.success(`"${word}" removida`);
      qc.invalidateQueries({ queryKey: ['blocked_words'] });
    }
  }

  return (
    <div className="space-y-4">
      {/* Form de adição */}
      <div className="card p-4 space-y-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">Adicionar palavra</p>
        <div className="flex gap-2">
          <input
            className="input-gamer flex-1 text-sm"
            placeholder="Palavra ou trecho..."
            value={newWord}
            onChange={e => setNewWord(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            maxLength={100}
          />
          <select value={severity} onChange={e => setSeverity(e.target.value)}
            className="bg-dark-700 border border-dark-500 text-xs font-mono text-gray-300 rounded px-2">
            <option value="low">Baixo</option>
            <option value="medium">Médio</option>
            <option value="high">Alto</option>
          </select>
          <button onClick={handleAdd} disabled={adding || !newWord.trim()}
            className="btn-neon py-2 px-4 text-xs flex items-center gap-1.5 shrink-0">
            <Plus size={13} />{adding ? '...' : 'Adicionar'}
          </button>
        </div>
        <div className="flex items-start gap-2 text-xs font-mono text-gray-500">
          <AlertCircle size={12} className="mt-0.5 shrink-0 text-yellow-400" />
          <span>Bloqueia a <b>palavra inteira</b>, ignorando maiúsculas (ex: "idiota" bloqueia "idiota" e "idiota!", mas não "idiotas" nem dentro de outra palavra). Cadastre variações/plurais se precisar.</span>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-dark-700 rounded animate-pulse" />)}
        </div>
      ) : words.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-mono text-gray-500">Nenhuma palavra bloqueada ainda.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-dark-500 text-gray-500 uppercase tracking-wider">
                <th className="text-left p-3">Palavra</th>
                <th className="text-left p-3">Severidade</th>
                <th className="text-left p-3 hidden sm:table-cell">Adicionada</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {words.map(w => (
                <tr key={w.id} className="border-b border-dark-600 hover:bg-dark-700/50 transition-colors">
                  <td className="p-3 text-white font-semibold">{w.word}</td>
                  <td className="p-3">
                    <span className={`tag ${SEV_COLOR[w.severity]}`}>{SEV_LABEL[w.severity]}</span>
                  </td>
                  <td className="p-3 text-gray-500 hidden sm:table-cell">
                    {new Date(w.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleRemove(w.id, w.word)}
                      className="text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
