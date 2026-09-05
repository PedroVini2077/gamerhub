import { useEffect } from 'react';
import { RefreshCw, Mail } from 'lucide-react';
import CartaoDeContato from './CartaoDeContato';
import { useMensagensDeContato } from '../../hooks/useMensagensDeContato';

const FILTROS = [
  { id: 'new',      rotulo: 'Novas' },
  { id: 'read',     rotulo: 'Lidas' },
  { id: 'answered', rotulo: 'Respondidas' },
  { id: 'spam',     rotulo: 'Spam' },
  { id: 'todos',    rotulo: 'Todas' },
];

/**
 * As mensagens do formulário público `/contato`.
 *
 * ── Por que esta aba existe, e não é opcional ───────────────────────────────
 *
 * Sem ela o formulário seria uma caixa fechada: a pessoa escreve, a linha cai
 * numa tabela que ninguém tem motivo para abrir, e "mandei e nunca
 * responderam" fica indistinguível de "o formulário está quebrado". É o §1.5
 * na forma mais direta — o canal precisa de alguém do outro lado.
 *
 * Os três canais deste recurso: a notificação em `admin_notifications` avisa,
 * esta aba mostra, e o alarme de enchente grita em `admin_logs`.
 */
export default function ContatoPanel() {
  const { mensagens, carregando, filtro, setFiltro, carregar, marcar, responder } = useMensagensDeContato();

  useEffect(() => { carregar(filtro); }, [carregar, filtro]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-neon-cyan" />
          <span className="font-mono text-xs text-gray-400">
            Mensagens do formulário público
          </span>
        </div>
        <button
          onClick={() => carregar(filtro)}
          disabled={carregando}
          aria-label="Atualizar mensagens"
          className="text-gray-500 hover:text-white transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={`tag cursor-pointer transition-all ${
              filtro === f.id ? 'tag-cyan' : 'opacity-40 hover:opacity-70 tag-cyan'}`}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-dark-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : mensagens.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-mono text-gray-500 text-sm">Nenhuma mensagem aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mensagens.map(m => (
            <CartaoDeContato key={m.id} m={m} marcar={marcar} responder={responder} />
          ))}
        </div>
      )}
    </div>
  );
}
