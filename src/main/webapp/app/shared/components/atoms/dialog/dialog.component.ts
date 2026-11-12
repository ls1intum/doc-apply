import { Component, computed, input, output } from '@angular/core';
import { TumAetUiDialogComponent } from '@tumaet/ui-angular';
import { hasText } from 'app/shared/util/text.util';
import { injectTranslator } from 'app/shared/util/translate-signal.util';

/** A modal dialog whose visibility the parent controls through `visible` and `visibleChange`. */
@Component({
  selector: 'jhi-dialog',
  templateUrl: './dialog.component.html',
  imports: [TumAetUiDialogComponent],
})
export class DialogComponent {
  visible = input<boolean>(false);
  header = input<string>('');
  shouldTranslateHeader = input<boolean>(true);
  /** Width of the dialog body; a percentage is taken of the viewport, as the dialog has no other reference. */
  width = input<string>('50vw');
  maxWidth = input<string>('none');
  height = input<string>('auto');
  dismissableMask = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  closable = input<boolean>(true);
  showHeader = input<boolean>(true);
  /** Classes for the dialog body, for example responsive widths. */
  classStyling = input<string>('');
  contentStyleClass = input<string>('');
  contentStyle = input<Record<string, string>>({});
  /** Styles for the dialog body, applied after width, max width and height. */
  style = input<Record<string, string>>({});

  visibleChange = output<boolean>();

  bodyClass = computed(() => `${this.classStyling()} ${this.contentStyleClass()}`);

  mergedStyle = computed(() => {
    const maxWidth = this.maxWidth();
    const baseStyle: Record<string, string> = {
      width: this.width().replace(/^(\d+(?:\.\d+)?)%$/, '$1vw'),
      maxWidth: maxWidth === 'none' ? '100%' : `min(${maxWidth}, 100%)`,
      height: this.height(),
    };
    return Object.assign(baseStyle, this.style(), this.contentStyle());
  });

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslateHeader()) ?? '');

  /** The kit dialog needs an accessible name when no title is shown. */
  ariaLabel = computed(() =>
    this.showHeader() && hasText(this.displayHeader()) ? undefined : this.translator.translate('global.dialog.label'),
  );

  private readonly translator = injectTranslator();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }
}
