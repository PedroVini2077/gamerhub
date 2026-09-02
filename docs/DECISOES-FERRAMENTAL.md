# Decisões — ferramental e infraestrutura

> **Por que existe:** guardar o que foi decidido sobre as FERRAMENTAS — CI,
> Vercel, Sentry, Dependabot, Edge Functions, contas de teste — e,
> principalmente, o que foi **descartado e por quê**.
>
> Saiu de [DECISOES.md](DECISOES.md) em 28/08/2026, quando esta seção sozinha
> chegou a 302 linhas. O corte é por **tipo de pergunta**: aqui está "por que a
> nossa esteira é assim"; lá continua "por que o site se comporta assim".
>
> Toda entrada leva data. Decisão sem data não dá para saber se ainda vale.

[← voltar para o README](../README.md) · [decisões de produto](DECISOES.md)

---

## Ferramental

### `[02/09]` Teste de mutação (Stryker) — ADOTADO, sob demanda e com escopo pequeno

**Decisão do dono:** *"pode fazer esse teste de mutações"*. Era o último item
aberto da auditoria de mim mesmo.

**O problema que ele resolve.** Dos 9 padrões de falha meus catalogados, o nº 3
— *"escrevo teste que não consegue falhar"* — era o único sem mecanismo, e eu o
repeti três vezes. `npm test` responde *"o teste rodou?"*. Teste de mutação
responde a pergunta que importa: *"o teste DETECTA a mudança errada?"*. Ele
altera o código de propósito e exige que alguma asserção quebre.

**A prova de que não era teoria.** Na primeiríssima execução ele deu **0,00%**
para `lib/loginBlock.js` — a fonte única de *"esta pessoa pode entrar no site?"*,
usada pela página de login e pelo formulário — porque **não havia teste nenhum**
ali. A suíte inteira estava verde. Escrever os testes levou o módulo a 92,86% e
o total de 63,76% para 71,07%.

#### Escopo pequeno de propósito

Só a lógica pura de `src/lib/`, dez arquivos. Mutar componente de tela produz
montanha de mutante que nenhum teste razoável mata, e **um número que ninguém
consegue melhorar é um número que todo mundo aprende a ignorar** (§0.2, 4ª
regra). Cobertura ampla e inútil é pior que cobertura estreita e verdadeira.

#### Por que sob demanda, e não em todo PR

Não é custo: a rodada leva **39 segundos**, medidos. É a natureza do número.

Score de mutação é métrica de qualidade de **suíte**: move devagar e balança
com refatoração inocente — extrair uma função muda a contagem de mutantes sem
nada ter piorado. Portão que reprova PR por um número que oscila sozinho é
alarme falso, e alarme falso ensina a ignorar o canal justamente para o dia em
que a queda for real.

Por isso ele segue o padrão do lembrete de auditoria: **issue mensal, não build
vermelho** (`.github/workflows/lembrete-de-mutacao.yml`).

#### O piso tem margem, e é para SUBIR

`break: 65`, com o score em 71,07. Colar o piso no valor de hoje faria qualquer
mudança inocente reprovar. Ele é um chão a levantar com o tempo, não uma meta a
bater.

#### A coluna que mais informa não é o score

É `# no cov`: mutantes em código que **nenhum teste toca**. Foi ela que
denunciou o `loginBlock.js`. Restam 65 nessa coluna, concentrados em `date.js`
e `roles.js` — anotado no `BACKLOG.md`.

#### O que ele NÃO faz

Não encontra bug: encontra **teste fraco**. Um módulo com 100% de mutação pode
estar implementando a regra errada com perfeição. Ele mede se a rede pega o
peixe, não se o peixe é o certo.


### `[28/08]` Testar moderação com `ogamerpedro`, nunca com `claudetester`

**A decisão do dono:** *"não precisa de uma terceira conta, existe uma minha:
ogamerpedro, dá pra usar ela"*.

