<!-- Batch deploy window template: batch {L}, window {W} of the stacked workspace deploy -->

This PR is part of **batch {L}, window {W}** of the stacked workspace deploy
(windows stay at six changed files or fewer; each window stacks on the
previous one; the batch ships one version tag when its last window lands).

## Contents

- {commit subjects carried by this window}

## Gates

Lint, typecheck, prettier, unit tests and the isolated static build green on
the chain tip before opening. Draft until the manual review passes; the merge
order is window by window, deleting the base branch on each merge. The batch
tag (`v0.3.x`) fires when the last window lands.
