# Lab 3 Release Candidate and Final Main Record

This Markdown file is **not** the submission PDF. It records the repository
state used to prepare the Lab 3 release before the release branch is merged.

- Release baseline SHA: `522eab4b72c75bf1ab59a3190bbc37af52cb8192`
- Release work branch: `feature/20-Lab3ReleaseEvidence`
- Staging branch: `lab3-staging`
- `main` before Lab 3 promotion: `45925aa81a7cc62d2ac39b1c2613e5f010873913`

The final `main` SHA is the 40-character Git identifier created or selected by
the final promotion merge. It cannot be known before that merge. Under the
student's required workflow, all repository Markdown is finalized before the
promotion; the post-merge `main` SHA and graph are therefore preserved in the
submission PDF rather than added through a later documentation branch.

## Pre-promotion release gate

- Server and client production builds: passed on the Issue #40 candidate.
- Client regression: 13 files and 54 tests passed.
- Playwright: 33 tests passed across desktop, tablet, and mobile with no skips.
- Guarded migration: 6 migrations present and no pending migration.
- Repeated seed: stable at 4 Categories, 7 Related Systems, 5 Requesters, and
  12 Tickets; the clean-reset run created 12 Tickets and the repeat run created
  0 additional Tickets.
- Server regression: after the student-authorized reset of only disposable
  database `toktickit_test`, 26 files and 89 tests passed with 0 failures and
  0 skips.

The complete command output and final status are maintained in
[`../tests.md`](../tests.md).
