import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Comment } from 'app/shared/components/molecules/comment/comment';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';

describe('Comment', () => {
  let fixture: ComponentFixture<Comment>;
  let component: Comment;

  const inputText = (value: string): void => {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.addEventListener('input', event => component.onInput(event));
    textarea.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Comment],
      providers: [provideTranslateMock(), provideFontAwesomeTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Comment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ---------------- CAN SAVE ----------------
  it('should allow saving in create mode when draft has text', () => {
    fixture.componentRef.setInput('isCreate', true);
    fixture.detectChanges();

    inputText('hi');
    expect(component['canSave']()).toBe(true);
  });

  it('should not allow saving when not in edit or create mode', () => {
    fixture.componentRef.setInput('isCreate', false);
    component['draft'].set('something');
    component.text.set('something');
    fixture.detectChanges();

    expect(component['canSave']()).toBe(false);
  });

  it('should allow saving in edit mode when draft differs from text', () => {
    fixture.componentRef.setInput('commentId', '1');
    fixture.componentRef.setInput('editingId', '1');
    component.text.set('old');
    component['draft'].set('new');
    fixture.detectChanges();

    expect(component['isEdit']()).toBe(true);
    expect(component['canSave']()).toBe(true);
  });

  it.each<[boolean, string, string]>([
    [true, 'hello', 'hello'],
    [false, 'world', ''],
  ])('should update draft and text=%s on input when isCreate=%s', (isCreate, draftValue, textValue) => {
    fixture.componentRef.setInput('isCreate', isCreate);
    fixture.detectChanges();

    inputText(draftValue);

    expect(component['draft']()).toBe(draftValue);
    expect(component.text()).toBe(textValue);
  });

  it('should update the draft when typing into the rendered textarea in create mode', () => {
    fixture.componentRef.setInput('isCreate', true);
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    textarea.value = 'typed comment';
    textarea.dispatchEvent(new Event('input'));

    expect(component['draft']()).toBe('typed comment');
    expect(component.text()).toBe('typed comment');
  });

  // ---------------- START / CANCEL / SAVE ----------------
  it('should copy text to draft and emit enterEdit on startEdit', () => {
    const spy = vi.fn();
    component.text.set('copyMe');
    component.enterEdit.subscribe(spy);

    component.startEdit();

    expect(component['draft']()).toBe('copyMe');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('should emit exitEdit on cancel', () => {
    const spy = vi.fn();
    component.exitEdit.subscribe(spy);

    component.onCancel();

    expect(spy).toHaveBeenCalledOnce();
  });

  it('should emit saved and exitEdit on save', () => {
    const savedSpy = vi.fn();
    const exitSpy = vi.fn();
    component.saved.subscribe(savedSpy);
    component.exitEdit.subscribe(exitSpy);

    component['draft'].set('final');
    component.onSave();

    expect(savedSpy).toHaveBeenCalledWith('final');
    expect(exitSpy).toHaveBeenCalledOnce();
  });
});
