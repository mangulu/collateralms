'use client';
import AppLayout from '@/components/AppLayout';
import ObligorProfileContent from '../components/ObligorProfileContent';

interface Props {
  params: { id: string };
}

export default function ObligorProfilePage({ params }: Props) {
  return (
    <AppLayout currentPath="/obligors">
      <ObligorProfileContent id={params.id} />
    </AppLayout>
  );
}
