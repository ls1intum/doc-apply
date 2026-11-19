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
  width = input<string>('50vw');
  maxWidth = input<string>('none');
  height = input<string>('auto');
  dismissableMask = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  closable = input<boolean>(true);
  showHeader = input<boolean>(true);
  classStyling = input<string>('');
  contentStyleClass = input<string>('');
  contentStyle = input<Record<string, string>>({});
  style = input<Record<string, string>>({});

  visibleChange = output<boolean>();

  bodyClass = computed(() => `${this.classStyling()} ${this.contentStyleClass()}`);

  mergedStyle = computed(() => {
    const maxWidth = this.maxWidth();
    const width = this.width().replace(/^(\d+(?:\.\d+)?)%$/, '$1vw');
    const baseStyle: Record<string, string> = {
      width: maxWidth === 'none' ? width : `min(${width}, ${maxWidth})`,
      maxWidth: '100%',
      height: this.height(),
    };
    return Object.assign(baseStyle, this.style(), this.contentStyle());
  });

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslateHeader()) ?? '');

  ariaLabel = computed(() =>
    this.showHeader() && hasText(this.displayHeader()) ? undefined : this.translator.translate('global.dialog.label'),
  );

  private readonly translator = injectTranslator();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }
}
