# Plan wdrożenia: Gwiezdny Kupiec (Vibe Coding, Git & Docker Setup)

Dostosowujemy architekturę do **modelu "Vibe Coding"** z zachowaniem pełnej gotowości produkcyjnej. Używamy **Node.js (TypeScript) + Express + Socket.io + Google Auth**.

---

## 1. Struktura Projektu (Prosta i Modularna)

```
gwiezdny-kupiec/
├── .gitignore            # Ignorowanie node_modules, plików .env, itp.
├── .env.example          # Przykład pliku konfiguracyjnego (zmienne środowiskowe)
├── Dockerfile            # Opis obrazu kontenera serwera gier
├── docker-compose.yml    # Konfiguracja lokalnych kontenerów Docker (Server, Redis, Firestore Emulator)
├── package.json          # Zależności (express, socket.io, google-auth-library)
├── tsconfig.json         # Konfiguracja TypeScript
└── src/
    ├── auth/             # Logika autoryzacji i middleware weryfikacji tokenów Google
    ├── game/             # Zasady gry, gospodarka, tury
    ├── lobby/            # Pokoje gier (powiązane z zalogowanymi użytkownikami)
    ├── socket/           # Sockets.io z zabezpieczeniem (Auth Guard)
    ├── db/               # Integracja z Firestore i Redis
    └── server.ts         # Start serwera
```

---

## 2. Strategia Hostowania & Produkcja

*   **Lokalnie:** Docker Compose uruchamiający serwer gier, baza Redis oraz emulator Firestore (0 PLN opłat).
*   **Chmura GCP:** Produkcyjne kontenery wdrożone na **GKE** (Google Kubernetes Engine) z darmowym Redisem działającym w klastrze, oraz bezserwerowa baza **GCP Firestore** (darmowy pakiet).
*   **Frontend (w przyszłości):** Serwowany z darmowego **Firebase Hosting** lub Google Cloud Storage + CDN.

---

## Zaktualizowane Etapy Prac

### Etap 1: Konfiguracja Lokalnego Środowiska Docker, Git & Google Auth
1.  **Stworzenie plików konfiguracyjnych projektu:** `.gitignore`, `package.json`, `tsconfig.json`.
2.  **Konfiguracja Środowiska Docker & Docker Compose:**
    *   Stworzenie `Dockerfile` dla naszej aplikacji Node.js.
    *   Stworzenie `docker-compose.yml` konfigurującego kontenery:
        - `game-server` (nasza aplikacja).
        - `redis` (baza do WebSockets i cache).
        - `firestore-emulator` (lokalny, darmowy emulator bazy Google Cloud SDK).
    *   Stworzenie pliku `.env.example` ze zmiennymi środowiskowymi do połączeń między kontenerami.
3.  **Implementacja Uwierzytelniania:**
    *   Stworzenie `authMiddleware.ts` weryfikującego tokeny Google ID.
4.  **Instrukcja dla Ciebie:**
    *   Jak pobrać `Client ID` z konsoli Google Cloud.
    *   Jak uruchomić lokalny Docker jednym poleceniem.
    *   Jak powiązać ten folder z prywatnym repozytorium GitHub.

### Etap 2: Baza danych i Profile Użytkowników
- Integracja z Firestore (zapisywanie profili graczy po zalogowaniu).
- Definicja struktur danych (`Statek`, `UkładGwiezdny`, `Gracz`, `Towar`).

### Etap 3: Logika ekonomiczna (Gospodarka)
- Implementacja rzutów kośćmi, popytu/podaży i cen rynkowych.

### Etap 4: WebSocket z zabezpieczeniem Auth
- Konfiguracja Socket.io z Middleware zabezpieczającym (weryfikacja tokenu przy połączeniu).
- Implementacja zdarzeń lobby (tworzenie pokoju, dołączanie jako zalogowany gracz).
