<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
	STAGES,
	availableMoves,
	canEditFas,
	canHold,
	daysLate,
	getStage,
	isExit,
	isForward,
	stagePosition,
	stagesBetween,
	type Dossier,
	type HistoryEvent,
	type MoveOption,
	type StageId,
} from '../domain/workflow';
import { formatDate, formatDateTime } from '../utils/format';

const props = defineProps<{
	dossier: Dossier;
	/** `YYYY-MM-DD` */
	today: string;
}>();

const emit = defineEmits<{
	close: [];
	move: [id: string, target: StageId];
	/** Nouveau J0.8, `YYYY-MM-DD` : posé directement, ou décalé après saisie du motif. */
	reschedule: [id: string, date: string];
	/** Mise en attente (motif) ou levée (`null`). */
	hold: [id: string, motif: string | null];
	fas: [id: string, fas: boolean];
	/** Urgence posée (motif obligatoire) ou retirée. */
	urgence: [id: string, urgent: boolean, motif: string | null];
}>();

const title = ref<HTMLElement | null>(null);
const dateInput = ref<HTMLInputElement | null>(null);

const moves = computed(() => availableMoves(props.dossier, props.today));
const stage = computed(() => getStage(props.dossier.stage));
const exited = computed(() => isExit(props.dossier.stage));
const position = computed(() => stagePosition(props.dossier.stage));
const delay = computed(() => daysLate(props.dossier, props.today));
const fasEditable = computed(() => canEditFas(props.dossier.stage));

/** Depuis Instruction, avancer est une demande de passage en CSDA. */
const nextLabel = computed(() =>
	moves.value.next.target === 'demandeCsda' ? 'Demander le passage en CSDA' : 'Statut suivant',
);

/** Libellés des sorties du workflow, plus parlants que le nom du statut. */
const SHORTCUT_LABELS: Partial<Record<StageId, string>> = {
	abandonnee: 'Abandonner la DDS',
	cadrageTermine: 'Marquer le cadrage comme terminé',
};

const abandon = computed(() => moves.value.shortcuts.find((s) => s.target === 'abandonnee'));

/** Brouillon de date : appliqué seulement à la validation, pas à chaque frappe. */
const draftDate = ref(props.dossier.j08 ?? '');
watch(
	() => props.dossier.j08,
	(date) => (draftDate.value = date ?? ''),
);
const canApplyDate = computed(
	() => draftDate.value >= props.today && draftDate.value !== props.dossier.j08,
);

function applyDate() {
	if (canApplyDate.value) emit('reschedule', props.dossier.id, draftDate.value);
}

/** Mise en attente : motif saisi dans le drawer. */
const holdOpen = ref(false);
const holdMotif = ref('');
const holdInput = ref<HTMLInputElement | null>(null);

async function openHold() {
	holdOpen.value = true;
	await nextTick();
	holdInput.value?.focus();
}

function submitHold() {
	const motif = holdMotif.value.trim();
	if (!motif) return;
	emit('hold', props.dossier.id, motif);
	holdOpen.value = false;
	holdMotif.value = '';
}

/** Déclarer la DDS urgente : l'interrupteur ouvre la saisie du motif, obligatoire. */
const urgenceOpen = ref(false);
const urgenceMotif = ref('');
const urgenceInput = ref<HTMLInputElement | null>(null);

async function onUrgenceChange(event: Event) {
	const checked = (event.target as HTMLInputElement).checked;
	if (!checked) {
		urgenceOpen.value = false;
		if (props.dossier.urgent) emit('urgence', props.dossier.id, false, null);
		return;
	}
	urgenceOpen.value = true;
	await nextTick();
	urgenceInput.value?.focus();
}

function submitUrgence() {
	const motif = urgenceMotif.value.trim();
	if (!motif) return;
	emit('urgence', props.dossier.id, true, motif);
	urgenceOpen.value = false;
	urgenceMotif.value = '';
}

function onFasChange(event: Event) {
	emit('fas', props.dossier.id, (event.target as HTMLInputElement).checked);
}

