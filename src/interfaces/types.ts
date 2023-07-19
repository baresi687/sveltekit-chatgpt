interface IChatResponseStream {
	text?: string;
	code?: string;
	language?: string;
	choices?: [];
	done?: boolean;
}

interface IChatResponses {
	message?: string;
	stream: [...IChatResponseStream[]];
}

interface IMessageArray {
	role: string;
	content: string;
}

interface IStreamError {
	error: { message: string };
}

interface IStream {
	choices: [{ delta: { content: string } }];
	done?: boolean;
}

interface IArr {
	code?: string;
	text?: string;
	language?: string;
}

export type { IChatResponseStream, IChatResponses, IMessageArray, IStreamError, IStream, IArr };
