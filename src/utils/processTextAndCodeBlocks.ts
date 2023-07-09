let isCode = false;
let codeBlockRef = '';
let textBlockRef = '';
let streamString = '';

interface IStream {
	choices: [{ delta: { content: string } }];
	done: boolean;
}

interface IArr {
	code?: string;
	text?: string;
	language?: string;
}
export function processTextAndCodeBlocks(stream: IStream[], arr: IArr[]) {
	for (const elem of stream) {
		const { choices, done }: IStream = elem;

		if (choices) {
			const content = choices[0].delta.content;

			if (content) {
				streamString += content;
				const isCodeString = streamString.trim().match(/\n```$|^```$/g);
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
					const findIt = arr.findIndex((item) => item[codeBlockRef as keyof IArr]);
					const codeBackTicks = streamString.match(/```[a-z]*$/);

					arr[findIt].code += content;

					if (codeBackTicks) {
						const codeLanguage = codeBackTicks.map((item) => item.slice(3, item.length));
						if (codeLanguage[codeLanguage.length - 1].length > 1) {
							arr[findIt].code = arr[findIt].code?.replace(
								codeLanguage[codeLanguage.length - 1],
								''
							);
						}
						arr[findIt].language = codeLanguage[codeLanguage.length - 1].length
							? codeLanguage[codeLanguage.length - 1]
							: 'plaintext';
					}

					arr[findIt].code = arr[findIt].code?.replace(/^```|``$|^`\n$/, '');
				} else {
					const findIt = arr.findIndex((item) => item[textBlockRef as keyof IArr]);

					if (findIt !== -1) {
						arr[findIt].text += content;
						arr[findIt].text = arr[findIt].text?.replace(/^`\n|\s``$/, '');
					} else {
						textBlockRef = 'textRef' + Math.random().toString().slice(3, 9);
						arr.push({
							[textBlockRef]: 'text',
							text: content
						});
						arr[arr.length - 1].text = arr[arr.length - 1].text?.replace(/``$/, '');
					}
				}

				arr = [...arr.filter((item) => item.text !== '```')];
			}
		}
		if (done) {
			streamString = '';
		}
	}
	return arr;
}
