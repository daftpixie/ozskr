# Branch Protection Settings

Apply these settings manually in **GitHub > Settings > Branches > Branch protection rules** for the `main` branch.

## Required Settings

### Protect matching branches
- **Branch name pattern:** `main`

### Pull Request Reviews
- [x] Require a pull request before merging
- [x] Require approvals: **1**
- [x] Dismiss stale pull request approvals when new commits are pushed

### Status Checks
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging
- Required checks:
  - `Lint`
  - `Typecheck`
  - `Test`
  - `Build`

### Conversation Resolution
- [x] Require conversation resolution before merging

### Commit History
- [x] Require linear history

### Push Restrictions
- [x] Do not allow force pushes
- [x] Do not allow deletions

### Additional
- [ ] Do not allow bypassing the above settings (enable once CI is stable)
