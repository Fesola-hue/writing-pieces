# Content and implementation audit

Audit date: 6 September 2026.

## Personal sources detected

| Title | Slug | Source |
| --- | --- | --- |
| People Who Made My World a Little Bigger | `people-who-made-my-world` | `people-who-made-my-world.md` |
| So, I Started Dating Myself | `so-i-started-dating-myself` | `so-i-started-dating-myself.md` |
| It’s Kinda Chic to Stay Informed | `it-kinda-chic-to-stay` | `it-kinda-chic-to-stay.md` |
| Hear me out: That’s not what decentering men means | `that-not-what-decentering-men` | `that-not-what-decentering-men.md` |

## OffScript sources detected

| Issue | Title | Slug |
| --- | --- | --- |
| 001 | The NYSC Reform Everyone Missed | `offscript-001-everyone-argued-about-a-uniform-they-missed-the-real-reform` |
| 002 | The US Visa Squeeze | `offscript-002-the-us-is-quietly-locking-nigerians-out` |
| 003 | The Boom Nobody Can Feel | `offscript-003-nigeria-is-quietly-having-one-of-its-best-years-internationally-here-s-why-you-still-don-t-feel-it` |
| 004 | Nigeria Uses AI but doesn’t own any of it | `offscript-004-nigeria-doesn-t-have-an-ai-problem-it-has-an-ownership-problem` |
| 005 | Why Cement Costs So Much | `offscript-005-we-make-enough-cement-to-export-it-so-why-is-a-bag-still-13-000` |

Validated the restored Personal and OffScript collections without publishing a collection-size claim.

## Malformed or unreliable fields

- The four supplied Markdown files use a legacy header block without YAML delimiters. The parser supports this format without modifying their bodies; the copyable template uses conventional frontmatter.
- Personal metadata uses mixed key casing (`Title`/`title`, `Subtitle`/`subtitle`) and `publishedOn` rather than `publication`. The loader normalises these keys.
- The original URL supplied for “It’s Kinda Chic to Stay Informed” resolves to a different article, “So, I Started Dating Myself.” The inaccurate link remains suppressed until Aisha supplies the correct URL.
- The Medium URL for “People Who Made My World a Little Bigger” contains a percent-encoded globe in its original published slug, and the stable Medium article ID resolves successfully.
- The imported OffScript JSON-LD contains complete paragraph bodies. The five portfolio issue pages do not expose additional body section headings, lists, captions, credits, or inline source links in their `NewsArticle` data, so none are invented.
- Every active cover exists. All five issue numbers and slugs are unique.

## Cause of the old count/display bug

The old homepage attached `data-writing-card` to both featured cards and every archive card. Its filter counted presentation instances rather than unique content records. The rebuilt site derives its collection from validated content records and never mixes featured presentation instances into collection totals.

## Behind the Piece audit

The previous metadata contained Codex-authored voice, form, inspiration, and process commentary for the writing collection. None was supplied by Aisha. All of it must be deleted. The rebuilt model accepts only manually authored `note`, `process`, and `extras`; all current values are empty, so no Behind the Piece section is rendered publicly.

