import { DialogOptions } from 'app/shared/dialog/dialog.service';

/**
 * Builds the dialog options shared by the onboarding dialogs.
 *
 * @param header the already translated dialog title
 * @returns the options for opening an onboarding dialog
 */
export function onboardingDialogOptions(header: string): DialogOptions {
  return {
    header,
    dismissableMask: true,
    width: '56.25rem',
    style: {
      'max-width': '95vw',
      'border-radius': 'var(--border-radius-xl)',
    },
    focusOnShow: false,
  };
}
