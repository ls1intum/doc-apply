import { ENVIRONMENT_INITIALIZER, inject, type Provider } from '@angular/core';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fontAwesomeIcons } from 'app/config/font-awesome-icons';
import { docApplyIconPack } from 'app/shared/icons/icons';

export function provideFontAwesomeTesting(): Provider {
  return {
    provide: ENVIRONMENT_INITIALIZER,
    multi: true,
    useValue: () => {
      const library = inject(FaIconLibrary);
      const allIcons = fontAwesomeIcons.concat(Object.values(docApplyIconPack));
      library.addIcons.apply(library, allIcons);
    },
  };
}
