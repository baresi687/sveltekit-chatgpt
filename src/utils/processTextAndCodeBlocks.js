let isCode = false;
let codeBlockRef = '';
let textBlockRef = '';
let streamString = '';

export function processTextAndCodeBlocks(stream, arr) {
	for (const elem of stream) {
		if (elem.id) {
			const content = elem.choices[0].delta.content;

			if (content) {
				streamString += content;
				const isCodeString = streamString.trim().match(/\n```$|^```/g);
				if (isCodeString) {
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
					const findIt = arr.findIndex((item) => item[codeBlockRef]);
					let codeBackTicks = streamString.match(/```[a-z]*$/);

					arr[findIt].code += content;

					if (codeBackTicks) {
						codeBackTicks = codeBackTicks.map((item) => item.slice(3, item.length));
						if (codeBackTicks[codeBackTicks.length - 1].length > 1) {
							arr[findIt].code = arr[findIt].code.replace(
								codeBackTicks[codeBackTicks.length - 1],
								''
							);
						}
						arr[findIt].language = codeBackTicks[codeBackTicks.length - 1].length
							? codeBackTicks[codeBackTicks.length - 1]
							: 'plaintext';
					}

					arr[findIt].code = arr[findIt].code.replace(/^```|``$|^`\n$/, '');
				} else {
					const findIt = arr.findIndex((item) => item[textBlockRef]);

					if (findIt !== -1) {
						arr[findIt].text += content;
						arr[findIt].text = arr[findIt].text.replace(/^`\n|\s``$/, '');
					} else {
						textBlockRef = 'textRef' + Math.random().toString().slice(3, 9);
						arr.push({
							[textBlockRef]: 'text',
							text: content
						});
						arr[arr.length - 1].text = arr[arr.length - 1].text.replace(/``$/, '');
					}
				}

				arr = [...arr.filter((item) => item.text !== '```')];
			}
		}
		if (elem.done) {
			streamString = '';
		}
	}
	return arr;
}
