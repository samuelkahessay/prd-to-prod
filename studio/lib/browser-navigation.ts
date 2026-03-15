export function navigateTo(url: string): void {
  window.location.assign(url);
}

export function replaceCurrentUrl(url: string): void {
  window.history.replaceState({}, "", url);
}
