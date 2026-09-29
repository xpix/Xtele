# Xtele – Netzwerk-synchronisierter Teleprompter

Ein Teleprompter, der im Browser läuft und sich über alle Geräte im selben
Netzwerk synchronisiert (z. B. PC ↔ Fire Tablet). Text laden und Scrollen
werden per WebSocket in Echtzeit an alle verbundenen Browser übertragen –
so kannst du dich vom Tablet/der Kamera abwenden und am PC an derselben
Stelle weitermachen.

## Funktionen

- **Text-Sync**: `.txt`-Datei laden → erscheint sofort auf allen verbundenen Geräten.
- **Scroll-Sync**: Scrollen (Maus, Touch, Pfeiltasten) auf einem Gerät scrollt alle anderen Geräte mit (relative, inhaltsbezogene Position – funktioniert auch bei unterschiedlichen Bildschirmgrößen und bei aktivierter vertikaler Spiegelung).
- **Auto-Scroll**: Einstellbare Geschwindigkeit (auch bei sehr niedrigen Werten ruckelfrei), Start/Pause per Button, Leertaste oder Fernbedienung.
- **Spiegeln**: horizontale (und optional vertikale) Spiegelung für Prompter-Aufsätze/Beamsplitter-Glas – **pro Gerät lokal**, wird nicht mitsynchronisiert (i. d. R. braucht nur das Gerät im Prompter-Rig die Spiegelung).
- **Fernbedienung**: Frei zuweisbare Tasten-/Gamepad-Belegung für Bluetooth-/USB-Fernbedienungen – jede Aktion kann mehrere Tasten gleichzeitig haben (z. B. Leertaste **und** ein Fernbedienungs-Button für Play/Pause). Siehe Abschnitt unten.
- **Räume**: Mehrere unabhängige Sync-Gruppen über `?room=NAME` in der URL.

## Installation

Voraussetzung: [Node.js](https://nodejs.org/) (Version 18+).

```powershell
npm install
npm start
```

Die Konsole zeigt danach z. B.:

```
Teleprompter-Server läuft auf http://localhost:3000
  -> im Netzwerk erreichbar unter: http://192.168.1.42:3000
```

## Nutzung mit PC + Fire Tablet

1. Server auf dem PC starten (`npm start`). PC und Fire Tablet müssen im **gleichen WLAN** sein.
2. Am PC im Browser `http://<PC-IP>:3000` öffnen (die IP steht in der Konsole).
3. Auf dem Fire Tablet den **Silk-Browser** (oder Chrome/Firefox) öffnen und dieselbe Adresse aufrufen.
4. Optional: Im Feld „Raum / Gerätegruppe“ auf beiden Geräten denselben Namen eintragen und „Beitreten“ klicken (praktisch, wenn mehrere Teleprompter-Setups im selben Netz laufen). Standardmäßig sind alle im Raum `default`.
5. Text einfügen oder Datei laden → „An alle senden“ klicken.
6. Auf dem Tablet ggf. „Text spiegeln“ aktivieren (nur lokal), Vollbild aktivieren, Tablet in den Prompter-Aufsatz einsetzen.
7. Am PC weiterscrollen (Maus, Pfeiltasten, Auto-Scroll) – das Tablet folgt automatisch. Genauso funktioniert es umgekehrt.

### Firewall

Falls das Tablet den PC nicht erreicht: Windows-Firewall muss eingehende Verbindungen auf dem verwendeten Port (Standard `3000`) für Node.js/das private Netzwerk erlauben.

## Tastatur-Shortcuts

| Taste | Aktion |
| --- | --- |
| Leertaste | Auto-Scroll starten/pausieren |
| Pfeil hoch/runter | manuell scrollen |
| Home | zum Anfang springen |

Diese Standardbelegung lässt sich im Bereich „Fernbedienung“ jederzeit ändern oder erweitern.

## Fernbedienungen (Bluetooth/USB, z. B. Desview)

Viele Fernbedienungen (auch die von Desview) sprechen mit ihrer offiziellen App über ein herstellereigenes, proprietäres Bluetooth-Profil – der Browser kann das nicht direkt auslesen. Praktisch meldet sich die Hardware aber oft trotzdem als **Standard-HID-Gerät** beim Betriebssystem an, entweder als Tastatur oder – wie bei getesteten Desview-Remotes – als generisches **Gamepad**. Xtele erkennt beide Varianten:

1. Fernbedienung **nicht** in der Hersteller-App, sondern in den **Bluetooth-Einstellungen** des Geräts (Windows/Fire OS/Android) koppeln.
2. Im Bereich „Fernbedienung“ bei einer Aktion auf **„+ Taste zuweisen“** klicken und den gewünschten Knopf drücken – Tastatur- und Gamepad-Tasten werden automatisch erkannt und als Chip angezeigt (mit „×“ zum Entfernen).
3. Jede Aktion kann **mehrere** Tasten/Buttons gleichzeitig haben (z. B. Leertaste am PC **und** ein Fernbedienungs-Button).

### Diagnose

Wird nichts erkannt, hilft der Abschnitt „Fernbedienungs-Diagnose“:

- Jeder Tastatur- und Gamepad-Tastendruck wird live geloggt.
- „Rohes HID-Gerät verbinden“ nutzt die WebHID-API, um rohe Eingabe-Reports zu inspizieren (nur Chrome/Edge, benötigt HTTPS **oder** `http://localhost:...` – nicht die LAN-IP).
- Kommt in Notepad/einem Textfeld beim Drücken der Fernbedienung ebenfalls nichts an, sendet das Gerät keine Standard-HID-Reports und lässt sich ohne Reverse-Engineering des Herstellerprotokolls nicht integrieren.

## Konfiguration

- Port ändern: Umgebungsvariable `PORT` setzen, z. B. `PORT=8080 npm start`.

## Architektur

- `server.js`: Express liefert die statischen Dateien aus `public/`; ein WebSocket-Endpunkt (`/ws`) verteilt Text- und Scroll-Events an alle Clients im selben Raum und merkt sich den letzten Stand für neu beitretende Geräte.
- `public/app.js`: Verbindet sich per WebSocket, sendet Text-/Scroll-Änderungen (gedrosselt), wendet empfangene Updates an, verwaltet lokale Anzeige-Einstellungen (Schriftgröße, Spiegelung, Auto-Scroll-Geschwindigkeit) über `localStorage` und erkennt Fernbedienungen über Tastatur-Events, die Gamepad-API und optional WebHID.

## Mitwirken

Issues und Pull Requests sind willkommen. Das Projekt hat keine Build-Pipeline – Änderungen an `public/*` sind nach einem Browser-Reload sofort sichtbar, ein Serverneustart ist nur bei Änderungen an `server.js` nötig.
