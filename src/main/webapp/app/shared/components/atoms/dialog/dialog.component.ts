import { Component, computed, input, output } from '@angular/core';
import { TumAetUiDialogComponent } from '@tumaet/ui-angular';
import { hasText } from 'app/shared/util/text.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

/**
 * A modal dialog whose visibility the parent controls through `visible` and `visibleChange`.
 * Its padding comes from an override of the kit's dialog classes in `content/scss/_tumaet-ui-theme.scss`: the kit
 * fixes a 16px padding in its template and offers no input for it, so this is the one deliberate exception to
 * styling the kit only through inputs and the host class.
 */
@Component({
  selector: 'jhi-dialog',
  templateUrl: './dialog.component.html',
  imports: [TumAetUiDialogComponent],
})
export class DialogComponent {
  visible = input<boolean>(false);
  header = input<string>('');
  shouldTranslateHeader = input<boolean>(true);
  widthClass = input<string>('w-[50vw]');
  dismissableMask = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  closable = input<boolean>(true);
  showHeader = input<boolean>(true);
  classStyling = input<string>('');

  visibleChange = output<boolean>();

  bodyClass = computed(() => `max-w-full ${this.widthClass()} ${this.classStyling()}`);

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslateHeader()) ?? '');

  /**
   * The accessible name for the dialog. A visible kit header names the dialog itself; a hidden one still lends its
   * text, so a dialog that renders its own title row keeps a meaningful name instead of the generic fallback.
   */
  ariaLabel = computed(() => {
    if (!hasText(this.displayHeader())) {
      return this.translator.translate('global.dialog.label');
    }
    return this.showHeader() ? undefined : this.displayHeader();
  });

  private readonly translator = injectTranslator();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }
}
