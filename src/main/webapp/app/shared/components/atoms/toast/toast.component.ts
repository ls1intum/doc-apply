import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

/** A toast notification as the app shows it. */
export interface ToastMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  summary?: string;
  detail?: string;
  /** How long the toast stays visible, in milliseconds. */
  life: number;
}

@Component({
  selector: 'jhi-toast',
  standalone: true,
  imports: [ToastModule],
  providers: [MessageService],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ToastComponent {
  private readonly messageService = inject(MessageService);

  /**
   * Shows a toast on top of the page.
   *
   * @param message what the toast says and how long it stays
   */
  show(message: ToastMessage): void {
    this.messageService.add(message);
  }
}
