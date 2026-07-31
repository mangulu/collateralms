import { Metadata } from 'next';
import CustodyContent from './components/CustodyContent';

export const metadata: Metadata = {
  title: 'Custody',
};

export default function CustodyPage() {
  return <CustodyContent />;
}
