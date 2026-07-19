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
- **No classic auth, but there is an entry-number gate.** No login, email,
  or password. Every winner gets a unique **entry number**, generated and
  matched to their name by the developer at data-processing time (from the
  Excel list) — never by the user. The app's front door is a panel where the
  user types this number; it is looked up server-side and matched to a name.
  It is a one-time matching key, not an account — don't build session/auth
  infrastructure around it.
- **There is no public/browsable winner list.** Access is 1:1 via entry
  number only; a user must never be able to see other winners' names
  (masked or not) by browsing. After a correct entry number, show the
  masked name (first two letters of first/last name, e.g., "Ay Ka") purely
  as a "did I type the right number" confirmation — not for privacy, since
  there's no shared list to protect against.
- **Entry-number uniqueness is the whole singularity guarantee.** Once a
  number is used for a successful slot selection, mark it used server-side
  (authoritative) so it can't select again — no secondary browser/device
  check needed, since the number itself is already unique per person (this
  supersedes an earlier masked-public-list design; see `INTENT.md` revision
  history if old code/comments reference "mask collision" or "browser lock",
  they're stale).
- **Invalid entry-number attempts must fail generically.** Don't leak
  whether a number exists, is used, or is malformed in a way that helps
  enumerate valid numbers — this is now the system's actual attack surface
  since it replaced the no-list design.
- **Slot locking is the core concurrency problem.** Event × day × time
  combinations have independent limited quotas. When a user starts
  evaluating a slot, it locks for 5 minutes so no other user can see/select
  it; on timeout or no confirmation, the lock releases and the slot reopens.
  This must be implemented as an atomic server-side lock (not a client-side
  or best-effort check) to avoid race conditions where two users grab the
  same slot.
- **Winner lists are per-event.** A person may be a winner in multiple
  events independently, each with its own entry number and its own single
  selection right.
- **PDFs are per-event, not per-person.** One static PDF per event; everyone
  who selects that event downloads the same file. Don't design per-user
  ticket generation.
- **Design reference is İKSV** (sade, zarif, kültür/sanat odaklı, whitespace-
  heavy, typography-forward) — see `INTENT.md` Section 4 before styling UI.

## When adding data (events, quotas, winner lists, PDFs)

This is done by editing static data/files in the codebase and deploying,
per the "no admin panel" rule above — not by building an upload endpoint or
UI, unless the user explicitly changes that decision. When processing a new
Excel winner list, generate the unique entry numbers yourself and commit the
number↔name mapping as static data; how the numbers reach winners
afterwards (email, SMS, survey platform) is out of scope for this codebase.
