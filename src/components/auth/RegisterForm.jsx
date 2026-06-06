import { Mail, Lock, User, Calendar, MapPin, Gamepad2 } from 'lucide-react';
import { InputWrap } from './InputWrap';
import { getPasswordStrength, STRENGTH_LABELS, STRENGTH_COLORS } from '../../lib/password';

const BR_STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const PLATFORMS = ['PC','PlayStation','Xbox','Mobile','Switch','Multi'];
const maxBirthDate = new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function RegisterForm({
  email, setEmail, password, setPassword,
  confirmPassword, setConfirmPassword,
  username, setUsername,
  birthDate, setBirthDate,
  uf, setUf,
  selectedPlatform, setSelectedPlatform,
  loading, onSubmit, onSwitchToLogin,
}) {
  const passwordStrength = getPasswordStrength(password);

  return (
    <>
      <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
        <button type="button" onClick={onSwitchToLogin}
          className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase text-gray-500 hover:text-gray-300">
          Entrar
        </button>
        <button type="button" className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase bg-neon-green/10 text-neon-green">
          Registrar
        </button>
      </div>

      <div className="space-y-4">
        {/* Username */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Username</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><User size={14} /></span>
            <input id="username" aria-label="Nome de usuário"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="seu_nick_aqui" value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              maxLength={20} />
          </InputWrap>
          <p className="text-xs text-gray-600 font-mono mt-1">3-20 chars · letras minúsculas, números e _</p>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
            <input id="email-register" aria-label="Email" type="email"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="gamer@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
        </div>

        {/* Senha */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Senha</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
            <input id="password-register" aria-label="Senha" type="password"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
          <div className="mt-2 flex items-center gap-2" style={{ visibility: password ? 'visible' : 'hidden' }}>
            <div className="flex gap-1 flex-1">
              {[1,2,3,4].map(n => (
                <div key={n} className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{ background: n <= passwordStrength ? STRENGTH_COLORS[passwordStrength] : '#2e2e3e' }} />
              ))}
            </div>
            <span className="text-xs font-mono w-16 text-right"
              style={{ color: STRENGTH_COLORS[passwordStrength] || '#6b7280' }}>
              {STRENGTH_LABELS[passwordStrength]}
            </span>
          </div>
          <p className="text-xs text-gray-600 font-mono mt-1">mínimo 8 caracteres</p>
        </div>

        {/* Confirmar Senha */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Confirmar Senha</label>
          <div className={`flex items-center bg-dark-700 border rounded-md transition-all ${
            confirmPassword && confirmPassword !== password
              ? 'border-red-400/60'
              : 'border-dark-400 focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420]'
          }`}>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Lock size={14} /></span>
            <input aria-label="Confirmar senha" type="password"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="••••••••" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </div>
          <p className="text-xs font-mono mt-1" style={{
            color: '#f87171',
            visibility: confirmPassword && confirmPassword !== password ? 'visible' : 'hidden'
          }}>Senhas não coincidem</p>
        </div>

        {/* Data de Nascimento */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
            Data de Nascimento <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Calendar size={14} /></span>
            <input aria-label="Data de nascimento" type="date"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white outline-none font-body"
              value={birthDate} onChange={e => setBirthDate(e.target.value)}
              max={maxBirthDate} />
          </div>
          <p className="text-xs text-gray-600 font-mono mt-1">Exigido pela LGPD · mínimo 13 anos</p>
        </div>

        {/* Estado (opcional) */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">
            Estado <span className="text-gray-600 normal-case">(opcional)</span>
          </label>
          <div className="flex items-center bg-dark-700 border border-dark-400 rounded-md focus-within:border-neon-green focus-within:shadow-[0_0_0_2px_#39ff1420] transition-all">
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><MapPin size={14} /></span>
            <select aria-label="Estado" value={uf} onChange={e => setUf(e.target.value)}
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white outline-none font-body appearance-none">
              <option value="" className="bg-dark-800">Selecione seu estado...</option>
              {BR_STATES.map(s => <option key={s} value={s} className="bg-dark-800">{s}</option>)}
            </select>
          </div>
        </div>

        {/* Plataforma (opcional) */}
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-2 uppercase tracking-wider">
            Plataforma Principal <span className="text-gray-600 normal-case">(opcional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map(p => (
              <button key={p} type="button"
                onClick={() => setSelectedPlatform(selectedPlatform === p ? '' : p)}
                className={`tag cursor-pointer transition-all flex items-center gap-1 ${
                  selectedPlatform === p ? 'tag-green' : 'tag-purple opacity-50 hover:opacity-100'
                }`}>
                <Gamepad2 size={10} />{p}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onSubmit} disabled={loading}
          className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Aguarde...' : '// CRIAR CONTA'}
        </button>
      </div>
    </>
  );
}
