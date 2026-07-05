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

    // Przetwarzanie ofert gracza w tej turze (sekwencyjnie wg inicjatywy)
    for (const offer of intent.offers) {
      const market = session.marketState[offer.systemId];
      if (!market) continue;

      try {
        executeTransaction(
          player,
          market,
          offer.commodity,
          offer.amount,
          offer.limitPrice, // Gracz deklaruje limit
          offer.type === 'BUY'
        );
        // NATYCHMIASTOWA fluktuacja rynku po transakcji
        resolveMarketFluctuation(market, offer.commodity);
      } catch (error: any) {
        console.warn(`[Engine] Transakcja odrzucona dla ${player.characterName}: ${error.message}`);
      }
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
 * Przesuwa statki zgodnie z deklaracjami graczy, pobiera paliwo.
 * Zwraca true jeśli wykryto walkę (Piraci), powodując pauzę.
 */
export function resolveHiperskokiPhase(session: GameSession): boolean {
  let combatDetected = false;

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
          ship.lokacja.obszar = 'PRZESTRZEN'; // statki w locie trafiają w przestrzeń kosmiczną
          
          // Rzut na uszkodzenia, jeśli brak "Bezpiecznego Skoku"
          if (!ship.moduly.includes('Bezpieczny skok')) {
            const dangerRoll = rollMultipleDice(2);
            if (dangerRoll <= 4) {
               ship.uszkodzenia.push('Uszkodzenie Kadłuba (nadprzestrzeń)');
               console.warn(`[Engine] Statek ${ship.nazwa} gracza ${player.characterName} uszkodzony w nadprzestrzeni!`);
            }
          }

          // Dostarczenie pasażerów do ich celów podróży
          if (ship.pasazerowie && ship.pasazerowie.length > 0) {
            const delivered = ship.pasazerowie.filter(p => p.celSystemId === ship.lokacja.systemId);
            if (delivered.length > 0) {
              const reward = delivered.reduce((sum, p) => sum + p.nagrodaHT, 0);
              player.gotowka += reward;
              ship.pasazerowie = ship.pasazerowie.filter(p => p.celSystemId !== ship.lokacja.systemId);
              console.log(`[Engine] Gracz ${player.characterName} dowiózł pasażerów do ${ship.lokacja.systemId}. Nagroda: ${reward} HT!`);
            }
          }

          // Rzut na Piratów (15% szans w przestrzeni)
          const pirateRoll = Math.random();
          if (pirateRoll < 0.15) {
            combatDetected = true;
            console.log(`[Engine] UWAGA! Piraci przechwycili statek ${ship.nazwa}!`);
          }
        }
      }
    }
  }

  return combatDetected;
}

/**
 * Faza 7: Inwestycje
 * Gracze kupują nowe statki, fabryki, biorą pożyczki i spłacają podatki.
 */
