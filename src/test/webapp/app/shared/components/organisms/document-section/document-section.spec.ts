import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpHeaders, HttpResponse } from '@angular/common/http';

import { ApplicationEvaluationResourceApi } from 'app/generated/api/application-evaluation-resource-api';
import { ApplicationDocumentIdsDTO } from 'app/generated/model/application-document-ids-dto';
import { DocumentSection } from 'app/shared/components/organisms/document-section/document-section';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { createToastServiceMock, provideToastServiceMock } from '../../../../../util/toast-service.mock';
import { createTranslateServiceMock, provideTranslateMock } from '../../../../../util/translate.mock';

function createDocument(id: string, name?: string, size = 123): DocumentInformationHolderDTO {
  return { id, name, size };
}

describe('DocumentSection', () => {
  let fixture: ComponentFixture<DocumentSection>;
  let component: DocumentSection;

  let mockApi: { downloadAll: ReturnType<typeof vi.fn> };
  let mockToast = createToastServiceMock();
  let mockTranslate = createTranslateServiceMock();

  beforeEach(async () => {
    mockApi = {
      downloadAll: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentSection],
      providers: [
        { provide: ApplicationEvaluationResourceApi, useValue: mockApi },
        provideToastServiceMock(mockToast),
        provideTranslateMock(mockTranslate),
      ],
    })
      .overrideComponent(DocumentSection, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(DocumentSection);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------- ID CHANGE EFFECT ----------------
  describe('idChangeEffect', () => {
    it('should reset signals when idsDTO undefined', () => {
      fixture.componentRef.setInput('idsDTO', undefined);
      fixture.detectChanges();

      expect(component.documents()).toEqual([]);
      expect(component.extraDocuments()).toEqual([]);
      expect(component.documentsCount()).toBe(0);
    });

    it('should populate documents and extraDocuments correctly', () => {
      const dto: ApplicationDocumentIdsDTO = {
        masterDocumentIds: [{ id: 'm1' } as DocumentInformationHolderDTO, { id: 'm2' } as DocumentInformationHolderDTO],
        cvDocumentId: { id: 'cv' } as DocumentInformationHolderDTO,
        bachelorDocumentIds: [{ id: 'b1' } as DocumentInformationHolderDTO],
        referenceDocumentIds: [{ id: 'r1' } as DocumentInformationHolderDTO, { id: 'r2' } as DocumentInformationHolderDTO],
      };
      fixture.componentRef.setInput('idsDTO', dto);
      fixture.detectChanges();

      expect(component.documentsCount()).toBe(6);
      expect(component.documents().length).toBe(3);
      expect(component.extraDocuments().length).toBe(3);
    });

    it('should map each DTO entry to a translated document holder with the correct label and order', () => {
      const master1 = createDocument('m1', 'master-1.pdf');
      const master2 = createDocument('m2', 'master-2.pdf');
      const cv = createDocument('cv', 'cv.pdf');
      const bachelor = createDocument('b1', 'bachelor.pdf');
      const reference1 = createDocument('r1', 'reference-1.pdf');
      const reference2 = createDocument('r2', 'reference-2.pdf');

      const dto: ApplicationDocumentIdsDTO = {
        masterDocumentIds: [master1, master2],
        cvDocumentId: cv,
        bachelorDocumentIds: [bachelor],
        referenceDocumentIds: [reference1, reference2],
      };

      fixture.componentRef.setInput('idsDTO', dto);
      fixture.detectChanges();

      expect(component.documentsCount()).toBe(6);
      expect(component.documents()).toEqual([
        { label: 'evaluation.details.documentTypeMaster', document: master1, shouldTranslateLabel: true },
        { label: 'evaluation.details.documentTypeMaster', document: master2, shouldTranslateLabel: true },
        { label: 'evaluation.details.documentTypeCV', document: cv, shouldTranslateLabel: true },
      ]);
      expect(component.extraDocuments()).toEqual([
        { label: 'evaluation.details.documentTypeBachelor', document: bachelor, shouldTranslateLabel: true },
        { label: 'evaluation.details.documentTypeReference', document: reference1, shouldTranslateLabel: true },
        { label: 'evaluation.details.documentTypeReference', document: reference2, shouldTranslateLabel: true },
      ]);
      expect(component.allDocuments()).toEqual([...component.documents(), ...component.extraDocuments()]);
    });
  });

  // ---------------- DOWNLOAD ALL DOCUMENTS ----------------
  describe('downloadAllDocuments', () => {
    let createObjectSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectSpy: ReturnType<typeof vi.spyOn>;
    let clickSpy: ReturnType<typeof vi.spyOn>;
    let anchor: HTMLAnchorElement;

    beforeEach(() => {
      anchor = document.createElement('a');
      clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
      createObjectSpy = vi.fn().mockReturnValue('blob:url');
      revokeObjectSpy = vi.fn();

      Object.defineProperty(window.URL, 'createObjectURL', {
        writable: true,
        value: createObjectSpy,
      });
      Object.defineProperty(window.URL, 'revokeObjectURL', {
        writable: true,
        value: revokeObjectSpy,
      });

      vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    });

    it('should show error toast if applicationId undefined', async () => {
      fixture.componentRef.setInput('applicationId', undefined);
      await component.downloadAllDocuments();
      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'No application selected',
      });
    });

    it('should download file with default filename when no Content-Disposition', async () => {
      const blob = new Blob(['123'], { type: 'application/zip' });
      const headers = new HttpHeaders();
      const response = new HttpResponse({ body: blob, headers });
      mockApi.downloadAll.mockReturnValueOnce(of(response));

      fixture.componentRef.setInput('applicationId', 'app-1');
      await component.downloadAllDocuments();

      expect(mockApi.downloadAll).toHaveBeenCalledWith('app-1');
      expect(createObjectSpy).toHaveBeenCalledWith(blob);
      expect(clickSpy).toHaveBeenCalledOnce();
      expect(anchor.download).toBe('documents.zip');
      expect(revokeObjectSpy).toHaveBeenCalledWith('blob:url');
    });

    it('should extract filename from Content-Disposition header', async () => {
      const blob = new Blob();
      const headers = new HttpHeaders({ 'Content-Disposition': 'attachment; filename="test.zip"' });
      const response = new HttpResponse({ body: blob, headers });
      mockApi.downloadAll.mockReturnValueOnce(of(response));

      fixture.componentRef.setInput('applicationId', 'app-2');
      await component.downloadAllDocuments();

      expect(anchor.download).toBe('test.zip');
    });

    it('should show error toast on API failure', async () => {
      mockApi.downloadAll.mockReturnValueOnce(throwError(() => new Error('fail')));

      fixture.componentRef.setInput('applicationId', 'app-3');
      await component.downloadAllDocuments();

      expect(mockToast.showError).toHaveBeenCalledWith({
        summary: 'Error',
        detail: 'Failed to download documents',
      });
    });
  });
});
