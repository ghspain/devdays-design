# Local event data

These files are deliberately smaller than the canonical data in `ghspain/Planning`.
They are an operational catalogue for this image generator, not a CRM and not a
replacement for Planning.

## `people.csv`

Only include public data needed to create speaker assets:

- `person_id`: stable slug shared with Planning when available.
- `name`: public name.
- `role`: short display role, not a full biography.
- `avatar_url`: optional public avatar URL. A local upload remains the fallback when
  a remote image cannot be exported because of CORS or availability.

Do not copy email, private notes, social profiles, or full biographies here.

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
