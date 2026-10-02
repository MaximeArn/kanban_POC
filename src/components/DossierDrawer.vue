<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
	STAGES,
	TYPE_LABELS,
	availableMoves,
	getStage,
	isForward,
	stagePosition,
	stagesBetween,
	type Dossier,
	type HistoryEvent,
	type MoveOption,
	type StageId,
} from '../domain/workflow';
import { daysLate } from '../domain/periods';
import { formatDate, formatDateTime } from '../utils/format';

const props = defineProps<{
	dossier: Dossier;
	/** `YYYY-MM-DD` */
	today: string;
}>();

const emit = defineEmits<{
	close: [];
	move: [id: string, target: StageId];
	/** Nouvelle date de CSDA visé, `YYYY-MM-DD`. */
	reschedule: [id: string, date: string];
}>();

const title = ref<HTMLElement | null>(null);

const moves = computed(() => availableMoves(props.dossier));
const stage = computed(() => getStage(props.dossier.stage));
const position = computed(() => stagePosition(props.dossier.stage));
const delay = computed(() => daysLate(props.dossier, props.today));

/** Brouillon de date : appliqué seulement à la validation, pas à chaque frappe. */
const draftDate = ref(props.dossier.dateCsdaVisee);
watch(
	() => props.dossier.dateCsdaVisee,
	(date) => (draftDate.value = date),
);
const canApplyDate = computed(
	() => draftDate.value >= props.today && draftDate.value !== props.dossier.dateCsdaVisee,
);

function applyDate() {
	if (canApplyDate.value) emit('reschedule', props.dossier.id, draftDate.value);
}

/** Plus récent en premier. */
const timeline = computed(() =>
	props.dossier.historique
		.map((event, index) => ({ event, index, ...describeEvent(event) }))
		.reverse(),
);

// Focus sur le titre à l'ouverture et à chaque changement de dossier.
watch(
	() => props.dossier.id,
	async () => {
		await nextTick();
		title.value?.focus();
	},
	{ immediate: true },
);

async function moveTo(option: MoveOption) {
	if (!option.target || !option.allowed) return;
	emit('move', props.dossier.id, option.target);

	// Si le bouton actionné devient désactivé, le focus retombe sur <body> : on le garde dans le drawer.
	await nextTick();
	if (document.activeElement === document.body) title.value?.focus();
}

function describeEvent(event: HistoryEvent): { label: string; detail?: string } {
	if (event.kind === 'type') {
		return { label: `Type renseigné : ${TYPE_LABELS[event.type]}` };
	}
	if (event.kind === 'date') {
		return {
			label: 'CSDA visé replanifié',
			detail: `${formatDate(event.from)} → ${formatDate(event.to)}`,
		};
	}
	const to = getStage(event.to).label;
	if (event.from === null) {
		return { label: `Demande enregistrée`, detail: `Étape « ${to} »` };
	}
	if (!isForward(event.from, event.to)) {
		return { label: `Retour en « ${to} »` };
	}
	const skipped = stagesBetween(event.from, event.to);
	return {
		label: `Passage en « ${to} »`,
		detail: skipped.length
			? `Étape non réalisée : ${skipped.map((s) => s.label).join(', ')}`
			: undefined,
	};
}
</script>

