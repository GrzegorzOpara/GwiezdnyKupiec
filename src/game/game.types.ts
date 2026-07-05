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

export interface GameSession {
  sessionId: string;
  status: GameStatus;
  hostUid: string;
  currentTurn: number;  // tura od 1 wzwyż
  currentPhase: number; // faza od 1 do 8
  players: Record<string, Player>; // uid -> Player
  marketState: Record<string, MarketState>; // systemId -> MarketState
  createdAt: string;
}
