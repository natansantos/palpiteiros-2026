'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePoints } from '@/lib/scoring'
import { getFlag } from '@/lib/flags'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Unauthorized')

  return user
}

export async function createRoundAction(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()

  const name = formData.get('name') as string
  const phase = formData.get('phase') as string

  await admin.from('rounds').insert({ name, phase, status: 'locked' })
  revalidatePath('/admin/rounds')
}

export async function updateRoundStatusAction(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()

  const roundId = formData.get('round_id') as string
  const status = formData.get('status') as string

  await admin.from('rounds').update({ status }).eq('id', roundId)
  revalidatePath('/admin/rounds')
}

export async function unlockAllGroupsAction() {
  await assertAdmin()
  const admin = createAdminClient()
  await admin.from('rounds').update({ status: 'open' }).eq('phase', 'group').eq('status', 'locked')
  revalidatePath('/admin/rounds')
}

export async function createMatchAction(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()

  const roundId = formData.get('round_id') as string
  const homeTeam = formData.get('home_team') as string
  const awayTeam = formData.get('away_team') as string
  const homeFlag = (formData.get('home_flag') as string) || null
  const awayFlag = (formData.get('away_flag') as string) || null
  const matchTime = formData.get('match_time') as string
  const apiFixtureId = formData.get('api_fixture_id')
  const isKnockout = formData.get('is_knockout') === 'true'

  await admin.from('matches').insert({
    round_id: roundId,
    home_team: homeTeam,
    away_team: awayTeam,
    home_flag: homeFlag,
    away_flag: awayFlag,
    match_time: new Date(matchTime + '-03:00').toISOString(),
    is_knockout: isKnockout,
    api_fixture_id: apiFixtureId ? parseInt(apiFixtureId as string) : null,
    status: 'upcoming',
  })

  revalidatePath('/admin/matches')
}

export async function updateMatchTimeAction(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()

  const matchId = formData.get('match_id') as string
  const matchTime = formData.get('match_time') as string
  // datetime-local input is in Brasília time (UTC-3)
  const matchTimeUtc = new Date(matchTime + '-03:00').toISOString()

  await admin.from('matches').update({ match_time: matchTimeUtc }).eq('id', matchId)
  revalidatePath('/admin/matches')
  revalidatePath('/predictions')
}

export async function resyncMatchTimesAction(): Promise<{
  error: string | null
  updated: number
  skipped: string[]
  report: string[]
}> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Sem permissão', updated: 0, skipped: [], report: [] }
  }

  const admin = createAdminClient()
  const apiKey = process.env.ZAFRONIX_API_KEY
  if (!apiKey) return { error: 'ZAFRONIX_API_KEY não configurada', updated: 0, skipped: [], report: [] }

  try {
    const res = await fetch('https://api.zafronix.com/fifa/worldcup/v1/matches?year=2026', {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    })
    if (!res.ok) return { error: `Erro na API: HTTP ${res.status}`, updated: 0, skipped: [], report: [] }

    const json = await res.json()
    const apiMatches: ZafronixMatch[] = json?.data ?? []

    const { data: dbMatches } = await admin.from('matches').select('id, home_team, away_team, match_time')
    if (!dbMatches) return { error: 'Erro ao buscar jogos do banco', updated: 0, skipped: [], report: [] }

    let updated = 0
    const report: string[] = []
    const skipped: string[] = []

    const toBRT = (iso: string) =>
      new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ')

    for (const db of dbMatches) {
      const api = apiMatches.find(m => m.homeTeam === db.home_team && m.awayTeam === db.away_team)

      if (!api) {
        skipped.push(`Não achado na API: ${db.home_team} × ${db.away_team}`)
        continue
      }

      if (!api.kickoffUtc) {
        skipped.push(`kickoffUtc nulo: ${db.home_team} × ${db.away_team}`)
        continue
      }

      const currentIso = new Date(db.match_time).toISOString()
      const apiIso = new Date(api.kickoffUtc).toISOString()

      if (currentIso === apiIso) continue

      await admin.from('matches').update({ match_time: apiIso }).eq('id', db.id)
      report.push(`${db.home_team} × ${db.away_team}: ${toBRT(currentIso)} → ${toBRT(apiIso)} (Brasília)`)
      updated++
    }

    revalidatePath('/admin/matches')
    revalidatePath('/predictions')
    revalidatePath('/ranking')

    return { error: null, updated, skipped, report }
  } catch (e) {
    return { error: `Exceção: ${e instanceof Error ? e.message : String(e)}`, updated: 0, skipped: [], report: [] }
  }
}

