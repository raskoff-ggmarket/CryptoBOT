import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  Zap,
  Bot,
  TrendingUp,
  Grid3X3,
  Webhook,
  Shield,
  FlaskConical,
  FileText,
  LineChart,
  ArrowRight,
  Check,
  ChevronDown,
  Menu,
  X,
  Play,
  Star,
  Layers,
  Timer,
  Wallet,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: 'Botlar', href: '#bots' },
  { label: 'Özellikler', href: '#features' },
  { label: 'Nasıl Çalışır', href: '#how-it-works' },
  { label: 'Fiyatlandırma', href: '#pricing' },
  { label: 'SSS', href: '#faq' },
]

const HERO_STATS = [
  { value: '120K+', label: 'Çalıştırılan bot' },
  { value: '$2.4B+', label: 'İşlem hacmi' },
  { value: '14+', label: 'Desteklenen borsa' },
  { value: '%99.9', label: 'Çalışma süresi' },
]

const EXCHANGES = [
  'Binance',
  'Bybit',
  'OKX',
  'KuCoin',
  'Coinbase',
  'Kraken',
  'Gate.io',
  'Bitget',
]

const BOTS = [
  {
    icon: TrendingUp,
    name: 'DCA Bot',
    description:
      'Maliyet ortalama stratejisiyle düşüşlerde kademeli alım yapar, hedef kâra ulaşınca pozisyonu otomatik kapatır.',
    features: ['Kademeli güvenlik emirleri', 'Otomatik kâr al / zarar durdur', 'Long & Short destekli'],
    href: '/register',
  },
  {
    icon: Grid3X3,
    name: 'Grid Bot',
    description:
      'Belirlediğiniz fiyat aralığında al-sat ızgarası kurar, yatay piyasada her dalgalanmadan kazanç toplar.',
    features: ['Özelleştirilebilir grid aralığı', 'Yatay piyasada pasif gelir', 'Otomatik yeniden dengeleme'],
    href: '/register',
  },
  {
    icon: Webhook,
    name: 'Sinyal Bot',
    description:
      'TradingView uyarılarını veya kendi stratejinizin webhook sinyallerini saniyeler içinde emre dönüştürür.',
    features: ['TradingView entegrasyonu', 'Özel webhook desteği', 'Anlık emir iletimi'],
    href: '/register',
  },
]

const FEATURES = [
  {
    icon: FlaskConical,
    title: 'Backtesting',
    description: 'Stratejinizi geçmiş piyasa verisi üzerinde test edin, gerçek para riske atmadan sonuçları görün.',
  },
  {
    icon: FileText,
    title: 'Kağıt İşlem',
    description: 'Sanal bakiye ile canlı piyasada pratik yapın. Hazır olduğunuzda tek tıkla gerçek işleme geçin.',
  },
  {
    icon: LineChart,
    title: 'Gerçek Zamanlı Panel',
    description: 'Tüm botlarınızı, açık işlemlerinizi ve kâr/zarar durumunuzu tek ekrandan canlı takip edin.',
  },
  {
    icon: Timer,
    title: 'Akıllı Kapatma',
    description: 'Kâr al, zarar durdur ve takip eden stop ile pozisyonlarınız siz uyurken bile korunur.',
  },
  {
    icon: Wallet,
    title: 'Portföy Yönetimi',
    description: 'Birden fazla borsa hesabını tek yerden bağlayın, varlıklarınızı toplu olarak görüntüleyin.',
  },
  {
    icon: Shield,
    title: 'Güvenlik Önceliği',
    description: 'API anahtarlarınız şifrelenerek saklanır, para çekme yetkisi asla istenmez. Fonlar borsanızda kalır.',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Borsanızı bağlayın',
    description:
      'Binance veya desteklenen başka bir borsadan sadece işlem yetkili API anahtarı oluşturup hesabınıza ekleyin.',
  },
  {
    step: '02',
    title: 'Botunuzu kurun',
    description:
      'Hazır şablonlardan birini seçin ya da parite, emir büyüklüğü ve kâr hedefini kendiniz belirleyin.',
  },
  {
    step: '03',
    title: 'Kazancı izleyin',
    description:
      'Bot 7/24 sizin yerinize alım satım yapar. Siz sadece panelden performansı takip edin.',
  },
]

