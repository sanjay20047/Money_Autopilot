// Category definitions — colors follow the validated categorical palette
// used in the approved design mockup (fixed slot order, never cycled).

export type CategoryKey =
  | "food"
  | "transport"
  | "shopping"
  | "bills"
  | "entertainment"
  | "health"
  | "cash"
  | "investments"
  | "income"
  | "other";

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  color: string;
}

export const CATEGORIES: Record<CategoryKey, CategoryDef> = {
  food: { key: "food", label: "Food & dining", color: "#2a78d6" },
  transport: { key: "transport", label: "Transport", color: "#1baf7a" },
  shopping: { key: "shopping", label: "Shopping", color: "#eda100" },
  bills: { key: "bills", label: "Bills & utilities", color: "#008300" },
  entertainment: { key: "entertainment", label: "Entertainment", color: "#4a3aa7" },
  health: { key: "health", label: "Health", color: "#e34948" },
  cash: { key: "cash", label: "Cash / ATM", color: "#e87ba4" },
  investments: { key: "investments", label: "Investments", color: "#eb6834" },
  income: { key: "income", label: "Income", color: "#c3c2b7" },
  other: { key: "other", label: "Other", color: "#898781" },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export function categoryDef(key: string): CategoryDef {
  return CATEGORIES[key as CategoryKey] ?? CATEGORIES.other;
}

// ---------- merchant → category keyword rules ----------
// Checked in order; first hit wins. All matching is lowercase-substring.
const RULES: Array<{ keywords: string[]; category: CategoryKey }> = [
  {
    keywords: [
      "swiggy", "zomato", "dominos", "domino's", "kfc", "mcdonald", "pizza",
      "faasos", "eatsure", "biryani", "cafe", "restaurant", "starbucks",
      "dunkin", "subway", "barbeque", "hotel saravana", "a2b", "instamart",
      "blinkit", "zepto", "bigbasket", "grofers",
    ],
    category: "food",
  },
  {
    keywords: [
      "uber", "ola", "rapido", "irctc", "redbus", "abhibus", "metro",
      "petrol", "diesel", "hpcl", "bpcl", "iocl", "indianoil", "shell",
      "fastag", "parking", "makemytrip", "goibibo", "cleartrip", "indigo",
      "airasia", "spicejet", "vistara", "air india",
    ],
    category: "transport",
  },
  {
    keywords: [
      "amazon", "flipkart", "myntra", "ajio", "meesho", "croma", "reliance digital",
      "decathlon", "ikea", "nykaa", "tatacliq", "snapdeal", "lifestyle",
      "westside", "zudio", "max fashion", "shoppers stop",
    ],
    category: "shopping",
  },
  {
    keywords: [
      "electricity", "tneb", "tangedco", "bescom", "mseb", "torrent power",
      "jio", "airtel", "vodafone", " vi ", "bsnl", "broadband", "act fiber",
      "hathway", "dth", "tata play", "tatasky", "recharge", "gas", "indane",
      "hp gas", "water bill", "postpaid", "prepaid", "rent", "nobroker",
      "maintenance", "society",
    ],
    category: "bills",
  },
  {
    keywords: [
      "netflix", "spotify", "hotstar", "jiocinema", "sonyliv", "zee5",
      "bookmyshow", "district", "pvr", "inox", "prime video", "youtube",
      "playstation", "steam", "game",
    ],
    category: "entertainment",
  },
  {
    keywords: [
      "pharmacy", "pharmeasy", "1mg", "netmeds", "apollo", "medplus",
      "hospital", "clinic", "diagnostic", "lab", "practo", "cult.fit",
      "cultfit", "gym",
    ],
    category: "health",
  },
  {
    keywords: ["atm", "cash wdl", "cash withdrawal", "cwdr", "nfs"],
    category: "cash",
  },
  {
    keywords: [
      "groww", "zerodha", "upstox", "kite", "coin", "mutual fund", "sip",
      "bse limited", "nse clearing", "indian clearing", "iccl", "camspay",
      "kfintech", "nps trust", "ppf",
    ],
    category: "investments",
  },
  {
    keywords: ["salary", "sal credit", "payroll"],
    category: "income",
  },
];

export function categorize(merchant: string, body = ""): CategoryKey {
  const hay = `${merchant} ${body}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) return rule.category;
  }
  return "other";
}
