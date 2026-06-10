# Secrets Manager

Secrets Manager is where Fusion stores manual tokens and API keys that apps and scripts need in order to talk to outside services.

The first version is a guided token/API-key library. It is for credentials the user creates in a provider dashboard and pastes into Fusion.

## Two Setup Styles

**Manual token/API key** means the user creates a key in the provider's dashboard, then pastes the value into Fusion's Secrets Manager.

**OAuth/sign-in** means the user clicks Connect, signs in through the provider, and Fusion stores the returned token automatically.

OAuth/sign-in apps belong in Connectors or in a future OAuth Apps flow, not in this manual-token list.

## What Users Should See

Users should choose a manual-token app template instead of memorizing secret names.

Current inactive templates:

- GitHub -> `GITHUB_TOKEN`
- GitLab -> `GITLAB_TOKEN`

The UI can show friendly labels while the system keeps stable internal names.

Slack should be treated as a future OAuth connector, not as a manual token/API-key template. It should appear with Connectors or a future OAuth Apps flow when that product path exists.

## Safety Rule

Secret values belong only in the secret value field.

They should not be pasted into chat, documentation, handoffs, logs, tests, or source files.
