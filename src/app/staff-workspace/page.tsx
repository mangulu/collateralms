import { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';
import StaffWorkspaceContent from './components/StaffWorkspaceContent';

export const metadata: Metadata = {
  title: 'Staff Workspace | ContentPro Collateral',
  description: 'Unified view of all assigned tasks across workflows',
};

export default function StaffWorkspacePage() {
  return (
    <AppLayout>
      <StaffWorkspaceContent />
    </AppLayout>
  );
}