/** Entités partenaires, dans l'ordre de la fiche de la maquette. */
const PARTENAIRES = [
	{ key: 'datm', label: 'DATM' },
	{ key: 'mae', label: 'MAE' },
	{ key: 'ds', label: 'DS' },
] as const;

type DateEvent = Extract<HistoryEvent, { kind: 'date' }>;

/** Décalages du J0.8 (historique en ajout seul), du plus récent au plus ancien. */
const decalages = computed(() =>
	props.dossier.historique
		.filter((event): event is DateEvent => event.kind === 'date' && event.from !== null)
		.reverse(),
);

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
		holdOpen.value = false;
		holdMotif.value = '';
		urgenceOpen.value = false;
		urgenceMotif.value = '';
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

function ouiNon(value: boolean | null): string {
	return value === null ? 'Non renseigné' : value ? 'Oui' : 'Non';
}

function describeEvent(event: HistoryEvent): { label: string; detail?: string } {
	if (event.kind === 'fas') {
		return { label: event.fas ? 'Tag FAS posé (CSDA déclaratif)' : 'Tag FAS retiré' };
	}
	if (event.kind === 'attente') {
		return { label: event.enAttente ? 'Mise en attente' : 'Attente levée', detail: event.motif };
	}
	if (event.kind === 'note') {
		return { label: event.label, detail: event.detail };
	}
	if (event.kind === 'date') {
		if (!event.from) return { label: 'J0.8 posé', detail: formatDate(event.to) };
		const motif = event.motif ? ` · ${event.motif}` : '';
		return { label: 'J0.8 décalé', detail: `${formatDate(event.from)} → ${formatDate(event.to)}${motif}` };
	}
	const to = getStage(event.to).label;
	if (event.from === null) {
		return { label: `Demande enregistrée`, detail: `Statut « ${to} »` };
	}
	if (!isForward(event.from, event.to)) {
		return { label: `Retour en « ${to} »` };
	}
	if (event.to === 'demandeCsda') {
		return { label: 'Demande de passage en CSDA', detail: `Statut « ${to} »` };
	}
	const skipped = stagesBetween(event.from, event.to);
	return {
		label: `Passage en « ${to} »`,
		detail: event.motif
			? `Motif : ${event.motif}`
			: skipped.length
				? `Statut non réalisé : ${skipped.map((s) => s.label).join(', ')}`
				: undefined,
	};
}
</script>

