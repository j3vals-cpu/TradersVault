## [2.7.11] — 2026-03-30
### Fixed
- Discord panel: added WidgetBot invite link when errors occur
- Gains Card: prop tracker entries now appear on certificate when selected
- Gains Card: firm count on card now reflects only selected accounts
- Gains Card: added Select All / Select None buttons to account selector

## [2.7.10] — 2026-03-30
### Fixed
- Tracker Expenses: category dropdown filter to reduce clutter
- Discord Settings: added missing Server ID and Channel ID inputs for chat panel
- Settings modal: tabs now wrap to multiple rows instead of overflowing off-screen on Windows

## [2.7.9] — 2026-03-30
### Fixed
- Tax Calculator now uses Prop Tracker payouts as income (not Trading account P&L)
- Expense category dropdown added to Prop Tracker entry modal
- Prop entries auto-create expense items when category is selected

## [2.7.8] — 2026-03-30
### Added
- Expense categories now have a "Tax Deductible" toggle — only deductible categories are subtracted in the Tax Calculator
- Deductible/Non-Deductible badge shown on each category in the Tracker
- Account selector modal for Share/Gains Card — choose which trading accounts and prop entries appear on the certificate
- Discord panel moved to 2nd position in dock (after Trading)

### Fixed
- Settings modal widened to 720px with updated responsive breakpoints for better fit on all screen sizes
- Settings modal centering and max-height improved for Windows laptops

## [2.7.7] — 2026-03-30
### Added
- Discord Chat panel — embed a live Discord channel directly into a resizable panel via WidgetBot
- Settings UI for Server ID and Channel ID configuration under DC tab

## v2.7.6

- Settings modal: JS now measures actual window height and forces max-height in pixels (not vh)
- Vertical dock (left/right): JS detects overflow and auto-hides non-essential items
- If dock still overflows, panel buttons shrink to icon-only mode
- Tabs remain single horizontal scrollable row

## v2.7.5

- Fixed settings modal X button and tabs not visible on Windows laptops — tabs now scroll horizontally instead of wrapping
- Fixed right/left dock overflowing on small screens — bar now scrolls, non-essential items auto-hidden
- Compact header and tab sizing on short screens

## v2.7.4

- Fixed settings modal not fitting on Windows laptops — content now scrolls properly within the modal
- Fixed vertical dock (left/right) overflowing on smaller screens — panel buttons scroll, non-essential items auto-hide
- Better responsive scaling for Windows DPI 125%/150%
- Reduced dock button sizes and spacing for compact fit

## v2.7.3

- Fixed iOS PWA blank screen after login
- Fixed missing close tag causing app shell to collapse
- Added position:fixed layout for app container
- Bumped service worker cache to v5
- Staff management: renamed partnerships to graphics

## v2.6.7

- Signup now requires accepting Terms & Conditions
- Marketing email opt-in checkbox on signup
- Consent saved to your profile for GDPR compliance
