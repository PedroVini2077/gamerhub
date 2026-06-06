import { ArrowLeft, Mail } from 'lucide-react';
import { InputWrap } from './InputWrap';

export default function ForgotForm({ email, setEmail, loading, onSubmit, onBack }) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBack}
          className="text-gray-500 hover:text-neon-green transition-colors">
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs font-display text-gray-300 tracking-widest uppercase">Recuperar Senha</span>
      </div>

      <div className="space-y-4">
        <p className="text-xs text-gray-400 font-mono leading-relaxed">
          Informe seu email cadastrado e enviaremos um link para redefinir sua senha.
        </p>

        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
            <input id="email" aria-label="Email" type="email"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="gamer@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
        </div>

        <button onClick={onSubmit} disabled={loading}
          className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Aguarde...' : '// ENVIAR LINK DE RECUPERAÇÃO'}
        </button>
      </div>
    </>
  );
}
