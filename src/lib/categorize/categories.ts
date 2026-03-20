export type CategoryKey = keyof typeof CATEGORY_TAXONOMY;

/**
 * Flat taxonomy for AI prompt generation.
 * Maps category IDs to descriptions for the LLM.
 */
export const CATEGORY_TAXONOMY = {
  cat_income:
    "Income: salary, freelance payments, refunds, interest, dividends",
  cat_groceries:
    "Groceries: supermarkets, food stores (Billa, Spar, Hofer, Lidl, Merkur, Penny)",
  cat_dining: "Dining Out: restaurants, takeaway, delivery (Lieferando, Mjam)",
  cat_coffee: "Coffee & Bars: caf\u00E9s, bars, pubs",
  cat_transport:
    "Transportation: car-related, parking, tolls, ride-sharing (Uber, Bolt)",
  cat_public: "Public Transit: trains, buses, metro (Wiener Linien, \u00D6BB)",
  cat_fuel: "Gas & Fuel: gas stations (BP, Shell, OMV, Avanti)",
  cat_housing: "Housing: rent, mortgage, insurance",
  cat_rent: "Rent: monthly rent payments",
  cat_utilities:
    "Utilities: electricity, gas, water, heating (Wien Energie, EVN, Verbund)",
  cat_entertainment: "Entertainment: movies, concerts, games, streaming",
  cat_subscriptions:
    "Subscriptions: Netflix, Spotify, gym, software, phone plans",
  cat_shopping:
    "Shopping: clothing, electronics, Amazon, general retail",
  cat_health:
    "Health & Medical: pharmacy (Apotheke), doctor, insurance, gym",
  cat_education: "Education: courses, books, tuition, school supplies",
  cat_travel: "Travel: flights, hotels, vacation, Airbnb, Booking.com",
  cat_personal: "Personal Care: haircuts, cosmetics, hygiene",
  cat_savings:
    "Savings & Investments: transfers to savings, ETFs, stocks, crypto",
  cat_fees:
    "Fees & Charges: bank fees, ATM fees, penalties, interest payments",
  cat_other: "Other: anything that doesn't fit above",
} as const;
