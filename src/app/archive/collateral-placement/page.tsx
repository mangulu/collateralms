import AppLayout from '@/components/AppLayout';
import CollateralFilingContent from './components/CollateralPlacementContent';

export default function CollateralFilingPage() {
  return (
    <AppLayout currentPath="/archive/collateral-placement">
      <CollateralFilingContent />
    </AppLayout>
  );
}
