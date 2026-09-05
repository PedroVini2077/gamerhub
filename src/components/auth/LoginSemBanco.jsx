import { DatabaseZap, RotateCw } from 'lucide-react';

/**
 * O que a tela de login mostra enquanto o banco está fora do ar.
 *
 * ── Por que não simplesmente deixar o formulário ali ────────────────────────
 *
 * Porque entrar e criar conta passam os dois pelo servidor de autenticação da
 * Supabase, que cai junto com o resto do projeto quando ele é pausado. Deixar
 * o formulário seria oferecer um botão que não pode funcionar — e o erro que
 * volta de um `fetch` que não completa não distingue "senha errada" de "o site
 * está fora do ar". Mandar alguém desconfiar da própria senha por causa de uma
 * pausa do projeto é a mensagem falsa que o §1.5 proíbe.
 *
 * ── Por que a tela continua existindo, em vez de barrar a rota ──────────────
 *
 * Barrar seria repetir o bug que este arquivo nasceu para consertar: quem tem
 * sessão salva ficava girando entre `/` e `/login` sem nunca ver uma
 * explicação. Aqui a pessoa chega, lê o motivo, e sabe que o problema não é
 * dela.
 *
 * Ela some sozinha: o `dbHealth` sonda a cada 20 s e, quando o banco responde,
 * `semBanco` vira falso e o formulário volta — com o que já tinha sido
 * digitado, porque o estado do formulário mora no `Login.jsx` e não aqui.
 */
export default function LoginSemBanco() {
  return (
    <div className="text-center">
      <DatabaseZap size={30} className="mx-auto mb-4 text-yellow-400" />
      <h2 className="font-display text-lg text-white mb-2">
        Entrar está indisponível agora
      </h2>
      <p className="font-mono text-xs text-gray-400 leading-relaxed">
        O site está sem conexão com o banco de dados, e tanto o login quanto o
        cadastro dependem dele. Não é a sua senha — e não é preciso fazer nada:
        assim que o banco responder, esta tela volta ao normal sozinha.
      </p>
      <p className="mt-5 flex items-center justify-center gap-2 font-mono text-[11px] text-gray-500">
        <RotateCw size={12} className="animate-spin" />
        Tentando de novo a cada 20 segundos
      </p>
    </div>
  );
}
