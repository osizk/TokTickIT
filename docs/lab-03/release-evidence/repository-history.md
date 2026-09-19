# Lab 3 Repository History Evidence

## Pre-merge release baseline

- Lab 3 staging/release baseline SHA: `522eab4b72c75bf1ab59a3190bbc37af52cb8192`
- `main` before Lab 3 promotion: `45925aa81a7cc62d2ac39b1c2613e5f010873913`
- Active release branch: `feature/20-Lab3ReleaseEvidence`
- Release target: `lab3-staging`, followed by the authorized promotion of
  `lab3-staging` to `main`.

The Issue #40 commit and eventual `main` merge SHA cannot be known before those
Git operations occur. The submission PDF is the final visual record of the
post-promotion `main` graph.

## Integrated Lab 3 pull requests

| Issue | Pull request | Branch | Merge commit | State |
|---|---|---|---|---|
| #33 | [PR #43](https://github.com/osizk/TokTickIT/pull/43) | `feature/13-Lab3Contract` | `dceb6f3` | Merged |
| #34 | [PR #44](https://github.com/osizk/TokTickIT/pull/44) | `feature/14-Lab3AuthFoundation` | `8f16213` | Merged |
| #35 | [PR #45](https://github.com/osizk/TokTickIT/pull/45) | `feature/15-Lab3RequesterAuthRegression` | `fdecfd9` | Merged |
| #36 | [PR #46](https://github.com/osizk/TokTickIT/pull/46) | `feature/16-Lab3StaffQueue` | `13402cc` | Merged |
| #37 | [PR #47](https://github.com/osizk/TokTickIT/pull/47) | `feature/17-Lab3TicketOperations` | `d78b0f0` | Merged |
| #38 | [PR #48](https://github.com/osizk/TokTickIT/pull/48) | `feature/18-Lab3UserManagement` | `d257f9d` | Merged |
| #39 | [PR #49](https://github.com/osizk/TokTickIT/pull/49) | `feature/19-Lab3E2EVisual` | `522eab4` | Merged |

GitHub was queried during Issue #40 and confirmed that PRs #43-#49 are merged
into `lab3-staging`. The graph command used for readable submission evidence is:

```powershell
git log --graph --decorate --oneline --all --date-order --max-count=60
```
