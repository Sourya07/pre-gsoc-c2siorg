# Running the GitHub Repository Intelligence Analyzer

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **GitHub Personal Access Token** (optional but recommended)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Sourya07/pre-gsoc-c2siorg.git
cd pre-gsoc-c2siorg
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure GitHub Token (optional)

Create `.env.local` in `apps/web/`:

```bash
# Without token: 60 API requests/hour
# With token: 5,000 API requests/hour
GITHUB_TOKEN=ghp_your_token_here
```

Generate a token at [github.com/settings/tokens](https://github.com/settings/tokens). No special scopes needed for public repos.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Enter GitHub repository URLs (one per line) in the textarea
2. Click **🚀 Analyze**
3. View the analysis report cards with scores and metrics
4. Click **📥 Download JSON** to save the full report

### Supported URL Formats

- `https://github.com/owner/repo`
- `github.com/owner/repo`
- `owner/repo`

## API Endpoint

```
POST /api/analyze
Content-Type: application/json

{
  "urls": [
    "https://github.com/facebook/react",
    "https://github.com/expressjs/express"
  ]
}
```

**Response**: See `data/examples/sample-report.json` for the full schema.

## Project Structure

```
├── apps/web/         → Next.js dashboard & API
├── packages/
│   ├── analyzer/     → Scoring formulas & classifiers
│   └── github-client/→ GitHub API client with caching
├── data/examples/    → Pre-generated sample reports
├── docs/             → Documentation
│   ├── SCORING.md    → Scoring formula explanations
│   └── RUN.md        → This file
└── README.md
```

## Deployment

### Vercel (Recommended)

```bash
cd apps/web
npx vercel --yes
```

Set `GITHUB_TOKEN` in Vercel Environment Variables for higher rate limits.

### Build for Production

```bash
npm run build
npm run start
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Rate limit exceeded | Add a `GITHUB_TOKEN` to `.env.local` |
| Empty commit activity | GitHub computes stats asynchronously — retry after a few seconds |
| Truncated tree data | Expected for very large repos (>100k files) |
| Private repo not found | Token needs `repo` scope for private repos |
