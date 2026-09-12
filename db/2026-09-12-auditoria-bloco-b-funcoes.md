# `[12/09]` BLOCO B — o corpo das funções que ESCREVEM

> Continuação dos blocos [A](2026-09-12-auditoria-profunda-bloco-a.md) e
> [A2](2026-09-12-auditoria-bloco-a2-anon-fechado.md).

## O método, e por que ele não é `grep`

Ordem do dono no pedido da auditoria: *"NÃO faça uma caça superficial por
palavras como SECURITY DEFINER, role, admin ou owner. Leia o fluxo completo."*

As 43 funções restantes foram **classificadas** por consulta (escrevem? qual
barreira?) só para decidir a **ordem de leitura** — a classificação é `grep` e
não vale como veredito. O que vale é o corpo lido.

| | escrevem | só leem |
| --- | --- | --- |
| barreira: só identidade (`auth.uid()`) | **4** | 3 |
| barreira: staff | 11 | 5 |
| barreira: super/owner | 13 | 6 |

**Este relatório cobre 9 das 43** — as 4 que escrevem com a barreira mais fraca,
e 5 das 11 de staff. As 34 restantes seguem no próximo bloco.

## As 4 que escrevem com só identidade

| Função | Veredito |
| --- | --- |
| `solicitar_revisao_do_proprio_ban` | ✅ **exemplar** — checa nulo, faixa de 20–1000 caracteres, se está de fato banido, e duplicata. É o modelo do §5 aplicado inteiro |
| `record_banned_login_attempt` | ✅ confere que o e-mail pedido é o **do próprio chamador** antes de gravar |
| `reset_login_attempts` | ✅ apaga só a linha do próprio e-mail |
| `delete_own_account` | 🟡 **ACHADO** — ver abaixo |

### 🟡 SEC-012 · apagar a conta é irreversível e NÃO pede a senha

O corpo inteiro é uma linha:

```sql
DELETE FROM auth.users WHERE id = auth.uid();
```

**O que está certo:** `id = auth.uid()` com `auth.uid()` NULL não casa com
ninguém, então sessão sem identidade não apaga nada. Não é o bug de `<>` com
NULL que o §5 descreve.

**O que está errado é a ausência.** A ação mais destrutiva e **irreversível** do
site inteiro acontece atrás de um `ConfirmModal` — validação de cliente, que o
§1.3 diz explicitamente não valer nada, porque a `anon key` permite chamar
`/rest/v1/rpc/delete_own_account` direto. Uma sessão deixada aberta num
computador alheio apaga a conta com **uma requisição**.

**E o projeto já tem a peça certa, usada no lugar menos grave.** O
`ResetDoCofre` — que redefine o código do cofre do Fundador, ação
**reversível** — confere a senha **no servidor** via
`confere_a_propria_senha`. A trava mais forte está na ação menos destrutiva.

**Solução:** `delete_own_account(p_senha text)` chamando
`confere_a_propria_senha` antes do `DELETE`, e a tela pedindo a senha. É o
padrão que já existe; não há mecanismo novo a inventar.

**NÃO EXECUTADO.** Muda o contrato de uma RPC e a tela (§7 🟡), e §7 🔴 manda
alertar antes em qualquer coisa que envolva perda de dado de usuário. Esperando
decisão.

## 5 das 11 que escrevem com barreira de staff

| Função | Veredito |
| --- | --- |
| `admin_delete_unconfirmed_user` | ✅ `role_rank >= 2`, e só apaga quem tem `confirmed_at IS NULL` — não alcança conta ativa. Loga |
| `admin_unlock_login` | ✅ `role_rank >= 3`. É a função que já teve o bug de barrar o próprio fundador; hoje `>= 3` inclui `owner` (rank 4) |
| `request_unban` | ✅ `is_staff()`, confere que o alvo está banido e que não há pedido pendente. Loga e notifica |
| `notify_owner` | 🔵 lista de papel à mão — ver abaixo |
| `notify_user` | 🟡 **ACHADO** — ver abaixo |

