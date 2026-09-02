/**
 * As etapas do caso de quem foi banido — a linha do tempo da `BannedScreen`.
 *
 * ── Por que isto existe ─────────────────────────────────────────────────────
 *
 * A tela já dizia o estado ("Em análise", "Negado"), e isso é um retrato: não
 * conta o que já aconteceu nem o que ainda pode acontecer. Do lado de quem
 * levou o ban, a diferença entre "meu recurso sumiu" e "meu recurso está na
 * fila" é a diferença entre achar que o site engoliu o pedido e saber esperar.
 *
 * ── Por que é função pura, e não JSX ────────────────────────────────────────
 *
 * A decisão de QUAIS etapas existem e QUAL é a atual é lógica com quatro
 * combinações — e lógica dentro de JSX não é testável sem montar a árvore
 * inteira. Separada, cada combinação vira um teste de três linhas.
 *
 * ── O mapa é FECHADO de propósito ───────────────────────────────────────────
 *
 * `status` vem do banco (`unban_requests.status`). Um valor novo lá — digamos
 * `expired` — precisa **aparecer**, não cair num `else` que mostraria "Em
 * análise" para sempre. Ver §4: se você escreveu `else` e não sabe dizer quais
 * valores caem ali, é fallback silencioso.
 */

/**
 * Os status que a tabela `unban_requests` aceita, transcritos do CHECK vivo.
 *
 *   select pg_get_constraintdef(oid) from pg_constraint
 *    where conrelid='public.unban_requests'::regclass and contype='c';
 *   -- CHECK (status = ANY (ARRAY['pending','approved','denied']))   [02/09]
 *
 * **O que esta lista pega, e o que não pega.** Ela pega deriva do lado do JS —
 * que foi exatamente o que aconteceu (ver abaixo). Ela **não** pega uma
 * mudança futura no CHECK, porque o teste roda sem banco: o CI não tem
 * credencial de propósito (§0.2). Ao mexer no CHECK, mexer aqui junto.
 */
export const STATUS_DO_BANCO = ['pending', 'approved', 'denied'];

/**
 * `unban_requests.status` -> como a etapa final se chama e se ela é boa.
 *
 * ── O bug que isto conserta, achado em 02/09 ────────────────────────────────
 *
 * A `BannedScreen` tinha esta mesma decisão escrita à mão, e testava
 * `status === 'rejected'`. O banco **nunca grava `rejected`**: a
 * `deny_unban_request` grava `'denied'` — conferido no `prosrc`, não deduzido.
 *
 * Resultado: quem teve o recurso NEGADO via "Em análise", para sempre. A
 * pessoa esperava por uma decisão que já tinha saído, e nada em lugar nenhum
 * indicava erro — nem log, nem teste, nem tela. §1.5 na forma mais pura.
 *
 * O mapa mora aqui, e a tela consome. Duas cópias da mesma decisão foi o que
 * produziu o bug (§4, fonte única).
 */
export const DESFECHOS = {
  approved: { rotulo: 'Recurso aprovado', tom: 'bom' },
  denied:   { rotulo: 'Recurso negado', tom: 'ruim' },
  pending:  { rotulo: 'Em análise pela equipe', tom: 'neutro' },
};

/**
 * @param {object} entrada
 * @param {string|Date|null} [entrada.banidoEm]   `profiles.banned_at`
 * @param {object|null} [entrada.pedido]          o que `meu_pedido_de_revisao` devolveu
 * @returns {Array<{id:string, rotulo:string, quando:Date|null,
 *                  estado:'concluida'|'atual'|'futura', tom:string,
 *                  detalhe?:string}>}
 */
export function etapasDoCaso({ banidoEm, pedido } = {}) {
  const data = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const etapas = [{
    id: 'banido',
    rotulo: 'Conta banida',
    quando: data(banidoEm),
    estado: 'concluida',
    tom: 'ruim',
  }];

  if (!pedido) {
    // Sem pedido a linha do tempo mostra o que FALTA, não um vazio. É a
    // diferença entre "não há nada aqui" e "o próximo passo é seu".
    etapas.push({
      id: 'sem-recurso',
      rotulo: 'Você ainda pode pedir revisão',
      quando: null,
      estado: 'futura',
      tom: 'neutro',
    });
    return etapas;
  }

  etapas.push({
    id: 'recurso-enviado',
    rotulo: 'Recurso enviado',
    quando: data(pedido.enviado_em),
    estado: 'concluida',
    tom: 'neutro',
  });

  const desfecho = DESFECHOS[pedido.status];
  if (!desfecho) {
    // O desconhecido APARECE. Escolher "Em análise" por ele deixaria a pessoa
    // esperando para sempre por uma decisão que já saiu.
    etapas.push({
      id: 'desfecho-desconhecido',
      rotulo: `Estado não reconhecido: ${pedido.status}`,
      quando: data(pedido.respondido_em),
      estado: 'atual',
      tom: 'neutro',
      detalhe: 'Se você está vendo isto, fale com a equipe pelo formulário de contato.',
    });
    return etapas;
  }

  etapas.push({
    id: 'desfecho',
    rotulo: desfecho.rotulo,
    quando: data(pedido.respondido_em),
    estado: 'atual',
    tom: desfecho.tom,
    detalhe: pedido.resposta || undefined,
  });

  return etapas;
}
