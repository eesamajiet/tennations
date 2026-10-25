# Ten Nations (INF4001 entrance exam)
Single-player Risk-style game vs 9 NPCs. Plain HTML/CSS/JS (ES modules), classes split into engine (model), npc (strategy), ai (Gemini commentary), store (Firebase) and app (view/controller). No build step.

## Setup
1. Firebase console: create project, enable Authentication > Email/Password, create a Firestore database, paste `firestore.rules` into Rules.
2. Authentication > Settings > Authorized domains: add `<your-username>.github.io`.
3. Project settings > Add web app, copy the config into `js/config.js`.
4. Get a Gemini key at aistudio.google.com, put it in `js/config.js`, and restrict it to your GitHub Pages domain. Without a key the game uses built-in commentary.
5. Run locally: `python3 -m http.server` then open http://localhost:8000 (add `localhost` to authorized domains if needed).
6. Deploy: push to a GitHub repo, Settings > Pages > deploy from branch `main`, root.
7. Firebase > Project settings > Users and permissions: add ammarcanani@gmail.com, mc.tanner@uct.ac.za, ridewaan.hanslo@uct.ac.za as members.

## Bonus features
- Game URL (`?g=ID`) lets anyone watch in real time (read-only).
- Anti-cheat: game state, including an attack in progress, is saved to Firestore on every human action, so closing the browser cannot cancel or re-roll an attack.
