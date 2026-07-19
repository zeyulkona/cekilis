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
  or password. The winner Excel already contains both **name and entry
  number** — the developer (project owner) assigns and uploads this pair
  directly; the app never generates numbers itself. The app's front door is
  a single-field panel: the user types their number and presses **Enter**
  to submit — no separate button required, just Enter-to-submit on that one
  field. It is a one-time matching key, not an account — don't build
  session/auth infrastructure around it.
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
- **Design system is `Design.md` ("Sage").** İKSV-inspired (sade, zarif,
  kültür/sanat odaklı, whitespace-heavy, typography-forward — see
  `INTENT.md` Section 4), extended with light gamification limited to
  feedback/celebration moments (entry-code confirmation, 5-minute lock
  countdown, ticket-ready state). Read `Design.md` for actual color/type/
  component tokens before styling any UI — don't invent new accent colors
  or gamification mechanics (points, levels, leaderboards) beyond what it
  specifies; its Do's and Don'ts section is explicit about this boundary.

## When adding data (events, quotas, winner lists, PDFs)

This is done by editing static data/files in the codebase and deploying,
per the "no admin panel" rule above — not by building an upload endpoint or
UI, unless the user explicitly changes that decision. Winner Excel files
arrive with name and entry number already paired by the project owner —
just import that pairing as static data verbatim; do not generate, reassign,
or reorder entry numbers yourself.

## Working style (Karpathy guidelines)

Adapted from https://github.com/multica-ai/andrej-karpathy-skills — apply
when writing, reviewing, or refactoring code in this repo. Bias toward
caution over speed; use judgment on trivial tasks.

1. **Think before coding.** Don't assume, don't hide confusion. State
   assumptions explicitly. If multiple interpretations exist, present them
   instead of silently picking one. If something is unclear, stop and ask.
2. **Simplicity first.** Minimum code that solves the problem — no features
   beyond what was asked, no speculative abstractions or config knobs, no
   error handling for scenarios that can't happen here (e.g. this system has
   no auth, so don't add auth-shaped error paths "just in case"). If it
   could be half the size, rewrite it.
3. **Surgical changes.** Touch only what the task requires. Don't refactor
   or reformat adjacent code. Match existing style even if you'd choose
   differently. Remove imports/variables your own change orphaned; leave
   pre-existing dead code alone (mention it, don't delete it).
4. **Goal-driven execution.** Turn tasks into verifiable success criteria
   before starting (e.g. "add the entry-number lock" → "write a test that
   two concurrent submits for the same number only let one through, then
   make it pass"). State a brief step → verification plan for multi-step
   work.