<template>
	<aside class="drawer" aria-labelledby="drawer-title" @keydown.esc.stop="emit('close')">
		<header class="drawer-header">
			<div class="drawer-meta">
				<span class="drawer-id">{{ dossier.id }}</span>
				<span v-if="dossier.urgent" class="badge badge-urgent">Urgente</span>
				<span v-if="dossier.fas" class="badge badge-fas">FAS</span>
				<span v-if="dossier.attente" class="badge badge-hold">En attente</span>
			</div>
			<button
				type="button"
				class="drawer-close"
				aria-label="Fermer le détail de la DDS"
				@click="emit('close')"
			>
				✕
			</button>
			<h2 id="drawer-title" ref="title" class="drawer-title" tabindex="-1">
				{{ dossier.titre }}
			</h2>
		</header>

		<div class="drawer-body">
			<!-- J0.8 dépassé sans CSDA tenu : anomalie de données (spec, règle H9). -->
			<div v-if="delay > 0" class="alert alert-danger" role="note">
				<span class="ms alert-icon" aria-hidden="true">warning</span>
				<div class="alert-content">
					<p class="alert-text">
						<strong>Anomalie : J0.8 dépassé de {{ delay }} jour{{ delay > 1 ? 's' : '' }}</strong>
						sans CSDA tenu. Décalez le J0.8 avec un motif, ou abandonnez la DDS.
					</p>
					<div class="alert-actions">
						<button type="button" class="btn" @click="dateInput?.focus()">Décaler le J0.8</button>
						<button
							v-if="abandon"
							type="button"
							class="btn btn-danger-outline"
							@click="moveTo({ ...abandon, allowed: true, reason: '' })"
						>
							Abandonner
						</button>
					</div>
				</div>
			</div>

			<!-- Bandeau de la maquette : « Motif de mise en attente — … ». -->
			<div v-if="dossier.attente" class="alert alert-hold" role="note">
				<span class="ms alert-icon" aria-hidden="true">pause_circle</span>
				<div class="alert-content">
					<p class="alert-text">
						<strong>Motif de mise en attente</strong> — {{ dossier.attente.motif }}
						<span class="alert-since">depuis le {{ formatDateTime(dossier.attente.depuis) }}</span>
					</p>
					<div class="alert-actions">
						<button type="button" class="btn" @click="emit('hold', dossier.id, null)">
							Lever l’attente
						</button>
					</div>
				</div>
			</div>

			<section class="section" aria-labelledby="drawer-progress">
				<h3 id="drawer-progress" class="section-title">Avancement</h3>

				<p v-if="exited" class="progress-label">
					Sortie du workflow : <strong>{{ stage.label }}</strong>
				</p>
				<template v-else>
					<p class="progress-label">
						Statut {{ position }} sur {{ STAGES.length }} :
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
							}"
							:title="s.label"
						/>
					</ol>
				</template>

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
						← Statut précédent
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
						{{ nextLabel }} →
					</button>
				</div>
				<p v-if="!moves.next.allowed && moves.next.target" class="action-reason">
					{{ moves.next.reason }}
				</p>
				<button
					v-for="shortcut in moves.shortcuts"
					:key="shortcut.target"
					type="button"
					class="btn btn-shortcut"
					:class="{ 'is-danger': shortcut.target === 'abandonnee' }"
					@click="moveTo({ ...shortcut, allowed: true, reason: '' })"
				>
					{{ SHORTCUT_LABELS[shortcut.target] ?? shortcut.label }}
				</button>

				<template v-if="canHold(dossier.stage) && !dossier.attente">
					<form v-if="holdOpen" class="hold-form" @submit.prevent="submitHold">
						<label class="field">
							<span class="field-label">Motif de mise en attente</span>
							<input ref="holdInput" v-model="holdMotif" type="text" placeholder="Obligatoire…" required />
						</label>
						<button type="submit" class="btn btn-primary" :disabled="!holdMotif.trim()">
							Mettre en attente
						</button>
						<button type="button" class="btn" @click="holdOpen = false">Annuler</button>
					</form>
					<button v-else type="button" class="btn btn-shortcut" @click="openHold">
						Mettre en attente
					</button>
				</template>
			</section>

			<section class="section" aria-labelledby="drawer-planning">
				<h3 id="drawer-planning" class="section-title">Jalons</h3>
				<form class="planning-date" @submit.prevent="applyDate">
					<label class="field">
						<span class="field-label">J0.8 (CSDA visé)</span>
						<input ref="dateInput" v-model="draftDate" type="date" :min="today" required />
					</label>
					<button type="submit" class="btn" :disabled="!canApplyDate">
						{{ dossier.j08 ? 'Décaler…' : 'Poser le J0.8' }}
					</button>
					<span v-if="delay > 0" class="late">
						En retard de {{ delay }} jour{{ delay > 1 ? 's' : '' }}
					</span>
				</form>
				<p v-if="dossier.j08" class="field-note">
					Un décalage demande un motif et son porteur ; le J0.8 initial est conservé.
				</p>

				<dl class="info jalons">
					<div v-if="dossier.j08Initial && dossier.j08Initial !== dossier.j08">
						<dt>J0.8 initial</dt>
						<dd>
							<time :datetime="dossier.j08Initial">{{ formatDate(dossier.j08Initial) }}</time>
						</dd>
					</div>
					<div v-if="dossier.j08Reel">
						<dt>J0.8 réel (séance)</dt>
						<dd><time :datetime="dossier.j08Reel">{{ formatDate(dossier.j08Reel) }}</time></dd>
					</div>
					<div>
						<dt>J0.2 (fin de cadrage)</dt>
						<dd>
							<time v-if="dossier.j02" :datetime="dossier.j02">{{ formatDate(dossier.j02) }}</time>
							<span v-else class="muted">Non renseigné · requis pour l’Instruction</span>
						</dd>
					</div>
					<div v-if="dossier.kickoff">
						<dt>Kick-off</dt>
						<dd>
							<time :datetime="dossier.kickoff.date">{{ formatDate(dossier.kickoff.date) }}</time>
							· interlocuteur DS : {{ dossier.kickoff.interlocuteurDs }}
						</dd>
					</div>
					<div v-if="dossier.revueDatm">
						<dt>Revue DATM</dt>
						<dd><time :datetime="dossier.revueDatm">{{ formatDate(dossier.revueDatm) }}</time></dd>
					</div>
				</dl>
			</section>

			<section class="section" aria-labelledby="drawer-info">
				<h3 id="drawer-info" class="section-title">Informations générales</h3>
				<dl class="fields">
					<div class="field-item">
						<dt>Importance</dt>
						<dd>{{ dossier.visibilite }}</dd>
					</div>
					<div class="field-item">
						<dt>Priorité dans la phase</dt>
						<dd>{{ dossier.prioritePhase }}</dd>
					</div>
					<div class="field-item is-wide">
						<dt id="drawer-urgence">Urgence</dt>
						<dd>
							<label class="switch">
								<input
									type="checkbox"
									role="switch"
									aria-labelledby="drawer-urgence"
									:checked="dossier.urgent || urgenceOpen"
									@change="onUrgenceChange"
								/>
								<span>{{ dossier.urgent ? 'Oui' : 'Non' }}</span>
							</label>
							<small v-if="dossier.urgent && dossier.motifUrgence" class="field-note">
								Motif : {{ dossier.motifUrgence }}
							</small>
							<form v-if="urgenceOpen" class="hold-form" @submit.prevent="submitUrgence">
								<label class="field">
									<span class="field-label">Motif d’urgence (obligatoire)</span>
									<input ref="urgenceInput" v-model="urgenceMotif" type="text" required />
								</label>
								<button type="submit" class="btn btn-primary" :disabled="!urgenceMotif.trim()">
									Déclarer urgente
								</button>
								<button type="button" class="btn" @click="urgenceOpen = false">Annuler</button>
							</form>
						</dd>
					</div>
					<div class="field-item">
						<dt>Cercle</dt>
						<dd>{{ dossier.cercle }}</dd>
					</div>
					<div class="field-item">
						<dt>Domaine</dt>
						<dd>{{ dossier.domaine }}</dd>
					</div>
					<div class="field-item">
						<dt>Type</dt>
						<dd>{{ dossier.typeDds }}</dd>
					</div>
					<div class="field-item">
						<dt>Offre</dt>
						<dd>{{ dossier.offre }}</dd>
					</div>
					<div class="field-item">
						<dt>Demandeur</dt>
						<dd>{{ dossier.demandeur }}</dd>
					</div>
					<div class="field-item">
						<dt>Direction · service</dt>
						<dd>{{ dossier.direction }} · {{ dossier.service }}</dd>
					</div>
					<div class="field-item">
						<dt>PRT Palier</dt>
						<dd>{{ dossier.palier }}</dd>
					</div>
					<div class="field-item">
						<dt>Soumission</dt>
						<dd>
							<time :datetime="dossier.dateSoumission">{{ formatDate(dossier.dateSoumission) }}</time>
						</dd>
					</div>
					<div class="field-item is-wide">
						<dt id="drawer-fas">Process FAS</dt>
						<dd>
							<label class="switch">
								<input
									type="checkbox"
									role="switch"
									aria-labelledby="drawer-fas"
									:aria-describedby="fasEditable ? undefined : 'drawer-fas-note'"
									:checked="dossier.fas"
									:disabled="!fasEditable"
									@change="onFasChange"
								/>
								<span>{{ dossier.fas ? 'Oui · CSDA déclaratif' : 'Non' }}</span>
							</label>
							<small v-if="!fasEditable" id="drawer-fas-note" class="field-note">
								Figé depuis le kick-off (correction motivée par la Coordination).
							</small>
						</dd>
					</div>
					<div class="field-item">
						<dt>Mode agile</dt>
						<dd>{{ dossier.modeAgile ? 'Oui' : 'Non' }}</dd>
					</div>
					<div class="field-item">
						<dt>Externalisation CDS</dt>
						<dd>{{ dossier.externalisation }}</dd>
					</div>
					<div class="field-item">
						<dt>Cadrage technique</dt>
						<dd :class="{ muted: dossier.cadrageTechnique === null }">{{ ouiNon(dossier.cadrageTechnique) }}</dd>
					</div>
					<div class="field-item">
						<dt>Cadrage sécurité</dt>
						<dd :class="{ muted: dossier.cadrageSecurite === null }">{{ ouiNon(dossier.cadrageSecurite) }}</dd>
					</div>
					<div v-if="dossier.meteo" class="field-item is-wide">
						<dt>Météo</dt>
						<dd>
							<span class="meteo" :class="`meteo-${dossier.meteo.statut.toLowerCase()}`" />
							{{ dossier.meteo.statut }} — {{ dossier.meteo.commentaire }}
						</dd>
					</div>
					<div v-if="dossier.motifAbandon" class="field-item is-wide">
						<dt>Motif d’abandon</dt>
						<dd>{{ dossier.motifAbandon }}</dd>
					</div>
				</dl>
			</section>

			<section class="section" aria-labelledby="drawer-people">
				<h3 id="drawer-people" class="section-title">Parties prenantes</h3>
				<dl class="fields">
					<div class="field-item">
						<dt>Référent</dt>
						<dd>{{ dossier.architecte }}</dd>
					</div>
					<div class="field-item">
						<dt>Contributeurs</dt>
						<dd :class="{ muted: dossier.contributeurs.length === 0 }">
							{{ dossier.contributeurs.length ? dossier.contributeurs.join(', ') : 'Aucun' }}
						</dd>
					</div>
				</dl>
				<h4 class="subsection-title">Partenaires positionnés</h4>
				<dl class="fields fields-3">
					<div v-for="entite in PARTENAIRES" :key="entite.key" class="field-item">
						<dt>{{ entite.label }}</dt>
						<dd :class="{ muted: !dossier.partenaires[entite.key] }">
							{{ dossier.partenaires[entite.key] ?? 'Non affecté' }}
						</dd>
					</div>
				</dl>
			</section>

			<section class="section" aria-labelledby="drawer-decalages">
				<h3 id="drawer-decalages" class="section-title">Historique des décalages</h3>
				<p v-if="decalages.length === 0" class="muted">
					Aucun décalage de jalon enregistré pour ce dossier.
				</p>
				<ol v-else class="decalages">
					<li v-for="item in decalages" :key="item.at" class="decalage">
						<p class="decalage-dates">
							<span class="decalage-jalon">J0.8</span>
							{{ formatDate(item.from!) }} <span aria-hidden="true">→</span><span class="sr-only">décalé au</span>
							<strong>{{ formatDate(item.to) }}</strong>
						</p>
						<p class="decalage-motif">
							{{ item.motif ?? 'Motif non renseigné' }}<template v-if="item.porteur"> · porteur : {{ item.porteur }}</template>
						</p>
						<p v-if="item.commentaire" class="decalage-comment">« {{ item.commentaire }} »</p>
						<time class="timeline-date" :datetime="item.at">{{ formatDateTime(item.at) }}</time>
					</li>
				</ol>
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
	font-family: var(--title);
	font-size: 1.25rem;
	line-height: 1.3;
	color: var(--bleu-700);
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

