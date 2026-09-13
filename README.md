# Horror Tree · Hinter dem Traum

Ein vollständiges Dreamcore-Horrorspiel für den Browser: Traumwald, verlassene Poolräume, eine pastellfarbene Rutsche, schwebende Türen und ein vergessener Garten. Finde fünf Erinnerungen und bringe sie zum großen Baum zurück.

Die ursprünglichen Musik- und Sounddateien bleiben erhalten. Der zuvor fehlende `src`-Ordner ist jetzt mit einer vollständigen Spielbasis ergänzt.

## Starten

Node.js 22 oder neuer installieren, dann im Projektordner:

```sh
npm ci
npm start
```

Der Browser öffnet sich unter `http://127.0.0.1:5177/`. Falls der Port belegt ist, versucht der Server die nächsten zehn Ports und zeigt die tatsächliche Adresse an. JavaScript, WebGL und Hardwarebeschleunigung werden benötigt. Die HTML-Datei benötigt einen Webserver; nicht per Doppelklick über `file://` öffnen.

Windows: Nach `npm ci` funktionieren auch `start-game.cmd` und `npm run window` (Electron). Der Browserstart unterstützt Windows, macOS und Linux. Die Electron-App lädt dieselbe Spielversion über ihren lokalen Server.

Für ein Handy im gleichen WLAN:

```sh
npm run serve -- --host 0.0.0.0
```

Auf dem Handy `http://<LAN-IP-des-Computers>:5177/` öffnen. Die vom Server gemeldete Portnummer verwenden; bei Bedarf die lokale Firewall für das private Netzwerk freigeben. Der Server bindet sich standardmäßig nur an den eigenen Computer.

## Spiel

- Fünf leuchtende Kassetten an verschiedenen Orten sammeln; dann am Tor vor dem Erinnerungsbaum interagieren.
- **Der Hüter:** patrouilliert, entdeckt den Spieler, verfolgt ihn und sucht am letzten bekannten Ort.
- **Der Fadengänger:** reagiert besonders stark auf Schritte und Rennen.
- **Der Beobachter:** bewegt sich, wenn der Spieler wegsieht; friert bei freier Sicht im Blickfeld ein.
- Bäume und Wände unterbrechen Sicht; die Wegfindung führt um Hindernisse herum. Schleichen reduziert Sicht- und Hörreichweite.
- Ein Echo lenkt nahe Monster zu einem Ort vor dem Spieler. Danach 18 Sekunden Abklingzeit.
- Rennen kostet Ausdauer. Die Taschenlampe lädt sich wieder auf, während sie ausgeschaltet ist.
- Kurze Schonfrist nach Start und Fortsetzen. Jumpscares beim Erwischtwerden sind abschaltbar.
- **Nur entdecken** schaltet alle Monster aus. **Traum & Schrecken** ist normal, **Albtraum** macht die Gegner schneller.

## Steuerung

| Aktion             | Tastatur / Maus                                  | Touch                         | Standard-Gamepad |
| ------------------ | ------------------------------------------------ | ----------------------------- | ---------------- |
| Bewegen            | WASD oder Pfeiltasten                            | Linker Stick                  | Linker Stick     |
| Umsehen            | Maus; alternativ mit gedrückter Maustaste ziehen | Rechte Bildschirmseite ziehen | Rechter Stick    |
| Interagieren       | E                                                | E                             | A                |
| Taschenlampe       | F                                                | Sonne                         | X                |
| Rennen             | Shift halten                                     | » halten                      | LB halten        |
| Schleichen         | C umschalten                                     | ↓                             | B                |
| Echo               | Q                                                | ◎                             | Y                |
| Pause / Fortsetzen | Esc oder P                                       | Pause / Weiter                | Start            |

Die Touch-Zonen verwalten separate Pointer-IDs: Laufen, Umsehen und Aktionsknöpfe sind gleichzeitig möglich. Abgebrochene Gesten, Fensterwechsel und verlorene Maussperre setzen Eingaben zurück. Mit A lässt sich das Hauptmenü starten bzw. die Pause verlassen. Hoch- und Querformat werden unterstützt; Querformat bietet mehr Sicht auf die Welt.

## Einstellungen und Speichern

Grafikstufen **Flüssig**, **Ausgewogen**, **Hoch** und **Automatisch**; Musik, Geräusche, Empfindlichkeit, Sichtfeld, Kameraeffekte und Jumpscares. Automatisch reduziert bei dauerhaft niedriger Bildrate die Auflösung und schaltet Schatten ab. Manuelle Grafikstufen bleiben unverändert.

