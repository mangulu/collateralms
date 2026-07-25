import ObligorProfileContent from '../components/ObligorProfileContent';

interface Props {
  params: { id: string };
}

export default function ObligorProfilePage({ params }: Props) {
  return <ObligorProfileContent id={params.id} />;
}
