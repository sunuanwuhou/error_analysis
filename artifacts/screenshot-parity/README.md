# Screenshot Parity Artifacts

This directory stores paired legacy and `/next` screenshots captured against the current imported backup baseline.

Recommended command:

```bash
cd /Users/10030299/Documents/Playground/error_analysis/ui
npm run capture:parity
```

Output layout:

1. one folder per migration slice
2. `desktop/` and `mobile/` subfolders
3. matching `*-legacy.png` and `*-next.png` files
4. `manifest.json` for the route-pair list used in the run