**O problema que ela resolve.** Testar moderação em produção significa **banir
alguém**. A `claudetester` é a conta que o E2E usa para logar, e enquanto ela
está banida a `BannedScreen` cobre a tela — o job "fluxos autenticados" falha
apontando para o site quando o problema é o estado da conta. Aconteceu **duas
vezes em 20 minutos** em 28/08.

**Por que não uma terceira conta**, que foi a primeira sugestão: seria a
terceira conta de teste a manter, com senha, email e ciclo de vida próprios — e
o dono já tem uma conta pessoal que serve. Menos superfície é melhor.

**O que já está mitigado, e o que não está.** O `recusarSeBanido()` faz o CI
**nomear a causa** em vez de dar timeout de 30 s. Mas mitigar o diagnóstico não
impede o vermelho: o que impede é banir outra conta.

### `[29/08]` Gancho de teste no componente, e não seletor de CSS

O `e2e/painel-admin.mjs` contava as linhas de post com
`main tbody tr, main [data-post-row]`. **Nenhum dos dois casava**: a lista é de
`<div class="card">`, não de tabela, e o atributo nunca existiu no componente.
O contador dava **zero, sempre**.

**E o teste passava.** Com menos de uma página de posts, o botão "Carregar mais"
não aparece, e o `else` registrava *"sem botão"* como sucesso. Ele passou meses
sem nunca ter contado uma linha. Quando o banco cruzou 20 posts, o botão surgiu
e a asserção caiu com `0 linhas antes, 0 depois`.

**Por que `data-post-row` e não a classe `.card`:** classe de CSS existe para
estilo e muda com o layout; amarrar o teste a ela troca um acoplamento frágil
por outro. Um atributo dedicado declara *"isto é uma linha de post"* e é um
contrato explícito entre o componente e o teste.

**A trava real, porém, é outra:** o teste agora **exige ver linhas antes de
olhar o botão**. Com ou sem paginação, ele prova que sabe enxergar um post — e
o ramo do `else`, que era o esconderijo, deixou de ser alcançável às cegas.

É a segunda vez que este mesmo arquivo passa pelo motivo errado: antes, o
seletor da aba de Notificações casava com o sino do `Header`. Teste verde não é
prova de teste útil.

### `[24/08]` Contas de teste com cargo: o que decidir antes de criar

**Eu consigo mudar cargo sozinho.** O guard `guard_profile_privileged_cols` só
reverte `role`/`banned`/`suspended_until` quando `current_user` é
`authenticated` ou `anon`; pelo MCP eu rodo como `postgres`, então o guard não
me alcança e um `UPDATE` direto passa. Também consigo criar usuário no
`auth.users`. Ou seja, a pergunta não é "dá?", é "deve?".

**Não promover a `claudetester`.** Ela é `user` de propósito: o passo 3 do
`e2e/fluxos.mjs` usa exatamente ela para provar que `/admin` e `/owner` são
**negados**. Promovê-la apagaria a única checagem de permissão que roda num
navegador de verdade.

**O que o cargo destravaria**, e é real: o `Admin.jsx` e o `Owner.jsx` são as
duas telas maiores do projeto e **nenhum teste de navegador as abre** — é o
motivo de o item do React Query estar travado. Fila de moderação, banimento,
suspensão e logs só são exercitados por SQL em transação.

**O que ele custa, e é o que precisa de decisão sua:** a senha de uma conta
de staff passaria a viver nos Secrets do GitHub. Quem obtiver esse secret
modera, oculta e bane. Hoje o pior caso de um vazamento é uma conta comum
descartável; com staff, o raio de explosão muda de categoria.

**Recomendação:** uma conta `admin`, nunca `owner`. `admin` já abre o painel e
a fila; `owner` acumula encerrar live, mexer em cargo e configuração do site —
poder demais para uma senha que mora em CI. As ações de `owner` continuam
sendo validadas em `ROLLBACK`, que é onde já são hoje.

**Pendente:** o dono decide se cria. Registrado no backlog.

### `[27/08]` Os deploys duplicados eram um Deploy Hook por cima da integração

Fechando a investigação de 23–24/08 com **fato**, não mais hipótese. A URL do
webhook do GitHub era:

