import AppLayout from '@/components/AppLayout';
import VaultManagementContent from './components/VaultManagementContent';

export default function VaultManagementPage() {
  return (
    <AppLayout currentPath="/archive/vault-management">
      <VaultManagementContent />
    </AppLayout>
  );
}