export async function recalculateAllPointsAction(): Promise<{ error: string | null; matches: number; predictions: number }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Sem permissão', matches: 0, predictions: 0 }
  }

  const admin = createAdminClient()

  const { data: finishedMatches } = await admin
    .from('matches')
    .select('id, home_score, away_score, went_to_penalties, penalty_winner')
    .eq('status', 'finished')

  if (!finishedMatches || finishedMatches.length === 0) {
    return { error: null, matches: 0, predictions: 0 }
  }

  let totalPredictions = 0

  for (const match of finishedMatches) {
    if (match.home_score === null || match.away_score === null) continue

    const { data: predictions } = await admin
      .from('predictions')
      .select('id, home_score_pred, away_score_pred, penalty_winner_pred')
      .eq('match_id', match.id)

    for (const pred of predictions ?? []) {
      const points = calculatePoints(
        {
          home_score: match.home_score,
          away_score: match.away_score,
          went_to_penalties: match.went_to_penalties ?? false,
          penalty_winner: match.penalty_winner ?? null,
        },
        {
          home_score_pred: pred.home_score_pred,
          away_score_pred: pred.away_score_pred,
          penalty_winner_pred: pred.penalty_winner_pred ?? null,
        }
      )
      await admin.from('predictions').update({ points }).eq('id', pred.id)
      totalPredictions++
    }
  }

  revalidatePath('/predictions')
  revalidatePath('/ranking')
  revalidatePath('/history')
  revalidatePath('/admin/results')

  return { error: null, matches: finishedMatches.length, predictions: totalPredictions }
}

export async function saveResultAction(formData: FormData) {
  await assertAdmin()
  const admin = createAdminClient()

  const matchId = formData.get('match_id') as string
  const homeScore = parseInt(formData.get('home_score') as string)
  const awayScore = parseInt(formData.get('away_score') as string)
  const wentToPenalties = formData.get('went_to_penalties') === 'true'
  const penaltyWinner = (formData.get('penalty_winner') as 'home' | 'away') || null

  await admin.from('matches').update({
    home_score: homeScore,
    away_score: awayScore,
    went_to_penalties: wentToPenalties,
    penalty_winner: penaltyWinner,
    status: 'finished',
  }).eq('id', matchId)

  await computePoints(matchId, homeScore, awayScore, wentToPenalties, penaltyWinner)

  revalidatePath('/admin/results')
  revalidatePath('/predictions')
  revalidatePath('/ranking')
  revalidatePath('/history')
}

async function computePoints(
  matchId: string,
  homeScore: number,
  awayScore: number,
  wentToPenalties: boolean,
  penaltyWinner: 'home' | 'away' | null
) {
  const admin = createAdminClient()

  const { data: predictions } = await admin
    .from('predictions')
    .select('id, home_score_pred, away_score_pred, penalty_winner_pred')
    .eq('match_id', matchId)

  if (!predictions || predictions.length === 0) return

  for (const pred of predictions) {
    const points = calculatePoints(
      { home_score: homeScore, away_score: awayScore, went_to_penalties: wentToPenalties, penalty_winner: penaltyWinner },
      { home_score_pred: pred.home_score_pred, away_score_pred: pred.away_score_pred, penalty_winner_pred: pred.penalty_winner_pred }
    )

    await admin.from('predictions').update({ points }).eq('id', pred.id)
  }
}

export async function syncAllPendingFromApiAction() {
  await assertAdmin()
  const admin = createAdminClient()

  const apiKey = process.env.ZAFRONIX_API_KEY
  if (!apiKey) return { error: 'ZAFRONIX_API_KEY não configurada', synced: 0 }

  try {
    const res = await fetch('https://api.zafronix.com/fifa/worldcup/v1/matches?year=2026', {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    })

    if (!res.ok) return { error: `Erro na API Zafronix: HTTP ${res.status}`, synced: 0 }

    const json = await res.json()
    const allMatches: ZafronixMatch[] = json?.data ?? []

    if (allMatches.length === 0) {
      return { error: 'Nenhum jogo retornado pela API', synced: 0 }
    }

    const { data: pendingMatches } = await admin
      .from('matches')
      .select('id, home_team, away_team')
      .neq('status', 'finished')

    if (!pendingMatches || pendingMatches.length === 0) {
      return { error: null, synced: 0 }
    }

    let synced = 0

    for (const pending of pendingMatches) {
      const apiMatch = allMatches.find(
        (m) => m.homeTeam === pending.home_team && m.awayTeam === pending.away_team
      )

      if (!apiMatch || apiMatch.homeScore === null || apiMatch.awayScore === null) {
        continue
      }

      const homeScore = apiMatch.homeScore
      const awayScore = apiMatch.awayScore
      const wentToPenalties = false
      const penaltyWinner = null

      await admin.from('matches').update({
        home_score: homeScore,
        away_score: awayScore,
        went_to_penalties: wentToPenalties,
        penalty_winner: penaltyWinner,
        status: 'finished',
      }).eq('id', pending.id)

      await computePoints(pending.id, homeScore, awayScore, wentToPenalties, penaltyWinner)
      synced++
    }

    revalidatePath('/admin/results')
    revalidatePath('/predictions')
    revalidatePath('/ranking')
    revalidatePath('/history')

    return { error: null, synced }
  } catch (err) {
    return { error: 'Erro ao sincronizar da API', synced: 0 }
  }
}

