import { Dialog } from '@angular/cdk/dialog';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideTumAetUiTranslator } from '@tumaet/ui-angular';
import { AnimatedDialog } from 'app/shared/dialog/animated-dialog';

import { TumAetUiTranslatorService } from './tumaet-ui-translator.service';

/**
 * Sets up the TUM AET UI kit behind the shared components, so its own labels are translated with the app language and
 * its dialogs animate out like the app's own.
 *
 * @returns the providers to add to the application config
 */
export function provideUiLibrary(): EnvironmentProviders {
  return makeEnvironmentProviders([provideTumAetUiTranslator(TumAetUiTranslatorService), { provide: Dialog, useClass: AnimatedDialog }]);
}
