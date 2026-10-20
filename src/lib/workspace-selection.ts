let selectedOrganization: string | undefined;
export function selectOrganization(id: string) { selectedOrganization = id; }
export function selectedOrganizationId() { return selectedOrganization; }
export function clearOrganization() { selectedOrganization = undefined; }