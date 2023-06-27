<script>
	import { CodeBlock } from '@skeletonlabs/skeleton';
	import { processTextAndCodeBlocks } from '../utils/processTextAndCodeBlocks.js';
	import { onMount } from 'svelte';

	let inputValue = '';
	let chatResponseStream = [];
	let chatResponses = [];
	let messageArray = [];
	let isLoading = false;
	let isStreaming = false;
	let isError = false;
	let errorString = '';
	let parsedLines = [];
	let inputRef;
	let chatResponseContainerRef;
	const decoder = new TextDecoder('utf-8');

	onMount(() => {
		const resizeObserver = new ResizeObserver(() => {
			window.scrollTo({
				top: document.body.scrollHeight,
				left: 0,
				behavior: 'smooth'
			});
		});

		resizeObserver.observe(chatResponseContainerRef);
		return () => resizeObserver.unobserve(chatResponseContainerRef);
	});

	async function getChatResponse(data) {
		const model = {
			model: 'gpt-3.5-turbo',
			messages: [...messageArray, { role: 'user', content: data }],
			stream: true
		};

		try {
			isLoading = true;
			isError = false;

			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${import.meta.env.VITE_CHATGPT_KEY}`
				},

				body: JSON.stringify(model)
			});

			if (response.status === 200) {
				const reader = response.body.getReader();
				let isStreamError = [];
				messageArray = [...messageArray, { role: 'user', content: data }];
				isStreaming = true;

				chatResponses = [
					...chatResponses,
					{
						stream: []
					}
				];

				reader.read().then(function processText({ done, value }) {
					const decodedChunk = decoder.decode(value);
					const lines = decodedChunk.split('\n');
					let parsedContent;

					parsedLines = lines
						.map((line) => line.replace(/^data: /, '').trim())
						.filter((line) => line.startsWith('{"id') || line.startsWith('{"error'))
						.map((line) => JSON.parse(line));

					parsedContent = parsedLines.filter((line) => line.id);
					isStreamError = [...parsedLines.filter((line) => line.error)];

					chatResponseStream = [...processTextAndCodeBlocks(parsedContent, chatResponseStream)];
					chatResponses[chatResponses.length - 1].stream = [...chatResponseStream];

					if (isStreamError.length) {
						isError = true;
						errorString = 'An error occurred. Please try again later';
					}

					if (done) {
						if (isStreamError.length) {
							chatResponses = chatResponses.slice(0, -1);
						} else {
							chatResponses[chatResponses.length - 1].message = data;
							inputValue = '';
						}
						chatResponseStream = [];
						isStreaming = false;
						regainFocus();
						return;
					}
					return reader.read().then(processText);
				});
			} else if (response.status === 429) {
				isError = true;
				errorString = 'Too many requests. Try again later';
			} else {
				isError = true;
				errorString = 'Something went wrong.. please try again later';
			}
		} catch (error) {
			isError = true;
			errorString = 'Something went wrong.. please try again later';
		} finally {
			isLoading = false;
		}
	}

	function handleChat(e) {
		e.preventDefault();

		if (inputValue) {
			getChatResponse(inputValue).then();
		}
	}

	function regainFocus() {
		setTimeout(() => {
			inputRef.focus();
		}, 1);
	}
</script>

<div class=" my-14">
	<div
		bind:this={chatResponseContainerRef}
		class="relative container mx-auto px-4 max-w-3xl pb-[6rem] mb-44"
	>
		{#if chatResponses.length > 0}
			{#each chatResponses as chatResponse}
				<div class="whitespace-pre-line break-words rounded my-8 p-4 bg-slate-800 text-zinc-200">
					{#each chatResponse.stream as stream}
						{#if stream.code}
							<CodeBlock language={stream.language} code={stream.code} />
						{:else}
							<p>{stream.text}</p>
						{/if}
					{/each}
					{#if chatResponse.message}
						<div class="text-sm mt-3 bg-slate-900 p-2 rounded w-fit">
							Your message: <span class="font-semibold">{chatResponse.message}</span>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
		{#if isLoading}
			<div
				class="absolute bottom-2 left-0 bg-transparent z-10 shadow rounded-md w-full mx-auto px-4"
			>
				<div class="animate-pulse flex space-x-4">
					<div class="flex-1 space-y-6 pb-4">
						<div class="h-2 bg-slate-700 rounded" />
						<div class="h-2 bg-slate-700 rounded" />
						<div class="space-y-3">
							<div class="grid grid-cols-3 gap-4">
								<div class="h-2 bg-slate-700 rounded col-span-2" />
								<div class="h-2 bg-slate-700 rounded col-span-1" />
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
		{#if isError}
			<div class="absolute bottom-0 left-0 z-10 w-full px-4">
				<div class="bg-red-900 whitespace-pre-line rounded my-8 p-4 text-zinc-200">
					{errorString}
				</div>
			</div>
		{/if}
	</div>
	<div class="fixed bottom-0 z-50 w-full pt-10 pb-14 mt-4 bg-slate-800">
		<form on:submit={handleChat} class="relative max-w-3xl mx-auto px-4">
			<input
				bind:this={inputRef}
				bind:value={inputValue}
				id="chat"
				class="w-full h-10 indent-2.5 rounded text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600 disabled:bg-gray-400"
				type="text"
				placeholder="Send a message"
				disabled={isLoading || isStreaming}
			/>
			{#if isLoading || isStreaming}
				<div class="absolute top-2.5 right-6 placeholder-circle w-5 animate-pulse" />
			{/if}
			{#if inputValue && !isStreaming && !isLoading}
				<button on:click={handleChat} class="absolute top-3 right-6">
					<svg
						aria-label="Submit question"
						class="pointer-events-none"
						xmlns="http://www.w3.org/2000/svg"
						width="15"
						height="16"
						viewBox="0 0 15 16"
						><path
							fill="#1d4ed8"
							d="M12.49 7.14L3.44 2.27c-.76-.41-1.64.3-1.4 1.13l1.24 4.34c.05.18.05.36 0 .54l-1.24 4.34c-.24.83.64 1.54 1.4 1.13l9.05-4.87a.98.98 0 0 0 0-1.72Z"
						/></svg
					>
				</button>
			{/if}
		</form>
	</div>
</div>
