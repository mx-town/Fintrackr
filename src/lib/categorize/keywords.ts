interface KeywordRule {
  pattern: RegExp;
  categoryId: string;
  confidence: number;
}

/**
 * Keyword/regex patterns for categorization.
 * Handles ~25% of remaining transactions.
 * Patterns are bilingual (German + English).
 */
export const KEYWORD_RULES: KeywordRule[] = [
  // Groceries
  {
    pattern: /supermarkt|lebensmittel|markt/i,
    categoryId: "cat_groceries",
    confidence: 0.85,
  },

  // Dining
  {
    pattern:
      /restaurant|pizz|sushi|kebab|asia|wok|grill|imbiss|gasthaus|wirtshaus/i,
    categoryId: "cat_dining",
    confidence: 0.8,
  },

  // Transport
  {
    pattern: /tankstelle|benzin|diesel|parken|parking|garage|maut|toll/i,
    categoryId: "cat_transport",
    confidence: 0.85,
  },

  // Public transit
  {
    pattern: /verkehrsbetrieb|stadtwerke|bahn|bus|tram/i,
    categoryId: "cat_public",
    confidence: 0.85,
  },

  // Utilities
  {
    pattern: /strom|energie|gas|heizung|fernw\u00E4rme|wasser|kanal/i,
    categoryId: "cat_utilities",
    confidence: 0.9,
  },

  // Insurance
  {
    pattern:
      /versicherung|insurance|allianz|uniqa|generali|wiener st\u00E4dtische/i,
    categoryId: "cat_housing",
    confidence: 0.85,
  },

  // Health / pharmacy
  {
    pattern:
      /apotheke|pharmacy|arzt|doctor|ordination|labor|krankenhaus|hospital/i,
    categoryId: "cat_health",
    confidence: 0.9,
  },

  // Education
  {
    pattern:
      /universit\u00E4t|hochschule|fachhochschule|kurs|course|udemy|skillshare/i,
    categoryId: "cat_education",
    confidence: 0.85,
  },

  // Subscriptions
  {
    pattern: /abo|subscription|monatl|monthly|membership|mitglied/i,
    categoryId: "cat_subscriptions",
    confidence: 0.7,
  },

  // ATM
  {
    pattern: /bankomat|bargeld|atm|cash|auszahlung/i,
    categoryId: "cat_other",
    confidence: 0.6,
  },

  // Salary / income
  {
    pattern:
      /gehalt|lohn|salary|bez\u00FCge|gutschrift|r\u00FCckerstattung|refund/i,
    categoryId: "cat_income",
    confidence: 0.9,
  },

  // Rent
  {
    pattern: /miete|rent|pacht|wohnbau/i,
    categoryId: "cat_rent",
    confidence: 0.9,
  },

  // Savings / investment
  {
    pattern:
      /sparplan|etf|depot|wertpapier|investment|kapital|flatex|trade republic/i,
    categoryId: "cat_savings",
    confidence: 0.85,
  },

  // Bank fees
  {
    pattern:
      /spesen|geb\u00FChr|provision|entgelt|fee|charge|kontof\u00FChrung/i,
    categoryId: "cat_fees",
    confidence: 0.85,
  },
];

/**
 * Match transaction description against keyword patterns.
 * Returns first match (rules are ordered by specificity).
 */
export function matchKeywords(
  description: string
): { categoryId: string; confidence: number } | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(description)) {
      return { categoryId: rule.categoryId, confidence: rule.confidence };
    }
  }
  return null;
}
