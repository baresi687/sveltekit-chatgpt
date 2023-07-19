import { findIndex } from './functions';
import type { IStream, IArr } from '../interfaces/types';

let isCode = false;
let codeBlockRef = '';
let textBlockRef = '';
let streamString = '';

export function processTextAndCodeBlocks(stream: IStream[], arr: IArr[]) {
	for (const elem of stream) {
		const { choices, done } = elem;

		if (choices && choices[0].delta.content) {
			const content = choices[0].delta.content;
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
				const findIt = findIndex(arr, codeBlockRef);
				const codeBackTicks = streamString.match(/```[a-z]*$/);

				arr[findIt].code += content;

				if (codeBackTicks) {
					const codeLanguage = codeBackTicks.map((item) => item.slice(3, item.length));

					if (codeLanguage[codeLanguage.length - 1].length > 1) {
						arr[findIt].code = arr[findIt].code?.replace(codeLanguage[codeLanguage.length - 1], '');
					}
					arr[findIt].language = codeLanguage[codeLanguage.length - 1].length
						? codeLanguage[codeLanguage.length - 1]
						: 'plaintext';
				}

				arr[findIt].code = arr[findIt].code?.replace(/^```|``$|^`\n$/, '');
			} else {
				const findIt = findIndex(arr, textBlockRef);

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
		if (done) {
			streamString = '';
			isCode = false;
		}
	}
	return arr;
}

export { isCode, codeBlockRef, textBlockRef, streamString };
