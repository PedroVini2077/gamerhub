import { useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import ReasonModal from '../ui/ReasonModal';
import { pedirReativacaoDaLive } from '../../services/liveService';

/**
 * `[18/09]` LIVE-038/041 — o botão que fecha o ciclo da live.
 *
 * ── Por que ele precisa existir ───────────────────────────────────────────
 *
 * A LIVE-038 tirou do usuário comum o poder de reativar a própria live, e isso
 * estava certo: reativar em laço gerava notificação para todos os admins sem
 * teto. Mas tirar o poder **sem dar a porta** transformaria um engano de clique
 * numa live perdida para sempre — e o dono foi explícito ao aprovar: *"no caso
 * o usuário vai ter como pedir pra reativar a live?"*.
 *
 * ── A janela é CURTA, e é por isso que ele aparece em dois lugares ────────
 *
 * O cron `expire-lives` APAGA a live 15 minutos depois de encerrada. O autor
 * tem esses 15 minutos para pedir — depois disso não há o que reativar.
 *
 * Por isso este componente aparece **na hora** (no painel "Live encerrada" da
 * própria página de lives) e **depois** (no card do feed), em vez de só no
 * segundo. Um componente só, usado nos dois: duas cópias divergiriam (§4).
 *
 * Assim que o pedido entra, o cron para de apagar aquele post — a cláusula
 * `NOT EXISTS (... status = 'pending')` da LIVE-038 existe exatamente para a
 * porta não ser decorativa.
 *
 * ── O que esta tela NÃO sabe, e não finge saber ───────────────────────────
 *
 * Se já existe um pedido pendente. `live_reactivation_requests` é fechada para
 * `authenticated`, então a resposta só vem no clique — e a mensagem que aparece
 * é a do banco, que já é escrita em português para o usuário final.
 *
 * `enviado` guarda só o que ESTA tela fez nesta sessão. Ele não é a verdade
 * sobre o pedido; é a confirmação do clique, e some ao recarregar.
 */
export default function PedirReativacaoDaLive({ postId, titulo }) {
  const [aberto, setAberto] = useState(false);
  const [enviado, setEnviado] = useState(false);

  if (enviado) return (
    <p className="mt-3 text-xs font-mono text-neon-green/80 flex items-center justify-center gap-1.5">
      <Check size={12} /> Pedido enviado — a equipe vai responder.
    </p>
  );

  return (
    <>
      <button type="button" onClick={() => setAberto(true)}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-dark-400 text-gray-400 text-xs font-mono hover:border-neon-green/50 hover:text-neon-green transition-all">
        <RotateCcw size={12} /> Pedir reativação
      </button>

      {aberto && (
        <ReasonModal
          title="Pedir reativação"
          icon={RotateCcw}
          accent="green"
          subtitle={'A equipe decide se "' + titulo + '" volta ao ar. Enquanto o pedido estiver '
            + 'em análise, a live não é apagada.'}
          label="Por que ela deve voltar?"
          placeholder="Ex: encerrei sem querer, a transmissão continua rolando no canal..."
          required
          confirmLabel="Enviar pedido"
          confirmIcon={RotateCcw}
          onConfirm={async (motivo) => {
            // A RPC exige 10 caracteres. Barrar aqui também é para a pessoa não
            // gastar um clique — a regra que VALE continua sendo a do banco.
            if (motivo.trim().length < 10) {
              toast.error('Escreva pelo menos 10 caracteres explicando o pedido.');
              return;
            }
            const { error } = await pedirReativacaoDaLive(postId, motivo.trim());
            if (error) { toast.error(error.message); return; }
            toast.success('Pedido enviado para a equipe.');
            // Sem `logAudit` aqui de propósito. Quem grava a trilha é a RPC
            // (LIVE-042), na MESMA transação do pedido: ou os dois existem, ou
            // nenhum. Um registro feito daqui podia ser recusado pelo banco e
            // `logAudit` engole o erro (§1.5) — foi exatamente isso que a trava
            // `trilhaNaoEhForjavel` pegou, e foi ao investigar o porquê que
            // apareceu o buraco de verdade: a RPC não deixava rastro nenhum.
            setEnviado(true);
            setAberto(false);
          }}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
