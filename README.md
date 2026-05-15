# The Drunken Botanist

A field guide and working notebook for the botanist-at-the-bar. Inspired by
Amy Stewart's book of the same name.

Live: https://drunken-botanist.vercel.app

## What's in it

- **Cocktail collection** — 426 drinks pre-fetched from [TheCocktailDB](https://www.thecocktaildb.com/) free API, with ingredient images and ABV/type metadata
- **Botanical field guide** — 70 curated plants with original blurbs, live Wikipedia summaries, and cross-links to every cocktail that uses them
- **Cocktail Calculator** — tell it what's on your shelf and how many guests are arriving; it scans 1,127 bar-quality recipes (Hotaling + CocktailDB + cocktail_data datasets) and recommends a party menu that fits your inventory. Pure rule-based, no LLMs.
- **My Bar** — checklist of every ingredient; persists to your account; powers "what can I make tonight"
- **Notebook** — cocktail tasting notes with ratings, saved botanicals, and lightweight botanical field notes for real-world observations
- **Owner-only Library** — admin accounts get a private reading room with a protected reader, bookmarks, and saved snippets.

## Stack

- Next.js 16 (App Router) + React 19
- Tailwind v4 with a "vintage herbarium" theme (Fraunces + Inter + Caveat)
- Supabase (email/password auth + Postgres with RLS)
- Deploys to Vercel

## Local dev

```bash
npm install
cp .env.local.example .env.local       # fill in real values (gitignored)
npm run dev
```

Visit http://localhost:3000.

## Data refresh scripts

```bash
npm run refresh-cocktails    # re-walk CocktailDB a..z
node scripts/enrich-ingredients.mjs   # refresh ingredient descriptions + ABV
node scripts/build-recipes.mjs        # rebuild the calculator's unified recipe set
```

Run those when you want fresher data. Output is committed under `data/`.

## Owner-only library

```bash
# 1. Put your PDF at:  private/book/drunken-botanist.pdf
# 2. Then:
npm run extract-book
```

Writes per-botanical indexed notes into `private/book-excerpts/`. The entire
`private/` directory is gitignored, so book content and private deploy notes are
never committed.

## Deploy

The full step-by-step (with real values, Vercel screenshots, Supabase
redirect-URL patterns, and pre-push security checks) lives in
`private/DEPLOY.md` — that file is gitignored.

Quick version:

1. **Supabase** — create a free project, run the SQL files in
   `supabase/migrations/` in order in the SQL editor, enable email/password
   auth, and add your local + Vercel URLs to the redirect allow list.
   For the free-tier no-SMTP setup, turn **Confirm email** off in
   Authentication → Providers → Email so sign-ups do not send confirmation
   emails. If you keep confirmation emails on, configure a custom SMTP provider
   to avoid the built-in email sender's strict rate limit.
2. **Vercel** — import the GitHub repo, set three env vars in Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OWNER_EMAILS` (comma-separated admin emails)
3. Deploy. Then add the Vercel URL back to Supabase's redirect allow list.

See `private/DEPLOY.md` for the precise walkthrough with the actual env values
and security pre-flight checks.

## Project layout

```
app/                 routes (App Router)
  cocktails/         browse + detail (with favorites + tasting notes)
  botanicals/        field guide
  calculator/        inventory → party menu scoring
  bar/               "what can I make tonight"
  favorites/         saved cocktails + observations
  library/           OWNER-ONLY: protected reader + private notes
  login/             email/password sign-in + sign-up
  auth/callback/     PKCE code exchange for optional email confirmation
  auth/signout/      sign-out route
  api/wikipedia/     server proxy to Wikipedia REST summary
lib/
  supabase/          server + browser + middleware clients
  cocktaildb.ts      types + helpers over data/cocktails.json
  botanicals.ts      curated botanicals + ingredient→slug map
  calculator.ts      recipe scoring + party-menu greedy picker
  ingredient-details.ts  ABV + type + image URL helpers
  auth.ts            getUser() + isOwner() with multi-email support
data/
  cocktails.json     ~426 drinks from CocktailDB
  ingredient-details.json   description + ABV + type per ingredient
  botanicals.json    ~70 curated plants
  recipes.json       ~1,127 unified recipes for the calculator
  canonical-ingredients.json  the calculator's ingredient registry
scripts/
  fetch-cocktails.mjs       refresh data/cocktails.json
  enrich-ingredients.mjs    refresh data/ingredient-details.json
  build-recipes.mjs         rebuild data/recipes.json from CSVs
  extract-book.mjs          owner-only PDF excerpt extractor
private/             gitignored — PDF, deploy doc, datasets
supabase/migrations/ schema + RLS policies
```

## Notes

- TheCocktailDB free tier caps `search.php?f=letter` at 25 results per letter. ~426 unique drinks after dedupe is plenty for personal use.
- Multi-ingredient filtering ("what can I make?") is premium-only on CocktailDB. Pre-fetching everything and filtering locally bypasses that.
- The calculator's 1,127 recipes come from three datasets (Hotaling, cocktail_data, CocktailDB). Only structured ingredient lists with measurements + brief technique are stored; longer creative bartender prose is not retained.
- For personal use.
