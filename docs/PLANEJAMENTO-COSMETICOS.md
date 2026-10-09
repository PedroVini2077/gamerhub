# Cosméticos, personalização e colecionáveis — ESTUDO

> **Estado: PESQUISA CONCLUÍDA, NENHUMA IMPLEMENTAÇÃO REALIZADA.**
> Pesquisa feita em **09/10/2026**. Nenhum arquivo executável foi tocado:
> sem código, sem migration, sem RLS, sem bucket, sem dependência.
>
> O prompt que originou este estudo, e como retomá-lo, está em
> [`PROMPT-CONTINUIDADE-COSMETICOS.md`](PROMPT-CONTINUIDADE-COSMETICOS.md).

[← voltar para o README](../README.md)

---

## Como ler este documento

Cada afirmação carrega a sua origem. Isso não é formalidade: metade do valor
de um estudo é saber o que nele é **fato** e o que é **palpite**.

| marca | o que significa |
| --- | --- |
| **[CÓDIGO]** | verificado abrindo o arquivo ou consultando o banco, hoje |
| **[OFICIAL]** | sustentado por documentação oficial consultada, com link |
| **[RECOMENDAÇÃO]** | proposta minha, ainda não implementada |
| **[HIPÓTESE]** | possibilidade que precisa de validação |
| **[DECISÃO PENDENTE]** | depende dele |

---

## 1. O objetivo, como ele o descreveu

Um sistema de **personalização visual e colecionáveis**: molduras de perfil,
figurinhas e itens desbloqueáveis. A inspiração vem de plataformas gamer, mas
com um corte explícito:

> *"Não quero copiar o modelo de assinatura premium do Discord. A proposta é
> explorar maneiras de oferecer aos usuários mais liberdade de personalização,
> expressão e identidade dentro do GamerHub."*

**Sem loja, sem pagamento, sem economia virtual** como requisito inicial.

---

## 2. Diagnóstico — o que o GamerHub tem hoje

### 2.1 O avatar é UM componente de 33 linhas, e isso é a boa notícia

**[CÓDIGO]** `src/components/ui/Avatar.jsx` tem **33 linhas** e é o único lugar
que desenha a foto. Há **16 pontos de uso** no projeto, em cinco tamanhos:

| tamanho | onde |
| --- | --- |
| 24 px | chat da live, painel de moderação |
| 28 px | resposta de comentário, autor de notícia |
| 32 px | barra lateral, busca |
| 36 px | post, mural, lista de lives, publicar, painel de admin, ban |
| 88 px | o cartão do `AvatarPopup` |

**Quase todo uso passa pelo `AvatarPopup`**, que embrulha o `Avatar` e já
resolve rank. Isso concentra a mudança: uma moldura entra em **dois** arquivos,
não em dezesseis.

### 2.2 A borda de rank é CSS na mesma caixa — e esse é o obstáculo real

**[CÓDIGO]** A borda não é imagem. É `border` + `box-shadow` no mesmo `div` que
recorta a foto:

```jsx
className="rounded-full ... overflow-hidden"
style={{
  border: rankBorder ? `${rankBorder.borderWidth ?? 2}px solid ${rankBorder.color}` : '1px solid #2e2e3e',
  boxShadow: rankBorder ? `0 0 ${glowPx}px ${rankBorder.glow}` : 'none',
}}
```

Três consequências, e são elas que decidem a arquitetura:

1. **`overflow: hidden` recorta qualquer coisa que passe da borda.** Uma moldura
   desenhada por cima seria cortada. Ela precisa de uma caixa **irmã**, fora do
   recorte — não de um filho.
2. **A borda ocupa o lugar que a moldura quer.** Rank e moldura disputam o mesmo
   anel de 2 px.
3. **O brilho escala com o tamanho** (`8 / 14 / 22 px` conforme 36 / 48 / 80+).
   Uma moldura precisa da mesma disciplina, ou fica grossa no avatar de 24 px.

