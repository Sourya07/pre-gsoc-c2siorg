# GitHub Repository Intelligence Analyzer

A full-stack TypeScript tool that analyzes multiple GitHub repositories and generates insights about their **activity**, **complexity**, and **learning difficulty**.

Built with **Next.js + TypeScript** as a monorepo with reusable analysis packages.

---

##  Features

- **Multi-repo analysis** — Analyze 5+ GitHub repos at once
- **Activity Score (0–100)** — Based on commits, contributors, issues, and recency
- **Complexity Score (0–100)** — Based on file count, languages, dependencies, CI config
- **Learning Difficulty** — Classifies repos as Beginner / Intermediate / Advanced
- **Premium dark UI** — Glassmorphism cards, gradient scores, animated transitions
- **JSON export** — Download full analysis reports
- **Rate-limit handling** — Caching, exponential backoff, and PAT support
- **Edge case handling** — Graceful fallbacks for missing data, private repos, invalid URLs

---

## Architecture

```
├── apps/web/              → Next.js dashboard + API routes
├── packages/
│   ├── analyzer/          → Scoring formulas & difficulty classifier
│   └── github-client/     → REST API client with caching & retry
├── data/examples/         → Pre-generated sample reports
└── docs/
    ├── SCORING.md         → Formula documentation
    └── RUN.md             → Setup & run instructions
```

The analyzer logic lives in reusable TypeScript packages, separate from the Next.js UI. This makes the scoring testable, portable, and easy to extend.

---

## Quick Start

```bash
# Install dependencies
npm install

# (Optional) Add GitHub token for higher rate limits
echo "GITHUB_TOKEN=ghp_your_token" > apps/web/.env.local

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

##  Scoring Overview

| Score | Formula | Key Factors |
|---|---|---|
| **Activity** (0–100) | Weighted sum | Commits/year (40%), contributors (25%), open issues (20%), recency (15%) |
| **Complexity** (0–100) | Weighted sum | File count (35%), languages (20%), deps (20%), CI/config (15%), depth (10%) |
| **Difficulty** | Rule-based | Complexity thresholds + language count + docs quality |

Full details in [docs/SCORING.md](docs/SCORING.md).

---

##  API

```
POST /api/analyze
Content-Type: application/json

{ "urls": ["https://github.com/facebook/react", ...] }
```

Returns structured JSON with scores, metrics, and difficulty classification per repo.

---

## Deployment

```bash
cd apps/web && npx vercel --yes
```

Set `GITHUB_TOKEN` as an environment variable in Vercel for production rate limits.

---

##  Documentation

- **[Scoring Formulas](docs/SCORING.md)** — All formulas, weights, assumptions, and limitations
- **[Run Instructions](docs/RUN.md)** — Setup, usage, API, deployment, and troubleshooting
- **[Sample Output](data/examples/)** — Pre-generated analysis reports

---

## Rate Limit Strategy

| Mechanism | Details |
|---|---|
| Optional GitHub PAT | 5,000 req/hr (vs 60 unauthenticated) |
| In-memory TTL cache | 30-minute cache per repo |
| Concurrency control | Max 3 repos analyzed concurrently |
| Exponential backoff | 1s → 2s → 4s on 403/429 responses |
| Header monitoring | Checks `X-RateLimit-Remaining` before requests |




