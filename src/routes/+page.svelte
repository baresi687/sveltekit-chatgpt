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
	class="overflow-y-scroll hide-scrollbar scroll-smooth"
>
	<section>
		<h1 class="text-center text-5xl px-4 mt-36">SvelteKit ChatGPT</h1>
		<div bind:this={chatContainerRef}>
			<ChatGPT />
			<button
				on:click={() => mainRef.scrollTo({ top: mainRef.scrollHeight, left: 0, behavior: 'auto' })}
				aria-label="Scroll to bottom"
				type="button"
				class={`absolute bottom-40 left-[26px] ease-in-out duration-200 ${
					isScroll ? 'opacity-0 invisible' : 'opacity-100 visible'
				} md:right-7 md:left-auto rounded-full h-11 w-11 mb-0.5 flex justify-center items-center border-2 border-slate-800 bg-slate-900 hover:brightness-125`}
				><svg
					class="pointer-events-none"
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					><path
						fill="#cbd5e1"
						d="M11 4h2v12l5.5-5.5l1.42 1.42L12 19.84l-7.92-7.92L5.5 10.5L11 16V4Z"
					/></svg
				></button
			>
		</div>
	</section>
</main>
<footer class="fixed bottom-5 z-50 bg-slate-800 w-full">
	<p class="flex justify-center text-xs">
		Hreinn Gylfason · This site is for educational purpose only
	</p>
</footer>
