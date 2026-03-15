// Types for GitHub API responses and internal use

export interface GitHubRepoData {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  size: number; // in KB
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  hasWiki: boolean;
  hasPages: boolean;
  license: string | null;
  topics: string[];
  archived: boolean;
  disabled: boolean;
}

export interface GitHubLanguages {
  [language: string]: number; // language → bytes
}

export interface GitHubContributor {
  login: string;
  contributions: number;
}

export interface GitHubCommitActivity {
  // Weekly commit activity for the last year
  weeks: Array<{
    week: number; // unix timestamp
    total: number;
    days: number[];
  }>;
  totalCommitsLastYear: number;
}

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface RepoAnalysisInput {
  repoData: GitHubRepoData;
  languages: GitHubLanguages;
  contributors: GitHubContributor[];
  commitActivity: GitHubCommitActivity;
  tree: GitHubTreeResponse | null;
  readmeLength: number;
  hasDocsFolder: boolean;
  dependencyFiles: string[];
  ciConfigFiles: string[];
  maxFolderDepth: number;
}

export interface RepoReport {
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
  metrics: {
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
  };
  fetchedAt: string;
  errors: string[];
}

export interface AnalysisResult {
  reports: RepoReport[];
  analyzedAt: string;
  totalRepos: number;
  rateLimitInfo: {
    remaining: number;
    limit: number;
    resetAt: string;
  } | null;
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // unix timestamp
}
