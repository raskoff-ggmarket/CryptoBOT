import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { Globe, LogOut, User } from 'lucide-react'

export default function Topbar() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuthStore()
  const { language, setLanguage } = useUIStore()

  const toggleLang = () => {
    const next = language === 'tr' ? 'en' : 'tr'
    setLanguage(next)
    i18n.changeLanguage(next)
  }

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-accent text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span className="uppercase font-medium">{language}</span>
        </button>

        {/* User menu */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/50">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{user?.username}</span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors text-sm"
          title={t('nav.logout')}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
