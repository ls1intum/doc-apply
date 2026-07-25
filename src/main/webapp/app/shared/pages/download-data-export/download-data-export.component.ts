import { hasText } from 'app/shared/util/text.util';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UserDataExportResourceApi } from 'app/generated/api/user-data-export-resource-api';
import { firstValueFrom } from 'rxjs';
import { ToastService } from 'app/service/toast-service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TranslateDirective } from 'app/shared/language';

@Component({
  selector: 'jhi-download-data-export.component',
  imports: [CommonModule, FontAwesomeModule, TranslateDirective],
  templateUrl: './download-data-export.component.html',
})
export class DownloadDataExportComponent {
  isDownloading = signal(false);
  downloadSuccess = signal(false);

  private readonly route = inject(ActivatedRoute);
  private readonly userDataExportApi = inject(UserDataExportResourceApi);
  private readonly toastService = inject(ToastService);

  constructor() {
    const token = this.route.snapshot.paramMap.get('token');
    if (token !== null && token !== '') {
      void this.downloadDataExport(token);
    } else {
      this.toastService.showErrorKey('global.dataExport.error.noToken');
    }
  }

  private async downloadDataExport(token: string): Promise<void> {
    this.isDownloading.set(true);
    try {
      const response = await firstValueFrom(this.userDataExportApi.downloadDataExport(token));
      const blob = response.body as Blob;
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'data-export.zip';
      if (contentDisposition !== null && contentDisposition !== '') {
        const filenameFromHeader = contentDisposition.match(/filename="([^"]+)"/)?.[1];
        if (hasText(filenameFromHeader)) {
          filename = filenameFromHeader;
        }
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      this.downloadSuccess.set(true);
    } catch {
      this.toastService.showErrorKey('global.dataExport.error.downloadFailed');
    } finally {
      this.isDownloading.set(false);
    }
  }
}
