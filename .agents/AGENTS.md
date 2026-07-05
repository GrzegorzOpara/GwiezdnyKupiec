# Zasady Współpracy Projektowej (Gwiezdny Kupiec)

Ten plik definiuje reguły i kontekst współpracy dla każdego agenta AI uruchamianego w tym workspace. 

---

## 1. Filozofia Projektu: Vibe Coding
*   **Prostota i czytelność:** Kod musi być prosty, napisany w czystym Node.js + Express + Socket.io (TypeScript). 
*   **Brak nadmiernej inżynierii (No Over-engineering):** Kategoryczny zakaz stosowania skomplikowanych frameworków typu NestJS, systemów wstrzykiwania zależności (Dependency Injection) czy dekoratorów. Kod ma być łatwy do czytania i edycji przez osobę uczącą się programowania.
*   **Modułowość:** Dzielimy kod na logiczne katalogi w jednym serwerze (monolit modułowy), zamiast tworzyć trudne w utrzymaniu fizyczne mikroserwisy.

---

## 2. Zarządzanie Modelami AI (Model Switching Rule)
*   **Rola Agenta:** Agent ma obowiązek informować użytkownika na czacie, kiedy należy zmienić model językowy:
    *   📢 **Model FLASH (Gemini 3.5 Flash):** Używany do prostych zadań, konfiguracji środowiska, tworzenia plików boilerplate (Docker, tsconfig, package.json), pisania podstawowych modeli danych.
    *   📢 **Model PRO (Gemini 3.5 Pro):** Używany do zadań o wysokim stopniu skomplikowania logicznego. Agent musi poprosić użytkownika o przełączenie na model PRO przed rozpoczęciem prac nad:
        - Silnikiem ekonomicznym (`economy.ts`) i fluktuacją cen rynkowych.
        - Maszyną stanów kontrolującą 8 faz tury (`engine.ts`).
        - Logiką walki kosmicznej i przechwytywania statków.

---

## 3. Decyzje Architektoniczne
*   **Uwierzytelnianie:** Google Auth od samego początku. Backend weryfikuje tokeny Google ID za pomocą `google-auth-library` (zarówno w REST API, jak i przy połączeniu WebSockets).
*   **Baza Danych:** 
    *   **GCP Firestore:** Trwałe przechowywanie kont użytkowników, statystyk i punktów kontrolnych stanu gier.
    *   **Redis:** Błyskawiczna pamięć podręczna dla trwających gier oraz synchronizacja Socket.io.
*   **Hostowanie chmurowe (GCP):** Docelowo aplikacja i kontener Redis będą działać w klastrze **GKE**, co eliminuje dodatkowe opłaty za zewnętrzne usługi Redis. Frontend w React będzie hostowany za darmo na **Firebase Hosting**.

---

## 4. Zautomatyzowane Testy (Vitest)
*   **Obowiązek pisania testów:** Każda nowa logika biznesowa (np. obliczenia rynkowe, mechanika skoków, logika walki) oraz funkcje pomocnicze (utils) muszą posiadać odpowiadające im testy jednostkowe w Vitest.
*   **Testy integracyjne baz danych:** Operacje na Firestore muszą być testowane integracyjnie przy użyciu lokalnego emulatora Firestore (z zachowaniem dynamicznego importu w testach w celu uniknięcia problemów z ESM hoisting).
*   **Regresja:** Przed zakończeniem jakiegokolwiek zadania i commitowaniem zmian, agent ma obowiązek uruchomić cały zestaw testów (`npm run test`) i upewnić się, że wszystkie testy przechodzą pomyślnie.

