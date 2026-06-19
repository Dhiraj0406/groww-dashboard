'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ── Helpers ───────────────────────────────────────────────────────────────────

function rs(v) {
  if (v == null) return '–'
  const abs = Math.abs(v)
  if (abs >= 1000) return `Rs ${(v / 1000).toFixed(1)}k`
  return `Rs ${Math.round(v)}`
}

function fmtMonth(ym) {
  if (!ym) return '–'
  const d = new Date(ym)
  return d.toLocaleString('default', { month: 'short', year: 'numeric' })
}

const clr = v => (v == null ? 'text-gray-400' : v >= 0 ? 'text-green-400' : 'text-red-400')

const outcomeClr = o =>
  ({ TARGET: 'text-green-400', STOP: 'text-red-400', BREAKEVEN: 'text-yellow-400', TIME: 'text-gray-400' })[o] ||
  'text-gray-400'

const outcomeTag = o =>
  ({ TARGET: '✓ TARGET', STOP: '✗ STOP', BREAKEVEN: '~ BE', TIME: '⏱ TIME' })[o] || o

// ── Loading skeleton ───────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
}

function LoadingView() {
  return (
    <div className="min-h-screen bg-gray-950 p-4 space-y-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

// ── 404 page ──────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center px-4">
        <p className="text-5xl font-bold text-gray-700 mb-4">404</p>
        <p className="text-gray-400 text-sm mb-2">Dashboard not found</p>
        <p className="text-gray-600 text-xs">
          This link may be invalid or expired. Contact Dhiraj for a new link.
        </p>
      </div>
    </div>
  )
}

// ── Bot status badge ──────────────────────────────────────────────────────────

