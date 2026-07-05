export interface User {
  uid: string;
  displayName: string;
  email: string;
  lastActiveAt: string;
}

export interface Powiazania {
  polityczne: number;   // 0 - 10
  gospodarcze: number;  // 0 - 10
  kryminalne: number;   // 0 - 10
}

export type KlasaZalogi = 'A' | 'B' | 'C' | 'D';

export interface LokacjaStatku {
  systemId: string;
  obszar: 'PORT' | 'PRZESTRZEN' | 'PLANETA' | 'STOCZNIA';
}

export type TowarId = 'izotopy' | 'polimery' | 'podzespoly' | 'zywnosc';

export interface Statek {
  id: string;
  nazwa: string;
  typKadluba: string; // np. 'Klarnet', 'Pikulina', 'Flet Sztylet', 'Corco Gamma', 'Sztylet', 'Miecz', 'Włócznia'
  moduly: string[];    // np. ['Towarowy', 'Towarowy', 'Towarowy', 'Pasażerski', 'Lekka broń', 'Bezpieczny skok']
  klasaZalogi: KlasaZalogi;
  ladunek: Record<TowarId, number>; // ilość towarów na pokładzie
  pasazerowie: number; // liczba grup pasażerskich
  lokacja: LokacjaStatku;
  uszkodzenia: string[]; // np. nazwy uszkodzonych modułów lub 'KADLUB'
}

export interface Player {
  uid: string;
  characterName: string;
  gotowka: number;     // gotówka w HT (Hektotransach), startowo 300
  reputacja: number;   // reputacja 0-40, startowo 20
  powiazania: Powiazania;
  statki: Statek[];
  magazyny: Record<string, Record<TowarId, number>>; // systemId -> { towarId -> ilość }
  fabryki: Record<string, Record<TowarId, number>>;  // systemId -> { towarId -> rozmiar_fabryki }
}

export type GameStatus = 'LOBBY' | 'ACTIVE' | 'FINISHED';

export interface MarketState {
  systemId: string;
  prices: Record<TowarId, number>; // aktualna cena każdego towaru (1-20)
  ppIndicator: Record<TowarId, number>; // wskaźnik popytu/podaży na kalkulatorze P/P (-18 do +18)
}

export enum GamePhase {
  LICYTACJA = 1,
  INICJATYWA = 2,
  WIADOMOSCI = 3,
  HIPERSKOKI = 4,
  TRANSAKCJE = 5,
  OKAZJE = 6,
  INWESTYCJE = 7,
  KONTROLA = 8
}

export type OfferType = 'BUY' | 'SELL';

export interface TransactionOffer {
  playerId: string;
  commodity: TowarId;
  type: OfferType;
  price: number;
  amount: number;
  systemId: string; // Dodajemy systemId, aby wiedzieć, gdzie odbywa się transakcja
}

export interface PlayerTurnIntent {
  initiativeBidHT: number;
  offers: TransactionOffer[];
  isSubmitted: boolean; // Czy gracz już zatwierdził swoją turę
}

export interface GameSession {
  sessionId: string;
  status: GameStatus;
  hostUid: string;
  currentTurn: number;
  currentPhase: GamePhase;
  phaseEndTimeMs?: number; // timestamp końca aktualnej fazy dla timera
  players: Record<string, Player>; // uid -> Player
  marketState: Record<string, MarketState>; // systemId -> MarketState
  turnIntents: Record<string, PlayerTurnIntent>; // uid -> PlayerTurnIntent (ukryte akcje gracza w Fazie 1)
  initiativeOrder: string[]; // posortowane uid graczy po rozstrzygnięciu Fazy Inicjatywy
  createdAt: string;
}
