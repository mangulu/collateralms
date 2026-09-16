import { redirect } from 'next/navigation';

export default function TriggerProcessorAdminPage() {
  redirect('/workflows-admin/trigger-rules');
}
