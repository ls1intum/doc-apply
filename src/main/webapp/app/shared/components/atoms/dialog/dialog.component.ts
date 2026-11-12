import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'jhi-dialog',
  templateUrl: './dialog.component.html',
  standalone: true,
  imports: [DialogModule],
})
export class DialogComponent {
  visible = input<boolean>(false);
  header = input<string>('');
  shouldTranslateHeader = input<boolean>(true);
  width = input<string>('50vw');
  maxWidth = input<string>('none');
  height = input<string>('auto');
  modal = input<boolean>(true);
  draggable = input<boolean>(false);
  resizable = input<boolean>(false);
  dismissableMask = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  closable = input<boolean>(true);
  showHeader = input<boolean>(true);
  classStyling = input<string>('');
  contentStyleClass = input<string>('');
  contentStyle = input<Record<string, string>>({});
  style = input<Record<string, string>>({});
  appendTo = input<string | HTMLElement | undefined>(undefined);

  visibleChange = output<boolean>();

  mergedStyle = computed(() => {
    const baseStyle: Record<string, string> = {
      width: this.width(),
      maxWidth: this.maxWidth(),
      height: this.height(),
      background: 'var(--p-background-default)',
    };
    return Object.assign({}, baseStyle, this.style());
  });

  displayHeader = computed(() => {
    this.langChange();
    const value = this.header();
    return this.shouldTranslateHeader() ? this.translateService.instant(value) : value;
  });

  private translateService = inject(TranslateService);
  private langChange = toSignal(this.translateService.onLangChange, { initialValue: undefined });

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }
}
