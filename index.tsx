import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { Auth0Provider } from "@auth0/auth0-react";

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// REPLACE THESE WITH YOUR ACTUAL AUTH0 CREDENTIALS
const AUTH0_DOMAIN = "dev-37nud4isg6rug8tk.us.auth0.com";
const AUTH0_CLIENT_ID = "VbEovpA1Q328gZjoHNTCkBl9Vtj9EiWY";

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={AUTH0_DOMAIN}
      clientId={AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </Auth0Provider>
  </React.StrictMode>
);