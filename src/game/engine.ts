import { GameSession, GamePhase, PlayerTurnIntent } from './game.types';
import { executeTransaction, resolveMarketFluctuation } from './economy';
import { rollMultipleDice } from './utils';

/**
 * Przetwarza koniec Fazy 1 (Licytacja).
 * Gracze zgłosili ile HT chcą wydać na Inicjatywę. Pobieramy tę opłatę z ich kont.
 */
export function resolveLicytacjaPhase(session: GameSession): void {
  for (const uid of Object.keys(session.players)) {
    const player = session.players[uid];
    const intent = session.turnIntents[uid];

    if (intent && intent.initiativeBidHT > 0) {
      if (player.gotowka >= intent.initiativeBidHT) {
        player.gotowka -= intent.initiativeBidHT;
      } else {
        // Jeśli gracz próbował oszukać i wpisał więcej niż ma, wydaje wszystko
        intent.initiativeBidHT = player.gotowka;
        player.gotowka = 0;
      }
    }
  }
}

/**
 * Przetwarza koniec Fazy 2 (Inicjatywa).
 * Na podstawie wydanych HT na licytację i rzutu 2K ustala ostateczną kolejność.
 */
export function resolveInicjatywaPhase(session: GameSession, mockRolls?: Record<string, number>): void {
  const initiativeScores: { uid: string; score: number } = [];

  for (const uid of Object.keys(session.players)) {
    const intent = session.turnIntents[uid];
    const bid = intent ? intent.initiativeBidHT : 0;
    
    // Rzut 2K chyba że mamy spreparowane rzuty (dla testów)
    const roll = mockRolls && mockRolls[uid] !== undefined ? mockRolls[uid] : rollMultipleDice(2);
    
    initiativeScores.push({ uid, score: bid + roll });
  }

  // Sortowanie malejąco wg score (najwyższy wynik to pierwszy gracz)
  // TODO: W przypadku remisów, gracze rzucają ponownie. Dla MVP zostawiamy losowość JS przy remisie.
  initiativeScores.sort((a, b) => b.score - a.score);

  session.initiativeOrder = initiativeScores.map(scoreObj => scoreObj.uid);
}

/**
 * Przetwarza Fazę 5 (Transakcje).
 * Wykonuje zapisane w buforze oferty (z Fazy 1) zgodnie z wyliczoną w Fazie 2 Inicjatywą.
 */
export function resolveTransakcjePhase(session: GameSession): void {
  // Rozpatrujemy wg ustalonej kolejności Inicjatywy
  for (const uid of session.initiativeOrder) {
    const player = session.players[uid];
    const intent = session.turnIntents[uid];

    if (!intent || !intent.offers || intent.offers.length === 0) continue;

    // Przetwarzanie ofert gracza w tej turze
    for (const offer of intent.offers) {
      const market = session.marketState[offer.systemId];
      if (!market) continue;

      try {
        executeTransaction(
          player,
          market,
          offer.commodity,
          offer.amount,
          offer.price, // Gracz deklaruje cenę w ofercie (w MVP dla uproszczenia rynkowego bierzemy pod uwagę to co napisał, ale docelowo powinno tu być porównanie z ofertami innych)
          offer.type === 'BUY'
        );
      } catch (error: any) {
        // Oferta nie powiodła się (np. brak gotówki, brak towaru)
        // W prawdziwej grze logowalibyśmy to dla gracza, tu ignorujemy i przechodzimy do następnej
        console.warn(`[Engine] Transakcja odrzucona dla ${player.characterName}: ${error.message}`);
      }
    }
  }

  // Po wykonaniu wszystkich transakcji kupna/sprzedaży w tej fazie,
  // musimy zaktualizować ceny towarów w każdym układzie gwiezdnym zgodnie z nowymi pozycjami P/P.
  for (const sysId of Object.keys(session.marketState)) {
    const market = session.marketState[sysId];
    for (const commodity of Object.keys(market.prices) as any[]) {
      resolveMarketFluctuation(market, commodity);
    }
  }

  // Czyszczenie bufora na następną turę
  session.turnIntents = {};
}

/**
 * Przechodzi do następnej fazy w MVP (Licytacja -> Inicjatywa -> Transakcje -> Koniec tury)
 */
export function progressToNextPhase(session: GameSession): void {
  if (session.currentPhase === GamePhase.LICYTACJA) {
    resolveLicytacjaPhase(session);
    session.currentPhase = GamePhase.INICJATYWA;
  } else if (session.currentPhase === GamePhase.INICJATYWA) {
    resolveInicjatywaPhase(session);
    // Przeskakujemy na razie Fazy 3 i 4 dla MVP
    session.currentPhase = GamePhase.TRANSAKCJE;
  } else if (session.currentPhase === GamePhase.TRANSAKCJE) {
    resolveTransakcjePhase(session);
    // Koniec tury, powrót do fazy 1
    session.currentTurn += 1;
    session.currentPhase = GamePhase.LICYTACJA;
  }
}
