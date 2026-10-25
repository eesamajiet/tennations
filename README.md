# Ten Nations

A single-player, Risk-inspired geopolitics game. You pick a country, nine random rivals are drawn, and you play against NPC nations that fight to win. Conquer all ten nations to win.

Built for the **UCT Information Systems Honours 2027 entrance exam (INF4001)**.

| | |
|---|---|
| **Live site** | `https://YOUR-USERNAME.github.io/YOUR-REPO/` |
| **Test login** | Email: `YOUR_TEST_EMAIL` / Password: `YOUR_TEST_PASSWORD` |
| **Database** | Firebase Firestore, project `tennations` |

---

## Features

**Gameplay**
- 10 nations: your choice plus 9 random ones, with starting soldiers set by population (1 to 9, as per the brief).
- Random first player, then turn order. One attack per turn, transfers between your own countries, and a minimum of 1 soldier always stays behind.
- Dice battles: each die is one soldier, the higher roll wins, ties kill nobody. Keep rolling, or stop and end your turn.
- Conquest grants `max(2, conquered base value / 2)` soldiers. From round 2, you receive 2 soldiers per country held at the start of your turn.
- Eliminated players are skipped. First to hold all 10 nations wins.

**NPCs that play to win**
- Every NPC evaluates the board each turn: where to stack reinforcements, whether to consolidate soldiers, which target gives the best odds and payoff, and when to stop an attack.
- Every decision is written to the log with a short reason, including during fast-forward.
- **Fast-forward** speeds up NPC moves while still showing every step.

**AI commentary**
- Each battle round is narrated by Google Gemini. If the key is missing or rate-limited, built-in commentary is used so the game never stalls.

**Access control**
- Anyone with the game link can watch a game live (read-only).
- Only a signed-in owner can play their game's turns. Any visitor can sign up and start their own game.

**Bonus features**
- **Live spectating:** share `?g=GAME_ID` and viewers see the game update in real time.
- **Anti-cheat:** the full game state, including an attack in progress, is saved to Firestore on every player action. Closing the browser cannot cancel or re-roll an attack.
- **NPC profiles:** each NPC is aggressive, defensive or opportunistic, which changes its targets, risk tolerance and when it stops attacking. The profile is shown on its tile and in its logged reasoning.
- **Difficulty levels:** Easy NPCs sometimes attack without checking the odds, Normal NPCs follow their profile, Hard NPCs also get a bonus soldier each round.
- **Replay and history:** a slider and play button step through the board after every turn, and any of the last 20 battles can be replayed.
- **Analytics:** per-nation stats in each game (conquests, kills, losses), plus your own record and platform totals (games, win rate, average length, most picked nation) on the home page.
- **Animations:** dice roll animations and soldier-count pulses, disabled for users who prefer reduced motion.

---

## Tech stack

| Layer | Choice |
|---|---|
| Front end | HTML, CSS and vanilla JavaScript (ES modules), no build step |
| Database | Firebase Firestore (NoSQL) |
| Authentication | Firebase Auth (email and password) |
| AI | Google Gemini API, called from the browser |
| Hosting | GitHub Pages |

## Architecture

The code follows a model / strategy / service / controller split. Each concern lives in its own class or module.

```
index.html            Page shell
css/style.css         Styling
js/
  config.js           Firebase and Gemini configuration
  data.js             Country list, population-to-soldier mapping
  engine.js           Game and Country classes: rules, dice, conquest, turns (model)
  npc.js              Npc class: NPC strategy and decision reasons
  ai.js               Commentator class: Gemini commentary with fallback
  store.js            Firebase Auth and Firestore access (data layer)
  app.js              Rendering and user actions (view and controller)
firestore.rules       Firestore security rules
```

The database layer (`store.js`) is the only file that talks to Firebase. The game rules (`engine.js`) have no knowledge of the UI or the database, so the engine can be tested on its own.

### Data model

One Firestore document per game in the `games` collection holds `ownerUid`, `human`, `countries[]` (name, soldiers, owner), `order[]`, `turn`, `round`, `attack`, `lastBattle`, `status`, `winner`, and a capped `log[]`.

### Security

- `firestore.rules` allows anyone to **read** a game, but only the signed-in owner can create, update or delete it.
- The Firebase web config is public by design; access is enforced by the rules above.
- The Gemini key is visible in browser code. It should be deleted once marking is finished.

---

## Run locally

1. Install nothing; just serve the folder:
   ```bash
   cd ten-nations
   python3 -m http.server 8000
   ```
2. Open http://localhost:8000.
3. Create an account, choose your country and start a game.

## Set up your own copy

1. **Firebase:** create a project, then enable **Authentication > Email/Password** and create a **Firestore Database**.
2. Paste the contents of `firestore.rules` into **Firestore > Rules** and publish.
3. Add your site's domain (`YOUR-USERNAME.github.io`) under **Authentication > Settings > Authorized domains**.
4. Register a web app in **Project settings** and paste its config into `js/config.js`.
5. Optional: create a Gemini key at https://aistudio.google.com/apikey and paste it into `GEMINI_API_KEY` in `js/config.js`.
6. Push the folder to GitHub and enable **Settings > Pages** (deploy from `main`, root folder).

## Database access for markers

The following accounts have been added to the Firebase project `tennations` under **Project settings > Users and permissions**:

- ammarcanani@gmail.com
- mc.tanner@uct.ac.za
- ridewaan.hanslo@uct.ac.za

## How to play

1. Sign in and start a new game.
2. On your turn, place any new soldiers using the **+1** buttons on your countries.
3. Choose an attacking country and a target, then press **Attack**. Roll dice until you win, run out of soldiers to attack with, or stop.
4. Optionally move soldiers between countries you control, then press **End turn**.
5. Watch the NPCs play. Use **Fast-forward NPCs** to speed them up. Their reasoning appears in the log.
6. Share the link with anyone who wants to watch.

## Known limitations

- Population figures are approximate and fixed in `js/data.js`.
- Alliances and diplomacy, and LLM-driven NPC decisions, are not implemented; NPC decisions come from the rule-based strategy in `js/npc.js`.
- Gemini commentary is rate-limited to roughly one call every few seconds to stay within free-tier limits; other rounds use built-in commentary.
- Dice are rolled in the browser, so this is a casual game, not a tamper-proof competitive one.
