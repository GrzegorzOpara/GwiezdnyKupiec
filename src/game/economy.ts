import { MarketState, Player, TowarId } from './game.types';

// Kalkulator P/P z planszy gry (mapowanie: pozycja żetonu P/P -> modyfikator ceny)
export const PP_CALCULATOR: Record<number, number> = {
  '-18': 7, '-17': 6, '-16': 6, '-15': 5, '-14': 5, '-13': 4, '-12': 4,
  '-11': 3, '-10': 3, '-9': 3, '-8': 2, '-7': 2, '-6': 2, '-5': 1, '-4': 1,
  '-3': 1, '-2': 0, '-1': 0, '0': 0,
  '1': -1, '2': -1, '3': -1, '4': -2, '5': -2, '6': -2, '7': -3, '8': -3,
  '9': -3, '10': -4, '11': -4, '12': -4, '13': -5, '14': -5, '15': -5,
  '16': -6, '17': -6, '18': -6
};

// Bazowe modyfikatory P/P dla towarów (wartości domyślne dla uproszczenia MVP)
export const DEFAULT_MARKET_MODIFIERS: Record<TowarId, number> = {
  izotopy: -6,
  polimery: -6,
  podzespoly: -7,
  zywnosc: -6
};

/**
 * Oblicza nową pozycję żetonu P/P po rzucie 2K i dodaniu modyfikatora rynkowego.
 */
export function calculateNewPPIndicator(baseModifier: number, diceRoll: number): number {
  let newPos = diceRoll + baseModifier;
  if (newPos > 18) newPos = 18;
  if (newPos < -18) newPos = -18;
  return newPos;
}

/**
 * Aktualizuje cenę towaru po zakończeniu fazy handlu, na podstawie obecnej pozycji P/P.
 */
export function resolveMarketFluctuation(market: MarketState, commodity: TowarId): void {
  const currentPP = market.ppIndicator[commodity];
  const priceModifier = PP_CALCULATOR[currentPP] || 0;
  
  let newPrice = market.prices[commodity] + priceModifier;
  
  // Zgodnie z zasadami: cena nigdy nie może przekroczyć 20 ani spaść poniżej 1.
  if (newPrice > 20) newPrice = 20;
  if (newPrice < 1) newPrice = 1;
  
  market.prices[commodity] = newPrice;
}

/**
 * Realizuje pojedynczą transakcję kupna/sprzedaży.
 * Funkcja modyfikuje stan gracza i rynku (pure logic).
 */
export function executeTransaction(
  player: Player,
  market: MarketState,
  commodity: TowarId,
  amount: number,
  price: number,
  isBuy: boolean
): void {
  if (amount <= 0) {
    throw new Error('Ilość towaru musi być większa od zera.');
  }

  const totalCost = amount * price;

  // Upewnijmy się, że gracz ma zainicjalizowany magazyn w tym układzie gwiezdnym
  if (!player.magazyny[market.systemId]) {
    player.magazyny[market.systemId] = { izotopy: 0, polimery: 0, podzespoly: 0, zywnosc: 0 };
  }

  if (isBuy) {
    if (player.gotowka < totalCost) {
      throw new Error(`Niewystarczająca ilość gotówki. Wymagane: ${totalCost}, Posiadane: ${player.gotowka}`);
    }
    
    player.gotowka -= totalCost;
    player.magazyny[market.systemId][commodity] += amount;
    
    // Zgodnie z zasadami, przy kupnie towaru z rynku, żeton P/P przesuwa się w lewo (-)
    market.ppIndicator[commodity] -= amount;
    if (market.ppIndicator[commodity] < -18) market.ppIndicator[commodity] = -18;

  } else {
    // Sprzedaż (z magazynu)
    const availableAmount = player.magazyny[market.systemId][commodity];
    if (availableAmount < amount) {
      throw new Error(`Niewystarczająca ilość towaru w magazynie. Wymagane: ${amount}, Posiadane: ${availableAmount}`);
    }

    player.gotowka += totalCost;
    player.magazyny[market.systemId][commodity] -= amount;
    
    // Przy sprzedaży towaru na rynek, żeton P/P przesuwa się w prawo (+)
    market.ppIndicator[commodity] += amount;
    if (market.ppIndicator[commodity] > 18) market.ppIndicator[commodity] = 18;
  }
}