type ZafronixMatch = {
  id: string
  matchNo?: number | null
  date: string
  kickoff: string
  kickoffUtc: string | null
  stage: string
  // stageNormalized usa nomes longos (round_of_32, quarter_final, ...).
  // stage usa códigos curtos (r32, qf, ...). Sempre normalize antes de mapear.
  stageNormalized?: string
  homeTeam: string | null
  awayTeam: string | null
  homeRef?: string | null
  awayRef?: string | null
  homeScore: number | null
  awayScore: number | null
}

function zafronixStageToRoundName(stage: string): string {
  if (stage.startsWith('group_')) {
    const letter = stage.replace('group_', '').toUpperCase()
    return `Grupo ${letter}`
  }
  const map: Record<string, string> = {
    round_of_32: 'Rodada de 32',
    round_of_16: 'Oitavas de Final',
    quarter_final: 'Quartas de Final',
    semi_final: 'Semifinal',
    third_place: 'Terceiro Lugar',
    final: 'Final',
  }
  return map[stage] ?? stage
}

function zafronixStageToPhase(stage: string): string {
  if (stage.startsWith('group_')) return 'group'
  const map: Record<string, string> = {
    round_of_32: 'round_of_32',
    round_of_16: 'round_of_16',
    quarter_final: 'quarterfinal',
    semi_final: 'semifinal',
    third_place: 'third_place',
    final: 'final',
  }
  return map[stage] ?? 'final'
}

const STAGE_ORDER = [
  'group_a','group_b','group_c','group_d','group_e','group_f',
  'group_g','group_h','group_i','group_j','group_k','group_l',
  'round_of_32','round_of_16','quarter_final','semi_final','third_place','final',
]

// Antes do sorteio do mata-mata os times vêm null; a API só envia o slot
// (homeRef/awayRef): "2A" (2º do Grupo A), "3ABCDF" (3º colocado),
// "W74" (vencedor do jogo 74), "L101" (perdedor do jogo 101).
// Convertemos para um rótulo legível e ÚNICO por confronto — isso também
// evita que a deduplicação por (home/away) colapse todos os jogos vazios.
function refToPlaceholder(ref: string | null | undefined): string {
  if (!ref) return 'A definir'
  let mt = ref.match(/^([123])([A-L])$/)
  if (mt) return `${mt[1]}º Grupo ${mt[2]}`
  mt = ref.match(/^([123])([A-L]{2,})$/)
  if (mt) return `${mt[1]}º (${mt[2].split('').join('/')})`
  mt = ref.match(/^W(\d+)$/)
  if (mt) return `Vencedor jogo ${mt[1]}`
  mt = ref.match(/^L(\d+)$/)
  if (mt) return `Perdedor jogo ${mt[1]}`
  return ref
}

