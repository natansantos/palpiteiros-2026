import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MatchCard from '@/components/match-card'
import type { Match, Prediction, Round } from '@/lib/types'

// Confrontos do mata-mata sem times definidos ficam com rótulos de slot
// ("1º Grupo E", "3º (A/B/C/D/F)", "Vencedor jogo 74", "A definir"). Esses não
// devem aparecer para palpite até que os times reais sejam preenchidos.
function isPlaceholderTeam(name: string | null | undefined): boolean {
  if (!name) return true
  return /^\d+º|^Vencedor jogo|^Perdedor jogo|^A definir/.test(name)
}

export default async function PredictionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: openRounds } = await supabase
    .from('rounds')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  const roundIds = (openRounds ?? []).map((r: Round) => r.id)

  let matches: Match[] = []
  let predictions: Prediction[] = []

  if (roundIds.length > 0) {
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .in('round_id', roundIds)
      .order('match_time', { ascending: true })

    // Esconde jogos do mata-mata ainda sem confronto definido (placeholders).
    matches = (matchData ?? []).filter(
      (m) => !isPlaceholderTeam(m.home_team) && !isPlaceholderTeam(m.away_team)
    )

    if (matches.length > 0) {
      const { data: predData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .in('match_id', matches.map((m) => m.id))

      predictions = predData ?? []
    }
  }

  const predictionsByMatch = new Map(predictions.map((p) => [p.match_id, p]))
  const roundsMap = new Map((openRounds ?? []).map((r: Round) => [r.id, r]))

  if (matches.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="font-bebas text-4xl mb-1" style={{ color: 'var(--text-primary)' }}>Palpites</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>Faça seus palpites para os próximos jogos</p>
        <div
          className="rounded-2xl p-8 text-center border"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
        >
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Nenhuma rodada aberta</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Aguarde o admin abrir uma rodada para palpitar.
          </p>
        </div>
      </div>
    )
  }

  // Próximos: ainda não finalizados (próximo jogo no topo).
  // Finalizados: já encerrados (mais recente no topo).
  const upcoming = matches.filter((m) => m.status !== 'finished')
  const finished = matches.filter((m) => m.status === 'finished').reverse()

  const renderCard = (match: Match) => (
    <MatchCard
      key={match.id}
      match={match}
      prediction={predictionsByMatch.get(match.id) ?? null}
      round={roundsMap.get(match.round_id)}
    />
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="font-bebas text-4xl mb-1" style={{ color: 'var(--text-primary)' }}>Palpites</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Faça seus palpites antes do deadline</p>

      <div className="space-y-4">
        {upcoming.length > 0 && (
          <details open className="group rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--bg-border)' }}>
            <summary
              className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                ⚽ Próximos jogos
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({upcoming.length})</span>
              </span>
              <span className="transition-transform group-open:rotate-90" style={{ color: 'var(--text-muted)' }}>▸</span>
            </summary>
            <div className="space-y-4 p-4 pt-2">
              {upcoming.map(renderCard)}
            </div>
          </details>
        )}

        {finished.length > 0 && (
          <details className="group rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--bg-border)' }}>
            <summary
              className="flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                🏁 Finalizados
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>({finished.length})</span>
              </span>
              <span className="transition-transform group-open:rotate-90" style={{ color: 'var(--text-muted)' }}>▸</span>
            </summary>
            <div className="space-y-4 p-4 pt-2">
              {finished.map(renderCard)}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