**[CÓDIGO]** `getBorderForProfile` em `src/lib/ranks.js` é simples: `owner`
ganha `OWNER_RANK`, quem tem XP ganha o tier, o resto é `null`.

### 2.3 ⚠️ As conquistas NÃO TÊM TABELA — e isto muda o desenho inteiro

**[CÓDIGO]** `src/lib/conquistas.js` é explícito, e o raciocínio está escrito lá:

> *"Conquista, normalmente, é uma tabela… Aqui não é… Estas conquistas são
> **derivadas**: a `get_user_xp` já devolve posts, curtidas, comentários e lives
> numa chamada que o perfil já faz."*

O arquivo até lista o que se perde: **não existe "quando" foi conquistada**, não
dá para notificar, e conquista de evento sem rastro é impossível.

**A consequência para cosméticos é direta e não é pequena.** Uma conquista
derivada não "concede" nada — ela é recalculada a cada visita. Isso serve para
um cosmético **condicional** (*"você vê esta moldura enquanto tiver 50 posts"*),
mas **não** para o que ele pediu:

> *"Trocar de item não faz o usuário perder os itens anteriores."*
> *"Itens podem ser disponibilizados durante eventos específicos e continuar no
> inventário após o encerramento."*

**[RECOMENDAÇÃO]** Inventário **precisa** de persistência própria. Não dá para
derivá-lo — e essa é a primeira coisa que o estudo estabelece.

### 2.4 `profiles` é protegido por privilégio de COLUNA

**[CÓDIGO]** Medido no banco hoje. O papel `authenticated` tem `UPDATE` em
exatamente **12 colunas**:

```
avatar_url, bio, birth_date, discord, favorite_games,
notif_comments, notif_likes, platform, playstyle, state, twitch, youtube
```

Mais três gatilhos: `profiles_guard_idade_minima`,
`trg_guard_profile_privileged` e `trg_notify_new_user`. A RLS tem uma policy por
comando (`INSERT`, `SELECT`, `profiles_update`).

> ### Por que isto é o argumento decisivo contra `profiles.moldura_equipada`
>
> Privilégio de coluna responde *"pode escrever nesta coluna?"* — **sim ou não**.
> Ele não sabe dizer *"só o valor que você possui"*.
>
> Dar `UPDATE` ao usuário numa coluna de moldura é dar **qualquer** moldura:
> o site usa a `anon key`, e um `PATCH` direto na REST API pula o frontend
> inteiro. É o §1.3 na letra — *"validação no cliente não vale nada sozinha"*.
>
> Negar o `UPDATE` e exigir uma RPC resolve a segurança, mas aí a coluna em
> `profiles` não ganha nada sobre uma tabela própria: ela só herda o risco de
> mexer na tabela mais sensível do projeto (**[CÓDIGO]** três revogações em
> `profiles` já derrubaram o site — está em `SEGURANCA.md`).

### 2.5 Storage: dois buckets, ambos públicos

**[CÓDIGO]** `avatars (public=true)` e `post-media (public=true)`. O upload de
avatar passa por `lib/image.js`, que comprime antes de subir (maior lado
1600 px, qualidade 0,82, converte para WebP quando o navegador suporta) e
**pula** `image/gif` e `image/svg+xml`.

**[CÓDIGO]** `docs/regras/COTAS.md` registra o teto que morde: **egress de 5 GB/mês**
no Supabase, e *"projeto pausado; o site cai"* ao estourar.

### 2.6 ⚠️ Um bug encontrado durante a investigação — NÃO corrigido

**[CÓDIGO]** `src/pages/Busca.jsx:128`:

```jsx
<Avatar url={p.avatar_url} username={p.username} size={32} />
```

O componente aceita `profile`, não `url`/`username`. **Toda pessoa no resultado
da busca aparece como "?"**, sem foto, desde o PR #243.

