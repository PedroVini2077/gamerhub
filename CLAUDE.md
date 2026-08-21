# GamerHub — Instruções de trabalho

> Este arquivo descreve **como o dono quer que eu (Claude) trabalhe** neste
> projeto. Não é documentação de features — para isso, ver o `README.md`.

## Regras de trabalho (preferências do dono)

- **Sem emojis na UI — somente ícones Lucide (ou react-icons/fa6 para marcas).**
  O site usa design com ícones reais. Nunca usar emojis como elementos visuais
  em componentes, labels, badges, listas ou qualquer parte da interface. Emojis
  deixam o site com cara de IA/chatbot. Usar sempre `lucide-react` (ex: `<Trash2>`,
  `<Bell>`, `<Shield>`) ou `react-icons/fa6` para logos de plataformas (Discord,
  Twitch, YouTube).
- **Botões de "Atualizar" / refresh devem ter loading mínimo de 500ms.**
  Usar `Promise.all([fetch(), new Promise(r => setTimeout(r, 500))])` para que
  o spinner seja sempre visível mesmo quando o dado vem do cache. Padrão:
  estado local `refreshing`, botão `disabled={refreshing}`, ícone com
  `className={refreshing ? 'animate-spin' : ''}`.

- **Trabalhar sempre na branch `main`.** Não criar/usar outras branches sem
  permissão explícita.
- **SEMPRE testar antes de entregar.** Rodar `npm run build`; quando houver
  lógica de banco/RPC, testar no Supabase — de preferência em **transação com
  ROLLBACK** para não sujar produção. Caçar edge cases e brechas *antes* de
  entregar, não depois.
- **Não entregar sem ter certeza.** O dono cansou de gastar tempo resolvendo
  erros que deveriam ter sido pegos antes. Na dúvida, validar.
- **Base sólida acima de tudo — não basta "bonito e funciona".** O objetivo é um
  site concreto e real, com o mínimo de falhas, que não vire ruínas no futuro.
  Priorizar robustez, resiliência a erros e solidez sobre aparência ou features.
  Ao consolidar, preferir mudanças **aditivas e seguras** (que não alteram o
  caminho feliz) e ir **gradualmente**, validando cada passo — nada pode quebrar.
- **Scripts de teste avulsos:** rodar e, se passar, **apagar** — nunca commitar
  script de teste.
- **Foco atual do projeto:** parar de adicionar features novas e **melhorar a
  base existente** — organização, manutenção, escalabilidade, segurança,
  performance e documentação. Evoluir sem quebrar o que já funciona.
- **Cortar código sempre que possível — nunca criar arquivos enormes.** Ao
  escrever ou mexer em qualquer arquivo, pensar antes: dá pra quebrar em
  componentes/hooks/services menores? Se um arquivo está crescendo demais
  (regra de bolso: ~300+ linhas ou misturando responsabilidades), dividir.
  Preferir muitos arquivos pequenos e focados a poucos arquivos gigantes.
  Extrair UI repetida em componentes, lógica repetida em hooks/utils, acesso a
  dados em services. **Pensar SEMPRE em otimização e escalabilidade** — não só
  "funciona", mas "aguenta crescer e é fácil de manter".
- **Sempre atualizar o `README.md` quando novas features forem adicionadas.**
  Não deixar para depois — ao entregar qualquer feature nova, verificar se o
  README reflete o estado atual (estrutura de pastas, tabela de funcionalidades,
  banco de dados, convenções). O README é a documentação viva do projeto.

## Segurança proativa (regra permanente)

> IA que desenvolve sozinha tem fama de deixar brecha — o dono não quer que o
> GamerHub seja mais um caso desses. Esta regra vale pra **todo** trabalho
> daqui pra frente, não só quando for pedida auditoria.

- **Nunca entregar só "funciona".** Antes de considerar qualquer código pronto
  — feature nova, fix, refactor, mudança de banco — pensar ativamente em como
  isso poderia ser abusado: dado forjado, RLS que não cobre um caminho, RPC
  chamável por quem não devia, input sem validação, condição de corrida, race
  entre client e trigger, edge case de permissão (owner vs admin vs dono da
  própria conta), enumeração de dados sensíveis. Se existe um jeito de abusar,
  **fechar antes de entregar** — não documentar como "risco conhecido" e
  seguir em frente.