```
https://api.vercel.com/v1/integrations/deploy/prj_…/…
```

O `/deploy/prj_` confirma: era um **Deploy Hook**, montado como webhook do
GitHub **em cima** da integração nativa da Vercel (`Connected May 16`). Cada
push disparava os dois caminhos.

Isso também explica a foto do dono aparecendo em alguns deploys e não em
outros: deploy criado por Deploy Hook é atribuído a quem criou o hook; o da
integração nativa vem com o triângulo da Vercel. Era a mistura exata do painel.

**Correção da minha própria conta:** eu tinha escrito no `CLAUDE.md` §0.2 que
os deploys de produção do dia foram "~12 contra ~88 de preview". Se cada merge
valia 2 ou mais, os ~12 merges renderam bem mais que 12. A conclusão (o preview
era desperdício) continua de pé; a proporção estava errada.

O webhook do GitHub já foi apagado. Falta apagar o **Deploy Hook** do lado da
Vercel — está no backlog, e não é só limpeza: a URL é uma senha, e ela foi
colada num chat.

### `[23/08]` Abrir mão dos previews da Vercel

Batemos no teto de 100 deploys/dia do plano Free com 3 usuários no site. A
branch de trabalho deixou de deployar.

**O que se perde:** uma URL clicável por PR. **Por que sai barato:** ninguém
clicava. Quem revisa branch aqui é o CI — build, lint, 168 testes, as rotas num
Chromium de verdade, o E2E autenticado com login/publicação/exclusão, e as
portas das Edge Functions. O preview era uma segunda opinião mais fraca que a
primeira, e custava 3 a 5 deploys por PR.

**Duas ideias descartadas, porque atacam o alvo errado** — as duas vieram de
fora e vão voltar:

| Ideia | Por que não resolve |
| --- | --- |
| "Mergear menos vezes na main" | Os deploys de produção eram ~12 no dia. O teto é 100. O grosso era preview de branch |
| "Usar branch de teste e só mandar pra main o que estiver sólido" | Já é o que se faz — a `claude/*` **é** a branch de teste. O problema era ela deployar também |

**Por que duas camadas** (`deploymentEnabled` **e** `ignoreCommand`): não está
confirmado se um build *pulado* ainda conta na cota diária de deploys. A
primeira impede o deploy de nascer; a segunda economiza build quando ele
nasce. Na dúvida entre duas camadas e uma incerteza, ficam as duas.

**O script erra para o lado de construir.** Se não conseguir comparar com o
commit anterior, ele constrói. Pular por engano deixaria o site velho no ar em
silêncio, que é pior do que gastar um deploy.

### `[23/08]` CI no GitHub Actions em vez de disciplina

`build`, `lint` e `test` rodavam porque alguém lembrava. Agora rodam a cada PR.
Público é ilimitado; privado são 2.000 min/mês contra ~3 min por PR.

**Junto veio o piso de 125 testes.** O CI quebrando é o caso fácil — fica
vermelho e alguém olha. O perigoso é ele **passar sem testar nada**: arquivo de
teste renomeado, `describe.skip` esquecido, glob de config alterado. Ao
adicionar testes, subir o piso junto.

### `[23/08]` O E2E autenticado roda com conta comum, nunca de staff

Parece limitação e é o contrário: com `role = 'user'` o teste pode **exigir**
que `/admin` e `/owner` não mostrem nada, o que é uma checagem de permissão num
navegador de verdade — a única camada que faltava (RLS e RPC já são validadas
em transação com ROLLBACK). Com conta de admin, além de perder isso, o post
soft-deletado continuaria visível com o aviso "Post excluído" e o passo de
exclusão não teria como se provar.

**O que ele não cobre, de propósito:** banimento e moderação. Precisariam de
uma segunda conta como vítima e são destrutivos.

### `[23/08]` Só em PR, porque escreve no banco de produção

O teste publica e apaga um post de verdade. Repetir no push da `main` depois do
merge duplicaria a escrita sem cobrir nada novo. Não existe ambiente de staging
— criar um segundo projeto Supabase custaria mais atenção do que protege com
3 usuários.

