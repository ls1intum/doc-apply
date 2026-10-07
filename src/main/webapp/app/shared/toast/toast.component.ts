import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'jhi-toast',
  standalone: true,
  imports: [ToastModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None,
})
export class ToastComponent {}
