'use client';

import { useState } from 'react';

// Language colors for the tags
const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Lua: '#000080',
  Scala: '#c22d40',
  R: '#198CE7',
  Objective: '#438eff',
  Perl: '#0298c3',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
};

function getLangColor(lang: string): string {
  return LANG_COLORS[lang] || '#8b8b8b';
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
}

interface RepoMetrics {
  commitsLastYear: number;
  openIssues: number;
  languageCount: number;
  fileCount: number;
  dependencyFileCount: number;
  ciFileCount: number;
  maxFolderDepth: number;
  repoSizeKB: number;
  hasReadme: boolean;
  hasDocsFolder: boolean;
}

interface RepoReport {
  repository: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  mainLanguages: string[];
  contributorCount: number;
  activityScore: number;
  complexityScore: number;
  learningDifficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  reasoning: string;
  metrics: RepoMetrics;
  fetchedAt: string;
  errors: string[];
}

interface AnalysisResult {
  reports: RepoReport[];
  analyzedAt: string;
  totalRepos: number;
  rateLimitInfo: {
    remaining: number;
    limit: number;
    resetAt: string;
  } | null;
}

const DEFAULT_URLS = `https://github.com/facebook/react
https://github.com/expressjs/express
https://github.com/sindresorhus/is
https://github.com/kelseyhightower/nocode
https://github.com/torvalds/linux`;

export default function HomePage() {
  const [input, setInput] = useState(DEFAULT_URLS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const urls = input
      .split('\n')
      .map(u => u.trim())
      .filter(u => u.length > 0);

    if (urls.length === 0) {
      setError('Please enter at least one GitHub repository URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Analysis failed');
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repo-analysis-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="bg-grid" />

      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header__badge">
            <span></span>
            <span>Repository Intelligence</span>
          </div>
          <h1 className="header__title">
            GitHub Repo Analyzer
          </h1>
          <p className="header__subtitle">
            Analyze repositories for activity, complexity, and learning difficulty.
            Get structured insights powered by GitHub API data.
          </p>
        </header>

        {/* Input Section */}
        <section className="input-section" id="input-section">
          <label className="input-section__label" htmlFor="repo-urls">
            Repository URLs (one per line)
          </label>
          <textarea
            id="repo-urls"
            className="input-section__textarea"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`https://github.com/owner/repo\nhttps://github.com/another/repo`}
            disabled={loading}
          />
          <div className="input-section__actions">
            <span className="input-section__hint">
              Supports full URLs, github.com/owner/repo, or owner/repo format
            </span>
            <button
              id="analyze-btn"
              className="btn-analyze"
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading__spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} />
                  Analyzing...
                </>
              ) : (
                <> Analyze</>
              )}
            </button>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="error-banner" id="error-banner">
            ⚠️ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading">
            <div className="loading__spinner" />
            <div className="loading__text">Fetching repository data from GitHub API...</div>
            <div className="loading__progress">This may take a moment for large repositories</div>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            <div className="results-header">
              <div>
                <h2 className="results-header__title" id="results-heading">Analysis Results</h2>
                <span className="results-header__count">
                  {result.totalRepos} {result.totalRepos === 1 ? 'repository' : 'repositories'} analyzed
                </span>
              </div>
              <button className="btn-download" onClick={handleDownload} id="download-btn">
                Download JSON
              </button>
            </div>

            <div className="report-cards" id="report-cards">
              {result.reports.map((report, index) => (
                <ReportCard key={index} report={report} />
              ))}
            </div>

            {result.rateLimitInfo && (
              <div className="rate-limit">
                API Rate Limit: {result.rateLimitInfo.remaining} / {result.rateLimitInfo.limit} requests remaining
                &nbsp;·&nbsp; Resets at {new Date(result.rateLimitInfo.resetAt).toLocaleTimeString()}
              </div>
            )}
          </>
        )}

    
        <footer className="footer">
          GitHub Repository Intelligence Analyzer · Built with Next.js + TypeScript
          <br />
          <a href="https://docs.github.com/en/rest" target="_blank" rel="noopener noreferrer">
            Powered by GitHub REST API
          </a>
        </footer>
      </div>
    </>
  );
}

