import { hasText } from 'app/shared/util/text.util';

/**
 * Detects if a location string represents a virtual/online meeting.
 * @param location The location string to check.
 * @returns true if the location appears to be a URL or a common video conferencing tool.
 */
export function isVirtualLocation(location: string | undefined | null): boolean {
  const trimmed = location?.trim().toLowerCase();
  if (!hasText(trimmed)) return false;

  // Regex to detect URLs (http, https, www, or domains with dots/slashes)
  const urlPattern = /^(https?:\/\/)?\S+\.[a-z]{2,}\S*$/i;

  // Specific check for common video conferencing tools and keywords
  const virtualKeywords = [
    'zoom',
    'meet.google',
    'teams',
    'webex',
    'jit.si',
    'online',
    'virtual',
    'virtuell',
    'remote',
    'video call',
    'videocall',
    'videogespräch',
    'telefonat',
    'telefon',
    'phone',
  ];

  const isVideoToolOrKeyword = virtualKeywords.some(keyword => trimmed.includes(keyword));

  return urlPattern.test(trimmed) || isVideoToolOrKeyword;
}
