# Privacidade e LGPD — o que o GamerHub coleta, de verdade

> **O que é isto.** O mapa dos dados pessoais que o site coleta, medido na
> implementação real em 01/09/2026 — não em suposição sobre o que "um site como
> esse normalmente faz". Cada linha aqui foi verificada no código, no banco ou
> num navegador.
>
> **O que NÃO é.** Uma política de privacidade pronta para publicar, nem
> parecer jurídico. É o levantamento técnico que uma política precisaria ter
> como base.
>
> **A regra que guiou o levantamento**, pedida pelo dono: não inventar coleta,
> não inventar obrigação legal, e separar **obrigação** de **boa prática**. O
> que não deu para determinar pelo código está escrito como **A DEFINIR** — não
> preenchido de palpite.

---

## A resposta curta sobre cookies: o site não usa nenhum

Medido num navegador real, visitante na landing, sessão limpa:

```
COOKIES:          NENHUM
localStorage:     vazio
sessionStorage:   ["gh_intro_vista"]
terceiros:        fonts.googleapis.com
```

**Não existe banner de cookies a fazer**, porque não existem cookies. O
Supabase guarda a sessão em `localStorage`, não em cookie; a Vercel Analytics é
cookieless por construção.

Criar banner "porque todo site tem" seria pedir consentimento para algo que não
acontece — ruído sem função, e ruído ensina a ignorar avisos que importam.

---

## Como esta página não envelhece — a trava de crescimento

> Pedido do dono em 02/09: *"o site vai crescer mais, então a gente precisa que
> essa aba de políticas esteja sempre atualizada, sempre mesmo"*.

Promessa não sustenta isso: a política de ontem descreve o site de ontem. Duas
listas em `conteudoDaPrivacidade.js` são a versão **conferível** do que a página
afirma, e o teste as cruza com o código:

| Trava | Reprova quando |
| --- | --- |
| `CHAVES_DECLARADAS` | o código grava uma chave nova no navegador que a política não menciona |
| `TERCEIROS_DECLARADOS` | entra uma dependência que manda dado para fora sem a política dizer |
| varredura de `document.cookie` | alguém passa a usar cookie, e a página afirma que não há nenhum |

**Provadas por injeção:** uma chave `gh_rastreador_novo`, uma dependência
`posthog-js` e um `document.cookie =` — as três reprovaram nomeando o problema e
o que fazer antes de seguir.

O critério de "terceiro" é **manda alguma coisa para servidor de outra empresa**,
não "é biblioteca externa": o que anima ou formata não entra; o que faz uma
pessoa aparecer no registro de outra empresa, sim.

---

## O mapa dos dados

### O que fica no NAVEGADOR de quem usa

| Chave | O que é | Por quê | Quando some |
| --- | --- | --- | --- |
| `sb-*-auth-token` (localStorage) | token de sessão do Supabase | é o que mantém a pessoa logada | logout, ou expiração do token |
| `gh_intro_vista` (sessionStorage) | "já vi a abertura" | não repetir a intro a cada recarregamento | ao fechar o navegador |
| `gh_landing_3d` (localStorage) | preferência de cena 3D ligada/desligada | respeitar a escolha explícita da pessoa | só se ela limpar o navegador |
| `gh_pause_reason` (localStorage) | motivo da pausa do site | mostrar a explicação certa | ao voltar do ar |
| `gh_chunk_reload_at` (sessionStorage) | instante do último recarregamento automático | evitar laço de recarregamento | ao fechar o navegador |

Nenhuma delas identifica a pessoa, exceto o token de sessão — que é o que
autentica, e por isso existe.

### O que fica no BANCO

| Dado | Onde | Por quê | Necessário? | Risco |
| --- | --- | --- | --- | --- |
| e-mail | `auth.users` (Supabase Auth) | login e recuperação de senha | **sim** | alto se vazar — por isso não está em `profiles` e o anônimo leva 401 |
| senha | `auth.users`, como hash | idem | **sim** | o site nunca vê a senha em claro |
| `username`, `avatar_url`, `bio` | `profiles` | identidade pública na comunidade | sim | público por escolha de quem escreve |
| `birth_date` | `profiles` | calcular a idade | sim, com ressalva abaixo | **a data em si não é exposta** — o perfil público mostra só a idade |
| `state`, `platform`, `favorite_games`, `playstyle` | `profiles` | perfil gamer | **opcional** | preenchimento livre |
| `discord`, `twitch`, `youtube` | `profiles` | links de quem quiser | **opcional** | a pessoa decide expor |
| `banned`, `ban_reason`, `banned_by`, `suspended_until` | `profiles` | moderação e trilha de auditoria | sim | colunas revogadas do papel `authenticated` |
| e-mail + tentativas | `login_attempts` | barrar força bruta | sim | ver retenção abaixo |
| ações de moderação | `admin_logs` | trilha de auditoria | sim | ver retenção abaixo |

