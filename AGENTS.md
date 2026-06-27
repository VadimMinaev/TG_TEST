# AGENTS.md

## Przykazaniya dlya AI-assistenta

### Pered kazhdym commitom OBYAZATELNO

1. Vypolnit' sborku frontenda:
```
npm run build
```

2. Proverit', chto papka `build/` obnovilas':
```
git status
```

3. Dobavit' VSE izmeneniya (kod + build):
```
git add <izmenennye-fajly> build/
```
ili prosto:
```
git add -A
```

4. Zakomitit':
```
git commit -m "opisanie"
```

5. Push:
```
git push origin master
```

### Pochemu eto vazhno

Frontend sobiraetsya lokalno cherez `vite build`. Docker ne sobiraet frondend sam — on tol'ko kopaet gotovuyu papku `build/`. Esli ne vypolnit' `npm run build` pered commitom, na servere budet STARYJ fronted i novye funkcii ne po'yavyatsya.

### Struktura proekta

- `server/` — Node.js (Express) backend
- `src/` — React (Vite) frontend
- `build/` — sobrannyj frontend (dlya Docker)
- `Dockerfile` — sborka backend + skopirovannyj frontend iz `build/`

### Lint i proverka

```
npm run lint
npx tsc --noEmit
```