### 🟡 SEC-013 · `notify_user` manda qualquer coisa para qualquer um, sem rastro

```sql
IF role_rank((SELECT role FROM profiles WHERE id = auth.uid())) < 2 THEN
  RAISE EXCEPTION 'Access denied: admin required';
END IF;
INSERT INTO notifications (user_id, type, message) VALUES (p_user_id, p_type, p_message);
```

A barreira de cargo está correta. O que falta é tudo o mais:

| Falta | Consequência |
| --- | --- |
| **registro em `admin_logs`** | um admin manda mensagem a qualquer pessoa e **não fica rastro nenhum** |
| faixa em `p_message` (§5) | texto sem teto |
| lista fechada em `p_type` | tipo desconhecido cai no mapa de ícones da tela — a família do *fallback silencioso* (§4) |
| conferir se `p_user_id` existe | `INSERT` aceita uuid que não é ninguém |

**O impacto real, e ele NÃO é XSS.** Conferido: não existe
`dangerouslySetInnerHTML` em lugar nenhum do projeto, então a mensagem é
renderizada como texto. O que sobra é **engenharia social com a voz do sistema**
— *"sua conta foi comprometida, faça X"* chegando como notificação oficial — e,
pior, **sem trilha**. Toda a filosofia de auditoria deste projeto é que ação de
equipe deixa rastro; esta não deixa.

**Severidade 🟡 e não 🟠** porque exige cargo de admin, que é papel de confiança.
O defeito central é de **prestação de contas**, não de invasão.

### 🔵 Cinco funções ainda escrevem a hierarquia À MÃO

O `CLAUDE.md` é explícito: *"Hierarquia nunca se escreve à mão. Existe
`role_rank()`, `is_staff()` e `is_super()`. Lista literal é bug esperando
acontecer — foi assim três vezes."* Achei **cinco sobreviventes**:

| Função | O que está escrito | Inclui `owner`? |
| --- | --- | --- |
| `unban_user` | `NOT IN ('super_admin','owner')` | **sim** |
| `approve_unban_request` | `NOT IN ('super_admin','owner')` | **sim** |
| `deny_unban_request` | `NOT IN ('super_admin','owner')` | **sim** |
| `notify_owner` | `NOT IN ('admin','super_admin')` | **não** |
| `owner_get_stats` | `role IN ('admin','super_admin')` | é **contagem**, não guarda |

**E aqui eu tenho que ser preciso, porque a manchete seria enganosa.** As três
primeiras **funcionam hoje** — a lista inclui `owner`. Isto **não é** a falha de
14 policies de antes, que *omitiam* o `owner`. É o **padrão** que produziu
aquela falha, ainda vivo, sem nada impedindo a sexta ocorrência de errar.

- `notify_owner` exclui `owner`: o fundador não consegue mandar alerta **para o
  próprio owner**. O efeito prático é nulo (é avisar a si mesmo), mas é
  literalmente a mesma linha de código que causou as três quedas.
- `owner_get_stats` conta `role IN ('admin','super_admin')` — isso é uma
  **métrica**, não permissão. O painel do Fundador diz "N admins" **sem contar o
  fundador**. Pode ser proposital; é decisão de produto, não de segurança.

**Por que não corrigi agora:** trocar guarda de cinco funções é mudança de
comportamento em RPC sensível (§7 🟡), e o ganho hoje é higiene. O que **falta e
vale mais** é uma trava que reprove lista literal em `prosrc` — sem ela, esta
mesma seção reaparece na próxima auditoria.

## Cobertura declarada

| | |
| --- | --- |
| funções `SECURITY DEFINER` alcançáveis | **16 lidas por inteiro de 50** (7 no BLOCO A + 9 aqui) |
| das que ESCREVEM com barreira mais fraca | **4 de 4** |
| das que escrevem com barreira de staff | 5 de 11 |
| das que escrevem com barreira super/owner | **0 de 13** |
| listas de papel à mão | **5 de 5** enumeradas |

**Este bloco está PARCIAL, não concluído.** Faltam 34 funções.
