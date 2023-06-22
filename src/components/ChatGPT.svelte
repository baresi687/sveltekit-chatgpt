<script>
	import { CodeBlock } from '@skeletonlabs/skeleton';
	import { processTextAndCodeBlocks } from '../utils/processTextAndCodeBlocks.js';

	let inputValue = '';
	let chatResponseStream = [];
	let chatResponses = [];
	let messageArray = [];
	let isLoading = false;
	let isStreaming = false;
	let isError = false;
	let errorString = '';
	let parsedLines = [];
	const decoder = new TextDecoder('utf-8');

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
				messageArray = [...messageArray, { role: 'user', content: data }];
				const reader = response.body.getReader();
				isStreaming = true;

				reader.read().then(function processText({ done, value }) {
					const decodedChunk = decoder.decode(value);
					const lines = decodedChunk.split('\n');

					parsedLines = lines
						.map((line) => line.replace(/^data: /, '').trim())
						.filter((line) => line.includes('content') && line !== '' && line !== '[DONE]')
						.map((line) => JSON.parse(line));

					chatResponseStream = [...processTextAndCodeBlocks(parsedLines, chatResponseStream)];

					if (done) {
						chatResponses = [
							{
								message: data,
								stream: [...processTextAndCodeBlocks(parsedLines, chatResponseStream)]
							},
							...chatResponses
						];
						isStreaming = false;
						chatResponseStream = [];

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
			getChatResponse(inputValue).finally(() => (inputValue = ''));
		}
	}
</script>

<div class="max-w-2xl my-14 mx-auto relative">
	<form on:submit={handleChat} class="relative">
		<input
			bind:value={inputValue}
			id="chat"
			class="w-full h-10 indent-2.5 rounded text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600"
			type="text"
			placeholder="Send a message"
		/>
		{#if inputValue}
			<button on:click={handleChat} class="absolute top-3 right-4">
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
	{#if isLoading}
		<div class="absolute top-[4.5rem] bg-skeletonDark z-10 shadow rounded-md w-full mx-auto">
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
	{#if isStreaming}
		<div class="whitespace-pre-line rounded my-8 p-4 bg-slate-800 text-zinc-200">
			{#each chatResponseStream as stream}
				{#if stream.code}
					<CodeBlock language={stream.language} code={stream.code} />
				{:else}
					{stream}
				{/if}
			{/each}
		</div>
	{/if}
	{#each chatResponses as chatResponse}
		<div class="whitespace-pre-line rounded my-8 p-4 bg-slate-800 text-zinc-200">
			{#each chatResponse.stream as stream}
				{#if stream.code}
					<CodeBlock language={stream.language} code={stream.code} />
				{:else}
					{stream}
				{/if}
			{/each}
			<div class="text-sm mt-3 bg-slate-900 p-2 rounded w-fit">
				Your message: <span class="font-semibold">{chatResponse.message}</span>
			</div>
		</div>
	{/each}
	{#if isError}
		<div class="absolute top-10 min-h-screen z-10 bg-transparent w-full">
			<div class="bg-red-900 whitespace-pre-line rounded my-8 p-4 text-zinc-200">
				{errorString}
			</div>
		</div>
	{/if}
</div>
