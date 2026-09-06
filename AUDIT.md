# Content and implementation audit

Audit date: 6 September 2026.

## Personal sources detected

| Title | Slug | Source |
| --- | --- | --- |
| People who made my world a little bigger❤️ | `people-who-made-my-world` | `people-who-made-my-world.md` |
| So, I started dating myself | `so-i-started-dating-myself` | `so-i-started-dating-myself.md` |
| It’s Kinda Chic to Stay Informed | `it-kinda-chic-to-stay` | `it-kinda-chic-to-stay.md` |
| Hear me out: That’s not what decentering men means | `that-not-what-decentering-men` | `that-not-what-decentering-men.md` |

## OffScript sources detected

| Issue | Title | Slug |
| --- | --- | --- |
| 001 | Everyone argued about a uniform. They missed the real reform. | `offscript-001-everyone-argued-about-a-uniform-they-missed-the-real-reform` |
| 002 | The US Is Quietly Locking Nigerians Out | `offscript-002-the-us-is-quietly-locking-nigerians-out` |
| 003 | Nigeria Is Quietly Having One of Its Best Years Internationally. Here's Why You Still Don't Feel It. | `offscript-003-nigeria-is-quietly-having-one-of-its-best-years-internationally-here-s-why-you-still-don-t-feel-it` |
| 004 | Nigeria Doesn't Have an AI Problem. It Has an Ownership Problem. | `offscript-004-nigeria-doesn-t-have-an-ai-problem-it-has-an-ownership-problem` |
| 005 | We Make Enough Cement to Export It. So Why Is a Bag Still ₦13,000? | `offscript-005-we-make-enough-cement-to-export-it-so-why-is-a-bag-still-13-000` |
| 006 | Nigeria Just Found Billions for Schools, Hospitals, and Roads. So Why Are 6,516 Clinics Still Empty? | `offscript-006-nigeria-just-found-billions-for-schools-hospitals-and-roads-so-why-are-6-516-clinics-still-empty` |
| 007 | Uber Just Left Nigeria. | `offscript-007-uber-just-left-nigeria` |

Validated collection: 4 personal pieces + 7 OffScript issues = 11 unique pieces.

## Malformed or unreliable fields

- The four supplied Markdown files use a legacy header block without YAML delimiters. The parser supports this format without modifying their bodies; the copyable template uses conventional frontmatter.
- Personal metadata uses mixed key casing (`Title`/`title`, `Subtitle`/`subtitle`) and `publishedOn` rather than `publication`. The loader normalises these keys.
- The original URL supplied for “It’s Kinda Chic to Stay Informed” resolves to a different article, “So, I started dating myself.” The inaccurate link remains suppressed until Aisha supplies the correct URL.
- The Medium URL for “People who made my world a little bigger❤️” contains a variation-selector character in its slug, but the stable Medium article ID resolves successfully.
- The imported OffScript JSON-LD contains complete paragraph bodies. The current seven issue pages do not expose additional body section headings, lists, captions, credits, or inline source links in their `NewsArticle` data, so none are invented.
- Every supplied cover exists. All seven issue numbers and slugs are unique.

## Cause of the old count/display bug

The old homepage attached `data-writing-card` to both featured cards and every archive card. Its filter counted DOM cards rather than unique content records. Selecting Personal therefore reported 6: two duplicated featured DOM cards plus four unique personal archive cards. Only four pieces appeared in the visible collection because there are correctly four unique personal records. The rebuilt site derives counts from the validated content arrays and never mixes featured presentation instances into collection counts.

## Behind the Piece audit

The previous metadata contained Codex-authored voice, form, inspiration, and process commentary for all eleven pieces. None was supplied by Aisha. All of it must be deleted. The rebuilt model accepts only manually authored `note`, `process`, and `extras`; all current values are empty, so no Behind the Piece section is rendered publicly.
