# Gwiezdny Kupiec - Serwer Gry (Backend)

Projekt realizowany w architekturze **Vibe Coding** w technologii Node.js (TypeScript) + Express + Socket.io + Redis + Firestore.

---

## 🚀 Szybki Start (Lokalny Docker)

Aby uruchomić całe środowisko lokalnie (serwer gry, Redis, emulator Firestore), potrzebujesz zainstalowanego narzędzia **Docker** oraz **Docker Desktop** (na Windowsie).

1. **Uruchom kontenery:**
   ```bash
   docker compose up --build
   ```
2. **Sprawdź status serwera:**
   Wejdź na: [http://localhost:3000/health](http://localhost:3000/health)

Logi serwera będą widoczne bezpośrednio w terminalu. Zmiany w kodzie w folderze `src/` zostaną automatycznie przeładowane dzięki zamontowaniu wolumenu i działaniu `ts-node-dev`.

---

## 🔑 Konfiguracja Google Client ID

Do działania logowania graczy wymagane jest zweryfikowanie tokenu Google ID. Aby uzyskać `Client ID` dla celów deweloperskich:

1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/).
2. Utwórz nowy projekt (np. `Gwiezdny Kupiec`).
3. Przejdź do zakładki **APIs & Services** -> **Credentials**.
4. Kliknij **Configure Consent Screen** (Ekran zgody OAuth) i skonfiguruj go jako typ **External** (dodaj tylko podstawowe informacje).
5. Po powrocie do **Credentials**, kliknij **Create Credentials** -> **OAuth client ID**.
6. Wybierz typ aplikacji: **Web application**.
7. Dodaj autoryzowane źródła JavaScript (Authorized JavaScript origins) – dla testów lokalnych: `http://localhost:3000` (lub port Twojego frontendu, np. `http://localhost:5173`).
8. Skopiuj wygenerowany **Client ID** i wklej go do swojego lokalnego pliku `.env` w miejsce:
   ```env
   GOOGLE_CLIENT_ID=twoj-skopiowany-client-id.apps.googleusercontent.com
   ```

> [!TIP]
> **Testowanie bez logowania Google:**
> Dla ułatwienia testów, backend akceptuje tokeny zaczynające się od słowa `test-token-` (np. `test-token-gracz1`). Pomiędzy nimi weryfikacja Google jest pomijana, a użytkownik loguje się jako `Tester gracz1`.

---

## 📦 Repozytorium Git & GitHub

Aby powiązać ten katalog z nowym prywatnym repozytorium na GitHubie:

1. Utwórz nowe repozytorium na swoim koncie GitHub (najlepiej prywatne).
2. Otwórz konsolę w tym folderze i uruchom następujące polecenia:
   ```bash
   # Inicjalizacja lokalnego gita (jeśli jeszcze nie zainicjalizowany)
   git init

   # Dodanie wszystkich plików
   git add .

   # Pierwszy commit
   git commit -m "Initial commit: Docker, Express, Socket.io and Google Auth setup"

   # Ustawienie głównej gałęzi na main
   git branch -M main

   # Powiązanie z GitHubem (podmień link na swój)
   git remote add origin https://github.com/TWÓJ_LOGIN/NAZWA_REPOZYTORIUM.git

   # Wysłanie kodu na GitHub
   git push -u origin main
   ```