<template>
	<aside class="drawer" aria-labelledby="drawer-title" @keydown.esc.stop="emit('close')">
		<header class="drawer-header">
			<div class="drawer-meta">
				<span class="drawer-id">{{ dossier.id }}</span>
				<span v-if="dossier.type" class="badge" :class="`badge-${dossier.type}`">
					{{ TYPE_LABELS[dossier.type] }}
				</span>
			</div>
			<button
				type="button"
				class="drawer-close"
				aria-label="Fermer le détail du dossier"
				@click="emit('close')"
			>
				✕
			</button>
			<h2 id="drawer-title" ref="title" class="drawer-title" tabindex="-1">
				{{ dossier.titre }}
			</h2>
		</header>

		<div class="drawer-body">
			<section class="section" aria-labelledby="drawer-progress">
				<h3 id="drawer-progress" class="section-title">Avancement</h3>

				<p class="progress-label">
					Étape {{ position }} sur {{ STAGES.length }} :
					<strong>{{ stage.label }}</strong>
				</p>
				<ol class="progress" aria-hidden="true">
					<li
						v-for="(s, i) in STAGES"
						:key="s.id"
						class="progress-step"
						:class="{
							'is-done': i < position - 1,
							'is-current': s.id === dossier.stage,
							'is-optional': s.optional,
						}"
						:title="s.label"
					/>
				</ol>

				<div class="actions">
					<button
						type="button"
						class="btn"
						:disabled="!moves.previous.allowed"
						:title="
							moves.previous.allowed
								? `Revenir à « ${moves.previous.label} »`
								: moves.previous.reason
						"
						@click="moveTo(moves.previous)"
					>
						← Étape précédente
					</button>
					<button
						type="button"
						class="btn btn-primary"
						:disabled="!moves.next.allowed"
						:title="
							moves.next.allowed ? `Passer à « ${moves.next.label} »` : moves.next.reason
						"
						@click="moveTo(moves.next)"
					>
						Étape suivante →
					</button>
				</div>
				<button
					v-for="shortcut in moves.shortcuts"
					:key="shortcut.target"
					type="button"
					class="btn btn-shortcut"
					@click="moveTo({ ...shortcut, allowed: true, reason: '' })"
				>
					{{ shortcut.forward ? '↷ Aller directement à' : '↶ Revenir à' }}
					{{ shortcut.label }}
				</button>
			</section>

			<section class="section" aria-labelledby="drawer-planning">
				<h3 id="drawer-planning" class="section-title">Planification du CSDA</h3>
				<form class="planning-date" @submit.prevent="applyDate">
					<label class="field">
						<span class="field-label">Date du CSDA visé</span>
						<input v-model="draftDate" type="date" :min="today" required />
					</label>
					<button type="submit" class="btn" :disabled="!canApplyDate">Replanifier</button>
				</form>
			</section>

			<section class="section" aria-labelledby="drawer-info">
				<h3 id="drawer-info" class="section-title">Informations</h3>
				<dl class="info">
					<div>
						<dt>Architecte solution</dt>
						<dd>{{ dossier.architecte }}</dd>
					</div>
					<div>
						<dt>Porteur</dt>
						<dd>{{ dossier.porteur }}</dd>
					</div>
					<div>
						<dt>Direction</dt>
						<dd>{{ dossier.direction }}</dd>
					</div>
					<div>
						<dt>CSDA visé</dt>
						<dd>
							<time :datetime="dossier.dateCsdaVisee">{{
								formatDate(dossier.dateCsdaVisee)
							}}</time>
							<span v-if="delay > 0" class="late">
								En retard de {{ delay }} jour{{ delay > 1 ? 's' : '' }}
							</span>
						</dd>
					</div>
					<div>
						<dt>Type</dt>
						<dd>
							<template v-if="dossier.type">{{ TYPE_LABELS[dossier.type] }}</template>
							<span v-else class="muted">Non renseigné</span>
						</dd>
					</div>
				</dl>
				<p class="description">{{ dossier.description }}</p>
			</section>

			<section class="section" aria-labelledby="drawer-history">
				<h3 id="drawer-history" class="section-title">Historique</h3>
				<ol class="timeline">
					<li v-for="item in timeline" :key="item.index" class="timeline-item">
						<time class="timeline-date" :datetime="item.event.at">{{
							formatDateTime(item.event.at)
						}}</time>
						<span class="timeline-label">{{ item.label }}</span>
						<span v-if="item.detail" class="timeline-detail">{{ item.detail }}</span>
					</li>
				</ol>
			</section>

			<section class="section" aria-labelledby="drawer-comments">
				<h3 id="drawer-comments" class="section-title">Commentaires</h3>
				<p class="muted">L’ajout de commentaires arrivera dans une prochaine version.</p>
			</section>
		</div>
	</aside>
</template>

<style scoped>
/* Superposé au board, sur toute la hauteur du viewport : aucun décalage des colonnes. */
.drawer {
	position: fixed;
	z-index: 10;
	top: 0;
	right: 0;
	bottom: 0;
	display: flex;
	flex-direction: column;
	width: min(600px, 100vw);
	background: var(--surface);
	border-left: 1px solid var(--border);
	box-shadow: var(--shadow-md);
}

.drawer-header {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 6px 12px;
	padding: 16px 20px 14px;
	border-bottom: 1px solid var(--border);
}

.drawer-meta {
	display: flex;
	align-items: center;
	gap: 8px;
}

.drawer-id {
	font-family: var(--mono);
	font-size: 0.8125rem;
	color: var(--text-muted);
}

.drawer-close {
	width: 32px;
	height: 32px;
	border: 1px solid transparent;
	border-radius: 6px;
	background: none;
	color: var(--text);
	font-size: 1rem;
	cursor: pointer;
}