function ReportCard({ report }: { report: RepoReport }) {
  const [expanded, setExpanded] = useState(false);
  const difficultyClass = `difficulty-badge--${report.learningDifficulty.toLowerCase()}`;

  return (
    <article className="report-card">
      <div className="report-card__header">
        <div>
          <h3 className="report-card__name">
            <a href={report.url} target="_blank" rel="noopener noreferrer">
              {report.repository}
            </a>
          </h3>
          {report.description && (
            <p className="report-card__desc">{report.description}</p>
          )}
        </div>
        <span className={`difficulty-badge ${difficultyClass}`}>
          {report.learningDifficulty}
        </span>
      </div>


      <div className="report-card__stats">
        <div className="stat">
          <span className="stat__icon">⭐</span>
          <span className="stat__value">{formatNumber(report.stars)}</span>
          <span>stars</span>
        </div>
        <div className="stat">
          <span className="stat__icon">🍴</span>
          <span className="stat__value">{formatNumber(report.forks)}</span>
          <span>forks</span>
        </div>
        <div className="stat">
          <span className="stat__icon">👥</span>
          <span className="stat__value">{formatNumber(report.contributorCount)}</span>
          <span>contributors</span>
        </div>
        <div className="stat">
          <span className="stat__icon">👁️</span>
          <span className="stat__value">{formatNumber(report.watchers)}</span>
          <span>watchers</span>
        </div>
      </div>


      <div className="report-card__scores">
        <div className="score-bar">
          <div className="score-bar__header">
            <span className="score-bar__label">Activity Score</span>
            <span className="score-bar__value score-bar__value--activity">
              {report.activityScore}
            </span>
          </div>
          <div className="score-bar__track">
            <div
              className="score-bar__fill score-bar__fill--activity"
              style={{ width: `${report.activityScore}%` }}
            />
          </div>
        </div>
        <div className="score-bar">
          <div className="score-bar__header">
            <span className="score-bar__label">Complexity Score</span>
            <span className="score-bar__value score-bar__value--complexity">
              {report.complexityScore}
            </span>
          </div>
          <div className="score-bar__track">
            <div
              className="score-bar__fill score-bar__fill--complexity"
              style={{ width: `${report.complexityScore}%` }}
            />
          </div>
        </div>
      </div>


      {report.mainLanguages.length > 0 && (
        <div className="report-card__languages">
          {report.mainLanguages.map(lang => (
            <span key={lang} className="lang-tag">
              <span
                className="lang-tag__dot"
                style={{ backgroundColor: getLangColor(lang) }}
              />
              {lang}
            </span>
          ))}
        </div>
      )}

      {/* Reasoning */}
      <div className="report-card__reasoning">
        💡 {report.reasoning}
      </div>

      {/* Expandable Metrics */}
      <button
        className="btn-download"
        style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? '▲ Hide Details' : '▼ Show Details'}
      </button>

      {expanded && (
        <div className="report-card__metrics">
          <div className="metric">
            <span className="metric__label">Commits / Year</span>
            <span className="metric__value">{formatNumber(report.metrics.commitsLastYear)}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Open Issues</span>
            <span className="metric__value">{formatNumber(report.metrics.openIssues)}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Files</span>
            <span className="metric__value">{formatNumber(report.metrics.fileCount)}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Languages</span>
            <span className="metric__value">{report.metrics.languageCount}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Dependencies</span>
            <span className="metric__value">{report.metrics.dependencyFileCount} files</span>
          </div>
          <div className="metric">
            <span className="metric__label">CI / Config</span>
            <span className="metric__value">{report.metrics.ciFileCount} files</span>
          </div>
          <div className="metric">
            <span className="metric__label">Max Depth</span>
            <span className="metric__value">{report.metrics.maxFolderDepth}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Repo Size</span>
            <span className="metric__value">{(report.metrics.repoSizeKB / 1024).toFixed(1)} MB</span>
          </div>
          <div className="metric">
            <span className="metric__label">README</span>
            <span className="metric__value">{report.metrics.hasReadme ? '✅' : '❌'}</span>
          </div>
          <div className="metric">
            <span className="metric__label">Docs Folder</span>
            <span className="metric__value">{report.metrics.hasDocsFolder ? '✅' : '❌'}</span>
          </div>
        </div>
      )}

      {/* Errors */}
      {report.errors.length > 0 && (
        <div className="report-card__errors">
          {report.errors.map((err, i) => (
            <div key={i} className="error-msg">⚠️ {err}</div>
          ))}
        </div>
      )}
    </article>
  );
}
