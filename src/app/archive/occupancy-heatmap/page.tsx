import AppLayout from '@/components/AppLayout';
import OccupancyHeatmapContent from './components/OccupancyHeatmapContent';

export default function OccupancyHeatmapPage() {
  return (
    <AppLayout currentPath="/archive/occupancy-heatmap">
      <OccupancyHeatmapContent />
    </AppLayout>
  );
}
