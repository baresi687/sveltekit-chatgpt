let isCode = false;
let codeBlockRef = '';
let textBlockRef = '';
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
					codeBlockRef = 'codeRef' + Math.random().toString().slice(3, 9);
					arr.push({
						[codeBlockRef]: 'code',
						code: '',
						language: 'plaintext'
					});
				} else {
					textBlockRef = 'textRef' + Math.random().toString().slice(3, 9);
					arr.push({
						[textBlockRef]: 'text',
						text: ''
					});
				}
			}

			if (isCode) {
				codeBlockStream += content;
				const findIt = arr.findIndex((item) => item[codeBlockRef]);
				let codeBackTicks = streamString.match(/```[a-z]*\n/gi);

				if (codeBackTicks) {
					codeBackTicks = codeBackTicks.map((item) => item.slice(0, item.length - 1).slice(3));
					arr[findIt].code = arr[findIt].code.replace(/```/, '');
					arr[findIt].code = arr[findIt].code.replace(codeBackTicks[codeBackTicks.length - 1], '');
					arr[findIt].language = codeBackTicks[codeBackTicks.length - 1].length
						? codeBackTicks[codeBackTicks.length - 1]
						: 'plaintext';
				}
				arr[findIt].code += codeBlockStream;
			} else {
				const findIt = arr.findIndex((item) => item[textBlockRef]);
				textString += content;

				if (findIt !== -1) {
					arr[findIt].text += textString.replace(/``/, '');
					arr[findIt].text = arr[findIt].text.replace(/^`/, '');
				} else {
					textBlockRef = 'textRef' + Math.random().toString().slice(3, 9);
					arr.push({
						[textBlockRef]: 'text',
						text: textString
					});
				}
			}
			codeBlockStream = '';
			textString = '';
		}
	}
	console.log(arr);
	return arr;
}
