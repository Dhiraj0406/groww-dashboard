import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const EVENTS = [
  { date: '2026-06-06', event: 'RBI MPC', action: '1lot' },
  { date: '2026-08-08', event: 'RBI MPC', action: '1lot' },
  { date: '2026-10-07', event: 'RBI MPC', action: '1lot' },
  { date: '2026-12-05', event: 'RBI MPC', action: '1lot' },
  { date: '2027-02-01', event: 'Union Budget', action: 'skip' },
  { date: '2027-02-06', event: 'RBI MPC', action: '1lot' },
  { date: '2027-04-09', event: 'RBI MPC', action: '1lot' },
]

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    .toISOString().split('T')[0]

  const [tradesRes, statusRes, capitalRes] = await Promise.all([
    supabase.from('trades').select('*').order('trade_date', { ascending: true }),
    supabase.from('daily_status').select('*')
      .eq('status_date', today).order('index_name'),
    supabase.from('capital_snapshots').select('*')
      .order('snapshot_date', { ascending: false }).limit(1),
  ])

  const trades  = tradesRes.data  || []
  const statuses = statusRes.data || []
  const capital  = capitalRes.data || []

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const wins     = trades.filter(t => t.outcome === 'TARGET')
  const stops    = trades.filter(t => ['STOP','BREAKEVEN'].includes(t.outcome))
  const totalPnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const winRate  = trades.length > 0 ? wins.length / trades.length * 100 : 0

  const curMon   = today.slice(0, 7)
  const monthPnl = trades.filter(t => t.trade_date?.startsWith(curMon))
    .reduce((s, t) => s + (t.pnl || 0), 0)

  const capitalCurrent = capital[0]?.capital_current ?? (50000 + totalPnl)
  const capitalBase    = capital[0]?.capital_base    ?? 50000
  const peakCapital    = capital[0]?.peak_capital    ?? capitalCurrent

  // ── By index ───────────────────────────────────────────────────────────────
  const byIndex = {}
  for (const idx of ['NIFTY', 'BANKNIFTY', 'FINNIFTY']) {
    const t  = trades.filter(x => x.index_name === idx)
    const w  = t.filter(x => x.outcome === 'TARGET')
    byIndex[idx] = {
      total:  Math.round(t.reduce((s, x) => s + (x.pnl || 0), 0)),
      trades: t.length,
      wins:   w.length,
      wr:     t.length ? Math.round(w.length / t.length * 1000) / 10 : 0,
    }
  }

  // ── Monthly breakdown ──────────────────────────────────────────────────────
  const monthMap = {}
  for (const t of trades) {
    if (!t.trade_date) continue
    const m = t.trade_date.slice(0, 7)
    if (!monthMap[m]) monthMap[m] = { NIFTY: 0, BANKNIFTY: 0, FINNIFTY: 0 }
    monthMap[m][t.index_name] = (monthMap[m][t.index_name] || 0) + (t.pnl || 0)
  }
  const monthly = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mon, v]) => ({
      month:     fmtMonth(mon),
      NIFTY:     Math.round(v.NIFTY     || 0),
      BANKNIFTY: Math.round(v.BANKNIFTY || 0),
      FINNIFTY:  Math.round(v.FINNIFTY  || 0),
      total:     Math.round((v.NIFTY||0) + (v.BANKNIFTY||0) + (v.FINNIFTY||0)),
    }))

  // ── Equity curve ───────────────────────────────────────────────────────────
  let cum = 0
  const equityCurve = trades.map(t => {
    cum += t.pnl || 0
    return { date: t.trade_date, cum: Math.round(cum), pnl: Math.round(t.pnl || 0) }
  })

  // ── Win rate by day ────────────────────────────────────────────────────────
  const days = ['Mon','Tue','Wed','Thu','Fri']
  const wrByDay = days.map(day => {
    const dt = trades.filter(t => t.day_name === day)
    const dw = dt.filter(t => t.outcome === 'TARGET')
    return { day, trades: dt.length, wins: dw.length,
             wr: dt.length ? Math.round(dw.length / dt.length * 100) : 0 }
  })

  // ── Today status ───────────────────────────────────────────────────────────
  const todayStatus = statuses.map(s => ({
    index:  s.index_name,
    fired:  s.fired,
    direction: s.direction,
    reason: s.signal_reason,
    outcome: s.outcome,
    pnl:    s.pnl,
    vix:    s.vix,
    or_rng: s.or_rng,
  }))

  const upcomingEvents = EVENTS.filter(e => e.date >= today).slice(0, 5)

  return NextResponse.json({
    kpis: {
      total_pnl:       Math.round(totalPnl),
      win_rate:        Math.round(winRate * 10) / 10,
      trade_count:     trades.length,
      wins:            wins.length,
      stops:           stops.length,
      month_pnl:       Math.round(monthPnl),
      capital_current: Math.round(capitalCurrent),
      capital_base:    capitalBase,
      peak_capital:    Math.round(peakCapital),
    },
    by_index:     byIndex,
    monthly,
    equity_curve: equityCurve,
    recent_trades: [...trades].reverse().slice(0, 25),
    wr_by_day:    wrByDay,
    today_status: todayStatus,
    events:       upcomingEvents,
    updated_at:   new Date().toISOString(),
    today,
  })
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-')
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]}-${y}`
}
