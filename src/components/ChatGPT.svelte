<script lang="ts">
	import { CodeBlock, clipboard } from '@skeletonlabs/skeleton';
	import type {
		IChatResponseStream,
		IChatResponses,
		IMessageArray,
		IStreamError
	} from '../interfaces/types';
	import { processTextAndCodeBlocks } from '../utils/processTextAndCodeBlocks';
	import { handleAssistantResponse, handleStreamAborted, parseLines } from '../utils/functions';
	import { onMount } from 'svelte';

	let inputValue = '';
	let chatResponseStream: IChatResponseStream[] = [];
	let chatResponses: IChatResponses[] = [];
	let messageArray: IMessageArray[] = [{ role: 'system', content: 'You are a helpful assistant.' }];
	let isLoading = false;
	let isStreaming = false;
	let isStreamingOverOneSecond = false;
	let hasStreamBeenCancelled = false;
	let isError = false;
	let isLimitReached = false;
	let errorString = '';
	let inputRef: HTMLElement;
	let clipBoardBooleans: boolean[] = [];
	const decoder = new TextDecoder('utf-8');

	async function getChatResponse(data: string) {
		const model = {
			model: 'gpt-3.5-turbo',
			messages: [...messageArray, { role: 'user', content: data }],
			stream: true
		};

		try {
			isLoading = true;
			isStreamingOverOneSecond = false;
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
				const reader = response?.body?.getReader();
				let isStreamError: IStreamError[] = [];

				isStreaming = true;
				messageArray = [...messageArray, { role: 'user', content: data }];
				chatResponses = [...chatResponses, { stream: [{}] }];

				setTimeout(() => {
					isStreamingOverOneSecond = true;
				}, 1500);

				if (typeof reader === 'object') {
					reader
						.read()
						.then(function processText({ done, value }): unknown {
							const decodedChunk = decoder.decode(value);
							const lines = decodedChunk.split('\n');
							const parsedLines = parseLines(lines);
							const parsedContent = parsedLines.filter((line) => line.id || line.done);

							isStreamError = [...isStreamError, ...parsedLines.filter((line) => line.error)];
							chatResponseStream = [...processTextAndCodeBlocks(parsedContent, chatResponseStream)];
							chatResponses[chatResponses.length - 1].stream = [...chatResponseStream];

							if (hasStreamBeenCancelled) {
								chatResponseStream = handleStreamAborted(chatResponseStream);
								reader.cancel();
							}

							if (isStreamError.length) {
								throw Error(isStreamError[0].error.message);
							}

							if (done) {
								const chatResponse = chatResponses[chatResponses.length - 1];
								const clipBoard = chatResponseStream.filter((item) => item.clipBoard)[0].clipBoard;

								chatResponse.message = data;
								chatResponse.clipBoard = clipBoard;
								clipBoardBooleans = [...clipBoardBooleans, false];
								messageArray = handleAssistantResponse(chatResponseStream, messageArray);
								inputValue = '';
								return;
							}

							return reader.read().then(processText);
						})
						.catch((e) => {
							chatResponseStream = handleStreamAborted(chatResponseStream);
							chatResponses = chatResponses.slice(0, -1);
							messageArray = messageArray.slice(0, -1);
							errorString = isStreamError.length ? e.message : errorString;
							isError = true;
						})
						.finally(() => {
							isStreaming = false;
							hasStreamBeenCancelled = false;
							chatResponseStream = [];
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
		if (inputValue.trim()) {
			getChatResponse(inputValue.trim()).then();
		}
	}

	function regainFocus() {
		if (window.innerWidth >= 958) {
			setTimeout(() => {
				inputRef.focus();
			}, 1);
		}
	}

	function handleClipBoardClick(index: number) {
		clipBoardBooleans[index] = true;
		setTimeout(() => {
			clipBoardBooleans[index] = false;
		}, 1000);
	}

	onMount(() => {
		inputRef.focus();
	});
</script>

<div class=" my-14">
	<div class="relative container mx-auto px-4 max-w-3xl pb-[6rem] mb-44">
		{#if chatResponses?.length > 0}
			{#each chatResponses as chatResponse}
				<div class="whitespace-pre-line break-words rounded my-8 p-4 bg-slate-800 text-zinc-200">
					{#each chatResponse.stream as stream}
						{#if stream.code !== undefined}
							<CodeBlock class="my-1.5" language={stream.language} code={stream.code} />
							{#if isStreaming && chatResponses.at(-1) === chatResponse && chatResponse.stream.at(-1) === stream}
								<span class="blinking-cursor"></span>
							{/if}
						{:else if stream.text}
							<p>
								{stream.text}
								{#if isStreaming && chatResponses.at(-1) === chatResponse && chatResponse.stream.at(-1) === stream}
									<span class="blinking-cursor -ml-0.5"></span>
								{/if}
							</p>
						{/if}
					{/each}
					{#if chatResponse.message && chatResponse.clipBoard}
						<div class="flex justify-between gap-8 mt-3">
							<div class="text-sm bg-slate-900 p-2 rounded w-fit">
								Your message: <span class="font-semibold">{chatResponse.message}</span>
							</div>
							<button
								class="ease-in duration-100 flex justify-center items-center shrink-0 rounded w-10 h-9 mt-auto border border-slate-600 hover:bg-slate-900 hover:border-slate-900"
								aria-label="Copy text"
								use:clipboard={chatResponse.clipBoard}
								on:click={() => handleClipBoardClick(chatResponses.indexOf(chatResponse))}
								>{#if clipBoardBooleans[chatResponses.indexOf(chatResponse)]}
									👍
								{:else}
									<svg
										class="pointer-events-none"
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 256 256"
										><path
											fill="#94a3b8"
											d="M216 36H88a4 4 0 0 0-4 4v44H40a4 4 0 0 0-4 4v128a4 4 0 0 0 4 4h128a4 4 0 0 0 4-4v-44h44a4 4 0 0 0 4-4V40a4 4 0 0 0-4-4Zm-52 176H44V92h120Zm48-48h-40V88a4 4 0 0 0-4-4H92V44h120Z"
										/></svg
									>
								{/if}
							</button>
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
						<div class="h-2 bg-slate-700 rounded"></div>
						<div class="h-2 bg-slate-700 rounded"></div>
						<div class="space-y-3">
							<div class="grid grid-cols-3 gap-4">
								<div class="h-2 bg-slate-700 rounded col-span-2"></div>
								<div class="h-2 bg-slate-700 rounded col-span-1"></div>
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
	{#if isStreaming && isStreamingOverOneSecond}
		<div id="stop-generating" class="fixed bottom-40 flex justify-center w-full">
			<button
				on:click={() => (hasStreamBeenCancelled = true)}
				class="btn bg-slate-900 border-2 border-slate-800"
			>
				<span class="pointer-events-none"
					><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"
						><path
							fill="currentColor"
							fill-rule="evenodd"
							d="M12.035 13.096a6.5 6.5 0 0 1-9.131-9.131l9.131 9.131Zm1.061-1.06L3.965 2.903a6.5 6.5 0 0 1 9.131 9.131ZM16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Z"
							clip-rule="evenodd"
						/></svg
					></span
				>
				<span class="pointer-events-none">Stop generating</span>
			</button>
		</div>
	{/if}
	<div class="fixed bottom-0 z-50 w-full pt-8 pb-14 mt-4 bg-slate-800">
		<form on:submit={handleChat} class="relative max-w-3xl mx-auto px-4">
			<label class={`flex p-3 rounded ${isLoading || isStreaming ? 'bg-gray-400' : 'bg-white'}`}>
				<input
					bind:this={inputRef}
					bind:value={inputValue}
					on:keydown={(e) => (e.key === 'Enter' ? handleChat(e) : null)}
					name="message-input"
					id="message-input"
					aria-label="Send a message"
					class="w-full pr-14 text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600 focus:outline-none"
					placeholder="Send a message"
					disabled={isLoading || isStreaming}
				/>
			</label>
			{#if !isLoading && !isStreaming}
				<button
					class="ease-in-out duration-200 absolute bg-blue-700 rounded-lg top-1 right-6 w-10 h-10 disabled:bg-white"
					disabled={!inputValue.trim()}
				>
					<svg
						aria-label="Submit message"
						class={`pointer-events-none ${
							!inputValue.trim() ? 'text-slate-600' : 'text-slate-100'
						}`}
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
			{#if isLoading || isStreaming}
				<div class="absolute top-3 right-8 placeholder-circle w-6 animate-pulse"></div>
			{/if}
		</form>
	</div>
</div>