.drawer-close:hover {
	border-color: var(--border);
	color: var(--text-h);
}

.drawer-title {
	grid-column: 1 / -1;
	margin: 0;
	font-size: 1.25rem;
	line-height: 1.3;
	color: var(--text-h);
}

.drawer-title:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
	border-radius: 2px;
}

.drawer-body {
	flex: 1;
	overflow-y: auto;
	padding: 4px 20px 24px;
}

.section {
	padding: 16px 0;
	border-bottom: 1px solid var(--border);
}

.section:last-child {
	border-bottom: 0;
}

.section-title {
	margin: 0 0 10px;
	font-size: 0.75rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.badge {
	padding: 1px 8px;
	border-radius: 999px;
	font-size: 0.6875rem;
	font-weight: 600;
	letter-spacing: 0.02em;
	text-transform: uppercase;
}

.badge-formel {
	color: var(--formel);
	background: var(--formel-bg);
}

.badge-declaratif {
	color: var(--declaratif);
	background: var(--declaratif-bg);
}

.progress-label {
	margin: 0 0 8px;
	font-size: 0.875rem;
}

.progress-label strong {
	color: var(--text-h);
}

.progress {
	display: flex;
	gap: 4px;
	margin: 0 0 14px;
	padding: 0;
	list-style: none;
}

.progress-step {
	flex: 1;
	height: 6px;
	border-radius: 3px;
	background: var(--column-bg);
}

.progress-step.is-optional {
	background: repeating-linear-gradient(
		90deg,
		var(--column-bg) 0 4px,
		transparent 4px 6px
	);
}

.progress-step.is-done {
	background: var(--accent-border);
}

.progress-step.is-current {
	background: var(--accent);
}

.actions {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 8px;
}

.btn {
	font: inherit;
	font-size: 0.8125rem;
	padding: 7px 10px;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--surface-2);
	color: var(--text-h);
	cursor: pointer;
}

.btn:hover:not(:disabled) {
	border-color: var(--accent);
}

.btn:focus-visible,
.drawer-close:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}

.btn:disabled {
	cursor: not-allowed;
	opacity: 0.45;
}

.btn-primary {
	border-color: var(--accent);
	background: var(--accent);
	color: var(--on-accent);
}

.btn-shortcut {
	width: 100%;
	margin-top: 8px;
	border-style: dashed;
	background: transparent;
	color: var(--text);
	text-align: left;
}

.planning-date {
	display: flex;
	align-items: flex-end;
	gap: 8px;
}

.field {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.field-label {
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--text-muted);
}

.field input {
	height: 34px;
	padding: 0 10px;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--surface);
	color: var(--text-h);
	font: inherit;
	font-size: 0.875rem;
	box-sizing: border-box;
}

.field input:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 1px;
}

.planning-date .btn {
	height: 34px;
}

.info {
	display: grid;
	gap: 8px;
	margin: 0;
}

.info div {
	display: grid;
	grid-template-columns: 140px 1fr;
	gap: 8px;
	font-size: 0.875rem;
}

.info dt {
	color: var(--text-muted);
}

.info dd {
	margin: 0;
	color: var(--text-h);
}

.late {
	margin-left: 8px;
	padding: 1px 8px;
	border-radius: 999px;
	background: var(--warning-bg);
	color: var(--warning);
	font-size: 0.75rem;
	font-weight: 600;
}

.description {
	margin: 14px 0 0;
	font-size: 0.875rem;
	line-height: 1.55;
}

.muted {
	margin: 0;
	font-size: 0.875rem;
	font-style: italic;
	color: var(--text-muted);
}

.timeline {
	margin: 0;
	padding: 0;
	list-style: none;
}

.timeline-item {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 1px;
	padding: 0 0 14px 20px;
	font-size: 0.875rem;
}

/* Pastille + trait vertical reliant les événements. */
.timeline-item::before {
	content: '';
	position: absolute;
	top: 5px;
	left: 2px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--accent);
}

.timeline-item:not(:last-child)::after {
	content: '';
	position: absolute;
	top: 16px;
	bottom: 0;
	left: 5px;
	width: 2px;
	background: var(--border);
}

.timeline-item:not(:first-child)::before {
	background: var(--accent-border);
}

.timeline-date {
	font-size: 0.75rem;
	color: var(--text-muted);
}

.timeline-label {
	color: var(--text-h);
}

.timeline-detail {
	font-size: 0.8125rem;
	color: var(--text-muted);
}
</style>
