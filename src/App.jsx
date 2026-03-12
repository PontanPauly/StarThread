import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { useMyPerson } from '@/hooks/useMyPerson';
import Login from '@/pages/Login';
import LandingPage from '@/pages/LandingPage';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Onboarding from '@/pages/Onboarding';
import StarView from '@/pages/StarView';
import GuardianMessages from '@/pages/GuardianMessages';
import AdminLogin from '@/pages/AdminLogin';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminHouseholds from '@/pages/admin/AdminHouseholds';
import AdminSupport from '@/pages/admin/AdminSupport';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-4">⭐</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Please reload the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const HomeOrLanding = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { data: myPerson, isLoading: loadingPerson } = useMyPerson();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  if (loadingPerson) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (myPerson && !myPerson.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <LayoutWrapper currentPageName={mainPageKey}>
      <MainPage />
    </LayoutWrapper>
  );
};

const ProtectedRoute = ({ children, skipOnboarding = false }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const { data: myPerson, isLoading: loadingPerson } = useMyPerson();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!skipOnboarding && !loadingPerson && myPerson && !myPerson.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="households" element={<AdminHouseholds />} />
        <Route path="support" element={<AdminSupport />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={
        <ProtectedRoute skipOnboarding>
          <Onboarding />
        </ProtectedRoute>
      } />
      <Route path="/" element={<HomeOrLanding />} />
      <Route path="/star/:personId" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName="StarView">
            <StarView />
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      <Route path="/guardian-messages/:wardPersonId" element={
        <ProtectedRoute>
          <LayoutWrapper currentPageName="GuardianMessages">
            <GuardianMessages />
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      {Object.entries(Pages).filter(([path]) => path !== 'onboarding').map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <ProtectedRoute>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </ProtectedRoute>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
