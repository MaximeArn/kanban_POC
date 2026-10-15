<script setup lang="ts">
import type { DropState, Lane, LaneKind } from '~/composables/useKanban';

const props = defineProps<{
	lane: Lane;
	collapsed: boolean;
	/** Dépôt sur l'en-tête : replanifie le dossier dans cette ligne sans changer d'étape. */
	headerDropState: DropState;
}>();

const emit = defineEmits<{
	toggle: [key: string];
	drop: [id: string];
}>();

const { isOver, handlers } = useDropZone(
	() => props.headerDropState === 'allowed',
	(id) => emit('drop', id),
);

/** Précision affichée après le compteur, par type de ligne. */
const HINTS: Record<LaneKind, string> = {
	late: 'Dossier non validés avant CSDA visé',
	current: 'Inclut les DDS sans J0.8, en « A pré-qualifier »',
	upcoming: '',
	done: 'Archive des dossiers validés · « ← » ou glisser une carte pour l’invalider',
};
</script>

<template>
	<section
		class="lane"
		:class="[`is-${lane.kind}`, { 'is-collapsed': collapsed }]"
		:aria-labelledby="`lane-title-${lane.key}`"
	>
		<!--
			Barre de titre pleine largeur, cliquable partout pour replier / déplier ; son contenu
			reste visible au défilement horizontal. Au clavier, c'est le bouton du titre : son
			clic remonte jusqu'ici (il n'a pas de gestionnaire propre, la ligne ne bascule qu'une fois).
		-->
		<div class="lane-bar" @click="emit('toggle', lane.key)">
			<header
				class="lane-header"
				:class="{
					'is-allowed': headerDropState === 'allowed',
					'is-inactive': headerDropState === 'inactive',
					'is-over': isOver,
				}"
				v-on="handlers"
			>
				<h2 :id="`lane-title-${lane.key}`" class="lane-title">
					<button
						type="button"
						class="lane-toggle"
						:aria-expanded="!collapsed"
						:aria-controls="`lane-cells-${lane.key}`"
					>
						<span class="lane-chevron" aria-hidden="true">{{ collapsed ? '▸' : '▾' }}</span>
						<span v-if="lane.kind === 'late'" class="lane-icon" aria-hidden="true">⚠</span>
						<span v-else-if="lane.kind === 'done'" class="lane-icon" aria-hidden="true"
							>✓</span
						>
						{{ lane.label }}
						<span v-if="lane.dates" class="lane-dates">{{ lane.dates }}</span>
					</button>
				</h2>
				<span class="lane-count"
					>{{ lane.count }} dossier{{ lane.count > 1 ? 's' : '' }}</span
				>
				<span v-if="HINTS[lane.kind]" class="lane-hint">· {{ HINTS[lane.kind] }}</span>
				<span v-if="headerDropState === 'allowed'" class="lane-drop-hint">
					Déposer ici pour replanifier
				</span>
			</header>
		</div>

		<div v-show="!collapsed" :id="`lane-cells-${lane.key}`" class="lane-cells">
			<slot />
		</div>
	</section>
</template>

<style scoped>
/* Chaque ligne est un panneau blanc bordé : les lignes se distinguent nettement. */
.lane {
	display: flex;
	flex-direction: column;
	border: 1px solid var(--border);
	border-radius: 12px;
	background: var(--surface);
	box-shadow: var(--shadow-sm);
}

/* Barre de titre du panneau, teintée selon le type de ligne. */
.lane-bar {
	padding: 6px 12px;
	border-bottom: 1px solid var(--border);
	border-radius: 11px 11px 0 0;
	background: var(--lane-bar-bg);
	cursor: pointer;
	transition: background-color 0.15s;
}

/* Toute la barre réagit au survol : elle replie / déplie la ligne. */
.lane-bar:hover {
	background: color-mix(in srgb, var(--encre) 5%, var(--lane-bar-bg));
}

.lane.is-collapsed .lane-bar {
	border-bottom: 0;
	border-radius: 11px;
}

/* « En retard » doit se repérer d'un coup d'œil : barre franchement rosée, soulignée de rouge. */
.is-late .lane-bar {
	border-bottom-color: color-mix(in srgb, var(--warning) 45%, var(--border));
	background: color-mix(in srgb, var(--warning) 16%, var(--surface));
}

.is-late .lane-bar:hover {
	background: color-mix(in srgb, var(--warning) 22%, var(--surface));
}

/* Le gris atténué manquerait de contraste sur la barre rosée. */
.is-late .lane-hint {
	color: var(--text);
}

.is-late .lane-chevron {
	color: var(--warning);
}

/*
 * Reste visible lors du défilement horizontal du board. Le collage se mesure depuis le
 * bord intérieur du board (marge déjà exclue) : décalage = bordure du panneau + retrait de la barre.
 */
.lane-header {
	position: sticky;
	left: 13px;
	display: flex;
	align-items: center;
	gap: 10px;
	width: fit-content;
	padding: 2px 8px 2px 2px;
	border: 2px solid transparent;
	border-radius: 8px;
	transition:
		opacity 0.15s,
		background-color 0.15s,
		border-color 0.15s;
}

/* Même intensité que pour les cellules : zone possible bien visible, survol en trait plein. */
.lane-header.is-allowed {
	border-color: var(--accent);
	border-style: dashed;
	background: var(--accent-bg);
}

.lane-header.is-over {
	border-style: solid;
	background: color-mix(in srgb, var(--accent) 18%, transparent);
}

/* Sur le fond vert de dépôt, le gris atténué manquerait de contraste. */
.lane-header.is-allowed .lane-dates,
.lane-header.is-allowed .lane-count,
.lane-header.is-allowed .lane-hint {
	color: var(--text);
}

.lane-header.is-inactive {
	opacity: 0.3;
}

.lane-drop-hint {
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--accent);
	pointer-events: none;
}

.lane-title {
	margin: 0;
	font-size: 0.875rem;
	font-weight: 700;
}

.lane-toggle {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 4px 8px 4px 4px;
	border: 1px solid transparent;
	border-radius: 6px;
	background: none;
	font: inherit;
	color: var(--text-h);
	cursor: pointer;
}

.lane-toggle:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 1px;
}

.lane-chevron {
	width: 1em;
	color: var(--text-muted);
}

.is-late .lane-toggle {
	color: var(--warning);
}

.is-done .lane-toggle {
	color: var(--text);
}

/* Dates en complément du libellé relatif, plus discrètes. */
.lane-dates {
	margin-left: 4px;
	font-weight: 500;
	color: var(--text-muted);
}

.lane-count {
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--text-muted);
}

.is-late .lane-count {
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--warning-bg);
	color: var(--warning);
}

.lane-hint {
	font-size: 0.75rem;
	color: var(--text-muted);
}

.lane-cells {
	display: grid;
	/* Pistes partagées avec la barre des titres (cf. KanbanBoard, filtre Phase). */
	grid-template-columns: var(--board-columns);
	align-items: stretch;
}

/*
 * Archive « Terminés » : son contenu (cf. KanbanBoard) n'utilise pas les colonnes.
 */
.is-done .lane-cells {
	display: block;
}
</style>
