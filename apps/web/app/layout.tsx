import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitHub Repo Intelligence Analyzer',
  description:
    'Analyze GitHub repositories for activity, complexity, and learning difficulty. Get structured insights and scores.',
  keywords: ['GitHub', 'repository', 'analysis', 'complexity', 'open source'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
