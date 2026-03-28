export interface Repo {
  name: string;
  description?: string;
  stars: number;
  forks?: number;
  language: string;
}

export interface LanguageStat {
  name: string;
  percentage: number;
  color: string;
}

export interface DeveloperProfile {
  username: string;
  name: string;
  avatarUrl: string;
  bio: string;
  stats: {
    repos: number;
    followers: number;
    following: number;
  };
  topRepos: Repo[];
  languages: LanguageStat[];
}

export const FIXTURE_PROFILES: DeveloperProfile[] = [
  {
    username: "torvalds",
    name: "Linus Torvalds",
    avatarUrl: "https://avatars.githubusercontent.com/u/1024025",
    bio: "Creator of Linux and Git. Nothing more to say.",
    stats: { repos: 8, followers: 240000, following: 0 },
    topRepos: [
      { name: "linux", description: "Linux kernel source tree", stars: 190000, forks: 55000, language: "C" },
      { name: "subsurface", description: "Divelog program for recreational and tech divers", stars: 2400, forks: 620, language: "C++" },
      { name: "uemacs", description: "Random hacking on the micro-emacs editor", stars: 1200, forks: 240, language: "C" },
    ],
    languages: [
      { name: "C", percentage: 72, color: "#555555" },
      { name: "C++", percentage: 14, color: "#f34b7d" },
      { name: "Assembly", percentage: 8, color: "#6E4C13" },
      { name: "Makefile", percentage: 4, color: "#427819" },
      { name: "Shell", percentage: 2, color: "#89e051" },
    ],
  },
  {
    username: "gaearon",
    name: "Dan Abramov",
    avatarUrl: "https://avatars.githubusercontent.com/u/810438",
    bio: "Working on React at Meta. Co-author of Redux and Create React App.",
    stats: { repos: 248, followers: 96000, following: 171 },
    topRepos: [
      { name: "react", description: "The library for web and native user interfaces", stars: 226000, forks: 46100, language: "JavaScript" },
      { name: "redux", description: "A JS library for predictable and maintainable global state management", stars: 60800, forks: 15400, language: "TypeScript" },
      { name: "overreacted.io", description: "Personal blog by Dan Abramov", stars: 7200, forks: 1300, language: "JavaScript" },
    ],
    languages: [
      { name: "JavaScript", percentage: 58, color: "#f1e05a" },
      { name: "TypeScript", percentage: 28, color: "#3178c6" },
      { name: "CSS", percentage: 8, color: "#563d7c" },
      { name: "HTML", percentage: 4, color: "#e34c26" },
      { name: "Shell", percentage: 2, color: "#89e051" },
    ],
  },
  {
    username: "steipete",
    name: "Peter Steinberger",
    avatarUrl: "https://avatars.githubusercontent.com/u/58493",
    bio: "Founder of PSPDFKit (now Nutrient). iOS pioneer. Builder of OpenClaw — an autonomous coding agent.",
    stats: { repos: 162, followers: 18400, following: 312 },
    topRepos: [
      { name: "PSPDFKit", description: "The leading PDF SDK for iOS and Android", stars: 0, language: "Objective-C" },
      { name: "Aspects", description: "Delightful, simple library for aspect-oriented programming", stars: 8400, forks: 1100, language: "Objective-C" },
      { name: "InterposeKit", description: "The Swiss Army Knife for method swizzling in Swift", stars: 820, forks: 56, language: "Swift" },
    ],
    languages: [
      { name: "Swift", percentage: 44, color: "#F05138" },
      { name: "Objective-C", percentage: 36, color: "#438eff" },
      { name: "Ruby", percentage: 10, color: "#701516" },
      { name: "Shell", percentage: 6, color: "#89e051" },
      { name: "Python", percentage: 4, color: "#3572A5" },
    ],
  },
  {
    username: "rauchg",
    name: "Guillermo Rauch",
    avatarUrl: "https://avatars.githubusercontent.com/u/13041",
    bio: "CEO of Vercel. Making Next.js and the web faster.",
    stats: { repos: 110, followers: 72000, following: 480 },
    topRepos: [
      { name: "next.js", description: "The React Framework", stars: 124000, forks: 26400, language: "TypeScript" },
      { name: "socket.io", description: "Realtime application framework (Node.JS server)", stars: 60400, forks: 10100, language: "TypeScript" },
      { name: "ms", description: "Tiny millisecond conversion utility", stars: 5000, forks: 210, language: "TypeScript" },
    ],
    languages: [
      { name: "TypeScript", percentage: 52, color: "#3178c6" },
      { name: "JavaScript", percentage: 36, color: "#f1e05a" },
      { name: "CSS", percentage: 6, color: "#563d7c" },
      { name: "Shell", percentage: 4, color: "#89e051" },
      { name: "HTML", percentage: 2, color: "#e34c26" },
    ],
  },
  {
    username: "sindresorhus",
    name: "Sindre Sorhus",
    avatarUrl: "https://avatars.githubusercontent.com/u/170270",
    bio: "Full-time open-sourcerer. Maker of 1000+ npm packages. Unicorn obsessed.",
    stats: { repos: 1100, followers: 76000, following: 42 },
    topRepos: [
      { name: "awesome", description: "Awesome lists about all kinds of interesting topics", stars: 330000, forks: 27600, language: "Markdown" },
      { name: "ora", description: "Elegant terminal spinner", stars: 9200, forks: 300, language: "TypeScript" },
      { name: "got", description: "Human-friendly and powerful HTTP request library for Node.js", stars: 14200, forks: 940, language: "TypeScript" },
    ],
    languages: [
      { name: "TypeScript", percentage: 48, color: "#3178c6" },
      { name: "JavaScript", percentage: 28, color: "#f1e05a" },
      { name: "Shell", percentage: 12, color: "#89e051" },
      { name: "Swift", percentage: 8, color: "#F05138" },
      { name: "Python", percentage: 4, color: "#3572A5" },
    ],
  },
  {
    username: "antirez",
    name: "Salvatore Sanfilippo",
    avatarUrl: "https://avatars.githubusercontent.com/u/65632",
    bio: "Creator of Redis. Hacker. Amateur fiction writer.",
    stats: { repos: 74, followers: 42000, following: 14 },
    topRepos: [
      { name: "redis", description: "Redis is an in-memory database that persists on disk", stars: 65000, forks: 23400, language: "C" },
      { name: "kilo", description: "A text editor in less than 1000 LOC with syntax highlight and search", stars: 7400, forks: 1100, language: "C" },
      { name: "smallchat", description: "A minimal programming implementation of a chat server", stars: 6800, forks: 820, language: "C" },
    ],
    languages: [
      { name: "C", percentage: 80, color: "#555555" },
      { name: "Tcl", percentage: 10, color: "#e4cc98" },
      { name: "Shell", percentage: 5, color: "#89e051" },
      { name: "Python", percentage: 3, color: "#3572A5" },
      { name: "Makefile", percentage: 2, color: "#427819" },
    ],
  },
  {
    username: "addyosmani",
    name: "Addy Osmani",
    avatarUrl: "https://avatars.githubusercontent.com/u/110953",
    bio: "Engineering Manager at Google working on Chrome. Author of Learning JavaScript Design Patterns.",
    stats: { repos: 312, followers: 42000, following: 780 },
    topRepos: [
      { name: "critical", description: "Extract & inline critical-path CSS in HTML pages", stars: 9800, forks: 380, language: "JavaScript" },
      { name: "lighthouse", description: "Automated auditing, performance metrics, and best practices for the web", stars: 28000, forks: 9300, language: "JavaScript" },
      { name: "todomvc", description: "Helping you select an MV* framework", stars: 28500, forks: 13700, language: "JavaScript" },
    ],
    languages: [
      { name: "JavaScript", percentage: 62, color: "#f1e05a" },
      { name: "HTML", percentage: 18, color: "#e34c26" },
      { name: "CSS", percentage: 10, color: "#563d7c" },
      { name: "TypeScript", percentage: 6, color: "#3178c6" },
      { name: "Shell", percentage: 4, color: "#89e051" },
    ],
  },
  {
    username: "kentcdodds",
    name: "Kent C. Dodds",
    avatarUrl: "https://avatars.githubusercontent.com/u/1500684",
    bio: "Improving the world with quality software. Full-time educator. Author of Testing JavaScript.",
    stats: { repos: 506, followers: 34000, following: 92 },
    topRepos: [
      { name: "react-testing-library", description: "Simple and complete React DOM testing utilities", stars: 18900, forks: 1100, language: "TypeScript" },
      { name: "kentcdodds.com", description: "Kent's personal website", stars: 3200, forks: 820, language: "TypeScript" },
      { name: "advanced-react-patterns", description: "Learn advanced React component patterns", stars: 3400, forks: 560, language: "TypeScript" },
    ],
    languages: [
      { name: "TypeScript", percentage: 56, color: "#3178c6" },
      { name: "JavaScript", percentage: 30, color: "#f1e05a" },
      { name: "MDX", percentage: 6, color: "#fcb32c" },
      { name: "CSS", percentage: 4, color: "#563d7c" },
      { name: "Shell", percentage: 4, color: "#89e051" },
    ],
  },
  {
    username: "sdras",
    name: "Sarah Drasner",
    avatarUrl: "https://avatars.githubusercontent.com/u/2281088",
    bio: "VP of Developer Experience at Netlify. Author, speaker, Vue core team emeritus.",
    stats: { repos: 198, followers: 28000, following: 340 },
    topRepos: [
      { name: "awesome-actions", description: "A curated list of awesome actions to use on GitHub", stars: 24000, forks: 1500, language: "Markdown" },
      { name: "night-owl-vscode-theme", description: "A VS Code theme for the night owls out there", stars: 2800, forks: 380, language: "JavaScript" },
      { name: "vue-vscode-snippets", description: "Vue.js Snippets for VS Code", stars: 1300, forks: 220, language: "JavaScript" },
    ],
    languages: [
      { name: "JavaScript", percentage: 46, color: "#f1e05a" },
      { name: "Vue", percentage: 22, color: "#41b883" },
      { name: "CSS", percentage: 14, color: "#563d7c" },
      { name: "HTML", percentage: 12, color: "#e34c26" },
      { name: "Shell", percentage: 6, color: "#89e051" },
    ],
  },
];

export function findProfile(username: string): DeveloperProfile | null {
  const lower = username.toLowerCase().trim();
  return FIXTURE_PROFILES.find((p) => p.username.toLowerCase() === lower) ?? null;
}
