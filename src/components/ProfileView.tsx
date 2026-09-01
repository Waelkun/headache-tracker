import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, Languages, LogOut, Moon, Save, Sun, User } from 'lucide-react'
import type { Locale } from '../lib/i18n'

type Theme = 'light' | 'dark'

export function ProfileView({
  locale, theme, session, demoMode, storedName, avatarUrl,
  onSaveName, onLocaleChange, onThemeChange, onLogout, onBack,
}: {
  locale: Locale
  theme: Theme
  session: Session | null
  demoMode: boolean
  storedName: string | null
  avatarUrl?: string
  onSaveName: (name: string) => Promise<void>
  onLocaleChange: (next: Locale) => void
  onThemeChange: (next: Theme) => void
  onLogout: () => void
  onBack: () => void
}) {
  const ar = locale === 'ar'
  const metaName = (session?.user.user_metadata.full_name as string | undefined) ?? (session?.user.user_metadata.name as string | undefined)
  const initialName = storedName ?? metaName ?? ''
  const email = demoMode ? (ar ? 'وضع التجربة' : 'Demo mode') : session?.user.email ?? ''
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setName(initialName) }, [initialName])

  const dirty = name.trim() !== initialName.trim()

  async function handleSave() {
    if (!dirty || !name.trim()) return
    setSaving(true)
    setSaved(false)
    await onSaveName(name.trim())
    setSaving(false)
    setSaved(true)
  }

  return <section className="page-stack profile-page">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={18} />{ar ? 'رجوع' : 'Back'}</button>

    <div className="page-title-row"><div><p className="eyebrow">{ar ? 'الحساب' : 'ACCOUNT'}</p><h2>{ar ? 'الملف الشخصي' : 'Profile'}</h2></div><User size={28} /></div>

    <section className="card profile-avatar-card">
      <div className="profile-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <User size={40} />}</div>
      <div><strong>{name.trim() || (ar ? 'بدون اسم' : 'No name yet')}</strong><span>{email}</span></div>
    </section>

    {!demoMode && <section className="card profile-form">
      <label className="profile-field">
        <span>{ar ? 'الاسم المعروض' : 'Display name'}</span>
        <input type="text" value={name} onChange={(event) => { setName(event.target.value); setSaved(false) }} placeholder={ar ? 'اكتب اسمك' : 'Your name'} maxLength={80} />
      </label>
      <label className="profile-field">
        <span>{ar ? 'البريد الإلكتروني' : 'Email'}</span>
        <input type="email" value={email} readOnly disabled />
      </label>
      <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={!dirty || !name.trim() || saving}>
        <Save size={18} />{saving ? (ar ? 'عم نحفظ…' : 'Saving…') : saved ? (ar ? 'تم الحفظ' : 'Saved') : (ar ? 'احفظ التغييرات' : 'Save changes')}
      </button>
    </section>}

    <section className="card profile-prefs">
      <h3>{ar ? 'التفضيلات' : 'Preferences'}</h3>
      <div className="profile-pref-row">
        <span>{ar ? 'اللغة' : 'Language'}</span>
        <button type="button" className="ghost-button" onClick={() => onLocaleChange(ar ? 'en' : 'ar')}><Languages size={17} />{ar ? 'English' : 'العربية'}</button>
      </div>
      <div className="profile-pref-row">
        <span>{ar ? 'المظهر' : 'Theme'}</span>
        <button type="button" className="ghost-button" onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{theme === 'dark' ? (ar ? 'فاتح' : 'Light') : (ar ? 'داكن' : 'Dark')}</button>
      </div>
    </section>

    <button type="button" className="danger-button profile-logout" onClick={onLogout}>
      <LogOut size={18} />{demoMode ? (ar ? 'اخرج من التجربة' : 'Exit demo') : (ar ? 'تسجيل الخروج' : 'Sign out')}
    </button>
  </section>
}
