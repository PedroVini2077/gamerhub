/**
 * O MAPA: cada documento e os caminhos de código que ele descreve.
 *
 * ── Por que virou arquivo próprio em 02/09 ──────────────────────────────────
 *
 * Ele morava dentro de `documentacao-envelhecida.mjs`, que é um **relatório
 * mensal**. Três coisas passaram a precisar dele — o relatório, o portão de
 * cobertura (`territorio-coberto.mjs`) e a lista de leitura por sessão
 * (`documentacao-a-revisar.mjs`) —, e mapa copiado em três lugares diverge:
 * é a regra de fonte única do `CLAUDE.md` §4, que neste projeto já falhou com
 * ícones de log, rótulos de cargo e cores de cargo.
 *
 * ── O que "território" quer dizer ───────────────────────────────────────────
 *
 * Não é "os arquivos que o documento cita". É **o código cuja mudança pode
 * tornar o documento falso**. Mexer ali é motivo para reler aquele documento.
 *
 * Para os arquivos de REGRA (`CLAUDE.md` e `docs/regras/`) a ligação é outra e
 * está explicada onde eles aparecem: o território deles é o **mecanismo que os
 * cumpre**, não o código que descrevem.
 *
 * ── Território vazio é declaração, não esquecimento ─────────────────────────
 *
 * `DECISOES.md` não envelhece por commit — envelhece por reversão, que é coisa
 * que uma pessoa registra e nenhum script detecta. Lista vazia diz "vigiar por
 * commit aqui não faz sentido", e é diferente de estar fora do mapa.
 */
export const TERRITORIO = {
  // ── Documentos de produto e de sistema ────────────────────────────────────

  // Privacidade. O território é onde o dado pessoal ENTRA no sistema e por onde
  // ele sai: o cadastro (que coleta data de nascimento), o perfil (que decide o
  // que é público), o cliente do banco, o monitoramento (o que o Sentry recebe)
  // e o `App.jsx`, onde a analítica é montada.
  //
  // `[02/09]` As três últimas entraram depois de um furo real: o PR #140
  // reescreveu o bloco de retenção da política em
  // `src/components/privacidade/` e **nenhum portão esperava** que
  // `PRIVACIDADE.md` fosse junto, porque a pasta não estava aqui. O documento
  // legal e o aceite versionado são território de privacidade por definição.
  'docs/PRIVACIDADE.md': [
    'src/components/auth/RegisterForm.jsx',
    'src/components/profile',
    'src/components/privacidade',
    'src/components/termos',
    'src/lib/documentosLegais.js',
    'src/hooks/useProfileForm.js',
    'src/hooks/useAceitesPendentes.js',
    'src/lib/monitoring.js',
    'src/lib/supabase.js',
    'src/App.jsx',
  ],
  'docs/MODERACAO.md': [
    'src/services/moderationService.js',
    'src/components/moderation',
    'src/components/regras',
    'src/hooks/useBlockedWords.js',
    'supabase/functions/moderate-links',
  ],
  // A política por categoria e os limiares moram nas Edge Functions de mídia —
  // é lá que um piso muda de valor sem ninguém lembrar do documento.
  'docs/MODERACAO-IA.md': [
    'supabase/functions/moderate-image',
    'supabase/functions/moderate-text',
    'src/lib/framesDeVideo.js',
    'src/services/moderationAiService.js',
  ],
  'docs/BANCO.md': [
    'supabase/migrations',
    'src/services',
    'src/lib/realtimeTables.js',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/SEGURANCA.md': [
    'supabase/functions',
    'src/hooks/useAuth.jsx',
    'src/hooks/useVigiaDeBanimento.js',
    'src/lib/roles.js',
    'src/lib/url.js',
    'e2e/portas-do-banco.mjs',
    'e2e/portas-fechadas.mjs',
  ],
  'docs/ARQUITETURA.md': [
    'src/App.jsx',
    'src/paginasLazy.js',
    'src/services',
    'src/hooks',
    'src/lib',
    'src/components/layout',
    'src/components/ui',
  ],
  'docs/FUNCIONALIDADES.md': [
    'src/pages',
    'src/components/landing',
    'src/components/feed',
    'src/components/community',
    'src/components/lives',
    'src/components/keys',
    'src/components/sobre',
    'src/components/conteudo',
    'src/components/contato',
    'src/components/auth',
  ],
  // O que a equipe opera. O território dele são os painéis e o caminho de ban.
  'docs/PAINEIS.md': [
    'src/pages/Admin.jsx',
    'src/pages/Owner.jsx',
    'src/components/admin',
    'src/components/owner',
  ],
  'docs/OPERACAO.md': ['.github/workflows', 'scripts'],
  // Investigação de desempenho: envelhece quando o que ela mede muda de forma —
  // a cena 3D, o orçamento de bytes e o build.
  'docs/DESEMPENHO.md': [
    'src/components/landing/scene3d',
    // `resolucaoDaCena.js` esteve aqui e foi APAGADO no PR #105 ("desfaz a
    // otimização de resolução"). A entrada sobreviveu ao arquivo, e como o
    // relatório pula caminho inexistente, `DESEMPENHO.md` ficou meio vigiado
    // desde então sem nada acusar. É o apodrecimento que o portão de cobertura
    // passou a pegar.
    'src/lib/cena3D.js',
    'scripts/orcamento-de-bytes.mjs',
    'vite.config.js',
  ],

  // `[02/09]` Os dois READMEs de `supabase/` entraram quando o varredor passou
  // a olhar todo `.md` rastreado, e não só `docs/`. Eles descrevem sistema vivo
  // — como publicar Edge Function, como versionar migration — e apodrecem igual
  // a qualquer outro; só estavam fora do radar por causa da pasta.
  'supabase/functions/README.md': ['supabase/functions'],
  'supabase/migrations/README.md': ['supabase/migrations'],

  // ── Território vazio DE PROPÓSITO (ver o cabeçalho) ───────────────────────
  // Mapa de possibilidades, nao de codigo: nenhuma pasta o torna velho. Ele
  // envelhece por DECISAO (uma ideia sai daqui e vira item), e isso e coisa que
  // uma pessoa registra e nenhum script detecta — mesma razao do DECISOES.md.
  'docs/VISAO-DE-FUTURO.md': [],
  'docs/DECISOES.md': [],
  'docs/DECISOES-FERRAMENTAL.md': [],
  'docs/MANIFESTO.md': [],
  'README.md': [],
  'BACKLOG.md': [],

  // ── As regras, e a ligação delas é outra ──────────────────────────────────
  //
  // Os cinco estavam de fora do portão até 02/09: o `CLAUDE.md` com território
  // VAZIO (na lista só para não ser acusado de não mapeado, mas nunca
  // conferido), e os quatro `docs/regras/` invisíveis porque o varredor não
  // entrava em subpasta. São os arquivos que comandam todo o resto.
  //
  // O território deles não é "o código que descrevem" — é **o mecanismo que os
  // cumpre**. Uma regra sobre banco envelhece quando o portão do banco muda;
  // uma regra sobre documentação envelhece quando os portões de documentação
  // mudam.
  'CLAUDE.md': [
    'scripts/inicio-de-sessao.sh',
    'scripts/fim-de-sessao.mjs',
    '.github/workflows/ci.yml',
  ],
  'docs/regras/POSTURA.md': [
    'e2e/portas-fechadas.mjs',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/regras/BANCO.md': [
    'supabase/migrations',
    'e2e/portas-do-banco.mjs',
    'src/lib/tabelasSemUpdate.js',
  ],
  'docs/regras/AUDITORIA.md': [
    'scripts/mapa-de-arquivos.mjs',
    'scripts/segredos-vazados.mjs',
    'scripts/numeros-do-projeto.mjs',
    'src/lib/__tests__/varrerFontes.js',
  ],
  // `[03/09]` O território dele é o mecanismo que o cumpre: o BACKLOG virou
  // memória operacional, e o mapa de territórios é a ferramenta que o §9.4
  // manda consultar. Mexer nos dois muda o que o arquivo afirma.
  'docs/regras/EXECUCAO.md': [
    'scripts/territorio.mjs',
    'scripts/fim-de-sessao.mjs',
    'scripts/inicio-de-sessao.sh',
  ],
  'docs/regras/DOCUMENTACAO.md': [
    'scripts/documentacao-quebrada.mjs',
    'scripts/documentacao-envelhecida.mjs',
    'scripts/documentacao-a-revisar.mjs',
    'scripts/territorio-coberto.mjs',
    'scripts/numeros-do-projeto.mjs',
    'scripts/mapa-de-arquivos.mjs',
  ],
};

