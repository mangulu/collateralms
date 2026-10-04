import React from 'react';
import { getApiDocs } from '@/lib/swagger';
import ApiDocsClient from './components/ApiDocsClient';

export default async function ApiDocsPage() {
  const spec = getApiDocs();
  return <ApiDocsClient spec={spec} />;
}
