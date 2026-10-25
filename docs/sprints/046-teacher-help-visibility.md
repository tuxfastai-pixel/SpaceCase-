# Sprint 046 — Visible assistance where teachers choose actions

Goal: make the existing teacher examples easier to discover.
Scope: move the workspace help above capture/class actions; introduce a labelled “Need a hand?” card with a question-mark icon, visible explanation and disclosure chevron; apply the same visual treatment to contextual guides. Expandable examples and all save behavior remain unchanged.
Acceptance: clear text label independent of colour/icon; keyboard-native disclosure; phone layout without horizontal overflow; examples remain hidden when printing; reduced-motion support. No overlays or fixed controls that cover work.
Validation: typecheck, lint, build/CI, actual-component preview for placement and disclosure at phone width.
Release: production approval separate; no data migration or credential changes. Rollback restores the previous guide presentation.
