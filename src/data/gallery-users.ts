export interface GalleryUser {
  username: string;
  tagline: string;
}

export const GALLERY_USERS: GalleryUser[] = [
  { username: "torvalds", tagline: "Creator of Linux and Git" },
  { username: "gaearon", tagline: "Co-creator of React and Redux" },
  { username: "sindresorhus", tagline: "Prolific open-source maintainer" },
  { username: "addyosmani", tagline: "Engineering manager at Google Chrome" },
  { username: "kentcdodds", tagline: "Creator of Testing Library" },
  { username: "sdrasner", tagline: "Core Vue.js team member" },
  { username: "ThePrimeagen", tagline: "Developer educator and Neovim advocate" },
  { username: "octocat", tagline: "GitHub's mascot" },
  { username: "steipete", tagline: "Creator of OpenClaw" },
];
