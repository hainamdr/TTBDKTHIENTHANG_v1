import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Add Google Sheets and Profile scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');

const TOKEN_STORAGE_KEY = 'hienthang_google_oauth_token';

let isSigningIn = false;
let cachedAccessToken: string | null = (typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null);

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    // If sign-in is actively in progress via popup, let the popup handler complete first
    if (isSigningIn) return;

    if (user) {
      const storedToken = cachedAccessToken || (typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null);
      if (storedToken) {
        cachedAccessToken = storedToken;
        if (onAuthSuccess) onAuthSuccess(user, storedToken);
      } else {
        // User logged in to Firebase but token expired/lost
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không thể lấy mã truy cập Google OAuth');
    }
    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Lỗi đăng nhập Google OAuth:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Get the current access token
export const getAccessToken = (): string | null => {
  return cachedAccessToken || (typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_STORAGE_KEY) : null);
};

// Set token manually (useful when syncing from callbacks or local sessions)
export const setAccessToken = (token: string) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
};

// Sign out
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Signout error:', e);
  }
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};
