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
