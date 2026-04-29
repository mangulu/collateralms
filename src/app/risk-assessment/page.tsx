import AppLayout from '@/components/AppLayout';
import RiskAssessmentContent from './components/RiskAssessmentContent';

export const metadata = {
  title: 'AI Risk Assessment | CollateralMS',
  description: 'OpenAI-powered collateral risk assessment for perfection risk, BRELA deadline risk, and fraud indicators',
};

export default function RiskAssessmentPage() {
  return (
    <AppLayout currentPath="/risk-assessment">
      <RiskAssessmentContent />
    </AppLayout>
  );
}
