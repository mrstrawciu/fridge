const Anthropic = require('@anthropic-ai/sdk');

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      throw new Error('ANTHROPIC_API_KEY is not configured. Set it in .env file.');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', tier: 'opus' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'sonnet' },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', tier: 'haiku' },
];

async function callClaude({ model, systemPrompt, messages, temperature = 0.7, maxTokens = 4096 }) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock ? textBlock.text : '';
}

module.exports = { callClaude, AVAILABLE_MODELS, getClient };
