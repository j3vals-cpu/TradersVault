## v2.1.6

- **Real cTrader OAuth2 integration** — replaced the fake cTrader connection (text inputs that created dummy $0 accounts) with a proper OAuth2 flow. "Connect with cTrader" button opens cTrader authorization in a new BrowserWindow, exchanges tokens server-side, and fetches real trading accounts with live balances.
- **Account picker modal** — after OAuth, users see all their cTrader accounts (live + demo) with broker name, account number, balance, and Live/Demo badges. Checkboxes let them choose which accounts to import.
- **Real balance import** — account balances are converted from cTrader's smallest-unit format using moneyDigits (e.g., balance 10000000 with moneyDigits 2 = $100,000.00).
- **Refresh balance button** — cTrader account cards in the Trading panel now show a "Refresh" button that re-fetches the current balance from the cTrader API.
- **Duplicate detection** — re-connecting cTrader updates existing account balances instead of creating duplicates.
- **Secure token handling** — OAuth tokens stored in app config; Client Secret never leaves the server.
- **IPC plumbing** — new `open-ctrader-oauth`, `ctrader-auth-success`, `ctrader-auth-failed` IPC channels in main.js and preload.js.

## v2.1.5

- **Bounds clamping** — panels/windows can no longer get stuck under the taskbar or offscreen. All panel positions are clamped to the visible workArea on drag, resize, pop-out, dock toggle, display change, and viewport resize. Pop-out windows also clamp on move. Safety interval re-checks every 8 seconds.
- **Performance: mouse poller** — reduced click-through polling from 16ms (60fps) to 50ms (20fps) with cached window bounds and scale factor, eliminating redundant screen queries every tick.
- **Performance: backdrop-filter** — reduced all blur radii from 16-20px to 8-10px across topbar, topbar2, footer, dock bar, panels, modals, and overlays. Increased background opacity to compensate visually.
- **Performance: noise overlay** — reduced SVG grain tile from 200px to 100px, lowered octaves from 4 to 2, reduced opacity. Uses explicit background-repeat/size.
- **Performance: hit rect polling** — reduced safety-net interval from 500ms to 2000ms. Resize handler debounced at 100ms.
- **Performance: CSS containment** — added `contain: layout style` to `.win` panels and `.canvas` to isolate repaint areas.
- **Performance: interval leak fix** — dock quote rotation interval now properly cleared on re-entry, preventing accumulated timers.
- **Performance: removed `will-change: transform`** from topbar2 and win elements (was set redundantly and forces GPU layer allocation).
- **Display change handling** — listens to `display-metrics-changed` in addition to add/remove. Invalidates cached workAreas on any display change.

## v2.1.4

- Walkthrough tour — guided onboarding for new users showing all panels
- Dock fix — windows no longer get stuck under taskbar
- Pop Out to Desktop button — more visible panel pop-out control
- Brighter resize handle — gold grip with glow on hover
- Timezone display in topbar — shows current time + timezone
