import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import KeepAlive from './components/KeepAlive';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// ─── Lazy Load Pages ──────────────────────────────────────────────
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const InquiriesList = lazy(() => import('./pages/InquiriesList'));
const NewInquiry = lazy(() => import('./pages/NewInquiry'));
const InquiryDetail = lazy(() => import('./pages/InquiryDetail'));
const EditInquiry = lazy(() => import('./pages/EditInquiry'));
const BorrowerPipeline = lazy(() => import('./pages/BorrowerPipeline'));
const InvestorPipeline = lazy(() => import('./pages/InvestorPipeline'));
const Agents = lazy(() => import('./pages/Agents'));
const Documents = lazy(() => import('./pages/Documents'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

const InvestorInquiries = lazy(() => import('./pages/InvestorInquiries'));
const InvestorBorrowed = lazy(() => import('./pages/InvestorBorrowed'));
const InvestorPayments = lazy(() => import('./pages/InvestorPayments'));
const BorrowerInquiries = lazy(() => import('./pages/BorrowerInquiries'));
const BorrowerLended = lazy(() => import('./pages/BorrowerLended'));
const BorrowerCollections = lazy(() => import('./pages/BorrowerCollections'));
const ProfitDashboard = lazy(() => import('./pages/ProfitDashboard'));

// Simple loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <KeepAlive />
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/inquiries" element={<InquiriesList />} />
                        <Route path="/inquiries/new" element={<NewInquiry />} />
                        <Route path="/inquiries/:id" element={<InquiryDetail />} />
                        <Route path="/inquiries/:id/edit" element={<EditInquiry />} />
                        <Route path="/borrower-pipeline" element={<BorrowerPipeline />} />
                        <Route path="/investor-pipeline" element={<InvestorPipeline />} />
                        <Route path="/agents" element={<Agents />} />
                        <Route path="/documents" element={<Documents />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/settings" element={<Settings />} />

                        <Route path="/investor/inquiries" element={<InvestorInquiries />} />
                        <Route path="/investor/borrowed" element={<InvestorBorrowed />} />
                        <Route path="/investor/payments" element={<InvestorPayments />} />

                        <Route path="/borrower/inquiries" element={<BorrowerInquiries />} />
                        <Route path="/borrower/lended" element={<BorrowerLended />} />
                        <Route path="/borrower/collections" element={<BorrowerCollections />} />

                        <Route path="/profit" element={<ProfitDashboard />} />

                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
