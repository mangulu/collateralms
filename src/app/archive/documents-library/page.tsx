import AppLayout from '@/components/AppLayout';
import DocumentsLibraryContent from './components/DocumentsLibraryContent';

export default function DocumentsLibraryPage() {
  return (
    <AppLayout currentPath="/archive/documents-library">
      <DocumentsLibraryContent />
    </AppLayout>
  );
}
