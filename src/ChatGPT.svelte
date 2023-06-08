<script>
	function handleChat(e) {
		e.preventDefault();
		e.target.reset();
		console.log('handled');
	}
</script>

<div class="max-w-2xl my-14 mx-auto">
	<form on:submit={handleChat}>
		<input
			id="chat"
			class="w-full h-10 indent-2.5 rounded text-zinc-900 font-semibold placeholder:font-normal placeholder:text-zinc-600"
			type="text"
			placeholder="Send a message"
		/>
	</form>
	<!--<div id="chat-response" class="rounded my-8 p-4 bg-zinc-800 text-zinc-200">
		Duis molestie leo in dolor sollicitudin, id cursus tortor malesuada. Morbi ornare libero sem, in
		ullamcorper nisl ultricies sed. Nunc commodo accumsan velit, eget accumsan sem dictum eget.
		Vestibulum pharetra vel erat dapibus ultrices. Pellentesque mollis tempus semper.
	</div>-->
</div>
