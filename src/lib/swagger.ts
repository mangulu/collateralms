import { createSwaggerSpec } from 'next-swagger-doc';

/**
 * Generates the OpenAPI spec for this app's custom Next.js API routes
 * (src/app/api/**). This does NOT cover the Supabase table-level REST API,
 * which Supabase documents separately — see the project's API settings page
 * for that auto-generated spec.
 *
 * None of these routes use runtime request validation (no zod or similar is
 * used anywhere in this codebase). The schemas below describe each route's
 * intended request shape, not an enforced contract.
 */
export function getApiDocs() {
  return createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'CollateralMS API',
        version: '1.0.0',
        description:
          'Custom server-side routes only — PDF/Excel report generation, email/SMS notification proxies to Supabase Edge Functions, an AI chat-completion proxy, cron jobs, and the workflow trigger processor. The app\'s core data access (collateral, obligors, loans, documents, etc.) goes directly from the browser to Supabase via RLS and is not represented here; see Supabase\'s own auto-generated REST API docs for that.\n\nNone of these routes perform runtime request validation — schemas below describe the shape each handler expects, not an enforced contract.',
      },
      components: {
        securitySchemes: {
          cronSecret: {
            type: 'http',
            scheme: 'bearer',
            description: 'Bearer token matching the CRON_SECRET environment variable. Used by pg_cron-triggered routes.',
          },
          triggerSecret: {
            type: 'apiKey',
            in: 'header',
            name: 'x-trigger-secret',
            description:
              'Must match the WORKFLOW_TRIGGER_SECRET environment variable, intended for a scheduler/cron caller. The app\'s own "Run Now" UI instead authenticates via the caller\'s Supabase session cookie, verified server-side — see the operation description for /api/workflow/trigger-processor.',
          },
        },
      },
    },
  });
}
