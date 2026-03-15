// Learning Difficulty Classification
// Beginner: complexity < 35, low setup friction, decent docs
// Intermediate: complexity 35–70, or multi-language
// Advanced: complexity > 70, heavy infra/deps, weak onboarding

import type { RepoAnalysisInput } from '@repo-analyzer/github-client';

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

interface DifficultyResult {
  level: DifficultyLevel;
  reasoning: string;
}

/**
 * Classify learning difficulty based on complexity score and repository signals.
 *
 * Rules:
 *   1. Advanced if complexity > 70 OR file/dependency structure is clearly heavy
 *   2. Beginner if complexity < 35 AND setup friction is low
 *   3. Intermediate otherwise
 *
 * Additional signals:
 *   - Setup friction: many dependency files, no README, complex folder structure
 *   - Docs quality: README length, docs folder presence
 *   - Language count: monolingual is easier than polyglot
 */
export function classifyDifficulty(
  complexityScore: number,
  activityScore: number,
  input: RepoAnalysisInput
): DifficultyResult {
  const languageCount = Object.keys(input.languages).length;
  const fileCount = input.tree
    ? input.tree.tree.filter(e => e.type === 'blob').length
    : 0;
  const hasGoodDocs = input.readmeLength > 500 && input.hasDocsFolder;
  const hasReadme = input.readmeLength > 100;
  const depCount = input.dependencyFiles.length;
  const ciCount = input.ciConfigFiles.length;

  const reasons: string[] = [];

  // --- Advanced checks ---
  if (complexityScore > 70) {
    reasons.push('High complexity score');
    if (fileCount > 3000) reasons.push(`large codebase (${fileCount.toLocaleString()} files)`);
    if (languageCount > 5) reasons.push(`${languageCount} languages`);
    if (depCount > 5) reasons.push('heavy dependency structure');
    if (ciCount > 3) reasons.push('extensive CI/infrastructure setup');
    if (!hasReadme) reasons.push('limited documentation');

    return {
      level: 'Advanced',
      reasoning: reasons.join(', '),
    };
  }

  // Catch repos with extreme file/dep count even at moderate complexity
  if (fileCount > 5000 || (depCount > 8 && languageCount > 5)) {
    reasons.push('Very large or heavily structured project');
    if (fileCount > 5000) reasons.push(`${fileCount.toLocaleString()} files`);
    if (depCount > 8) reasons.push(`${depCount} dependency manifests`);

    return {
      level: 'Advanced',
      reasoning: reasons.join(', '),
    };
  }

  // --- Beginner checks ---
  if (complexityScore < 35 && depCount <= 2 && languageCount <= 2) {
    reasons.push('Low complexity');
    if (languageCount <= 1) reasons.push('single language');
    else reasons.push('simple language stack');
    if (hasGoodDocs) reasons.push('well-documented');
    else if (hasReadme) reasons.push('has README');
    if (fileCount < 50) reasons.push('small codebase');
    if (activityScore < 30) reasons.push('low activity suggests stable/simple project');

    return {
      level: 'Beginner',
      reasoning: reasons.join(', '),
    };
  }

  
  reasons.push('Moderate complexity');
  if (languageCount > 2) reasons.push(`${languageCount} languages`);
  if (fileCount > 100) reasons.push(`${fileCount.toLocaleString()} files`);
  if (depCount > 2) reasons.push('multi-dependency setup');
  if (activityScore > 60) reasons.push('actively maintained');
  if (hasGoodDocs) reasons.push('good documentation');
  else if (!hasReadme) reasons.push('limited onboarding docs');

  return {
    level: 'Intermediate',
    reasoning: reasons.join(', '),
  };
}
