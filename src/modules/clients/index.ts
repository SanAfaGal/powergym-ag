export { clientSchema, type ClientInput } from "./schema";
export {
  listClients,
  getClient,
  listDocumentTypes,
  listGenderTypes,
  type Client,
  type CatalogEntry,
} from "./queries";
export { createClient, updateClient, setClientActive } from "./actions";
export { ClientForm } from "./components/ClientForm";
export { ClientList } from "./components/ClientList";
export { ClientFilters } from "./components/ClientFilters";
export { Pager } from "./components/Pager";
export { StatusBadge } from "@/components/shared/StatusBadge";
export { ContactLinks } from "./components/ContactLinks";
export { EditClientDialog } from "./components/EditClientDialog";
export { DeactivateClientDialog } from "./components/DeactivateClientDialog";
export { ClientInfoSidebar } from "./components/ClientInfoSidebar";