export function resolveInwestycjePhase(session: GameSession): void {
  for (const uid of session.initiativeOrder) {
    const player = session.players[uid];
    const intent = session.turnIntents[uid];
    if (!intent) continue;

    // 1. Utrzymanie floty (Podatek imperialny: 10 HT od każdego statku)
    const tax = player.statki.length * 10;
    player.gotowka -= tax; // może wejść na minus na chwilę

    // 2. Pożyczki bankowe
    if (intent.loanRequests && intent.loanRequests > 0) {
      // Bierzemy nową pożyczkę (w MVP uproszczony brak sprawdzania limitu zdolności)
      player.dlugBankowy += intent.loanRequests;
      player.gotowka += intent.loanRequests;
    }

    // 3. Spłata odsetek (10% co turę)
    if (player.dlugBankowy > 0) {
      const interest = Math.ceil(player.dlugBankowy * 0.1);
      player.gotowka -= interest;
    }

    // 4. Spłata długu
    if (intent.loanRepayments && intent.loanRepayments > 0) {
      const repayment = Math.min(intent.loanRepayments, player.gotowka, player.dlugBankowy);
      if (repayment > 0) {
        player.gotowka -= repayment;
        player.dlugBankowy -= repayment;
      }
    }

    // Jeśli gracz jest mocno na minusie po podatkach i odsetkach (Bankructwo)
    if (player.gotowka < 0) {
      player.dlugBankowy += Math.abs(player.gotowka);
      player.gotowka = 0;
    }

    // Kara za przekroczenie długu (Limit kredytowy wynosi np. 300 HT)
    if (player.dlugBankowy > 300) {
      console.warn(`[Engine] Gracz ${player.characterName} przekroczył limit kredytowy (${player.dlugBankowy} HT / 300 HT)!`);
      if (player.statki.length > 0) {
        const seizedShip = player.statki.pop(); // Konfiskujemy ostatni statek
        player.dlugBankowy = Math.max(0, player.dlugBankowy - 150);
        player.reputacja = Math.max(0, player.reputacja - 5);
        console.warn(`[Engine] Bank skonfiskował statek ${seizedShip?.nazwa} gracza ${player.characterName} i zmniejszył dług o 150 HT.`);
      } else {
        player.reputacja = Math.max(0, player.reputacja - 10);
        player.magazyny = {}; 
        player.dlugBankowy = Math.max(0, player.dlugBankowy - 100);
        console.warn(`[Engine] Brak statków! Bank skonfiskował towary z magazynów i obniżył reputację gracza ${player.characterName} o 10.`);
      }
    }

    // 5. Zakup statków
    if (intent.shipPurchases && intent.shipPurchases.length > 0) {
      for (const purchase of intent.shipPurchases) {
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
            pasazerowie: [],
            lokacja: { systemId: purchase.systemId, obszar: 'STOCZNIA' },
            uszkodzenia: []
          });
        }
      }
    }

    // 6. Zakup fabryk
    if (intent.factoryPurchases && intent.factoryPurchases.length > 0) {
      for (const f of intent.factoryPurchases) {
        const cost = f.size * 100;
        if (player.gotowka >= cost) {
          player.gotowka -= cost;
          if (!player.fabryki[f.systemId]) player.fabryki[f.systemId] = { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 };
          player.fabryki[f.systemId][f.commodity] += f.size;
        }
      }
    }

    // 7. Załadunek pasażerów
    if (intent.loadPassengers && intent.loadPassengers.length > 0) {
      const SYSTEM_IDS = ['mu_herculis', 'tau_ceti', 'beta_hydri', 'epsilon_eridani', 'gamma_leporis', 'sigma_octantis'];
      for (const req of intent.loadPassengers) {
        const ship = player.statki.find(s => s.id === req.shipId);
        if (ship && (ship.lokacja.obszar === 'PORT' || ship.lokacja.obszar === 'STOCZNIA' || ship.lokacja.obszar === 'PLANETA')) {
          const currentPasCount = ship.pasazerowie ? ship.pasazerowie.length : 0;
          const maxPas = ship.moduly.filter(m => m.toLowerCase().includes('pasażer') || m.toLowerCase().includes('kabina')).length;
          
          const slotsAvailable = maxPas - currentPasCount;
          const toLoad = Math.min(req.amount, slotsAvailable);
          
          for (let i = 0; i < toLoad; i++) {
             const otherSystems = SYSTEM_IDS.filter(sysId => sysId !== ship.lokacja.systemId);
             const randomSys = otherSystems[Math.floor(Math.random() * otherSystems.length)];
             ship.pasazerowie.push({
               celSystemId: randomSys,
               nagrodaHT: 50
             });
             console.log(`[Engine] Gracz ${player.characterName} załadował pasażera na statek ${ship.nazwa}. Cel: ${randomSys}`);
          }
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

export function resumeFromCombatPhase(session: GameSession): void {
  if (session.status === 'COMBAT_PAUSE') {
    session.status = 'ACTIVE';
    session.currentPhase = GamePhase.TRANSAKCJE; // kontynuacja po walce
    console.log(`[Engine] Wznowiono grę po walce! Przechodzimy do Fazy Transakcji.`);
  }
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
      const combat = resolveHiperskokiPhase(session);
      if (combat) {
        session.status = 'COMBAT_PAUSE';
        // Zatrzymujemy postęp w tym punkcie. Zewnętrzny timer musi poczekać na wznowienie!
        return;
      }
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
