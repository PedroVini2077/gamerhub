# Visão de futuro

> **Isto não é backlog e não é compromisso.** É o mapa de onde o GamerHub *pode*
> chegar — para responder "e agora, o que faz mais sentido construir?" quando um
> bloco de trabalho fecha, em vez de inventar a próxima feature no impulso.
>
> O que **vamos** fazer mora no [`BACKLOG.md`](../BACKLOG.md). O que já foi
> **decidido ou descartado** mora em [`DECISOES.md`](DECISOES.md). Aqui é só
> possibilidade.

## Como uma ideia sai daqui

```
VISÃO DE FUTURO  ->  vira decisão  ->  BACKLOG  ->  feito, sai do backlog
   (possível)         (com data)        (fila)        (o PR guarda a história)
```

Uma linha só sai daqui quando **você decide** que ela vai acontecer. Enquanto
não decide, ela fica — e ficar aqui não a envelhece nem cobra nada de ninguém.
É o que impede a fila de virar lista de desejo: em 23/08 o `BACKLOG.md` tinha
1.330 linhas e 90% não era backlog.

## A régua, quando houver mais de uma opção boa

Na ordem, e ela é do dono:

1. **Alto impacto** para quem usa
2. Custo inicial **baixo ou moderado**
3. Complexidade inicial **baixa**
4. Pode **evoluir depois** — começa simples e ganha camadas
5. **Aproveita** a arquitetura que já existe
6. **Não** cria complexidade desnecessária
7. Preserva qualidade, segurança, desempenho e a experiência visual

E a régua tem um lado que costuma faltar: **"essa ideia é legal, mas ainda não
vale a pena" é uma resposta válida.** O GamerHub não precisa virar projeto
infinito por obrigação — cresce quando fizer sentido.

> A ordem das **camadas** (§0.4 do `CLAUDE.md`) continua valendo por cima disto:
> landing → login/cadastro → site logado. Na dúvida entre duas coisas boas, ganha
> a da camada mais externa, porque um defeito lá é visto por todo mundo que
> chega.

---

## As direções

A terceira coluna é o que mais importa aqui: **a menor versão que já entrega
valor.** Nenhuma destas ideias precisa nascer inteira, e quase nenhuma deveria.

| | Direção | A menor versão que já vale |
| --- | --- | --- |
| 🏆 | **Conquistas** | 5 a 8 conquistas fixas em cima do que o XP já conta hoje, mostradas no perfil |
| 🎮 | **Jogos** | uma página por jogo, montada a partir dos jogos que as pessoas já citam no perfil |
| 👥 | **Comunidades / grupos** | o mural que já existe, com dono e um punhado de membros |
| 🎬 | **Clips** | vídeo curto no feed com um marcador próprio — a moderação de mídia já cobre |
| 📅 | **Eventos** | um post fixado com data, e quem confirma presença |
| 🏅 | **Torneios** | um evento com chave simples de eliminação; ranking e equipes vêm depois |
| 🎤 | **Salas de voz** | é a mais cara da lista — sala de texto ao vivo primeiro, voz só se a de texto pegar |
| 🤝 | **Amigos e presença** | seguir alguém; "jogando agora" e "ao vivo agora" reaproveitam o canal de presença que já existe |
| 📰 | **Notícias gamer** | curadoria manual da equipe antes de qualquer integração automática |
| 🔎 | **Busca global** | busca por usuário primeiro; jogos, posts, lives e o resto entram um por vez |

> **`[05/09]` Silenciar por tempo numa live.** A coluna `live_muted.muted_until`
> existia no banco e nunca foi ligada — silenciar é "existe linha = calado", e
> tirar o silêncio é apagar a linha. A coluna foi apagada (estava vazia), e a
> ideia veio para cá, que é onde intenção mora: coluna vazia no schema não
> guarda intenção, engana quem lê. A menor versão que vale: um campo de minutos
> no modal de silenciar, e uma checagem de `now()` na leitura.

## Expansões maiores, para quando houver gente

Estas dependem de **volume de pessoas**, não de código. Construí-las cedo é
construir para uma sala vazia:

- **Guildas / clãs** — comunidades com identidade, hierarquia e disputa
- **Competitivo** — temporadas, elo, histórico de partidas
- **Matchmaking** — juntar quem quer jogar junto
- **Economia virtual** — moeda, recompensas, itens de perfil
- **Marketplace** — troca entre pessoas (e o problema de confiança que vem junto)
- **Sistemas sociais avançados** — grupos privados, mensagens diretas, reputação
- **Outros produtos** — app, extensão, bot, o que o ecossistema pedir

