import { Metadata } from 'next';
import AppLayout from '@/components/AppLayout';
import CreditPolicyReviewContent from './components/CreditPolicyReviewContent';

export const metadata: Metadata = {
  title: 'Credit Policy Review Workflow',
  description: 'Board-level annual credit policy review tracker with approval stages and BOT submission status',
};

export default function CreditPolicyReviewPage() {
  return (
    <AppLayout>
      <CreditPolicyReviewContent />
    </AppLayout>
  );
}
