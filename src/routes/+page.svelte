<script lang="ts">
	import ChatGPT from '../components/ChatGPT.svelte';
	import { onMount } from 'svelte';

	let mainRef: HTMLElement;
	let chatContainerRef: HTMLElement;
	let scrollPos = 0;
	let isScroll = true;
	let scrollHeight = 0;

	onMount(() => {
		const resizeObserver = new ResizeObserver(() => {
			const isDesktop = window.innerWidth >= 958;
			const isMobile = mainRef.scrollHeight - scrollHeight >= 70;

			if (isScroll && (isDesktop || isMobile)) {
				handleAutoScroll();
			}
		});

		resizeObserver.observe(chatContainerRef);
		return () => resizeObserver.unobserve(chatContainerRef);
	});

	function handleAutoScroll() {
		scrollPos = mainRef.scrollTop;
		mainRef.scrollTo({ top: mainRef.scrollHeight, left: 0 });
	}

	function handleManualScroll() {
		scrollPos = mainRef.scrollTop >= scrollPos ? mainRef.scrollTop : scrollPos;
		isScroll = mainRef.scrollTop >= scrollPos;

		if (mainRef.scrollTop + mainRef.offsetHeight >= mainRef.scrollHeight) {
			isScroll = true;
			handleAutoScroll();
		}
	}
</script>

<main
	bind:this={mainRef}
	on:scroll={handleManualScroll}
	class="hide-scrollbar overflow-y-scroll scroll-smooth"
>
	<section>
		<h1 class="mt-36 px-4 text-center text-5xl">SvelteKit ChatGPT</h1>
		<div bind:this={chatContainerRef}>
			<ChatGPT />
			<div class="pointer-events-none absolute inset-0 mx-auto my-0 max-w-5xl">
				<button
					on:click={() =>
						mainRef.scrollTo({ top: mainRef.scrollHeight, left: 0, behavior: 'auto' })}
					aria-label="Scroll to bottom"
					type="button"
					class={`absolute bottom-40 left-[26px] duration-200 ease-in-out ${
						isScroll ? 'invisible opacity-0' : 'visible opacity-100'
					} pointer-events-auto mb-0.5 flex h-11 w-11 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-900 hover:brightness-125 md:left-auto md:right-7`}
					><svg
						class="pointer-events-none"
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						><path
							fill="currentColor"
							d="M11 4h2v12l5.5-5.5l1.42 1.42L12 19.84l-7.92-7.92L5.5 10.5L11 16V4Z"
						/></svg
					></button
				>
			</div>
		</div>
	</section>
</main>
<footer class="fixed bottom-5 z-50 w-full bg-slate-800">
	<p class="flex justify-center text-xs">
		Hreinn Gylfason · This site is for educational purpose only
	</p>
</footer>
