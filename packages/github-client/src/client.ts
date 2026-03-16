// GitHub REST API client with retry logic, rate-limit handling, and caching

import { cache } from './cache';
import type {
  GitHubRepoData,
  GitHubLanguages,
  GitHubContributor,
  GitHubCommitActivity,
  GitHubTreeResponse,
  RepoAnalysisInput,
  RateLimitInfo,
} from './types';

const GITHUB_API = 'https://api.github.com';
const MAX_RETRIES = 3;
const MAX_CONCURRENT = 3;

// Known dependency manifest files
const DEPENDENCY_FILES = [
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'requirements.txt', 'Pipfile', 'Pipfile.lock', 'setup.py', 'pyproject.toml',
  'Cargo.toml', 'Cargo.lock', 'go.mod', 'go.sum',
  'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock',
  'pubspec.yaml', 'pubspec.lock',
  'CMakeLists.txt', 'Makefile',
];

// Known CI/config/infrastructure files
const CI_CONFIG_FILES = [
  '.github/workflows', '.travis.yml', '.circleci',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.gitlab-ci.yml', 'Jenkinsfile', 'azure-pipelines.yml',
  'terraform', '.terraform', 'k8s', 'kubernetes',
  'nginx.conf', '.nginx',
  'vercel.json', 'netlify.toml', 'fly.toml',
  'Procfile', 'app.yaml', 'serverless.yml',
];

