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
