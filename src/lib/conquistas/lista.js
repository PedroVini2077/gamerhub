import {
  FileText, Layers, Tv, Heart, Flame, MessageCircle, UserCheck, CalendarClock,
} from 'lucide-react';

import { textoVisivel } from '../textoVisivel';

/**
 * As CONQUISTAS — e por que elas não têm tabela no banco.
 *
 * ── A decisão que define tudo aqui ──────────────────────────────────────────
 *
 * Conquista, normalmente, é uma tabela: `achievements` mais `user_achievements`,
 * com trigger gravando a cada post, curtida e comentário. Aqui não é, e a razão
 * é a mesma que decide quase tudo neste projeto (§0.2): **quantas vezes por dia
 * isso roda?**
 *
 * A resposta seria "uma escrita por interação de todo mundo" — e isso multiplica
 * por usuários × posts × curtidas, que é exatamente a conta que cresce.
 *
 * Estas conquistas são **derivadas**: a `get_user_xp` já devolve posts,
 * curtidas, comentários e lives numa chamada que o perfil **já faz**. Avaliar a
 * lista em cima disso custa **zero** consulta nova, zero escrita, zero tabela e
 * zero trigger.
 *
 * ── O que se perde com isso, dito antes de alguém descobrir ─────────────────
 *
 * | | derivada (é assim) | com tabela |
 * | --- | --- | --- |
 * | custo | zero | uma escrita por interação |
 * | "quando" foi conquistada | **não existe** | data guardada |
 * | notificar na hora | **não dá** | dá |
 * | conquista de evento que não deixa rastro (ex.: "entrou no 1º dia") | **impossível** | possível |
 *
 * O dia em que uma dessas colunas virar necessidade — notificar, ou datar — a
 * tabela passa a valer o preço. Hoje não vale.
 *
 * ── `[10/10]` E ESSE DIA CHEGOU, para a coluna "quando" — sem gatilho ───────
 *
 * O estudo de cosméticos mediu que sem persistência não existe *"desbloqueado
 * para sempre"*, e ele autorizou a tabela. **A recusa acima continua válida
 * para o desenho que ela recusou** — e é por isso que ela não foi apagada:
 *
 *     recusado:  TRIGGER em posts/post_likes/comments
 *                -> 1 escrita por interação de todo mundo
 *     o que há:  `registrar_conquistas()` quando a pessoa abre o PRÓPRIO perfil
 *                -> no máximo 8 escritas por conta, NA VIDA
 *
 * A medição desta lista continua **derivada**: ela é a única fonte do PROGRESSO
 * na tela (a barra, o "7 / 10"). O que a tabela acrescenta é a data **e**, desde
 * a decisão dele de 10/10, o direito de uma conquista de EVENTO continuar
 * concluída depois que a contagem cai — ver `permanente`, na lista abaixo.
 *
 * As duas migrations `conquistas_desbloqueadas_tabela` e
 * `…_funcoes` (10/10) têm o desenho inteiro. A deriva entre a lista daqui e a de lá é travada por
 * `__tests__/conquistaNaoDerivaDoBanco.test.js`.
 *
 * ── Nada aqui inventa valor ─────────────────────────────────────────────────
 *
 * `avaliarConquistas` devolve `null` quando os dados ainda não chegaram, em vez
 * de responder "0 de 10". A diferença importa: "0 de 10" é uma afirmação falsa
 * sobre a pessoa, e a tela mostraria conquista bloqueada para quem já a tem
 * (§4, fallback silencioso).
 */

/** Quantos dias de conta o "Um Mês de Casa" pede. */
const DIAS_DE_CASA = 30;

/**
 * Os seis campos que fazem o perfil estar completo.
 *
 * A mesma lista existe na `get_user_xp`, que paga bônus por cada um. **Não dá
 * para importar dali** — é SQL —, então a duplicação é assumida e está anotada
 * nos dois lados. O que se ganha em troca é não depender do número mágico 140
 * (a soma dos bônus): se um bônus mudar de valor no SQL, esta conquista continua
 * verdadeira, porque ela olha os campos e não o total.
 *
 * **`[10/10]` E o CRITÉRIO deixou de divergir.** Aqui estava `.trim() !== ''`,
 * e o SQL usa `texto_visivel` desde a SEC-046: `trim` só corta branco ASCII,
 * então um perfil preenchido com U+200B contava como completo **na tela** e
 * vazio **no servidor**. Era invisível enquanto nada registrava o desbloqueio;
 * com a tabela, o card passaria a mostrar a conquista concluída e **sem data,
 * para sempre**, sem erro e sem log. Ver `lib/textoVisivel.js`.
 */
const CAMPOS_DO_PERFIL = ['bio', 'avatar_url', 'platform', 'discord', 'twitch', 'youtube'];