/**
 * As UNIDADES que precisam ter dono — a granularidade do portão de cobertura.
 *
 * Não é "todo arquivo": seria uma lista de 301 entradas que ninguém mantém, e
 * mapa que ninguém mantém é pior do que mapa nenhum. É a pasta de domínio, que
 * é como uma pessoa pensa o sistema — "a moderação", "o painel", "a landing".
 */
export const GRANULARIDADE = [
  { pasta: 'src/components', tipo: 'subpastas' },
  { pasta: 'src/pages', tipo: 'arquivos' },
  { pasta: 'supabase/functions', tipo: 'subpastas' },
  { pasta: 'src/lib', tipo: 'inteira' },
  { pasta: 'src/hooks', tipo: 'inteira' },
  { pasta: 'src/services', tipo: 'inteira' },
  { pasta: 'scripts', tipo: 'inteira' },
  { pasta: 'e2e', tipo: 'inteira' },
  { pasta: '.github/workflows', tipo: 'inteira' },
];

/**
 * Uma unidade está coberta quando ALGUM território a alcança — em qualquer das
 * duas direções.
 *
 * As duas direções importam e a segunda não é óbvia: o território
 * `src/pages/Admin.jsx` é mais específico do que a unidade `src/pages`, e
 * ainda assim cobre parte dela. Exigir só `unidade.startsWith(territorio)`
 * marcaria `src/pages` como órfã tendo dois documentos cuidando dela.
 */
export function coberta(unidade, caminhos) {
  return caminhos.some(t => unidade === t
    || unidade.startsWith(`${t}/`)
    || t.startsWith(`${unidade}/`));
}
