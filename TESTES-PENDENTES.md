# Testes pendentes

> Lista viva do que **eu não consigo testar daqui** e depende do dono abrir o
> site. Atualizada ao fim de cada sessão.
>
> Por que existe: o navegador deste ambiente não alcança o `supabase.co`, então
> tudo que é autenticado eu provo assumindo o papel no SQL (`BEGIN … ROLLBACK`),
> não clicando na tela. As duas coisas não são a mesma — e essa diferença já
> quase me fez reportar dois bugs que não existiam.
>
> O `BACKLOG.md` guarda o que é dívida de verdade. Aqui é só checklist.

Última atualização: **23/08/2026**

---

## Confirmado funcionando (não precisa refazer)

- [x] Entrar e sair da conta
- [x] Criar post, comentário, mural e mensagem de chat
- [x] Editar perfil
- [x] Silenciar usuário na live · encerrar live · fazer a live voltar
- [x] Encerrar live pelo painel admin
- [x] Post de bullying sem palavrão (`Você é um lixo…`) → some pela IA
- [x] Termo pesado no chat da live → **recusado** no envio
- [x] Termo bloqueado em comentário → cai na fila com a prévia certa
- [x] Rejeitar / dispensar item da fila
- [x] Preferência de notificação (gravar, ler de volta, ser respeitada)
- [x] Keys e promos aparecem · abas do admin aparecem · logs aparecem

---

## Falta testar

### Corrigido nesta sessão, ainda sem confirmação sua

- [ ] **Mural: `Se matem otários`** → agora tem que **sumir na hora** e ir pra
      fila. Era o caso do print: passava inteiro porque a lista casava só
      palavra exata (`otário` não casava `otários`).
- [ ] **Plural em geral** — `seus idiotas` num post deve cair na fila.
- [ ] **Falso positivo** — `passei de fase, que jogo massa` e
      `os cues sonoros do jogo` **não** podem ser tocados.
- [ ] **Pedido de desban chegando sem recarregar a página** — a tabela não
      estava publicada no realtime, a assinatura nunca recebia evento.
- [ ] **Apagar mensagem de chat pelo painel** duas vezes seguidas — na segunda
      não pode mais aparecer "você não tem permissão".

### Nunca testado

- [ ] **Upload de foto de perfil** — consertei há duas sessões e você nunca
      voltou nele. É o que eu mais quero saber.
- [ ] **Sino de notificação** — procurar a frase
      "Seu post foi ocultado pela moderação".
- [ ] **Imagem imprópria** — baixar "Limite — imagem" na aba Site do Owner para
      `0.05`, postar uma foto de praia, conferir que foi ocultada, **e voltar
      para 0.85**. Referência: imagem comum pontua 0.001.
- [ ] **Banir pela fila de moderação** (botão Banir no card).
- [ ] **Suspensão** — marcar "Suspender 1 dia" ao aprovar um item e conferir
      que o usuário (a) não consegue mais publicar e (b) recebe a notificação
      com o prazo.
- [ ] **Realtime do chat** — com duas contas abertas: mensagem nova aparece
      sozinha? mensagem apagada some da tela da outra pessoa? *(São causas
      diferentes; preciso saber qual das duas falha.)*

---

## Sabidamente NÃO implementado (não é bug, não teste)

- Curtidas e comentários **não** atualizam em tempo real — decisão de custo,
  ver `lib/realtimeTables.js`. A tela revalida ao voltar o foco.
- Quando a IA oculta sozinha, o autor **não** recebe aviso nenhum. Está no
  backlog como buraco a fechar.
- Aprovar item na fila **sem marcar ação** não gera ponto. Também no backlog.
- Moderação de imagem só cobre pornografia — não pega sangue nem gore. Plano
  de ampliação registrado no backlog.
