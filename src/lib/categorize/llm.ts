import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_TAXONOMY, type CategoryKey } from "./categories";

const anthropic = new Anthropic();

const VALID_CATEGORY_IDS = new Set(Object.keys(CATEGORY_TAXONOMY));

interface UncategorizedTransaction {
  id: string;
  description: string;
  amountCents: number;
  type: "income" | "expense" | "transfer";
  counterpartyName?: string;
  counterpartyIban?: string;
}

interface LLMCategorization {
  id: string;
  categoryId: string;
  confidence: number;
}

/**
 * Extract JSON array from potentially messy LLM response.
 * Tries: direct parse -> strip fences -> bracket extraction.
 */
function extractJSON(text: string): LLMCategorization[] | null {
  // 1. Direct parse
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // continue
  }

  // 2. Strip markdown fences
  try {
    const stripped = text.replace(/```(?:json)?\n?|```/g, "").trim();
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // continue
  }

  // 3. Find [...] brackets
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  return null;
}

/**
 * Validate and sanitize LLM results against known category IDs and input transaction IDs.
 */
function validateResults(
  results: LLMCategorization[],
  inputIds: Set<string>
): LLMCategorization[] {
  return results
    .filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        inputIds.has(r.id) &&
        typeof r.categoryId === "string" &&
        typeof r.confidence === "number"
    )
    .map((r) => ({
      id: r.id,
      categoryId: VALID_CATEGORY_IDS.has(r.categoryId)
        ? r.categoryId
        : "cat_other",
      confidence: VALID_CATEGORY_IDS.has(r.categoryId)
        ? Math.max(0, Math.min(1, r.confidence))
        : 0.1,
    }));
}

function formatTxList(txs: UncategorizedTransaction[]): string {
  return txs
    .map((tx) => {
      const amount = (tx.amountCents / 100).toFixed(2);
      const counterparty = tx.counterpartyName
        ? ` | Counterparty: ${tx.counterpartyName}`
        : "";
      const iban = tx.counterpartyIban
        ? ` | IBAN: ${tx.counterpartyIban}`
        : "";
      return `[${tx.id}] ${tx.type} \u20AC${amount} | ${tx.description}${counterparty}${iban}`;
    })
    .join("\n");
}

/**
 * Batch-categorize transactions using Claude Haiku.
 * Sends up to 50 transactions per call to amortize prompt cost.
 * Includes layered JSON extraction, validation, and retry for missing IDs.
 */
export async function categorizeWithLLM(
  transactions: UncategorizedTransaction[],
  userContext?: string
): Promise<LLMCategorization[]> {
  const categoryList = Object.entries(CATEGORY_TAXONOMY)
    .map(([id, desc]) => `- ${id}: ${desc}`)
    .join("\n");

  const txList = formatTxList(transactions);

  const contextBlock = userContext
    ? `\n\nUSER'S PAST CATEGORIZATIONS (use these as examples):\n${userContext}`
    : "";

  const systemPrompt = `You are a financial transaction categorizer for Austrian bank accounts. Given a list of transactions, assign each one to exactly ONE category from the list below. Respond ONLY with a JSON array. No explanation, no markdown.

CATEGORIES:
${categoryList}

RULES:
- Use the transaction description, counterparty, and IBAN to determine the best category.
- If unsure, use "cat_other" with low confidence.
- confidence is 0.0 to 1.0 (your certainty).
- Austrian/German transaction descriptions are common.
- You MUST return a result for EVERY transaction ID provided.${contextBlock}

RESPONSE FORMAT (JSON array only):
[{"id":"...","categoryId":"cat_xxx","confidence":0.9},...]`;

  const inputIds = new Set(transactions.map((tx) => tx.id));

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Categorize these ${transactions.length} transactions:\n\n${txList}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // --- Layered extraction + validation ---
  const raw = extractJSON(text);
  if (!raw) {
    console.error("[LLM] Failed to extract JSON from response:", text.slice(0, 200));
    return transactions.map((tx) => ({
      id: tx.id,
      categoryId: "cat_other",
      confidence: 0.0,
    }));
  }

  const validated = validateResults(raw, inputIds);
  const returnedIds = new Set(validated.map((r) => r.id));
  const missingTxs = transactions.filter((tx) => !returnedIds.has(tx.id));

  // --- Retry missing transactions in a smaller batch ---
  if (missingTxs.length > 0 && missingTxs.length < transactions.length) {
    console.warn(
      `[LLM] Missing ${missingTxs.length}/${transactions.length} results, retrying...`
    );

    try {
      const retryList = formatTxList(missingTxs);
      const retryResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Categorize these ${missingTxs.length} transactions:\n\n${retryList}`,
          },
        ],
      });

      const retryText =
        retryResponse.content[0].type === "text"
          ? retryResponse.content[0].text
          : "";

      const retryRaw = extractJSON(retryText);
      if (retryRaw) {
        const retryValidated = validateResults(
          retryRaw,
          new Set(missingTxs.map((tx) => tx.id))
        );
        validated.push(...retryValidated);

        const stillMissing = missingTxs.filter(
          (tx) => !new Set(retryValidated.map((r) => r.id)).has(tx.id)
        );
        for (const tx of stillMissing) {
          validated.push({ id: tx.id, categoryId: "cat_other", confidence: 0.0 });
        }
      } else {
        for (const tx of missingTxs) {
          validated.push({ id: tx.id, categoryId: "cat_other", confidence: 0.0 });
        }
      }
    } catch (retryErr) {
      console.error("[LLM] Retry failed:", retryErr);
      for (const tx of missingTxs) {
        validated.push({ id: tx.id, categoryId: "cat_other", confidence: 0.0 });
      }
    }
  } else if (missingTxs.length === transactions.length) {
    // Complete failure — all missing
    return transactions.map((tx) => ({
      id: tx.id,
      categoryId: "cat_other",
      confidence: 0.0,
    }));
  }

  return validated;
}
