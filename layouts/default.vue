<template>
	<div class="app">
		<LayoutAppHeader />
		<main class="app-view">
			<slot />
		</main>
	</div>
</template>

<style scoped>
.app {
	display: flex;
	flex-direction: column;
	height: 100vh;
	height: 100dvh;
}

.app-view {
	flex: 1;
	min-height: 0;
}
</style>
