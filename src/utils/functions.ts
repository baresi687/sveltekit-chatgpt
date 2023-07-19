import { processTextAndCodeBlocks } from './processTextAndCodeBlocks';
import type { IChatResponseStream, IMessageArray, IArr } from '../interfaces/types';

function parseLines(arr: Array<string>) {
	return arr
		.map((line) => line.replace(/^data: /, '').trim())
		.filter((line) => line.startsWith('{"id') || line.startsWith('{"error') || line === '[DONE]')
		.map((line) => {
			if (line.startsWith('{"id') || line.startsWith('{"error')) {
				return JSON.parse(line);
			} else {
				return JSON.parse('{"done": true}');
			}
		});
}

function findIndex(arr: IArr[], ref: string) {
	return arr.findIndex((item) => item[ref as keyof IArr]);
}

function handleAssistantResponse(
	chatResponseStream: IChatResponseStream[],
	messageArray: IMessageArray[]
) {
	const assistantResponse = chatResponseStream.map((item) => item.text || item.code).join(' ');
	return [...messageArray, { role: 'assistant', content: assistantResponse }];
}

function handleStreamError(arr: IChatResponseStream[]) {
	return [
		...processTextAndCodeBlocks([{ done: true, choices: [{ delta: { content: '' } }] }], arr)
	];
}

export { parseLines, findIndex, handleAssistantResponse, handleStreamError };