### `[23/08]` Dependabot ignora atualizações **major** de propósito

Patch e minor entram agrupados, semanalmente, teto de 3 PRs. Major fica de fora
porque **já quebrou o site uma vez** — foi o upgrade do react-router que
motivou o teste de fumaça existir. Major entra na mão, com changelog lido.

> **`[27/08]` A regra vale para npm, não para GitHub Actions.** O `ignore` do
> `dependabot.yml` está dentro do bloco `package-ecosystem: npm`; o bloco de
> `github-actions` não tem nenhum. Foi assim que o `actions/checkout` v5→**v7**
> e o `setup-node` v5→**v7** chegaram como PR — e foram aceitos.
>
> **Não é descuido, e não vamos "corrigir".** Ecossistema diferente, risco
> diferente: major de Action mexe quase sempre no runtime de Node em que ela
> roda, não no contrato de entrada. E o detector é instantâneo — se `checkout`
> quebrar, **todos** os jobs ficam vermelhos no primeiro PR. Não existe versão
> silenciosa dessa falha, que é o oposto do major de npm, onde o site quebra
> para o usuário e o CI pode continuar verde.

### `[27/08]` A trilha de falha limita uma linha por hora — eu criei o problema

Em 23/08 fiz as Edge Functions gritarem em `admin_logs` para acabar com falha
silenciosa. Funcionou, e **criou fadiga de alarme** — que é a mesma doença pelo
outro lado.

**Os números que expuseram:** `edge_function_error` virou a **2ª ação mais
frequente de toda a trilha** (68 linhas), e as 68 são "chamada recusada".
**Zero são falha de verdade.** Vinham de dois lugares: a própria trava
`portas-fechadas.mjs`, que manda 3 requisições recusadas por execução do CI, e
a `send-email`, que é pública por construção — qualquer POST da internet
gravava uma linha, sem limite.

**O espaço em disco nunca foi o problema.** 376 kB numa base de 23 MB de 500 MB,
e com 90 dias de retenção o regime permanente é ~1,8 MB. O item do backlog, como
estava escrito ("a tabela pode inchar"), descrevia um não-problema.

**O problema era a verdade da mensagem.** Essas linhas entravam como
`critical` — e a função **funcionou**: ela recusou um estranho, que é o trabalho
dela. Uma falha real da `send-email` (Google travou a conta, cadastro parado)
chegaria num canal já cheio de ruído. Fere diretamente a regra "toda mensagem de
erro tem que ser verdadeira" (§1.5).

**A correção:** uma linha por hora, por `(função, tipo de falha)`. Preserva o
sinal — hook mal configurado produz recusa contínua e a linha aparece de hora em
hora — e mata o ruído: scanner vira uma linha por hora em vez de mil.

**Consequência aceita:** a linha diz *que* aconteceu, não *quantas vezes*.
Contar exigiria alterar a linha existente, e a trilha é append-only. Para
responder "algo está errado?", uma por hora basta.

**As 68 linhas antigas não foram apagadas.** Apagar registro de auditoria para o
número ficar bonito é o instinto errado, e elas envelhecem sozinhas pela
retenção de 90 dias.

**`[27/08]` A severidade veio logo depois, com aprovação.** E medir antes
**reduziu o escopo pela metade**: as 68 linhas eram *todas* da `send-email`. A
`moderate-links` devolve 401 sem logar — nunca foi fonte de ruído. Uma Edge
Function, não duas.

O critério de quem vira `warning` é **fato, não palpite**: o GoTrue **sempre**
assina e **sempre** manda carimbo de tempo válido. Sem cabeçalho, ou com carimbo
fora da janela, não era ele.

| Recusa | Severidade | Por quê |
| --- | --- | --- |
| sem cabeçalhos de assinatura | `warning` | não pode ser o GoTrue. É estranho |
| carimbo inválido / fora da janela | `warning` | idem |
| **assinatura inválida** | **`critical`** | **ambíguo** — atacante, *ou* o secret errado. Se for o secret, o cadastro quebrou em silêncio |
| secret não configurado / malformado | `critical` | nossa config quebrada |