### Quem mais recebe alguma coisa

| Terceiro | O que recebe | Verificado |
| --- | --- | --- |
| **Supabase** | tudo acima; é o banco e o autenticador | — |
| **Vercel** | hospeda; recebe IP e user-agent nos logs de acesso, como todo servidor | inerente a estar no ar |
| **Vercel Analytics / Speed Insights** | métrica de página, **sem cookie** | montados no `App.jsx` |
| **Sentry** | erro + `{ id, username }` | lido em `monitoring.js`: **não manda e-mail** |
| **Google Fonts** | o IP de quem visita, ao baixar a fonte | único terceiro contactado na landing |

---

## Os achados, com severidade

### 🟡 A idade mínima de 13 anos existe SÓ no navegador

`RegisterForm.jsx` limita a data pelo atributo `max` do input. **O banco não
tem CHECK nenhum em `birth_date`** — conferido: existem CHECKs para `platform`,
`playstyle` e `role`, e nenhum para a data.

O site usa a `anon key`, então qualquer pessoa chama a REST API direto e
cadastra a data que quiser. É o caso clássico do §1.3: *validação no cliente não
vale nada sozinha*.

**Por que isso pesa mais do que uma regra de produto:** a LGPD trata dado de
criança e adolescente em artigo próprio, com exigência de consentimento
específico. O piso de idade deixa de ser só política do site.

**Estado hoje, medido:** 5 perfis, 2 com data preenchida, **nenhum** abaixo de
13 anos e nenhuma data absurda. Um CHECK entraria sem rejeitar linha existente.

**Não implementei** porque o número (13? 16? 18?) é decisão de produto e
jurídica, não minha. Está no backlog com a consulta de dimensionamento pronta.

### 🔵 `login_attempts` e `admin_logs` não têm política de retenção

As duas são append-only e guardam dado pessoal — e-mail numa, quem fez o quê na
outra. Sem retenção, elas crescem para sempre.

A LGPD fala em **necessidade** e **prazo**: guardar para sempre um registro de
tentativa de login de dois anos atrás é difícil de justificar. Já existe
infraestrutura de retenção em `lib/logMeta.js` para outras categorias — o que
falta é a decisão de prazo.

### 🔵 O Google Fonts entrega o IP do visitante ao Google

É o único terceiro que a landing contacta. Baixar fonte de servidor alheio
manda o IP junto, sempre.

**Alternativa que elimina isso:** hospedar as fontes no próprio site. Custa
alguns KB de banda e tira um terceiro do caminho. É boa prática, **não**
obrigação legal — e a distinção está aqui de propósito.

---

## O que está BEM feito, e merece registro

Auditoria só com achado ruim dá a impressão errada do estado real.

- **`profiles` não tem coluna de e-mail.** Ele mora no `auth`, fora do alcance
  da REST API pública.
- **O anônimo leva 401 em `profiles`, `posts`, `admin_logs` e
  `moderation_queue`** — verificado pelo portão `portas-do-banco.mjs`.
- **O Sentry recebe `id` e `username`, nunca e-mail.**
- **A data de nascimento não é exposta**: o perfil público mostra a idade
  calculada no banco, não a data.
- **Não há cookie nenhum**, então não há rastreamento a consentir.
- **Existe exclusão de conta** (`delete_own_account`), que é o direito de
  eliminação da LGPD implementado de fato.

---

## A DEFINIR — o que o código não responde

Nenhum destes se descobre lendo o projeto. Ficam em branco de propósito:

| Ponto | Por que depende do dono |
| --- | --- |
| Prazo de retenção de `login_attempts` e `admin_logs` | decisão de negócio |
| Idade mínima definitiva (13/16/18) | decisão de produto e jurídica |
| Quem é o controlador dos dados, e o canal de contato | dado pessoal dele |
| Base legal declarada de cada coleta | precisa de leitura jurídica |
| Se haverá política de privacidade publicada, e onde | há item de página no backlog |
