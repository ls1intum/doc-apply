import { Component, ViewEncapsulation } from '@angular/core';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'jhi-toast',
  standalone: true,
  imports: [ToastModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ToastComponent {}
