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
  pasazerowie: { celSystemId: string; nagrodaHT: number }[]; // lista pasażerów z celem i nagrodą
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
  dlugBankowy: number; // kredyt w Mu Herculis
}

export type GameStatus = 'LOBBY' | 'ACTIVE' | 'COMBAT_PAUSE' | 'FINISHED';

export interface MarketState {
  systemId: string;
  prices: Record<TowarId, number>; // aktualna cena każdego towaru (1-20)
  ppIndicator: Record<TowarId, number>; // wskaźnik popytu/podaży na kalkulatorze P/P (-18 do +18)
}

export const GamePhase = {
  LICYTACJA: 1,
  INICJATYWA: 2,
  WIADOMOSCI: 3,
  HIPERSKOKI: 4,
  TRANSAKCJE: 5,
  OKAZJE: 6,
  INWESTYCJE: 7,
  KONTROLA: 8
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

export type OfferType = 'BUY' | 'SELL';

export interface TransactionOffer {
  playerId: string;
  commodity: TowarId;
  type: OfferType;
  limitPrice: number; // Zlecenie limitowane: maksymalna cena (kupno) lub minimalna (sprzedaż)
  amount: number;
  systemId: string; // Dodajemy systemId, aby wiedzieć, gdzie odbywa się transakcja
}

export interface PlayerTurnIntent {
  initiativeBidHT: number;
  offers: TransactionOffer[];
  shipMoves: { shipId: string; targetSystemId: string }[];
  shipPurchases: { hullType: string; modules: string[]; systemId: string }[];
  factoryPurchases: { systemId: string; commodity: TowarId; size: number }[];
  loanRequests: number;
  loanRepayments: number;
  loadPassengers: { shipId: string; amount: number }[];
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
  settings: {
    turnDurationSeconds: number; // 0 oznacza czas nielimitowany (brak stopera)
  };
  createdAt: string;
}
