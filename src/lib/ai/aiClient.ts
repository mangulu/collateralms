const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callAIEndpoint(endpoint: string, payload: object) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);

        if (attempt < MAX_RETRIES) {
          console.warn(`Rate limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }

        throw new Error(
          'OpenAI quota exceeded. Your account has reached its usage limit. ' + 'Please visit https://platform.openai.com/account/billing to add credits or upgrade your plan.'
        );
      }

      if (!response.ok || data.error) {
        console.error('API Route Error:', {
          error: data.error,
          details: data.details,
        });
        throw new Error(data.error || `Request failed: ${response.status}`);
      }

      return data;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('OpenAI quota exceeded')
      ) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Request failed. Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      console.error('API request error:', error);
      throw lastError;
    }
  }

  throw lastError || new Error('Request failed after maximum retries');
}