let currentRateLimit: RateLimitInfo | null = null;

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'repo-intelligence-analyzer',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  token?: string,
  retries: number = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    // Check rate limit before making request
    if (currentRateLimit && currentRateLimit.remaining <= 5) {
      const waitMs = (currentRateLimit.reset * 1000) - Date.now();
      if (waitMs > 0 && waitMs < 120000) {
        // Wait up to 2 minutes for rate limit reset
        await sleep(waitMs + 1000);
      }
    }

    try {
      const response = await fetch(url, { headers: getHeaders(token) });

      // Update rate limit info from headers
      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');
      if (limit && remaining && reset) {
        currentRateLimit = {
          limit: parseInt(limit),
          remaining: parseInt(remaining),
          reset: parseInt(reset),
        };
      }

      if (response.ok) return response;

      // Rate limited — backoff and retry
      if ((response.status === 403 || response.status === 429) && attempt < retries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await sleep(backoffMs);
        continue;
      }

      // 404 is not an error we retry
      if (response.status === 404) return response;

      // Other errors
      console.warn(`Attempt ${attempt} failed for ${url}: Status ${response.status}`);
      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }

      return response;
    } catch (error) {
      console.error(`Fetch error for ${url}:`, error);
      if (attempt < retries) {
        await sleep(Math.pow(2, attempt) * 500);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

async function fetchJSON<T>(url: string, token?: string): Promise<T | null> {
  try {
    const response = await fetchWithRetry(url, token);
    if (!response.ok) {
      console.warn(`fetchJSON not ok for ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`fetchJSON caught error for ${url}:`, error);
    return null;
  }
}

// Fetch core repo metadata
async function fetchRepoData(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubRepoData | null> {
  const cacheKey = `repo:${owner}/${repo}`;
  const cached = cache.get<GitHubRepoData>(cacheKey);
  if (cached) return cached;

  console.log(`Fetching repo data for ${owner}/${repo}...`);
  const data = await fetchJSON<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}`,
    token
  );
  if (!data) {
    console.warn(`fetchRepoData returned null for ${owner}/${repo}`);
    return null;
  }

  const result: GitHubRepoData = {
    owner,
    repo,
    fullName: (data.full_name as string) || `${owner}/${repo}`,
    description: (data.description as string) || null,
    stars: (data.stargazers_count as number) || 0,
    forks: (data.forks_count as number) || 0,
    watchers: (data.subscribers_count as number) || 0,
    openIssues: (data.open_issues_count as number) || 0,
    size: (data.size as number) || 0,
    defaultBranch: (data.default_branch as string) || 'main',
    createdAt: (data.created_at as string) || '',
    updatedAt: (data.updated_at as string) || '',
    pushedAt: (data.pushed_at as string) || '',
    hasWiki: (data.has_wiki as boolean) || false,
    hasPages: (data.has_pages as boolean) || false,
    license: data.license
      ? ((data.license as Record<string, unknown>).spdx_id as string) || null
      : null,
    topics: (data.topics as string[]) || [],
    archived: (data.archived as boolean) || false,
    disabled: (data.disabled as boolean) || false,
  };

  cache.set(cacheKey, result);
  return result;
}

// Fetch language breakdown
async function fetchLanguages(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubLanguages> {
  const cacheKey = `languages:${owner}/${repo}`;
  const cached = cache.get<GitHubLanguages>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<GitHubLanguages>(
    `${GITHUB_API}/repos/${owner}/${repo}/languages`,
    token
  );
  const result = data || {};
  cache.set(cacheKey, result);
  return result;
}

// Fetch contributors (first page, up to 100)
async function fetchContributors(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubContributor[]> {
  const cacheKey = `contributors:${owner}/${repo}`;
  const cached = cache.get<GitHubContributor[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<Array<Record<string, unknown>>>(
    `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=100&anon=true`,
    token
  );

  if (!data || !Array.isArray(data)) {
    cache.set(cacheKey, []);
    return [];
  }

  const result: GitHubContributor[] = data.map(c => ({
    login: (c.login as string) || 'anonymous',
    contributions: (c.contributions as number) || 0,
  }));

  cache.set(cacheKey, result);
  return result;
}

// Fetch commit activity (last year)
async function fetchCommitActivity(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubCommitActivity> {
  const cacheKey = `commitActivity:${owner}/${repo}`;
  const cached = cache.get<GitHubCommitActivity>(cacheKey);
  if (cached) return cached;

  const defaultResult: GitHubCommitActivity = {
    weeks: [],
    totalCommitsLastYear: 0,
  };

  try {
    // Primary method: Try to get total commits via the search API to be accurate
    const searchRes = await fetchWithRetry(
      `${GITHUB_API}/search/commits?q=repo:${owner}/${repo}`,
      token
    );
    
    let totalCommitsLastYear = 0;
    
    if (searchRes.ok) {
       const searchData = await searchRes.json();
       totalCommitsLastYear = searchData.total_count || 0;
    } else {
       // Fallback to the stats endpoint if search fails (e.g., due to strict rate limits)
       const data = await fetchJSON<Array<Record<string, unknown>>>(
         `${GITHUB_API}/repos/${owner}/${repo}/stats/commit_activity`,
         token
       );

       if (data && Array.isArray(data)) {
          totalCommitsLastYear = data.reduce((sum, w) => sum + ((w.total as number) || 0), 0);
       }
    }

    const result: GitHubCommitActivity = { weeks: [], totalCommitsLastYear };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    return defaultResult;
  }
}

// Fetch open issues (excluding PRs)
async function fetchOpenIssues(
  owner: string,
  repo: string,
  token?: string
): Promise<number> {
  const cacheKey = `openIssues:${owner}/${repo}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    // The standard repos endpoint includes PRs in 'open_issues_count'.
    // To get JUST issues, we use the search API:
    const response = await fetchWithRetry(
      `${GITHUB_API}/search/issues?q=repo:${owner}/${repo}+type:issue+state:open`,
      token
    );
    if (!response.ok) return 0;
    const data = await response.json();
    const count = data.total_count || 0;
    cache.set(cacheKey, count);
    return count;
  } catch {
    return 0;
  }
}

// Fetch repository tree (recursive)
async function fetchTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<GitHubTreeResponse | null> {
  const cacheKey = `tree:${owner}/${repo}`;
  const cached = cache.get<GitHubTreeResponse>(cacheKey);
  if (cached) return cached;

  const data = await fetchJSON<Record<string, unknown>>(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token
  );

  if (!data) return null;

  const result: GitHubTreeResponse = {
    sha: (data.sha as string) || '',
    tree: ((data.tree as Array<Record<string, unknown>>) || []).map(entry => ({
      path: (entry.path as string) || '',
      mode: (entry.mode as string) || '',
      type: (entry.type as 'blob' | 'tree') || 'blob',
      sha: (entry.sha as string) || '',
      size: entry.size as number | undefined,
    })),
    truncated: (data.truncated as boolean) || false,
  };

  cache.set(cacheKey, result);
  return result;
}

// Fetch README content length
async function fetchReadmeLength(
  owner: string,
  repo: string,
  token?: string
): Promise<number> {
  const cacheKey = `readme:${owner}/${repo}`;
  const cached = cache.get<number>(cacheKey);
  if (cached !== null) return cached;

  try {
    const response = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}/readme`,
      token
    );
    if (!response.ok) {
      cache.set(cacheKey, 0);
      return 0;
    }
    const data = (await response.json()) as Record<string, unknown>;
    const size = (data.size as number) || 0;
    cache.set(cacheKey, size);
    return size;
  } catch {
    cache.set(cacheKey, 0);
    return 0;
  }
}

// Analyze tree structure
function analyzeTree(tree: GitHubTreeResponse | null): {
  fileCount: number;
  dependencyFiles: string[];
  ciConfigFiles: string[];
  hasDocsFolder: boolean;
  maxFolderDepth: number;
} {
  if (!tree || !tree.tree.length) {
    return {
      fileCount: 0,
      dependencyFiles: [],
      ciConfigFiles: [],
      hasDocsFolder: false,
      maxFolderDepth: 0,
    };
  }

  const files = tree.tree.filter(e => e.type === 'blob');
  const fileCount = files.length;
  let maxFolderDepth = 0;
  let hasDocsFolder = false;

  const dependencyFiles: string[] = [];
  const ciConfigFiles: string[] = [];

  for (const entry of tree.tree) {
    const pathParts = entry.path.split('/');
    const depth = pathParts.length;
    if (depth > maxFolderDepth) maxFolderDepth = depth;

    const filename = pathParts[pathParts.length - 1];
    const topFolder = pathParts[0].toLowerCase();

    // Check for docs folder
    if (topFolder === 'docs' || topFolder === 'documentation' || topFolder === 'doc') {
      hasDocsFolder = true;
    }

    // Check for dependency files
    if (DEPENDENCY_FILES.includes(filename)) {
      dependencyFiles.push(entry.path);
    }

    // Check for CI/config files
    for (const ciPattern of CI_CONFIG_FILES) {
      if (entry.path.includes(ciPattern) || filename === ciPattern) {
        ciConfigFiles.push(entry.path);
        break;
      }
    }
  }

  return { fileCount, dependencyFiles, ciConfigFiles, hasDocsFolder, maxFolderDepth };
}

// Run semaphore for concurrent requests
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result);
    });
    executing.push(p);

    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
      // Remove completed promises
      const newExecuting: Promise<void>[] = [];
      for (const e of executing) {
        const completed = await Promise.race([
          e.then(() => true),
          Promise.resolve(false),
        ]);
        if (!completed) newExecuting.push(e);
      }
      executing.length = 0;
      executing.push(...newExecuting);
    }
  }

  await Promise.all(executing);
  return results;
}

