import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/lib/store';
import type { Customer } from '@/types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CustomerTable from '@/components/user/CustomerTable';
import CustomerProfile from '@/components/user/CustomerProfile';

// ─── Admin panels — lazy-loaded, never bundled into the non-admin path ─────────
import { lazy, Suspense } from 'react';
const OverviewPanel      = lazy(() => import('@/components/admin/OverviewPanel'));
const AlertFeed          = lazy(() => import('@/components/admin/AlertFeed'));
const UserBehaviourPanel = lazy(() => import('@/components/admin/UserBehaviourPanel'));
const UserManagementPanel = lazy(() => import('@/components/admin/UserManagementPanel'));
const ActivityLogPanel   = lazy(() => import('@/components/admin/ActivityLogPanel'));
const KycRequestsPanel   = lazy(() => import('@/components/admin/KycRequestsPanel'));
const LoanRequestsPanel  = lazy(() => import('@/components/admin/LoanRequestsPanel'));
const ChangeRequestsPanel = lazy(() => import('@/components/admin/ChangeRequestsPanel'));

const ADMIN_PANELS = ['overview', 'alerts', 'behaviour', 'usermgmt', 'activitylog', 'customers', 'kyc', 'loanreqs', 'changereqs'];
const ROLE_PANELS: Record<string, string[]> = {
  'Loan Officer':   ['customers', 'loanreqs'],
  'Branch Manager': ['customers', 'loanreqs'],
  'Teller':         ['customers', 'changereqs'],
};

function AdminPanelLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Dashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const { currentUser } = state;

  // Always default to 'customers'; only admins can switch to other panels
  const [activePanel, setActivePanel] = useState('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Determine allowed panels based on role
  const userRole = currentUser?.role ?? '';
  const isAdmin: boolean = currentUser?.isAdmin === true;
  const allowedPanels: string[] = isAdmin
    ? ADMIN_PANELS
    : ROLE_PANELS[userRole] ?? ['customers'];

  // Once we know the user is admin, default them to overview
  useEffect(() => {
    if (currentUser?.isAdmin) {
      setActivePanel(prev => prev === 'customers' ? 'overview' : prev);
    } else {
      // Force non-admins to first allowed panel
      setActivePanel(prev => allowedPanels.includes(prev) ? prev : allowedPanels[0]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) navigate('/');
  }, [currentUser, navigate]);

  if (!currentUser) return null;

  const handlePanelChange = (id: string) => {
    if (!allowedPanels.includes(id)) return;       // block disallowed panels
    setActivePanel(id);
  };

  const handleSelectCustomer = (customer: Customer) => setSelectedCustomer(customer);

  // ── Render panel based on allowed access ────────────────────────────────────
  const renderPanel = () => {
    switch (activePanel) {
      case 'overview':    return isAdmin ? <OverviewPanel /> : null;
      case 'alerts':      return isAdmin ? <AlertFeed /> : null;
      case 'behaviour':   return isAdmin ? <UserBehaviourPanel /> : null;
      case 'usermgmt':    return isAdmin ? <UserManagementPanel /> : null;
      case 'activitylog': return isAdmin ? <ActivityLogPanel /> : null;
      case 'kyc':         return isAdmin ? <KycRequestsPanel /> : null;
      case 'loanreqs':    return (isAdmin || userRole === 'Loan Officer' || userRole === 'Branch Manager') ? <LoanRequestsPanel /> : null;
      case 'changereqs':   return (isAdmin || userRole === 'Teller') ? <ChangeRequestsPanel /> : null;
      case 'customers':   return <CustomerTable onSelectCustomer={handleSelectCustomer} />;
      default:            return isAdmin ? <OverviewPanel /> : <CustomerTable onSelectCustomer={handleSelectCustomer} />;
    }
  };

  return (
    <DashboardLayout activePanel={activePanel} onPanelChange={handlePanelChange}>
      <Suspense fallback={<AdminPanelLoader />}>
        {renderPanel()}
      </Suspense>
      {selectedCustomer && activePanel === 'customers' && (
        <CustomerProfile customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </DashboardLayout>
  );
}
