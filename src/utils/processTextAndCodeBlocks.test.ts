import { test, expect, beforeEach } from 'vitest';
import {
	processTextAndCodeBlocks,
	textBlockRef,
	codeBlockRef,
	isCode
} from './processTextAndCodeBlocks';
import type { IStream, IArr } from '../interfaces/types';

// Resets function and variables before each test
beforeEach(() => {
	processTextAndCodeBlocks([{ done: true, choices: [{ delta: { content: '' } }] }], []);
});

test('Return array with text object and property text', () => {
	const stream: IStream[] = [{ choices: [{ delta: { content: 'Hello' } }] }];
	const arr: IArr[] = [];
	const expected = [{ text: 'Hello' }];

	expect(processTextAndCodeBlocks(stream, arr)).toMatchObject(expected);
});

test('Return array with text object and property text updated', () => {
	const stream: IStream[] = [{ choices: [{ delta: { content: ' there!' } }] }];
	const arr: IArr[] = [{ [textBlockRef]: 'text', text: 'Hello' }];
	const expected = [{ text: 'Hello there!' }];

	expect(processTextAndCodeBlocks(stream, arr)).toMatchObject(expected);
});

test('Return array with code object and property code updated', () => {
	expect(isCode).toBe(false);
	const stream: IStream[] = [{ choices: [{ delta: { content: '\n```' } }] }];
	const arr: IArr[] = [{ [textBlockRef]: 'text', text: 'Here is an example' }];
	const expected = [{}, { language: 'plaintext' }];

	expect(processTextAndCodeBlocks(stream, arr)).toMatchObject(expected);
	expect(isCode).toBe(true);

	const secondStream: IStream[] = [{ choices: [{ delta: { content: '\nconst' } }] }];
	const secondArr: IArr[] = [{ [codeBlockRef]: 'code', code: '', language: 'plaintext' }];
	const secondExpected = [{ [codeBlockRef]: 'code', code: '\nconst', language: 'plaintext' }];

	expect(processTextAndCodeBlocks(secondStream, secondArr)).toMatchObject(secondExpected);
});

test('Return array with text and code objects', () => {
	const stream1: IStream[] = [{ choices: [{ delta: { content: '```' } }] }];
	const arr1: IArr[] = [{ [textBlockRef]: 'text', text: 'Here is an example:' }];

	const stream2: IStream[] = [{ choices: [{ delta: { content: 'const sum = 10\n' } }] }];
	const arr2 = processTextAndCodeBlocks(stream1, arr1);

	const stream3: IStream[] = [{ choices: [{ delta: { content: '```' } }] }];
	const arr3 = processTextAndCodeBlocks(stream2, arr2);

	const stream4: IStream[] = [{ choices: [{ delta: { content: 'This is a variable.' } }] }];
	const arr4 = processTextAndCodeBlocks(stream3, arr3);

	const stream5: IStream[] = [{ choices: [{ delta: { content: ' With a value of 10' } }] }];
	const arr5 = processTextAndCodeBlocks(stream4, arr4);

	const arrWithTextAndCodeObjects = processTextAndCodeBlocks(stream5, arr5);

	const expected = [
		{ text: 'Here is an example:' },
		{ code: 'const sum = 10\n', language: 'plaintext' },
		{ text: 'This is a variable. With a value of 10' }
	];

	expect(arrWithTextAndCodeObjects).toMatchObject(expected);
});