- **Vale para brecha que ainda não é problema hoje, mas vira amanhã.** Base de
  usuário pequena hoje não é desculpa pra deixar uma falha passar — se o
  código vai continuar em produção, o buraco também vai. Achou algo que só
  "não quebrou ainda" por sorte ou por baixo volume? Corrigir do mesmo jeito.
- **Isso não substitui a auditoria em 3 fases** (abaixo) — é o padrão mínimo
  pra qualquer entrega, mesmo fora de uma auditoria formal. A auditoria em 3
  fases é o modo de varrer o projeto inteiro deliberadamente; esta regra é o
  reflexo de desconfiar do próprio código o tempo todo.
- Na dúvida se algo é uma brecha real ou paranoia, **tratar como brecha** e
  registrar a decisão (corrigida, ou por que foi considerada segura) — nunca
  deixar em silêncio.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS + Framer Motion.
- **Backend/DB:** Supabase (Postgres), project_id `yuqbdcoljlvncxdnesxk`.
- **Deploy:** Vercel (SPA com rewrite para `/`).
- Acesso a tabelas/ações sensíveis via funções `SECURITY DEFINER` com RLS
  restritiva. Cliente usa apenas a `anon key` — **a segurança depende do RLS
  estar correto**.

## Convenções de UI

- Modais via `createPortal`, fundo `rgba(0,0,0,0.92)`, card `bg-dark-800
  rounded-2xl`, animação `animate-fade-up`. **Evitar `window.prompt` /
  `window.confirm`** para ações do usuário — usar modais no estilo do site.
- Tipografia mono para dados técnicos, `font-display` para títulos.
- **Animações:** usar Framer Motion com as variantes compartilhadas em
  `src/lib/motion.js` (`fadeTab`, `gridContainer`/`gridCard`,
  `listContainer`/`listItem`). Não duplicar variantes — importar de lá.
  Transição de página global via `PageTransition` + `AnimatePresence` no
  `App.jsx`.
- **Ícones:** Lucide para UI geral; `react-icons/fa6` para marcas (Discord,
  Twitch, YouTube) com as cores oficiais. Evitar emojis como ícones de UI.

## Auditoria periódica do projeto (plano em 3 fases)

Quando o dono pedir "auditoria", "testes do site", "caçar bugs/brechas" ou
similar, seguir este plano em ordem (frontend → backend → banco), **uma fase
por vez**, e ao fim de **cada** fase entregar um relatório do que foi
encontrado e só aplicar correções **após aprovação do dono**.

- **FASE 1 — Frontend:** build limpo; lint (`rules-of-hooks`, dead code);
  Rules of Hooks (nenhum hook após early return / condicional); memory leaks
  (subscriptions/timers/realtime sem cleanup); race conditions; validação de
  inputs; estados de loading/erro cobertos; acessibilidade básica.
- **FASE 2 — Backend:** revisar todas as funções `SECURITY DEFINER` (checagem
  de role correta e explícita via `auth.uid()`); validação de parâmetros;
  tratamento de erro; risco de SQL injection; lógica de negócio (ban, bloqueio
  de login, XP).
- **FASE 3 — Banco:** políticas RLS por tabela; publicação realtime correta
  (`supabase_realtime`); índices em colunas filtradas/ordenadas; integridade
  (FKs, cascades); rodar os advisors de segurança e performance do Supabase.

## Processo para mudanças estruturais (refactor / melhorias)

- **Antes de alterar qualquer coisa**, apresentar análise/plano e **aguardar
  aprovação**.
- Mudanças graduais e justificadas. Não reescrever do zero, não reorganizar
  sem necessidade, não mudar comportamento/visual/rotas/auth/integrações.
- Após cada alteração relevante, informar: arquivos modificados, o que mudou,
  motivo, benefícios e possíveis riscos.
