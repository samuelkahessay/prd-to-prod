export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
}

export interface GitHubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazerCount: number;
  forkCount: number;
  updatedAt: string;
  url: string;
  topics: string[];
}

export interface LanguageStat {
  name: string;
  percentage: number;
  color: string;
  bytes: number;
}

export interface ContributionStats {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  contributionsLastYear: number;
}

export interface DevCardData {
  user: GitHubUser;
  topRepos: GitHubRepo[];
  languages: LanguageStat[];
  contributions: ContributionStats;
}
