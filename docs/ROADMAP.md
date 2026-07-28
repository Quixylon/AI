# Roadmap

## Phase 1 — Repository foundation

- [x] Create public repository
- [x] Add repository overview
- [x] Add secret-safe `.gitignore`
- [x] Define project folder conventions
- [x] Add the first application scaffold

## Phase 2 — Steam Status Tracker MVP

- [x] Create the responsive web interface
- [x] Read one configured SteamID64 from GitHub Variables
- [x] Read public profile status through the Steam Web API
- [x] Keep the Steam API key in GitHub Secrets
- [x] Show online, offline, away, busy, and in-game states
- [x] Show the current game when available
- [x] Save meaningful status changes to JSON history
- [x] Display recent activity history
- [x] Refresh data in the browser without reloading the page

## Phase 3 — Free deployment

- [x] Remove the paid Node.js server requirement
- [x] Add a scheduled GitHub Actions workflow
- [x] Add a custom GitHub Pages deployment workflow
- [x] Document setup from zero
- [ ] Enable GitHub Pages in repository settings
- [ ] Add `STEAM_API_KEY` repository secret
- [ ] Add `STEAM_ID64` repository variable
- [ ] Complete the first successful deployment

## Phase 4 — Improvements

- [ ] Add optional GitHub mobile notifications through Issues
- [ ] Support multiple tracked profiles
- [ ] Add activity statistics and charts
- [ ] Add configurable retention for history
- [ ] Add automated validation tests
- [ ] Add a custom domain