Não foi corrigido porque a regra desta tarefa é explícita — *"se encontrar um
problema, registre a observação. Não a corrija"*. **Fica como item para o
`BACKLOG.md`.**

---

## 3. Pesquisa externa — como produzir as artes

### 3.1 A comparação, com o número que decide

| | SVG inline / CSS | PNG ou WebP | Rive |
| --- | --- | --- | --- |
| peso por item | ~0,5–3 kB | ~5–40 kB | ver abaixo |
| nitidez | infinita | depende do dobro de resolução | infinita |
| animação | CSS, no compositor | só APNG/WebP animado | completa |
| variação de cor | troca de token | arte nova por cor | parâmetro |
| produção | código | ferramenta de desenho | ferramenta própria |
| risco de licença | zero (nosso) | depende da origem | runtime MIT |

### 3.2 ⛔ O Rive está fora, e o motivo é um número

**[OFICIAL]** A página de tamanhos de runtime do Rive, atualizada em
**janeiro/2026**, dá:

| runtime | descomprimido | comprimido |
| --- | --- | --- |
| canvas-lite | 707 KB | **222 KB** |
| canvas | 1.728 KB | 567 KB |
| webgl2 | 2.179 KB | 648 KB |

**O orçamento inicial INTEIRO do GamerHub é 230 KB gzip** (`scripts/orcamento-de-bytes.mjs`).
O runtime **mais leve** do Rive é 222 KB — ele sozinho quase **dobraria** o site.

Carregar sob demanda não salva: continua sendo 222 KB baixados para desenhar um
anel em volta de uma foto de 36 px. É a 1ª armadilha do §0.3 — *"`lazy()` não
adia download"* — e desta vez nem adiar resolveria, porque o custo é o download
em si.

**[RECOMENDAÇÃO]** Descartado. Não por ser ruim — é excelente —, mas porque a
relação entre o que ele custa e o que o GamerHub precisa não fecha.

### 3.3 Licenças de acervo gráfico — a parte com risco jurídico

**[CÓDIGO]** O que o projeto **já usa**, lido dos próprios pacotes instalados:

| pacote | licença | exige atribuição? |
| --- | --- | --- |
| `lucide-react` | **ISC** | não (aviso de copyright no código) |
| `react-icons` | **MIT** | não (idem) |

**[OFICIAL]** O que foi consultado para figurinhas:

**OpenMoji** — a FAQ oficial confirma **CC BY-SA 4.0**, permite uso comercial,
e exige crédito. A cláusula que decide:

> *"Se você remixar, transformar ou criar a partir do material, deve distribuir
> suas contribuições sob a MESMA licença CC BY-SA 4.0."*

**[DECISÃO PENDENTE]** Isso significa que, se as figurinhas do GamerHub forem
**derivadas** de OpenMoji, a coleção do GamerHub nasce **CC BY-SA 4.0** — ou
seja, qualquer pessoa pode pegá-la e redistribuir. Não é impeditivo; é uma
escolha que precisa ser dele, e por escrito.

**Twemoji** — **[HIPÓTESE]** as fontes encontradas são agregadores e um README
de terceiro, não o repositório oficial. O projeto foi **arquivado pelo X**, e há
forks comunitários. **Não confirmado**, e por isso não entra em nenhuma
recomendação deste documento sem uma verificação própria no repositório.

> **O que este estudo NÃO fez, e precisa ser feito antes de usar qualquer
> acervo:** abrir o `LICENSE` do repositório oficial de cada fonte. O que está
> aqui sobre OpenMoji veio da FAQ oficial; sobre Twemoji, de terceiros.

**[RECOMENDAÇÃO]** Para figurinhas, a origem mais segura é **arte própria** —
e o projeto já tem identidade visual definida (`docs/identidade/`), o que torna
isso mais viável do que seria do zero. Acervo de terceiro entra só com a licença
lida e registrada em `docs/DECISOES.md`, como já foi feito com o som ambiente
(que tem trava exigindo crédito visível: `conteudoDoSobre.test.js`).