Fortschritt und Einstellungen werden lokal im Browser gespeichert. Eine Erinnerung und regelmäßige Zwischenstände werden automatisch gespeichert; im Hauptmenü erscheint **Traum fortsetzen**. Ein neuer Traum startet eine neue Runde. Nach erfolgreichem Abschluss wird der Spielstand gelöscht. Wenn Browserspeicher nicht verfügbar ist, läuft die Runde trotzdem; das Pausenmenü nennt die fehlende Speicherung. Private Browserfenster und das Löschen von Websitedaten können Speicherstände entfernen.

## Statische Webversion / Hosting

```sh
npm run build
npm run preview
```

Der Build liegt in `www/` und enthält Spiel, Musik, Engine und Lizenz. Zur Veröffentlichung den **Inhalt von `www/`** auf einen statischen Webhost laden. Relative Pfade funktionieren auch in einem Unterordner wie `/horror-tree/`. Das Spiel lädt keine Engine, Textur oder Schrift von einem CDN nach. „Ohne CDN“ ist keine Service-Worker-Offlineinstallation; zum Laden wird weiterhin ein lokaler oder gehosteter Webserver benötigt.

Der Build veröffentlicht nichts automatisch. GitHub Pages kann den fertigen Build aus einem passenden Deployment übernehmen; das bloße Hochladen des Quellcodes auf GitHub genügt nicht, da dessen Importmap auf `node_modules/three` zeigt.

## Android / Capacitor

`www/` ist das konfigurierte Webverzeichnis. Android Studio und das Android SDK werden für eine native App benötigt. Da das Originalrepository keinen nativen `android/`-Ordner enthält, einmal initialisieren:

```sh
npm run android:add
npm run android:open
```

Bei späteren Änderungen:

```sh
npm run android:sync
```

Anschließend in Android Studio bauen. Auf Linux/macOS gibt es außerdem `npm run android:build`; auf Windows nach dem Sync im `android`-Ordner `gradlew.bat assembleDebug` verwenden. Eine fertige APK oder ein Installer gehört nicht zu diesem Quellcode-Umbau. Der alte Verweis auf ein nicht vorhandenes Windows-Installer-Skript wurde entfernt.

## Entwicklung und Tests

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

`npm test` prüft Kollisionen, Wand-Sichtlinien, Wegfindung ohne diagonales Schneiden, beschädigte Speicherstände, ungültige HTTP-Pfade und belegte Ports. Die Browserprüfung deckt Start, Bewegung, Einstellungen, Pause, Fortsetzen nach Neuladen, alle Erinnerungen bis zum Sieg, Gegnertypen, Jumpscares und Touch-Mehrfacheingaben ab. Sie speichert Screenshots in `test-results/`.

Mit `CHROMIUM_PATH` kann ein bereits vorhandener Chromium-Pfad verwendet werden. `TEST_BUILT=1 npm run test:browser` startet den Exportserver automatisch und prüft `www/` unter einem Projekt-Unterpfad. Mit `TEST_BASE_URL=http://127.0.0.1:5178/horror-tree/` lässt sich der exakte statische Build testen. Automatisierte Mobiltests emulieren Touch und Bildschirmgrößen; reale Android-/iOS-Geräte, Safari, Gamepad-Hardware, Electron- und APK-Builds benötigen zusätzliche Gerätetests.

| Datei                   | Aufgabe                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `src/main.js`           | Runden, Menüs, Speichern, Rendering, Qualitätsstufen       |
| `src/world.js`          | Welt, instanziertes Blattwerk, Wasser-Shader, Erinnerungen |
| `src/monsters.js`       | Drei Monster, Animationen und Wahrnehmung                  |
| `src/core.js`           | Navigation, Kollisionen, Speicher-Validierung              |
| `src/input.js`          | Tastatur, Maus, unabhängige Touch-Pointer und Gamepad      |
| `src/audio.js`          | Musik, Schritte, Herzschlag, Schreckgeräusche              |
| `scripts/build-web.cjs` | Reproduzierbarer statischer Export                         |

`?test=1` aktiviert lokale Diagnosen für Browserprüfungen. Im normalen Spiel ist die Diagnose-Schnittstelle nicht vorhanden. Drei Monster verwenden eine Zustandsmaschine und A*-Wegfindung; es ist keine cloudbasierte oder generative KI.

## Credits

Ursprüngliche Idee, Entwicklung und Design: **Nils Becker**.

Musik aus dem Originalprojekt: leberch, 9JackJack8, reneschulze1984. Soundeffekte aus dem Originalprojekt: dragon-ago, freesound_community, SoundReality, lesiakower, JustSomeSounds. Diese ursprünglichen Namensangaben wurden aus dem vorhandenen Credits-Bildschirm übernommen. Three.js steht unter der MIT-Lizenz; diese wird im Web-Build mitgeliefert.
