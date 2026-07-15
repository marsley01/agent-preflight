const VULN_ENGINE_URL = import.meta.env.VITE_VULN_ENGINE_URL || 'http://localhost:8412';

export interface AiFixResult {
  root_cause: string;
  coder_agent_prompt: string;
  verification_steps: string[];
  documentation_links: string[];
  model_used: string;
  source: string;
}

export interface AiFixRequest {
  error_log: string;
  affected_code: string;
  file_path: string;
  tech_stack: string;
}

export async function generateAiFix(params: AiFixRequest): Promise<AiFixResult> {
  const res = await fetch(`${VULN_ENGINE_URL}/v1/fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI fix engine returned ${res.status}: ${text}`);
  }
  return res.json();
}
