import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { Zap, Loader2, Mail, Lock, Eye, EyeOff, TrendingUp, Bot, Shield } from 'lucide-react'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authApi.login(data.email, data.password)
      const { access_token, refresh_token, user } = res.data.data
      setAuth(access_token, refresh_token, user)
      navigate('/dashboard')
      toast.success(t('common.success'))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('common.error'))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08090f] overflow-hidden relative px-4">
      {/* Background glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-60 -left-60 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px]" />
        <div className="absolute -bottom-60 -right-60 w-[500px] h-[500px] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-indigo-600/5 blur-[100px]" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/40 blur-2xl scale-110" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-2xl">
              <Zap className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">CryptoBOT</h1>
          <p className="text-gray-500 text-sm mt-1">Binance DCA Bot Platform</p>
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-blue-500/10 to-violet-500/10 blur-xl" />
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-semibold text-white mb-1">{t('auth.loginTitle')}</h2>
            <p className="text-gray-500 text-sm mb-7">Hesabınıza giriş yapın</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('auth.email')}
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                    placeholder="ornek@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="relative w-full py-3 mt-1 rounded-xl font-semibold text-white overflow-hidden group disabled:opacity-60 transition-all duration-200"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-violet-600 group-hover:from-blue-500 group-hover:to-violet-500 transition-all duration-200" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-blue-400/20 to-violet-400/20 blur-xl" />
                <span className="relative flex items-center justify-center gap-2">
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {t('auth.login')}
                </span>
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/10 text-center">
              <p className="text-sm text-gray-500">
                {t('auth.noAccount')}{' '}
                <Link
                  to="/register"
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  {t('auth.register')}
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { icon: <TrendingUp className="w-4 h-4" />, label: 'DCA Strateji' },
            { icon: <Bot className="w-4 h-4" />, label: 'Otomatik Al' },
            { icon: <Shield className="w-4 h-4" />, label: 'Güvenli' },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <span className="text-blue-400/80">{f.icon}</span>
              <span className="text-xs text-gray-600">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
