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

export type { IChatResponseStream, IChatResponses, IMessageArray, IStreamError };
