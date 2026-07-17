export { clientSchema, type ClientInput } from "./schema";
export {
  listClients,
  listExpiringClients,
  getClient,
  listDocumentTypes,
  listGenderTypes,
  type Client,
  type ClientWithSubscription,
  type CatalogEntry,
  type SortOption,
  type ExpiringClient,
} from "./queries";
export { createClient, updateClient, setClientActive } from "./actions";
export { ClientForm } from "./components/ClientForm";
export { ClientList } from "./components/ClientList";
export { ClientFilters } from "./components/ClientFilters";
export { CopyExpiringButton } from "./components/CopyExpiringButton";
export { formatExpiringClientsSummary } from "./lib/formatExpiringClientsSummary";
export { Pager } from "@/components/shared/Pager";
export { StatusBadge } from "@/components/shared/StatusBadge";
export { ContactLinks } from "./components/ContactLinks";
export { EditClientDialog } from "./components/EditClientDialog";
export { DeactivateClientDialog } from "./components/DeactivateClientDialog";
export { ClientInfoSidebar } from "./components/ClientInfoSidebar";
