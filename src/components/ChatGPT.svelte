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
	let userMessageArray: string[] = [];
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
			chatResponses = [...chatResponses, { stream: [{}] }];
			userMessageArray = [...userMessageArray, data];
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

								clipBoardBooleans = [...clipBoardBooleans, false];
								chatResponse.clipBoard = clipBoard;
								messageArray = handleAssistantResponse(chatResponseStream, messageArray);
								inputValue = '';
								return;
							}

							return reader.read().then(processText);
						})
						.catch((e) => {
							handleRequestError();
							chatResponseStream = handleStreamAborted(chatResponseStream);
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
				handleRequestError();
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
			handleRequestError();
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

	function handleRequestError() {
		chatResponses = chatResponses.slice(0, -1);
		userMessageArray = userMessageArray.slice(0, -1);
	}

	onMount(() => {
		inputRef.focus();
	});
</script>

<div class=" my-14">
	<div class="relative container mx-auto px-4 max-w-[832px] pb-24 mb-52">
		{#each chatResponses as chatResponse}
			{#if userMessageArray.length}
				<div
					class="whitespace-pre-line break-words rounded px-4 py-7 text-zinc-200 bg-skeletonDark"
				>
					<div class="flex items-start gap-4">
						<svg
							class="pointer-events-none shrink-0"
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 16 16"
							><path
								fill="#f1f5f9"
								d="M12.49 7.14L3.44 2.27c-.76-.41-1.64.3-1.4 1.13l1.24 4.34c.05.18.05.36 0 .54l-1.24 4.34c-.24.83.64 1.54 1.4 1.13l9.05-4.87a.98.98 0 0 0 0-1.72Z"
							/></svg
						>
						<p class="mt-1">{userMessageArray[chatResponses.indexOf(chatResponse)]}</p>
					</div>
				</div>
			{/if}
			{#if chatResponse.stream.filter((item) => item.text || item.code).length}
				<div
					class="whitespace-pre-line break-words rounded p-4 bg-slate-800 text-zinc-200 relative"
				>
					<div class="flex items-start gap-4">
						<svg
							class="pointer-events-none shrink-0"
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							><path
								fill="white"
								d="M20.562 10.188c.25-.688.313-1.376.25-2.063c-.062-.688-.312-1.375-.625-2c-.562-.938-1.375-1.688-2.312-2.125c-1-.438-2.063-.563-3.125-.313c-.5-.5-1.063-.937-1.688-1.25C12.437 2.126 11.687 2 11 2a5.17 5.17 0 0 0-3 .938c-.875.624-1.5 1.5-1.813 2.5c-.75.187-1.375.5-2 .875c-.562.437-1 1-1.375 1.562c-.562.938-.75 2-.625 3.063a5.438 5.438 0 0 0 1.25 2.874a4.695 4.695 0 0 0-.25 2.063c.063.688.313 1.375.625 2c.563.938 1.375 1.688 2.313 2.125c1 .438 2.062.563 3.125.313c.5.5 1.062.937 1.687 1.25c.625.312 1.375.437 2.063.437a5.17 5.17 0 0 0 3-.938c.875-.625 1.5-1.5 1.812-2.5a4.543 4.543 0 0 0 1.938-.875c.562-.437 1.062-.937 1.375-1.562c.562-.938.75-2 .625-3.063c-.125-1.062-.5-2.062-1.188-2.874Zm-7.5 10.5c-1 0-1.75-.313-2.437-.875c0 0 .062-.063.125-.063l4-2.313a.488.488 0 0 0 .25-.25c.062-.125.062-.187.062-.312V11.25l1.688 1v4.625a3.685 3.685 0 0 1-3.688 3.813ZM5 17.25c-.438-.75-.625-1.625-.438-2.5c0 0 .063.063.125.063l4 2.312a.563.563 0 0 0 .313.063c.125 0 .25 0 .312-.063l4.875-2.813v1.938l-4.062 2.375A3.71 3.71 0 0 1 7.312 19c-1-.25-1.812-.875-2.312-1.75ZM3.937 8.562a3.807 3.807 0 0 1 1.938-1.624v4.75c0 .124 0 .25.062.312a.488.488 0 0 0 .25.25l4.875 2.813l-1.687 1l-4-2.313a3.697 3.697 0 0 1-1.75-2.25c-.25-.938-.188-2.063.312-2.938ZM17.75 11.75l-4.875-2.813l1.687-1l4 2.313c.625.375 1.125.875 1.438 1.5c.312.625.5 1.313.437 2.063a3.718 3.718 0 0 1-.75 1.937c-.437.563-1 1-1.687 1.25v-4.75c0-.125 0-.25-.063-.313c0 0-.062-.124-.187-.187Zm1.687-2.5s-.062-.063-.125-.063l-4-2.312c-.125-.063-.187-.063-.312-.063s-.25 0-.313.063L9.812 9.688V7.75l4.063-2.375c.625-.375 1.312-.5 2.062-.5c.688 0 1.375.25 2 .688c.563.437 1.063 1 1.313 1.625s.312 1.375.187 2.062Zm-10.5 3.5l-1.687-1V7.062c0-.687.187-1.437.562-2C8.187 4.438 8.75 4 9.375 3.688a3.365 3.365 0 0 1 2.062-.312c.688.063 1.375.375 1.938.813c0 0-.063.062-.125.062l-4 2.313a.488.488 0 0 0-.25.25c-.063.125-.063.187-.063.312v5.625Zm.875-2L12 9.5l2.187 1.25v2.5L12 14.5l-2.188-1.25v-2.5Z"
							/></svg
						>
						<div class="my-1 w-full md:mr-12">
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
						</div>
					</div>
					{#if chatResponse.clipBoard}
						<button
							class="ml-auto mt-2 md:absolute bottom-4 right-4 ease-in duration-100 flex justify-center items-center shrink-0 rounded w-10 h-10 md:w-8 md:h-8 border border-slate-600 hover:bg-slate-900 hover:border-slate-900"
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
					{/if}
				</div>
			{/if}
		{/each}
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
						class="flex gap-4 items-center bg-red-900 whitespace-pre-line rounded mt-6 mb-8 p-4 text-zinc-200"
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
		<form on:submit={handleChat} class="relative max-w-[832px] mx-auto px-4">
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
