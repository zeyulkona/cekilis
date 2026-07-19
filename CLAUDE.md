# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository currently contains only `INTENT.md`. There is no application
code, build tooling, package manifest, or test suite yet. Do not assume a
framework or invent build/lint/test commands — check for a package manifest
(`package.json`, `pyproject.toml`, etc.) before running anything, and if none
exists, treat the stack itself as an open decision to raise with the user
rather than guessing.

## Source of truth

`INTENT.md` is the authoritative product/behavior spec for this system and
must be read before making implementation decisions. It uses the RTCS-G
framework (Role · Task&Format · Context&Constraint · Style&Tone · Guardrail).
Do not duplicate its contents here — read it directly. The constraints below
are the ones most likely to be violated by an implementation that doesn't
consult it first.

## Non-negotiable constraints from INTENT.md

- **No admin panel, ever.** Events, quotas, winner lists, and PDFs are added
  by the developer editing static data/files and redeploying — never build a
  runtime CRUD/upload UI for this data, even if asked to add "an admin
  screen" casually. This is an explicit product decision, not an oversight.
- **No auth.** No login, email, password, or verification code flows. The
  one mandatory rule the system enforces is that a winner name can only be
  used for a successful selection once (row-level lock, authoritative,
  server-side), plus a non-authoritative secondary browser/device check
  (localStorage/cookie) to discourage accidental repeat selections — not a
  security boundary.
- **Slot locking is the core concurrency problem.** Event × day × time
  combinations have independent limited quotas. When a user starts
  evaluating a slot, it locks for 5 minutes so no other user can see/select
  it; on timeout or no confirmation, the lock releases and the slot reopens.
  This must be implemented as an atomic server-side lock (not a client-side
  or best-effort check) to avoid race conditions where two users grab the
  same slot.
- **Winner lists are per-event, masked, and de-duplicated.** Names show only
  the first two letters of first/last name (e.g., "Ay Ka"). If a mask
  collides across multiple people in the same event's list, an automatic
  disambiguating suffix must be shown (e.g., "Ah Yı (1)", "Ah Yı (2)") —
  this is a correctness requirement, not cosmetic, since a collision without
  it lets someone claim the wrong person's ticket.
- **PDFs are per-event, not per-person.** One static PDF per event; everyone
  who selects that event downloads the same file. Don't design per-user
  ticket generation.
- **Design reference is İKSV** (sade, zarif, kültür/sanat odaklı, whitespace-
  heavy, typography-forward) — see `INTENT.md` Section 4 before styling UI.

## When adding data (events, quotas, winner lists, PDFs)

This is done by editing static data/files in the codebase and deploying,
per the "no admin panel" rule above — not by building an upload endpoint or
UI, unless the user explicitly changes that decision.
