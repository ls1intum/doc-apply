import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { AiFeatureStatusService } from 'app/service/ai-feature-status.service';
import { createAccountServiceMock, provideAccountServiceMock } from 'util/account.service.mock';
import {
  AiFeatureToggleResourceApiMock,
  createAiFeatureToggleResourceApiMock,
  provideAiFeatureToggleResourceApiMock,
} from 'util/ai-feature-toggle-resource-api.service.mock';

describe('AiFeatureStatusService', () => {
  let apiMock: AiFeatureToggleResourceApiMock;
  const signedIn = signal(false);

  beforeEach(() => {
    signedIn.set(false);
    apiMock = createAiFeatureToggleResourceApiMock();
    apiMock.getAiStatus.mockReturnValue(of({ aiEnabled: false, manuallyDisabled: true, circuitBreakerOpen: false }));
    const accountMock = createAccountServiceMock(false);
    accountMock.signedIn = signedIn;

    TestBed.configureTestingModule({
      providers: [provideAccountServiceMock(accountMock), provideAiFeatureToggleResourceApiMock(apiMock)],
    });
  });

  it('should only load the status once a user is signed in', async () => {
    const service = TestBed.inject(AiFeatureStatusService);
    TestBed.tick();
    expect(apiMock.getAiStatus).not.toHaveBeenCalled();

    signedIn.set(true);
    TestBed.tick();
    await Promise.resolve();

    expect(apiMock.getAiStatus).toHaveBeenCalledOnce();
    expect(service.aiSystemEnabled()).toBe(false);
    expect(service.manuallyDisabled()).toBe(true);
  });
});
