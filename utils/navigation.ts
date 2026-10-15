export enum ViewId {
	Dashboard = 'dashboard',
	Dds = 'dds',
	Ceda = 'ceda',
	Datm = 'datm',
	CsdaPrep = 'csda-prep',
	Csda = 'csda',
	Cockpit = 'cockpit',
	Commandes = 'commandes',
	Externalisation = 'externalisation',
	Pdc = 'pdc',
	Referentiels = 'referentiels',
	Habilitations = 'habilitations',
	Reporting = 'reporting',
}

export interface NavItem {
	id: ViewId;
	label: string;
	icon: string; // Nom d'icône Material Symbols
	mascotte: string; // Mascotte affichée dans le bandeau (fichier de public/mascottes).
}

export const NAV_ITEMS: readonly NavItem[] = [
	{ id: ViewId.Dashboard, label: 'Tableau de bord', icon: 'home', mascotte: '02' },
	{ id: ViewId.Ceda, label: 'CEDA', icon: 'groups', mascotte: '11' },
	{ id: ViewId.Dds, label: 'DDS', icon: 'assignment', mascotte: '06' },
	{ id: ViewId.Datm, label: 'Revue DATM', icon: 'fact_check', mascotte: '08' },
	{
		id: ViewId.CsdaPrep,
		label: 'CSDA / fin de Cadrage',
		icon: 'event_upcoming',
		mascotte: '01',
	},
	{ id: ViewId.Csda, label: 'CSDA', icon: 'gavel', mascotte: '19' },
	{ id: ViewId.Cockpit, label: 'Cockpit', icon: 'work', mascotte: '04' },
	{ id: ViewId.Cockpit, label: 'Commandes CDS', icon: 'receipt_long', mascotte: '09' },
	{
		id: ViewId.Externalisation,
		label: 'Externalisation CDS',
		icon: 'swap_horiz',
		mascotte: '14',
	},
	{ id: ViewId.Pdc, label: 'Plan de charge', icon: 'calendar_month', mascotte: '16' },
	{ id: ViewId.Referentiels, label: 'Référentiels', icon: 'storage', mascotte: '17' },
	{ id: ViewId.Habilitations, label: 'Habilitations', icon: 'lock', mascotte: '18' },
	{ id: ViewId.Reporting, label: 'Reporting Domaine', icon: 'summarize', mascotte: '03' },
];

export function getNavItem(id: string): NavItem | undefined {
	return NAV_ITEMS.find((item) => item.id === id);
}

export function pageTitle(title?: string | null): string {
	return title ? `${title} · Usine de Pilotage` : 'Usine de Pilotage';
}
