import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
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
  }, []);

  return (
    <ContextoDaConfig.Provider value={{ maintenance, configLoaded }}>
      {children}
    </ContextoDaConfig.Provider>
  );
}
