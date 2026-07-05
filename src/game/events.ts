import { GameSession, MarketState, TowarId } from './game.types';

// Struktura wydarzenia rynkowego
export interface MarketEvent {
  description: string;
  apply: (market: MarketState) => void;
}

// Prosta pula losowych wydarzeń rynkowych (Wypadki, Odkrycia, Kryzysy)
const EVENT_POOL: MarketEvent[] = [
  {
    description: 'Kryzys izotopowy! Spadek P/P izotopów o 5 jednostek.',
    apply: (market: MarketState) => {
      market.ppIndicator.izotopy = Math.max(-18, market.ppIndicator.izotopy - 5);
    }
  },
  {
    description: 'Urodzaj rolniczy. Wzrost P/P żywności o 4 jednostki.',
    apply: (market: MarketState) => {
      market.ppIndicator.zywnosc = Math.min(18, market.ppIndicator.zywnosc + 4);
    }
  },
  {
    description: 'Awaria fabryk. Ceny polimerów nagle podskoczyły o 3 HT!',
    apply: (market: MarketState) => {
      market.prices.polimery = Math.min(20, market.prices.polimery + 3);
    }
  },
  {
    description: 'Zalew taniej elektroniki na rynku. P/P podzespołów rośnie o 6.',
    apply: (market: MarketState) => {
      market.ppIndicator.podzespoly = Math.min(18, market.ppIndicator.podzespoly + 6);
    }
  },
  {
    description: 'Strajk górników! Izotopy nagle drożeją o 5 HT.',
    apply: (market: MarketState) => {
      market.prices.izotopy = Math.min(20, market.prices.izotopy + 5);
    }
  }
];

/**
 * Losuje 1 wydarzenie z puli i aplikuje je do losowego układu gwiezdnego w sesji.
 * Symuluje to wyciąganie Kart Okazji / Wydarzeń w uproszczonej formie.
 */
export function applyRandomMarketEvent(session: GameSession): string | null {
  const systems = Object.keys(session.marketState);
  if (systems.length === 0) return null;

  // Losujemy układ gwiezdny
  const randomSystemIndex = Math.floor(Math.random() * systems.length);
  const targetSystemId = systems[randomSystemIndex];
  const market = session.marketState[targetSystemId];

  // Losujemy wydarzenie
  const randomEventIndex = Math.floor(Math.random() * EVENT_POOL.length);
  const event = EVENT_POOL[randomEventIndex];

  // Aplikujemy wydarzenie
  event.apply(market);

  return `Wydarzenie w układzie ${targetSystemId}: ${event.description}`;
}
