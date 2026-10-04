import { NextResponse } from 'next/server';
import { getApiDocs } from '@/lib/swagger';

/**
 * Raw OpenAPI spec for this app's custom API routes, for import into
 * Postman/Insomnia or codegen tools. See /api-docs for the browsable UI.
 */
export async function GET() {
  const spec = getApiDocs();
  return NextResponse.json(spec);
}