// Main function: fetch all data for a single repo
export async function fetchAllRepoData(
  owner: string,
  repo: string,
  token?: string
): Promise<{ data: RepoAnalysisInput | null; errors: string[] }> {
  const errors: string[] = [];

  // Fetch core data first (we need default branch for tree)
  const repoData = await fetchRepoData(owner, repo, token);
  if (!repoData) {
    return { data: null, errors: ['Repository not found or not accessible'] };
  }

  // Fetch remaining data concurrently
  const [languages, contributors, commitActivity, tree, readmeLength, accurateOpenIssues] =
    await Promise.all([
      fetchLanguages(owner, repo, token).catch(() => {
        errors.push('Failed to fetch languages');
        return {} as GitHubLanguages;
      }),
      fetchContributors(owner, repo, token).catch(() => {
        errors.push('Failed to fetch contributors');
        return [] as GitHubContributor[];
      }),
      fetchCommitActivity(owner, repo, token).catch(() => {
        errors.push('Failed to fetch commit activity');
        return { weeks: [], totalCommitsLastYear: 0 } as GitHubCommitActivity;
      }),
      fetchTree(owner, repo, repoData.defaultBranch, token).catch(() => {
        errors.push('Failed to fetch repository tree');
        return null;
      }),
      fetchReadmeLength(owner, repo, token).catch(() => {
        errors.push('Failed to fetch README');
        return 0;
      }),
      fetchOpenIssues(owner, repo, token).catch(() => {
         return repoData.openIssues; // fallback to generic count
      })
    ]);

  // Overwrite the generic open issues count (which includes PRs) with the accurate one
  repoData.openIssues = accurateOpenIssues;

  const treeAnalysis = analyzeTree(tree);

  const input: RepoAnalysisInput = {
    repoData,
    languages,
    contributors,
    commitActivity,
    tree,
    readmeLength,
    hasDocsFolder: treeAnalysis.hasDocsFolder,
    dependencyFiles: treeAnalysis.dependencyFiles,
    ciConfigFiles: treeAnalysis.ciConfigFiles,
    maxFolderDepth: treeAnalysis.maxFolderDepth,
  };

  return { data: input, errors };
}

// Fetch data for multiple repos with concurrency control
export async function fetchMultipleRepos(
  repos: Array<{ owner: string; repo: string }>,
  token?: string
): Promise<Array<{ owner: string; repo: string; data: RepoAnalysisInput | null; errors: string[] }>> {
  const tasks = repos.map(({ owner, repo }) => async () => {
    const result = await fetchAllRepoData(owner, repo, token);
    return { owner, repo, ...result };
  });

  return runWithConcurrency(tasks, MAX_CONCURRENT);
}

// Get current rate limit status
export function getRateLimitInfo(): RateLimitInfo | null {
  return currentRateLimit;
}

// Parse a GitHub URL into owner/repo
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Handle various url formats
    const cleaned = url.trim().replace(/\/$/, '').replace(/\.git$/, '');

    // Try URL parsing
    let pathname: string;
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
      const parsed = new URL(cleaned);
      if (!parsed.hostname.includes('github.com')) return null;
      pathname = parsed.pathname;
    } else if (cleaned.startsWith('github.com/')) {
      pathname = cleaned.replace('github.com', '');
    } else if (cleaned.match(/^[\w.-]+\/[\w.-]+$/)) {
      // owner/repo format
      const [owner, repo] = cleaned.split('/');
      return { owner, repo };
    } else {
      return null;
    }

    const parts = pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}
