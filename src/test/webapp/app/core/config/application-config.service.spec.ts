import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApplicationConfigService } from 'app/core/config/application-config.service';
import { provideToastServiceMock } from 'util/toast-service.mock';

describe('ApplicationConfigService', () => {
  let service: ApplicationConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideToastServiceMock()],
    });
    service = TestBed.inject(ApplicationConfigService);
  });

  it('should throw from getters before initialization', () => {
    expect(() => service.getAppConfig()).toThrow('ApplicationConfig not initialized yet');
    expect(() => service.keycloak).toThrow('ApplicationConfig not initialized yet');
    expect(() => service.otp).toThrow('ApplicationConfig not initialized yet');
  });

  describe('setAppConfig & getAppConfig', () => {
    it('should store a frozen clone and not the original reference', () => {
      const input = {
        keycloak: {
          url: 'http://kc',
          tumLoginRealm: 'tumidpldap',
          clientId: 'client',
          relyingPartyId: 'localhost',
        },
        otp: { length: 3, ttlSeconds: 120, resendCooldownSeconds: 30 },
      };

      service.setAppConfig(input);

      const stored = service.getAppConfig();
      expect(stored).toEqual(input);
      expect(stored).not.toBe(input);
      expect(Object.isFrozen(stored)).toBe(true);

      // Mutating the original input after setAppConfig must not affect the stored config
      input.keycloak.url = 'changed-after-set';
      expect(service.getAppConfig().keycloak?.url).toBe('http://kc');
    });

    it('should override previous config on subsequent calls', () => {
      service.setAppConfig({
        keycloak: { url: 'first', tumLoginRealm: 'tum', clientId: 'c', relyingPartyId: '' },
      });
      service.setAppConfig({
        keycloak: { url: 'second', tumLoginRealm: 'tum', clientId: 'c', relyingPartyId: '' },
      });
      expect(service.getAppConfig().keycloak?.url).toBe('second');
    });
  });

  describe('convenience getters with defaults', () => {
    it.each([
      [
        'defaults when sub-objects are missing',
        {},
        { url: '', tumLoginRealm: '', clientId: '', relyingPartyId: '' },
        { length: 4, ttlSeconds: 300, resendCooldownSeconds: 60 },
      ],
      [
        'the provided values when present',
        {
          keycloak: { url: 'http://kc', tumLoginRealm: 'tumidpldap', clientId: 'cli', relyingPartyId: 'apply.in.tum.de' },
          otp: { length: 8, ttlSeconds: 600, resendCooldownSeconds: 120 },
        },
        { url: 'http://kc', tumLoginRealm: 'tumidpldap', clientId: 'cli', relyingPartyId: 'apply.in.tum.de' },
        { length: 8, ttlSeconds: 600, resendCooldownSeconds: 120 },
      ],
    ])('should return %s from the keycloak and otp getters', (_description, input, expectedKeycloak, expectedOtp) => {
      service.setAppConfig(input);

      expect(service.keycloak).toEqual(expectedKeycloak);
      expect(service.otp).toEqual(expectedOtp);
    });
  });

  it('should not change stored config when getter results are mutated', () => {
    service.setAppConfig({
      keycloak: { url: 'A', tumLoginRealm: 'tum', clientId: 'C', relyingPartyId: '' },
      otp: { length: 7, ttlSeconds: 111, resendCooldownSeconds: 22 },
    });

    service.keycloak.url = 'B';
    expect(service.keycloak.url).toBe('A');

    service.otp.length = 9;
    expect(service.otp.length).toBe(7);
  });

  it.each(['api', '/api/auth'])('should echo the given path %s from getEndpointFor', path => {
    service.setAppConfig({});
    expect(service.getEndpointFor(path)).toBe(path);
  });
});