const PLANS = [
  {
    name: 'Başlangıç',
    price: '₺0',
    period: '/ ay',
    description: 'Otomatik ticarete ilk adım',
    features: ['1 aktif bot', 'Kağıt işlem modu', '1 borsa bağlantısı', 'Temel panel', 'Topluluk desteği'],
    cta: 'Ücretsiz Başla',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '₺499',
    period: '/ ay',
    description: 'Aktif yatırımcılar için',
    features: [
      'Sınırsız bot',
      'DCA + Grid + Sinyal botları',
      '3 borsa bağlantısı',
      'Backtesting',
      'TradingView webhookları',
      'Öncelikli destek',
    ],
    cta: '7 Gün Ücretsiz Dene',
    highlighted: true,
  },
  {
    name: 'Kurumsal',
    price: 'Özel',
    period: '',
    description: 'Ekipler ve fonlar için',
    features: [
      'Pro’daki her şey',
      'Sınırsız borsa bağlantısı',
      'Özel API limitleri',
      'Çoklu kullanıcı yönetimi',
      'Özel hesap yöneticisi',
    ],
    cta: 'Bize Ulaşın',
    highlighted: false,
  },
]

const FAQS = [
  {
    q: 'Paramı size mi yatırıyorum?',
    a: 'Hayır. Fonlarınız her zaman kendi borsa hesabınızda kalır. Platform, yalnızca işlem yetkisi olan API anahtarı ile emir gönderir; para çekme yetkisi hiçbir zaman istenmez.',
  },
  {
    q: 'Kodlama bilmem gerekiyor mu?',
    a: 'Hayır. Botlar tamamen görsel arayüzden kurulur. Hazır şablonlarla birkaç dakikada ilk botunuzu çalıştırabilirsiniz. İleri düzey kullanıcılar için webhook ve API desteği de mevcuttur.',
  },
  {
    q: 'DCA bot nasıl çalışır?',
    a: 'DCA (maliyet ortalama) botu, bir başlangıç emri açar ve fiyat düştükçe önceden belirlediğiniz aralıklarla ek alımlar yaparak ortalama maliyeti düşürür. Fiyat hedef kâr seviyesine ulaştığında pozisyonun tamamını kapatır ve yeni tur başlatır.',
  },
  {
    q: 'Önce risksiz deneyebilir miyim?',
    a: 'Evet. Kağıt işlem modu ile sanal bakiye üzerinden canlı piyasa verisiyle bot çalıştırabilir, ayrıca backtesting ile stratejinizi geçmiş veride test edebilirsiniz.',
  },
  {
    q: 'Kâr garantisi var mı?',
    a: 'Hayır. Kripto piyasaları yüksek risk içerir ve hiçbir strateji kâr garantisi veremez. Botlar stratejinizi disiplinle uygular; risk yönetimi araçlarını (zarar durdur, pozisyon limiti) kullanmanızı öneririz.',
  },
  {
    q: 'Aboneliğimi istediğim zaman iptal edebilir miyim?',
    a: 'Evet. Aboneliğinizi dilediğiniz an panelden iptal edebilirsiniz; dönem sonuna kadar tüm özellikleri kullanmaya devam edersiniz.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Emre K.',
    role: 'Swing yatırımcısı',
    text: 'Grafik başında saatler geçirmeyi bıraktım. DCA botum düşüşlerde benim yerime alım yapıyor, ben sadece haftalık raporu kontrol ediyorum.',
  },
  {
    name: 'Selin A.',
    role: 'Günlük trader',
    text: 'TradingView stratejimi webhook ile bağladım, sinyaller saniyesinde emre dönüşüyor. Manuel emir girerken kaçırdığım hareketler tarih oldu.',
  },
  {
    name: 'Murat T.',
    role: 'Uzun vadeli yatırımcı',
    text: 'Önce kağıt işlem modunda iki hafta denedim, sonra gerçek hesaba geçtim. Backtesting olmadan bot kurmayı düşünemiyorum artık.',
  },
]

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Sparkline() {
  return (
    <svg viewBox="0 0 320 96" className="w-full h-24" preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,72 C24,64 40,80 60,70 C84,58 96,66 116,52 C136,38 152,50 172,42 C196,32 208,44 228,30 C252,14 272,26 296,16 L320,10 L320,96 L0,96 Z"
        fill="url(#spark-fill)"
      />
      <path
        d="M0,72 C24,64 40,80 60,70 C84,58 96,66 116,52 C136,38 152,50 172,42 C196,32 208,44 228,30 C252,14 272,26 296,16 L320,10"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HeroMockup() {
  const deals = [
    { pair: 'BTC/USDT', bot: 'DCA Long', pnl: '+%3.42', positive: true },
    { pair: 'ETH/USDT', bot: 'Grid', pnl: '+%1.87', positive: true },
    { pair: 'SOL/USDT', bot: 'Sinyal', pnl: '-%0.54', positive: false },
  ]
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-primary/20 blur-3xl rounded-full" aria-hidden />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">BTC Sabırlı DCA</p>
              <p className="text-xs text-muted-foreground">Binance · Canlı</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-profit bg-profit/10 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
            Aktif
          </span>
        </div>
        <div className="px-5 pt-4">
          <p className="text-xs text-muted-foreground">Toplam kâr (30 gün)</p>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold tabular-nums">+$1,284.56</p>
            <p className="text-sm font-medium text-profit mb-1">+%12.4</p>
          </div>
        </div>
        <Sparkline />
        <div className="border-t border-border divide-y divide-border">
          {deals.map((d) => (
            <div key={d.pair} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium tabular-nums">{d.pair}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{d.bot}</span>
              </div>
              <span className={`text-sm font-semibold tabular-nums ${d.positive ? 'text-profit' : 'text-loss'}`}>
                {d.pnl}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-4 -bottom-5 bg-card border border-border rounded-xl px-4 py-3 shadow-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-profit/15 flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-profit" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Kazanma oranı</p>
          <p className="text-sm font-bold tabular-nums">%78.3</p>
        </div>
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-medium">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-14">
      <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-muted-foreground text-lg">{subtitle}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { token } = useAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">CryptoBOT</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {token ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
              >
                Panele Git <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
                  Giriş Yap
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  Ücretsiz Başla
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen((v) => !v)} aria-label="Menü">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="block px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 flex gap-3">
              {token ? (
                <Link to="/dashboard" className="flex-1 text-center bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg">
                  Panele Git
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1 text-center border border-border text-sm font-medium px-4 py-2.5 rounded-lg">
                    Giriş Yap
                  </Link>
                  <Link to="/register" className="flex-1 text-center bg-primary text-primary-foreground text-sm font-semibold px-4 py-2.5 rounded-lg">
                    Ücretsiz Başla
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(60% 50% at 50% -10%, hsl(142 76% 36% / 0.25) 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 lg:pt-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 border border-border bg-card rounded-full px-4 py-1.5 text-sm text-muted-foreground mb-6">
                <span className="w-2 h-2 rounded-full bg-profit animate-pulse" />
                7/24 çalışan otomatik ticaret botları
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Kripto ticaretinizi <span className="text-primary">otomatik pilota</span> alın
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
                DCA, Grid ve Sinyal botlarıyla stratejinizi duygulardan arındırın. Siz uyurken bot alsın,
                satsın, kârı cebe koysun. Kodlama gerekmez — dakikalar içinde kurulur.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity text-base"
                >
                  Ücretsiz Hesap Aç <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 border border-border bg-card font-semibold px-6 py-3.5 rounded-xl hover:bg-secondary transition-colors text-base"
                >
                  <Play className="w-5 h-5" /> Nasıl Çalışır?
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Kredi kartı gerekmez · Kağıt işlem modu ile risksiz deneyin
              </p>
              <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
                {HERO_STATS.map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Exchanges */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <p className="text-center text-sm text-muted-foreground mb-6">Desteklenen borsalar</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {EXCHANGES.map((e) => (
              <span key={e} className="text-lg font-semibold text-muted-foreground/70 hover:text-foreground transition-colors">
                {e}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bots */}
      <section id="bots" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeading
          eyebrow="Ticaret Botları"
          title="Her piyasa koşulu için bir bot"
          subtitle="Yükselişte, düşüşte veya yatay seyirde — stratejinize uygun botu seçin, gerisini o halletsin."
        />
        <div className="grid md:grid-cols-3 gap-6">
          {BOTS.map((b) => (
            <div
              key={b.name}
              className="group bg-card border border-border rounded-2xl p-8 hover:border-primary/50 transition-colors flex flex-col"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6">
                <b.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">{b.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{b.description}</p>
              <ul className="space-y-2.5 mb-8">
                {b.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-profit shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={b.href}
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-primary group-hover:gap-3 transition-all"
              >
                Botu Kur <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeading
            eyebrow="Özellikler"
            title="Profesyonel araçlar, sade arayüz"
            subtitle="Strateji test etmekten canlı takibe kadar ihtiyacınız olan her şey tek platformda."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-2xl p-7">
                <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-5">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeading
          eyebrow="Nasıl Çalışır"
          title="3 adımda otomatik ticarete başlayın"
          subtitle="İlk botunuzu çalıştırmak beş dakikadan az sürer."
        />
        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.step} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+3rem)] w-[calc(100%-6rem)] border-t-2 border-dashed border-border" aria-hidden />
              )}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xl font-bold mb-6 relative z-10 bg-background">
                  {s.step}
                </div>
                <h3 className="text-lg font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Hemen Başla <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-card/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeading eyebrow="Kullanıcılar" title="Yatırımcılar ne diyor?" />
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-card border border-border rounded-2xl p-7 flex flex-col">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6">“{t.text}”</p>
                <div className="mt-auto">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeading
          eyebrow="Fiyatlandırma"
          title="Basit ve şeffaf planlar"
          subtitle="Ücretsiz başlayın, ihtiyacınız büyüdükçe yükseltin. Gizli ücret yok."
        />
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl p-8 flex flex-col border ${
                p.highlighted ? 'border-primary bg-card shadow-xl shadow-primary/10' : 'border-border bg-card'
              }`}
            >
              {p.highlighted && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full">
                  EN POPÜLER
                </span>
              )}
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
              <div className="flex items-end gap-1 mt-5 mb-7">
                <span className="text-4xl font-bold tabular-nums">{p.price}</span>
                <span className="text-muted-foreground mb-1">{p.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-profit shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className={`mt-auto text-center font-semibold px-5 py-3 rounded-xl transition-opacity ${
                  p.highlighted
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'border border-border hover:bg-secondary'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-card/50 border-y border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeading eyebrow="SSS" title="Sık sorulan sorular" />
          <div className="space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card p-12 lg:p-16 text-center">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(50% 80% at 50% 0%, hsl(142 76% 36% / 0.25) 0%, transparent 70%)',
            }}
            aria-hidden
          />
          <div className="relative">
            <Layers className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
              İlk botunuzu bugün çalıştırın
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Ücretsiz hesap açın, kağıt işlem moduyla risksiz deneyin. Hazır olduğunuzda tek tıkla canlıya geçin.
            </p>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-4 rounded-xl hover:opacity-90 transition-opacity text-base"
            >
              Ücretsiz Başla <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="font-bold">CryptoBOT</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                7/24 çalışan otomatik kripto ticaret botları. Stratejinizi kurun, gerisini bota bırakın.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4">Ürün</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#bots" className="hover:text-foreground transition-colors">DCA Bot</a></li>
                <li><a href="#bots" className="hover:text-foreground transition-colors">Grid Bot</a></li>
                <li><a href="#bots" className="hover:text-foreground transition-colors">Sinyal Bot</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Backtesting</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4">Kaynaklar</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#how-it-works" className="hover:text-foreground transition-colors">Nasıl Çalışır</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Fiyatlandırma</a></li>
                <li><a href="#faq" className="hover:text-foreground transition-colors">SSS</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-sm mb-4">Hesap</p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/login" className="hover:text-foreground transition-colors">Giriş Yap</Link></li>
                <li><Link to="/register" className="hover:text-foreground transition-colors">Kayıt Ol</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} CryptoBOT. Tüm hakları saklıdır.</p>
            <p className="text-xs text-muted-foreground max-w-md text-center sm:text-right">
              Kripto varlıklar yüksek risk içerir. Bu platform yatırım tavsiyesi vermez; geçmiş performans gelecekteki
              sonuçların garantisi değildir.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
