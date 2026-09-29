// Shared, browser-safe labels. Never expose upstream API errors or credentials.
export const roles: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
  VIEWER: "Lecture seule",
};
export const connectionErrors: Record<string, string> = {
  shop_limit_or_owner:
    "Cette connexion a été bloquée par la limite de boutiques ou par un rattachement existant. Réessayez pour afficher le motif précis ; ne créez pas de nouvelle clé API.",
  invalid_shop:
    "Saisissez le domaine Shopify de votre boutique, par exemple ma-boutique.myshopify.com. Vous le trouverez dans Shopify → Paramètres → Domaines.",
  shop_limit:
    "Vous avez atteint le nombre de boutiques autorisées. Vous pouvez toujours ouvrir ou reconnecter vos boutiques existantes.",
  shop_unassigned:
    "Cette boutique provient d’un ancien compte Stockify. Son rattachement nécessite une vérification par l’administrateur ; aucune donnée n’a été déplacée.",
  shop_owned:
    "Cette boutique est déjà associée à un autre espace Stockify. Connectez-vous au compte qui la gère ou contactez l’administrateur.",
  workspace_unavailable:
    "Vous ne pouvez pas connecter de boutique dans cet espace. Vérifiez que vous êtes propriétaire et que l’espace est actif.",
  invalid_state:
    "La demande de connexion a expiré. Recommencez avec le bouton « Connecter Shopify » ci-dessous.",
  shop_mismatch:
    "La boutique autorisée ne correspond pas à la demande. Recommencez la connexion depuis cet espace.",
  invalid_callback:
    "L’autorisation Shopify n’a pas abouti. Relancez la connexion et validez les autorisations dans Shopify.",
  oauth_failed:
    "La connexion Shopify n’a pas abouti. Réessayez. Si le problème persiste, contactez l’administrateur Stockify.",
  configuration:
    "La connexion Shopify n’est pas encore configurée sur ce serveur. L’administrateur Stockify doit terminer sa configuration.",
  unauthorized:
    "Votre accès à cette boutique n’est pas disponible. Choisissez une autre boutique ou contactez le propriétaire.",
};
export function connectionError(code?: string) {
  return code ? connectionErrors[code] || connectionErrors.oauth_failed : null;
}
export class ShopLinkError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function defaultShopLimit() {
  const n = Number(process.env.STOCKIFY_FREE_SHOP_LIMIT || 1);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 1;
}
