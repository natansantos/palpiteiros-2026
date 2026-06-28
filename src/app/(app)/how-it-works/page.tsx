export default function HowItWorksPage() {
  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <h1 className="font-bebas text-4xl lg:text-5xl mb-6" style={{ color: 'var(--text-primary)' }}>
        Como Funciona
      </h1>

      {/* Sistema de Palpites */}
      <section className="rounded-2xl border p-6 lg:p-8 mb-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: 'var(--accent-green)' }}>
          Palpites
        </h2>
        <div className="space-y-3 text-sm lg:text-base" style={{ color: 'var(--text-primary)' }}>
          <p><strong>O que eh um palpite?</strong> Voce tenta adivinhar o resultado de um jogo antes dele acontecer.</p>
          <p><strong>Como fazer:</strong> No menu Palpites, escolha o placar (ex: 2 x 1). Se for eliminatoria com empate, escolha o vencedor nos penaltis.</p>
          <p><strong>Prazo:</strong> Voce tem ate 1 hora antes do jogo comear para fazer seu palpite.</p>
        </div>
      </section>

      {/* Pontuacao */}
      <section className="rounded-2xl border p-6 lg:p-8 mb-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: 'var(--accent-yellow)' }}>
          Pontuacao
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="font-bebas text-2xl mb-2" style={{ color: 'var(--accent-green)' }}>10 pts</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Placar Exato</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Acertou o placar perfeito</p>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="font-bebas text-2xl mb-2" style={{ color: 'var(--accent-yellow)' }}>7 pts</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Resultado + Gol</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Acertou vencedor e 1 time</p>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="font-bebas text-2xl mb-2" style={{ color: 'var(--accent-yellow)' }}>5 pts</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Resultado Correto</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Acertou apenas quem venceu</p>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="font-bebas text-2xl mb-2" style={{ color: '#ffb700' }}>2 pts</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Gol Correto</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Acertou gol mas errou resultado</p>
          </div>
          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="font-bebas text-2xl mb-2" style={{ color: '#ff6464' }}>0 pts</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Errou</p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Nao acertou o resultado</p>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          A tabela acima é a pontuação <strong>base</strong> (vale como está na fase de grupos).
        </p>

        {/* Multiplicador por fase */}
        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--accent-yellow)' }}>Vale mais no mata-mata!</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Quanto mais avança a Copa, mais cada acerto vale. A pontuação base é multiplicada pela fase — então uma boa rodada nas fases finais pode virar o ranking.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left font-semibold py-2 pr-3">Fase</th>
                  <th className="text-center font-semibold py-2 px-2">Mult.</th>
                  <th className="text-center font-semibold py-2 px-2">🎯 Exato</th>
                  <th className="text-center font-semibold py-2 px-2">✅ Result.+Gol</th>
                  <th className="text-center font-semibold py-2 px-2">✅ Result.</th>
                  <th className="text-center font-semibold py-2 px-2">⚽ Gol</th>
                  <th className="text-center font-semibold py-2 pl-2">🥅 Bônus pên.</th>
                </tr>
              </thead>
              <tbody style={{ color: 'var(--text-primary)' }}>
                {[
                  { fase: 'Fase de Grupos', mult: '×1', v: [10, 7, 5, 2], bonus: '—' },
                  { fase: '16-avos de Final', mult: '×2', v: [20, 14, 10, 4], bonus: '+6' },
                  { fase: 'Oitavas de Final', mult: '×2', v: [20, 14, 10, 4], bonus: '+6' },
                  { fase: 'Quartas de Final', mult: '×3', v: [30, 21, 15, 6], bonus: '+9' },
                  { fase: 'Semifinal', mult: '×3', v: [30, 21, 15, 6], bonus: '+9' },
                  { fase: 'Disputa de 3º lugar', mult: '×3', v: [30, 21, 15, 6], bonus: '+9' },
                  { fase: 'Final', mult: '×4', v: [40, 28, 20, 8], bonus: '+12' },
                ].map((row) => (
                  <tr key={row.fase} className="border-t" style={{ borderColor: 'var(--bg-border)' }}>
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{row.fase}</td>
                    <td className="text-center py-2 px-2 font-bebas text-base" style={{ color: 'var(--accent-yellow)' }}>{row.mult}</td>
                    <td className="text-center py-2 px-2">{row.v[0]}</td>
                    <td className="text-center py-2 px-2">{row.v[1]}</td>
                    <td className="text-center py-2 px-2">{row.v[2]}</td>
                    <td className="text-center py-2 px-2">{row.v[3]}</td>
                    <td className="text-center py-2 pl-2">{row.bonus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--bg-border)' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--accent-green)' }}>Bônus de pênaltis (mata-mata)</p>
          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Se o jogo for para os pênaltis e você acertar quem avança, ganha <strong>+3 pts</strong> de bônus — que também são multiplicados pela fase (ex.: <strong>+12 na final</strong>). O palpite de pênaltis só conta quando você prevê empate no tempo normal.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Exemplo: placar exato de um empate na final que vai aos pênaltis, com o vencedor certo = 40 + 12 = <strong>52 pts</strong>.
          </p>
        </div>
      </section>

      {/* Ranking */}
      <section className="rounded-2xl border p-6 lg:p-8 mb-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: '#FFD700' }}>
          Ranking
        </h2>
        <div className="space-y-3 text-sm lg:text-base" style={{ color: 'var(--text-primary)' }}>
          <p>Seus pontos sao somados ao longo de todas as rodadas. Veja seu ranking na pagina de Ranking e compete com outros.</p>
          <p>Voce tambem pode ver o TOP 5 da rodada atual para comparar desempenho na rodada especifica.</p>
        </div>
      </section>

      {/* Badges */}
      <section className="rounded-2xl border p-6 lg:p-8 mb-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: 'var(--accent-green)' }}>
          Badges e Conquistas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Perfeito</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">🔮</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Profeta</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">👑</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Invencivel</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">🏆</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Colecionador</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">📈</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Consistente</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">🍀</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Sortudo</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">🚀</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Comeback</p>
          </div>
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
            <div className="text-2xl mb-2">⭐</div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Lenda</p>
          </div>
        </div>
      </section>

      {/* Estatisticas */}
      <section className="rounded-2xl border p-6 lg:p-8 mb-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: 'var(--accent-yellow)' }}>
          Suas Estatisticas
        </h2>
        <div className="space-y-2 text-sm lg:text-base" style={{ color: 'var(--text-primary)' }}>
          <p><strong>Taxa de Acerto:</strong> Porcentagem de palpites que voce acertou</p>
          <p><strong>Pontos por Jogo:</strong> Media de pontos que voce ganha por palpite</p>
          <p><strong>Placar Exato:</strong> Quantas vezes voce acertou o placar perfeito</p>
          <p><strong>Resultado Certo:</strong> Quantas vezes voce acertou quem ganhou</p>
          <p><strong>Times Favoritos:</strong> Os times em que voce mais acerta</p>
          <p><strong>Evolucao de Pontos:</strong> Grafico mostrando como sua pontuacao cresceu</p>
        </div>
      </section>

      {/* Dicas */}
      <section className="rounded-2xl border p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--bg-border)' }}>
        <h2 className="font-bebas text-2xl mb-4" style={{ color: 'var(--accent-green)' }}>
          Dicas
        </h2>
        <ul className="space-y-2 text-sm lg:text-base" style={{ color: 'var(--text-primary)' }}>
          <li>Estude os times e seus jogadores principais</li>
          <li>Nao deixe para a ultima hora - faca seu palpite com antecedencia</li>
          <li>Acompanhe o ranking para saber como voce esta se saindo</li>
          <li>Analise seus times favoritos e tente acertar neles</li>
          <li>Nao desista se comear devagar, voce sempre pode subir</li>
          <li>Diversifique seus palpites, nao coloque tudo em um tipo</li>
        </ul>
      </section>
    </div>
  )
}
