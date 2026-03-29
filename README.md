# Traders Vault — Electron Desktop App

> Transparent Windows/macOS overlay for prop traders. Float panels over TradingView.  
> Built by **J3 | Vaulted Desk**

**Website:** [tradersvault.app](https://tradersvault.app)  
**Current Version:** v2.6.7  
**Platform Repo:** [traders-vault-platform](https://github.com/j3vals-cpu/traders-vault-platform)  
**Full Docs:** [traders-vault-docs](https://github.com/j3vals-cpu/traders-vault-docs)

---

## Build

```bash
npm install
npm start        # dev/test
npm run build    # creates installer in dist/
```

Requires Node.js LTS. Builds produce:
- Windows: `.exe` installer + portable
- macOS: ARM `.dmg` + Intel `.dmg`

---

## How It Works

The app is a single `index.html` (10K+ lines) running in Electron with:
- Transparent frameless window (overlay mode)
- Click-through with mouse position polling
- Dock bar that collapses to top of screen
- Auto-hide on mouse hover
- Multiple resizable/draggable panels

---

## Panels

| Panel | Description |
|-------|-------------|
| **Trading** | cTrader auto-sync, manual accounts, balance tracking, P&L cards |
| **Prop Tracker** | Track prop firm accounts, spending, payouts, net P&L |
| **Trade Copier** | Native cTrader copy trading (master → slave accounts) |
| **Signal Bot** | Send Discord signals with bias (Long/Short/Neutral) + custom buttons |
| **Tracker** | Expense/bill tracker with categories + tax calculator |
| **Accountability** | Daily habit checklist with streak tracking |
| **Strategy** | Pre-trading checklist |
| **Notes** | Quick notes |
| **Planner** | Weekly day planner (Mon-Fri) |
| **Settings** | Theme picker (9 themes), version, sync, walkthrough tour |

---

## cTrader Integration

- OAuth flow → server-side token exchange at `tradersvault.app/api/auth/callback`
- WebSocket connections to `wss://live.ctraderapi.com:5036` + `wss://demo.ctraderapi.com:5036`
- Fetches account list → trader details → balances for all accounts
- Dual-endpoint fetch (live + demo) with deduplication

---

## Auto-Update

- On launch, app checks Supabase `app_versions` table for latest version
- If `is_mandatory = true`, forces update before continuing
- Downloads `.exe` from GitHub Releases
- Admin pushes updates via admin panel at `tradersvault.app/admin`

---

## Version History

| Version | Changes |
|---------|---------|
| v2.6.7 | Terms acceptance + marketing consent on signup |
| v2.6.6 | Custom signal bot buttons |
| v2.6.5 | Route copier to correct live/demo endpoint |
| v2.6.4 | Copier connects to both live and demo cTrader |
| v2.6.3 | Copier always shows UI, accounts appear as connected |
| v2.6.0 | Native cTrader copy trading in Copier panel |
| v2.5.2 | File upload, tracker + tax calc, themes, register page, laptop optimized |
| v2.3.x | cTrader OAuth fixes (auth code interception, token exchange) |
| v2.2.x | Walkthrough tour, download popup, contributors page |
| v2.1.x | cTrader account sync, WebSocket fixes, debug toasts |

---

## Related Repos

| Repo | Purpose |
|------|---------|
| [traders-vault-platform](https://github.com/j3vals-cpu/traders-vault-platform) | Vercel web platform (API, admin, checkout, PWA) |
| [traders-vault-docs](https://github.com/j3vals-cpu/traders-vault-docs) | Full development tracking & handoff docs |
| [VaultedDemo](https://github.com/j3vals-cpu/VaultedDemo) | Demo app (Tradovate testing) |
