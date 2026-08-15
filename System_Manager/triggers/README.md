# System Triggers

Machine-scoped automation runtime artifacts live here.

The current trigger GUI/spec capture lives in
`ai/RC-MacAir-15/Captures/001-Captures/TRIGGERS.md`.

The current model is intentionally small:

1. Name & Description
2. Trigger
3. Script
4. Permissions

The GUI edits the trigger contract. Scripts provide the expressive behavior.
Permissions are the enforceable boundary between the AI-written implementation
and system authority.

## Layout

```text
Automations/
  Triggers/
    Automation_Name/
      TRIGGERS.md
  Scripts/
    Automation_Name/
      some-script.js
```

`TRIGGERS.md` files are locked from AI writes. AI may edit the matching script
folder. The server owns contract writes, permission discovery, and user-approved
permission toggles.

## Runtime Notes

- Test run asks the server to inspect the script and list requested permissions.
- Newly discovered permissions default to `false`.
- Script comments may explain permission requests for display in the GUI.
- Trigger hooks still need CRUD endpoints, test-run plumbing, and system event
  wiring.

See `TRIGGERS.md` for the full contract.