A lista é um `Set` explícito no código, e **o que não está nela continua
`critical`** — desconhecido grita, nunca cai num palpite (§4).

Isso troca metade do ruído (35 de 68 eram "sem cabeçalhos") sem calar nenhum
caso ambíguo.

**Gotcha registrado:** `CREATE OR REPLACE` com parâmetro novo **não** substitui a
função — cria uma segunda com outra assinatura, e a chamada antiga vira
ambígua (`function is not unique`). Precisa de `DROP` explícito antes.

### `[27/08]` Teto por sessão no Sentry, e o que ele **não** resolve

O backlog dizia "o Sentry estoura em silêncio". Ao enunciar o problema direito,
ele se partiu em dois — e só um deles é resolvível em código:

**A. A rajada.** Um bug em laço de render manda centenas de eventos em minutos.
É o caminho realista: com 3 usuários, 166 eventos/dia não se esgotam por uso
normal. Resolvido por `lib/tetoDeEventos.js` — teto de 20 por sessão, e o
estouro vira **um** aviso que carrega o último erro. Rajada de 1.000 erros passa
a custar 21 eventos, e o teste trava isso.

**B. O esgotamento gradual.** Se a cota acabar por outro caminho, o Sentry passa
a descartar e nada no código percebe. **Isso não tem solução em código:** saber
que a cota acabou exige perguntar ao Sentry, o que exige token de API guardado
no CI — trocar uma incerteza de monitoramento por uma credencial exposta é
péssimo negócio, e é a mesma conta que já fizemos no `portas-fechadas.mjs`.

A resposta para B é o **alerta de cota do próprio Sentry**, que manda email ao
se aproximar do teto. É ação de painel, do dono, e está no backlog. Sim, §0.2
regra 3 diz que "está no painel do fornecedor não conta" — mas ali a crítica é
a painel que ninguém abre. **Email chega.**

**Alternativas descartadas:**

| Ideia | Por que não |
| --- | --- |
| Contador no `localStorage` | É por navegador. A cota é global — contar local não diz nada sobre ela |
| Canário periódico batendo na API do Sentry | Precisa de token no CI, e um agendamento novo, para 3 usuários |
| Espelhar erro em `admin_logs` | O cliente não pode escrever na trilha de auditoria (é `service_role`), e abrir isso seria vetor de spam |

### `[23/08]` DSN do Sentry fica no código, não em variável de ambiente

Ele é público por natureza (vai no bundle que qualquer visitante baixa), então
guardá-lo como segredo não protegeria nada. E se dependesse da Vercel, bastaria
esquecer de configurá-lo num deploy futuro para o monitoramento sumir **sem
ninguém perceber** — construindo exatamente a falha silenciosa que ele existe
para acabar.

### `[23/08]` `send-email` recusa tudo se o segredo do hook sumir

A alternativa era continuar enviando e só avisar. Foi descartada: deixaria o
hook aberto para a internet por tempo indeterminado, que é exatamente a brecha
que acabou de ser fechada. **Cadastro parado e barulhento é melhor que hook
aberto e silencioso** — o parado alguém conserta hoje; o aberto ninguém vê.

Toda recusa devolve o mesmo `401`, sem dizer o motivo. Distinguir "assinatura
inválida" de "segredo não configurado" na resposta seria contar de graça o
estado da configuração a quem está sondando. O motivo vai para `admin_logs`.

### `[23/08]` As Edge Functions entram no git como **espelho**, sem sincronia automática

Elas viviam só no Supabase. Isso não é hipótese de risco: em 23/08, ao abrir a
`send-email` pela primeira vez em semanas, achamos que qualquer pessoa da
internet disparava email pelo site, e que a `moderate-links` aceitava
`Bearer lixo-qualquer`. **Um PR teria mostrado as duas linhas.**

Agora estão em `supabase/functions/`, capturadas do que estava implantado.
Três coisas ficam explícitas, porque um espelho silencioso é pior que nenhum:

