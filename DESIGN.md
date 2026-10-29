# Design

Swiss, quiet, one accent. The page is a reading surface: the passage, the answer, the words that disappeared.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f3f1ec` | Page |
| `--paper-raised` | `#faf8f4` | Fields |
| `--ink` | `#1a1916` | Text, primary button |
| `--muted` | `#3f3d39` | Secondary text |
| `--rule` | `#d8d2c8` | Hairlines |
| `--accent` | `#8f1d3a` | The mark, a failed check, focus |
| `--mark` | `#f4b8c6` | Highlight behind the dropped words |
| `--font` | Inter, Helvetica Neue, Helvetica, Arial | 400 body, 600 headings |
| `--space-1` … `--space-8` | 4, 8, 12, 16, 24, 32, 48, 72 px | |

Measured contrast on `--paper`: ink 15.6:1, muted 9.6:1, accent 7.7:1. The highlight keeps ink on `--mark`, above 4.5:1, and underlines the span in the accent so a failure is not colour alone. Pass and fail are words.

## Type

One scale. The title is the sentence the tool exists to show. Labels are 13px, uppercase, tracked. Passage text is the body size. Numbers are tabular.

## Motion

Only two motions, and only when they explain:

- A retrieved passage rises 8px into its column (opacity and transform, about 420ms).
- A failed span pulses once (opacity, 700ms).

`prefers-reduced-motion: reduce` turns both off.

## Layout

Desktop is two columns: the question, then the handbook; then keyword beside meaning. Below 800px the question comes first and the columns stack. Targets are at least 44px. The handbook is not uploaded unless the visitor chooses the server model, and the page says so.
