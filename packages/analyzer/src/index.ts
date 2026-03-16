export { calculateActivityScore } from './activity';
export { calculateComplexityScore, getFileCount } from './complexity';
export { classifyDifficulty } from './difficulty';
export type { DifficultyLevel } from './difficulty';

import type { RepoAnalysisInput, RepoReport } from '@repo-analyzer/github-client';
import { calculateActivityScore } from './activity';
import { calculateComplexityScore, getFileCount } from './complexity';
import { classifyDifficulty } from './difficulty';

/**
 * Run the full analysis pipeline on a single repo's data.
 * Returns a structured RepoReport.
 */
export function analyzeRepo(
  input: RepoAnalysisInput,
  errors: string[] = []
): RepoReport {
  const activityScore = calculateActivityScore(input);
  const complexityScore = calculateComplexityScore(input);
  const { level, reasoning } = classifyDifficulty(complexityScore, activityScore, input);

  const languageEntries = Object.entries(input.languages)
    .sort((a, b) => b[1] - a[1]);

  const mainLanguages = languageEntries.slice(0, 5).map(([lang]) => lang);

  // Calculate Bus Factor and Risk Level
  let busFactor = 0;
  let riskLevel: 'High Organization Risk' | 'Moderate Risk' | 'Healthy & Decentralized' = 'Healthy & Decentralized';
  let riskReasoning = '';

  const totalContributions = input.contributors.reduce((sum, c) => sum + c.contributions, 0);
  if (totalContributions > 0) {
     const topContributor = input.contributors.sort((a, b) => b.contributions - a.contributions)[0];
     busFactor = Math.round((topContributor.contributions / totalContributions) * 100);

     if (busFactor > 90) {
        riskLevel = 'High Organization Risk';
        riskReasoning = `High bus factor (${busFactor}% of sampled commits by one person).`;
     } else if (busFactor > 60) {
        riskLevel = 'Moderate Risk';
        riskReasoning = `Moderate bus factor (${busFactor}% of sampled commits by one person).`;
     } else {
        riskLevel = 'Healthy & Decentralized';
     }
  }

  const finalReasoning = [reasoning, riskReasoning].filter(Boolean).join(' ');

  return {
    repository: input.repoData.fullName,
    url: `https://github.com/${input.repoData.fullName}`,
    description: input.repoData.description,
    stars: input.repoData.stars,
    forks: input.repoData.forks,
    watchers: input.repoData.watchers,
    mainLanguages,
    contributorCount: input.contributors.length,
    activityScore,
    complexityScore,
    learningDifficulty: level,
    busFactor,
    riskLevel,
    reasoning: finalReasoning,
    metrics: {
      commitsLastYear: input.commitActivity.totalCommitsLastYear,
      openIssues: input.repoData.openIssues,
      languageCount: Object.keys(input.languages).length,
      fileCount: getFileCount(input),
      dependencyFileCount: input.dependencyFiles.length,
      ciFileCount: input.ciConfigFiles.length,
      maxFolderDepth: input.maxFolderDepth,
      repoSizeKB: input.repoData.size,
      hasReadme: input.readmeLength > 0,
      hasDocsFolder: input.hasDocsFolder,
    },
    fetchedAt: new Date().toISOString(),
    errors,
  };
}
