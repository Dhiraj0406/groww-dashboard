'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const rs = (v, sign = true) => {
  const abs = Math.abs(v)
  const str = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
  if (!sign) return `Rs ${str}`
  return `${v >= 0 ? '+' : '-'}Rs ${str}`
}
const pct = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
const clr = v => v >= 0 ? 'text-green-400' : 'text-red-400'
const bgClr = v => v >= 0 ? 'bg-green-400/10 border-green-400/20' : 'bg-red-400/10 border-red-400/20'
const outcomeClr = o => ({
  TARGET: 'text-green-400', STOP: 'text-red-400',
  BREAKEVEN: 'text-yellow-400', TIME: 'text-gray-400'
})[o] || 'text-gray-400'
const outcomeTag = o => ({
  TARGET: '✓ TARGET', STOP: '✗ STOP',
  BREAKEVEN: '~ BE', TIME: '⏱ TIME'
})[o] || o

const IDX_COLOR = { NIFTY: '#3b82f6', BANKNIFTY: '#a855f7', FINNIFTY: '#14b8a6' }

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-800 rounded ${className}`} />
}

function LoadingDash() {
  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6 space-y-4">
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────────────────

function Header({ kpis, today, lastUpdated, onRefresh, refreshing }) {
  const dd = kpis.capital_current - kpis.capital_base
  const ddPct = kpis.capital_base ? dd / kpis.capital_base * 100 : 0
  return (
    <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-800">
      <div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-lg font-bold tracking-tight">Groww Bot</span>
          <span className="text-xs text-gray-500 ml-1">VR20 + VR10</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {today} · Updated {lastUpdated?.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-500">Capital</p>
          <p className="font-mono font-bold text-white">{rs(kpis.capital_current, false)}</p>
          <p className={`text-xs font-mono ${clr(dd)}`}>{rs(dd)} ({pct(ddPct)})</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-gray-400 hover:text-white text-xs border border-gray-700 rounded px-2.5 py-1.5 transition-colors disabled:opacity-40"
        >
          {refreshing ? '...' : '↻ Refresh'}
        </button>
      </div>
    </div>
  )
}

function KPICards({ kpis }) {
  const cards = [
    {
      label: 'Total P&L',
      value: rs(kpis.total_pnl),
      sub: `${kpis.trade_count} trades`,
      color: clr(kpis.total_pnl),
    },
    {
      label: 'Win Rate',
      value: `${kpis.win_rate}%`,
      sub: `${kpis.wins}W / ${kpis.stops}S`,
      color: kpis.win_rate >= 40 ? 'text-green-400' : kpis.win_rate >= 25 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'This Month',
      value: rs(kpis.month_pnl),
      sub: 'current month',
      color: clr(kpis.month_pnl),
    },
    {
      label: 'Peak Capital',
      value: rs(kpis.peak_capital, false),
      sub: `base ${rs(kpis.capital_base, false)}`,
      color: 'text-amber-400',
    },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {cards.map(c => (
        <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">{c.label}</p>
          <p className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-gray-600 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

function TodayStatus({ status, today }) {
  const indices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY']
  const statusMap = Object.fromEntries(status.map(s => [s.index, s]))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Today · {today}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {indices.map(idx => {
          const s = statusMap[idx]
          const dot = !s ? 'bg-gray-600'
            : s.fired && s.outcome === 'TARGET' ? 'bg-green-400'
            : s.fired && s.outcome === 'STOP' ? 'bg-red-400'
            : s.fired ? 'bg-amber-400'
            : 'bg-gray-500'
          return (
            <div key={idx} className="flex items-start gap-2.5">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
              <div>
                <p className="text-sm font-semibold" style={{ color: IDX_COLOR[idx] }}>{idx}</p>
                {!s ? (
                  <p className="text-xs text-gray-500">No data yet</p>
                ) : s.fired ? (
                  <>
                    <p className={`text-sm font-mono font-bold ${outcomeClr(s.outcome)}`}>
                      {outcomeTag(s.outcome)} {s.pnl != null ? rs(s.pnl) : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.direction} · OR {s.or_rng?.toFixed(0)}pts
                      {s.vix ? ` · VIX ${s.vix.toFixed(1)}` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">No signal</p>
                    <p className="text-xs text-gray-600 truncate max-w-[200px]">{s.reason || '—'}</p>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {status.length === 0 && (
          <p className="text-xs text-gray-600 col-span-3 italic">
            Bot hasn't reported yet today. Data appears after 9:44 AM IST.
          </p>
        )}
      </div>
    </div>
  )
}

function EquityCurve({ data }) {
  if (!data.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 h-56 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Equity curve appears after first trade</p>
      </div>
    )
  }
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const v = payload[0].value
    return (
      <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs">
        <p className="text-gray-400 mb-0.5">{label}</p>
        <p className={`font-mono font-bold ${clr(v)}`}>{rs(v)}</p>
      </div>
    )
  }
  const maxCum = Math.max(...data.map(d => d.cum))
  const minCum = Math.min(...data.map(d => d.cum))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Equity Curve · Cumulative P&L</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={d => d?.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }}
            tickFormatter={v => v >= 0 ? `+${(v/1000).toFixed(0)}k` : `${(v/1000).toFixed(0)}k`}
            width={40} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="cum" stroke="#22c55e" strokeWidth={2}
            dot={false} activeDot={{ r: 4, fill: '#22c55e' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function MonthlyBreakdown({ monthly }) {
  if (!monthly.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-64 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Monthly data appears after first trade</p>
      </div>
    )
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Monthly P&L</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left pb-2 font-medium">Month</th>
              <th className="text-right pb-2 font-medium" style={{ color: IDX_COLOR.NIFTY }}>NIFTY</th>
              <th className="text-right pb-2 font-medium" style={{ color: IDX_COLOR.BANKNIFTY }}>BANKNIFTY</th>
              <th className="text-right pb-2 font-medium" style={{ color: IDX_COLOR.FINNIFTY }}>FINNIFTY</th>
              <th className="text-right pb-2 font-medium text-gray-300">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...monthly].reverse().map(m => (
              <tr key={m.month} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-1.5 text-gray-400">{m.month}</td>
                <td className={`py-1.5 text-right font-mono ${clr(m.NIFTY)}`}>{rs(m.NIFTY)}</td>
                <td className={`py-1.5 text-right font-mono ${clr(m.BANKNIFTY)}`}>{rs(m.BANKNIFTY)}</td>
                <td className={`py-1.5 text-right font-mono ${clr(m.FINNIFTY)}`}>{rs(m.FINNIFTY)}</td>
                <td className={`py-1.5 text-right font-mono font-bold ${clr(m.total)}`}>{rs(m.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="pt-2 text-gray-400 font-medium">Total</td>
              {['NIFTY','BANKNIFTY','FINNIFTY'].map(k => {
                const tot = monthly.reduce((s, m) => s + m[k], 0)
                return <td key={k} className={`pt-2 text-right font-mono font-bold ${clr(tot)}`}>{rs(tot)}</td>
              })}
              {(() => {
                const tot = monthly.reduce((s, m) => s + m.total, 0)
                return <td className={`pt-2 text-right font-mono font-bold ${clr(tot)}`}>{rs(tot)}</td>
              })()}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function IndexBreakdown({ byIndex }) {
  const entries = Object.entries(byIndex)
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">By Index</p>
      {entries.map(([idx, s]) => (
        <div key={idx} className="border border-gray-800 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold" style={{ color: IDX_COLOR[idx] }}>{idx}</span>
            <span className={`text-sm font-mono font-bold ${clr(s.total)}`}>{rs(s.total)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Trades</p>
              <p className="font-mono font-medium">{s.trades}</p>
            </div>
            <div>
              <p className="text-gray-500">Wins</p>
              <p className="font-mono font-medium text-green-400">{s.wins}</p>
            </div>
            <div>
              <p className="text-gray-500">Win Rate</p>
              <p className={`font-mono font-medium ${s.wr >= 40 ? 'text-green-400' : s.wr >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                {s.wr}%
              </p>
            </div>
          </div>
          <div className="mt-2 bg-gray-800 rounded-full h-1.5">
            <div className="h-1.5 rounded-full" style={{
              width: `${Math.min(100, s.wr)}%`,
              background: IDX_COLOR[idx]
            }} />
          </div>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-8">No trade data yet</p>
      )}
    </div>
  )
}

