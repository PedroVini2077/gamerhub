import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ASSUNTOS, LIMITES } from './assuntosDeContato';
import { enviarMensagemDeContato } from '../../services/contatoService';

/**
 * O formulário público de contato.
 *
 * ── O que ele deliberadamente NÃO faz ───────────────────────────────────────
 *
 * Não consulta nada antes de enviar. Nem "esse e-mail tem conta?", nem "essa
 * pessoa está banida?". Um formulário que responde diferente conforme o
 * endereço informado é um ORÁCULO DE ENUMERAÇÃO: qualquer um descobriria quem
 * tem conta aqui e quem foi punido — dado de terceiro, exposto sem
 * consentimento. É a mesma razão pela qual a porta do banido leva ao login.
 *
 * Por isso a resposta de sucesso é sempre a mesma frase, e os dois limites de
 * vazão do banco devolvem a MESMA mensagem.
 */
export default function FormularioDeContato() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  // O erro mora na tela e não num toast: esta página é pública e pode ser a
  // primeira coisa que a pessoa abre. Toast some; o motivo de a mensagem não
  // ter ido precisa ficar (§1.5).
  const [erro, setErro] = useState(null);

  const faltam = LIMITES.mensagemMin - mensagem.trim().length;
  const podeEnviar = nome.trim().length >= LIMITES.nomeMin
    && email.trim().length > 0
    && !!assunto
    && faltam <= 0;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await enviarMensagemDeContato({ nome, email, assunto, mensagem });
    setEnviando(false);
    // A frase vem do banco, em português, e já diz qual dos limites foi. Um
    // "erro ao enviar" genérico faria a pessoa tentar de novo sem mudar nada.
    if (error) { setErro(error.message); return; }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="card p-6 space-y-3 text-center animate-fade-up">
        <CheckCircle2 size={26} className="text-neon-green mx-auto" />
        <p className="font-display text-lg text-neon-green">Mensagem enviada</p>
        <p className="text-sm font-body text-gray-400 leading-relaxed">
          A equipe recebeu e vai ler. A resposta chega no e-mail que você
          informou — pode levar alguns dias, e não temos atendimento imediato.
        </p>
        <p className="text-xs font-mono text-gray-600">
          Guarde uma cópia do que escreveu: por segurança, esta página não
          mostra as mensagens já enviadas.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="card p-5 md:p-6 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="contato-nome"
                 className="block text-xs text-gray-500 font-mono uppercase tracking-wider">
            Como podemos te chamar
          </label>
          <input
            id="contato-nome" value={nome} required
            maxLength={LIMITES.nomeMax}
            onChange={e => setNome(e.target.value)}
            className="input-gamer w-full text-sm"
            placeholder="Seu nome ou apelido"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="contato-email"
                 className="block text-xs text-gray-500 font-mono uppercase tracking-wider">
            E-mail para resposta
          </label>
          <input
            id="contato-email" type="email" value={email} required
            maxLength={LIMITES.emailMax}
            onChange={e => setEmail(e.target.value)}
            className="input-gamer w-full text-sm"
            placeholder="voce@exemplo.com"
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-2">
          Sobre o que é
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(ASSUNTOS).map(([valor, { rotulo, icone: Icone, cor }]) => (
            <label
              key={valor}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer
                          transition-colors ${assunto === valor
                            ? 'border-neon-green/50 bg-neon-green/5'
                            : 'border-dark-500 hover:border-dark-400'}`}
            >
              <input
                type="radio" name="assunto" value={valor}
                checked={assunto === valor}
                onChange={() => setAssunto(valor)}
                className="sr-only"
              />
              <Icone size={15} className={cor} />
              <span className="text-xs font-mono text-gray-300">{rotulo}</span>
            </label>
          ))}
        </div>
        {ASSUNTOS[assunto]?.dica && (
          <p className="text-xs font-mono text-gray-500 leading-relaxed pt-1">
            {ASSUNTOS[assunto].dica}
          </p>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="contato-mensagem"
               className="block text-xs text-gray-500 font-mono uppercase tracking-wider">
          O que aconteceu
        </label>
        <textarea
          id="contato-mensagem" rows={6} value={mensagem}
          onChange={e => setMensagem(e.target.value.slice(0, LIMITES.mensagemMax))}
          className="input-gamer w-full text-sm font-body leading-relaxed resize-none"
          placeholder="Conte tudo de uma vez: o que aconteceu, quando, e o nome de usuário envolvido se houver."
        />
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-600">
          <span>{faltam > 0 ? `faltam ${faltam} caracteres` : 'pode enviar'}</span>
          <span translate="no" className="notranslate tabular-nums">
            {mensagem.length}/{LIMITES.mensagemMax}
          </span>
        </div>
      </div>

      {erro && (
        <div role="alert"
             className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-red-300 leading-relaxed">{erro}</p>
        </div>
      )}

      <p className="text-[11px] font-mono text-gray-600 leading-relaxed">
        O que você escrever aqui, junto do nome e do e-mail, fica guardado para
        a equipe conseguir responder. Nada disso vai para anúncio nem para
        terceiro — o que guardamos e por quanto tempo está na{' '}
        <Link to="/privacidade" className="text-neon-green hover:underline">
          política de privacidade
        </Link>.
      </p>

      <button
        type="submit"
        disabled={enviando || !podeEnviar}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-mono font-bold
                   rounded border border-neon-green/30 text-neon-green hover:bg-neon-green/10
                   transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {enviando
          ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
          : <><Send size={15} /> Enviar mensagem</>}
      </button>
    </form>
  );
}