/**
 * A lista fechada.
 *
 * `medir` recebe `{ xp, perfil }` e devolve **um número** — quanto a pessoa tem
 * daquilo. A comparação com `meta` é feita num lugar só, o que impede duas
 * conquistas de discordarem sobre o que é "concluída".
 *
 * ── `[10/10]` `permanente` — EVENTO ou ESTADO, e por que não é interruptor ──
 *
 * A pergunta *"desbloqueio permanente ou condicional?"* foi decidida por ele
 * **por conquista**, e não para a lista inteira, porque as oito não são a mesma
 * coisa:
 *
 *     permanente: true   -> EVENTO. "você publicou 10 posts" é um fato que
 *                           aconteceu; apagar os posts depois não o desfaz.
 *     permanente: false  -> ESTADO. "Identidade Completa" afirma que o perfil
 *                           ESTÁ preenchido, agora.
 *
 * **O critério é o mesmo do resto do projeto: a tela não pode afirmar algo
 * falso sobre a pessoa.** Condicional em tudo mostraria "9 de 10" a quem
 * publicou dez; permanente em tudo mostraria "Identidade Completa" num perfil
 * esvaziado. Cada opção mente num lado — declarar campo a campo não mente em
 * nenhum.
 *
 * **Por que medir "de vida inteira" não era alternativa:** seria o jeito
 * natural de medir evento, e essa contagem **não existe**. A view
 * `xp_dos_usuarios` filtra conteúdo fora do ar, e o `ban_user` dá `DELETE` nos
 * posts — o histórico some de verdade. A tabela `conquistas_desbloqueadas` É o
 * livro de eventos, e `permanente: true` é só lê-lo para o que ele serve.
 *
 * **Sem padrão silencioso** (§4): quem acrescentar a 9ª conquista é obrigado a
 * responder "evento ou estado?", porque `conquistaNaoDerivaDoBanco` reprova
 * entrada sem `permanente` declarado. A distinção vive no dado, não na memória
 * de quem leu este comentário.
 *
 * **O que `permanente: true` NÃO cobre, de propósito:** moderação. Se os dez
 * posts forem ocultados por quebrar regra, o XP sai (`INV-XP-001`, com trava) e
 * o selo **fica**. Revogar o registro nesse caso exigiria gatilho em caminho de
 * moderação, e hoje a conquista não dá poder, XP nem destrava nada — é
 * informativa. No dia em que ela liberar moldura ou figurinha, isso vira item
 * de verdade e a decisão muda de peso. Registrado em `docs/DECISOES.md`.
 */
export const CONQUISTAS = [
  {
    id: 'primeiro_post',
    permanente: true,
    nome: 'Primeiro Post',
    descricao: 'Publique seu primeiro post no feed',
    Icon: FileText,
    cor: '#39ff14',
    meta: 1,
    medir: ({ xp }) => xp.posts,
  },
  {
    id: 'dez_posts',
    permanente: true,
    nome: 'Presença Constante',
    descricao: 'Publique 10 posts',
    Icon: Layers,
    cor: '#39ff14',
    meta: 10,
    medir: ({ xp }) => xp.posts,
  },
  {
    id: 'primeira_live',
    permanente: true,
    nome: 'No Ar',
    descricao: 'Transmita sua primeira live',
    Icon: Tv,
    cor: '#00ffff',
    meta: 1,
    medir: ({ xp }) => xp.lives,
  },
  {
    id: 'primeira_curtida',
    permanente: true,
    nome: 'Alguém Curtiu',
    descricao: 'Receba a primeira curtida de outra pessoa',
    Icon: Heart,
    cor: '#bf00ff',
    meta: 1,
    medir: ({ xp }) => xp.likes,
  },
  {
    id: 'vinte_e_cinco_curtidas',
    permanente: true,
    nome: 'Em Alta',
    descricao: 'Receba 25 curtidas nos seus posts',
    Icon: Flame,
    cor: '#bf00ff',
    meta: 25,
    medir: ({ xp }) => xp.likes,
  },
  {
    id: 'dez_comentarios',
    permanente: true,
    nome: 'Conversador',
    descricao: 'Deixe 10 comentários',
    Icon: MessageCircle,
    cor: '#00ffff',
    meta: 10,
    medir: ({ xp }) => xp.comments,
  },
  {
    id: 'perfil_completo',
    // ESTADO, nao evento: ela afirma que o perfil ESTA preenchido, agora.
    permanente: false,
    nome: 'Identidade Completa',
    descricao: 'Preencha bio, avatar, plataforma e as três redes',
    Icon: UserCheck,
    cor: '#f97316',
    meta: CAMPOS_DO_PERFIL.length,
    medir: ({ perfil }) => CAMPOS_DO_PERFIL
      .filter((campo) => textoVisivel(perfil?.[campo])).length,
  },
  {
    id: 'um_mes_de_casa',
    permanente: true,
    nome: 'Um Mês de Casa',
    descricao: 'Complete 30 dias de conta no GamerHub',
    Icon: CalendarClock,
    cor: '#f97316',
    meta: DIAS_DE_CASA,
    medir: ({ perfil }) => diasDesde(perfil?.created_at),
  },
];

/**
 * Dias inteiros desde uma data.
 *
 * Devolve 0 para data ausente ou inválida — e aqui o 0 **é** a resposta certa,
 * não um chute: sem data conhecida, a pessoa não tem tempo de casa comprovado.
 * `Math.floor` porque 29,9 dias não são 30.
 */
function diasDesde(quando) {
  if (!quando) return 0;
  const inicio = new Date(quando).getTime();
  if (Number.isNaN(inicio)) return 0;
  return Math.max(0, Math.floor((Date.now() - inicio) / 86400000));
}

