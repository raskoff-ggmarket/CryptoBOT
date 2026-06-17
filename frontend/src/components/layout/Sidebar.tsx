import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'
import {
  LayoutDashboard, Bot, TrendingUp, BarChart2,
  Webhook, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'nav.dashboard' },
  { to: '/bots', icon: Bot, key: 'nav.bots' },
  { to: '/deals', icon: TrendingUp, key: 'nav.deals' },
  { to: '/backtesting', icon: BarChart2, key: 'nav.backtesting' },
  { to: '/webhooks', icon: Webhook, key: 'nav.webhooks' },
  { to: '/settings', icon: Settings, key: 'nav.settings' },
]

export default function Sidebar() {
  const { t } = useTranslation()
  const { sidebarOpen, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-all duration-200 z-30',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-bold text-lg text-foreground">CryptoBOT</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors text-sm font-medium',
                'hover:bg-accent hover:text-foreground',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>{t(item.key)}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-border hover:bg-accent transition-colors text-muted-foreground"
      >
        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
    </aside>
  )
}
