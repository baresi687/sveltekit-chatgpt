<script>
	let value = '';
	let chatResponse = '';
	let isLoading = false;

	export async function getChatResponse(data) {
		const model = {
			model: 'gpt-3.5-turbo',
			messages: [{ role: 'user', content: data }]
		};

		try {
			isLoading = true;
			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${import.meta.env.VITE_CHATGPT_KEY}`
				},
				body: JSON.stringify(model)
			});
			return await response.json();
		} catch (error) {
			return 'Something went wrong';
		} finally {
			isLoading = false;
		}
	}

	function handleChat(e) {
		e.preventDefault();

		if (value) {
			getChatResponse(value)
				.then((response) => {
					console.log(response);
					chatResponse = response.choices[0].message.content;
				})
				.catch(() => {
					chatResponse = 'Something went wrong.. please try again later';
				});
		}
		e.target.reset();
	}
</script>

<div class="max-w-2xl my-14 mx-auto">
	<form on:submit={handleChat}>
		<input
			bind:value
			id="chat"
			class="w-full h-10 indent-2.5 rounded text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600"
			type="text"
			placeholder="Send a message"
		/>
	</form>
	{#if isLoading}
		<div class="shadow rounded-md w-full mx-auto my-5">
			<div class="animate-pulse flex space-x-4">
				<div class="flex-1 space-y-6 py-1">
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
	{#if chatResponse && !isLoading}
		<div id="chat-response" class="whitespace-pre-line rounded my-8 p-4 bg-zinc-800 text-zinc-200">
			{chatResponse}
		</div>
	{/if}
</div>
