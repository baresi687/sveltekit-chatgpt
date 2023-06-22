let codeBlockIncrement = 0;
let isCode = false;
let codeBlock = '';
let streamString = '';

export function processTextAndCodeBlocks(stream, arr) {
	let textString = '';
	let codeBlockStream = '';

	for (const elem of stream) {
		const content = elem.choices[0].delta.content;

		if (content) {
			streamString += content;
			if (content === '``' || content === '```') {
				isCode = !isCode;
				if (isCode) {
					codeBlockIncrement += 1;
					codeBlock = 'code' + codeBlockIncrement.toString();
					arr.push({
						[codeBlock]: 'code',
						code: '',
						language: 'plaintext'
					});
				}
			}

			if (isCode) {
				codeBlockStream += content;
				const findIt = arr.findIndex((item) => item[codeBlock]);
				let codeBackTicks = streamString.match(/```[a-z]*\n/gi);

				if (codeBackTicks) {
					codeBackTicks = codeBackTicks.map((item) => item.slice(0, item.length - 1).slice(3));
					arr[findIt].code = arr[findIt].code.replace(codeBackTicks[codeBackTicks.length - 1], '');
					arr[findIt].code = arr[findIt].code.replace(/```|``|`/, '');
					arr[findIt].language = codeBackTicks[codeBackTicks.length - 1].length
						? codeBackTicks[codeBackTicks.length - 1]
						: 'plaintext';
				}
				arr[findIt].code += codeBlockStream;
			} else {
				textString += content;
				textString = textString.replace(/```|``|`/, '');
				arr = [...arr, textString];
			}
			codeBlockStream = '';
			textString = '';
		}
	}

	return arr;
}