> **O sinal de que uma delas amadureceu** não é vontade: é a comunidade
> esbarrando na falta dela. Guilda sem gente é tabela vazia; marketplace sem
> confiança é problema jurídico com cara de feature.

---

## O que este documento NÃO decide

- **Ordem.** A régua acima decide, na hora, com o estado do projeto na mesa.
- **Prazo.** Nada aqui tem data, e não ter data é o ponto.
- **Escopo.** A coluna "menor versão" é semente, não especificação.

E ele não substitui o julgamento na hora: uma ideia pode subir de prioridade
porque um problema real apareceu, ou cair porque deixou de fazer sentido. Quando
isso acontecer, o motivo vai para [`DECISOES.md`](DECISOES.md) — aqui fica só o
mapa.

---

## `[04/09]` Três ideias do dono, pensadas junto

> Chegaram numa mensagem só, no fim da rodada da tela de entrada. Estão aqui, e
> não no backlog como tarefa, porque **duas delas mudam de forma dependendo de
> uma decisão dele**. O backlog carrega o ponteiro e a decisão pendente.

### 1. A tela de boas-vindas depois de entrar

**O que ele descreveu:** em vez do redirecionamento seco, uma tela rápida —
*"seja bem-vindo (nome), preparando tudo pra você"* na primeira vez, *"bem-vindo
de volta"* nas seguintes — com um portão se abrindo.

**Por que a ideia é boa, e não é só enfeite.** Entrar hoje é um corte: o
formulário some e o feed aparece. Nesse intervalo o site **já está trabalhando**
— carrega perfil, cargo, feed, notificações. A tela não inventa espera: ela
**mostra a espera que já existe**, que é a diferença entre um site que parece
travado e um que parece te esperando.

**O risco, e é o que mata esse tipo de tela.** Uma animação de 2 segundos é
encantadora na primeira vez e é pedágio na décima. Quem entra todo dia vai
começar a odiar.

**Como eu faria, e é a parte que muda o desenho:**

| | |
| --- | --- |
| duração | **o tempo do carregamento real**, não um número fixo. Ela sai quando o perfil e o feed chegam |
| piso | ~600 ms, para não piscar em conexão rápida |
| teto | ~2,5 s. Se o carregamento demorar mais, ela sai assim mesmo e o site assume — enfeite **nunca** vira porta trancada (§0.3, regra 3) |
| primeira vez | **não precisa de banco.** Quem acabou de se cadastrar é primeira vez por construção; quem fez login é "de volta" |
| menos movimento | `prefers-reduced-motion` recebe só o texto, sem portão |

**A pergunta dele — *"para todo login ou cadastro?"* — tem resposta:** para os
dois, porque nos dois existe carregamento a cobrir. O que muda é a frase.

### 2. O cofre do painel do Fundador

**O que ele descreveu:** ao clicar na aba do Fundador, um cofre com campo de
senha; acertando, animação de abertura e acesso liberado por um tempo.

**A ideia visual é ótima. O que precisa de decisão é o que ela PROTEGE.**

O site conversa com o banco usando a `anon key`, que é pública. As funções do
Fundador já são protegidas no **banco**, por `is_super()` e pela hierarquia de
cargos — é isso que impede um `admin` de alterar cargo, não a tela.

Uma senha conferida **no navegador** esconde a interface e mais nada: quem
estiver com a sessão aberta chama a RPC direto pela API. Então existem dois
projetos diferentes com o mesmo desenho:

| | Cofre cenográfico | Cofre de verdade |
| --- | --- | --- |
| onde a senha é conferida | no navegador | numa RPC, contra um hash |
| protege de quê | de ninguém — é apresentação | de quem pegou a sessão aberta |
| o que muda no banco | nada | tabela de desbloqueio + toda RPC de owner exigindo desbloqueio ativo |
| risco novo | nenhum | **ficar trancado para fora** se a senha se perder — precisa de caminho de recuperação pensado antes |
| custo | pequeno | grande, e mexe no arquivo mais sensível do projeto |

> **`[05/09]` FEITO, na versão cenográfica.** O dono escolheu com a tabela
> acima na mesa. Está em `lib/cofre.js` + `components/owner/CofreDoFundador.jsx`,
> com o aviso de que é visual impresso **na própria tela**, e em
> [SEGURANCA.md](SEGURANCA.md) por extenso. **A coluna "cofre de verdade" desta
> tabela continua valendo como possibilidade** — inclusive o risco de ficar
> trancado para fora, que precisa de caminho de recuperação pensado antes.

**Minha recomendação:** o cenográfico agora, **dito com todas as letras que é
cenográfico** — inclusive no `SEGURANCA.md`, para ninguém daqui a seis meses
achar que existe uma segunda tranca que não existe. E, se a preocupação real é
"e se pegarem minha sessão", a defesa que vale mais por hora de trabalho é
**2FA na conta do Supabase**, não uma segunda senha guardada no mesmo lugar que
a primeira.