---

## 4. Arquitetura recomendada

### 4.1 A forma das molduras — três camadas, não uma

**[RECOMENDAÇÃO]** Nem tudo precisa ser do mesmo tipo:

| camada | como | exemplo |
| --- | --- | --- |
| **geométrica** | CSS puro, parametrizado | anel duplo, pontilhado, gradiente |
| **desenhada** | SVG inline, do nosso repositório | cristais, circuito, coroa |
| **animada** | o mesmo SVG + `@keyframes` de `transform`/`opacity` | brilho girando |

Isso aproveita o que o projeto já domina: `src/estilos/animacoes.css` existe
justamente para animação de compositor, e o §0.3 já proíbe animar qualquer coisa
que não seja `transform`/`opacity`.

**[RECOMENDAÇÃO]** PNG/WebP fica como **escape** para arte que SVG não alcança
— e aí com `srcset` nos tamanhos reais (24/28/32/36/88), não um arquivo grande
escalado. Referência de peso medida no projeto: as artes da arena têm 42–145 kB
cada, o que é **muito** para um anel.

### 4.2 Como a moldura convive com a borda de rank

**[RECOMENDAÇÃO]** Elas não disputam: ocupam **anéis diferentes**.

```
    ╭─────────────╮   ← moldura cosmética (caixa IRMÃ, fora do overflow)
    │  ╭───────╮  │   ← borda de rank (como hoje, 2 px)
    │  │ foto  │  │   ← overflow:hidden continua aqui
    │  ╰───────╯  │
    ╰─────────────╯
```

A moldura vira um elemento posicionado **em volta** do `Avatar`, não dentro.
O `Avatar` não muda; ganha um irmão. Isso preserva a distinção que ele pediu —
*"a borda de rank representa progresso, a moldura representa escolha estética"*
— e evita o recorte do §2.2.

**[HIPÓTESE]** Nos tamanhos de 24 px (chat, moderação) pode não haver espaço
para as duas coisas serem legíveis. Precisa de teste visual. **[RECOMENDAÇÃO]**
a moldura só aparece acima de um tamanho mínimo, como o brilho do rank já faz.

### 4.3 Os dados — três tabelas, e por que não duas nem quatro

**[RECOMENDAÇÃO]** Conceitual, **sem SQL e sem criar nada**:

| tabela | o que guarda | quem escreve |
| --- | --- | --- |
| **catálogo** | o item existe: id, tipo, nome, como desenhar, se está ativo | só a equipe |
| **inventário** | quem tem o quê, e **de onde veio** | só o servidor (RPC) |
| **equipado** | o que está em uso, um por categoria | o dono, via RPC |

**Por que três e não duas:** juntar inventário e equipado faria "equipar" ser um
`UPDATE` numa linha que o usuário possui — e aí ele poderia equipar marcando
como equipada uma linha que inseriu. Separar permite que **equipar seja uma
leitura do inventário**, não uma escrita nele.

**Por que não quatro:** a origem da recompensa (*"veio do evento X"*) cabe como
coluna do inventário. Tabela de histórico só se paga quando houver revogação —
e aí ela entra, como a `violations` fez para punição.

**[RECOMENDAÇÃO] Nada em `profiles`.** O motivo está no §2.4, e vale repetir:
privilégio de coluna não expressa "só o que você possui".

### 4.4 Segurança — as seis perguntas que ele listou

**[RECOMENDAÇÃO]** Todas têm a mesma resposta estrutural, e ela já é o padrão
deste projeto:

