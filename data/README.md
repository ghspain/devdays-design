# Local event data

These files are deliberately smaller than the canonical data in `ghspain/Planning`.
They are an operational catalogue for this image generator, not a CRM and not a
replacement for Planning.

## `people.csv`

The Event Studio projection joins to `ghspain/Planning/data/people.csv` only by
the stable `person_id`; never match people by name. Planning remains canonical.
The projection is limited to these public identity fields:

| Projection field | Planning field | Event Studio use |
| --- | --- | --- |
| `person_id` | `person_id` | Stable identity key for speaker/catalogue joins; required. |
| `name` | `name` | Public name shown on speaker assets and selection controls; required. |
| `github` | `github` | Optional public profile destination for speaker details and future QR assets; Planning stores the username without `@`. |
| `linkedin` | `linkedin` | Optional public profile destination for speaker details and future QR assets. |
| `x` | `x` | Optional public profile destination for speaker details and future QR assets. |
| `website` | `website` | Optional public website destination for speaker details and future QR assets. |
| `avatar_url` | `avatar_url` | Optional portrait used on speaker assets only when reuse is authorized; a public URL or successful CORS export does not grant image rights. A local upload remains the fallback if an authorized remote image is unavailable or cannot be exported. |
| `professional_title` | `professional_title` | Optional public subtitle for speaker assets and future badges; it is not inferred from an event role. |
| `last_verified` | `last_verified` | Optional ISO date shown as the source's last verification signal for profile fields that age. |

All fields except `person_id` and `name` may be empty. Preserve empty values;
do not guess, scrape, or fabricate missing details. The current `role` column
in the local catalogue is a legacy display label and stays separate from
Planning's `professional_title` so existing catalogue consumers remain
compatible during the transition. Phase #111 owns adding projected columns and
refreshing the static catalogue; this documentation phase does not copy new
profile data or add runtime credentials.

### Provenance and freshness

Copy public values from the Planning row for the matching `person_id` and keep
`last_verified` exactly as published there. It is one source-level date for
ageing profile data, not a per-URL verification claim. A missing date means
freshness is unknown. Event Studio does not invent a timestamp, auto-expire a
value on an arbitrary local time-to-live, or independently verify/refresh a
profile. Before using an old or undated title or public URL in a publication,
follow Planning's manual review guidance and confirm it at the source. The
future UI may surface the source date/unknown state; absence of verification
must not block catalogue selection or be presented as current.

`bio` is intentionally excluded: current speaker assets and selection flows
have no concrete need for it. Do not copy email, phone, private notes, or other
non-public metadata into this repository.

### Refreshing the public people projection

At maintainer time, obtain `data/people.csv` from `ghspain/Planning` and run:

```sh
npm run sync:people -- --source /path/to/Planning/data/people.csv
npm run sync:people -- --source /path/to/Planning/data/people.csv --check
```

The first command updates this repository's `people.csv`; `--check` reports
drift without writing. The refresh keeps the existing local roster/order and
legacy `role` labels, joins only by `person_id`, and copies only fields listed
above. Planning columns such as `bio`, email, or other unapproved data are
ignored. Missing optional profile values stay empty; a missing identity fails
instead of silently dropping a speaker. The browser uses the committed local
catalogue and never calls Planning or needs a token at runtime.
Rows with an inconsistent CSV column count produce a warning and retain the
existing local name/avatar while leaving new profile fields blank; correct the
source row before expecting those fields to refresh.

🧭 DECISION — keep the first person projection minimal and source-dated
- **Question**: Should Event Studio include the public bio and enforce its own staleness cutoff for profile data?
- **Options**: Project bio and invent a local freshness TTL now; or use only fields with a direct asset/profile-destination use and retain Planning's verification date without a second policy.
- **Investigation**: Planning `data/README.md` defines `last_verified` as the date of the last check of ageing data and instructs authors to validate bio/title/social fields before important publication. No current Event Studio template uses bio, and no per-field timestamps or TTL are defined.
- **Decision**: Exclude bio; preserve `last_verified` as the only freshness signal, treat missing as unknown, and defer any automated expiry rule until Planning defines one.
- **To revert**: Add an explicit consumer and source mapping before adding bio, or agree a source-backed freshness threshold and apply it consistently in a later phase.

## `participations.csv`

Relates a person to an event and session. Speaker choices are composed by joining
this file with `people.csv`; there is deliberately no duplicated `speakers.csv`.

## `sponsors.csv` and `organizers.csv`

These brand catalogues contain a public name, website, and transparent logo URLs
for light and dark backgrounds. Each brand provides six logo variants:

- **Full** (`logo_for_light_bg_url` / `logo_for_dark_bg_url`): complete logo with wordmark and icon.
- **Short** (`logo_short_for_light_bg_url` / `logo_short_for_dark_bg_url`): compact horizontal wordmark for narrow spaces (e.g. banner edges).
- **Icon** (`logo_icon_for_light_bg_url` / `logo_icon_for_dark_bg_url`): small square-ish mark for tiny displays (e.g. thumbnails, badges).

Use the black variant on light artwork and the white variant on dark artwork.
When a brand does not publish both variants, both fields may temporarily
point to the same official asset.

## `presets.json`

Presets describe visual defaults. They must not contain event-specific dates,
venues, registration links, or private information.

Planning remains the source of truth for complete event and participation data.
