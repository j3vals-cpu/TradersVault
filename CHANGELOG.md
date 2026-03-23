Traders Vault v1.7.4 — Windows 10/11

## What's New in v1.7.4

### Fixed: Text Encoding
- Fixed 5,050 garbled characters throughout the app (â symbols replaced with proper Unicode)
- All em dashes, bullets, checkmarks, arrows, and box-drawing characters display correctly

### Fixed: Update System
- Update banner now shows download link when a new version is available
- Version check uses correct version number (was comparing against old 1.5.4)

### Fixed: Login & Licence
- Expired/invalid sessions now properly show login screen (was showing "licence needed")
- validateToken properly handles error responses from server

### Fixed: PnL Gains Card
- Close button now clearly visible and clickable (styled red with "✕ Close" text)
- Card renders at full size before export (fixes scale issues with html2canvas)
- Copy to clipboard and Save as PNG both work reliably

### Admin Dashboard
- New "Bump & Build" button to trigger builds from admin panel
- Shows current version, enter new version, one-click build

---
by J3 | Traders Vault
