import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import { DocumentInformationHolderDTO } from 'app/generated/model/document-information-holder-dto';
import { DocumentDialog } from 'app/shared/components/molecules/document-dialog/document-dialog';
import { DocumentHolder } from 'app/shared/models/document-holder';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { DocumentResourceApi } from 'app/generated/api/document-resource-api';

function createDocument(id: string, name: string, size = 123): DocumentInformationHolderDTO {
  return { id, name, size };
}

function createHolder(id: string, name: string, size = 123): DocumentHolder {
  return { label: `Label ${id}`, document: createDocument(id, name, size) };
}

describe('DocumentDialog', () => {
  let fixture: ComponentFixture<DocumentDialog>;
  let component: DocumentDialog;

  function setHolders(holders: DocumentHolder[], selectedId?: string) {
    fixture.componentRef.setInput('documentHolders', holders);
    if (selectedId !== undefined) {
      component.selectedId.set(selectedId);
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentDialog],
      providers: [
        provideTranslateMock(),
        {
          provide: DocumentResourceApi,
          useValue: { downloadDocument: () => of(new ArrayBuffer(0)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentDialog);
    component = fixture.componentInstance;
  });

  describe.each([
    { desc: 'should not select anything if documentHolders is empty', holders: [], selected: undefined, expected: undefined },
    {
      desc: 'should select the first document if holders exist and no selection set',
      holders: [createHolder('doc1', 'Doc 1'), createHolder('doc2', 'Doc 2')],
      selected: undefined,
      expected: 'doc1',
    },
    {
      desc: 'should fall back to the first document when selectedId is not present in the current list',
      holders: [createHolder('doc1', 'Doc 1')],
      selected: 'customId',
      expected: 'doc1',
    },
  ])('initialization', ({ desc, holders, selected, expected }) => {
    it(desc, () => {
      setHolders(holders, selected);
      expect(component.selectedId()).toBe(expected);
    });
  });

  describe.each([
    {
      desc: 'should auto-select the first document if selectedId is undefined',
      holders: [createHolder('doc1', 'Doc 1')],
      selected: undefined,
      expected: 'doc1',
    },
    {
      desc: 'should return document if selectedId matches',
      holders: [createHolder('doc1', 'Doc 1'), createHolder('doc2', 'Doc 2')],
      selected: 'doc2',
      expected: 'doc2',
    },
    {
      desc: 'should fall back to the first document if selectedId is missing from the list',
      holders: [createHolder('doc1', 'Doc 1')],
      selected: 'missing',
      expected: 'doc1',
    },
  ])('selectedDocument', ({ desc, holders, selected, expected }) => {
    it(desc, () => {
      setHolders(holders, selected);
      expect(component.selectedDocument()?.id).toBe(expected);
    });
  });

  describe.each([
    {
      desc: 'should return true when id matches selectedDocument',
      holders: [createHolder('doc1', 'Doc 1')],
      selected: 'doc1',
      checkId: 'doc1',
      expected: true,
    },
    {
      desc: 'should return false when id does not match',
      holders: [createHolder('doc1', 'Doc 1')],
      selected: 'doc1',
      checkId: 'doc2',
      expected: false,
    },
    { desc: 'should return false if no document selected', holders: [], selected: undefined, checkId: 'doc1', expected: false },
  ])('isSelected', ({ desc, holders, selected, checkId, expected }) => {
    it(desc, () => {
      setHolders(holders, selected);
      expect(component.isSelected(checkId)()).toBe(expected);
    });
  });

  describe('selectDoc', () => {
    it('should update selectedId', () => {
      component.selectDoc('doc1');
      expect(component.selectedId()).toBe('doc1');
    });
  });
});
