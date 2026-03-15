# Scoring Formulas — GitHub Repository Intelligence Analyzer

This document explains the scoring formulas, assumptions, and limitations used by the analyzer.

---

## Activity Score (0–100)

Measures how actively a repository is maintained and contributed to.

### Formula

| Factor | Weight | Range | Source |
|---|---|---|---|
| Commits in last year | 40% | 0–2,000 | `GET /repos/{owner}/{repo}/stats/commit_activity` |
| Contributor count | 25% | 0–200 | `GET /repos/{owner}/{repo}/contributors` |
| Open issues | 20% | 0–500 | `GET /repos/{owner}/{repo}` |
| Recency (last push) | 15% | 0–365 days | `pushed_at` field |

```
activity_score = (
  normalize(commits_last_year, 0, 2000)  × 0.40 +
  normalize(contributor_count, 0, 200)    × 0.25 +
  normalize(open_issues, 0, 500)          × 0.20 +
  recency_factor(pushed_at)               × 0.15
) × 100
```

**Normalization**: `normalize(value, min, max) = clamp((value - min) / (max - min), 0, 1)`

**Recency factor**: Returns 1.0 if pushed within 7 days, linearly decays to 0.0 over 365 days.

### Assumptions
- Repos with > 2,000 commits/year are treated as maximally active
- Open issues indicate community engagement, not abandonment
- More contributors doesn't always mean "better," but >200 is normalized to max

---

## Complexity Score (0–100)

Estimates how structurally complex a repository is.

### Formula

| Factor | Weight | Range | Source |
|---|---|---|---|
| File count | 35% | 0–5,000 | Git tree API (recursive) |
| Language diversity | 20% | 1–10 | `GET /repos/{owner}/{repo}/languages` |
| Dependency files | 20% | 0–10 | Tree analysis (package.json, requirements.txt, etc.) |
| CI/config/infra files | 15% | 0–8 | Tree analysis (.github/workflows, Dockerfile, etc.) |
| Maximum folder depth | 10% | 0–15 | Tree path analysis |

```
complexity_score = (
  normalize(file_count, 0, 5000)          × 0.35 +
  normalize(language_count, 1, 10)        × 0.20 +
  normalize(dep_file_count, 0, 10)        × 0.20 +
  normalize(ci_config_count, 0, 8)        × 0.15 +
  normalize(max_folder_depth, 0, 15)      × 0.10
) × 100
```

### Dependency Files Detected
`package.json`, `requirements.txt`, `Pipfile`, `Cargo.toml`, `go.mod`, `pom.xml`, `Gemfile`, `composer.json`, `pubspec.yaml`, `CMakeLists.txt`, and their lockfiles.

### CI/Config Files Detected
`.github/workflows`, `.travis.yml`, `.circleci`, `Dockerfile`, `docker-compose.yml`, `Jenkinsfile`, `vercel.json`, `netlify.toml`, `fly.toml`, `serverless.yml`, `k8s/`, `terraform/`.

### Assumptions
- File count is the strongest signal of structural complexity
- Repos with >5,000 files are treated as maximally complex
- Presence of lockfiles counts toward the dependency signal

---

## Learning Difficulty Classification

Assigns one of three levels: **Beginner**, **Intermediate**, or **Advanced**.

### Rules

| Level | Primary Condition | Additional Signals |
|---|---|---|
| **Beginner** | complexity < 35 | ≤2 dependency files, ≤2 languages, small codebase |
| **Intermediate** | complexity 35–70 | Multi-language, moderate contributor count |
| **Advanced** | complexity > 70 | >5,000 files, >8 deps, >5 languages, limited docs |

### Override Rules
- A repo is **Advanced** regardless of complexity if it has >5,000 files or >8 dependency manifests with >5 languages
- A repo can only be **Beginner** if it has ≤2 dependency files AND ≤2 languages

### Reasoning Generation
Each classification includes a human-readable explanation string describing why that level was chosen, e.g., "High complexity score, large codebase (12,456 files), 8 languages, heavy dependency structure."

---

## Limitations

1. **Commit activity delay**: GitHub's `stats/commit_activity` endpoint may return empty/stale data on first request (GitHub computes it asynchronously). Retry logic mitigates this.

2. **Truncated trees**: Repos with >100,000 files or >7MB tree responses will have `truncated=true`. File count may be underestimated.

3. **Contributor count capped at 100**: Only the first page of contributors is fetched. Repos with >100 contributors will show 100.

4. **No code-level analysis**: Complexity is structural, not semantic. A 1,000-line file of simple code scores the same as a 1,000-line file of dense algorithms.

5. **Private repos**: Requires a GitHub PAT with `repo` scope. Without auth, only public repos are accessible.

6. **Rate limits**: Unauthenticated: 60 req/hr. Authenticated: 5,000 req/hr. Each repo analysis uses ~5–6 API calls.

7. **No GraphQL**: The tool uses REST exclusively. Future versions could use GraphQL for batched field fetching.
