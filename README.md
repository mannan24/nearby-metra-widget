# Nearby Metra

Scriptable iPhone widget: nearest Metra Electric station, next train to Millennium, next train from Millennium, routed walking duration, and leave-by estimate.

Install and configure: https://mannan24.github.io/nearby-metra-widget/

GitHub Pages hosts public compact timetable files. GitHub Actions downloads the official Metra timetable twice daily, rebuilds seven days of station schedules, records the refresh, and deploys Pages. No personal data or API keys belong in this repository.

The phone obtains location through Scriptable, fetches GTFS realtime directly from Metra, and requests a foot-walking route directly from HeiGIT. API keys are entered in Scriptable and stored in its Keychain. The widget requests a five-minute refresh; iOS determines when it actually runs. No weekly manual timetable update is required.

## Development

Node 22 or newer. Run `npm ci`, `npm test`, `npm run build`, `npm run data`. `METRA_ZIP` can name a local official schedule ZIP for offline generation. Output is `docs/`.

Publishing uses the `publish.yml` workflow and GitHub Pages with build type `workflow`. The public repository uses GitHub's free Linux Actions and Pages allowances. The workflow's data commits also maintain repository activity. Failed jobs leave the previous published feed intact; clients reject timetables older than 48 hours.

## Limits

Nearest is by geographic distance on Metra Electric, not all Metra lines. Walking routes end at GTFS station coordinates and may not represent the preferred entrance; a three-minute platform buffer is added. No walk duration is invented when the routing service fails. Feed timestamps and stop-specific predictions must be within five minutes to be labelled live. Missing predictions fall back to labelled scheduled times. The merger uses exact trip ID plus service date; added/replacement trips and uncertain matches are not inferred. Live delays can invalidate a previously displayed leave-by estimate. Times always use America/Chicago.

Pending on-device checks: Metra key authentication, HeiGIT key authentication and route result, iOS location permissions, widget rendering, actual update frequency. The setup page describes all external services. Obtain keys through the providers; do not add them to source or issues.

This project is not affiliated with Metra. Timetables come from https://schedules.metrarail.com/gtfs/schedule.zip. Walking routes © openrouteservice / HeiGIT and © OpenStreetMap contributors. GTFS realtime bindings use Apache-2.0; see GTFS-LICENSE.txt. Bundled dependencies retain their licenses.