| ataque | o que impede |
| --- | --- |
| equipar item que não tem | RPC `SECURITY DEFINER` que confere o inventário **antes** de gravar; `authenticated` **sem** `UPDATE` na tabela de equipado |
| conceder item a si mesmo | **sem** `INSERT` no inventário para `authenticated` — só RPC, e a de concessão exige `is_staff()` |
| alterar a origem da recompensa | a coluna de origem é escrita pela RPC, nunca pelo cliente |
| desbloquear por requisição manipulada | a condição é avaliada **no banco**, não recebida do cliente |
| mexer no cosmético de outra pessoa | RLS por `auth.uid()`, como todo o resto |
| abusar da concessão | `admin_logs` + a guarda `exige_operador_ativo()` que a SEC-050 já criou |

**[CÓDIGO]** Duas travas existentes já cobririam parte disso de graça:
`autorizacaoAntesDeExistencia.test.js` (a RPC não pode virar oráculo de
existência) e `estadoDoOperador.test.js` (admin banido não manda no site).

**[CÓDIGO]** E o event trigger `fecha_funcao_nova_para_anon` (SEC-056) garante
que qualquer função nova nasce sem `EXECUTE` para `anon` — sem ninguém lembrar.

---

## 5. Matriz comparativa das estratégias

| critério | A: CSS/SVG | B: artes em arquivo | C: híbrido | D: Rive |
| --- | --- | --- | --- | --- |
| custo de produção | médio (é código) | alto (é desenho) | médio | alto (+ ferramenta) |
| complexidade técnica | baixa | baixa | média | **alta** |
| liberdade artística | média | **alta** | **alta** | **alta** |
| desempenho | **ótimo** | bom | bom | **ruim aqui** |
| manutenção | **ótima** | média | média | baixa |
| item novo sem tocar no front | não | **sim** | parcial | sim |
| segurança | **nenhum arquivo externo** | validar upload | média | runtime de terceiro |
| licença | **zero risco** | depende da origem | depende | MIT, mas 222 kB |
| cabe no orçamento de bytes | **sim** | sim | sim | **não** |

**[RECOMENDAÇÃO] Estratégia C, começando pelo lado A.**

As primeiras molduras em CSS/SVG, porque elas provam o **sistema** (inventário,
equipar, persistir) sem depender de nenhuma arte pronta. Arte em arquivo entra
quando o sistema estiver de pé e houver desenho que justifique.

O contrário — começar pelas artes — gasta o esforço caro antes de saber se a
engrenagem funciona.

> **O que o critério "item novo sem tocar no front" custa, dito com clareza:**
> molduras em CSS/SVG vivem no código, então **coleção nova = deploy**. Isso é
> aceitável enquanto a equipe é uma pessoa; deixa de ser quando houver evento
> sazonal recorrente. O caminho de saída é a estratégia B para essas, não
> reescrever as primeiras.

---

## 6. Plano de evolução proposto

> Sem estimativa de prazo. **[HIPÓTESE]** qualquer número aqui seria chute, e o
> §1.1 proíbe chute vestido de fato.

### Fase 1 — A moldura, com UMA moldura

**Objetivo:** provar a engrenagem inteira com o menor conteúdo possível.

**Escopo:** o catálogo com 2–3 molduras em CSS/SVG, o inventário, a RPC de
equipar, e a tela de escolher. Todas concedidas a todo mundo — **sem regra de
desbloqueio ainda**.

**Por que assim:** separa "o sistema funciona" de "a regra de ganhar está
certa". Se as duas entrarem juntas e a moldura não aparecer, há dois suspeitos.

**Critério de pronto:** a pessoa escolhe, recarrega, continua escolhida; e um
`PATCH` direto na REST API tentando equipar o que não tem **falha**.

**Fora do escopo:** figurinhas, eventos, qualquer arte em arquivo.

### Fase 2 — Desbloqueio

**Objetivo:** a moldura passa a ser conquistada.

**Dependência que o estudo revelou:** §2.3 — conquista é derivada. Esta fase
precisa decidir **[DECISÃO PENDENTE]** se o desbloqueio é condicional (derivado,
some se a condição deixar de valer) ou permanente (gravado, nunca some).

