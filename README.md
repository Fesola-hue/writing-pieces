# Aisha Onola — Writing

A dependency-free static site for Aisha Onola’s personal writing and The OffScript stories. Readers use local generated pages; the site never fetches article content at request time.

## Preview and test

Use Node.js 20 or newer.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`. Run the complete local verification with:

```bash
npm test
```

The build validates content first, then creates `/`, `/personal`, `/offscript`, `/explore`, every `/writing/[slug]` page, structured data, robots.txt, and the sitemap in `dist/`.

## Add a personal story

1. Add its cover to `public/writing/`.
2. Copy `PERSONAL-ARTICLE-TEMPLATE.md` to `content/personal/your-slug.md`.
3. Fill the frontmatter and paste the complete article below it.
4. Run `npm test`, then publish `dist/`.

Required metadata: `title`, `subtitle`, `slug`, `date` (`YYYY-MM-DD`), `category`, `publication`, `cover`, `featured`, and at least one `topics` entry. `originalUrl` and `subscribeUrl` are optional, but must be real URLs when present. Personal `issueNumber` stays empty.

Set `featured: true` to feature a story. Assign topics using a YAML list; exact shared topic names power Explore and related-writing connections.

## Behind the Piece

Use only these fields:

```yaml
behindThePiece:
  note: ""
  process: ""
  extras: []
```

`note` appears as “Why I wrote this”, `process` as “How I approached it”, and `extras` as “Notes I kept”. Leave any field empty to hide that label. If all three are empty, the entire interaction is hidden.

**Behind the Piece is author-written content. Leave it empty until Aisha supplies the note. Never generate it from the article.**

The four supplied root Markdown files remain untouched legacy sources. Their manually managed topics, subscriptions, and note fields live in `content/personal-metadata.json`.

## Sync The OffScript

```bash
npm run sync:offscript
```

The command reads the archive `CollectionPage` JSON-LD, deduplicates by issue number, imports each `NewsArticle` body and metadata, keeps existing issues that disappear from the live archive, reuses or downloads covers, and reports missing fields. Test without writing with:

```bash
node scripts/sync-offscript.mjs --dry-run
```

Author notes live separately in `content/offscript/behind-the-piece.json`. Sync never reads, generates, or overwrites those notes. If reliable structured article data disappears, sync fails without replacing the last good import; compare the server-rendered issue manually and correct `issues.json` rather than guessing.

## Redeploy

Run `npm run sync:offscript` and `npm test`, then deploy the generated `dist/` directory through the existing hosting project attached to `writing.aishaonola.me`. No credentials or automatic deployment are stored here. For an existing Cloudflare Pages project, the equivalent CLI command is `npx wrangler pages deploy dist --project-name <existing-project-name>`.

## Known source issue

The URL supplied for “It’s Kinda Chic to Stay Informed” currently resolves to a different Substack article. Its inaccurate original link is suppressed in `content/personal-metadata.json` until Aisha supplies the correct URL.
