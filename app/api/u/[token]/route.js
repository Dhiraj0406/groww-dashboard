import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function capitalize(str) {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export async function GET(request, { params }) {
  const { token } = params

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )

  // 1. Resolve token → member
  const { data: member, error: memberErr } = await supabase
    .from('members')
    .select('user_name, token_status, is_live')
    .eq('dashboard_token', token)
    .single()

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { user_name, token_status, is_live } = member

  // 2. Fetch trades for this user (ascending so equity curve is chronological)
  const { data: trades = [] } = await supabase
    .from('trades')
    .select('*')
    .eq('user_name', user_name)
    .order('trade_date', { ascending: true })

  // 3. Fetch monthly P&L view
  const { data: monthly = [] } = await supabase
    .from('user_monthly_pnl')
    .select('*')
    .eq('user_name', user_name)
    .order('month', { ascending: true })

  // 4. Fetch capital snapshot (user-scoped only — no cross-user fallback)
  let capitalRow = null
  {
    const { data: capUser } = await supabase
      .from('capital_snapshots')
      .select('*')
      .eq('user_name', user_name)
      .order('snapshot_date', { ascending: false })
      .limit(1)

    if (capUser && capUser.length > 0) {
      capitalRow = capUser[0]
    }
  }

  // 5. Compute KPIs
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) // "2026-06-19"
  const curMon = today.slice(0, 7) // "2026-06"

  const total_pnl = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const wins = trades.filter(t => t.outcome === 'TARGET').length
  const trade_count = trades.length
  const win_rate = trade_count > 0 ? Math.round((wins / trade_count) * 1000) / 10 : 0

  // Find current month row in the monthly view data
  const curMonthRow = (monthly || []).find(m => {
    const mStr = new Date(m.month).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
    return mStr === curMon
  })
  const month_pnl = Math.round(curMonthRow?.gross_pnl || 0)

  const capital_base = capitalRow?.capital_base ?? 0
  // No capital snapshot for this user — derive from trades
  const capital_current = capitalRow ? Math.round(capitalRow.capital_current) : Math.round(capital_base + total_pnl)
  const peak_capital = capitalRow ? Math.round(capitalRow.peak_capital) : Math.round(capital_current)

  const user_share_total = Math.round(total_pnl * 0.5)
  const user_share_month = Math.round(curMonthRow?.user_share ?? month_pnl * 0.5)

  // 6. Bot status
  let bot_status
  if (token_status === 'expired') {
    bot_status = 'token_expired'
  } else if (is_live === true) {
    bot_status = 'live'
  } else {
    bot_status = 'paused'
  }

  // 7. Shape monthly rows for the response
  const monthlyOut = (monthly || []).map(m => ({
    month: m.month,
    gross_pnl: Math.round(m.gross_pnl || 0),
    your_share: Math.round(m.user_share ?? (m.gross_pnl || 0) * 0.5),
    trade_count: m.trade_count || 0,
    wins: m.wins || 0,
    losses: m.losses || 0,
  }))

  return NextResponse.json({
    user: {
      name: user_name,
      display: capitalize(user_name),
      token_status,
      is_live: is_live ?? false,
    },
    bot_status,
    kpis: {
      total_pnl: Math.round(total_pnl),
      win_rate,
      trade_count,
      month_pnl: Math.round(month_pnl),
      capital_current,
      capital_base: capitalRow ? Math.round(capital_base) : null,
      user_share_total,
      user_share_month,
    },
    monthly: monthlyOut,
    recent_trades: [...(trades || [])].reverse().slice(0, 25),
    updated_at: new Date().toISOString(),
  })
}