**[RECOMENDAÇÃO]** permanente. *"Ganhei e perdi"* é pior do que nunca ter
ganhado, e ele pediu explicitamente que o item continue após o evento.

### Fase 3 — Figurinhas

**Objetivo:** uma coleção pequena, em **um** lugar só.

**[RECOMENDAÇÃO]** o lugar é o **chat da live** — é onde reação rápida tem
função, a mensagem é efêmera e o estrago de um erro é menor que num post que
fica. **Não** o comentário: lá a formatação acabou de entrar e convém deixar
assentar.

**Riscos próprios desta fase:** moderação (figurinha é conteúdo), peso no
celular, e acessibilidade — figurinha precisa de texto alternativo ou vira
mensagem vazia para leitor de tela.

### Fase 4 — Expansão

Coleções sazonais, eventos, concessão pela equipe. **[RECOMENDAÇÃO]** só depois
de a Fase 2 rodar um ciclo inteiro com gente de verdade.

---

## 7. Riscos

| risco | natureza | o que o reduz |
| --- | --- | --- |
| licença de acervo de terceiro | **jurídico** | arte própria; e licença lida e registrada antes de usar |
| ShareAlike do OpenMoji contaminar a coleção | **jurídico** | decisão escrita dele antes de derivar qualquer coisa |
| moldura cortada pelo `overflow` | técnico | caixa irmã, não filha (§4.2) |
| peso de muitas imagens no feed | desempenho | CSS/SVG primeiro; `srcset` se vier arquivo |
| egress de 5 GB/mês | **cota** | cosmético é cacheável e repetido — mas precisa ser **medido**, não suposto |
| usuário equipar o que não tem | **segurança** | nada de `UPDATE` direto; RPC confere o inventário |
| complexidade sem uso | produto | Fase 1 com 2 molduras, não 20 |

---

## 8. Decisões que dependem dele

1. **O desbloqueio é permanente ou condicional?** (§6, Fase 2) — minha
   recomendação é permanente.
2. **Aceita que figurinhas derivadas de OpenMoji tornem a coleção CC BY-SA?**
   Se não, a origem tem de ser arte própria.
3. **Molduras em CSS/SVG significam deploy a cada coleção nova.** Aceitável
   agora?
4. **Onde as figurinhas entram primeiro** — minha recomendação é o chat da live.
5. **A moldura aparece nos avatares de 24 px?** Precisa de teste visual antes.
6. **O bug da busca (§2.6) vira item do backlog agora?**

---

## 9. Fontes consultadas

| fonte | o que confirmou |
| --- | --- |
| [Rive — Runtime sizes](https://rive.app/docs/runtimes/runtime-sizes.md) (oficial, jan/2026) | canvas-lite **222 KB** comprimido — o número que descarta o Rive aqui |
| [OpenMoji — FAQ](https://openmoji.org/faq) (oficial) | CC BY-SA 4.0, uso comercial permitido, **ShareAlike obrigatório** em derivados |
| `node_modules/lucide-react/LICENSE` (o pacote instalado) | **ISC** |
| `node_modules/react-icons/package.json` | **MIT** |
| o próprio repositório e o banco | tudo marcado **[CÓDIGO]** acima |

**Não verificado:** a licença do Twemoji (só agregadores), e os preços de plano
do Rive (só um comparador de terceiro). Nenhum dos dois sustenta recomendação
neste documento.

---

## 10. Estado final

**PESQUISA CONCLUÍDA. RECOMENDAÇÕES DOCUMENTADAS. NENHUMA IMPLEMENTAÇÃO
REALIZADA.**

Nenhum componente, serviço, hook, estilo ou configuração foi alterado. Nenhuma
migration, policy, função, bucket ou dado do Supabase foi tocado. Nenhuma
dependência instalada.

A única escrita foi este documento e o de continuidade.
