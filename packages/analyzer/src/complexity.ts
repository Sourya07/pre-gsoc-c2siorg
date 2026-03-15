// Complexity Score (0–100)
// Weights: file count 35%, language diversity 20%, dependency files 20%, CI/config files 15%, folder depth 10%

import type { RepoAnalysisInput } from '@repo-analyzer/github-client';

/**
 * Clamp and normalize a value to [0, 1] range
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calculate Complexity Score (0–100)
 *
 * Formula:
 *   complexity = (
 *     normalize(file_count, 0, 5000)           × 0.35 +
 *     normalize(language_count, 1, 10)          × 0.20 +
 *     normalize(dependency_file_count, 0, 10)   × 0.20 +
 *     normalize(ci_config_file_count, 0, 8)     × 0.15 +
 *     normalize(max_folder_depth, 0, 15)        × 0.10
 *   ) × 100
 */
export function calculateComplexityScore(input: RepoAnalysisInput): number {
  const fileCount = input.tree
    ? input.tree.tree.filter(e => e.type === 'blob').length
    : 0;

  const languageCount = Object.keys(input.languages).length;
  const depFileCount = input.dependencyFiles.length;
  const ciFileCount = input.ciConfigFiles.length;
  const maxDepth = input.maxFolderDepth;

  const score =
    normalize(fileCount, 0, 5000) * 0.35 +
    normalize(languageCount, 1, 10) * 0.20 +
    normalize(depFileCount, 0, 10) * 0.20 +
    normalize(ciFileCount, 0, 8) * 0.15 +
    normalize(maxDepth, 0, 15) * 0.10;

  return Math.round(score * 100);
}

/**
 * Get file count from tree (used in report metrics)
 */
export function getFileCount(input: RepoAnalysisInput): number {
  if (!input.tree) return 0;
  return input.tree.tree.filter(e => e.type === 'blob').length;
}