**Sobre "aparecer toda hora":** o natural é **por sessão do navegador** — abriu
o cofre, fica aberto até fechar a aba. Tempo fixo (30 min, 1 h) é pior: ele
tranca no meio de uma moderação.

### 3. Música no painel do Fundador

Ele perguntou três coisas. As três têm impedimento, e vale escrever qual:

| O que ele quis | O que impede |
| --- | --- |
| *"usar as músicas que estão no meu celular"* | **não existe API** que deixe um site ler a biblioteca de música do aparelho. Nem no Android nem no iOS. O máximo é ele escolher arquivos na mão, um por um, a cada visita |
| integrar o **Spotify** | o player que toca faixa inteira exige **conta Premium de quem está ouvindo**, e login no Spotify dentro do site. O widget grátis toca prévia de 30 s para quem não está logado |
| integrar o **YouTube** | tocar vídeo como música de fundo, com o player escondido, é uso que a plataforma não permite; e navegador nenhum deixa áudio começar sozinho sem um clique |

> **`[04/09]` Isto é conhecimento meu, não medição de hoje.** Regras de
> plataforma mudam. Se ele quiser seguir por um desses caminhos, o certo é eu
> abrir a documentação atual dos dois antes de escrever qualquer linha (§1.1:
> inferência não é fato).

**E tem um custo que não é técnico:** os dois entregam o navegador de quem abre
o painel para uma empresa a mais. Este projeto tirou o Google Fonts do site
exatamente por isso, e a política de privacidade lista quem recebe o quê — um
player embutido entraria nessa lista.

**O caminho limpo é o que o site já usa.** O som ambiente da landing é um
arquivo curto, hospedado por nós, com crédito e licença conferidos por teste
(`conteudoDoSobre.test.js`). Para uma aba que **só o dono vê**, isso resolve
inteiro: uma faixa de 1–2 minutos em laço, ligada por clique dele, com a
preferência salva. Sem terceiro, sem cota, sem regra de plataforma.

---

## `[05/09]` A tela de APARELHOS CONECTADOS

> Nasceu de dentro da recusa do logout global: *"a não ser que tenha uma aba pra
> identificar dispositivos conectados, tipo Instagram, sabe? … isso serve
> realmente pra identificar roubos de dados e se tem alguém mexendo na sua
> conta"*.

**Ele descreveu a peça que falta, não um enfeite.** O logout global existia para
um caso — *"tem alguém na minha conta, derruba todo mundo"* — que o site nunca
conseguiu apresentar a ninguém. Uma lista de sessões é o que torna esse caso
**visível**, e só depois dela faz sentido oferecer o botão que o resolve.

**A menor versão que serve:** uma lista com *quando entrou*, *qual navegador e
sistema*, e um botão **"encerrar esta sessão"** por linha — mais um "encerrar
todas as outras". Sem isso a tela vira decoração; com isso ela responde à
pergunta que a pessoa realmente faz.

**O que precisa ser resolvido antes, e é o motivo de não ser tarefa hoje:**

| Pergunta | Situação |
| --- | --- |
| o Supabase expõe as sessões da própria pessoa? | **não sei, e não vou afirmar** — `auth.sessions` é schema interno; alcançá-la pede RPC `SECURITY DEFINER` própria, e revogar uma sessão específica é outra história |
| e a **região**, que ele citou? | é geolocalização por IP, que é **serviço de terceiro** e **dado pessoal novo** — entra na política de privacidade e na lista de quem recebe o quê. Decisão dele, não minha |
| o que exibir de "aparelho"? | `user-agent` é o caminho honesto (navegador e sistema). Modelo exato é impressão digital, e este projeto já recusou isso — ver [DECISOES.md](DECISOES.md) |

**Enquanto ela não existe**, quem precisa expulsar alguém troca a senha: isso
revoga no servidor, e é o que a saída de `AuthConfirm.jsx` faz de propósito.

---

## `[05/09]` A ideia do painel do Fundador NA LANDING — DESCARTADA por ele

> **`[05/09]`, no fim do dia: descartada.** *"esquece o painel da porta de
> entrada kkkk, realmente não faz sentido, descarta e nem lembra disso não"*. A
> análise fica inteira abaixo porque ideia recusada volta, e o registro é o que
> impede alguém — inclusive eu, noutra sessão — de "consertar" uma decisão
> proposital. O resumo está em [DECISOES.md](DECISOES.md).

