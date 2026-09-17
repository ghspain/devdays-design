# Dev Days Design roadmap

This repository stays focused on generating event visual assets. It is not the
community CRM, event database, or social publishing system.

## In scope

1. Local speaker catalogue with a reduced `people.csv` contract.
2. Local sponsor catalogue with `sponsors.csv` and direct upload fallback.
3. Presets for Dev Days, Community Meetup, and online events.
4. Editable event title, edition, city, venue, date, and registration fields.
5. Visual validation for overflow, safe areas, contrast, and logo limits.
6. Batch generation of the supported image formats from one event state.

## Explicitly deferred

- Direct GitHub or Planning synchronisation.
- Luma API creation or event updates.
- Slack, LinkedIn, X, or other communication publishing.
- Full speaker CRM, contact details, biographies, or private data.

## Delivery order

1. Load and select local speakers and sponsors.
2. Apply and edit event presets.
3. Add visual validation feedback before export.
4. Generate a ZIP containing all selected event materials.

The local files act as a stable, human-editable contract. A future integration
may import from Planning, but the editor must remain usable without network
access or external credentials.
