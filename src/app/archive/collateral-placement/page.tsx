import AppLayout from '@/components/AppLayout';
import CollateralPlacementContent from './components/CollateralPlacementContent';

export default function CollateralPlacementPage() {
  return (
    <AppLayout currentPath="/archive/collateral-placement">
      <CollateralPlacementContent />
    </AppLayout>
  );
}