> Pedido dele para **pensarmos juntos**, com a frase certa: *"eu modero apenas
> dentro do site, mas a landing não tem ninguém olhando… pensei em fazer um
> painel só pro site em si, que é a porta de entrada, com um painel totalmente
> diferente do site logado"*.

**A dor que ele descreveu é real, e eu não sabia que ela existia.** Está aqui, e
não no backlog como tarefa, porque a decisão que ela pede é dele.

### A palavra "painel" está escondendo duas coisas diferentes

Separar as duas é o valor deste texto — elas têm respostas opostas.

| | O que seria | Tem objeto hoje? |
| --- | --- | --- |
| **A** | **moderar** a landing | **não** |
| **B** | **vigiar** a landing — saber se ela está de pé | **sim, e ninguém vigia** |

**A não tem objeto, e isso é fato conferido, não impressão.** A landing não
recebe conteúdo de quem visita: ela é Hero, seções, prints, rodapé e as páginas
públicas (`/sobre`, `/termos`, `/privacidade`, `/regras`, `/contato`). O único
texto humano que entra por ali é o **formulário de contato** — e ele já tem
painel, leitura e resposta, em `components/admin/ContatoPanel.jsx`. Moderação de
landing seria uma tela sem nada para moderar.

**B tem objeto, e é exatamente o §1.5.** Hoje, se a cena 3D cair no fallback, se
a fonte não chegar, se o `dbHealth` jogar o visitante para a versão sem banco, ou
se o envio de e-mail parar por cota — **o visitante vê e o dono não fica
sabendo**. Ele descobre abrindo o site por acaso. Essa é a parte da ideia dele
que eu acho que precisa existir.

### O que eu discordo, e digo antes de executar (§7)

**"Conseguir entrar pela própria landing" é a única parte que eu não faria.**

Um segundo caminho de entrada é um segundo sistema de autenticação: outra senha
para vazar, outra sessão para expirar errado, outro lugar onde um bug meu abre a
porta. `hooks/useAuth.jsx` e `pages/Login.jsx` estão na lista de **alto risco**
do `CLAUDE.md` §7 justamente porque quebrar ali derruba o site inteiro.

**E ele não precisa disso.** A landing em `/` já é `HomeOrLanding`: logado, ele
não vê a landing — vê o site. Um painel da porta de entrada é uma **rota a mais
para quem já é `is_super()`**, não uma porta a mais. Mesma senha, mesma
identidade, mesma RLS, tela diferente. É aditivo, que é o que o §7 pede.

> O cofre do painel do Fundador já respondeu a mesma pergunta em 04/09, e a
> resposta continua valendo: **o que protege é o banco, não a tela**. Uma senha
> só de landing, checada no cliente, seria decoração — o site entrega a `anon
> key`, e quem quiser fala com a API sem passar por tela nenhuma (§1.3).

### A tensão que precisa ser dita: vigiar a porta × não rastrear quem passa

*"Saber quem está chegando na landing"* e *"não rastrear visitante"* são
objetivos que se puxam em direções opostas, e este projeto já escolheu um lado —
o `DECISOES.md` registra a recusa de identificar aparelho, e a política de
privacidade lista quem recebe o quê.

O caminho honesto para número de visita é o **agregado, sem cookie**: o Vercel
Web Analytics e o Speed Insights já estão instalados. Isso é um **link** no
painel, não um sistema a construir — e é a diferença entre saber *quanta* gente
chegou e saber *quem* chegou. A segunda é a que este site não vai fazer.

### A menor versão que entrega o valor

Uma aba **"Porta de entrada"** dentro do painel que já existe — não um site
separado, não um login separado:

| Linha | De onde vem o dado |
| --- | --- |
| banco de pé? última queda? | `dbHealth`, que já existe |
| envio de e-mail recusado (cota do Gmail) | já grita em `admin_logs` desde 23/08 |
| checagem de link recusada (Safe Browsing) | já grita em `admin_logs` desde 23/08 |
| Edge Function falhando | já grita em `admin_logs` |
| mensagens de contato sem resposta | já existe, hoje espalhado noutra aba |
| quanta gente chegou | **link** para o Vercel Analytics |

**Quase tudo já é gravado.** O que falta não é instrumentação: é uma tela que
separe *"o que quebrou na porta de entrada"* de *"o que quebrou lá dentro"* —
que é a pergunta que ele fez e que nenhuma tela de hoje responde.

**O que eu não faria, e o motivo:**

- **segunda porta de entrada** — acima;
- **painel fora do app** — outro build, outro deploy, outra cota da Vercel (§0.2)
  e um segundo lugar para a mesma regra de permissão divergir (§4);
- **qualquer medição de visitante individual** — é o oposto do que o site
  prometeu por escrito.
