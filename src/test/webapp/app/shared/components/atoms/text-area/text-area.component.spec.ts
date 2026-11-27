import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { TextAreaComponent } from 'app/shared/components/atoms/text-area/text-area.component';
import { provideTranslateMock } from 'util/translate.mock';

describe('TextAreaComponent', () => {
  it('should limit the input and count the characters of the bound control', async () => {
    await TestBed.configureTestingModule({ imports: [TextAreaComponent], providers: [provideTranslateMock()] }).compileComponents();
    const control = new FormControl('Hello');
    const fixture = TestBed.createComponent(TextAreaComponent);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('maxLength', 20);
    fixture.detectChanges();

    control.setValue('Hello world');
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.getAttribute('maxlength')).toBe('20');
    expect(fixture.nativeElement.textContent).toContain('11/20');
  });
});
