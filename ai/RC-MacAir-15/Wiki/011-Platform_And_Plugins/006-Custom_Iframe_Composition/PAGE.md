---
name: Custom Iframes Within Composable Views
description: Describes standard host pieces beside custom iframe regions, narrow operation requests and the limits of current embedding.
metadata:
  source-files:
    - fusion-studio-client/src/components/ContentArea.tsx
    - fusion-studio-client/src/components/browser/CustomViewer.tsx
    - fusion-studio-client/src/components/iframe/IframeSurface.tsx
    - fusion-studio-client/src/components/iframe/core/FrameElement.tsx
    - fusion-studio-client/src/components/iframe/core/useIframeNavigation.ts
  last-modified: "2026-09-23T13:50:37Z"
---

Custom iframes remain an approved way to provide specialized UI. The hybrid target combines standard platform pieces with a custom region inside the same working view. It does not require replacing built-in React views with iframes or placing every standard control inside the embedded app.

## Standard host pieces beside a custom region

An illustrative composition could pair standard collection/search controls with a custom visual canvas showing relationships among selected documents. The host supplies explicit selected data to the custom region and offers narrow authorized operations, such as requesting that a selected document open in the canonical file surface. The shell retains tab identity, focus and container lifecycle; the collection retains filtering and selection; file presentation/editing and server save/history keep their existing owners.

This example explains the approved target. It is not manifest syntax, a mandatory component inventory, the selected first conversion or a guarantee that the current Custom view has this integration. A custom canvas does not gain unrestricted server, Node, filesystem or database access by being embedded. Platform requests still need validated identity, supported operations and authorization under the owning service. [Data And Actions](../005-Data_And_Actions/PAGE.md) explains that boundary; [Tabs, Drawers And Files](../004-Tabs_Drawers_And_Files/PAGE.md) explains canonical file hosting.

A separate standard UI library running inside the iframe is optional, deferred work. It is not a prerequisite for placing standard host pieces alongside an embedded region. The exact bridge transport, authentication/authorization, supported operations, compatibility and isolation mechanism remain [open choices](../000-Platform_And_Plugins/001-Decisions/PAGE.md#open-choices-and-decision-gates). This page defines no message envelope, SDK method or executable import interface.

## Current source-inspected embedding

In `ContentArea.tsx`, fixed built-in React components take precedence. A separate local-app branch renders `app/index.html` through a shell-managed iframe; configured custom/iframe panels use `CustomViewer`, and browser panels use their browser wrapper. Those branches are current routing foundations, not evidence of plugin provisioning or the hybrid target's operation interface.

`CustomViewer.tsx` checks locally entered URLs for supported local-server addresses and passes the selected URL to `IframeSurface`. That surface combines the navigation hook with `FrameElement`, which renders an iframe using the supplied source and sandbox attributes. The navigation hook attempts to restore the initial page when it can read a changed origin. A cross-origin location read can fail and return without enforcing that comparison, so the option's name does not establish reliable origin confinement.

These named embedding/navigation paths do not establish an implemented general hybrid bridge, iframe SDK or complete isolation model. This is bounded source inspection, with no product runtime or security certification. [Custom View](../../001-Workspaces_And_Views/006-Custom_Iframe/PAGE.md) retains the detailed current embedding account and its limitations; linking it does not recertify all Electron or browser behavior.

## Remaining capability

The target needs a defined host/custom-region interface with a bounded set of permitted operations and clear failure behavior. Neither an iframe element nor copied instance configuration supplies that authority by itself. Platform/custom-view owners must resolve the interface choices before shipping it; the optional iframe-side library remains separate. [Unfinished Work](../000-Platform_And_Plugins/002-Unfinished_Work/PAGE.md) owns this platform gap, while [Workspaces And Views](../../001-Workspaces_And_Views/000-Workspaces_And_Views/003-Unfinished_Work/PAGE.md) retains provisioning and editable-instance gaps.
