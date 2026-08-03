/**
 * Returns the first non-empty string value from an arbitrary candidate list.
 */
export function getFirstNonEmptyString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '') {
        return trimmed;
      }
    }
  }
  return undefined;
}

/**
 * Builds a safe redirect URI. If the given URI starts with the application origin
 * followed by a path separator, it is returned as-is. Otherwise, only the path
 * portion (starting with `/`) is appended to the origin. External URLs are rejected
 * to prevent open redirect attacks.
 */
export function buildRedirectUri(redirectUri?: string): string {
  const origin = window.location.origin;
  if (redirectUri?.startsWith(origin) === true) {
    const rest = redirectUri.slice(origin.length);
    // Only allow if what follows is a path, query, fragment, or nothing —
    // reject domains that share the origin as a prefix (e.g. origin.evil.com)
    if (rest === '' || rest.startsWith('/') || rest.startsWith('?') || rest.startsWith('#')) {
      return redirectUri;
    }
  }
  return origin + (redirectUri?.startsWith('/') === true ? redirectUri : '/');
}

export function getRealmEndpoint(baseUrl: string, realm: string, path: string): string {
  const authServerUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, '');
  return new URL(`realms/${encodeURIComponent(realm)}/${normalizedPath}`, authServerUrl).toString();
}

/** Returns a normalized error message, falling back when missing/blank. */
export function getErrorMessage(errorMessage: string | undefined, fallback: string): string {
  return errorMessage !== undefined && errorMessage.trim() !== '' ? errorMessage : fallback;
}