export async function seedWorldCupAction(): Promise<{ error: string | null; inserted: number }> {
  try {
    await assertAdmin()
  } catch (e) {
    return { error: `Sem permissão: ${e instanceof Error ? e.message : String(e)}`, inserted: 0 }
  }

  const apiKey = process.env.ZAFRONIX_API_KEY
  if (!apiKey) return { error: 'ZAFRONIX_API_KEY não configurada no .env.local', inserted: 0 }

  const admin = createAdminClient()

  try {
    // Busca todos os jogos da Copa 2026 via Zafronix API
    const res = await fetch('https://api.zafronix.com/fifa/worldcup/v1/matches?year=2026', {
      headers: { 'X-API-Key': apiKey },
      cache: 'no-store',
    })

    if (!res.ok) return { error: `Erro na API Zafronix: HTTP ${res.status}`, inserted: 0 }

    const json = await res.json()
    const matches: ZafronixMatch[] = json?.data ?? []

    if (matches.length === 0) {
      return { error: 'Nenhum jogo retornado pela API. Verifique a chave ZAFRONIX_API_KEY.', inserted: 0 }
    }

    // Agrupa por stage NORMALIZADO (round_of_32, quarter_final, ...).
    // O campo `stage` traz códigos curtos (r32, qf) que não batem com os mapas.
    const stageMap = new Map<string, ZafronixMatch[]>()
    for (const m of matches) {
      const stage = m.stageNormalized ?? m.stage
      if (!stageMap.has(stage)) stageMap.set(stage, [])
      stageMap.get(stage)!.push(m)
    }

    const sortedStages = Array.from(stageMap.keys()).sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(a)
      const bi = STAGE_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    let inserted = 0

    for (const stage of sortedStages) {
      const stageMatches = stageMap.get(stage)!
      const roundName = zafronixStageToRoundName(stage)
      const phase = zafronixStageToPhase(stage)
      const isKnockout = phase !== 'group'

      const { data: existing } = await admin.from('rounds').select('id').eq('name', roundName).maybeSingle()
      let roundId: string

      if (existing?.id) {
        roundId = existing.id
      } else {
        const { data: newRound } = await admin
          .from('rounds')
          .insert({ name: roundName, phase, status: 'locked' })
          .select('id')
          .single()
        if (!newRound?.id) continue
        roundId = newRound.id
      }

      // Ordena os jogos do stage por data/horário
      stageMatches.sort((a, b) => {
        const da = a.kickoffUtc ?? `${a.date}T${a.kickoff}`
        const db = b.kickoffUtc ?? `${b.date}T${b.kickoff}`
        return da.localeCompare(db)
      })

      for (const m of stageMatches) {
        // Mata-mata sem sorteio ainda: usa o slot (homeRef/awayRef) como rótulo
        // legível, para o confronto aparecer mesmo sem os times definidos.
        const homeTeam = m.homeTeam ?? refToPlaceholder(m.homeRef)
        const awayTeam = m.awayTeam ?? refToPlaceholder(m.awayRef)

        // Usa kickoffUtc (UTC real) — kickoff é horário local do estádio
        const matchTime = m.kickoffUtc ?? `${m.date}T${m.kickoff}:00Z`
        // matchNo (1–104) é a chave estável de cada jogo na API. Guardamos em
        // api_fixture_id para o upsert: quando o sorteio definir os times, uma
        // nova rodada do botão ATUALIZA o placeholder em vez de duplicar.
        const matchNo = m.matchNo ?? null

        // Procura o jogo já existente: 1) pela chave estável (matchNo);
        // 2) fallback por (rodada + times) para casar jogos antigos que ainda
        //    não tinham api_fixture_id e fazer o backfill.
        let existingId: string | null = null
        if (matchNo != null) {
          const { data: byNo } = await admin
            .from('matches')
            .select('id')
            .eq('api_fixture_id', matchNo)
            .maybeSingle()
          existingId = byNo?.id ?? null
        }
        if (!existingId) {
          const { data: byTeams } = await admin
            .from('matches')
            .select('id')
            .eq('round_id', roundId)
            .eq('home_team', homeTeam)
            .eq('away_team', awayTeam)
            .maybeSingle()
          existingId = byTeams?.id ?? null
        }

        // Não sobrescreve placar/status: só os dados do confronto.
        const fields = {
          round_id: roundId,
          home_team: homeTeam,
          away_team: awayTeam,
          home_flag: getFlag(homeTeam),
          away_flag: getFlag(awayTeam),
          match_time: matchTime,
          is_knockout: isKnockout,
          api_fixture_id: matchNo,
        }

        if (existingId) {
          await admin.from('matches').update(fields).eq('id', existingId)
        } else {
          await admin.from('matches').insert({ ...fields, status: 'upcoming' })
          inserted++
        }
      }
    }

    revalidatePath('/admin/rounds')
    revalidatePath('/admin/matches')
    return { error: null, inserted }

  } catch (e) {
    return { error: `Exceção: ${e instanceof Error ? e.message : String(e)}`, inserted: 0 }
  }
}

export async function createInviteAction() {
  const user = await assertAdmin()
  const admin = createAdminClient()

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  await admin.from('invite_links').insert({
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
    used: false,
  })

  revalidatePath('/admin/invites')
}