function BotStatusBadge({ status }) {
  const cfg = {
    live:          { dot: 'bg-green-400 animate-pulse', text: 'Live — trading today',       label: 'text-green-300' },
    paused:        { dot: 'bg-yellow-400',              text: 'Paused — market closed',      label: 'text-yellow-300' },
    token_expired: { dot: 'bg-red-400',                 text: 'Token expired — contact Dhiraj', label: 'text-red-300' },
  }[status] || { dot: 'bg-gray-500', text: 'No signal today', label: 'text-gray-400' }

  return (
    <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 mb-4">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-sm ${cfg.label}`}>{cfg.text}</span>
    </div>
  )
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function KPICards({ kpis }) {
  const cards = [
    {
      label: 'Capital Deployed',
      value: rs(kpis.capital_base),
      color: 'text-white',
    },
    {
      label: 'Current Value',
      value: rs(kpis.capital_current),
      color: 'text-white',
    },
    {
      label: 'P&L This Month',
      value: rs(kpis.month_pnl),
      color: clr(kpis.month_pnl),
    },
    {
      label: 'Your Share (50%)',
      value: rs(kpis.user_share_month),
      color: clr(kpis.user_share_month),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {cards.map(c => (
        <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Monthly history table ─────────────────────────────────────────────────────

function MonthlyTable({ monthly }) {
  if (!monthly || monthly.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-gray-600 text-sm">No monthly data yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left pb-2 font-medium">Month</th>
            <th className="text-right pb-2 font-medium">Gross P&L</th>
            <th className="text-right pb-2 font-medium">Your Share</th>
            <th className="text-right pb-2 font-medium">Trades</th>
            <th className="text-right pb-2 font-medium">W/L</th>
          </tr>
        </thead>
        <tbody>
          {[...monthly].reverse().map((m, i) => (
            <tr key={m.month} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-1.5 text-gray-400">{fmtMonth(m.month)}</td>
              <td className={`py-1.5 text-right font-mono font-bold ${clr(m.gross_pnl)}`}>
                {rs(m.gross_pnl)}
              </td>
              <td className={`py-1.5 text-right font-mono ${clr(m.your_share)}`}>
                {rs(m.your_share)}
              </td>
              <td className="py-1.5 text-right text-gray-400">{m.trade_count}</td>
              <td className="py-1.5 text-right text-gray-400">
                <span className="text-green-400">{m.wins}</span>
                <span className="text-gray-600">/</span>
                <span className="text-red-400">{m.losses}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Recent trades table ───────────────────────────────────────────────────────

const IDX_COLOR = { NIFTY: '#3b82f6', BANKNIFTY: '#a855f7', FINNIFTY: '#14b8a6' }

function RecentTradesTable({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-gray-600 text-sm">No trades yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-800">
            <th className="text-left pb-2 font-medium">Date</th>
            <th className="text-right pb-2 font-medium">Index</th>
            <th className="text-right pb-2 font-medium">Dir</th>
            <th className="text-right pb-2 font-medium">P&L</th>
            <th className="text-right pb-2 font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={`${t.trade_date}-${t.index_name}-${t.direction || i}`} className="border-b border-gray-800/40 hover:bg-gray-800/20">
              <td className="py-1.5 text-gray-400">{t.trade_date}</td>
              <td
                className="py-1.5 text-right font-semibold"
                style={{ color: IDX_COLOR[t.index_name] || '#9ca3af' }}
              >
                {t.index_name}
              </td>
              <td
                className={`py-1.5 text-right font-mono ${
                  t.direction === 'CE' ? 'text-blue-400' : 'text-purple-400'
                }`}
              >
                {t.direction}
              </td>
              <td className={`py-1.5 text-right font-mono font-bold ${clr(t.pnl)}`}>
                {rs(t.pnl)}
              </td>
              <td className={`py-1.5 text-right font-mono ${outcomeClr(t.outcome)}`}>
                {outcomeTag(t.outcome)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main dashboard ─────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const params = useParams()
  const token = params?.token

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`/api/u/${token}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); return }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastError(null)
    } catch (e) {
      if (data) {
        // Already have data — show inline warning, don't replace dashboard
        setLastError(e.message)
      } else {
        setError(e.message) // no data yet — show full error page
      }
    } finally {
      setLoading(false)
    }
  }, [token, data])

  useEffect(() => {
    fetchData()
    // Auto-refresh every 5 min
    const id = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <LoadingView />
  if (notFound) return <NotFound />

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-red-400 text-sm mb-2">Failed to load dashboard</p>
          <p className="text-gray-600 text-xs mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData() }}
            className="text-xs border border-gray-700 rounded px-3 py-1.5 text-gray-400 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { user, bot_status, kpis, monthly, recent_trades, updated_at } = data

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 max-w-lg mx-auto">
      {lastError && (
        <div className="mb-4 rounded-lg bg-yellow-900/40 border border-yellow-700 text-yellow-300 text-sm px-4 py-2">
          ⚠ Last refresh failed — showing data from previous fetch. ({lastError})
        </div>
      )}
      {/* Header */}
      <div className="mb-5 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              {user.display}&apos;s Portfolio
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Groww Bot · VR20 · Updated{' '}
              {updated_at
                ? new Date(updated_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
                : '—'}{' '}
              IST
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Win Rate</p>
            <p
              className={`font-mono font-bold ${
                kpis.win_rate >= 40
                  ? 'text-green-400'
                  : kpis.win_rate >= 25
                  ? 'text-yellow-400'
                  : 'text-gray-400'
              }`}
            >
              {kpis.win_rate}%
            </p>
            <p className="text-xs text-gray-600">{kpis.trade_count} trades</p>
          </div>
        </div>
      </div>

      {/* Bot status */}
      <BotStatusBadge status={bot_status} />

      {/* 4 KPI cards */}
      <KPICards kpis={kpis} />

      {/* Total share summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 mb-2">All-time summary</p>
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Total Gross P&L</p>
            <p className={`font-mono text-lg font-bold ${clr(kpis.total_pnl)}`}>
              {rs(kpis.total_pnl)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Your Total Share (50%)</p>
            <p className={`font-mono text-lg font-bold ${clr(kpis.user_share_total)}`}>
              {rs(kpis.user_share_total)}
            </p>
          </div>
        </div>
      </div>

      {/* Show / hide details toggle */}
      <button
        onClick={() => setShowDetails(v => !v)}
        className="w-full text-sm border border-gray-700 rounded-xl px-4 py-2.5 text-gray-400 hover:text-white hover:border-gray-500 transition-colors mb-4"
      >
        {showDetails ? '▲ Hide details' : '▼ Show details'}
      </button>

      {showDetails && (
        <>
          {/* Monthly history */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Monthly History</p>
            <MonthlyTable monthly={monthly} />
          </div>

          {/* Recent trades */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
              Recent Trades{' '}
              <span className="text-gray-600 normal-case tracking-normal">
                (last {recent_trades?.length ?? 0})
              </span>
            </p>
            <RecentTradesTable trades={recent_trades} />
          </div>
        </>
      )}

      <p className="text-center text-gray-800 text-xs pb-4">
        Groww Bot · Powered by VR20 strategy
      </p>
    </div>
  )
}
