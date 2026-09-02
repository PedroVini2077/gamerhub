# `[02/09]` Canal de contato público — falar com a administração de fora do site

> Pedido do dono: *"nós precisamos de uma maneira dos usuários falarem com a
> administração de fora do site, nem que seja por formulário, mas faça o que
> for melhor"*.

Migrations aplicadas: `canal_de_contato_publico` e
`fechar_trigger_de_enchente_para_anon`.

---

## O buraco que existia

Antes disto, **não havia via nenhuma** para falar com a equipe sem estar
logado. O que parecia cobrir o caso, e não cobria:

| O que existia | Quem ele NÃO atende |
| --- | --- |
| Pedido de revisão na `BannedScreen` | quem não consegue mais entrar |
| "Conta bloqueada?" no rodapé → `/login` | quem perdeu o acesso ou o e-mail |
| Botão de denúncia em cada post | quem nem tem conta |
| — | quem quer exercer um direito de LGPD sobre os próprios dados |

A última linha é a mais séria: a política de privacidade promete acesso,
correção e exclusão de dados, e **não existia endereço para pedir nenhum dos
três**. Promessa sem canal é promessa que não se cumpre.

---

## Por que uma tabela, e não um e-mail

Três razões, e nenhuma é preferência de arquitetura:

1. **`mailto:` no HTML vira alvo de robô de spam**, e o dono já pediu para
   *"tirar tudo o que é realmente meu desse site"*.
2. **E-mail não deixa rastro do lado de cá.** Ninguém sabe se foi respondido,
   quantas chegaram, ou se o canal parou de funcionar.
3. **Mandar por `send-email` queimaria a cota do Gmail** (~500/dia), que é a
   **mesma** cota do cadastro e da recuperação de senha (§0.2). Um robô
   enchendo o formulário derrubaria o cadastro do site inteiro — o formulário
   de contato viraria a arma contra o site.

---

## O desenho

```sql
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  handled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_by_username text,
  handled_at timestamptz,
  internal_note text,
  CONSTRAINT contact_messages_subject_check
    CHECK (subject IN ('banimento','conta','bug','denuncia','privacidade','outro')),
  CONSTRAINT contact_messages_status_check
    CHECK (status IN ('new','read','answered','spam'))
);
```

**Não existe policy de INSERT nesta tabela, e isso é o desenho.** A única porta
de entrada é a RPC `enviar_mensagem_de_contato`. Com policy de INSERT, qualquer
um com a anon key — que é pública por construção — faria `POST` direto em
`/rest/v1/contact_messages` e pularia **toda** a validação e **todo** o limite
de vazão (§1.3: validação no cliente não vale nada sozinha).

`ON DELETE SET NULL` e não `CASCADE`: apagar a conta não pode apagar a conversa
que a equipe teve com ela.

**Existe policy de UPDATE** de propósito. Tabela sem policy de UPDATE nega em
silêncio — 0 linhas, nenhum erro — e o painel diria "marcado como respondido"
sem marcar nada. Foi assim que a moderação de comentário ficou quebrada por
meses.

---

## Os dois limites de vazão, e por que devolvem a MESMA frase

| Limite | Valor | Protege de |
| --- | --- | --- |
| Por remetente | 3 mensagens / 24 h | a mesma pessoa insistindo |
| Global (disjuntor) | 60 mensagens / hora | robô enchendo a tabela |

As duas recusas devolvem **exatamente** `"Muitas mensagens enviadas
recentemente. Tente novamente mais tarde."`, e isso não é preguiça: se o teto
por e-mail dissesse *"você já mandou 3"*, bastaria tentar com o endereço de
outra pessoa para descobrir que ela procurou a administração. Seria um
**oráculo de enumeração** — a mesma armadilha que faz a porta do banido levar
ao login em vez de perguntar o e-mail.

**O que estes limites NÃO cobrem, dito com todas as letras:** um robô com
muitos endereços diferentes ainda consegue encher a hora e fechar o canal para
todo mundo. Fechar isso de verdade pediria captcha (Turnstile), que exige Edge
Function e mais uma cota. No volume de hoje o disjuntor mais o alarme são a
resposta proporcional; se um dia tocar, o caminho está escrito.

---

## O alarme, e o erro que só o teste em ROLLBACK pegou

A primeira versão gravava o alarme de enchente em `admin_logs` **dentro da
RPC**, logo antes do `RAISE EXCEPTION` do disjuntor.

**Não funciona.** O `RAISE` desfaz tudo que a função fez, inclusive o log. O
teste em transação mediu: `9_alarme_gritou → FALHOU: 0 linhas`.

Era o §1.5 no código escrito **para cumprir** o §1.5 — um alarme decorativo,
que teria ficado calado exatamente no dia em que fosse necessário. Só apareceu
porque o teste conferia o alarme, e não só o bloqueio.

A correção move o alarme para um trigger `AFTER INSERT`
(`alertar_enchente_de_contato`), onde ele viaja junto de um INSERT que **dá
certo** — a 60ª mensagem, a que fecha a porta atrás de si — e portanto commita.
É também a forma de classe (§5): qualquer caminho que insira mensagem dispara
o alarme, não só o que eu me lembrei de instrumentar.

Uma linha por episódio, não uma por tentativa: alarme que grita a cada
requisição de uma enchente **é** a enchente, do lado de dentro (§0.2, 4ª regra).

---

## Os 14 testes em `ROLLBACK`

Rodados em duas transações, nas duas direções — o que tem que fechar **e** o
que tem que continuar aberto (§1.3: três correções de segurança já derrubaram
o site por só testarem um lado).

| # | O que testa | Resultado |
| --- | --- | --- |
| 1 | anon consegue enviar pela RPC | OK |
| 2 | anon **não** insere direto na tabela | OK: bloqueado |
| 3 | anon **não** lê a tabela | OK: bloqueado |
| 4 | mensagem com menos de 20 caracteres | OK: recusada |
| 5 | assunto fora da lista fechada | OK: recusado |
| 6 | e-mail malformado | OK: recusado |
| 7 | 4ª mensagem do mesmo e-mail em 24 h | OK: recusada |
| a | as 59 primeiras da hora passam | OK |
| b | alarme **calado** em 59 (não grita à toa) | OK |
| c | a 60ª entra | OK |
| d | alarme gritou: 1 linha em `admin_logs` | OK |
| e | a 61ª é recusada pelo disjuntor | OK |
| f | alarme **não repete** na 61ª (fadiga) | OK |
| 11 | usuário comum autenticado não lê | OK: 0 linhas |
| 12 | usuário comum autenticado não altera | OK: 0 linhas |
| 13 | **staff LÊ** as mensagens | OK |
| 14 | **staff ALTERA** o status | OK |

---

## O que ficou de fora, e por quê

- **Responder por dentro do painel.** Exigiria `send-email`, e portanto a cota
  do Gmail. Hoje a equipe responde do próprio e-mail. Está no `BACKLOG.md`.
- **Captcha.** Ver acima.
- **Retenção automática.** `contact_messages` é append-only e vai crescer.
  Entrou no `BACKLOG.md` junto do prazo, que é decisão de produto — apagar
  conversa de moderação cedo demais atrapalha a própria moderação.
