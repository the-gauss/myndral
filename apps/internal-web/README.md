# myndral-internal-web

Internal employee studio for catalog operations (artists, albums, tracks).

## Development

```bash
cd apps/internal-web
npm install
npm run dev
```

Default local URL: `http://127.0.0.1:5174`

The app proxies `/v1/*` requests to the API at `http://127.0.0.1:8000` by default.
