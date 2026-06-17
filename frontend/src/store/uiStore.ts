import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIStore {
  language: 'tr' | 'en'
  sidebarOpen: boolean
  setLanguage: (lang: 'tr' | 'en') => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      language: 'tr',
      sidebarOpen: true,
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'cryptobot-ui' }
  )
)