.badge-fas {
	color: var(--declaratif);
	background: var(--declaratif-bg);
}

.badge-urgent {
	color: #fff;
	background: var(--alerte);
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

/* Abandon : action destructive, en rouge comme dans la maquette. */
.btn-shortcut.is-danger {
	border-color: var(--alerte);
	color: var(--alerte);
}

.btn-shortcut.is-danger:hover {
	background: var(--alerte-soft);
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

/* Pastille météo de la maquette (Vert / Orange / Rouge). */
.meteo {
	display: inline-block;
	width: 9px;
	height: 9px;
	margin-right: 4px;
	border-radius: 50%;
	vertical-align: 1px;
}

.meteo-vert {
	background: var(--succes);
}

.meteo-orange {
	background: var(--vigilance);
}

.meteo-rouge {
	background: var(--alerte);
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

.badge-hold {
	color: var(--vigilance-fg);
	background: var(--vigilance-soft);
}

/* Bandeaux en tête de fiche : anomalie (rouge) et mise en attente (orange), comme la maquette. */
.alert {
	display: flex;
	gap: 10px;
	margin-top: 16px;
	padding: 12px 14px;
	border: 1px solid;
	border-radius: 12px;
	font-size: 0.875rem;
}

.alert-danger {
	border-color: color-mix(in srgb, var(--alerte) 35%, transparent);
	background: var(--alerte-soft);
	color: var(--alerte-fg);
}

.alert-hold {
	border-color: color-mix(in srgb, var(--vigilance) 45%, transparent);
	background: var(--vigilance-soft);
	color: var(--vigilance-fg);
}

.alert-icon {
	font-size: 20px;
}

.alert-content {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 8px;
}

.alert-text {
	margin: 0;
	line-height: 1.45;
}

.alert-since {
	display: block;
	font-size: 0.75rem;
	opacity: 0.85;
}

.alert-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.alert .btn {
	background: var(--carte);
}

.btn-danger-outline {
	border-color: var(--alerte);
	color: var(--alerte);
}

.action-reason {
	margin: 8px 0 0;
	font-size: 0.8125rem;
	color: var(--text-muted);
}

.hold-form {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 8px;
	margin-top: 8px;
}

.hold-form .field {
	flex: 1 1 240px;
}

.hold-form .btn {
	height: 34px;
}

.field-note {
	display: block;
	margin: 6px 0 0;
	font-size: 0.75rem;
	color: var(--text-muted);
}

.jalons {
	margin-top: 12px;
}

.planning-date .late {
	align-self: center;
}

/* Interrupteur du tag FAS : case native stylée, état lisible aussi par le libellé. */
.switch {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	cursor: pointer;
}

.switch input {
	appearance: none;
	position: relative;
	width: 34px;
	height: 20px;
	margin: 0;
	border-radius: 999px;
	background: var(--gris-300);
	cursor: inherit;
	transition: background-color 0.15s;
}

.switch input::after {
	content: '';
	position: absolute;
	top: 2px;
	left: 2px;
	width: 16px;
	height: 16px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	transition: transform 0.15s;
}

.switch input:checked {
	background: var(--accent);
}

.switch input:checked::after {
	transform: translateX(14px);
}

.switch input:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}

.switch:has(input:disabled) {
	cursor: not-allowed;
	opacity: 0.6;
}

/* Fiche en deux colonnes, libellé au-dessus de la valeur, comme la maquette. */
.fields {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px 16px;
	margin: 0;
}

.fields-3 {
	grid-template-columns: repeat(3, 1fr);
}

.field-item {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.field-item.is-wide {
	grid-column: 1 / -1;
}

.field-item dt {
	font-size: 0.6875rem;
	font-weight: 700;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	color: var(--text-muted);
}

.field-item dd {
	margin: 0;
	font-size: 0.875rem;
	color: var(--text-h);
}

.field-item dd.muted {
	font-style: italic;
	color: var(--text-muted);
}

.subsection-title {
	margin: 16px 0 8px;
	font-size: 0.75rem;
	font-weight: 700;
	color: var(--text-h);
}

/* Historique des décalages : une fiche par décalage, en ajout seul. */
.decalages {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.decalage {
	display: flex;
	flex-direction: column;
	gap: 2px;
	padding: 10px 12px;
	border: 1px solid var(--bordure);
	border-radius: 10px;
	background: var(--canvas);
	font-size: 0.875rem;
}

.decalage p {
	margin: 0;
}

.decalage-dates strong {
	color: var(--text-h);
}

.decalage-jalon {
	margin-right: 4px;
	font-family: var(--mono);
	font-size: 0.75rem;
	color: var(--gris-600);
}

.decalage-motif {
	color: var(--text-h);
}

.decalage-comment {
	font-size: 0.8125rem;
	font-style: italic;
	color: var(--text-muted);
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	margin: -1px;
	padding: 0;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
	border: 0;
}
</style>
