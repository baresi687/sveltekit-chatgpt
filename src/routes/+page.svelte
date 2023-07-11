<script lang="ts">
	import ChatGPT from '../components/ChatGPT.svelte';
	import { onMount } from 'svelte';

	let mainRef: HTMLElement;
	let chatContainerRef: HTMLElement;
	let scrollPos = 0;
	let isScroll = true;
	let scrollHeight = 0;

	function handleScroll() {
		isScroll = mainRef.scrollTop >= scrollPos;
		scrollPos = mainRef.scrollTop;
	}

	onMount(() => {
		const resizeObserver = new ResizeObserver(() => {
			if (isScroll && mainRef.scrollHeight - scrollHeight >= 40) {
				mainRef.scrollTo({
					top: mainRef.scrollHeight,
					left: 0
				});
				scrollHeight = mainRef.scrollHeight;
			}
		});

		resizeObserver.observe(chatContainerRef);
		return () => resizeObserver.unobserve(mainRef);
	});
</script>

<main
	bind:this={mainRef}
	on:scroll={handleScroll}
	class="overflow-y-scroll hide-scrollbar scroll-smooth"
>
	<section>
		<h1 class="text-center text-5xl px-4 mt-36">SvelteKit ChatGPT</h1>
		<div bind:this={chatContainerRef}>
			<ChatGPT />
		</div>
	</section>
</main>
<footer class="fixed bottom-5 z-50 bg-slate-800 w-full">
	<p class="flex justify-center text-xs">
		Hreinn Gylfason · This site is for educational purpose only
	</p>
</footer>
