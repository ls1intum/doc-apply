/**
 * @param {import('puppeteer').Browser} browser
 */
module.exports = async browser => {
  const targetUrl = process.env.TARGET_URL || 'http://localhost:4200';
  const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:9080';
  const keycloakClientId = process.env.KEYCLOAK_CLIENT_ID || 'docapply-client';
  const authMethod = process.env.TEST_AUTH_METHOD || 'server';
  const keycloakRealm = process.env.TEST_KEYCLOAK_REALM || 'tumidpldap';
  const authPath = '/settings';
  const authUrl = new URL(authPath, targetUrl).toString();
  const appUrl = new URL('/', targetUrl).toString();

  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('TEST_USERNAME or TEST_PASSWORD environment variables are missing!');
  }

  // 1. Open a new setup tab in the browser Lighthouse just launched
  const page = await browser.newPage();

  // 2. Open the app origin so we can establish the authentication cookies on the correct site.
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  if (authMethod === 'keycloak') {
    const keycloakLoginUrl = new URL(`/realms/${encodeURIComponent(keycloakRealm)}/protocol/openid-connect/auth`, keycloakUrl);
    keycloakLoginUrl.searchParams.set('client_id', keycloakClientId);
    keycloakLoginUrl.searchParams.set('redirect_uri', authUrl);
    keycloakLoginUrl.searchParams.set('response_type', 'code');
    keycloakLoginUrl.searchParams.set('scope', 'openid');

    await page.goto(keycloakLoginUrl.toString(), { waitUntil: 'domcontentloaded' });
    const hasUsernameField = await page
      .waitForSelector('#username, input[name="username"]', { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (hasUsernameField) {
      await page.type('#username, input[name="username"]', username);
      await page.type('#password, input[name="password"]', password);
      await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30_000 }), page.click('#kc-login')]);
    } else {
      // In some runs the browser may already be authenticated and redirected without showing Keycloak form.
      const currentPath = new URL(page.url()).pathname;
      if (currentPath !== authPath) {
        throw new Error(`Keycloak login form not found and not authenticated. Current URL: ${page.url()}`);
      }
    }
  } else {
    // 3. Use the existing server login endpoint to mint durable auth cookies for Lighthouse.
    const loginResult = await page.evaluate(
      async credentials => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(credentials),
        });

        return { ok: response.ok, status: response.status, body: await response.text().catch(() => '') };
      },
      { email: username, password },
    );

    if (!loginResult.ok)
      throw new Error(
        `Failed to authenticate Lighthouse user via /api/auth/login (status ${loginResult.status}). Body: ${loginResult.body}`,
      );
  }

  // 4. Confirm that a protected page now loads inside the authenticated app.
  await page.goto(authUrl, { waitUntil: 'networkidle0' });

  await page
    .waitForFunction(
      expectedPath => {
        return window.location.pathname === expectedPath && (document.body?.innerText?.trim().length ?? 0) > 0;
      },
      {
        timeout: 30_000,
      },
      authPath,
    )
    .catch(() => {
      throw new Error(`Timed out waiting for the authenticated app page at ${page.url()}.`);
    });

  const currentUrl = new URL(page.url());

  if (currentUrl.pathname === '/accessdenied') {
    throw new Error(`Reached /accessdenied instead of Keycloak from ${authUrl}.`);
  }

  // 5. Close this setup tab. Lighthouse takes over the authenticated session cookies.
  await page.close();
};
