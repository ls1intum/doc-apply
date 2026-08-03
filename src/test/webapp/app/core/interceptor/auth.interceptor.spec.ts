import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authInterceptor } from 'app/core/interceptor/auth.interceptor';
import { AuthFacadeServiceMock, createAuthFacadeServiceMock, provideAuthFacadeServiceMock } from 'util/auth-facade.service.mock';
import {
  KeycloakAuthenticationServiceMock,
  createKeycloakAuthenticationServiceMock,
  provideKeycloakAuthenticationServiceMock,
} from 'util/keycloak.mock';

/** Lets the promise-based refresh (from(...).switchMap(...)) settle before asserting the replayed request. */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  let authFacade: AuthFacadeServiceMock;
  let keycloak: KeycloakAuthenticationServiceMock;
  let httpMock: HttpTestingController;
  let http: HttpClient;

  beforeEach(() => {
    authFacade = createAuthFacadeServiceMock();
    keycloak = createKeycloakAuthenticationServiceMock();
    vi.mocked(authFacade.logout).mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideAuthFacadeServiceMock(authFacade),
        provideKeycloakAuthenticationServiceMock(keycloak),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('should attach the Keycloak bearer token when one is present', () => {
    keycloak.getToken.mockReturnValue('kc-token');
    http.get('/api/data').subscribe();

    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.get('Authorization')).toBe('Bearer kc-token');
    req.flush({});
  });

  it('should refresh the session and replay the request once on a 401', async () => {
    vi.mocked(authFacade.refreshSession).mockResolvedValue(true);
    const onNext = vi.fn();
    http.get('/api/data').subscribe({ next: onNext });

    httpMock.expectOne('/api/data').flush('Unauthorized', unauthorized);
    await settle();

    expect(authFacade.refreshSession).toHaveBeenCalledOnce();
    httpMock.expectOne('/api/data').flush({ ok: true });
    await settle();

    expect(authFacade.logout).not.toHaveBeenCalled();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('should log out when the refresh fails on a 401', async () => {
    vi.mocked(authFacade.refreshSession).mockResolvedValue(false);
    http.get('/api/data').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/data').flush('Unauthorized', unauthorized);
    await settle();

    expect(authFacade.refreshSession).toHaveBeenCalledOnce();
    expect(authFacade.logout).toHaveBeenCalledWith(true);
  });

  it('should log out when the replayed request still returns 401', async () => {
    vi.mocked(authFacade.refreshSession).mockResolvedValue(true);
    http.get('/api/data').subscribe({ error: () => undefined });

    httpMock.expectOne('/api/data').flush('Unauthorized', unauthorized);
    await settle();
    httpMock.expectOne('/api/data').flush('Unauthorized', unauthorized);
    await settle();

    expect(authFacade.logout).toHaveBeenCalledWith(true);
  });

  it('should not refresh or retry a 401 from an auth endpoint', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });

    httpMock.expectOne('/api/auth/login').flush('Unauthorized', unauthorized);

    expect(authFacade.refreshSession).not.toHaveBeenCalled();
    expect(authFacade.logout).not.toHaveBeenCalled();
  });
});
