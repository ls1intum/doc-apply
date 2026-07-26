import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarButtonComponent } from 'app/shared/components/atoms/sidebar-button/sidebar-button.component';
import { provideFontAwesomeTesting } from '../../../../../util/fontawesome.testing';
import { provideTranslateMock } from '../../../../../util/translate.mock';
import { TooltipModule } from 'primeng/tooltip';
import { createRouterMock, provideRouterMock, RouterMock } from '../../../../../util/router.mock';

describe('SidebarButtonComponent', () => {
  let component: SidebarButtonComponent;
  let fixture: ComponentFixture<SidebarButtonComponent>;
  let router: RouterMock;

  beforeEach(async () => {
    router = createRouterMock();

    TestBed.configureTestingModule({
      imports: [SidebarButtonComponent, TooltipModule],
      providers: [provideFontAwesomeTesting(), provideTranslateMock(), provideRouterMock(router)],
    });

    fixture = TestBed.createComponent(SidebarButtonComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('icon', 'user');
    fixture.componentRef.setInput('label', 'Test Label');
    fixture.componentRef.setInput('link', '/');
    fixture.componentRef.setInput('isCollapsed', false);
    fixture.componentRef.setInput('isActive', false);

    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('width', () => {
    const buttonClasses = (): DOMTokenList => (fixture.nativeElement.querySelector('button') as HTMLElement).classList;

    it('should span the full width when expanded so the active highlight covers the whole row', () => {
      fixture.componentRef.setInput('isCollapsed', false);
      fixture.detectChanges();

      expect(buttonClasses().contains('w-full')).toBe(true);
      expect(buttonClasses().contains('w-11')).toBe(false);
    });

    it('should be a fixed square instead when collapsed to an icon', () => {
      fixture.componentRef.setInput('isCollapsed', true);
      fixture.detectChanges();

      expect(buttonClasses().contains('w-11')).toBe(true);
      expect(buttonClasses().contains('w-full')).toBe(false);
    });

    it('should span the full width when collapsed without an icon', () => {
      fixture.componentRef.setInput('icon', undefined);
      fixture.componentRef.setInput('isCollapsed', true);
      fixture.detectChanges();

      expect(buttonClasses().contains('w-full')).toBe(true);
    });
  });

  describe('navigation', () => {
    it('should call router.navigate on click and log an error if navigation fails', async () => {
      const error = new Error('Test Navigation Error');
      const navigateSpy = vi.spyOn(router, 'navigate').mockRejectedValue(error);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const buttonEl = fixture.debugElement.query(de => de.nativeElement?.tagName === 'BUTTON');
      buttonEl.triggerEventHandler('click', null);

      await fixture.whenStable();

      expect(navigateSpy).toHaveBeenCalledWith(['/']);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Navigation error:', error);
    });
  });
});
