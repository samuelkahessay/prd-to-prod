import { FIXTURE_PROFILES, findProfile, type DeveloperProfile } from "./fixtures";
import { DEFAULT_THEME, THEMES, type Theme } from "./themes";

const USER_PARAM = "user";
const THEME_PARAM = "theme";

export interface DevCardShareState {
  profile: DeveloperProfile | null;
  requestedUser: string | null;
  theme: Theme;
}

export function resolveDevCardShareState(search: string): DevCardShareState {
  const params = new URLSearchParams(search);
  const requestedUser = params.get(USER_PARAM)?.trim() || null;
  const requestedTheme = params.get(THEME_PARAM)?.trim() || null;

  return {
    profile: requestedUser ? findProfile(requestedUser) : FIXTURE_PROFILES[0],
    requestedUser,
    theme: THEMES.find((theme) => theme.id === requestedTheme) ?? DEFAULT_THEME,
  };
}

export function buildDevCardShareUrl(
  currentUrl: string,
  profile: DeveloperProfile,
  theme: Theme
): string {
  const url = new URL(currentUrl);
  url.searchParams.set(USER_PARAM, profile.username);
  url.searchParams.set(THEME_PARAM, theme.id);
  return url.toString();
}
