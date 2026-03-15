// Activity Score (0–100)
// Weights: recent commits 40%, contributor count 25%, open issue/PR movement 20%, stars/forks momentum 15%

import type { RepoAnalysisInput } from '@repo-analyzer/github-client';

/**
 * Clamp and normalize a value to [0, 1] range
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate recency factor based on last push date.
 * Returns 1.0 if pushed within 7 days, linearly decays to 0 over 365 days.
 */
function recencyFactor(pushedAt: string): number {
  if (!pushedAt) return 0;
  const daysSincePush =
    (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePush <= 7) return 1.0;
  if (daysSincePush >= 365) return 0.0;
  return 1.0 - (daysSincePush - 7) / (365 - 7);
}

/**
 * Calculate Activity Score (0–100)
 *
 * Formula:
 *   activity = (
 *     normalize(commits_last_year, 0, 2000)  × 0.40 +
 *     normalize(contributor_count, 0, 200)     × 0.25 +
 *     normalize(open_issues, 0, 500)           × 0.20 +
 *     recency_factor(last_push)                × 0.15
 *   ) × 100
 */
export function calculateActivityScore(input: RepoAnalysisInput): number {
  const commitsLastYear = input.commitActivity.totalCommitsLastYear;
  const contributorCount = input.contributors.length;
  const openIssues = input.repoData.openIssues;
  const pushedAt = input.repoData.pushedAt;

  const score =
    normalize(commitsLastYear, 0, 2000) * 0.40 +
    normalize(contributorCount, 0, 200) * 0.25 +
    normalize(openIssues, 0, 500) * 0.20 +
    recencyFactor(pushedAt) * 0.15;

  return Math.round(score * 100);
}
