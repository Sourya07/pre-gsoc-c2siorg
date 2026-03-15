// POST /api/analyze — accepts { urls: string[] }, returns analysis report

import { NextRequest, NextResponse } from 'next/server';
import { parseGitHubUrl, fetchAllRepoData, getRateLimitInfo } from '@repo-analyzer/github-client';
import { analyzeRepo } from '@repo-analyzer/analyzer';
import type { RepoReport, AnalysisResult } from '@repo-analyzer/github-client';

const MAX_REPOS = 20;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Please provide an array of GitHub repository URLs' },
        { status: 400 }
      );
    }

    if (urls.length > MAX_REPOS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_REPOS} repositories per request` },
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_TOKEN || undefined;
    const reports: RepoReport[] = [];

    // Process repos with concurrency limit (3 at a time)
    const batchSize = 3;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (url: string) => {
          const parsed = parseGitHubUrl(url);
          if (!parsed) {
            return {
              repository: url,
              url,
              description: null,
              stars: 0,
              forks: 0,
              watchers: 0,
              mainLanguages: [],
              contributorCount: 0,
              activityScore: 0,
              complexityScore: 0,
              learningDifficulty: 'Beginner' as const,
              reasoning: 'Invalid or unrecognized GitHub URL',
              metrics: {
                commitsLastYear: 0,
                openIssues: 0,
                languageCount: 0,
                fileCount: 0,
                dependencyFileCount: 0,
                ciFileCount: 0,
                maxFolderDepth: 0,
                repoSizeKB: 0,
                hasReadme: false,
                hasDocsFolder: false,
              },
              fetchedAt: new Date().toISOString(),
              errors: ['Invalid GitHub URL format'],
            } satisfies RepoReport;
          }

          const { owner, repo } = parsed;
          const { data, errors } = await fetchAllRepoData(owner, repo, token);

          if (!data) {
            return {
              repository: `${owner}/${repo}`,
              url: `https://github.com/${owner}/${repo}`,
              description: null,
              stars: 0,
              forks: 0,
              watchers: 0,
              mainLanguages: [],
              contributorCount: 0,
              activityScore: 0,
              complexityScore: 0,
              learningDifficulty: 'Beginner' as const,
              reasoning: 'Repository not found or not accessible',
              metrics: {
                commitsLastYear: 0,
                openIssues: 0,
                languageCount: 0,
                fileCount: 0,
                dependencyFileCount: 0,
                ciFileCount: 0,
                maxFolderDepth: 0,
                repoSizeKB: 0,
                hasReadme: false,
                hasDocsFolder: false,
              },
              fetchedAt: new Date().toISOString(),
              errors,
            } satisfies RepoReport;
          }

          return analyzeRepo(data, errors);
        })
      );

      reports.push(...batchResults);
    }

    const rateLimitInfo = getRateLimitInfo();
    const result: AnalysisResult = {
      reports,
      analyzedAt: new Date().toISOString(),
      totalRepos: reports.length,
      rateLimitInfo: rateLimitInfo
        ? {
            remaining: rateLimitInfo.remaining,
            limit: rateLimitInfo.limit,
            resetAt: new Date(rateLimitInfo.reset * 1000).toISOString(),
          }
        : null,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error during analysis' },
      { status: 500 }
    );
  }
}
