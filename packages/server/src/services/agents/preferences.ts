import crypto from "node:crypto";

// ─── In-memory token store (replace with Neo4j for production) ───────────────

interface StoredToken {
  contactId: string;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
  expiresAt: Date;
  used: boolean;
}

const tokenStore = new Map<string, StoredToken>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  for (const [token, data] of tokenStore) {
    if (data.expiresAt < now || data.used) tokenStore.delete(token);
  }
}, 5 * 60 * 1000);

// ─── Public API ──────────────────────────────────────────────────────────────

export function generateToken(params: {
  contactId: string;
  companyName: string;
  contactName: string;
  email: string;
  role: string;
}): { token: string; expiresAt: Date; url: string } {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  tokenStore.set(token, {
    contactId: params.contactId,
    companyName: params.companyName,
    contactName: params.contactName,
    email: params.email,
    role: params.role,
    expiresAt,
    used: false,
  });

  return {
    token,
    expiresAt,
    url: `/preferences/${params.contactId}/${token}`,
  };
}

export function validateToken(token: string, contactId: string): {
  valid: boolean;
  companyName?: string;
  areasOfInterest?: string[];
} {
  const stored = tokenStore.get(token);
  if (!stored) return { valid: false };
  if (stored.contactId !== contactId) return { valid: false };
  if (stored.expiresAt < new Date()) return { valid: false };
  if (stored.used) return { valid: false };

  return {
    valid: true,
    companyName: stored.companyName,
    areasOfInterest: [
      "Bulk proteins",
      "Antibodies",
      "Latex particles",
      "Blockers",
      "Custom formulation",
    ],
  };
}

export function consumeToken(token: string): StoredToken | null {
  const stored = tokenStore.get(token);
  if (!stored) return null;
  if (stored.used) return null;
  stored.used = true;
  return stored;
}
