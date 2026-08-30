import { LocalStorageService, ApplicationDraftData } from 'app/service/localStorage.service';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    service = new LocalStorageService();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const emptyPersonalInfo: ApplicationDraftData['personalInfoData'] = {
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    dateOfBirth: '',
    website: '',
    linkedIn: '',
    street: '',
    city: '',
    postcode: '',
  };
  const baseDraft: Omit<ApplicationDraftData, 'timestamp'> = {
    personalInfoData: emptyPersonalInfo,
    applicationId: 'A123',
    jobId: 'J999',
  };

  function makeDraft(timestamp: Date): ApplicationDraftData {
    return {
      personalInfoData: baseDraft.personalInfoData,
      applicationId: baseDraft.applicationId,
      jobId: baseDraft.jobId,
      timestamp: timestamp.toISOString(),
    };
  }

  it('saves application draft with applicationId key', () => {
    const draft = makeDraft(new Date());
    service.saveApplicationDraft(draft);
    const raw = localStorage.getItem('application_draft_A123');
    expect(raw).not.toBeNull();
    if (!raw) throw new Error('Draft not found in localStorage');
    expect(JSON.parse(raw).applicationId).toBe('A123');
  });

  it('saves application draft with jobId when applicationId absent', () => {
    const draftOnlyJob: ApplicationDraftData = {
      personalInfoData: emptyPersonalInfo,
      applicationId: '', // empty string forces jobId fallback
      jobId: 'J123',
      timestamp: new Date().toISOString(),
    };
    service.saveApplicationDraft(draftOnlyJob);
    const raw = localStorage.getItem('application_draft_job_J123');
    expect(raw).not.toBeNull();
    if (!raw) throw new Error('Draft not found in localStorage');
    expect(JSON.parse(raw).jobId).toBe('J123');
  });

  it('loads application draft when not expired', () => {
    const draft = makeDraft(new Date());
    service.saveApplicationDraft(draft);
    const loaded = service.loadApplicationDraft(draft.applicationId, undefined);
    expect(loaded).not.toBeNull();
    if (!loaded) throw new Error('Loaded draft is null');
    expect(loaded.applicationId).toBe('A123');
  });

  it('returns null when draft expired (older than 30 days) and clears it', () => {
    const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const expired = makeDraft(past);
    service.saveApplicationDraft(expired);
    const loaded = service.loadApplicationDraft(expired.applicationId, undefined);
    expect(loaded).toBeNull();
    expect(localStorage.getItem('application_draft_A123')).toBeNull();
  });

  it('clears application draft explicitly', () => {
    const draft = makeDraft(new Date());
    service.saveApplicationDraft(draft);
    service.clearApplicationDraft(draft.applicationId, undefined);
    expect(localStorage.getItem('application_draft_A123')).toBeNull();
  });

  it('throws error when neither applicationId nor jobId provided to load', () => {
    // Access private helper via bracket notation without any cast
    const getApplicationKey = (service as { [key: string]: any })['getApplicationKey'];
    expect(() => getApplicationKey.call(service, undefined, undefined)).toThrowError();
  });

  it('should return the fallback when no page-size preference is stored', () => {
    expect(service.loadPageSize('jobsPerPage', 10)).toBe(10);
  });

  it('should return the stored page-size preference', () => {
    service.savePageSize('jobsPerPage', 20);
    expect(service.loadPageSize('jobsPerPage', 10)).toBe(20);
  });

  it('should fall back when the stored page-size value is not in the allowed set', () => {
    service.savePageSize('jobsPerPage', 7);
    expect(service.loadPageSize('jobsPerPage', 10, [5, 10, 15, 20])).toBe(10);
  });

  it('should fall back when the stored page-size value cannot be parsed', () => {
    localStorage.setItem('jobsPerPage', 'not-a-number');
    expect(service.loadPageSize('jobsPerPage', 10)).toBe(10);
  });

  it('rethrows error when JSON.stringify fails (circular data)', () => {
    const circularPersonal: ApplicationDraftData['personalInfoData'] & { self?: any } = {
      firstName: emptyPersonalInfo.firstName,
      lastName: emptyPersonalInfo.lastName,
      email: emptyPersonalInfo.email,
      phoneNumber: emptyPersonalInfo.phoneNumber,
      dateOfBirth: emptyPersonalInfo.dateOfBirth,
      website: emptyPersonalInfo.website,
      linkedIn: emptyPersonalInfo.linkedIn,
      street: emptyPersonalInfo.street,
      city: emptyPersonalInfo.city,
      postcode: emptyPersonalInfo.postcode,
    };
    circularPersonal.self = circularPersonal; // circular reference triggers JSON.stringify error
    const draft: ApplicationDraftData = {
      personalInfoData: circularPersonal,
      applicationId: 'AERR',
      jobId: 'JERR',
      timestamp: new Date().toISOString(),
    };
    expect(() => runSilently(() => service.saveApplicationDraft(draft))).toThrowError('Failed to save application data locally.');
  });
});
