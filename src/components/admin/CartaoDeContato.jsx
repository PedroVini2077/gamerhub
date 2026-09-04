import { useState } from 'react';
import { Clock, Ban, RotateCcw, Reply, Send, Loader2, X } from 'lucide-react';
import { assuntoDeContato } from '../contato/assuntosDeContato';

/**
 * Uma mensagem do formulário público, na visão da equipe.
 *
 * ── `[03/09]` O que mudou aqui, e por quê ───────────────────────────────────
 *
 * Antes eram três botões — Lida, Respondida, Spam — e cada um sumia quando a
 * mensagem já estava naquele estado. O dono testou e achou duas coisas:
 *
 *   1. depois de "Respondida", o botão "Lida" voltava a aparecer. Não era bug
 *      de estado (os três eram "mover para"), mas oferecer "Lida" DEPOIS de
 *      responder é oferecer um passo para trás;
 *   2. *"como vou clicar no respondido sendo que não tem como responder
 *      nada?"* — e essa é a séria. `answered` afirmava um ato que o sistema
 *      nunca executou (§1.5).
 *
 * O desenho agora segue a regra que o projeto já tinha para ações de estado
 * (`docs/regras/BANCO.md`): **toda ação precisa da inversa**.
 *
 *     nova ......... Lida · Responder · Spam
 *     lida ......... Responder · Spam
 *     respondida ... Reabrir          <- a inversa, antes não existia
 *     spam ......... Não é spam       <- idem: marcar spam era irreversível
 *
 * E "respondida" deixou de ser um botão: é o que acontece quando o e-mail sai.
 */
// Mapa EXPLÍCITO, e não `answered ? ... : spam ? ... : 'Lida'`.
//
// A varredura de classe de 02/09 — feita depois de achar o `rejected`/`denied`
// da tela de banimento — pegou esta linha com a MESMA forma. O `else` engolia
// `new`, e só não mentia por um acaso: `new` nunca tem `handled_by_username`,
// então a linha não renderizava. Proteção por efeito colateral de outra regra é
// sorte esperando expirar (§1.3).
//
// `[03/09]` `answered` saiu daqui: quando há resposta, a tela mostra o TEXTO
// dela logo abaixo, e repetir "Respondida" seria dizer duas vezes a mesma coisa
// — uma delas sem conteúdo.
const COMO_FOI_TRATADA = {
  read: 'Lida',
  spam: 'Marcada como spam',
};

export default function CartaoDeContato({ m, marcar, responder }) {
  const assunto = assuntoDeContato(m.subject);
  // `assuntoDeContato` devolve `undefined` para valor desconhecido, de
  // propósito — e aqui isso APARECE, em vez de virar um rótulo qualquer.
  const Icone = assunto?.icone;

  const [respondendo, setRespondendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    const deuCerto = await responder(m.id, texto.trim());
    setEnviando(false);
    if (deuCerto) { setRespondendo(false); setTexto(''); }
  }

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
        {/* `select-all` para copiar o endereço. Não vira `mailto:` porque o
            valor vem de quem preencheu o formulário — texto de usuário não
            entra em `href` sem passar pelo `safeExternalUrl` (§4). */}
        <p className="select-all break-all">{m.email}</p>
      </div>

      <p className="text-sm font-body text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
        {m.message}
      </p>

      {/* O que foi respondido fica na tela. Sem isto o painel diria
          "respondida" sem dizer o quê — carimbo em vez de histórico. */}
      {m.reply_text && (
        <div className="border-l-2 border-neon-green/30 pl-3 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-neon-green/70">
            Resposta enviada
            {m.handled_by_username && ` por @${m.handled_by_username}`}
            {m.handled_at && ` em ${new Date(m.handled_at).toLocaleString('pt-BR')}`}
          </p>
          <p className="text-sm font-body text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
            {m.reply_text}
          </p>
        </div>
      )}

      {/* Quem tratou, nos estados que não têm texto para mostrar. */}
      {!m.reply_text && m.handled_by_username && COMO_FOI_TRATADA[m.status] && (
        <p className="text-[11px] font-mono text-gray-600">
          {COMO_FOI_TRATADA[m.status]}
          {' por @'}{m.handled_by_username}
          {m.handled_at && ` em ${new Date(m.handled_at).toLocaleString('pt-BR')}`}
        </p>
      )}

      {respondendo ? (
        <div className="space-y-2 pt-1">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={4000}
            autoFocus
            placeholder="A resposta chega no e-mail de quem escreveu, com a identidade do site."
            className="input-gamer w-full text-sm resize-y"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-gray-600">
              {texto.trim().length < 10
                ? `faltam ${10 - texto.trim().length} caracteres`
                : `${texto.length}/4000`}
            </span>
            <div className="flex gap-2">
              <button
                type="button" onClick={() => setRespondendo(false)} disabled={enviando}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono
                           border border-gray-700 text-gray-400 rounded hover:bg-white/5
                           disabled:opacity-40"
              >
                <X size={12} /> Cancelar
              </button>
              <button
                type="button" onClick={enviar}
                disabled={enviando || texto.trim().length < 10}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono
                           border border-neon-green/30 text-neon-green rounded
                           hover:bg-neon-green/10 disabled:opacity-40
                           disabled:cursor-not-allowed"
              >
                {enviando
                  ? <><Loader2 size={12} className="animate-spin" /> Enviando...</>
                  : <><Send size={12} /> Enviar resposta</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap pt-1">
          {m.status === 'new' && (
            <Acao icone={Clock} rotulo="Lida" cor="text-yellow-400 border-yellow-400/30"
                  aoClicar={() => marcar(m.id, 'read')} />
          )}
          {(m.status === 'new' || m.status === 'read') && (
            <>
              <Acao icone={Reply} rotulo="Responder" cor="text-neon-green border-neon-green/30"
                    aoClicar={() => setRespondendo(true)} />
              <Acao icone={Ban} rotulo="Spam" cor="text-red-400 border-red-400/30"
                    aoClicar={() => marcar(m.id, 'spam')} />
            </>
          )}
          {/* As duas inversas. Sem elas, marcar spam por engano era definitivo. */}
          {m.status === 'answered' && (
            <Acao icone={RotateCcw} rotulo="Reabrir" cor="text-gray-400 border-gray-600"
                  aoClicar={() => marcar(m.id, 'read')} />
          )}
          {m.status === 'spam' && (
            <Acao icone={RotateCcw} rotulo="Não é spam" cor="text-gray-400 border-gray-600"
                  aoClicar={() => marcar(m.id, 'read')} />
          )}
        </div>
      )}
    </div>
  );
}

function Acao({ icone: Icone, rotulo, cor, aoClicar }) {
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
