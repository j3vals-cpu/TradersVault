# Traders Vault — Changelog

---

## v1.2.0 — Checkpoint Release
*March 2026*

### New Features
- **Studio Panel** — 5-tab panel with 10 tools for content creators & streamers
  - Scene switcher (Live / BRB / Starting / Ending)
  - Stream title builder with quick-tag insertion and copy
  - Hotkey cheatsheet (add / remove OBS/stream shortcuts)
  - Live ticker tape (scrolling gold bar across screen)
  - Crosshair pointer overlay for pointing at chart areas
  - Pomodoro focus timer with work/break cycles
  - Box breathing guide (4-4-4-4, reduces pre-trade stress)
  - Font size slider, OpenDyslexic font, High Contrast mode
  - Colour blind modes (Deuteranopia / Protanopia / Tritanopia)
  - Stream safe zones (webcam & alert area overlays)
- **Project X / TopstepX integration** — purple button in Trading panel, API connect + manual add
- **Expanded Dock Bar** — market session indicator, live P&L, focus timer, opacity slider, overlay toggle, clickable quote rotation
- **Contract sizing calculator** — TICKS / POINTS / $ per contract mode toggle, clearer result display

### Fixes
- **Click-through** — complete rewrite using `setIgnoreMouseEvents` + 60fps mouse poller with DPI scale factor correction. Transparent gaps now pass clicks to TradingView at OS level
- **Dock hidden blocks top of screen** — hover zone now correctly registers only a 20px strip; translated-off-screen dock bar no longer adds a hit rect
- **Always on top** — window starts at `screen-saver` level by default, re-asserted on every overlay toggle
- **Colour dots not working** — added `-webkit-app-region:no-drag` to colour dot container and dots
- **Panel resize auto-adjust** — `min-height:0` on panel body so flex shrink works; minimum panel height reduced to 80px
- **Default layout / snap** — all layout presets now offset y-coordinates by topbar height for `position:fixed` panels
- **Panels off-screen on load** — `getWinState` clamps `y < 60` to `y = 80` to prevent panels hiding behind topbar

### Architecture
- `main.js` fully rewritten: `setIgnoreMouseEvents` pattern, hit rect IPC, multi-monitor expand, always-on-top by default
- `preload.js` updated: `setHitRects`, `expandToAllScreens`, `moveTo` exposed
- `index.html`: continuous 100ms hit rect polling, startup pump, hooks on all panel open/close/move/resize events

---

## v1.0.0 — Initial Release
- Trading panel with firm/account management
- Prop Tracker with grouped firm entries
- Strategy & News with economic calendar
- Accountability / Habit tracker
- Notes, To-Do, Planner, Mindset panels
- Calculators (Futures + Forex position sizing)
- Dock mode with auto-hide
- Theme system (6 themes, 8 accent colours)
- Motivational quote rotation
- Logo embedded (PNG-04)

---

## v1.3.0 — Bot Engine
*March 2026*

### New Features
- **Bot Panel** — full trading bot engine in a new dedicated panel (🤖 in panel toggles)
  - **4 modes**: Signal Alerts · Auto-Trader · Backtest · Paper Trade
  - **4 broker connections**: Tradovate · Project X / TopstepX · MetaTrader 5 · Rithmic
  - **3 built-in strategies**: EMA Crossover · RSI OB/OS · Range Breakout
  - **Custom Script mode** — write your own signal logic in JS
  - **Risk controls**: risk per trade, max daily loss, max daily profit, stop/target ticks, trailing stop
  - **Auto-Execute toggle** — must be deliberately enabled to place live orders
  - **Backtest engine** — 500-bar simulation with net P&L, win rate, max drawdown, trade table
  - **Paper trading** — live sim with running stats (P&L, win rate, avg win/loss), full trade log
  - **Signal feed** — colour-coded 🟢 LONG / 🔴 SHORT alerts with timestamps
  - **Live log console** — scrolling event log at bottom of panel
  - P&L from auto-trader feeds back into Trading accounts panel
  - Daily loss/profit limits automatically stop the bot

---

## v1.3.1 — Bug Fix
*March 2026*

### Fixes
- **pomoWrap null error** — `document.getElementById('pomoWrap').addEventListener()` was called at top level before the DOM was ready, causing a silent crash on startup in some environments. Wrapped in a null guard.

---

## v1.4.0 — Discord + Calendar + QoL
*March 2026*

### New Features
- **Discord Integration** (Settings → Discord tab)
  - Paste any Discord webhook URL — sends messages as "Traders Vault" bot
  - Prop firm account updates: fires when P&L changes by $50+
  - Economic news alerts: 15 min warning before high-impact events, sent to Discord + toast
  - Bot signals: every Long/Short signal posted to your server
  - Daily P&L summary: auto-fires at 5pm UTC with per-firm breakdown
  - Test Webhook button to verify connection instantly
- **Import / Export** (Settings → Data tab)
  - Export everything (firms, accounts, notes, habits, trades, config, layout) as a dated JSON file
  - Import back on any machine — overwrites current data and re-renders all panels live
- **Session Timer in Dock** — shows how long you've been in the current London/NY/Overlap/Asia session, resets automatically on session change
- **Economic Calendar sync in Dock** — next high-impact event shown inline, colour-coded: red < 15min, gold < 30min, white otherwise
- **Global Show/Hide Hotkey** — `Ctrl+Shift+H` fades the entire overlay to invisible (passes all clicks through), press again to restore
- **Daily Checklist Auto-Reset** — strategy checklist (pre-market, setup, risk, post-market) automatically clears at midnight each day

### Fixes
- Escape key now also closes Discord and Data modals

---

## v1.5.3 — Templates, All Panels on Load, Bug Fixes
*March 2026*

### New Features
- **Templates system** — Settings → Templates tab. Save/load/rename/delete named layouts capturing exact panel positions, sizes, and visibility
- **All panels open on first launch** — fresh installs show every panel in a clean default layout with no overlap

### Fixes
- Bot panel missing from `snapToDefault()` and all layout presets — now sits below Calculators
- Bot panel overlapping Trading in DEFAULT_LAYOUT — moved to separate position
- `scheduleHitRects()` missing after drag and after resize — click-through now stays accurate
- `fmtDollar`/`fmtTime` defined after `runBacktest` — moved earlier to prevent reference errors
- `updateDockSessionTimer()` only updated in dock mode — now runs on every clock tick
- Escape key didn't close dynamic modals — tvAccountModal and video modal now close on Escape

---

## v1.5.4 — Admin Dashboard Overhaul & P&L Card Fix
*March 2026*

### Fixes
- **Gains card URL** — hardcoded `tradersvault.vercel.app` replaced with dynamic `_cardUrl` variable (pulls from admin branding or defaults to `tradersvault.uk`)
- **API endpoint** — updated to `https://tradersvault.uk/api`
- **Admin dashboard** — complete rebuild: all changeable features now functional (branding push, update push, user management, P&L live feed)
- **Changelog** — now auto-updated on every version bump
- **GitHub update push** — simplified to one-click refresh + send from admin panel
