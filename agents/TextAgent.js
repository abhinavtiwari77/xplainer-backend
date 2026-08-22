const { AzureOpenAI } = require("openai");
const BaseAgent = require('./BaseAgent');
const { SYSTEM_PROMPT } = require('./prompt');

/**
 * Guarantees the response shape instead of hoping the prose rules held.
 *
 * Under plain `json_object` a malformed reply used to slip through the
 * controller's `steps || explanationData` fallback and produce a successful but
 * empty video.
 */
const RESPONSE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'lesson',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['steps'],
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['writeOnWhiteBoard', 'speak', 'imagePrompt'],
            properties: {
              writeOnWhiteBoard: { type: 'string' },
              speak: { type: 'string' },
              imagePrompt: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['prompt', 'artStylePreset', 'artStylePrompt', 'stylePrompt'],
                    properties: {
                      prompt: { type: 'string' },
                      artStylePreset: { type: 'string', enum: ['3D', 'illustration', 'chalkboard', 'neon'] },
                      artStylePrompt: { type: 'string' },
                      stylePrompt: { type: 'string' },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
};

class TextAgent extends BaseAgent {
  constructor() {
    super();

    // Read from the environment. The key used to be a literal in this file,
    // which meant .gitignore never protected it — treat that old key as
    // compromised and rotate it.
    const apiKey = process.env.OPENAI_APIKEY;
    const endpoint = process.env.OPENAI_ENDPOINT;

    if (!apiKey || !endpoint) {
      throw new Error('TextAgent: OPENAI_APIKEY and OPENAI_ENDPOINT must be set in the environment.');
    }

    this.deployment = process.env.OPENAI_DEPLOYMENT || 'gpt-5-mini';
    this.client = new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion: process.env.OPENAI_API_VERSION || '2024-12-01-preview',
      deployment: this.deployment,
    });
  }

  async request(prompt, responseFormat) {
    const completion = await this.client.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      model: this.deployment,
      temperature: 1,
      // Boards are terser now but narration is richer, and slide counts are
      // higher, so the old 8192 ceiling truncated longer lessons mid-JSON.
      max_completion_tokens: 16384,
      top_p: 1,
      response_format: responseFormat,
      stream: false,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw new Error('TextAgent: model returned an empty response.');
    return JSON.parse(raw);
  }

  async process(prompt) {
    try {
      return await this.request(prompt, RESPONSE_SCHEMA);
    } catch (error) {
      // Not every deployment or API version accepts json_schema; fall back to
      // plain JSON mode rather than failing the whole request.
      const unsupported = /json_schema|response_format|unsupported|invalid_value|400/i.test(error?.message || '');
      if (!unsupported) {
        console.error('TextAgent Error:', error);
        throw error;
      }

      console.warn('TextAgent: json_schema unsupported here, falling back to json_object.');
      return this.request(prompt, { type: 'json_object' });
    }
  }
}

module.exports = TextAgent;
