import { useEffect } from 'react';
import { RefreshCw, Mail, CheckCircle2, Ban, Clock } from 'lucide-react';
import { assuntoDeContato } from '../contato/assuntosDeContato';
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
  const { mensagens, carregando, filtro, setFiltro, carregar, marcar } = useMensagensDeContato();

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
          {mensagens.map(m => <Cartao key={m.id} m={m} marcar={marcar} />)}
        </div>
      )}
    </div>
  );
}

function Cartao({ m, marcar }) {
  const assunto = assuntoDeContato(m.subject);
  // `assuntoDeContato` devolve `undefined` para valor desconhecido, de
  // propósito — e aqui isso APARECE, em vez de virar um rótulo qualquer. Um
  // assunto que o banco produz e o mapa não conhece é deriva, e deriva
  // silenciosa foi o que deixou a fila de moderação girando para sempre (§4).
  const Icone = assunto?.icone;

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {Icone && <Icone size={15} className={assunto.cor} />}
          <span className="font-mono text-xs text-white truncate">
            {assunto?.rotulo ?? `assunto desconhecido: ${m.subject}`}
          </span>
        </div>
        <span className="font-mono text-[11px] text-gray-600 shrink-0">
          {new Date(m.created_at).toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="text-xs font-mono text-gray-500 space-y-0.5">
        <p className="text-gray-300">{m.name}</p>
        {/* `select-all` para a equipe copiar o endereço e responder do próprio
            e-mail. Não vira `mailto:` porque o valor vem de quem preencheu o
            formulário — texto de usuário não entra em `href` sem passar pelo
            `safeExternalUrl`, e `mailto:` não é `http`/`https` (§4). */}
        <p className="select-all break-all">{m.email}</p>
      </div>

      <p className="text-sm font-body text-gray-300 leading-relaxed whitespace-pre-wrap">
        {m.message}
      </p>

      {m.handled_by_username && (
        <p className="text-[11px] font-mono text-gray-600">
          {m.status === 'answered' ? 'Respondida' : m.status === 'spam' ? 'Marcada como spam' : 'Lida'}
          {' por @'}{m.handled_by_username}
          {m.handled_at && ` em ${new Date(m.handled_at).toLocaleString('pt-BR')}`}
        </p>
      )}

      <div className="flex gap-2 flex-wrap pt-1">
        <Acao icone={Clock} rotulo="Lida" cor="text-yellow-400 border-yellow-400/30"
              ativo={m.status !== 'read'} aoClicar={() => marcar(m.id, 'read')} />
        <Acao icone={CheckCircle2} rotulo="Respondida" cor="text-neon-green border-neon-green/30"
              ativo={m.status !== 'answered'} aoClicar={() => marcar(m.id, 'answered')} />
        <Acao icone={Ban} rotulo="Spam" cor="text-red-400 border-red-400/30"
              ativo={m.status !== 'spam'} aoClicar={() => marcar(m.id, 'spam')} />
      </div>
    </div>
  );
}

function Acao({ icone: Icone, rotulo, cor, ativo, aoClicar }) {
  if (!ativo) return null;
  return (
    <button
      onClick={aoClicar}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono
                  border rounded transition-all hover:bg-white/5 ${cor}`}
    >
      <Icone size={12} /> {rotulo}
    </button>
  );
}
