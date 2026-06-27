import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveResultAction } from '@/lib/actions/admin'
import { getTeamNamePTBR } from '@/lib/team-names'
import { getFlagUrl } from '@/lib/country-codes'
import SyncAllButton from '@/components/sync-all-button'
import RecalculatePointsButton from '@/components/recalculate-points-button'
import type { Match } from '@/lib/types'

export default async function ResultsPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data: matches } = await admin
    .from('matches')
    .select('*, rounds(name)')
    .neq('status', 'finished')
    .order('match_time', { ascending: true })

  const { data: finishedMatches } = await admin
    .from('matches')
    .select('*, rounds(name)')
    .eq('status', 'finished')
    .order('match_time', { ascending: false })
    .limit(10)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-bebas text-4xl mb-1" style={{ color: 'var(--text-primary)' }}>Resultados</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Registre os resultados dos jogos</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SyncAllButton />
          <RecalculatePointsButton />
        </div>
      </div>

      <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-muted)' }}>PENDENTES</h2>
      <div className="space-y-3 mb-8">
        {(matches ?? []).map((match: Match & { rounds?: { name: string } }) => {
          const homeName = getTeamNamePTBR(match.home_team)
          const awayName = getTeamNamePTBR(match.away_team)
          const homeFlagUrl = getFlagUrl(match.home_team)
          const awayFlagUrl = getFlagUrl(match.away_team)

          return (
          <div
            key={match.id}
            className="rounded-xl border p-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    {homeFlagUrl && (
                      <div className="w-5 h-3.5 rounded overflow-hidden shrink-0 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={homeFlagUrl} alt={homeName} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {homeName}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {awayName}
                    </span>
                    {awayFlagUrl && (
                      <div className="w-5 h-3.5 rounded overflow-hidden shrink-0 shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={awayFlagUrl} alt={awayName} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {(match.rounds as { name: string } | undefined)?.name} · {new Date(match.match_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <form action={saveResultAction} className="flex flex-wrap gap-3 items-end">
              <input type="hidden" name="match_id" value={match.id} />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="home_score"
                  min="0"
                  max="99"
                  placeholder="0"
                  defaultValue={match.home_score ?? ''}
                  className="font-bebas text-2xl text-center w-12 h-10 rounded-lg outline-none"
                  style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--accent-yellow)' }}
                />
                <span className="font-bebas text-xl" style={{ color: 'var(--text-muted)' }}>×</span>
                <input
                  type="number"
                  name="away_score"
                  min="0"
                  max="99"
                  placeholder="0"
                  defaultValue={match.away_score ?? ''}
                  className="font-bebas text-2xl text-center w-12 h-10 rounded-lg outline-none"
                  style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--accent-yellow)' }}
                />
              </div>

              {match.is_knockout && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <input type="checkbox" name="went_to_penalties" value="true" defaultChecked={match.went_to_penalties} />
                    Pênaltis
                  </label>
                  <select
                    name="penalty_winner"
                    className="text-xs rounded-lg px-2 py-1.5 outline-none"
                    style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    defaultValue={match.penalty_winner ?? ''}
                  >
                    <option value="">Vencedor pên.</option>
                    <option value="home">{homeName}</option>
                    <option value="away">{awayName}</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'var(--accent-green)', color: '#0D0F0E' }}
              >
                Salvar resultado
              </button>
            </form>
          </div>
          )
        })}

        {(!matches || matches.length === 0) && (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum jogo pendente.</p>
        )}
      </div>

      <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-muted)' }}>ÚLTIMOS RESULTADOS</h2>
      <div className="space-y-2">
        {(finishedMatches ?? []).map((match: Match & { rounds?: { name: string } }) => {
          const homeName = getTeamNamePTBR(match.home_team)
          const awayName = getTeamNamePTBR(match.away_team)
          const homeFlagUrl = getFlagUrl(match.home_team)
          const awayFlagUrl = getFlagUrl(match.away_team)

          return (
          <div
            key={match.id}
            className="rounded-xl border p-3"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {homeFlagUrl && (
                    <div className="w-5 h-3.5 rounded overflow-hidden shrink-0 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={homeFlagUrl} alt={homeName} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {homeName}
                  </span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {awayName}
                  </span>
                  {awayFlagUrl && (
                    <div className="w-5 h-3.5 rounded overflow-hidden shrink-0 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={awayFlagUrl} alt={awayName} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <span className="font-bebas text-xl" style={{ color: 'var(--accent-yellow)' }}>
                {match.home_score} × {match.away_score}
              </span>
            </div>

            <form action={saveResultAction} className="flex flex-wrap gap-2 items-center">
              <input type="hidden" name="match_id" value={match.id} />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="home_score"
                  min="0"
                  max="99"
                  defaultValue={match.home_score ?? ''}
                  className="font-bebas text-lg text-center w-10 h-8 rounded-lg outline-none"
                  style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--accent-yellow)' }}
                />
                <span className="font-bebas text-base" style={{ color: 'var(--text-muted)' }}>×</span>
                <input
                  type="number"
                  name="away_score"
                  min="0"
                  max="99"
                  defaultValue={match.away_score ?? ''}
                  className="font-bebas text-lg text-center w-10 h-8 rounded-lg outline-none"
                  style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--accent-yellow)' }}
                />
              </div>
              {match.is_knockout && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                    <input type="checkbox" name="went_to_penalties" value="true" defaultChecked={match.went_to_penalties ?? false} />
                    Pênaltis
                  </label>
                  <select
                    name="penalty_winner"
                    className="text-xs rounded-lg px-2 py-1 outline-none"
                    style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    defaultValue={match.penalty_winner ?? ''}
                  >
                    <option value="">Vencedor pên.</option>
                    <option value="home">{homeName}</option>
                    <option value="away">{awayName}</option>
                  </select>
                </div>
              )}
              <button
                type="submit"
                className="px-2 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'rgba(255,193,7,0.15)', color: 'var(--accent-yellow)', border: '1px solid var(--accent-yellow)' }}
              >
                Corrigir
              </button>
            </form>
          </div>
          )
        })}
      </div>
    </div>
  )
}
