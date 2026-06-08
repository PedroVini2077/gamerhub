import { Mail, ArrowLeft } from 'lucide-react';

// Tela persistente exibida após o cadastro — substitui o formulário (em vez de
// um toast que some em segundos) pra deixar claro que falta confirmar o email,
// e avisa sobre o efeito colateral de pedir o email de novo: cada novo envio
// invalida o link anterior, então o usuário deve sempre usar o mais recente.
export default function RegisterSuccess({ email, onBackToLogin }) {
  return (
    <div className="text-center py-2">
      <div className="w-14 h-14 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-5">
        <Mail size={26} className="text-neon-green" style={{ filter: 'drop-shadow(0 0 8px #39ff14)' }} />
      </div>

      <p className="text-white font-display text-sm tracking-widest uppercase mb-2">Verifique seu email</p>
      <p className="text-gray-400 font-mono text-xs leading-relaxed">Enviamos um link de confirmação para</p>
      <p className="text-neon-green font-mono text-xs mt-1 mb-5 break-all">{email}</p>

      <p className="text-gray-500 font-mono text-xs leading-relaxed mb-6">
        Não chegou? Confira a caixa de spam. Se pedir o email de novo, use sempre o link do envio
        mais recente — pedir um novo invalida o anterior.
      </p>

      <button onClick={onBackToLogin}
        className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-neon-green transition-colors">
        <ArrowLeft size={14} /> Voltar para o login
      </button>
    </div>
  );
}
