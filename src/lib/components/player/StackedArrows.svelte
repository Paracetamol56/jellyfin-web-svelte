<script lang="ts">
	// Lucide's "move-right" arrow, twice, one above the other: "play in order" (shuffle off).
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	<path d="M2 7H22" />
	<path d="M18.5 4L22 7L18.5 10" />
	<path d="M2 17H22" />
	<path d="M18.5 14L22 17L18.5 20" />
</svg>
