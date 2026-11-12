import { Injectable, inject } from '@angular/core';
import { PrimeNG } from 'primeng/config';

import { AquaBloomTheme } from '../../../content/theming/aquabloom';
import { BlossomTheme } from '../../../content/theming/custompreset';
import { DocApplyPreset } from '../../../content/theming/docapplypreset';

/** The colour presets the component library can be styled with. Dark mode uses the default preset. */
export type UiLibraryPreset = 'default' | 'blossom' | 'aquabloom';

/** Theme options the component library is configured with, at startup and on every preset change. */
export const UI_LIBRARY_THEME_OPTIONS = {
  darkModeSelector: '.docapply-dark-mode',
  cssLayer: { name: 'primeng', order: 'theme, base, primeng' },
};

/** Applies a colour preset to the component library. */
@Injectable({ providedIn: 'root' })
export class UiLibraryThemeService {
  private readonly primeNG = inject(PrimeNG);

  /**
   * Styles the component library with a colour preset.
   *
   * @param preset the preset to apply
   */
  applyPreset(preset: UiLibraryPreset): void {
    this.primeNG.theme.set({ preset: this.toPresetDefinition(preset), options: UI_LIBRARY_THEME_OPTIONS });
  }

  private toPresetDefinition(preset: UiLibraryPreset): object {
    switch (preset) {
      case 'blossom':
        return BlossomTheme;
      case 'aquabloom':
        return AquaBloomTheme;
      default:
        return DocApplyPreset;
    }
  }
}
