import { useState } from 'react';
import { Radar, ExternalLink, Plus, AlertTriangle, TrendingUp } from 'lucide-react';
import { buscarPautas } from '../../services/newsRadarService';
import { editoriaValida, rotuloDaEditoria } from '../../lib/news/editorias';
import { CONFIABILIDADE, confiabilidadeValida } from '../../lib/news/confiabilidade';
import { seloDoSinal } from '../../lib/news/aceleracao';
import AvisoDeErro from '../ui/AvisoDeErro';

/**
 * `[26/09]` O RADAR DE PAUTAS — a tela que responde "sobre o que eu escrevo?".
 *
 * ── O problema dele, na frase dele ────────────────────────────────────────
 *
 * *"até eu achar uma notícia, estudar sobre e colocar lá, isso demoraria"*. O
 * gargalo do News nunca foi escrever: era a **página em branco com pergunta
 * embutida** — o que está acontecendo, e o que disso interessa aqui.
 *
 * ── O que cada pauta traz, e por que essas quatro coisas ──────────────────
 *
 *   título sugerido  ele aceita, edita ou ignora — é ponto de partida
 *   ângulo           o recorte do GamerHub, que é o que separa matéria de repost
 *   por que agora    o que torna aquilo assunto HOJE
 *   as fontes        endereços REAIS, de feeds que a equipe cadastrou
 *
 * **As fontes são a parte que exigiu guarda no servidor.** Endereço que o
 * modelo escreveu e que não estava na lista coletada é descartado antes de
 * chegar aqui — senão "fonte confiável" seria promessa do prompt, e bastaria
 * ele escrever uma URL plausível de um site conhecido.
 *
 * ── "Criar rascunho" já leva as NOTAS junto ───────────────────────────────
 *
 * É o elo que fecha o ciclo: o rascunho nasce com título, editoria, fonte **e**
 * as manchetes que sustentam a pauta coladas no campo de notas — que é
 * exatamente o que a `redigir-materia` exige para escrever. Sem isso ele
 * clicaria em "Rascunhar com IA" e leria "escreva as notas primeiro".
 */
export default function RadarDePautas({ onCriar }) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  async function buscar() {
    if (buscando) return;
    setBuscando(true);
    setErro(null);
    // Coletar 12 feeds leva alguns segundos; o piso de 500ms do §4 não se
    // aplica aqui porque a espera é real, não instantânea disfarçada.
    const { data, error } = await buscarPautas();
    setBuscando(false);
    if (error) { setErro({ mensagem: error.message }); return; }
    setResultado(data);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Radar size={15} className="text-neon-cyan shrink-0" />
        <h2 className="font-display text-sm text-white uppercase tracking-wider flex-1">
          Radar de pautas
        </h2>
        <button onClick={buscar} disabled={buscando} className="btn-neon flex items-center gap-2">
          <Radar size={14} className={buscando ? 'animate-spin' : ''} />
          {buscando ? 'Lendo as fontes…' : 'Buscar pautas'}
        </button>
      </div>

      <p className="text-[11px] text-gray-600 leading-relaxed">
        Lê o RSS das fontes cadastradas e pede à IA para ordenar o que vale virar
        matéria. <strong className="text-gray-400">Os fatos vêm dos feeds</strong>,
        não do modelo — ele só lê as manchetes e sugere o recorte.
      </p>

      {erro && <AvisoDeErro mensagem={erro.mensagem} />}

      {resultado && <Resultado dados={resultado} onCriar={onCriar} />}
    </div>
  );
}

