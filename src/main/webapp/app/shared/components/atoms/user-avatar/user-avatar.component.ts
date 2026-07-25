import { hasText } from 'app/shared/util/text.util';
import { Component, computed, inject, input } from '@angular/core';
import { ThemeService } from 'app/service/theme.service';

@Component({
  selector: 'jhi-user-avatar',
  standalone: true,
  templateUrl: './user-avatar.component.html',
})
export class UserAvatarComponent {
  fullName = input<string | undefined>(undefined);
  avatarUrl = input<string | undefined>(undefined);
  size = input<'sm' | 'md' | 'lg' | 'xl'>('sm');
  loading = input<'eager' | 'lazy'>('eager');

  // Show initials for the current display name, fallback to "U" when missing.
  initials = computed(() => this.initialsFromFullName(this.fullName()?.trim() ?? ''));

  // Accessibility label mirrors the visible identity when available.
  ariaLabel = computed(() => {
    const fullName = this.fullName()?.trim();
    return !hasText(fullName) ? 'User avatar' : `Avatar of ${fullName}`;
  });

  backgroundColor = computed(() => {
    // We use the fullname as source so each user consistently gets the same color.
    const normalizedName = this.fullName()?.trim();
    const source = normalizedName === '' ? 'U' : (normalizedName ?? 'U');
    const hash = this.hashString(source);
    const palette = this.themeService.theme() === 'dark' ? this.darkAvatarPalette : this.lightAvatarPalette;
    return palette[Math.abs(hash) % palette.length];
  });

  textColor = computed(() => this.darkenHex(this.backgroundColor(), this.themeService.theme() === 'dark' ? 0.5 : 0.6));
  borderColor = computed(() => this.darkenHex(this.backgroundColor(), this.themeService.theme() === 'dark' ? 0.8 : 0.9));
  textShadow = computed(() =>
    this.themeService.theme() === 'dark' ? '0 1px 0 rgba(255, 255, 255, 0.20)' : '0 1px 0 rgba(255, 255, 255, 0.28)',
  );
  sizeClass = computed(() => {
    const size = this.size();
    if (size === 'md') {
      return 'h-12 w-12 text-[1.2rem]';
    }
    if (size === 'xl') {
      return 'h-16 w-16 text-[1.6rem]';
    }
    if (size === 'lg') {
      return 'h-14 w-14 text-[1.4rem]';
    }
    return 'h-10 w-10 text-[1rem]';
  });

  private readonly lightAvatarPalette = ['#B5D0FA', '#BFECD7', '#FFE6A8', '#FFCACA', '#E0CFFA', '#BDEDEA', '#FCD3BE', '#F5CAE0'];
  private readonly darkAvatarPalette = ['#9FB6E8', '#9FD6BE', '#ebd19e', '#E5AFAF', '#C4B0E8', '#96D0CC', '#deb29c', '#DEB0C8'];
  private readonly themeService = inject(ThemeService);

  private hashString(value: string): number {
    let hash = 0;
    const uint32 = 4_294_967_296; // 2^32
    const int32Boundary = 2_147_483_648; // 2^31

    for (let i = 0; i < value.length; i++) {
      // Keep legacy 32-bit signed hash behavior for stable color mapping.
      hash = (hash * 31 + value.charCodeAt(i)) % uint32;
      if (hash < 0) {
        hash += uint32;
      }
    }

    return hash >= int32Boundary ? hash - uint32 : hash;
  }

  private initialsFromFullName(name: string): string {
    if (name === '') {
      return 'U';
    }

    // Pick first and last name initials (e.g. "Max Applicant" => "MA").
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }

    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }

    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }

  /**
   * Darkens a hex color for avatar text and border contrast.
   *
   * @param hex - The six-character hex color to darken.
   * @param factor - The multiplier applied to each RGB channel to reduce brightness.
   * @returns The darkened color as an RGB string, or a default fallback color for invalid hex input.
   */
  private darkenHex(hex: string, factor: number): string {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6) {
      return '#1f2937';
    }

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    const darkenedR = Math.max(0, Math.min(255, Math.round(r * factor)));
    const darkenedG = Math.max(0, Math.min(255, Math.round(g * factor)));
    const darkenedB = Math.max(0, Math.min(255, Math.round(b * factor)));

    return `rgb(${darkenedR}, ${darkenedG}, ${darkenedB})`;
  }
}
