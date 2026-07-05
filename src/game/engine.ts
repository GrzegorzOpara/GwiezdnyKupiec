import { GameSession, GamePhase, PlayerTurnIntent } from './game.types';
import { executeTransaction, resolveMarketFluctuation } from './economy';
import { rollMultipleDice } from './utils';
import { applyRandomMarketEvent } from './events';

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
}

/**
 * Faza 3 i 6: Wiadomości i Okazje
 * Uruchamia zdarzenia rynkowe z events.ts
 */
export function resolveWiadomosciOkazjePhase(session: GameSession): void {
  const eventMsg = applyRandomMarketEvent(session);
  if (eventMsg) {
    console.log(`[Engine] Zdarzenie globalne w sesji ${session.sessionId}: ${eventMsg}`);
  }
}

/**
 * Faza 4: Hiperskoki
 * Przesuwa statki zgodnie z deklaracjami graczy, pobiera paliwo/HT.
 */
export function resolveHiperskokiPhase(session: GameSession): void {
  for (const uid of session.initiativeOrder) {
    const player = session.players[uid];
    const intent = session.turnIntents[uid];
    if (!intent || !intent.shipMoves || intent.shipMoves.length === 0) continue;

    for (const move of intent.shipMoves) {
      const ship = player.statki.find(s => s.id === move.shipId);
      if (ship) {
        // Koszt skoku - uproszczone 20 HT za każdy lot
        const jumpCost = 20; 
        if (player.gotowka >= jumpCost) {
          player.gotowka -= jumpCost;
          ship.lokacja.systemId = move.targetSystemId;
          
          // Rzut na uszkodzenia, jeśli brak "Bezpiecznego Skoku"
          if (!ship.moduly.includes('Bezpieczny skok')) {
            const dangerRoll = rollMultipleDice(2);
            if (dangerRoll <= 4) {
               ship.uszkodzenia.push('Uszkodzenie Kadłuba (nadprzestrzeń)');
               console.warn(`[Engine] Statek ${ship.nazwa} gracza ${player.characterName} uszkodzony w nadprzestrzeni!`);
            }
          }
        }
      }
    }
  }
}

/**
 * Faza 7: Inwestycje
 * Gracze kupują nowe statki, płacą podatki od utrzymania floty.
 */
export function resolveInwestycjePhase(session: GameSession): void {
  for (const uid of session.initiativeOrder) {
    const player = session.players[uid];
    const intent = session.turnIntents[uid];
    if (!intent) continue;

    // Pobranie podatku imperialnego na koniec tury (10 HT od każdego statku)
    const tax = player.statki.length * 10;
    player.gotowka = Math.max(0, player.gotowka - tax);

    if (intent.shipPurchases && intent.shipPurchases.length > 0) {
      for (const purchase of intent.shipPurchases) {
        // Oblicz koszt (200 HT + 50 za każdy dodany moduł)
        const cost = 200 + purchase.modules.length * 50;
        if (player.gotowka >= cost) {
          player.gotowka -= cost;
          player.statki.push({
            id: `ship_${Math.random().toString(36).substr(2, 9)}`,
            nazwa: `Statek Floty ${player.characterName}`,
            typKadluba: purchase.hullType,
            moduly: purchase.modules,
            klasaZalogi: 'C',
            ladunek: { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 },
            pasazerowie: 0,
            lokacja: { systemId: purchase.systemId, obszar: 'STOCZNIA' },
            uszkodzenia: []
          });
        }
      }
    }
  }
}

/**
 * Faza 8: Kontrola
 * Zakończenie tury, czyszczenie intencji graczy.
 */
export function resolveKontrolaPhase(session: GameSession): void {
  // Resetujemy intencje do pustego obiektu przed nową turą
  session.turnIntents = {};
}

/**
 * Przechodzi do następnej fazy i wywołuje odpowiednie rezolwery z maszyny stanów.
 */
export function progressToNextPhase(session: GameSession): void {
  switch (session.currentPhase) {
    case GamePhase.LICYTACJA:
      resolveLicytacjaPhase(session);
      session.currentPhase = GamePhase.INICJATYWA;
      break;
    case GamePhase.INICJATYWA:
      resolveInicjatywaPhase(session);
      session.currentPhase = GamePhase.WIADOMOSCI;
      break;
    case GamePhase.WIADOMOSCI:
      resolveWiadomosciOkazjePhase(session);
      session.currentPhase = GamePhase.HIPERSKOKI;
      break;
    case GamePhase.HIPERSKOKI:
      resolveHiperskokiPhase(session);
      session.currentPhase = GamePhase.TRANSAKCJE;
      break;
    case GamePhase.TRANSAKCJE:
      resolveTransakcjePhase(session);
      session.currentPhase = GamePhase.OKAZJE;
      break;
    case GamePhase.OKAZJE:
      resolveWiadomosciOkazjePhase(session);
      session.currentPhase = GamePhase.INWESTYCJE;
      break;
    case GamePhase.INWESTYCJE:
      resolveInwestycjePhase(session);
      session.currentPhase = GamePhase.KONTROLA;
      break;
    case GamePhase.KONTROLA:
      resolveKontrolaPhase(session);
      session.currentTurn += 1;
      session.currentPhase = GamePhase.LICYTACJA;
      break;
  }
}
