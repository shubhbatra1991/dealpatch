import type { Account } from "../../domain/accounts/account";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Favorite, FavoriteEntityType } from "../../domain/favorites/favorite";
import { dealHref } from "../deals/deal-detail-model";

export const favoriteTypeLabels: Record<FavoriteEntityType, string> = { account: "Account", contact: "Contact", deal: "Deal" };
export interface FavoriteRecord { favorite: Favorite; name: string; href?: string }

export function resolveFavorites(favorites: Favorite[], accounts: Account[], contacts: Contact[], deals: Deal[]): FavoriteRecord[] {
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  const contactNames = new Map(contacts.map(contact => [contact.id, `${contact.firstName} ${contact.lastName}`]));
  const dealNames = new Map(deals.map(deal => [deal.id, deal.title]));
  return favorites.map(favorite => {
    const names = favorite.entityType === "account" ? accountNames : favorite.entityType === "contact" ? contactNames : dealNames;
    const name = names.get(favorite.entityId);
    const id = encodeURIComponent(favorite.entityId);
    const href = favorite.entityType === "account" ? `/workspace/accounts/${id}` : favorite.entityType === "contact" ? `/workspace/contacts/${id}` : dealHref(favorite.entityId);
    return { favorite, name: name ?? `Unavailable ${favorite.entityType}`, href: name === undefined ? undefined : href };
  });
}
