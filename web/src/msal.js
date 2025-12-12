import { PublicClientApplication } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AAD_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AAD_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_AAD_REDIRECT_URI || window.location.origin;

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri
  },
  cache: {
    cacheLocation: 'localStorage'
  }
});

export const loginRequest = {
  scopes: ['User.Read', 'Mail.Read']
};

// Promise de inicializacao (MSAL v3 exige inicializar antes de usar).
export const msalReady = msalInstance.initialize();