function Resultado({ dados, onCriar }) {
  const { pautas, itens, coletados, fontes, comFalha, aviso, descartados } = dados;

  return (
    <div className="space-y-3 border-t border-dark-500 pt-3">
      <p className="text-[11px] font-mono text-gray-600">
        {coletados} manchetes de {fontes} fontes
        {comFalha.length > 0 && ` · ${comFalha.length} fonte(s) não responderam`}
        {descartados > 0 && ` · ${descartados} endereço(s) inventado(s) descartado(s)`}
      </p>

      {/* Aviso, não erro: a coleta deu certo e o que falhou foi a ordenação.
          Pintar isto de vermelho ensinaria a ignorar o vermelho de verdade. */}
      {aviso && (
        <p className="flex items-start gap-2 text-xs text-yellow-400">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" /> <span>{aviso}</span>
        </p>
      )}

      {comFalha.length > 0 && (
        <p className="text-[11px] font-mono text-gray-600">
          Sem resposta: {comFalha.map((f) => `${f.nome} (${f.motivo})`).join(' · ')}
        </p>
      )}

      {pautas.length > 0 && (
        // A ressalva aparece UMA vez, acima da lista. Repetir por pauta viraria
        // ruído; omitir deixaria o editor concluir que o site conferiu o fato —
        // e o modelo só leu a manchete.
        <p className="text-[10px] font-mono text-gray-600">
          Os selos dizem como a MANCHETE se apresenta, não se o fato foi conferido.
        </p>
      )}

      {pautas.map((p, i) => <Pauta key={`${p.titulo}-${i}`} pauta={p} onCriar={onCriar} />)}

      {/* A lista crua só aparece quando NÃO houve pauta — senão seria a mesma
          informação duas vezes. Ela existe para o caso de a IA ter falhado: o
          editor ainda consegue trabalhar lendo as manchetes na mão. */}
      {pautas.length === 0 && itens.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-gray-600">
            As manchetes coletadas
          </p>
          {itens.map((i) => (
            <a key={i.url} href={i.url} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-2 text-xs text-gray-400 hover:text-neon-green py-1">
              <ExternalLink size={11} className="shrink-0 mt-0.5" />
              <span>
                {/* `[01/10]` De ONDE veio. Com duas origens de coleta (os feeds
                    que a equipe escolheu e a busca ampla), "manchete do feed" e
                    "manchete que apareceu fora das nossas fontes" passaram a ser
                    coisas diferentes para quem decide a pauta — e a tela não
                    pode apresentar as duas como se fossem a mesma. */}
                {i.fonte_nome && (
                  <span className="font-mono text-[10px] text-gray-600 mr-1.5">
                    [{i.fonte_nome}]
                  </span>
                )}
                {i.titulo}
              </span>
            </a>
          ))}
        </div>
      )}

      {pautas.length === 0 && itens.length === 0 && (
        <p className="text-sm text-gray-500">Nada veio das fontes agora.</p>
      )}
    </div>
  );
}

function Pauta({ pauta, onCriar }) {
  // A editoria vem do modelo e pode não existir no vocabulário fechado. Em vez
  // de mandar assim para o banco (e colher um erro de CHECK na cara do
  // editor), a tela só a usa quando é conhecida — e o editor escolhe no
  // formulário quando não é.
  const editoria = editoriaValida(pauta.editoria) ? pauta.editoria : null;

  // `[01/10]` Mesma regra da editoria: rótulo que a tela não conhece não vira
  // selo. Melhor sem selo do que com um que ninguém sabe ler.
  const seloDeConfianca = confiabilidadeValida(pauta.confiabilidade)
    ? CONFIABILIDADE[pauta.confiabilidade] : null;

  // `[01/10]` FASE 3: o sinal vem do servidor como texto, e a tela só desenha
  // o que sabe explicar — mesma regra da editoria e da confiabilidade.
  const selo = seloDoSinal(pauta.sinal);

  return (
    <div className="rounded-lg border border-dark-500 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-white font-medium">{pauta.titulo}</p>
        {seloDeConfianca && (
          <span title={seloDeConfianca.dica}
            className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px]
                        uppercase tracking-wider ${seloDeConfianca.classe}`}>
            {seloDeConfianca.rotulo}
          </span>
        )}
      </div>

      {pauta.angulo && <p className="text-xs text-gray-400">{pauta.angulo}</p>}
      {pauta.por_que_agora && (
        <p className="text-[11px] text-neon-cyan">{pauta.por_que_agora}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {editoria && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            {rotuloDaEditoria(editoria)}
          </span>
        )}
        {/* `[01/10]` Quantos VEÍCULOS sustentam o mesmo acontecimento. O
            agrupamento já existia — o modelo junta manchetes do mesmo assunto
            desde o início —, mas ninguém conseguia VER que ele tinha juntado.
            Um evento com quatro veículos é notícia; com um, pode ser nota. */}
        {pauta.urls.length > 1 && (
          <span className="text-[10px] font-mono text-neon-green/70">
            {pauta.urls.length} veículos
          </span>
        )}
        {/* `[01/10]` FASE 3: o sinal de aceleração, medido no NOSSO histórico.
            Ele fica junto da contagem de veículos de propósito — as duas
            respondem "quanto peso isto tem", e separá-las faria o editor
            procurar em dois lugares. `TrendingUp` e não seta tipográfica (§4). */}
        {selo && (
          <span title={selo.dica}
            className={`flex items-center gap-1 text-[10px] font-mono ${selo.classe}`}>
            <TrendingUp size={10} /> {selo.rotulo}
          </span>
        )}
        {pauta.urls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-mono text-gray-500 hover:text-neon-green">
            <ExternalLink size={10} /> {new URL(u).hostname.replace(/^www\./, '')}
          </a>
        ))}
      </div>

      <button
        onClick={() => onCriar({
          titulo: pauta.titulo,
          editoria,
          fonteUrl: pauta.urls[0] ?? null,
          notas: pauta.notas ?? '',
        })}
        className="btn-ghost flex items-center gap-2 text-xs"
      >
        <Plus size={13} /> Criar rascunho com estas notas
      </button>
    </div>
  );
}
