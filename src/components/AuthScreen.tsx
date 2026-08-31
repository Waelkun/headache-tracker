import { useEffect, useState } from 'react'
import { ArrowLeft, Brain, Check, Languages, Mail, MailCheck, Moon, Sun } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Locale } from '../lib/i18n'

type Props = {
  locale: Locale
  theme: 'light' | 'dark'
  onLocaleChange: (locale: Locale) => void
  onThemeChange: (theme: 'light' | 'dark') => void
  onDemo: () => void
}

export function AuthScreen({ locale, theme, onLocaleChange, onThemeChange, onDemo }: Props) {
  const ar = locale === 'ar'
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'sent'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.get('error_description')) return
    setMessage(ar
      ? 'ما اكتمل تسجيل Google. تم إصلاح الإعدادات، جرّب مرة ثانية.'
      : 'Google sign-in did not finish. The settings were fixed; please try again.')
    window.history.replaceState({}, document.title, window.location.pathname)
  }, [ar])

  async function googleSignIn() {
    setBusy(true)
    setMessage('')
    localStorage.removeItem('headache-demo')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) setMessage(error.message)
    setBusy(false)
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    })
    if (error) setMessage(error.message)
    else setStep('sent')
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-tools">
        <button className="auth-language" type="button" onClick={() => onLocaleChange(ar ? 'en' : 'ar')}><Languages size={18} /> {ar ? 'English' : 'العربية'}</button>
        <button className="icon-button" type="button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? (ar ? 'استخدم الوضع الفاتح' : 'Use light mode') : (ar ? 'استخدم الوضع الداكن' : 'Use dark mode')} aria-pressed={theme === 'dark'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand"><Brain size={26} /></div>
        <p className="eyebrow">{ar ? 'متتبّع الصداع' : 'HEADACHE TRACKER'}</p>
        <h1 id="auth-title">{ar ? 'افهم وجع راسك، نوبة بنوبة.' : 'Understand your headaches, one episode at a time.'}</h1>
        <p className="auth-lede">{ar ? 'سجّل بسرعة، شوف الأنماط، وخد تقرير واضح لدكتورك.' : 'Log quickly, spot patterns, and bring a clear report to your doctor.'}</p>

        <div className="privacy-row">
          <Check size={17} />
          <span>{ar ? 'بياناتك خاصة ومحميّة بحسابك' : 'Your data stays private to your account'}</span>
        </div>

        <button className="google-button" type="button" onClick={googleSignIn} disabled={busy}>
          <span className="google-g">G</span>
          {ar ? 'المتابعة باستخدام Google' : 'Continue with Google'}
        </button>

        <div className="or-divider"><span>{ar ? 'أو' : 'or'}</span></div>

        {step === 'email' ? (
          <form onSubmit={sendLink} className="auth-form">
            <label htmlFor="email">{ar ? 'البريد الإلكتروني' : 'Email address'}</label>
            <div className="input-with-icon"><Mail size={18} /><input id="email" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></div>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? (ar ? 'عم نبعث…' : 'Sending…') : (ar ? 'ابعث رابط الدخول' : 'Send sign-in link')}</button>
          </form>
        ) : (
          <div className="auth-sent">
            <div className="auth-sent-icon"><MailCheck size={26} /></div>
            <h2>{ar ? 'تفقّد بريدك' : 'Check your inbox'}</h2>
            <p>{ar ? 'بعتنالك رابط تأكيد على' : 'We sent a confirmation link to'} <strong dir="ltr">{email}</strong>. {ar ? 'افتحه من نفس الجهاز حتى تسجّل دخولك.' : 'Open it on this device to sign in.'}</p>
            <div className="auth-sent-actions">
              <button className="secondary-button" type="button" onClick={sendLink} disabled={busy}>{busy ? (ar ? 'عم نبعث…' : 'Sending…') : (ar ? 'ابعث الرابط من جديد' : 'Resend link')}</button>
              <button className="back-link" type="button" onClick={() => { setStep('email'); setMessage('') }}><ArrowLeft size={16} /> {ar ? 'غيّر الإيميل' : 'Change email'}</button>
            </div>
          </div>
        )}
        {message && <p className="form-message" role="status">{message}</p>}
        <div className="demo-divider" />
        <button className="demo-button" type="button" onClick={onDemo}>
          {ar ? 'استعمل التطبيق بدون تسجيل' : 'Use without signing in'}
          <span>{ar ? 'بياناتك بتنحفظ على هالجهاز بس' : 'Your data is saved on this device only'}</span>
        </button>
        <p className="medical-note">{ar ? 'هذا التطبيق للتتبّع ولا يشخّص الحالات الطبية.' : 'This tracker does not diagnose medical conditions.'}</p>
      </section>
    </main>
  )
}
