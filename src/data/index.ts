import { fetchGitHubUser } from "./github";
import type { DevCardData } from "./types";
import fixture from "@/data/fixtures/sample-user.json";

export async function getDevCardData(username: string): Promise<DevCardData> {
  try {
    const data = await fetchGitHubUser(username);
    console.log(`[DevCard] Loaded live API data for "${username}"`);
    return data;
  } catch (err) {
    if (username === "octocat") {
      console.log(`[DevCard] API error for "octocat", falling back to fixture data`);
      return fixture as DevCardData;
    }
    console.error(`[DevCard] Failed to fetch data for "${username}":`, err);
    throw err;
  }
}
