const { Client } = require('./TinyChat.js');
const { JSDOM } = require('jsdom');
const localCrypto = new (require("@peculiar/webcrypto").Crypto)();
const { readFileSync } = require('fs');

const generateClient: () => typeof Client = () => new Client(new JSDOM(readFileSync('./TinyChat.html')).window, localCrypto);

Promise.all(Object.entries({
	'createChatTest': async (): Promise<boolean> => {
		const client: typeof Client = generateClient();
		const UUID: string = client.randomUUID();
		await client.createChat(UUID);
		return client.window.document.getElementById(UUID).parentElement.outerHTML === `<details open=""><summary>${UUID}</summary><div class="chatButtonsContainer"><input type="button" value="Clear Chat Locally" class="chatButtons"><input type="button" value="Clear Chat Globally" class="chatButtons"><input type="button" value="Generate New AES Key" class="chatButtons"><input type="button" value="Upload File" class="chatButtons"><input type="button" value="Share Location" class="chatButtons"><label>Send Typing Indicators</label><input type="checkbox" class="chatButtons"></div><span class="message" id="${UUID}"></span><div class="chatButtonsContainer"><textarea class="sendBar"></textarea><input type="button" value=">" class="sendButton"></div></details>`;
	},
	'renderTest': async (): Promise<boolean> => {
		const client: typeof Client = generateClient();
		const UUID: string = client.randomUUID();
		await client.createChat(UUID);
		const messageBody: string = 'test message';
		const messageTime: string = new Date().toLocaleTimeString();
		const messageID: string = client.randomUUID();
		await client.render(UUID, {
			from: client.id,
			body: await client.encryptAES(UUID, messageBody),
			time: await client.encryptAES(UUID, messageTime),
			id: messageID,
			event: undefined,
			prev: undefined
		});
		return client.window.document.getElementById(UUID).parentElement.outerHTML === `<details open=""><summary>${UUID}</summary><div class="chatButtonsContainer"><input type="button" value="Clear Chat Locally" class="chatButtons"><input type="button" value="Clear Chat Globally" class="chatButtons"><input type="button" value="Generate New AES Key" class="chatButtons"><input type="button" value="Upload File" class="chatButtons"><input type="button" value="Share Location" class="chatButtons"><label>Send Typing Indicators</label><input type="checkbox" class="chatButtons"></div><span class="message" id="${UUID}"><p class="sent" id="${messageID}">${messageBody} <small><small><small><i>${messageTime}</i></small></small></small></p></span><div class="chatButtonsContainer"><textarea class="sendBar"></textarea><input type="button" value=">" class="sendButton"></div></details>`;
	}
}).map(async ([key, value]: [string, () => Promise<boolean>]): Promise<void> => {
	if (!await value()) {
		console.error(`Failed Test: ${key}`);
		process.exit(1);
	} else
		console.log(`Passed Test: ${key}`);
})).then(() => process.exit(0));
