<script lang="ts">
	import { CodeBlock, clipboard } from '@skeletonlabs/skeleton';
	import type {
		IChatResponseStream,
		IChatHistory,
		IMessageArray,
		IStreamError
	} from '../interfaces/types';
	import { processTextAndCodeBlocks } from '../utils/processTextAndCodeBlocks';
	import { handleAssistantResponse, handleStreamAborted, parseLines } from '../utils/functions';
	import { onMount, tick } from 'svelte';

	let inputValue = '';
	let chatResponseStream: IChatResponseStream[] = [];
	let chatHistory: IChatHistory[] = [];
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
	const emphasisedText = /(`[^`]*`|\s)/g;
	const decoder = new TextDecoder('utf-8');

	async function getChatResponse(data: string, regenerate = false) {
		const model = {
			model: 'gpt-3.5-turbo',
			messages: [...messageArray, { role: 'user', content: data }],
			stream: true
		};

		try {
			!regenerate ? (chatHistory = [...chatHistory, { userMsg: data }]) : null;
			chatHistory = [...chatHistory, { stream: [{}] }];
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
				let restChunk = '';

				isStreaming = true;
				messageArray = [...messageArray, { role: 'user', content: data }];

				setTimeout(() => {
					isStreamingOverOneSecond = true;
				}, 1500);

				if (typeof reader === 'object') {
					reader
						.read()
						.then(function processText({ done, value }): unknown {
							const decodedChunk = decoder.decode(value).trim();
							const isRestChunk = !decodedChunk.endsWith('}]}') && !decodedChunk.endsWith('[DONE');
							let lines = decodedChunk.split('\n');

							lines[0] = restChunk ? restChunk + lines[0] : lines[0];
							lines = lines.filter((line) => line);
							restChunk = decodedChunk.endsWith('}]}') ? '' : restChunk;

							if (decodedChunk && isRestChunk && lines[lines.length - 1].length < 204) {
								restChunk = lines[lines.length - 1];
								lines = lines.slice(0, -1);
							}

							const parsedContent = parseLines(lines).filter((line) => line.id || line.done);

							isStreamError = [...isStreamError, ...parseLines(lines).filter((line) => line.error)];
							chatResponseStream = [...processTextAndCodeBlocks(parsedContent, chatResponseStream)];
							chatHistory[chatHistory.length - 1].stream = [...chatResponseStream];

							if (hasStreamBeenCancelled) {
								chatResponseStream = handleStreamAborted(chatResponseStream);
								reader.cancel();
							}

							if (isStreamError.length) {
								throw Error(isStreamError[0].error.message);
							}

							if (done) {
								clipBoardBooleans = [...clipBoardBooleans, false];
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
							restChunk = '';
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
				await regainFocus();
			}
		} catch (error: unknown) {
			handleRequestError();
			isError = true;
			if (error instanceof Error && error.name === 'AbortError') {
				errorString = 'Request timed out.  Please try again later';
			}
			await regainFocus();
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

	async function regainFocus() {
		if (window.innerWidth >= 958) {
			await tick();
			inputRef.focus();
		}
	}

	function handleClipBoardClick(index: number) {
		clipBoardBooleans[index] = true;
		setTimeout(() => {
			clipBoardBooleans[index] = false;
		}, 1000);
	}

	async function handleRegenerate() {
		inputValue = chatHistory.filter((item) => item.userMsg).at(-1)?.userMsg as string;
		chatHistory = chatHistory.slice(0, -1);
		messageArray = messageArray.slice(0, -2);
		await tick();
		await getChatResponse(inputValue, true);
	}

	function handleRequestError() {
		chatHistory = chatHistory.slice(0, -2);
	}

	onMount(() => {
		inputRef.focus();
	});
</script>

<div class="my-14">
	<div class="container relative mx-auto mb-52 max-w-[800px] px-4 pb-24">
		{#each chatHistory as message}
			{#if message.userMsg}
				<div class="whitespace-pre-line break-words rounded bg-skeletonDark px-4 py-6">
					<div class="flex items-start gap-4">
						<svg
							class="pointer-events-none shrink-0"
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 16 16"
							><path
								fill="currentColor"
								d="M12.49 7.14L3.44 2.27c-.76-.41-1.64.3-1.4 1.13l1.24 4.34c.05.18.05.36 0 .54l-1.24 4.34c-.24.83.64 1.54 1.4 1.13l9.05-4.87a.98.98 0 0 0 0-1.72Z"
							/></svg
						>
						<p class="mt-1">{message.userMsg}</p>
					</div>
				</div>
			{:else if message.stream}
				{#if message.stream.filter((item) => item.text || item.code).length}
					<div class="relative whitespace-pre-line break-words rounded bg-slate-800 p-4">
						<div class="flex items-start gap-4">
							<svg
								class="pointer-events-none shrink-0"
								xmlns="http://www.w3.org/2000/svg"
								width="32"
								height="32"
								viewBox="0 0 24 24"
								><path
									fill="currentColor"
									d="M20.562 10.188c.25-.688.313-1.376.25-2.063c-.062-.688-.312-1.375-.625-2c-.562-.938-1.375-1.688-2.312-2.125c-1-.438-2.063-.563-3.125-.313c-.5-.5-1.063-.937-1.688-1.25C12.437 2.126 11.687 2 11 2a5.17 5.17 0 0 0-3 .938c-.875.624-1.5 1.5-1.813 2.5c-.75.187-1.375.5-2 .875c-.562.437-1 1-1.375 1.562c-.562.938-.75 2-.625 3.063a5.438 5.438 0 0 0 1.25 2.874a4.695 4.695 0 0 0-.25 2.063c.063.688.313 1.375.625 2c.563.938 1.375 1.688 2.313 2.125c1 .438 2.062.563 3.125.313c.5.5 1.062.937 1.687 1.25c.625.312 1.375.437 2.063.437a5.17 5.17 0 0 0 3-.938c.875-.625 1.5-1.5 1.812-2.5a4.543 4.543 0 0 0 1.938-.875c.562-.437 1.062-.937 1.375-1.562c.562-.938.75-2 .625-3.063c-.125-1.062-.5-2.062-1.188-2.874Zm-7.5 10.5c-1 0-1.75-.313-2.437-.875c0 0 .062-.063.125-.063l4-2.313a.488.488 0 0 0 .25-.25c.062-.125.062-.187.062-.312V11.25l1.688 1v4.625a3.685 3.685 0 0 1-3.688 3.813ZM5 17.25c-.438-.75-.625-1.625-.438-2.5c0 0 .063.063.125.063l4 2.312a.563.563 0 0 0 .313.063c.125 0 .25 0 .312-.063l4.875-2.813v1.938l-4.062 2.375A3.71 3.71 0 0 1 7.312 19c-1-.25-1.812-.875-2.312-1.75ZM3.937 8.562a3.807 3.807 0 0 1 1.938-1.624v4.75c0 .124 0 .25.062.312a.488.488 0 0 0 .25.25l4.875 2.813l-1.687 1l-4-2.313a3.697 3.697 0 0 1-1.75-2.25c-.25-.938-.188-2.063.312-2.938ZM17.75 11.75l-4.875-2.813l1.687-1l4 2.313c.625.375 1.125.875 1.438 1.5c.312.625.5 1.313.437 2.063a3.718 3.718 0 0 1-.75 1.937c-.437.563-1 1-1.687 1.25v-4.75c0-.125 0-.25-.063-.313c0 0-.062-.124-.187-.187Zm1.687-2.5s-.062-.063-.125-.063l-4-2.312c-.125-.063-.187-.063-.312-.063s-.25 0-.313.063L9.812 9.688V7.75l4.063-2.375c.625-.375 1.312-.5 2.062-.5c.688 0 1.375.25 2 .688c.563.437 1.063 1 1.313 1.625s.312 1.375.187 2.062Zm-10.5 3.5l-1.687-1V7.062c0-.687.187-1.437.562-2C8.187 4.438 8.75 4 9.375 3.688a3.365 3.365 0 0 1 2.062-.312c.688.063 1.375.375 1.938.813c0 0-.063.062-.125.062l-4 2.313a.488.488 0 0 0-.25.25c-.063.125-.063.187-.063.312v5.625Zm.875-2L12 9.5l2.187 1.25v2.5L12 14.5l-2.188-1.25v-2.5Z"
								/></svg
							>
							<div
								class={`mt-1 w-full overflow-x-auto overflow-y-hidden md:mr-12 ${
									message.stream.filter((obj) => obj.text).length > 1 ? 'md:mb-3.5' : 'md:mb-1.5'
								}`}
							>
								{#each message.stream as stream}
									{#if stream.code || stream.text}
										{#if stream.code !== undefined}
											<CodeBlock
												class="my-1.5 overflow-x-auto"
												rounded="rounded"
												language={stream.language}
												code={stream.code}
											/>
											{#if isStreaming && chatHistory.at(-1) === message && message.stream.at(-1) === stream}
												<span class="blinking-cursor mt-4"></span>
											{/if}
										{:else if stream.text}
											<p>
												{#each stream.text.split(emphasisedText) as text}
													{#if text.match(/`[\s\S]*`$/g)}
														<span class="font-semibold italic text-zinc-50">{text}</span>
													{:else}
														{text}
													{/if}
												{/each}
												{#if isStreaming && chatHistory.at(-1) === message && message.stream.at(-1) === stream}
													<span class="blinking-cursor -ml-0.5"></span>
												{/if}
											</p>
										{/if}
									{:else if stream.clipBoard}
										<button
											class="bottom-4 right-4 ml-auto mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-600 duration-100 ease-in hover:border-slate-900 hover:bg-slate-900 md:absolute md:h-8 md:w-8"
											aria-label="Copy text"
											use:clipboard={stream.clipBoard}
											on:click={() => handleClipBoardClick(chatHistory.indexOf(message))}
											>{#if clipBoardBooleans[chatHistory.indexOf(message)]}
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
								{/each}
							</div>
						</div>
					</div>
				{/if}
			{/if}
		{/each}
		{#if isLoading}
			<div
				class="absolute bottom-2 left-0 z-10 mx-auto w-full rounded-md bg-transparent px-4 shadow"
			>
				<div class="flex animate-pulse space-x-4">
					<div class="flex-1 space-y-6 pb-4">
						<div class="h-2 rounded bg-slate-700"></div>
						<div class="h-2 rounded bg-slate-700"></div>
						<div class="space-y-3">
							<div class="grid grid-cols-3 gap-4">
								<div class="col-span-2 h-2 rounded bg-slate-700"></div>
								<div class="col-span-1 h-2 rounded bg-slate-700"></div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
		<div class="relative">
			{#if isError}
				<div class="absolute left-0 top-0 w-full">
					<div class="mt-6 flex items-center gap-4 whitespace-pre-line rounded bg-red-900 p-4">
						<svg
							class="pointer-events-none shrink-0 self-start"
							xmlns="http://www.w3.org/2000/svg"
							width="32"
							height="32"
							viewBox="0 0 24 24"
							><path
								fill="currentColor"
								d="M12 17q.425 0 .713-.288T13 16q0-.425-.288-.713T12 15q-.425 0-.713.288T11 16q0 .425.288.713T12 17Zm-1-4h2V7h-2v6Zm1 9q-2.075 0-3.9-.788t-3.175-2.137q-1.35-1.35-2.137-3.175T2 12q0-2.075.788-3.9t2.137-3.175q1.35-1.35 3.175-2.137T12 2q2.075 0 3.9.788t3.175 2.137q1.35 1.35 2.138 3.175T22 12q0 2.075-.788 3.9t-2.137 3.175q-1.35 1.35-3.175 2.138T12 22Zm0-2q3.35 0 5.675-2.325T20 12q0-3.35-2.325-5.675T12 4Q8.65 4 6.325 6.325T4 12q0 3.35 2.325 5.675T12 20Zm0-8Z"
							/></svg
						>
						<p>{errorString.length > 130 ? errorString.substring(0, 127) + '...' : errorString}</p>
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
	<div
		id="stop-generating"
		class={`pointer-events-none fixed bottom-40 flex w-full justify-center duration-200 ease-in-out ${
			isStreaming && isStreamingOverOneSecond ? 'visible opacity-100' : 'invisible opacity-0'
		}`}
	>
		<button
			on:click={() => (hasStreamBeenCancelled = true)}
			class={`btn pointer-events-auto border-2 border-slate-800 bg-slate-900 duration-200 ease-in-out
			${isStreaming ? '' : 'hidden'}`}
		>
			<span class="pointer-events-none">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1024 1024"
					><path
						fill="currentColor"
						d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448s448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372c0-89 31.3-170.8 83.5-234.8l523.3 523.3C682.8 852.7 601 884 512 884zm288.5-137.2L277.2 223.5C341.2 171.3 423 140 512 140c205.4 0 372 166.6 372 372c0 89-31.3 170.8-83.5 234.8z"
					/></svg
				>
			</span>
			<span class="pointer-events-none">Stop generating</span>
		</button>
	</div>
	<div
		id="regenerate"
		class={`pointer-events-none fixed bottom-40 flex w-full justify-center delay-300 duration-200 ease-in ${
			chatHistory.length && !isLoading && !isStreaming && !isError
				? 'visible opacity-100'
				: 'invisible opacity-0'
		}`}
	>
		<button
			on:click={handleRegenerate}
			class={`btn pointer-events-auto border-2 border-slate-800 bg-slate-900 duration-200 ease-in-out ${
				chatHistory.length && !isLoading && !isStreaming && !isError ? '' : 'hidden'
			}`}
		>
			<span class="pointer-events-none">
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 1200 1200"
					><path
						fill="currentColor"
						d="M600 0C308.74 0 66.009 207.555 11.499 482.812h166.553C229.37 297.756 398.603 161.719 600 161.719c121.069 0 230.474 49.195 309.668 128.613l-192.48 192.48H1200V0l-175.781 175.781C915.653 67.181 765.698 0 600 0zM0 717.188V1200l175.781-175.781C284.346 1132.819 434.302 1200 600 1200c291.26 0 533.991-207.555 588.501-482.812h-166.553C970.631 902.243 801.396 1038.281 600 1038.281c-121.069 0-230.474-49.195-309.668-128.613l192.48-192.48H0z"
					/></svg
				>
			</span>
			<span class="pointer-events-none">Regenerate</span>
		</button>
	</div>
	<div class="fixed bottom-0 z-50 mt-4 w-full bg-slate-800 pb-14 pt-8">
		<form on:submit={handleChat} class="relative mx-auto max-w-[800px] px-4">
			<label class={`flex rounded p-3 ${isLoading || isStreaming ? 'bg-gray-400' : 'bg-slate-50'}`}>
				<input
					bind:this={inputRef}
					bind:value={inputValue}
					on:keydown={(e) => (e.key === 'Enter' ? handleChat(e) : null)}
					name="message-input"
					id="message-input"
					aria-label="Send a message"
					class="w-full bg-inherit pr-14 font-semibold text-zinc-900 placeholder:font-normal placeholder:text-zinc-600 focus:outline-none"
					placeholder="Send a message"
					disabled={isLoading || isStreaming}
				/>
			</label>
			{#if !isLoading && !isStreaming}
				<button
					class="absolute right-6 top-1 h-10 w-10 rounded-lg bg-blue-700 duration-200 ease-in-out disabled:bg-slate-50"
					disabled={!inputValue.trim()}
				>
					<svg
						aria-label="Submit message"
						class={`pointer-events-none ${!inputValue.trim() ? 'text-slate-600' : 'text-slate-50'}`}
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
				<div class="placeholder-circle absolute right-8 top-3 w-6 animate-pulse"></div>
			{/if}
		</form>
	</div>
</div>
