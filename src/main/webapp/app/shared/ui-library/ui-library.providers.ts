import { EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { providePrimeNG } from 'primeng/config';

import { DocApplyPreset } from '../../../content/theming/docapplypreset';

import { PrimengTranslationService } from './primeng-translation.service';
import { UI_LIBRARY_THEME_OPTIONS } from './ui-library-theme.service';

/**
 * Sets up the component library behind the shared components: its theme, its translated labels and the
 * animation provider it still drives its overlay and dialog animations through, which is why the deprecated
 * provider cannot be dropped for animate.enter/animate.leave yet.
 *
 * @returns the providers to add to the application config
 */
export function provideUiLibrary(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      inject(PrimengTranslationService);
    }),
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    provideAnimations(),
    providePrimeNG({ theme: { preset: DocApplyPreset, options: UI_LIBRARY_THEME_OPTIONS } }),
  ]);
}