1. **Nada aqui é implantado automaticamente.** Um deploy pelo dashboard faz o
   repositório mentir sem que uma linha mude. A regra de processo é: mudança
   começa no arquivo, o PR revisa, e só então implanta.
2. **Não existe teste comparando espelho e produção.** Compará-los exigiria um
   token de gestão do Supabase guardado no CI — trocar uma divergência de
   documentação por uma chave de administração exposta é péssimo negócio.
3. **O que existe é `e2e/portas-fechadas.mjs`**, que bate na produção a cada PR
   e exige que as portas continuem fechadas. Ele não garante que os códigos
   sejam iguais; garante que a parte que mais dói não regrediu.

A `send-email` foi dividida em `index.ts` + `email-template.ts` no mesmo
movimento (§4: 314 linhas, e a verificação de assinatura ficava enterrada
embaixo de tabela de email). **Dividida também em produção** — deixar o
repositório dividido e o Supabase inteiro seria criar a divergência no primeiro
dia. Reimplantada e reverificada: ataque sem assinatura → 401; recuperação de
senha real pelo GoTrue → `enviado com sucesso`.

### `[23/08]` Sem limite de taxa próprio na `send-email`

Com a assinatura exigida, quem chama é o GoTrue — que já tem limite por email e
por IP. Um teto adicional aqui só protegeria contra um GoTrue comprometido,
cenário em que a conta de email é o menor dos problemas.

### `[23/08]` Falha das Edge Functions vai para `admin_logs`, **não** para o Sentry

O backlog pedia "Sentry nas Edge Functions". Foi feito diferente:

1. sem dependência nova numa função que está no **caminho crítico da moderação**;
2. cai no painel que o dono **já olha**, em português, junto do resto da trilha;
3. o Sentry do frontend já cobre o outro lado — a chamada que nem chega a sair.

Se a operação crescer, o Sentry no Deno vira complemento, não troca.

### `[23/08]` Descartados, com o motivo

| O quê | Por que não |
| --- | --- |
| **CodeQL** | US$30 por committer/mês, e entrega pouco além do `npm audit` no tamanho deste projeto |
| **Agregadores de IA** (TypingMind, Monica, MagAI) | São interfaces de **conversa**: não rodam migration, não leem `pg_policies`, não abrem PR. Seriam um passo atrás do MCP do Supabase e do GitHub, que já estão conectados |
| **Plugins de terceiros do Claude Code** | Executam código arbitrário com o privilégio do usuário, e a Anthropic não audita servidores MCP. Os dois que importariam aqui já estão conectados |
| **PC dedicado para desenvolvimento** | O CI resolve as mesmas duas limitações do ambiente remoto (navegador que não alcança o Supabase, realtime que não se observa), de graça e sem máquina ligada |

**O que vale de multi-modelo:** segunda opinião **manual** antes de aplicar
migration que mexe em RLS, hierarquia ou `SECURITY DEFINER`. Colar o SQL em
outro modelo e perguntar "o que pode dar errado aqui?". Custo zero, dois
minutos, pega ponto cego. Não vale automatizar.

---

## Infraestrutura

### `[23/08]` Envio de email por conta Google dedicada

Antes usava a conta pessoal do dono. O problema não era aparência: uma senha de
app dá acesso **SMTP e IMAP** à conta inteira, e ela estava guardada nos
secrets do Supabase. Uma conta dedicada e vazia limita o raio de explosão de um
vazamento.

Domínio próprio + Resend resolveria de vez (`nao-responda@…`), mas custa ~R$40/
ano e não se justifica com 3 usuários. Registrado no backlog.

### `[23/08]` O motivo da pausa é lido **antes** de o banco cair

Se o banco caiu, o motivo não pode vir de lá. O app lê `site_config.pause_reason`
enquanto está online e guarda no navegador. Consequência aceita: pausa
planejada mostra o motivo real; queda inesperada mostra texto genérico. Não há
como fugir disso sem hospedar o aviso fora do Supabase.

---

[← voltar para o README](../README.md)
