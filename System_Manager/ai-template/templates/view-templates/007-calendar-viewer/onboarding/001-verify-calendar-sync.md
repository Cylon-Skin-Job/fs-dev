---
id: CAL-ONBOARD-001
title: Verify Calendar sync is enabled
state: open
priority: setup
---

Verify that Calendar sync is enabled through macOS Calendar access or Google OAuth before relying on calendar data in Fusion Studio.

## Checklist

- [ ] Ask the user whether they want macOS Calendar, Google Calendar, or both.
- [ ] Confirm the required connector is configured.
- [ ] Confirm Fusion Studio can read calendar events.
- [ ] Confirm write/update permissions if calendar write tools are enabled.
- [ ] Document which connector is active for this workspace.

## Questions For User

- Should Fusion Studio use macOS Calendar, Google Calendar, or both?
- Should AI tools have read-only or read-write calendar access?
- Which calendars should be visible to Fusion Studio?

## Reference Links

- `System Source Files/Wiki/Connectors/MacOS/Calendar`
- `System Source Files/Wiki/Connectors/Google_OAuth/Calendar`
