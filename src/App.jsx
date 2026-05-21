import { Toaster } from "@/components/ui/toaster"
import SalesOverview from '@/pages/sales/SalesOverview';
import Quotes from '@/pages/sales/Quotes';
import Proformas from '@/pages/sales/Proformas';
import Invoices from '@/pages/sales/Invoices';
import SalesClients from '@/pages/sales/SalesClients';
import SalesSettings from '@/pages/sales/SalesSettings';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Local app: never block the UI for auth (no external OAuth)
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/sales/overview" element={<LayoutWrapper currentPageName="SalesOverview"><SalesOverview /></LayoutWrapper>} />
      <Route path="/sales/quotes" element={<LayoutWrapper currentPageName="Quotes"><Quotes /></LayoutWrapper>} />
      <Route path="/sales/proformas" element={<LayoutWrapper currentPageName="Proformas"><Proformas /></LayoutWrapper>} />
      <Route path="/sales/invoices" element={<LayoutWrapper currentPageName="Invoices"><Invoices /></LayoutWrapper>} />
      <Route path="/sales/clients" element={<LayoutWrapper currentPageName="SalesClients"><SalesClients /></LayoutWrapper>} />
      <Route path="/sales/settings" element={<LayoutWrapper currentPageName="SalesSettings"><SalesSettings /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App