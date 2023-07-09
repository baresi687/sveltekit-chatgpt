<script lang="ts">
	import { CodeBlock } from '@skeletonlabs/skeleton';
	import { processTextAndCodeBlocks } from '../utils/processTextAndCodeBlocks';

	interface IChatResponseStream {
		text?: string;
		code?: string;
		language?: string;
		choices?: [];
		done?: boolean;
	}

	interface IChatResponses {
		message?: string;
		stream: [...IChatResponseStream[]];
	}

	interface IStreamError {
		error: { message: string };
	}

	let inputValue = '';
	let chatResponseStream: IChatResponseStream[] = [];
	let chatResponses: IChatResponses[] = [];
	let messageArray = [{ role: 'system', content: 'You are a helpful assistant.' }];
	let isLoading = false;
	let isStreaming = false;
	let isError = false;
	let isLimitReached = false;
	let errorString = '';
	let parsedLines = [];
	let inputRef: HTMLElement;
	const decoder = new TextDecoder('utf-8');

	async function getChatResponse(data: string) {
		const model = {
			model: 'gpt-3.5-turbo',
			messages: [...messageArray, { role: 'user', content: data }],
			stream: true
		};

		try {
			isLoading = true;
			isError = false;
			errorString = 'Something went wrong.. Please try again later';

			const timeOutAbortController = new AbortController();
			const timeOut = setTimeout(() => timeOutAbortController.abort(), 30000);
			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				signal: timeOutAbortController.signal,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${import.meta.env.VITE_CHATGPT_KEY}`
				},
				body: JSON.stringify(model)
			});

			if (response.status === 200) {
				clearTimeout(timeOut);
				const reader = await response?.body?.getReader();
				let isStreamError: IStreamError[] = [];
				messageArray = [...messageArray, { role: 'user', content: data }];
				isStreaming = true;

				chatResponses = [...chatResponses, { stream: [{}] }];

				if (typeof reader === 'object') {
					reader
						.read()
						.then(function processText({ done, value }): unknown {
							const decodedChunk = decoder.decode(value);
							const lines = decodedChunk.split('\n');
							let parsedContent;

							parsedLines = lines
								.map((line) => line.replace(/^data: /, '').trim())
								.filter(
									(line) =>
										line.startsWith('{"id') || line.startsWith('{"error') || line === '[DONE]'
								)
								.map((line) => {
									if (line.startsWith('{"id') || line.startsWith('{"error')) {
										return JSON.parse(line);
									} else {
										return JSON.parse('{"done": true}');
									}
								});

							parsedContent = parsedLines.filter((line) => line.id || line.done);
							isStreamError = [...isStreamError, ...parsedLines.filter((line) => line.error)];

							chatResponseStream = [...processTextAndCodeBlocks(parsedContent, chatResponseStream)];
							chatResponses[chatResponses.length - 1].stream = [...chatResponseStream];

							if (isStreamError.length) {
								chatResponseStream = [
									...processTextAndCodeBlocks(
										[{ done: true, choices: [{ delta: { content: '' } }] }],
										chatResponseStream
									)
								];
								isError = true;
								errorString = isStreamError[0].error.message;
							}

							if (done) {
								if (isStreamError.length) {
									chatResponses = chatResponses.slice(0, -1);
								} else {
									const assistantResponse = chatResponseStream
										.map((item) => item.text || item.code)
										.join(' ');

									messageArray = [
										...messageArray,
										{ role: 'assistant', content: assistantResponse }
									];
									chatResponses[chatResponses.length - 1].message = data;
									inputValue = '';
								}
								return;
							}

							return reader.read().then(processText);
						})
						.catch(() => {
							chatResponses = chatResponses.slice(0, -1);
							isError = true;
						})
						.finally(() => {
							chatResponseStream = [];
							isStreaming = false;
							regainFocus();
						});
				}
			} else {
				isError = true;
				switch (response.status) {
					case 429:
						errorString = 'Too many requests. Please try again later';
						break;
					case 400:
						errorString = 'Maximum limit for message history (tokens) reached.';
						isLimitReached = true;
						break;
				}
				regainFocus();
			}
		} catch (error: unknown) {
			isError = true;
			if (error instanceof Error && error.name === 'AbortError') {
				errorString = 'Request timed out.  Please try again later';
			}
			regainFocus();
		} finally {
			isLoading = false;
		}
	}

	function handleChat(e: Event) {
		e.preventDefault();
		if (inputValue) {
			getChatResponse(inputValue).then();
		}
	}

	function regainFocus() {
		if (window.innerWidth >= 958) {
			setTimeout(() => {
				inputRef.focus();
			}, 1);
		}
	}
</script>

<div class=" my-14">
	<div class="relative container mx-auto px-4 max-w-3xl pb-[6rem] mb-44">
		{#if chatResponses?.length > 0}
			{#each chatResponses as chatResponse}
				<div class="whitespace-pre-line break-words rounded my-8 p-4 bg-slate-800 text-zinc-200">
					{#each chatResponse.stream as stream}
						{#if stream.code !== undefined}
							<CodeBlock class="my-1.5" language={stream.language} code={stream.code} />
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
		<div class="relative">
			{#if isError}
				<div class="absolute left-0 top-0 w-full">
					<div
						class="flex gap-4 items-center bg-red-900 whitespace-pre-line rounded mb-8 p-4 text-zinc-200"
					>
						<p>{errorString}</p>
						{#if isLimitReached}
							<button on:click={() => location.reload()} class="btn btn-sm bg-red-800"
								>Refresh page</button
							>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
	<div class="fixed bottom-0 z-50 w-full pt-8 pb-14 mt-4 bg-slate-800">
		<form on:submit={handleChat} class="relative max-w-3xl mx-auto px-4">
			<input
				bind:this={inputRef}
				bind:value={inputValue}
				id="chat"
				class="w-full h-12 indent-2.5 rounded text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600 disabled:bg-gray-400"
				type="text"
				placeholder="Send a message"
				disabled={isLoading || isStreaming}
			/>
			{#if isLoading || isStreaming}
				<div class="absolute top-3 right-6 placeholder-circle w-6 animate-pulse" />
			{/if}
			{#if inputValue && !isStreaming && !isLoading}
				<button
					on:click={handleChat}
					class="absolute bg-blue-600 rounded-lg top-1 right-6 w-10 h-10"
				>
					<svg
						aria-label="Submit question"
						class="pointer-events-none text-slate-100"
						xmlns="http://www.w3.org/2000/svg"
						width="32"
						height="24"
						viewBox="0 0 8 16"
						><path
							fill="currentColor"
							d="M12.49 7.14L3.44 2.27c-.76-.41-1.64.3-1.4 1.13l1.24 4.34c.05.18.05.36 0 .54l-1.24 4.34c-.24.83.64 1.54 1.4 1.13l9.05-4.87a.98.98 0 0 0 0-1.72Z"
						/></svg
					>
				</button>
			{/if}
		</form>
	</div>
</div>
