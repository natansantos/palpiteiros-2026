import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePoints } from '@/lib/scoring'
import { sendPush, type PushSubscriptionJSON } from '@/lib/push'

// Vercel sends Authorization: Bearer $CRON_SECRET automatically for cron-triggered requests.
// External cron services (cron-job.org etc.) must include the same header manually.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = process.env.ZAFRONIX_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ZAFRONIX_API_KEY não configurada' }, { status: 500 })
  }

  const admin = createAdminClient()

  // match_time é o horário de INÍCIO do jogo. Só considera jogos que já
  // deveriam ter terminado: 3 horas após o início (match_time + 180 min),
  // cobrindo tempo normal + intervalo + prorrogação/pênaltis. O guard de
  // status da API abaixo ainda evita finalizar partidas em andamento.
  const cutoff = new Date(Date.now() - 180 * 60 * 1000).toISOString()

  const { data: pendingMatches } = await admin
    .from('matches')
    .select('id, home_team, away_team, match_time, rounds(phase)')
    .neq('status', 'finished')
    .lt('match_time', cutoff)

  if (!pendingMatches || pendingMatches.length === 0) {
    return NextResponse.json({ synced: 0, checked: 0, message: 'Nenhum jogo aguardando resultado' })
  }

  const res = await fetch('https://api.zafronix.com/fifa/worldcup/v1/matches?year=2026', {
    headers: { 'X-API-Key': apiKey },
    cache: 'no-store',
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Zafronix API error: HTTP ${res.status}` }, { status: 502 })
  }

  const json = await res.json()
  const apiMatches: Array<{
    homeTeam: string
    awayTeam: string
    homeScore: number | null
    awayScore: number | null
    // optional fields the API may return indicating actual match end
    status?: string
    matchStatus?: string
    state?: string
    endedAt?: string
    finishedAt?: string
    endTime?: string
  }> = json?.data ?? []

  let synced = 0
  const log: string[] = []

  for (const match of pendingMatches) {
    const apiMatch = apiMatches.find(
      (m) => m.homeTeam === match.home_team && m.awayTeam === match.away_team
    )

    if (!apiMatch || apiMatch.homeScore === null || apiMatch.awayScore === null) {
      log.push(`pending: ${match.home_team} × ${match.away_team}`)
      continue
    }

    // If the API reports a status, only finalize when it indicates the match is over.
    // This prevents recording partial scores for matches still in progress.
    const apiStatus = (apiMatch.status ?? apiMatch.matchStatus ?? apiMatch.state ?? '').toUpperCase()
    if (apiStatus && !['FINISHED', 'FT', 'COMPLETED', 'ENDED', 'FULL_TIME', 'POST'].includes(apiStatus)) {
      log.push(`in-progress (status=${apiStatus}): ${match.home_team} × ${match.away_team}`)
      continue
    }

    // If the API provides the actual end time, use it for the 30-min buffer check instead of estimated match_time.
    const apiEndRaw = apiMatch.endedAt ?? apiMatch.finishedAt ?? apiMatch.endTime
    if (apiEndRaw) {
      const endedAt = new Date(apiEndRaw)
      const bufferMs = 30 * 60 * 1000
      if (Date.now() < endedAt.getTime() + bufferMs) {
        log.push(`too-soon after end (ended=${apiEndRaw}): ${match.home_team} × ${match.away_team}`)
        continue
      }
    }

    const homeScore = apiMatch.homeScore
    const awayScore = apiMatch.awayScore

    await admin.from('matches').update({
      home_score: homeScore,
      away_score: awayScore,
      went_to_penalties: false,
      penalty_winner: null,
      status: 'finished',
    }).eq('id', match.id)

    const { data: predictions } = await admin
      .from('predictions')
      .select('id, user_id, home_score_pred, away_score_pred, penalty_winner_pred')
      .eq('match_id', match.id)

    const phase = (match as { rounds?: { phase?: string } | null }).rounds?.phase ?? null

    for (const pred of predictions ?? []) {
      const points = calculatePoints(
        { home_score: homeScore, away_score: awayScore, went_to_penalties: false, penalty_winner: null },
        { home_score_pred: pred.home_score_pred, away_score_pred: pred.away_score_pred, penalty_winner_pred: pred.penalty_winner_pred ?? null },
        phase
      )
      await admin.from('predictions').update({ points }).eq('id', pred.id)

      await sendResultNotification(admin, pred.user_id, match, homeScore, awayScore, points)
    }

    await sendRoundSummaryIfComplete(admin, match)

    log.push(`synced: ${match.home_team} × ${match.away_team} ${homeScore}-${awayScore}`)
    synced++
  }

  return NextResponse.json({ synced, checked: pendingMatches.length, log })
}

function pointsLabel(points: number): string {
  if (points === 10) return '🎯 Placar exato!'
  if (points >= 7)   return '✅ Resultado + gol certo'
  if (points >= 5)   return '✅ Resultado certo'
  if (points >= 2)   return '⚽ Parcialmente certo'
  return '❌ Sem pontos desta vez'
}

async function sendResultNotification(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  match: { id: string; home_team: string; away_team: string },
  homeScore: number,
  awayScore: number,
  points: number
) {
  const { data: already } = await admin
    .from('notification_log')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'match_result')
    .eq('reference_id', match.id)
    .maybeSingle()

  if (already) return

  const { data: profile } = await admin
    .from('profiles')
    .select('notify_result')
    .eq('id', userId)
    .single()

  if (!profile?.notify_result) return

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', userId)

  let sent = false
  for (const row of subs ?? []) {
    const ok = await sendPush(row.subscription as PushSubscriptionJSON, {
      title: `${match.home_team} ${homeScore}×${awayScore} ${match.away_team}`,
      body: `${pointsLabel(points)} — +${points} pontos`,
      url: '/history',
      tag: `result-${match.id}`,
    })
    if (!ok) {
      await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
    } else {
      sent = true
    }
  }

  if (sent) {
    await admin.from('notification_log').insert({
      user_id: userId,
      type: 'match_result',
      reference_id: match.id,
    })
  }
}

async function sendRoundSummaryIfComplete(
  admin: ReturnType<typeof createAdminClient>,
  finishedMatch: { id: string }
) {
  // Find the round this match belongs to
  const { data: matchRow } = await admin
    .from('matches')
    .select('round_id')
    .eq('id', finishedMatch.id)
    .single()

  if (!matchRow?.round_id) return

  // Check if all matches in the round are finished
  const { data: roundMatches } = await admin
    .from('matches')
    .select('id, status')
    .eq('round_id', matchRow.round_id)

  if (!roundMatches || roundMatches.some(m => m.status !== 'finished')) return

  // All done — send round summary to each user
  const { data: users } = await admin
    .from('profiles')
    .select('id, name')
    .eq('notify_round_summary', true)

  for (const user of users ?? []) {
    const { data: already } = await admin
      .from('notification_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', 'round_summary')
      .eq('reference_id', matchRow.round_id)
      .maybeSingle()

    if (already) continue

    // Sum points for this round
    const matchIds = roundMatches.map(m => m.id)
    const { data: preds } = await admin
      .from('predictions')
      .select('points')
      .eq('user_id', user.id)
      .in('match_id', matchIds)

    const total = (preds ?? []).reduce((sum, p) => sum + (p.points ?? 0), 0)

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('subscription, endpoint')
      .eq('user_id', user.id)

    let sent = false
    for (const row of subs ?? []) {
      const ok = await sendPush(row.subscription as PushSubscriptionJSON, {
        title: '🏁 Rodada encerrada!',
        body: `Você fez ${total} ponto${total !== 1 ? 's' : ''} nesta rodada. Veja o ranking!`,
        url: '/ranking',
        tag: `round-${matchRow.round_id}`,
      })
      if (!ok) {
        await admin.from('push_subscriptions').delete().eq('endpoint', row.endpoint)
      } else {
        sent = true
      }
    }

    if (sent) {
      await admin.from('notification_log').insert({
        user_id: user.id,
        type: 'round_summary',
        reference_id: matchRow.round_id,
      })
    }
  }
}
