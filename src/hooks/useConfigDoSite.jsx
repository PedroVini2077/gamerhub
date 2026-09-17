import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth.jsx';
import { guardarMotivoDaPausa } from '../lib/pauseReason';

/**
 * A configuração global do site: modo manutenção e o motivo da pausa.
 *
 * ── Por que ele existe, e o bug que ele conserta ───────────────────────────
 *
 * Esta consulta vivia dentro do `Layout`. E o `Layout` **nunca monta na
 * landing** — ele só existe nas rotas internas e na raiz de quem está logado
 * com o banco de pé.
 *
 * Consequência, relatada pelo dono em 03/09: ele escreveu um motivo
 * personalizado no painel, viu a mensagem certa, e no celular a página mostrou
 * a **genérica**. Não era cache apagado (essa foi a minha primeira hipótese, e
 * a reprodução a desmentiu): era o motivo **nunca ter sido buscado** naquele
 * navegador, porque ele só passou pela landing.
 *
 * Aqui o hook é chamado no `AppRoutes`, que monta em **toda** rota. A landing
 * passa a aprender o motivo enquanto ainda há banco — que é exatamente a
 * janela em que dá para aprendê-lo.
 *
 * ── Uma consulta, duas chaves ──────────────────────────────────────────────
 *
 * `maintenance_mode` e `pause_reason` vêm juntas porque a segunda precisa ser
 * guardada **enquanto ainda há banco**: quando ele cair, não dá mais para lê-la
 * (ver `lib/pauseReason.js`). Ler as duas de uma vez não custa requisição
 * extra.
 *
 * ── O `error` NÃO é engolido, e isso muda o comportamento ──────────────────
 *
 * `const { data } = await supabase…` descarta o erro em silêncio, e o §4 proíbe.
 * Aqui a diferença é concreta: com o banco fora, `data` vem nulo — e tratar
 * isso como "a config é vazia" chamaria `guardarMotivoDaPausa(undefined)`, que
 * **APAGA** a cópia guardada. O app destruiria o motivo no exato instante em
 * que ele passa a ser útil.
 *
 * Então: falhou, não mexe em nada. O que estava guardado continua guardado.
 */
/**
 * ── Por que CONTEXTO, e não chamar o hook onde precisa ─────────────────────
 *
 * A primeira versão chamava o hook nos dois lugares que precisam do valor —
 * `AppRoutes` (para a landing aprender o motivo) e `Layout` (para decidir a
 * tela de manutenção). **Quebrou o site inteiro**, e o erro foi exato:
 *
 *     cannot add `postgres_changes` callbacks for realtime:config_do_site
 *     after `subscribe()`
 *
 * O Supabase reaproveita canal pelo NOME. Duas montagens criam o mesmo
 * `config_do_site`, e a segunda tenta registrar callback num canal já
 * assinado — estoura, e o `ErrorBoundary` mostra "Algo deu errado".
 *
 * Nomear os canais de forma diferente esconderia o problema em vez de
 * resolvê-lo: seriam duas assinaturas de realtime e duas consultas para a mesma
 * pergunta, pagas em egress (§6.1). Uma leitura, um canal, um provedor.
 */
const ContextoDaConfig = createContext({ maintenance: false, configLoaded: false });

/** Lê a config já carregada pelo provedor. Não faz consulta nenhuma. */
export function useConfigDoSite() {
  return useContext(ContextoDaConfig);
}

/** Onde a consulta acontece — UMA vez, no topo da árvore de rotas. */
export function ProvedorDaConfigDoSite({ children }) {
  const [maintenance, setMaintenance] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  // `[17/09]` Ver a seção "O CANAL é só de quem tem sessão", abaixo.
  const { user } = useAuth();

  // ── A LEITURA: para TODO MUNDO, inclusive quem nunca vai logar ────────────
  // Ela é o conserto de 03/09 e não pode ser condicionada a nada: é ela que faz
  // a landing aprender o `pause_reason` enquanto ainda há banco.
  useEffect(() => {
    let vivo = true;

    supabase.from('site_config').select('key, value')
      .in('key', ['maintenance_mode', 'pause_reason'])
      .then(({ data, error }) => {
        if (!vivo) return;

        if (error || !data) {
          // Sem banco não há o que aprender — e, principalmente, não há o que
          // ESQUECER. `configLoaded` fica falso de propósito: ele é a condição
          // de mostrar a tela de manutenção, e mostrá-la por causa de uma
          // consulta que falhou seria dizer "pausamos o site" quando o que
          // houve foi rede.
          return;
        }

        const porChave = Object.fromEntries(data.map(r => [r.key, r.value]));
        setMaintenance(porChave.maintenance_mode === 'true');
        guardarMotivoDaPausa(porChave.pause_reason);
        setConfigLoaded(true);
      });

    return () => { vivo = false; };
  }, []);

  /**
   * ── `[17/09]` O CANAL é só de quem tem SESSÃO ──────────────────────────────
   *
   * Até hoje **todo visitante anônimo da landing** abria uma conexão de realtime
   * — só para saber ao vivo se o site entrou em manutenção enquanto ele lia uma
   * página de apresentação.
   *
   * **Conexão de realtime é recurso contado por plano** (§0.2), e o custo cresce
   * com o número de visitantes, que é justamente o que a landing existe para
   * aumentar. É o pior formato de custo que este projeto pode ter: cresce com o
   * sucesso.
   *
   * ── O que se perde, dito antes de alguém notar ────────────────────────────
   *
   * Quem está na landing **deslogado** e o site entra em manutenção *durante* a
   * leitura não vê a tela mudar sozinha. Ele descobre ao clicar em entrar, ou ao
   * recarregar.
   *
   * Isso é aceitável e a razão é a assimetria de situação: quem está logado está
   * **no meio de alguma coisa** — escrevendo um post, num chat de live — e
   * merece o aviso ao vivo. Quem está lendo a apresentação não perde trabalho
   * nenhum.
   *
   * **O que NÃO se perde:** a landing continua sabendo do modo manutenção e do
   * motivo, porque a LEITURA acima é para todos. O que muda é só o *ao vivo*.
   *
   * ── Por que `user` e não uma flag de rota ─────────────────────────────────
   *
   * Amarrar a rota traria de volta o bug de 03/09 pela outra ponta: a pessoa
   * logada que está na `/` cairia fora do canal. `user` acompanha a sessão, e o
   * efeito reassina sozinho quando ela faz login — sem recarregar a página.
   */
  useEffect(() => {
    if (!user) return undefined;
    let vivo = true;

    const canal = supabase.channel('config_do_site')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'site_config' }, payload => {
        if (!vivo) return;
        if (payload.new?.key === 'maintenance_mode') {
          setMaintenance(payload.new.value === 'true');
        }
        // O motivo também chega por aqui: o dono edita o texto no painel e quem
        // já está com a página aberta passa a ter a cópia nova, sem recarregar.
        if (payload.new?.key === 'pause_reason') {
          guardarMotivoDaPausa(payload.new.value);
        }
      }).subscribe();

    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [user]);

  return (
    <ContextoDaConfig.Provider value={{ maintenance, configLoaded }}>
      {children}
    </ContextoDaConfig.Provider>
  );
}
