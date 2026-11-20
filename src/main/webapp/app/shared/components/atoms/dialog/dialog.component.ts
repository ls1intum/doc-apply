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
  widthClass = input<string>('w-[50vw]');
  dismissableMask = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  closable = input<boolean>(true);
  showHeader = input<boolean>(true);
  classStyling = input<string>('');
  contentStyleClass = input<string>('');

  visibleChange = output<boolean>();

  bodyClass = computed(() => `max-w-full ${this.widthClass()} ${this.classStyling()} ${this.contentStyleClass()}`);

  displayHeader = computed(() => this.translator.translate(this.header(), this.shouldTranslateHeader()) ?? '');

  ariaLabel = computed(() =>
    this.showHeader() && hasText(this.displayHeader()) ? undefined : this.translator.translate('global.dialog.label'),
  );

  private readonly translator = injectTranslator();

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }
}