function WinRateByDay({ wrByDay }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Win Rate by Day of Week</p>
      <div className="flex gap-3 justify-around">
        {wrByDay.map(d => (
          <div key={d.day} className="text-center flex-1">
            <div className="relative bg-gray-800 rounded-lg overflow-hidden h-16 mb-1.5 flex items-end justify-center">
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{
                  height: `${Math.max(4, d.wr)}%`,
                  background: d.wr >= 50 ? '#22c55e' : d.wr >= 30 ? '#f59e0b' : '#ef4444',
                  opacity: d.trades > 0 ? 1 : 0.2,
                }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-white">
                {d.trades > 0 ? `${d.wr}%` : '—'}
              </span>
            </div>
            <p className="text-xs text-gray-500">{d.day}</p>
            <p className="text-xs text-gray-600">{d.trades}t</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentTrades({ trades }) {
  if (!trades.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Trades</p>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-gray-600 text-sm">No trades yet</p>
          <p className="text-gray-700 text-xs max-w-sm text-center">
            Deploy the VM push script — trades will appear here after each session.
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Recent Trades</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              {['Date','Day','Index','Dir','P&L','Outcome','Lots','Score','R:R','OR rng','Boosters'].map(h => (
                <th key={h} className={`pb-2 font-medium ${h === 'Date' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => (
              <tr key={i} className="border-b border-gray-800/40 hover:bg-gray-800/20 group">
                <td className="py-1.5 text-gray-400 pr-3">{t.trade_date}</td>
                <td className="py-1.5 text-gray-500 text-right">{t.day_name || '—'}</td>
                <td className="py-1.5 text-right font-semibold" style={{ color: IDX_COLOR[t.index_name] || '#9ca3af' }}>
                  {t.index_name}
                </td>
                <td className={`py-1.5 text-right font-mono ${t.direction === 'CE' ? 'text-blue-400' : 'text-purple-400'}`}>
                  {t.direction}
                </td>
                <td className={`py-1.5 text-right font-mono font-bold ${clr(t.pnl)}`}>{rs(t.pnl)}</td>
                <td className={`py-1.5 text-right font-mono ${outcomeClr(t.outcome)}`}>{outcomeTag(t.outcome)}</td>
                <td className="py-1.5 text-right text-gray-400">{t.lots}</td>
                <td className="py-1.5 text-right text-gray-400">{t.score}</td>
                <td className="py-1.5 text-right text-gray-400">{t.rr?.toFixed(1)}</td>
                <td className="py-1.5 text-right text-gray-400">{t.or_rng?.toFixed(0)}</td>
                <td className="py-1.5 text-right text-gray-600 max-w-[120px] truncate">{t.boosters || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UpcomingEvents({ events }) {
  if (!events.length) return null
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Upcoming Event Blackouts</p>
      <div className="flex flex-wrap gap-2">
        {events.map(e => (
          <div key={e.date}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs ${
              e.action === 'skip'
                ? 'bg-red-400/10 border-red-400/20 text-red-300'
                : 'bg-amber-400/10 border-amber-400/20 text-amber-300'
            }`}>
            <span className="font-mono">{e.date}</span>
            <span className="text-gray-400">·</span>
            <span>{e.event}</span>
            <span className={`font-bold uppercase text-[10px] ${e.action === 'skip' ? 'text-red-400' : 'text-amber-400'}`}>
              [{e.action}]
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SetupBanner({ show }) {
  if (!show) return null
  return (
    <div className="bg-blue-400/5 border border-blue-400/20 rounded-xl p-4 mb-4 text-xs text-blue-300">
      <p className="font-semibold mb-1">📡 Waiting for live data</p>
      <p className="text-blue-400/70">
        Deploy the <code className="bg-gray-800 px-1 rounded">push_to_supabase.py</code> script on the VM.
        It runs at 16:15 IST daily and pushes that day's trade data here.
      </p>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/data', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (loading) return <LoadingDash />

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-2">Failed to load data</p>
          <p className="text-gray-600 text-xs mb-4">{error}</p>
          <button onClick={fetchData} className="text-xs border border-gray-700 rounded px-3 py-1.5 text-gray-400 hover:text-white">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const noTrades = data.kpis.trade_count === 0

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6 max-w-7xl mx-auto">
      <Header
        kpis={data.kpis}
        today={data.today}
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={refreshing}
      />

      <SetupBanner show={noTrades} />
      <KPICards kpis={data.kpis} />
      <TodayStatus status={data.today_status} today={data.today} />
      <EquityCurve data={data.equity_curve} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <MonthlyBreakdown monthly={data.monthly} />
        <IndexBreakdown byIndex={data.by_index} />
      </div>

      <WinRateByDay wrByDay={data.wr_by_day} />
      <RecentTrades trades={data.recent_trades} />
      <UpcomingEvents events={data.events} />

      <p className="text-center text-gray-800 text-xs pb-4">
        Groww Bot · VR20 + VR10 · Auto-refreshes every 5 min
      </p>
    </div>
  )
}
