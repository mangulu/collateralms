import { Metadata } from 'next';
import AccessRequestsContent from './components/AccessRequestsContent';

export const metadata: Metadata = {
  title: 'Access Requests',
};

export default function AccessRequestsPage() {
  return <AccessRequestsContent />;
}
