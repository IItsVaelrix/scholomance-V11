# Local Data Packs

This directory is intentionally kept out of Git and Docker build context.

Why:
- `raw-wiktextract-data.jsonl.gz` is very large and can exceed Git host limits.
- These files are build-time data inputs, not required for normal app runtime.

Render deployment notes:
- Keep runtime writable data on the mounted disk (`/var/data` in `render.yaml`).
- If you need dictionary rebuilds in production, store source packs in object storage and download them on demand.

To rebuild the offline dictionary locally:
```bash
python scripts/build_scholomance_dict.py \
  --kaikki_url "PASTE_KAIKKI_URL" \
  --oewn_url "PASTE_OEWN_URL" \
  --db scholomance_dict.sqlite \
  --overwrite
```
