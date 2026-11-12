import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideTumAetUiTranslator } from '@tumaet/ui-angular';

import { TumAetUiTranslatorService } from './tumaet-ui-translator.service';

/**
 * Sets up the TUM AET UI kit behind the shared components, so its own labels are translated with the app language.
 *
 * @returns the providers to add to the application config
 */
export function provideUiLibrary(): EnvironmentProviders {
  return makeEnvironmentProviders([provideTumAetUiTranslator(TumAetUiTranslatorService)]);
}
