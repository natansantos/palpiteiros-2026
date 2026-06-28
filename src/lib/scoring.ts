interface MatchResult {
  home_score: number
  away_score: number
  went_to_penalties: boolean
  penalty_winner: 'home' | 'away' | null
}

interface PredictionInput {
  home_score_pred: number
  away_score_pred: number
  penalty_winner_pred: 'home' | 'away' | null
}

// Multiplicador por fase: o mata-mata vale mais que a fase de grupos, crescendo
// até a final, para tornar a disputa mais aberta nas fases decisivas.
// As chaves correspondem ao campo `rounds.phase` no banco.
export const PHASE_MULTIPLIER: Record<string, number> = {
  group: 1,
  round_of_32: 2,
  round_of_16: 2,
  quarterfinal: 3,
  semifinal: 3,
  third_place: 3,
  final: 4,
}

export function getPhaseMultiplier(phase?: string | null): number {
  if (!phase) return 1
  return PHASE_MULTIPLIER[phase] ?? 1
}

// `phase` é o `rounds.phase` do jogo. O multiplicador incide sobre a pontuação
// total (placar + bônus de pênaltis). Sem phase, assume grupos (×1).
export function calculatePoints(
  result: MatchResult,
  prediction: PredictionInput,
  phase?: string | null
): number {
  const { home_score, away_score, went_to_penalties, penalty_winner } = result
  const { home_score_pred, away_score_pred, penalty_winner_pred } = prediction

  const exactScore = home_score_pred === home_score && away_score_pred === away_score
  const correctResult =
    (home_score_pred > away_score_pred && home_score > away_score) ||
    (home_score_pred < away_score_pred && home_score < away_score) ||
    (home_score_pred === away_score_pred && home_score === away_score)
  const oneTeamGoals = home_score_pred === home_score || away_score_pred === away_score

  let points = 0
  if (exactScore) points = 10
  else if (correctResult && oneTeamGoals) points = 7
  else if (correctResult) points = 5
  else if (oneTeamGoals) points = 2

  if (went_to_penalties && penalty_winner_pred === penalty_winner) {
    points += 3
  }

  return points * getPhaseMultiplier(phase)
}
